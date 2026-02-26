import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PitchResult,
  analyzePitch,
  createDetector,
  getRMS,
} from "../lib/pitch";

const HOLD_DURATION_MS = 5000;
const NULL_STREAK_THRESHOLD = 15;

export interface TunerState {
  active: boolean;
  result: PitchResult | null;
  error: string | null;
}

export function useTuner() {
  const [state, setState] = useState<TunerState>({
    active: false,
    result: null,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<ReturnType<typeof createDetector> | null>(null);
  const detectRef = useRef<() => void>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const lastDetectionRef = useRef<number>(0);
  const nullStreakRef = useRef<number>(0);

  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    const buffer = bufferRef.current;
    if (!analyser || !detector || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);
    const result = analyzePitch(buffer, detector);

    if (result) {
      nullStreakRef.current = 0;
      lastDetectionRef.current = performance.now();
      setState((prev) => ({ ...prev, result }));
    } else {
      nullStreakRef.current++;
      const rms = getRMS(buffer);
      const signalPresent = rms > 0.005;
      const elapsed = performance.now() - lastDetectionRef.current;

      if (signalPresent && nullStreakRef.current < NULL_STREAK_THRESHOLD) {
        // Signal exists but YIN missed this frame -- keep last result
      } else if (elapsed > HOLD_DURATION_MS) {
        setState((prev) => (prev.result ? { ...prev, result: null } : prev));
      }
    }

    rafRef.current = requestAnimationFrame(() => detectRef.current?.());
  }, []);

  useEffect(() => {
    detectRef.current = detect;
  }, [detect]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      detectorRef.current = createDetector(audioContext.sampleRate);
      bufferRef.current = new Float32Array(analyser.fftSize);
      lastDetectionRef.current = performance.now();
      nullStreakRef.current = 0;

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

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();

    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    detectorRef.current = null;
    bufferRef.current = null;

    setState({ active: false, result: null, error: null });
  }, []);

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
