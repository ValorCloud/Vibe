import { useRef, useEffect, useCallback } from 'react';

export interface FrequencyAnalyserState {
  analyserRef: React.RefObject<AnalyserNode | null>;
  dataArrayRef: React.RefObject<Uint8Array | null>;
  // FIX #1: accept HTMLMediaElement (covers both <audio> and <video>)
  initAnalyser: (mediaEl: HTMLMediaElement) => void;
}

export function useFrequencyAnalyser(): FrequencyAnalyserState {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  // Track which element is currently sourced to avoid double-connect
  const sourceElRef = useRef<HTMLMediaElement | null>(null);

  const initAnalyser = useCallback((mediaEl: HTMLMediaElement) => {
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

      // Only create a new source if the element changed
      if (sourceElRef.current !== mediaEl) {
        if (sourceRef.current) {
          try { sourceRef.current.disconnect(); } catch (_) {}
        }
        sourceRef.current = ctx.createMediaElementSource(mediaEl);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        sourceElRef.current = mediaEl;
      }
    } catch (_) {}
  }, []);

  useEffect(() => () => { audioCtxRef.current?.close(); }, []);

  return { analyserRef, dataArrayRef, initAnalyser };
}
