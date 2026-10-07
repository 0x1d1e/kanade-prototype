import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`icon ${className}`}
      style={
        {
          "--icon": `url('/icons/${name}.svg')`,
          width: size,
          height: size,
        } as CSSProperties
      }
    />
  );
}

export function AppIcon({ kind }: { kind: string }) {
  return (
    <span aria-hidden="true" className={`app-icon app-${kind}`}>
      {kind === "folder"
        ? "▰"
        : kind === "browser"
          ? "◉"
          : kind === "terminal"
            ? ">_"
            : kind === "music"
              ? "♫"
              : "⌘"}
    </span>
  );
}
