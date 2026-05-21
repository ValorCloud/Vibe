/**
 * PlayerPage — LCARS FUI audio player
 * Three.js WarpField + WebAudio FrequencyVisualizer
 * Adapted from VoxNova reference for Lyricist/Vibe.
 * v1.1.0
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import {
  GlobeRegular,
  DatabaseRegular,
  DeleteRegular,
  ArrowUploadRegular,
  ScanDashRegular,
  SkipBackward10Regular,
  SkipForward10Regular,
  PlayCircleRegular,
  PauseCircleRegular,
} from '@fluentui/react-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}

type StorageKind = 'cloud' | 'local';
type AudioProtocol = 'WAV' | 'MP3' | 'ALL';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOUD_LIBRARY: Track[] = [
  {
    id: 'nebula-flight',
    title: 'Nebula Flight',
    artist: 'VOX NV-42',
    audioUrl: 'https://storage.googleapis.com/lyricist-audio/nebula-flight.mp3',
  },
  {
    id: 'stellar-voyage',
    title: 'Stellar Voyage',
    artist: 'VOX NV-42',
    audioUrl: 'https://storage.googleapis.com/lyricist-audio/stellar-voyage.mp3',
  },
];

// ─── WarpField ────────────────────────────────────────────────────────────────

function WarpField({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      canvas.offsetWidth / canvas.offsetHeight,
      0.1,
      1000,
    );
    camera.position.z = 5;

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) positions[i] = (Math.random() - 0.5) * 200;
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }),
      ),
    );

    // Grid
    const gridHelper = new THREE.GridHelper(80, 40, 0xcc9966, 0x332211);
    gridHelper.position.y = -3;
    scene.add(gridHelper);

    let frame = 0;
    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      frame += 0.002;
      gridHelper.position.z = (frame * 4) % 4;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [canvasRef]);

  return null;
}

// ─── FrequencyVisualizer ──────────────────────────────────────────────────────

function FrequencyVisualizer({
  analyserRef,
  isPlaying,
}: {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BAR_COUNT = 80;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const analyser = analyserRef.current;
      let data: Uint8Array<ArrayBuffer>;
      if (analyser && isPlaying) {
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        analyser.getByteFrequencyData(data);
      } else {
        data = new Uint8Array(new ArrayBuffer(BAR_COUNT)).fill(4);
      }

      const barW = w / BAR_COUNT - 1;
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = (data[Math.floor((i / BAR_COUNT) * data.length)] ?? 0) / 255;
        const barH = Math.max(4, val * h);
        const hue = (i / BAR_COUNT) * 280;
        ctx.fillStyle = `hsl(${hue},80%,55%)`;
        ctx.fillRect(i * (barW + 1), h - barH, barW, barH);
      }
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={80}
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ─── PlayerPage ───────────────────────────────────────────────────────────────

export function PlayerPage() {
  const warpCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [storage, setStorage] = useState<StorageKind>('cloud');
  const [tracks] = useState<Track[]>(CLOUD_LIBRARY);
  const [currentTrack, setCurrentTrack] = useState<Track>(() => CLOUD_LIBRARY[0]!);
  const [isPlaying, setIsPlaying] = useState(false);

  // SCAN SECTOR panel state
  const [scanOpen, setScanOpen] = useState(false);
  const [audioProtocol, setAudioProtocol] = useState<AudioProtocol>('ALL');
  const [patternMatch, setPatternMatch] = useState('L3RC');

  const ensureAudioCtx = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  const loadTrack = useCallback(
    (track: Track) => {
      ensureAudioCtx();
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
        const src = audioCtxRef.current!.createMediaElementSource(audio);
        src.connect(analyserRef.current!);
      }
      audio.src = track.audioUrl;
      audio.load();
      setCurrentTrack(track);
      setIsPlaying(false);
    },
    [ensureAudioCtx],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrack(CLOUD_LIBRARY[0]!); }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current?.state === 'suspended') void audioCtxRef.current.resume();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play();
      setIsPlaying(true);
    }
  };

  const skipNext = () => {
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const next = tracks[(idx + 1) % tracks.length];
    if (next) loadTrack(next);
  };

  const skipPrev = () => {
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    if (prev) loadTrack(prev);
  };

  // ── Sidebar button style helpers ──────────────────────────────────────────
  const storageBtn = (kind: StorageKind) => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: '7px 12px',
    borderRadius: 4,
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer' as const,
    border: 'none',
    width: '100%',
    transition: 'background 0.15s',
    background:
      kind === 'cloud'
        ? storage === 'cloud' ? 'var(--accent-color, #6699cc)' : 'transparent'
        : storage === 'local' ? 'var(--lcars-amber, #cc9966)' : 'transparent',
    color:
      kind === 'cloud'
        ? storage === 'cloud' ? '#fff' : '#9ca3af'
        : storage === 'local' ? '#000' : '#9ca3af',
    justifyContent: 'flex-end' as const,
  });

  return (
    <div
      className="relative flex h-full w-full overflow-hidden bg-black text-white select-none"
      style={{ fontFamily: 'var(--fontFamilyMonospace, monospace)' }}
    >
      {/* WarpField background */}
      <canvas
        ref={warpCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ opacity: 0.5 }}
      />
      <WarpField canvasRef={warpCanvasRef} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="relative z-10 flex flex-col shrink-0 border-r"
        style={{
          width: 220,
          borderColor: 'rgba(204,153,102,0.3)',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: 'rgba(204,153,102,0.3)' }}
        >
          <div
            className="text-xl font-bold tracking-widest"
            style={{ color: 'var(--lcars-amber, #cc9966)' }}
          >
            VOX
          </div>
          <div className="text-zinc-500 tracking-widest" style={{ fontSize: 10 }}>NV-42 CORE</div>
        </div>

        {/* Storage toggle */}
        <div className="flex flex-col gap-1 p-3">
          <button onClick={() => setStorage('cloud')} style={storageBtn('cloud')}>
            <GlobeRegular style={{ fontSize: 14, flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'right' }}>NEURAL CLOUD</span>
          </button>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded uppercase transition-colors"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              background: 'rgba(127,29,29,0.6)',
              color: '#fca5a5',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <DeleteRegular style={{ fontSize: 14 }} />
            <span>PURGE CLOUD MEMORY</span>
          </button>
          <button onClick={() => setStorage('local')} style={storageBtn('local')}>
            <DatabaseRegular style={{ fontSize: 14, flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'right' }}>LOCAL SECTORS</span>
          </button>
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {tracks.map(track => (
            <button
              key={track.id}
              onClick={() => loadTrack(track)}
              className="w-full text-right px-3 py-2 rounded uppercase tracking-wide transition-colors mb-1"
              style={{
                fontSize: 11,
                border: 'none',
                cursor: 'pointer',
                background:
                  currentTrack.id === track.id
                    ? 'rgba(126,179,216,0.15)'
                    : 'transparent',
                color:
                  currentTrack.id === track.id
                    ? 'var(--lcars-blue, #7eb3d8)'
                    : '#6b7280',
              }}
            >
              {currentTrack.id === track.id ? '(C) ' : ''}{track.title}
            </button>
          ))}
        </div>

        {/* UPLINK + SCAN SECTOR ─────────────────────────────────────────── */}
        <div
          className="border-t flex flex-col"
          style={{ borderColor: 'rgba(204,153,102,0.3)' }}
        >
          {/* UPLINK */}
          <button
            className="flex items-center gap-2 px-3 py-2 uppercase transition-colors"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              background: 'rgba(204,153,102,0.1)',
              color: 'var(--lcars-amber, #cc9966)',
              border: 'none',
              cursor: 'pointer',
              justifyContent: 'flex-end',
            }}
          >
            <ArrowUploadRegular style={{ fontSize: 14 }} />
            <span>UPLINK</span>
          </button>

          {/* SCAN SECTOR expandable panel */}
          <div>
            <button
              onClick={() => setScanOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 w-full uppercase transition-colors"
              style={{
                fontSize: 11,
                letterSpacing: '0.15em',
                background: scanOpen ? 'var(--lcars-amber, #cc9966)' : 'rgba(63,63,70,0.6)',
                color: scanOpen ? '#000' : '#d1d5db',
                border: 'none',
                cursor: 'pointer',
                justifyContent: 'flex-end',
              }}
              aria-expanded={scanOpen}
            >
              <DatabaseRegular style={{ fontSize: 14 }} />
              <span>SCAN SECTOR</span>
            </button>

            {scanOpen && (
              <div
                className="flex flex-col gap-2 px-3 py-3"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  borderTop: '1px solid rgba(204,153,102,0.2)',
                }}
              >
                {/* AUDIO PROTOCOL */}
                <div>
                  <div
                    className="uppercase tracking-widest mb-1"
                    style={{ fontSize: 9, color: '#6b7280' }}
                  >
                    AUDIO PROTOCOL
                  </div>
                  <div className="flex gap-1">
                    {(['WAV', 'MP3', 'ALL'] as AudioProtocol[]).map(proto => (
                      <button
                        key={proto}
                        onClick={() => setAudioProtocol(proto)}
                        style={{
                          flex: 1,
                          padding: '3px 0',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 3,
                          background:
                            audioProtocol === proto
                              ? 'var(--lcars-amber, #cc9966)'
                              : 'rgba(39,39,42,0.8)',
                          color: audioProtocol === proto ? '#000' : '#9ca3af',
                          fontFamily: 'var(--fontFamilyMonospace, monospace)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {proto}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PATTERN MATCH */}
                <div>
                  <div
                    className="uppercase tracking-widest mb-1"
                    style={{ fontSize: 9, color: '#6b7280' }}
                  >
                    PATTERN MATCH
                  </div>
                  <input
                    type="text"
                    value={patternMatch}
                    onChange={e => setPatternMatch(e.target.value)}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      background: 'rgba(39,39,42,0.9)',
                      border: '1px solid rgba(204,153,102,0.3)',
                      borderRadius: 3,
                      padding: '3px 8px',
                      fontSize: 11,
                      color: '#d1d5db',
                      fontFamily: 'var(--fontFamilyMonospace, monospace)',
                      outline: 'none',
                      letterSpacing: '0.1em',
                    }}
                  />
                </div>

                {/* Launch scan */}
                <button
                  className="flex items-center justify-end gap-2 px-3 py-1.5 uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    background: 'rgba(126,179,216,0.15)',
                    color: 'var(--lcars-blue, #7eb3d8)',
                    border: '1px solid rgba(126,179,216,0.3)',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontFamily: 'var(--fontFamilyMonospace, monospace)',
                  }}
                >
                  <ScanDashRegular style={{ fontSize: 12 }} />
                  <span>INITIATE SCAN</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* LCARS top bar */}
        <div
          className="flex items-center gap-3 px-6 py-2 border-b"
          style={{
            borderColor: 'rgba(204,153,102,0.3)',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="flex-1 uppercase"
            style={{
              fontSize: 11,
              letterSpacing: '0.3em',
              color: 'var(--lcars-amber, #cc9966)',
            }}
          >
            USS VOX NOVA // REGISTRY 7AE4SD57
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#ef4444', animation: 'pulse 2s infinite' }}
            />
            <span
              className="uppercase tracking-widest text-zinc-400"
              style={{ fontSize: 10 }}
            >
              IMPULSE_ONLY
            </span>
          </div>
        </div>

        {/* Status bars */}
        <div
          className="flex items-center gap-6 px-6 py-2 border-b"
          style={{ borderColor: 'rgba(39,39,42,0.6)' }}
        >
          <div className="flex flex-col gap-1 flex-1">
            <span className="uppercase tracking-widest text-zinc-500" style={{ fontSize: 9 }}>
              STRUCTURAL INTEGRITY
            </span>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
              <div
                className="h-full rounded-full"
                style={{ width: '75%', background: 'var(--lcars-amber, #cc9966)' }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <span className="uppercase tracking-widest text-zinc-500" style={{ fontSize: 9 }}>
              NEURAL BUFFER
            </span>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
              <div
                className="h-full rounded-full"
                style={{ width: '40%', background: 'var(--accent-color, #6699cc)' }}
              />
            </div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-widest text-zinc-500" style={{ fontSize: 9 }}>
              SECTOR TIME
            </div>
            <div
              className="font-bold tracking-widest"
              style={{ color: 'var(--lcars-amber, #cc9966)', fontSize: 14 }}
            >
              0214.7
            </div>
          </div>
        </div>

        {/* Center stage */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="text-center">
            <div
              className="uppercase mb-3"
              style={{
                fontSize: 10,
                letterSpacing: '0.4em',
                color: 'var(--lcars-amber, #cc9966)',
              }}
            >
              COMMS_ENCRYPTION: LEVEL 5
            </div>
            <h1
              className="font-bold tracking-tight text-white leading-tight"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              {currentTrack.title}
            </h1>
            <div
              className="mt-2 mx-auto"
              style={{
                height: 2,
                width: 64,
                background: 'var(--lcars-amber, #cc9966)',
              }}
            />
          </div>

          {/* Transport */}
          <div className="flex items-center gap-6">
            <button
              onClick={skipPrev}
              className="flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: 48,
                height: 48,
                background: 'rgba(39,39,42,0.7)',
                color: '#d1d5db',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Previous track"
            >
              <SkipBackward10Regular style={{ fontSize: 22 }} />
            </button>
            <button
              onClick={togglePlay}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: 64,
                height: 64,
                background: 'var(--lcars-amber, #cc9966)',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(204,153,102,0.4)',
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <PauseCircleRegular style={{ fontSize: 28 }} />
                : <PlayCircleRegular style={{ fontSize: 28 }} />
              }
            </button>
            <button
              onClick={skipNext}
              className="flex items-center justify-center rounded-lg transition-colors"
              style={{
                width: 48,
                height: 48,
                background: 'rgba(39,39,42,0.7)',
                color: '#d1d5db',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Next track"
            >
              <SkipForward10Regular style={{ fontSize: 22 }} />
            </button>
          </div>

          {/* Frequency visualizer */}
          <div
            className="w-full max-w-2xl overflow-hidden rounded"
            style={{
              height: 80,
              border: '1px solid rgba(204,153,102,0.2)',
              background: 'rgba(0,0,0,0.4)',
            }}
          >
            <FrequencyVisualizer analyserRef={analyserRef} isPlaying={isPlaying} />
          </div>
        </div>
      </main>
    </div>
  );
}
