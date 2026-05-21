/**
 * PlayerPage
 *
 * LCARS FUI audio player — VoxNova adaptation for Lyricist/Vibe.
 * Mirrors the VOX NV-42 design from VoxNova-player with:
 *  - WarpField       Three.js starfield / nebula / warp-grid background
 *  - FrequencyVisualizer  Web Audio API canvas EQ bars (rainbow arc)
 *  - LCARS sidebar   Cloud / Local library lists + PURGE + UPLINK + SCAN SECTOR
 *  - Transport       ◀  ▶  ▶▶ controls + COMMS encryption header
 *
 * Integrated as the third tab (activeTab === 'player') in AppEditorZone.
 * No external dependencies beyond Three.js (already in package.json).
 */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FC,
} from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrackEntry {
  id: string;
  title: string;
  source: 'cloud' | 'local';
  url: string;
}

type LibraryView = 'cloud' | 'local';
type AudioProtocol = 'wav' | 'mp3' | 'all';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_LIBRARY: TrackEntry[] = [
  {
    id: 'c1',
    title: 'Nebula Flight',
    source: 'cloud',
    url: 'https://storage.googleapis.com/vibe-audio/nebula-flight.mp3',
  },
  {
    id: 'c2',
    title: 'Stellar Voyage',
    source: 'cloud',
    url: 'https://storage.googleapis.com/vibe-audio/stellar-voyage.mp3',
  },
];

const LOCAL_LIBRARY: TrackEntry[] = [];

const REGISTRY_ID = '7AE4SD57';
const VESSEL_NAME = 'USS VOX NOVA';

// ─────────────────────────────────────────────────────────────────────────────
// WarpField — Three.js background
// ─────────────────────────────────────────────────────────────────────────────

const WarpField: FC<{ warpSpeed: number }> = ({ warpSpeed }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    stars: THREE.Points;
    nebula: THREE.Mesh;
    grid: THREE.LineSegments;
    animId: number;
    time: number;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || window.innerWidth;
    const H = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
    camera.position.set(0, 2, 10);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) positions[i] = (Math.random() - 0.5) * 400;
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.7 }),
    );
    scene.add(stars);

    // Nebula plane
    const nebulaGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
    const nebulaMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { time: { value: 0 }, uColor1: { value: new THREE.Color(0x1a0a2e) }, uColor2: { value: new THREE.Color(0x0d1b2a) } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        uniform float time;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          float n=noise(vUv*4.+time*.05);
          vec3 col=mix(uColor1,uColor2,n);
          gl_FragColor=vec4(col,0.45*n);
        }`,
    });
    const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
    nebula.position.set(0, 0, -50);
    scene.add(nebula);

    // Neon grid
    const gridMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.12 });
    const gridGeo = new THREE.BufferGeometry();
    const gridVerts: number[] = [];
    for (let i = -10; i <= 10; i++) {
      gridVerts.push(i * 5, 0, -100, i * 5, 0, 0);
      gridVerts.push(-50, 0, i * 10, 50, 0, i * 10);
    }
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gridVerts), 3));
    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.position.y = -3;
    scene.add(grid);

    let animId = 0;
    let time = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.01;
      nebulaMat.uniforms.time.value = time;
      stars.rotation.y += 0.0003;
      stars.rotation.x += 0.0001;
      grid.position.z = ((time * warpSpeed * 2) % 10);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { renderer, camera, scene, stars, nebula, grid, animId, time };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Update warp speed reactively
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    (s.grid.material as THREE.LineBasicMaterial).opacity = 0.08 + warpSpeed * 0.25;
  }, [warpSpeed]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        opacity: 0.65,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FrequencyVisualizer — Web Audio API canvas
// ─────────────────────────────────────────────────────────────────────────────

const FrequencyVisualizer: FC<{ analyser: AnalyserNode | null; isPlaying: boolean }> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BAR_COUNT = 80;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!analyser || !isPlaying) {
        // Idle shimmer
        const idleTime = Date.now() / 1000;
        for (let i = 0; i < BAR_COUNT; i++) {
          const h = 2 + Math.sin(idleTime * 2 + i * 0.3) * 2;
          const hue = (i / BAR_COUNT) * 360;
          ctx.fillStyle = `hsla(${hue},80%,55%,0.35)`;
          const bw = W / BAR_COUNT - 1;
          ctx.fillRect(i * (bw + 1), H - h, bw, h);
        }
        return;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i / BAR_COUNT) * data.length);
        const val = data[idx] / 255;
        const barH = val * H;
        const hue = (i / BAR_COUNT) * 360;
        const grad = ctx.createLinearGradient(0, H - barH, 0, H);
        grad.addColorStop(0, `hsla(${hue},90%,65%,0.9)`);
        grad.addColorStop(1, `hsla(${hue},60%,35%,0.6)`);
        ctx.fillStyle = grad;
        const bw = W / BAR_COUNT - 1;
        ctx.fillRect(i * (bw + 1), H - barH, bw, barH);
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={60}
      style={{ width: '100%', height: '60px', display: 'block' }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SectorTimer
// ─────────────────────────────────────────────────────────────────────────────

const SectorTimer: FC = () => {
  const [time, setTime] = useState('0000.0');
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      setTime(elapsed.padStart(6, '0'));
    }, 100);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontFamily: 'var(--fontFamilyMonospace, monospace)', color: 'var(--lcars-gold, #cc9933)', fontSize: '1.5rem', letterSpacing: '0.08em' }}>{time}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// PlayerPage
// ─────────────────────────────────────────────────────────────────────────────

export const PlayerPage: FC = () => {
  // ── Library state ───────────────────────────────────────────────────────
  const [libraryView, setLibraryView] = useState<LibraryView>('cloud');
  const [localFiles, setLocalFiles] = useState<TrackEntry[]>(LOCAL_LIBRARY);
  const [selectedTrack, setSelectedTrack] = useState<TrackEntry>(CLOUD_LIBRARY[0]);
  const [patternMatch, setPatternMatch] = useState('');
  const [protocol, setProtocol] = useState<AudioProtocol>('all');
  const [scanExpanded, setScanExpanded] = useState(false);

  // ── Audio state ─────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [warpSpeed, setWarpSpeed] = useState(0);

  const library = libraryView === 'cloud' ? CLOUD_LIBRARY : localFiles;

  const filteredLibrary = library.filter(t => {
    const matchProto =
      protocol === 'all' ||
      (protocol === 'mp3' && t.url.endsWith('.mp3')) ||
      (protocol === 'wav' && t.url.endsWith('.wav'));
    const matchPattern =
      patternMatch === '' ||
      t.title.toLowerCase().includes(patternMatch.toLowerCase());
    return matchProto && matchPattern;
  });

  // ── Audio engine init ──────────────────────────────────────────────────
  const initAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  const connectAudioElement = useCallback((el: HTMLAudioElement) => {
    if (!audioCtxRef.current || !analyserRef.current) return;
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
    }
    const src = audioCtxRef.current.createMediaElementSource(el);
    src.connect(analyserRef.current);
    sourceRef.current = src;
  }, []);

  // ── Track selection ────────────────────────────────────────────────────
  const loadTrack = useCallback((track: TrackEntry) => {
    setSelectedTrack(track);
    setIsPlaying(false);
    setWarpSpeed(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = track.url;
      audioRef.current.load();
    }
  }, []);

  // ── Transport ──────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    initAudioContext();
    const audio = audioRef.current;
    if (!audio) return;
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    connectAudioElement(audio);
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setWarpSpeed(0);
    } else {
      audio.play().then(() => { setIsPlaying(true); setWarpSpeed(1); }).catch(() => setIsPlaying(false));
    }
  }, [isPlaying, initAudioContext, connectAudioElement]);

  const handlePrev = useCallback(() => {
    const idx = library.findIndex(t => t.id === selectedTrack.id);
    const prev = library[(idx - 1 + library.length) % library.length];
    loadTrack(prev);
  }, [library, selectedTrack, loadTrack]);

  const handleNext = useCallback(() => {
    const idx = library.findIndex(t => t.id === selectedTrack.id);
    const next = library[(idx + 1) % library.length];
    loadTrack(next);
  }, [library, selectedTrack, loadTrack]);

  // ── Local file upload ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleScanSector = useCallback(() => {
    setScanExpanded(prev => !prev);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newTracks: TrackEntry[] = files.map(f => ({
      id: `local-${f.name}-${Date.now()}`,
      title: f.name.replace(/\.[^/.]+$/, ''),
      source: 'local',
      url: URL.createObjectURL(f),
    }));
    setLocalFiles(prev => [...prev, ...newTracks]);
    if (newTracks.length > 0) { loadTrack(newTracks[0]); setLibraryView('local'); }
    if (e.target) e.target.value = '';
  }, [loadTrack]);

  const handlePurge = useCallback(() => {
    if (libraryView === 'local') {
      localFiles.forEach(t => { try { URL.revokeObjectURL(t.url); } catch { /* ignore */ } });
      setLocalFiles([]);
    }
  }, [libraryView, localFiles]);

  // ── Track end ─────────────────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setWarpSpeed(0);
    handleNext();
  }, [handleNext]);

  // ── CSS vars (LCARS palette) ───────────────────────────────────────────
  const s: React.CSSProperties & Record<string, string> = {
    '--lcars-gold': '#cc9933',
    '--lcars-orange': '#ff9900',
    '--lcars-brown': '#996633',
    '--lcars-blue': '#9999cc',
    '--lcars-purple': '#cc99cc',
    '--lcars-red': '#cc4444',
    '--lcars-green': '#66cc66',
    '--lcars-dim': '#1a1a2e',
    '--lcars-bg': '#0a0a0f',
  };

  return (
    <div
      className="player-page"
      style={{
        ...s,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--lcars-bg)',
        color: '#ffffff',
        fontFamily: 'var(--fontFamilyBase, sans-serif)',
      }}
    >
      {/* Three.js background */}
      <WarpField warpSpeed={warpSpeed} />

      {/* ── Main layout ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── LCARS Sidebar ─────────────────────────────────────────── */}
        <aside
          style={{
            width: 220,
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.75rem 0.5rem',
            gap: '0.4rem',
            borderRight: '2px solid var(--lcars-gold)',
            background: 'rgba(10,10,15,0.85)',
            overflowY: 'auto',
          }}
        >
          {/* VOX header */}
          <div style={{ padding: '0.4rem 0.6rem 0.75rem', borderBottom: '1px solid var(--lcars-brown)' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--lcars-gold)', letterSpacing: '0.12em' }}>VOX</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--lcars-brown)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>NV-42 CORE</div>
          </div>

          {/* Library tabs */}
          <button
            onClick={() => setLibraryView('cloud')}
            style={lcarsBtn(libraryView === 'cloud', 'var(--lcars-blue)')}
          >
            🌐 NEURAL CLOUD
          </button>

          {libraryView === 'cloud' && (
            <button onClick={handlePurge} style={lcarsBtn(false, 'var(--lcars-red)', true)}>
              PURGE CLOUD MEMORY
            </button>
          )}

          <button
            onClick={() => setLibraryView('local')}
            style={lcarsBtn(libraryView === 'local', 'var(--lcars-brown)')}
          >
            💾 LOCAL SECTORS
          </button>

          {libraryView === 'local' && localFiles.length > 0 && (
            <button onClick={handlePurge} style={lcarsBtn(false, 'var(--lcars-red)', true)}>
              PURGE LOCAL MEMORY
            </button>
          )}

          {/* Track list */}
          <div style={{ flex: 1, overflowY: 'auto', marginTop: '0.25rem' }}>
            {filteredLibrary.length === 0 ? (
              <div style={{ fontSize: '0.65rem', color: 'var(--lcars-blue)', padding: '0.4rem 0.6rem', opacity: 0.6 }}>
                NO SIGNAL DETECTED
              </div>
            ) : (
              filteredLibrary.map(track => (
                <button
                  key={track.id}
                  onClick={() => loadTrack(track)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'right',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: selectedTrack.id === track.id ? 'rgba(204,153,51,0.15)' : 'transparent',
                    border: 'none',
                    borderLeft: selectedTrack.id === track.id ? '3px solid var(--lcars-gold)' : '3px solid transparent',
                    color: selectedTrack.id === track.id ? 'var(--lcars-gold)' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selectedTrack.id === track.id ? '(C) ' : '(S) '}{track.title.toUpperCase()}
                </button>
              ))
            )}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* UPLINK */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={lcarsBtn(false, 'var(--lcars-gold)')}
          >
            ↑ UPLINK
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* SCAN SECTOR */}
          <button
            onClick={handleScanSector}
            style={lcarsBtn(scanExpanded, 'var(--lcars-brown)')}
          >
            💾 SCAN SECTOR
          </button>

          {scanExpanded && (
            <div style={{ padding: '0.4rem 0.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--lcars-gold)', letterSpacing: '0.12em', marginBottom: '0.25rem' }}>AUDIO PROTOCOL</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['wav', 'mp3', 'all'] as AudioProtocol[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setProtocol(p)}
                    style={{
                      flex: 1,
                      padding: '0.2rem',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: protocol === p ? 'var(--lcars-gold)' : 'rgba(255,255,255,0.08)',
                      color: protocol === p ? '#000' : 'rgba(255,255,255,0.6)',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--lcars-gold)', letterSpacing: '0.12em', margin: '0.4rem 0 0.2rem' }}>PATTERN MATCH</div>
              <input
                type="text"
                value={patternMatch}
                onChange={e => setPatternMatch(e.target.value)}
                placeholder="LNBC..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--lcars-brown)',
                  borderRadius: 3,
                  color: '#fff',
                  fontSize: '0.65rem',
                  padding: '0.2rem 0.4rem',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </aside>

        {/* ── Main Panel ────────────────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* USS VOX NOVA topbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.4rem 1rem',
              borderBottom: '1px solid var(--lcars-brown)',
              background: 'rgba(204,153,51,0.07)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--lcars-gold)', textTransform: 'uppercase' }}>
              {VESSEL_NAME} // REGISTRY {REGISTRY_ID}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', letterSpacing: '0.12em', color: isPlaying ? '#ff4444' : 'rgba(255,255,255,0.4)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: isPlaying ? '#ff4444' : 'rgba(255,255,255,0.25)', display: 'inline-block', boxShadow: isPlaying ? '0 0 8px #ff4444' : 'none' }} />
                {isPlaying ? 'WARP_ACTIVE' : 'IMPULSE_ONLY'}
              </span>
            </div>
          </div>

          {/* Status bars */}
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              padding: '0.4rem 1rem',
              borderBottom: '1px solid rgba(204,153,51,0.2)',
              flexShrink: 0,
              alignItems: 'center',
            }}
          >
            <LcarsProgressBar label="STRUCTURAL INTEGRITY" value={isPlaying ? 85 : 100} color="var(--lcars-gold)" />
            <LcarsProgressBar label="NEURAL BUFFER" value={isPlaying ? 62 : 20} color="var(--lcars-blue)" />
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>SECTOR TIME</div>
              <SectorTimer />
            </div>
          </div>

          {/* ── Player centre ────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem 2rem',
              gap: '1.2rem',
              minHeight: 0,
            }}
          >
            {/* Encryption label */}
            <div style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'rgba(204,153,51,0.6)', textTransform: 'uppercase' }}>
              COMMS_ENCRYPTION: LEVEL 5
            </div>

            {/* Track title */}
            <div
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 700,
                color: '#ffffff',
                textAlign: 'center',
                lineHeight: 1.15,
                maxWidth: 600,
              }}
            >
              {selectedTrack.title}
            </div>

            {/* Gold separator */}
            <div style={{ width: 100, height: 2, background: 'var(--lcars-gold)', borderRadius: 1 }} />

            {/* Transport controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
              <TransportButton onClick={handlePrev} title="Previous">
                <PrevIcon />
              </TransportButton>
              <TransportButton
                onClick={handlePlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
                primary
                active={isPlaying}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </TransportButton>
              <TransportButton onClick={handleNext} title="Next">
                <NextIcon />
              </TransportButton>
            </div>

            {/* Frequency visualizer */}
            <div
              style={{
                width: '100%',
                maxWidth: 500,
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 6,
                border: '1px solid rgba(204,153,51,0.25)',
                overflow: 'hidden',
                padding: '0.4rem 0.5rem 0.2rem',
              }}
            >
              <FrequencyVisualizer analyser={analyserRef.current} isPlaying={isPlaying} />
            </div>
          </div>
        </main>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={selectedTrack.url}
        onEnded={handleEnded}
        crossOrigin="anonymous"
        preload="metadata"
        style={{ display: 'none' }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LcarsProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${value}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  );
}

function TransportButton({ onClick, title, children, primary, active }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: primary ? 64 : 48,
        height: primary ? 64 : 48,
        borderRadius: '50%',
        border: 'none',
        background: primary
          ? active ? 'var(--lcars-orange)' : 'var(--lcars-gold)'
          : 'rgba(255,255,255,0.08)',
        color: primary ? '#000' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        boxShadow: primary && active ? '0 0 20px var(--lcars-orange)' : 'none',
        transform: 'scale(1)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>;
}
function PauseIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>;
}
function PrevIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,4 8,12 19,20" /><rect x="4" y="4" width="3" height="16" /></svg>;
}
function NextIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 16,12 5,20" /><rect x="17" y="4" width="3" height="16" /></svg>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: LCARS button style
// ─────────────────────────────────────────────────────────────────────────────

function lcarsBtn(
  active: boolean,
  accentColor: string,
  danger = false,
): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '0.35rem 0.6rem',
    textAlign: 'right',
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    background: active
      ? `${accentColor}22`
      : danger
        ? 'rgba(204,68,68,0.12)'
        : 'rgba(255,255,255,0.04)',
    color: active ? accentColor : danger ? 'var(--lcars-red)' : 'rgba(255,255,255,0.55)',
    border: `1px solid ${active ? accentColor : danger ? 'var(--lcars-red)' : 'transparent'}`,
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  };
}
