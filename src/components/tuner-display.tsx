import type { PitchResult } from "../lib/pitch";

interface TunerDisplayProps {
  result: PitchResult | null;
}

function getTuningStatus(cents: number) {
  if (Math.abs(cents) <= 5) return "in-tune";
  return cents < 0 ? "flat" : "sharp";
}

function getTuningLabel(cents: number) {
  const status = getTuningStatus(cents);
  if (status === "in-tune") return "In Tune";
  if (status === "flat") return `${Math.abs(cents)}c Flat`;
  return `${Math.abs(cents)}c Sharp`;
}

function getIndicatorColor(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return "text-emerald-400";
  if (abs <= 15) return "text-yellow-400";
  return "text-red-400";
}

function getNeedleRotation(cents: number) {
  const clamped = Math.max(-50, Math.min(50, cents));
  return (clamped / 50) * 45;
}

export function TunerDisplay({ result }: TunerDisplayProps) {
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-6xl font-bold text-zinc-600">--</div>
        <div className="text-sm text-zinc-500">Play a string...</div>
      </div>
    );
  }

  const { frequency, note, cents } = result;
  const status = getTuningStatus(cents);
  const color = getIndicatorColor(cents);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex h-32 w-64 items-end justify-center overflow-hidden">
        <div className="absolute bottom-0 h-px w-full bg-zinc-700" />

        {[-45, -30, -15, 0, 15, 30, 45].map((deg) => (
          <div
            key={deg}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              height: deg === 0 ? "100px" : "80px",
              transform: `translateX(-50%) rotate(${deg}deg)`,
            }}
          >
            <div
              className={`h-full w-px ${deg === 0 ? "bg-emerald-500" : "bg-zinc-700"}`}
            />
          </div>
        ))}

        <div
          className="absolute bottom-0 left-1/2 z-10 origin-bottom transition-transform duration-150"
          style={{
            height: "90px",
            transform: `translateX(-50%) rotate(${getNeedleRotation(cents)}deg)`,
          }}
        >
          <div className={`h-full w-0.5 ${color}`} />
        </div>

        <div className={`absolute -bottom-1 left-1/2 z-10 h-2 w-2 -translate-x-1/2 rounded-full ${color}`} />
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className={`text-7xl font-bold tracking-tight ${color}`}>
          {note.note}
        </div>
        <div className="text-sm text-zinc-400">
          {frequency.toFixed(1)} Hz
        </div>
      </div>

      <div className={`text-lg font-medium ${color}`}>
        {status === "in-tune" && "In Tune"}
        {status !== "in-tune" && getTuningLabel(cents)}
      </div>

      <div className="flex w-full max-w-xs items-center gap-2">
        <span className="text-xs text-zinc-500">Flat</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`absolute top-0 h-full w-1 rounded-full transition-all duration-150 ${color.replace("text-", "bg-")}`}
            style={{
              left: `${50 + (Math.max(-50, Math.min(50, cents)) / 50) * 50}%`,
              transform: "translateX(-50%)",
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-600" />
        </div>
        <span className="text-xs text-zinc-500">Sharp</span>
      </div>
    </div>
  );
}
