#!/usr/bin/env python3
"""Prepare the licensed visual-study excerpt and measure every audio cue.
Requires Python + numpy and ffmpeg. Full source audio stays in /tmp, not the repo.
"""
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public/morph"
OUT = ROOT / "renders"
SOURCE = "https://assets.mixkit.co/music/162/162.mp3"
RATE = 48000
DURATION = 14


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *map(str, args)], check=True)


def prepare():
    ASSETS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="kanade-audio-") as temp:
        temp = Path(temp)
        song = temp / "source.mp3"
        urllib.request.urlretrieve(SOURCE, song)
        ffmpeg("-i", song, "-ac", 1, "-ar", 22050, "-f", "f32le", temp / "mono.raw")
        sample_rate, hop, frame = 22050, 220, 1024
        samples = np.fromfile(temp / "mono.raw", dtype="<f4")
        windows = np.lib.stride_tricks.sliding_window_view(samples, frame)[::hop]
        spectrum = np.abs(np.fft.rfft(windows * np.hanning(frame), axis=1))
        flux = np.maximum(0, np.diff(spectrum, axis=0)).sum(axis=1)
        flux = np.minimum(flux, np.percentile(flux, 98))
        flux -= flux.mean()
        autocorrelation = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
        lo, hi = int(sample_rate / hop * 60 / 140), int(sample_rate / hop * 60 / 100)
        lag = lo + np.argmax(autocorrelation[lo:hi])
        rough_bpm = 60 * sample_rate / hop / lag
        # Refine across the whole song; integer STFT lags alone round the tempo.
        best = (-np.inf, None, None)
        for bpm in np.arange(round(rough_bpm) - .2, round(rough_bpm) + .201, .005):
            step = 60 / bpm * sample_rate / hop
            for phase in np.arange(0, step, .25):
                score = np.interp(np.arange(phase, len(flux), step), np.arange(len(flux)), flux).mean()
                if score > best[0]:
                    best = (score, bpm, phase)
        _, bpm, phase = best
        # Refine the onset peak, not the later bass sustain. Infer bar 1 from the source opening.
        beat_seconds = 60 / bpm
        expected = 32 * beat_seconds + phase * hop / sample_rate
        candidates = np.arange(max(0, int((expected - .03) * sample_rate / hop)), int((expected + .03) * sample_rate / hop))
        peak_frame = candidates[np.argmax(flux[candidates])]
        downbeat_peak = (peak_frame * hop + frame / 2) / sample_rate
        ratio = 120 / bpm
        ffmpeg("-ss", downbeat_peak, "-i", song,
               "-af", f"atrim=duration={28 * beat_seconds},atempo={ratio},apad,atrim=duration=14", "-ac", 2, "-ar", RATE,
               "-f", "f32le", temp / "excerpt.raw")
        music = np.fromfile(temp / "excerpt.raw", dtype="<f4").reshape(-1, 2)[:RATE * DURATION].astype(np.float64)
        if len(music) != RATE * DURATION:
            raise RuntimeError("Excerpt must be exactly 14 seconds")
        # Re-measure after atempo, which adds a small processing offset.
        output_hop, output_frame = 240, 2048
        mono = music.mean(axis=1)
        output_windows = np.lib.stride_tricks.sliding_window_view(mono, output_frame)[::output_hop]
        output_spectrum = np.abs(np.fft.rfft(output_windows * np.hanning(output_frame), axis=1))
        output_flux = np.maximum(0, np.diff(output_spectrum, axis=0)).sum(axis=1)
        grid = np.arange(1, 27) * .5
        offsets = np.arange(0, .5, .001)
        scores = [np.interp((grid + offset) * RATE / output_hop, np.arange(len(output_flux)), output_flux).mean() for offset in offsets]
        output_offset = float(offsets[np.argmax(scores)] + output_frame / 2 / RATE)
        # Use the nearest phase correction, never accidentally advance a whole beat.
        output_offset = (output_offset + .25) % .5 - .25
        music = np.roll(music, -round(output_offset * RATE), axis=0)
        music *= .42 / max(.01, np.max(np.abs(music)))
        # A 1ms Hermite bridge matches value and slope without an audible tail burst.
        bridge = 48
        u = np.linspace(0, 1, bridge)
        p0, p1 = music[-bridge].copy(), music[0].copy()
        m0 = (music[-bridge] - music[-bridge - 1]) * bridge
        m1 = (music[1] - music[0]) * bridge
        music[-bridge:] = ((2 * u**3 - 3 * u**2 + 1)[:, None] * p0
                          + (u**3 - 2 * u**2 + u)[:, None] * m0
                          + (-2 * u**3 + 3 * u**2)[:, None] * p1
                          + (u**3 - u**2)[:, None] * m1)
        rng = np.random.default_rng(35)
        cues = []
        # All cue placement subtracts the measured sample peak, never a guessed onset.
        events = [(0.5, "click"), (1.5, "confirm"), (2.5, "click"), (3, "click"),
                  (3.5, "grab"), (4.5, "release"), (5, "grab"), (6, "release"),
                  (7, "click"), (8, "click"), (10, "hover"), (11, "click"),
                  (11.5, "key"), (12, "key"), (12.5, "confirm"), (13, "release")]
        for beat_time, kind in events:
            length = .12 if kind == "confirm" else .035
            time = np.arange(round(length * RATE)) / RATE
            envelope = (1 - np.exp(-time * 1100)) * np.exp(-time * (48 if kind == "confirm" else 180))
            frequency = {"confirm": 1100, "key": 1700, "grab": 720, "release": 860, "hover": 1400, "click": 1250}[kind]
            sound = envelope * (np.sin(2 * np.pi * frequency * time) + .16 * rng.standard_normal(len(time)))
            sound *= (.045 if kind == "hover" else .085) / np.max(np.abs(sound))
            peak = int(np.argmax(np.abs(sound)))
            start = round(beat_time * RATE) - peak
            indices = (start + np.arange(len(sound))) % len(music)
            music[indices] += sound[:, None]
            cues.append({"kind": kind, "beat_seconds": beat_time, "source_peak_sample": peak,
                         "placement_seconds": start / RATE, "measured_peak_seconds": (start + peak) / RATE})
        pcm = (np.clip(music, -.98, .98) * 32767).astype("<i2")
        with wave.open(str(OUT / "soundtrack.wav"), "wb") as output:
            output.setnchannels(2)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        ffmpeg("-i", OUT / "soundtrack.wav", "-codec:a", "libmp3lame", "-b:a", "192k", ASSETS / "soundtrack.mp3")
        report = {"song": "Minimal Techno 01", "artist": "Alejandro Magaña (A. M.)", "source": SOURCE,
                  "license": "https://mixkit.co/license/#musicFree", "rough_bpm": float(rough_bpm),
                  "measured_bpm": float(bpm), "tempo_ratio": float(ratio),
                  "source_downbeat": 33, "source_downbeat_peak_seconds": float(downbeat_peak),
                  "output_processing_offset_seconds": output_offset,
                  "downbeat_basis": "Downbeat inferred from the source opening as beat 1; choose beat 33 (bar 9). Spectral-flux peak refines alignment; remeasure after atempo.",
                  "output_bpm": 120, "duration_seconds": DURATION, "beat_grid": [i * .5 for i in range(28)],
                  "ui_cues": cues}
        (ASSETS / "audio-analysis.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps({key: report[key] for key in ["measured_bpm", "source_downbeat_peak_seconds", "tempo_ratio"]}, indent=2))


if __name__ == "__main__":
    prepare()
