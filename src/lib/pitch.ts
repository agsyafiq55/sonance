import { YIN } from "pitchfinder";

// =============================================================================
// PART 1: FOUNDATION - What we're tuning to
// =============================================================================

// Standard guitar tuning: frequencies of the 6 open strings (low to high).
const STANDARD_TUNING = [
  { note: "E2", frequency: 82.41 },
  { note: "A2", frequency: 110.0 },
  { note: "D3", frequency: 146.83 },
  { note: "G3", frequency: 196.0 },
  { note: "B3", frequency: 246.94 },
  { note: "E4", frequency: 329.63 },
] as const;

// Type representing any of the 6 guitar strings (E2, A2, D3, G3, B3, E4)
export type TuningNote = (typeof STANDARD_TUNING)[number];

// The result of analyzing a pitch: what frequency was detected,
// which string it's closest to, and how far off (in cents) from that string.
export interface PitchResult {
  frequency: number; // Detected pitch in Hz
  note: TuningNote; // Closest standard guitar string to this frequency
  cents: number; // How far off from the target note (-50 to +50 = in tune)
}

// =============================================================================
// PART 2: BUILDING BLOCKS - Signal measurement and pitch math
// =============================================================================

// Calculate RMS (Root Mean Square) - a measure of signal loudness/energy.
// Unlike peak amplitude, RMS reflects the average "power" of the signal over time,
// which better matches how humans perceive loudness.
//
// Why this matters: We use RMS as a "gate" - if RMS is too low,
// we treat the input as silence/noise and skip pitch detection entirely.
export function getRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// Calculate pitch difference in "cents" (1 cent = 1/100 of a semitone).
//
// This is a logarithmic scale where the same number of cents represents the same
// perceived pitch difference regardless of frequency. This is crucial because:
// - A 1 Hz difference at 82 Hz (low E) is huge (musically)
// - A 1 Hz difference at 330 Hz (high E) is tiny
//
// Formula: 1200 * log2(detected/reference)
// - 0 cents = perfectly in tune
// - +50 cents = half semitone sharp (same as playing the next fret up)
// - -50 cents = half semitone flat (same as playing the previous fret)
export function centsFromTarget(
  detected: number,
  reference: number,
): number {
  return 1200 * Math.log2(detected / reference);
}

// =============================================================================
// PART 3: INTERMEDIATE LOGIC - Matching detected pitch to guitar strings
// =============================================================================

// Find which open string the detected frequency is closest to.
//
// We use "cents" (via centsFromTarget) to compare distances because:
// - Human hearing perceives pitch logarithmically, not linearly
// - 5 Hz difference at 82 Hz is much more significant than 5 Hz at 330 Hz
// - Cents accounts for this, giving us musically accurate comparisons
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

// Create a YIN pitch detector with specific thresholds.
// Parameters:
// - threshold (0.3): How strict to be when accepting a pitch (lower = stricter)
// - probabilityThreshold (0.4): Minimum confidence required to return a pitch
export function createDetector(sampleRate: number) {
  return YIN({ sampleRate, threshold: 0.3, probabilityThreshold: 0.4 });
}

// =============================================================================
// PART 4: THE BIG PICTURE - Full pitch analysis pipeline
// =============================================================================

// Main pitch analysis: orchestrates the entire detection pipeline.
//
// This is the entry point that brings everything together:
// 1. Check if there's enough signal (RMS gate)
// 2. Run pitch detection (YIN algorithm)
// 3. Validate the detected frequency is in guitar range
// 4. Find closest guitar string
// 5. Calculate how far off (in cents) from that string
export function analyzePitch(
  buffer: Float32Array,
  detector: ReturnType<typeof YIN>,
): PitchResult | null {
  // Gate 1: Check if there's enough audio signal to analyze
  // RMS < 0.005 means the buffer is mostly silence/noise
  const rms = getRMS(buffer);
  if (rms < 0.005) return null;

  // Gate 2: Run YIN pitch detection and validate frequency range.
  // Range 55-500 Hz covers ~A1 to B4, which is the usable range for guitar.
  // Below 55 Hz: unreliable with short buffers and below our lowest string (E2 = 82 Hz)
  // Above 500 Hz: likely harmonic detection errors or fretted notes too high to map
  const frequency = detector(buffer);
  if (frequency === null || frequency < 55 || frequency > 500) return null;

  // Match to nearest open string and calculate tuning offset
  const note = findClosestNote(frequency);
  const cents = Math.round(centsFromTarget(frequency, note.frequency));

  return { frequency, note, cents };
}
