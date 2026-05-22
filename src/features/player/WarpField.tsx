import { memo, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WarpFieldProps {
  isPlaying: boolean;
}

export const WarpField = memo(function WarpField({ isPlaying }: WarpFieldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    sceneRef.current = true;

    const refs = { rafId: 0, currentSpeed: 0.3, time: 0 };

    const scene = new THREE.Scene();
    // Deep space — near-black with very slight blue tint
    scene.background = new THREE.Color(0x01020a);
    scene.fog = new THREE.FogExp2(0x01020a, 0.00025);

    const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.1, 15000);
    camera.position.set(0, 40, 600);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ─── Shared star sprite ───────────────────────────────────────
    const makeStarSprite = (size = 64) => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.15, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    };
    const starTex = makeStarSprite(64);

    // ─── Starfield — 5000 stars with realistic color distribution ──
    const STAR_COUNT = 5000;
    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starVelocities = new Float32Array(STAR_COUNT);
    const starSizes = new Float32Array(STAR_COUNT);

    // Realistic stellar color palette (O/B blue, A white, F yellow-white, G/K orange, M red)
    const stellarPalette = [
      new THREE.Color(0xb8d4ff), // O/B — hot blue
      new THREE.Color(0xcce0ff), // B — blue-white
      new THREE.Color(0xffffff), // A — pure white
      new THREE.Color(0xfff7e8), // F — yellow-white
      new THREE.Color(0xffecc8), // G — sun-like
      new THREE.Color(0xffcf90), // K — orange
      new THREE.Color(0xff9060), // M — red dwarf
    ];
    // Weight distribution: mostly white/yellow, fewer blue/red
    const palette = [0,0,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,6,6].map(i => stellarPalette[i]!);

    for (let i = 0; i < STAR_COUNT; i++) {
      starPositions[i * 3]     = (Math.random() - 0.5) * 5000;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 3000;
      starPositions[i * 3 + 2] = Math.random() * 4000 - 500;
      const c = palette[Math.floor(Math.random() * palette.length)]!;
      starColors[i * 3]     = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
      starVelocities[i] = Math.random() * 1.2 + 0.3;
      starSizes[i] = Math.random() * 3 + 1;
    }

    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMat = new THREE.PointsMaterial({
      size: 3,
      map: starTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // ─── Distant galaxy cluster (background depth) ────────────────
    const makeNebulaSprite = (color: number, alpha: number) => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      const col = new THREE.Color(color);
      g.addColorStop(0, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},${alpha})`);
      g.addColorStop(0.4, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},${alpha * 0.4})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    };

    // Deep blue nebula
    const nebula1Geom = new THREE.BufferGeometry();
    const n1p = new Float32Array(6 * 3);
    for (let i = 0; i < 6; i++) {
      n1p[i*3]   = (Math.random() - 0.5) * 2200;
      n1p[i*3+1] = (Math.random() - 0.5) * 1200;
      n1p[i*3+2] = -3000 + Math.random() * 1000;
    }
    nebula1Geom.setAttribute('position', new THREE.BufferAttribute(n1p, 3));
    const nebula1 = new THREE.Points(nebula1Geom, new THREE.PointsMaterial({
      size: 1200, color: 0x0022cc, map: makeNebulaSprite(0x0033ff, 0.35),
      transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(nebula1);

    // Magenta/pink nebula
    const nebula2Geom = new THREE.BufferGeometry();
    const n2p = new Float32Array(4 * 3);
    for (let i = 0; i < 4; i++) {
      n2p[i*3]   = (Math.random() - 0.5) * 2000;
      n2p[i*3+1] = (Math.random() - 0.5) * 1000;
      n2p[i*3+2] = -2500 + Math.random() * 800;
    }
    nebula2Geom.setAttribute('position', new THREE.BufferAttribute(n2p, 3));
    const nebula2 = new THREE.Points(nebula2Geom, new THREE.PointsMaterial({
      size: 1000, color: 0xaa0088, map: makeNebulaSprite(0xcc00aa, 0.3),
      transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(nebula2);

    // Teal/green emission nebula
    const nebula3Geom = new THREE.BufferGeometry();
    const n3p = new Float32Array(5 * 3);
    for (let i = 0; i < 5; i++) {
      n3p[i*3]   = (Math.random() - 0.5) * 1800;
      n3p[i*3+1] = (Math.random() - 0.5) * 900;
      n3p[i*3+2] = -2000 + Math.random() * 600;
    }
    nebula3Geom.setAttribute('position', new THREE.BufferAttribute(n3p, 3));
    const nebula3 = new THREE.Points(nebula3Geom, new THREE.PointsMaterial({
      size: 800, color: 0x006644, map: makeNebulaSprite(0x00aa66, 0.25),
      transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(nebula3);

    // ─── Milky Way band (distant star field plane) ────────────────
    const mwGeom = new THREE.BufferGeometry();
    const mwCount = 2000;
    const mwPos = new Float32Array(mwCount * 3);
    const mwCol = new Float32Array(mwCount * 3);
    for (let i = 0; i < mwCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 200 + Math.random() * 1800;
      mwPos[i*3]   = Math.cos(theta) * r;
      mwPos[i*3+1] = (Math.random() - 0.5) * 120; // thin band
      mwPos[i*3+2] = Math.sin(theta) * r - 2000;
      const warm = Math.random();
      mwCol[i*3]   = 0.7 + warm * 0.3;
      mwCol[i*3+1] = 0.7 + warm * 0.15;
      mwCol[i*3+2] = 0.8 + (1 - warm) * 0.2;
    }
    mwGeom.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
    mwGeom.setAttribute('color', new THREE.BufferAttribute(mwCol, 3));
    const milkyWay = new THREE.Points(mwGeom, new THREE.PointsMaterial({
      size: 2, vertexColors: true, map: starTex,
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(milkyWay);

    // ─── Realistic Black Hole ─────────────────────────────────────
    // Positioned in LOWER CENTER — below the equalizer zone
    const bhGroup = new THREE.Group();
    bhGroup.position.set(0, -220, -900);

    // 1. Event horizon — solid black sphere
    const ehGeom = new THREE.SphereGeometry(55, 64, 64);
    const ehMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eventHorizon = new THREE.Mesh(ehGeom, ehMat);
    bhGroup.add(eventHorizon);

    // 2. Photon sphere — subtle glow ring right around horizon
    const photonCanvas = document.createElement('canvas');
    photonCanvas.width = 512; photonCanvas.height = 512;
    const pc = photonCanvas.getContext('2d')!;
    const pr = 256;
    const pg = pc.createRadialGradient(pr, pr, pr * 0.18, pr, pr, pr * 0.38);
    pg.addColorStop(0, 'rgba(255,220,140,0)');
    pg.addColorStop(0.3, 'rgba(255,200,80,0.9)');
    pg.addColorStop(0.5, 'rgba(255,160,40,0.5)');
    pg.addColorStop(0.7, 'rgba(200,100,20,0.2)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    pc.fillStyle = pg; pc.fillRect(0, 0, 512, 512);
    const photonRingTex = new THREE.CanvasTexture(photonCanvas);
    const photonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshBasicMaterial({ map: photonRingTex, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    photonPlane.rotation.x = Math.PI / 2;
    bhGroup.add(photonPlane);

    // 3. Accretion disk — particle ring with hot inner / cool outer gradient
    const diskCount = 3000;
    const diskGeom = new THREE.BufferGeometry();
    const diskPos = new Float32Array(diskCount * 3);
    const diskCol = new Float32Array(diskCount * 3);
    const diskVel = new Float32Array(diskCount);
    for (let i = 0; i < diskCount; i++) {
      const layer = Math.random() < 0.4 ? 'inner' : 'outer';
      const minR = layer === 'inner' ? 62 : 85;
      const maxR = layer === 'inner' ? 100 : 220;
      const r = minR + Math.pow(Math.random(), 0.5) * (maxR - minR);
      const theta = Math.random() * Math.PI * 2;
      const tilt = (Math.random() - 0.5) * (layer === 'inner' ? 6 : 16);
      diskPos[i*3]   = Math.cos(theta) * r;
      diskPos[i*3+1] = tilt;
      diskPos[i*3+2] = Math.sin(theta) * r;

      const t = (r - 60) / 165;
      if (t < 0.15) {
        diskCol[i*3] = 0.7 + Math.random()*0.3;
        diskCol[i*3+1] = 0.8 + Math.random()*0.2;
        diskCol[i*3+2] = 1.0;
      } else if (t < 0.35) {
        diskCol[i*3] = 1.0; diskCol[i*3+1] = 0.9; diskCol[i*3+2] = 0.6;
      } else if (t < 0.6) {
        diskCol[i*3] = 1.0; diskCol[i*3+1] = 0.55 - t*0.3; diskCol[i*3+2] = 0.1;
      } else {
        diskCol[i*3] = 0.6 + Math.random()*0.2;
        diskCol[i*3+1] = 0.1 + Math.random()*0.1;
        diskCol[i*3+2] = 0.2 + Math.random()*0.3;
      }
      diskVel[i] = (0.008 + Math.random() * 0.012) * (60 / Math.max(r, 60));
    }
    diskGeom.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
    diskGeom.setAttribute('color', new THREE.BufferAttribute(diskCol, 3));
    const diskMat = new THREE.PointsMaterial({
      size: 3, vertexColors: true, map: starTex,
      transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const accretionDisk = new THREE.Points(diskGeom, diskMat);
    bhGroup.add(accretionDisk);

    // 4. Gravitational lensing glow
    const lensCanvas = document.createElement('canvas');
    lensCanvas.width = 256; lensCanvas.height = 256;
    const lc = lensCanvas.getContext('2d')!;
    const lg = lc.createRadialGradient(128, 128, 20, 128, 128, 128);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(0.3, 'rgba(30,50,120,0.0)');
    lg.addColorStop(0.55, 'rgba(60,100,200,0.25)');
    lg.addColorStop(0.75, 'rgba(100,60,180,0.15)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = lg; lc.fillRect(0, 0, 256, 256);
    const lensPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lensCanvas), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    lensPlane.rotation.x = Math.PI / 2;
    bhGroup.add(lensPlane);

    // 5. Relativistic jets (polar)
    const makeJet = (dir: 1 | -1) => {
      const jGeom = new THREE.BufferGeometry();
      const jCount = 300;
      const jPos = new Float32Array(jCount * 3);
      const jCol = new Float32Array(jCount * 3);
      for (let i = 0; i < jCount; i++) {
        const t = Math.random();
        const spread = t * 18;
        jPos[i*3]   = (Math.random() - 0.5) * spread;
        jPos[i*3+1] = dir * (60 + t * 400);
        jPos[i*3+2] = (Math.random() - 0.5) * spread;
        const intensity = 1 - t * 0.7;
        jCol[i*3]   = 0.3 * intensity;
        jCol[i*3+1] = 0.6 * intensity;
        jCol[i*3+2] = 1.0 * intensity;
      }
      jGeom.setAttribute('position', new THREE.BufferAttribute(jPos, 3));
      jGeom.setAttribute('color', new THREE.BufferAttribute(jCol, 3));
      return new THREE.Points(jGeom, new THREE.PointsMaterial({
        size: 4, vertexColors: true, map: starTex,
        transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    };
    bhGroup.add(makeJet(1), makeJet(-1));

    // 6. Shadow vignette
    const shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(54, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: false }),
    );
    shadowMesh.position.y = 0.5;
    bhGroup.add(shadowMesh);

    scene.add(bhGroup);

    // ─── Neon grid ────────────────────────────────────────────────
    const gridSize = 3000;
    const gridDivisions = 40;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x001133, 0x000d22);
    gridHelper.position.set(0, -350, 0);
    scene.add(gridHelper);

    // ─── Resize ───────────────────────────────────────────────────
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ─── Animation loop ───────────────────────────────────────────
    const animate = () => {
      refs.rafId = requestAnimationFrame(animate);
      refs.time += 0.016;

      const playing = sceneRef.current ? isPlayingRef.current : false;
      const targetSpeed = playing ? 7 : 0.25;
      refs.currentSpeed = THREE.MathUtils.lerp(refs.currentSpeed, targetSpeed, 0.025);

      const posAttr = starGeom.attributes['position'];
      if (posAttr) {
        const pos = posAttr.array as Float32Array;
        for (let i = 0; i < STAR_COUNT; i++) {
          const vel = starVelocities[i] ?? 1;
          const z = (pos[i * 3 + 2] ?? 0) + vel * refs.currentSpeed;
          pos[i * 3 + 2] = z;
          if (z > 1500) {
            pos[i * 3 + 2] = -2500;
            pos[i * 3]     = (Math.random() - 0.5) * 5000;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 3000;
          }
        }
        posAttr.needsUpdate = true;
      }

      nebula1.rotation.y += 0.0003; nebula2.rotation.z += 0.0002; nebula3.rotation.x += 0.0001;
      milkyWay.rotation.y += 0.00015;

      const dPosAttr = diskGeom.attributes['position'];
      if (dPosAttr) {
        const dp = dPosAttr.array as Float32Array;
        for (let i = 0; i < diskCount; i++) {
          const x = dp[i*3] ?? 0;
          const z = dp[i*3+2] ?? 0;
          const r = Math.sqrt(x*x + z*z);
          const angVel = diskVel[i] ?? 0.01;
          const angle = angVel * (1 + refs.currentSpeed * 0.04);
          dp[i*3]   = x * Math.cos(angle) - z * Math.sin(angle);
          dp[i*3+2] = x * Math.sin(angle) + z * Math.cos(angle);
          dp[i*3+1] = (dp[i*3+1] ?? 0) + Math.sin(refs.time * 3 + r * 0.1) * 0.015;
        }
        dPosAttr.needsUpdate = true;
      }

      const pulse = 0.92 + Math.sin(refs.time * 4) * 0.08;
      photonPlane.material.opacity = pulse;

      bhGroup.rotation.x = Math.sin(refs.time * 0.1) * 0.04;
      bhGroup.rotation.z = Math.cos(refs.time * 0.07) * 0.03;

      gridHelper.position.z += refs.currentSpeed * 0.2;
      if (gridHelper.position.z > 75) gridHelper.position.z -= 75;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      sceneRef.current = false;
      cancelAnimationFrame(refs.rafId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-hidden="true" />;
});
