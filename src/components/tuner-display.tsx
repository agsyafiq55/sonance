import type { PitchResult } from "../lib/pitch";

interface TunerDisplayProps {
  result: PitchResult | null;
  active: boolean;
}

type ColorKey = "emerald" | "yellow" | "red" | "zinc";

const COLOR_CLASSES: Record<ColorKey, { text: string; bg: string; glow: string }> = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-400", glow: "34, 197, 94" },
  yellow: { text: "text-yellow-400", bg: "bg-yellow-400", glow: "250, 204, 21" },
  red: { text: "text-red-400", bg: "bg-red-400", glow: "248, 113, 113" },
  zinc: { text: "text-zinc-600", bg: "bg-zinc-600", glow: "82, 82, 91" },
};

function getTuningLabel(cents: number) {
  if (Math.abs(cents) <= 5) return "In Tune";
  if (cents < 0) return `${Math.abs(cents)}c Flat`;
  return `${Math.abs(cents)}c Sharp`;
}

function getColorKey(cents: number): ColorKey {
  const abs = Math.abs(cents);
  if (abs <= 5) return "emerald";
  if (abs <= 15) return "yellow";
  return "red";
}

function getNeedleRotation(cents: number) {
  const clamped = Math.max(-50, Math.min(50, cents));
  return (clamped / 50) * 45;
}

function glowStyle(rgb: string, strong: boolean) {
  const spread = strong ? "20px" : "10px";
  const opacity = strong ? 0.6 : 0.3;
  return `0 0 ${spread} rgba(${rgb}, ${opacity})`;
}

export function TunerDisplay({ result, active }: TunerDisplayProps) {
  const hasResult = result !== null;
  const cents = result?.cents ?? 0;
  const inTune = hasResult && Math.abs(cents) <= 5;
  const colorKey = hasResult ? getColorKey(cents) : "zinc";
  const c = COLOR_CLASSES[colorKey];
  const glow = glowStyle(c.glow, inTune);

  const needleDeg = hasResult ? getNeedleRotation(cents) : 0;
  const barLeft = 50 + (hasResult ? (Math.max(-50, Math.min(50, cents)) / 50) * 50 : 0);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Gauge */}
      <div className="relative flex h-36 w-72 items-end justify-center overflow-hidden">
        <div className="absolute bottom-0 h-px w-full bg-zinc-700" />

        {/* Tick marks */}
        {[-45, -30, -15, 0, 15, 30, 45].map((deg) => {
          const isCenter = deg === 0;
          return (
            <div
              key={deg}
              className="absolute bottom-0 left-1/2 origin-bottom"
              style={{
                height: isCenter ? "110px" : "85px",
                transform: `translateX(-50%) rotate(${deg}deg)`,
              }}
            >
              <div
                className={`h-full ${isCenter ? "w-0.5 bg-emerald-500/80" : "w-px bg-zinc-700"}`}
              />
            </div>
          );
        })}

        {/* In-tune zone highlight */}
        {inTune && (
          <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-t-full bg-emerald-500/10 transition-opacity duration-500" />
        )}

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 z-10 origin-bottom"
          style={{
            height: "100px",
            transform: `translateX(-50%) rotate(${needleDeg}deg)`,
            transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div
            className={`h-full w-0.5 rounded-full ${c.bg}`}
            style={{ boxShadow: glow }}
          />
        </div>

        {/* Pivot dot */}
        <div
          className={`absolute -bottom-1 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rounded-full ${c.bg}`}
          style={{
            boxShadow: glow,
            transition: "background-color 300ms ease, box-shadow 300ms ease",
          }}
        />
      </div>

      {/* Note */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={`text-7xl font-bold tracking-tight ${c.text}`}
          style={{
            transition: "color 300ms ease, text-shadow 300ms ease",
            textShadow: hasResult ? glow : "none",
          }}
        >
          {hasResult ? result.note.note : "--"}
        </div>
        <div className="text-sm text-zinc-400">
          {hasResult ? `${result.frequency.toFixed(1)} Hz` : "\u00A0"}
        </div>
      </div>

      {/* Status */}
      <div
        className={`text-lg font-medium ${c.text}`}
        style={{ transition: "color 300ms ease" }}
      >
        {hasResult
          ? getTuningLabel(cents)
          : active
            ? "Play a string..."
            : "\u00A0"}
      </div>

      {/* Cents bar */}
      <div className="flex w-full max-w-xs items-center gap-2">
        <span className="text-xs text-zinc-500">Flat</span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`absolute top-0 h-full w-1.5 rounded-full ${c.bg}`}
            style={{
              left: `${barLeft}%`,
              transform: "translateX(-50%)",
              boxShadow: glow,
              transition:
                "left 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease, box-shadow 300ms ease",
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-600" />
        </div>
        <span className="text-xs text-zinc-500">Sharp</span>
      </div>
    </div>
  );
}
