import { useRef, useEffect } from 'react';
import type { FrequencyAnalyserState } from './useFrequencyAnalyser';

interface FrequencyVisualizerProps {
  isPlaying: boolean;
  analyser: FrequencyAnalyserState;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export function FrequencyVisualizer({ isPlaying, analyser, audioRef }: FrequencyVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Init Web Audio graph on first play
  useEffect(() => {
    if (!audioRef.current) return;
    const el = audioRef.current;
    const onPlay = () => analyser.initAnalyser(el);
    el.addEventListener('play', onPlay);
    if (isPlaying) analyser.initAnalyser(el);
    return () => el.removeEventListener('play', onPlay);
  }, [audioRef, analyser.initAnalyser, isPlaying]);

  // RAF loop — deps use stable refs, not the analyser object
  const { analyserRef, dataArrayRef } = analyser;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      if (analyserRef.current && dataArrayRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
      }

      const barCount = 80;
      const barWidth = w / barCount;
      const gap = 2;
      const maxBarHeight = h * 0.8;

      for (let i = 0; i < barCount; i++) {
        const sampleIdx = Math.floor((i / barCount) * ((dataArrayRef.current?.length ?? 100) * 0.7));
        const raw = dataArrayRef.current ? dataArrayRef.current[sampleIdx] : undefined;
        const val = raw !== undefined ? raw : (isPlaying ? Math.random() * 15 : 2);
        const norm = val / 255;
        const barH = Math.max(2, norm * maxBarHeight);
        const x = i * barWidth;
        const y = h - barH - 10;
        const depth = 4;
        const hue = (i / barCount) * 360;

        ctx.fillStyle = `hsla(${hue},70%,20%,0.4)`;
        ctx.beginPath(); ctx.moveTo(x+barWidth-gap,y); ctx.lineTo(x+barWidth-gap+depth,y-depth); ctx.lineTo(x+barWidth-gap+depth,h-10-depth); ctx.lineTo(x+barWidth-gap,h-10); ctx.fill();

        ctx.fillStyle = `hsla(${hue},70%,40%,0.4)`;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+depth,y-depth); ctx.lineTo(x+barWidth-gap+depth,y-depth); ctx.lineTo(x+barWidth-gap,y); ctx.fill();

        const grad = ctx.createLinearGradient(x, y, x, h-10);
        grad.addColorStop(0, `hsla(${hue},100%,60%,1)`);
        grad.addColorStop(1, `hsla(${hue},100%,30%,0.3)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth - gap, barH);

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, barWidth - gap, 1);

        ctx.shadowBlur = norm > 0.7 ? 10 : 0;
        ctx.shadowColor = norm > 0.7 ? `hsla(${hue},100%,50%,0.8)` : 'transparent';
      }

      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, analyserRef, dataArrayRef]);

  return (
    <div
      className="w-full relative overflow-hidden rounded-lg mt-4"
      style={{ height: 128, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(153,204,255,0.1)', boxShadow: 'inset 0 0 30px rgba(0,0,0,1)' }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.2, background: 'repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.5) 2px,rgba(0,0,0,0.5) 4px)' }} />
    </div>
  );
}
