import { useEffect, useMemo, useRef, useState } from 'react';
import { LCARS } from './lcarsTheme';
import { DEFAULT_VIDEO_ASPECT_RATIO } from './playerConstants';
import { StageOverlay, type StageOverlayBindings } from './StageOverlay';

// ─── AudioVisualStage ─────────────────────────────────────────────────────────
// Randomized procedural visualization shown in the playing container when the
// selected media has no video track — like the generated visualizations of
// old-school players (Winamp et al.). The visual mode and palette are picked
// pseudo-randomly from the track seed so each track gets its own "video".

type VisualMode = 'waves' | 'bars' | 'orbits' | 'starfield';
const VISUAL_MODES: readonly VisualMode[] = ['waves', 'bars', 'orbits', 'starfield'];

/** FNV-1a string hash — deterministic seed source for the per-track PRNG. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — cheap, deterministic per-track randomization. */
function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface VisualParams {
  mode: VisualMode;
  hue: number;
  count: number;
  speed: number;
  phases: number[];
}

function buildParams(seed: string): VisualParams {
  const rng = makeRng(hashSeed(seed));
  const mode = VISUAL_MODES[Math.floor(rng() * VISUAL_MODES.length)]!;
  return {
    mode,
    hue: Math.floor(rng() * 360),
    count: 24 + Math.floor(rng() * 40),
    speed: 0.5 + rng() * 1.2,
    phases: Array.from({ length: 64 }, () => rng() * Math.PI * 2),
  };
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: VisualParams) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, w, h);
  const { mode, hue, count, speed, phases } = p;
  const time = t * speed;
  if (mode === 'waves') {
    for (let l = 0; l < 4; l++) {
      ctx.beginPath();
      const lh = (hue + l * 34) % 360;
      for (let x = 0; x <= w; x += 4) {
        const y = h / 2
          + Math.sin(x / (60 + l * 22) + time * (1 + l * 0.3) + phases[l]!) * h * 0.16
          + Math.sin(x / 23 + time * 1.7 + phases[l + 4]!) * h * 0.05;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${lh},85%,60%,0.75)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (mode === 'bars') {
    const bw = w / count;
    for (let i = 0; i < count; i++) {
      const v = (Math.sin(time * 2.1 + phases[i % phases.length]!) + Math.sin(time * 3.7 + i * 0.6)) / 2;
      const bh = (0.5 + v * 0.45) * h * 0.7;
      const grad = ctx.createLinearGradient(0, h - bh, 0, h);
      grad.addColorStop(0, `hsla(${(hue + i * 6) % 360},95%,62%,0.95)`);
      grad.addColorStop(1, `hsla(${(hue + i * 6) % 360},95%,30%,0.25)`);
      ctx.fillStyle = grad;
      ctx.fillRect(i * bw + 1, h - bh, bw - 2, bh);
    }
  } else if (mode === 'orbits') {
    const cx = w / 2; const cy = h / 2;
    for (let i = 0; i < count; i++) {
      const a = time * (0.4 + (i % 7) * 0.13) + phases[i % phases.length]!;
      const rx = (0.12 + (i / count) * 0.38) * w;
      const ry = rx * (0.35 + 0.25 * Math.sin(phases[(i + 3) % phases.length]!));
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(hue + i * 9) % 360},90%,65%,0.9)`;
      ctx.fill();
    }
  } else {
    // starfield — stars streaming outward from the centre
    const cx = w / 2; const cy = h / 2;
    for (let i = 0; i < count * 2; i++) {
      const ph = phases[i % phases.length]!;
      const angle = ph * 3 + i;
      const dist = ((time * (0.08 + (i % 5) * 0.03) + ph) % 1);
      const r = dist * Math.max(w, h) * 0.6;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + dist * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(hue + i * 4) % 360},70%,${55 + dist * 35}%,${0.35 + dist * 0.6})`;
      ctx.fill();
    }
  }
}

export interface AudioVisualStageProps {
  /** Per-track seed — a new seed picks a new randomized visualization. */
  seed: string;
  isPlaying: boolean;
  contentWidth: string;
  overlay: StageOverlayBindings;
}

export function AudioVisualStage({ seed, isPlaying, contentWidth, overlay }: AudioVisualStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showControls, setShowControls] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = useMemo(() => buildParams(seed), [seed]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowControls(false), 2800);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    window.addEventListener('resize', resize);
    resize();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    const start = performance.now();
    const draw = () => {
      drawFrame(ctx, canvas.offsetWidth, canvas.offsetHeight, (performance.now() - start) / 1000, params);
      if (isPlaying) rafId = window.requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, params]);

  return (
    <div onMouseMove={handleMouseMove} onMouseLeave={() => setShowControls(false)}
      style={{
        alignSelf: 'center', width: contentWidth,
        border: `1px solid ${LCARS.purple}55`, borderRadius: 4,
        background: '#000', position: 'relative',
        boxShadow: `0 0 24px ${LCARS.purple}1a, 0 4px 16px rgba(0,0,0,0.5)`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px 4px', background: 'rgba(0,0,0,0.7)', borderBottom: `1px solid ${LCARS.purple}33`,
        borderRadius: '4px 4px 0 0' }}>
        <span style={{ color: LCARS.purple, fontSize: 9, letterSpacing: 3, fontWeight: 700 }}>VISUAL STREAM</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5,
          color: isPlaying ? LCARS.alertRed : LCARS.subText, fontSize: 9, letterSpacing: 2, transition: 'color 200ms ease' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: isPlaying ? LCARS.alertRed : LCARS.subText,
            boxShadow: isPlaying ? `0 0 6px ${LCARS.alertRed}` : 'none',
            transition: 'background 200ms ease, box-shadow 200ms ease' }} aria-hidden="true" />
          {isPlaying ? 'ACTIVE' : 'STANDBY'}
        </span>
      </div>
      <div style={{ aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO, width: '100%', background: '#000', borderRadius: '0 0 4px 4px', overflow: 'hidden', position: 'relative' }}
        aria-label={isPlaying ? 'Audio visualization – playing' : 'Audio visualization – paused'} role="img">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
        <StageOverlay visible={showControls || !isPlaying} isPlaying={isPlaying} {...overlay} />
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, left: 0, width: 3, height: 36, background: LCARS.purple, borderRadius: '0 2px 2px 0', opacity: 0.55 }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 30, right: 0, width: 3, height: 36, background: LCARS.orange, borderRadius: '2px 0 0 2px', opacity: 0.55 }} />
    </div>
  );
}
