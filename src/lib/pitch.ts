import { YIN } from "pitchfinder";

const STANDARD_TUNING = [
  { note: "E2", frequency: 82.41 },
  { note: "A2", frequency: 110.0 },
  { note: "D3", frequency: 146.83 },
  { note: "G3", frequency: 196.0 },
  { note: "B3", frequency: 246.94 },
  { note: "E4", frequency: 329.63 },
] as const;

export type TuningNote = (typeof STANDARD_TUNING)[number];

export interface PitchResult {
  frequency: number;
  note: TuningNote;
  cents: number;
}

export function createDetector(sampleRate: number) {
  return YIN({ sampleRate });
}

export function findClosestNote(frequency: number): TuningNote {
  let closest: TuningNote = STANDARD_TUNING[0];
  let minDistance = Math.abs(centsFromTarget(frequency, closest.frequency));

  for (let i = 1; i < STANDARD_TUNING.length; i++) {
    const distance = Math.abs(
      centsFromTarget(frequency, STANDARD_TUNING[i].frequency),
    );
    if (distance < minDistance) {
      minDistance = distance;
      closest = STANDARD_TUNING[i];
    }
  }

  return closest;
}

export function centsFromTarget(
  detected: number,
  reference: number,
): number {
  return 1200 * Math.log2(detected / reference);
}

export function analyzePitch(
  buffer: Float32Array,
  detector: ReturnType<typeof YIN>,
): PitchResult | null {
  const frequency = detector(buffer);
  if (frequency === null || frequency < 60 || frequency > 400) return null;

  const note = findClosestNote(frequency);
  const cents = Math.round(centsFromTarget(frequency, note.frequency));

  return { frequency, note, cents };
}
