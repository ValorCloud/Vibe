/**
 * FrequencyVisualizer
 * Canvas WebAudio spectrum analyzer — 3D-style EQ bars.
 * No Three.js. No decorative animations.
 */
import React, { useRef, useEffect } from 'react';

interface Props {
  isPlaying: boolean;
  audioRef:  React.RefObject<HTMLAudioElement>;
}

export function FrequencyVisualizer({ isPlaying, audioRef }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef     = useRef<Uint8Array | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);

  // ── Connect / resume AudioContext ──────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const init = () => {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
        }
        const ac = ctxRef.current;
        if (!analyserRef.current) {
          const an = ac.createAnalyser();
          an.fftSize = 512;
          an.smoothingTimeConstant = 0.8;
          analyserRef.current = an;
          dataRef.current     = new Uint8Array(an.frequencyBinCount);
        }
        if (!sourceRef.current) {
          sourceRef.current = ac.createMediaElementSource(el);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ac.destination);
        }
        if (ac.state === 'suspended') void ac.resume();
      } catch {
        // already connected or no permission — silent
      }
    };

    el.addEventListener('play', init);
    if (isPlaying) init();
    return () => el.removeEventListener('play', init);
  }, [audioRef, isPlaying]);

  // ── Draw loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const analyser = analyserRef.current;
      const data     = dataRef.current;

      if (analyser && data && isPlaying) {
        (analyser as AnalyserNode).getByteFrequencyData(data as Uint8Array);
      }

      const barCount  = 80;
      const barWidth  = w / barCount;
      const maxHeight = h * 0.8;
      const depth     = 4;

      for (let i = 0; i < barCount; i++) {
        const sampleIdx  = Math.floor((i / barCount) * (data?.length ?? 0) * 0.7);
        const raw        = data ? data[sampleIdx] : 0;
        const val        = isPlaying ? raw + Math.random() * 15 : 2;
        const norm       = val / 255;
        const barH       = Math.max(2, norm * maxHeight);
        const x          = i * barWidth;
        const y          = h - barH - 10;
        const hue        = (i / barCount) * 360;

        // Side face
        ctx.fillStyle = `hsla(${hue},70%,20%,0.4)`;
        ctx.beginPath();
        ctx.moveTo(x + barWidth,        y);
        ctx.lineTo(x + barWidth + depth, y - depth);
        ctx.lineTo(x + barWidth + depth, h - 10 - depth);
        ctx.lineTo(x + barWidth,        h - 10);
        ctx.fill();

        // Top face
        ctx.fillStyle = `hsla(${hue},70%,40%,0.4)`;
        ctx.beginPath();
        ctx.moveTo(x,                   y);
        ctx.lineTo(x + depth,            y - depth);
        ctx.lineTo(x + barWidth + depth, y - depth);
        ctx.lineTo(x + barWidth,         y);
        ctx.fill();

        // Front face gradient
        const grad = ctx.createLinearGradient(x, y, x, h - 10);
        grad.addColorStop(0, `hsla(${hue},100%,60%,1)`);
        grad.addColorStop(1, `hsla(${hue},100%,30%,0.3)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth - 1, barH);

        // Peak highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, barWidth - 1, 1);

        // Glow on high energy
        ctx.shadowBlur  = norm > 0.7 ? 10 : 0;
        ctx.shadowColor = norm > 0.7 ? `hsla(${hue},100%,50%,0.8)` : 'transparent';
      }
      ctx.shadowBlur = 0;

      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  return (
    <div className="w-full h-32 relative overflow-hidden rounded-lg bg-black/60 border border-[#99ccff]/10 shadow-[inset_0_0_30px_rgba(0,0,0,1)] mt-4">
      <canvas ref={canvasRef} className="w-full h-full" />
      {/* CRT scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ background: 'repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,.5) 2px,rgba(0,0,0,.5) 4px)' }}
      />
    </div>
  );
}
