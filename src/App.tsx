import { TunerDisplay } from "./components/tuner-display";
import { useTuner } from "./hooks/use-tuner";

export default function App() {
  const { active, result, error, start, stop } = useTuner();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-10 px-6">
        <h1 className="text-2xl font-semibold tracking-wide text-zinc-300">
          Sonance
        </h1>

        <TunerDisplay result={result} />

        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={active ? stop : start}
          className={`w-full cursor-pointer rounded-lg px-6 py-3 text-sm font-medium transition-colors ${
            active
              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              : "bg-white text-zinc-950 hover:bg-zinc-200"
          }`}
        >
          {active ? "Stop" : "Start Tuning"}
        </button>
      </div>
    </div>
  );
}
