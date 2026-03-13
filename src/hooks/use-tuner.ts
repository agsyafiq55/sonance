import { 
  useCallback, 
  useEffect, 
  useRef, 
  useState 
} from "react";
import {
  type PitchResult,
  analyzePitch,
  createDetector,
  getRMS,
} from "../lib/pitch";

// =============================================================================
// PART 1: FOUNDATION - What we're tracking and configuration
// =============================================================================

// How long to keep showing the last detected note after sound stops (milliseconds).
// This prevents the display from flickering when you briefly stop plucking the string.
const HOLD_DURATION_MS = 5000;

// Number of consecutive "no pitch detected" frames before clearing the display.
// At ~60fps, 15 frames = ~250ms. Used to distinguish between "brief pause in playing"
// vs "user stopped playing entirely".
const NULL_STREAK_THRESHOLD = 15;

// The public state of the tuner that React components can subscribe to.
// Components re-render when this state changes.
export interface TunerState {
  active: boolean; // Is the tuner currently running?
  result: PitchResult | null; // Current pitch detection result (or null if no pitch)
  error: string | null; // Error message (e.g., mic permission denied)
}

// =============================================================================
// PART 2: THE REACT HOOK - Main hook and state management
// =============================================================================

// useTuner is a custom React hook that components use to interact with the tuner.
// It manages the tuner's state and provides start/stop controls.
//
// How it works:
// 1. State (useState) - Tracks what's displayed to the user. Changes trigger re-renders.
// 2. Refs (useRef) - Stores Web Audio API objects. Doesn't trigger re-renders.
// 3. The detect() function - Runs continuously (~60fps) to analyze audio.
// 4. start/stop - Control functions to begin and end audio processing.
export function useTuner() {
  // React state - this triggers re-renders when it changes
  // Unlike refs, state is for values that the UI depends on
  const [state, setState] = useState<TunerState>({
    active: false,
    result: null,
    error: null,
  });

  // =============================================================================
  // PART 3: PERSISTENT STORAGE - Refs for audio objects
  // =============================================================================

  // Why use "refs" instead of "state" for these?
  // - State changes trigger React re-renders
  // - Audio objects (AudioContext, AnalyserNode, etc.) don't need to trigger UI updates
  // - Refs persist across renders without causing re-renders
  // - Audio processing happens outside React's render cycle

  // Web Audio API objects
  const audioContextRef = useRef<AudioContext | null>(null); // The audio engine
  const analyserRef = useRef<AnalyserNode | null>(null); // Extracts raw samples
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // Mic input
  const streamRef = useRef<MediaStream | null>(null); // Raw media stream

  // Detection-related refs
  const detectorRef = useRef<ReturnType<typeof createDetector> | null>(null); // YIN detector
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null); // Sample buffer (reused)
  const rafRef = useRef<number>(0); // requestAnimationFrame ID (for cancellation)

  // "Hold" feature refs - keep showing the last note briefly after sound stops
  const lastDetectionRef = useRef<number>(0); // Timestamp of last valid pitch
  const nullStreakRef = useRef<number>(0); // Counter for consecutive null results

  // detectRef solves a circular dependency:
  // detect() calls requestAnimationFrame, which needs to call detect() again.
  // We store the latest detect function here so RAF always calls the current version,
  // preventing "stale closure" bugs where it would use old variable values.
  const detectRef = useRef<() => void>(null);

  // =============================================================================
  // PART 4: THE DETECTION LOOP - Continuously processing audio
  // =============================================================================

  // This function runs ~60 times per second (once per animation frame).
  // It's the heart of the tuner: read samples, detect pitch, update UI.
  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    const buffer = bufferRef.current;
    if (!analyser || !detector || !buffer) return;

    // Step 1: Grab current audio samples from the microphone
    analyser.getFloatTimeDomainData(buffer);

    // Step 2: Analyze the samples using our pitch detection pipeline
    const result = analyzePitch(buffer, detector);

    if (result) {
      // Valid pitch detected: reset counters and update the UI
      nullStreakRef.current = 0;
      lastDetectionRef.current = performance.now();
      setState((prev) => ({ ...prev, result }));
    } else {
      // No pitch detected this frame - decide if we should clear the display
      nullStreakRef.current++;

      const rms = getRMS(buffer);
      const signalPresent = rms > 0.005; // Is there audio but no clear pitch?
      const elapsed = performance.now() - lastDetectionRef.current;

      if (signalPresent && nullStreakRef.current < NULL_STREAK_THRESHOLD) {
        // There's sound but YIN couldn't find a clear pitch (too quiet, noisy, or unstable).
        // This is common - we keep showing the last note briefly so the display
        // doesn't flicker while you're adjusting your finger position.
      } else if (elapsed > HOLD_DURATION_MS) {
        // No valid pitch for 5 seconds: the user has likely stopped playing.
        // Clear the display to indicate we're no longer tracking a note.
        setState((prev) => (prev.result ? { ...prev, result: null } : prev));
      }
    }

    // Step 3: Schedule the next detection frame
    // We use detectRef.current to avoid stale closures
    rafRef.current = requestAnimationFrame(() => detectRef.current?.());
  }, []);

  // Keep detectRef synchronized with the latest detect function.
  // This is crucial because detect() is stored in a ref and survives across renders.
  // We need it to always use the current function, not a stale one from a previous render.
  useEffect(() => {
    detectRef.current = detect;
  }, [detect]);

  // =============================================================================
  // PART 5: LIFECYCLE - Starting and stopping the tuner
  // =============================================================================

  // Initialize the microphone and Web Audio API, then start the detection loop.
  const start = useCallback(async () => {
    try {
      // Request microphone permission from the browser
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create the audio processing graph:
      // Mic -> AudioContext -> MediaStreamSource -> AnalyserNode
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      // fftSize determines the buffer size for analysis.
      // 4096 samples = ~93ms of audio at 44.1kHz sample rate.
      // Larger = better frequency resolution but slower response time.
      analyser.fftSize = 4096;

      // Disable built-in smoothing. We want raw, unfiltered samples for accurate
      // pitch detection. Smoothing would delay our response and blur pitch changes.
      analyser.smoothingTimeConstant = 0;

      source.connect(analyser);

      // Store everything in refs so the detection loop can access them
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      detectorRef.current = createDetector(audioContext.sampleRate);
      bufferRef.current = new Float32Array(analyser.fftSize);

      // Reset hold-feature counters
      lastDetectionRef.current = performance.now();
      nullStreakRef.current = 0;

      // Update UI state and start the detection loop
      setState({ active: true, result: null, error: null });
      detectRef.current?.();
    } catch {
      setState({
        active: false,
        result: null,
        error: "Microphone access denied. Please allow microphone permissions.",
      });
    }
  }, []);

  // Stop detection and release all audio resources to free up hardware.
  const stop = useCallback(() => {
    // Stop the detection loop
    cancelAnimationFrame(rafRef.current);

    // Disconnect and release audio resources
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();

    // Clear refs so they can be garbage collected
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    detectorRef.current = null;
    bufferRef.current = null;

    setState({ active: false, result: null, error: null });
  }, []);

  // =============================================================================
  // PART 6: CLEANUP - Component unmounting
  // =============================================================================

  // Cleanup effect: runs when the component using this hook unmounts.
  // Prevents memory leaks and ensures the microphone is released.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);
  return { ...state, start, stop };
}
