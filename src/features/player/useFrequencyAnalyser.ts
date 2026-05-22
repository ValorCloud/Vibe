import { useRef, useEffect, useCallback } from 'react';

export interface FrequencyAnalyserState {
  analyserRef: React.RefObject<AnalyserNode | null>;
  dataArrayRef: React.RefObject<Uint8Array | null>;
  initAnalyser: (audioEl: HTMLAudioElement) => void;
}

/** Manages a single Web Audio graph per audio element lifetime.
 *  Safe to call initAnalyser multiple times — idempotent. */
export function useFrequencyAnalyser(): FrequencyAnalyserState {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Stable reference — never changes between renders
  const initAnalyser = useCallback((audioEl: HTMLAudioElement) => {
    try {
      const AudioCtx = window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') ctx.resume();

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audioEl);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  return { analyserRef, dataArrayRef, initAnalyser };
}
