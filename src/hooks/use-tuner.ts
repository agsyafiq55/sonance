import { useCallback, useEffect, useRef, useState } from "react";
import { type PitchResult, analyzePitch, createDetector } from "../lib/pitch";

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

  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    if (!analyser || !detector) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const result = analyzePitch(buffer, detector);
    setState((prev) => ({ ...prev, result }));

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      detectorRef.current = createDetector(audioContext.sampleRate);

      setState({ active: true, result: null, error: null });
      rafRef.current = requestAnimationFrame(detect);
    } catch {
      setState({
        active: false,
        result: null,
        error: "Microphone access denied. Please allow microphone permissions.",
      });
    }
  }, [detect]);

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
