import { memo, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WarpFieldProps {
  isPlaying: boolean;
}

// ─── Gravitational lensing background shader ──────────────────────────────────
const lensingVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lensingFragmentShader = `
  uniform float uTime;
  uniform vec2 uBhScreen;
  uniform float uBhRadius;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 starField(vec2 uv) {
    vec3 col = vec3(0.004, 0.006, 0.016);
    for (float s = 1.0; s <= 4.0; s++) {
      float scale = pow(2.0, s) * 80.0;
      vec2 cell = floor(uv * scale);
      vec2 fr   = fract(uv * scale);
      float h = hash(cell);
      if (h > 0.985) {
        float dist = length(fr - 0.5);
        float brightness = smoothstep(0.25, 0.0, dist);
        vec3 starColor;
        float ct = hash(cell + vec2(13.7, 4.2));
        if      (ct < 0.15) starColor = vec3(0.72, 0.84, 1.0);
        else if (ct < 0.30) starColor = vec3(0.88, 0.93, 1.0);
        else if (ct < 0.55) starColor = vec3(1.0,  0.97, 0.85);
        else if (ct < 0.75) starColor = vec3(1.0,  0.87, 0.6);
        else                starColor = vec3(1.0,  0.55, 0.3);
        col += starColor * brightness * (0.4 + h * 0.6);
      }
    }
    float band = exp(-pow((uv.y - 0.5) * 8.0, 2.0)) * 0.025;
    col += vec3(0.5, 0.6, 0.8) * band;
    float neb1 = exp(-length((uv - vec2(0.25, 0.6)) * vec2(3.0, 6.0))) * 0.06;
    float neb2 = exp(-length((uv - vec2(0.75, 0.35)) * vec2(4.0, 5.0))) * 0.04;
    col += vec3(0.1, 0.2, 0.8) * neb1;
    col += vec3(0.6, 0.1, 0.5) * neb2;
    return col;
  }

  void main() {
    vec2 uv = vUv;
    vec2 toCenter = uv - uBhScreen;
    float dist = length(toCenter);
    float r = uBhRadius;

    if (dist < r * 0.90) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float rs = r;
    float deflection = (rs * rs) / (dist * dist + rs * 0.3);
    deflection = clamp(deflection, 0.0, 0.95);
    vec2 dir = normalize(toCenter);
    vec2 lensedUv = uv + dir * deflection * 0.6;

    float ringWidth = r * 0.16;
    float ringDist  = abs(dist - r * 1.06);
    float ring = smoothstep(ringWidth, 0.0, ringDist);
    float topBottom = 0.5 - toCenter.y / (r * 2.0);
    ring *= (0.5 + topBottom * 0.9);

    vec3 stars = starField(lensedUv);
    vec3 ringColor = mix(vec3(1.0, 0.55, 0.1), vec3(1.0, 0.92, 0.65), topBottom);
    stars += ringColor * ring * 3.0;

    float halo = smoothstep(r * 4.0, r * 1.2, dist) * 0.07;
    stars += vec3(0.2, 0.15, 0.4) * halo;

    float vignette = smoothstep(r * 1.5, r * 3.5, dist);
    stars *= (0.3 + vignette * 0.7);

    gl_FragColor = vec4(stars, 1.0);
  }
`;

// ─── Accretion disk shader — Doppler + inclined ───────────────────────────────
const diskVertexShader = `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aLayerTilt;
  uniform float uTime;
  uniform float uRotSpeed;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float angle = aAngle + uTime * aSpeed * uRotSpeed;
    float x = cos(angle) * aRadius;
    float z = sin(angle) * aRadius;
    float y = aLayerTilt * sin(angle * 2.0 + uTime * 0.3) * 0.04;

    float vLos = sin(angle);
    float doppler = vLos * 0.6;

    float rNorm = clamp((aRadius - 65.0) / 215.0, 0.0, 1.0);

    vec3 innerColor = vec3(0.78, 0.90, 1.0);
    vec3 midColor   = vec3(1.0,  0.58, 0.1);
    vec3 outerColor = vec3(0.38, 0.05, 0.10);
    vec3 thermalCol;
    if (rNorm < 0.35) {
      thermalCol = mix(innerColor, vec3(1.0, 0.94, 0.72), rNorm / 0.35);
    } else if (rNorm < 0.65) {
      thermalCol = mix(vec3(1.0, 0.94, 0.72), midColor, (rNorm - 0.35) / 0.30);
    } else {
      thermalCol = mix(midColor, outerColor, (rNorm - 0.65) / 0.35);
    }

    float brightness = clamp(1.0 + doppler * 1.2, 0.1, 2.8);
    vec3 dopplerShift = vec3(
      thermalCol.r * (doppler < 0.0 ? brightness : 1.0 + doppler * 0.3),
      thermalCol.g * brightness * 0.9,
      thermalCol.b * (doppler > 0.0 ? brightness : 1.0)
    );
    vColor = clamp(dopplerShift, 0.0, 3.0);
    vAlpha = (1.0 - rNorm * 0.7) * clamp(brightness * 0.5, 0.1, 1.0);

    vec4 mvPos = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_PointSize = (3.8 - rNorm * 1.6) * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const diskFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

// ─── Ghost arc — lensed lower image of disk ───────────────────────────────────
const ghostVertexShader = `
  attribute float aRadius;
  attribute float aAngle;
  uniform float uTime;
  uniform float uRotSpeed;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float angle = aAngle + uTime * 0.008 * uRotSpeed;
    float x = cos(angle) * aRadius * 0.9;
    float z = -14.0 - abs(sin(angle)) * 8.0;
    float y = sin(angle) * aRadius * 0.10;

    float rNorm = clamp((aRadius - 65.0) / 160.0, 0.0, 1.0);
    float vLos = -sin(angle);
    float doppler = vLos * 0.5;
    float brightness = clamp(1.0 + doppler * 0.8, 0.2, 2.2);
    vec3 baseColor = mix(vec3(1.0, 0.72, 0.2), vec3(0.8, 0.3, 0.1), rNorm);
    vColor = baseColor * brightness;
    vAlpha = (1.0 - rNorm * 0.8) * 0.55 * clamp(brightness * 0.6, 0.1, 1.0);

    vec4 mvPos = modelViewMatrix * vec4(x, y, z, 1.0);
    gl_PointSize = (2.5 - rNorm * 1.0) * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const WarpField = memo(function WarpField({ isPlaying }: WarpFieldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const sceneRef = useRef<boolean>(false);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    sceneRef.current = true;

    const state = { rafId: 0, time: 0, rotSpeed: 0.4 };

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── Scene & Camera — equatorial low-angle view ────────────────────────────
    // Camera placed near equatorial plane, slightly above, looking toward BH center.
    // This gives the characteristic Interstellar view: disk as bright ellipse,
    // ghost arc visible below, photon ring encircling the shadow.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 20000);
    camera.position.set(0, 35, 480);
    camera.lookAt(0, -10, 0);

    // ── Full-screen lensing background quad ───────────────────────────────────
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const lensMat = new THREE.ShaderMaterial({
      vertexShader: lensingVertexShader,
      fragmentShader: lensingFragmentShader,
      uniforms: {
        uTime:     { value: 0 },
        uBhScreen: { value: new THREE.Vector2(0.5, 0.48) },
        uBhRadius: { value: 0.115 },
      },
      depthWrite: false,
      depthTest: false,
    });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat));

    // ── Black hole group ──────────────────────────────────────────────────────
    const bhGroup = new THREE.Group();
    bhGroup.position.set(0, -10, 0);
    scene.add(bhGroup);

    const EH_RADIUS = 65;

    // Event horizon
    bhGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(EH_RADIUS, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    ));

    // ── Accretion disk ────────────────────────────────────────────────────────
    const DISK_COUNT = 9000;
    const dRadius = new Float32Array(DISK_COUNT);
    const dAngle  = new Float32Array(DISK_COUNT);
    const dSpeed  = new Float32Array(DISK_COUNT);
    const dTilt   = new Float32Array(DISK_COUNT);

    for (let i = 0; i < DISK_COUNT; i++) {
      const inner = Math.random() < 0.35;
      const rMin = inner ? 68 : 100;
      const rMax = inner ? 115 : 280;
      const r = rMin + Math.pow(Math.random(), 0.6) * (rMax - rMin);
      dRadius[i] = r;
      dAngle[i]  = Math.random() * Math.PI * 2;
      dSpeed[i]  = 0.016 * Math.sqrt(80 / Math.max(r, 68));
      dTilt[i]   = (Math.random() - 0.5) * (inner ? 4 : 14);
    }

    const diskGeom = new THREE.BufferGeometry();
    diskGeom.setAttribute('aRadius',     new THREE.BufferAttribute(dRadius, 1));
    diskGeom.setAttribute('aAngle',      new THREE.BufferAttribute(dAngle, 1));
    diskGeom.setAttribute('aSpeed',      new THREE.BufferAttribute(dSpeed, 1));
    diskGeom.setAttribute('aLayerTilt',  new THREE.BufferAttribute(dTilt, 1));
    diskGeom.setAttribute('position',    new THREE.BufferAttribute(new Float32Array(DISK_COUNT * 3), 3));

    const diskMat = new THREE.ShaderMaterial({
      vertexShader: diskVertexShader,
      fragmentShader: diskFragmentShader,
      uniforms: {
        uTime:     { value: 0 },
        uRotSpeed: { value: state.rotSpeed },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const diskMesh = new THREE.Points(diskGeom, diskMat);
    diskMesh.rotation.x = THREE.MathUtils.degToRad(12);
    bhGroup.add(diskMesh);

    // ── Ghost arc — lensed lower image ────────────────────────────────────────
    const GHOST_COUNT = 2000;
    const gRadius = new Float32Array(GHOST_COUNT);
    const gAngle  = new Float32Array(GHOST_COUNT);
    for (let i = 0; i < GHOST_COUNT; i++) {
      gRadius[i] = 70 + Math.pow(Math.random(), 0.5) * 140;
      gAngle[i]  = Math.random() * Math.PI * 2;
    }
    const ghostGeom = new THREE.BufferGeometry();
    ghostGeom.setAttribute('aRadius',  new THREE.BufferAttribute(gRadius, 1));
    ghostGeom.setAttribute('aAngle',   new THREE.BufferAttribute(gAngle, 1));
    ghostGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GHOST_COUNT * 3), 3));
    const ghostMat = new THREE.ShaderMaterial({
      vertexShader: ghostVertexShader,
      fragmentShader: diskFragmentShader,
      uniforms: {
        uTime:     { value: 0 },
        uRotSpeed: { value: state.rotSpeed },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    bhGroup.add(new THREE.Points(ghostGeom, ghostMat));

    // ── Photon ring — TorusGeometry, billboard-aligned, additive glow ─────────
    // Using a torus instead of a flat plane so it wraps correctly around the
    // event horizon from any camera angle, especially equatorial view.
    const photonRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(EH_RADIUS + 7, 3.5, 24, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.0, 0.75, 0.3),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    // Tilt matches disk inclination
    photonRingMesh.rotation.x = THREE.MathUtils.degToRad(12);
    bhGroup.add(photonRingMesh);

    // Inner thin photon ring (brighter, tighter)
    const innerRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(EH_RADIUS + 2, 1.5, 16, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.0, 0.95, 0.8),
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    innerRingMesh.rotation.x = THREE.MathUtils.degToRad(12);
    bhGroup.add(innerRingMesh);

    // Shadow disk — occludes geometry behind event horizon
    const shadowDisk = new THREE.Mesh(
      new THREE.CircleGeometry(EH_RADIUS - 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthWrite: true }),
    );
    bhGroup.add(shadowDisk);

    // ── Relativistic jets ─────────────────────────────────────────────────────
    const makeJet = (dir: 1 | -1) => {
      const N = 400;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const t = Math.pow(Math.random(), 0.6);
        const sp = t * 22;
        pos[i*3]   = (Math.random() - 0.5) * sp;
        pos[i*3+1] = dir * (EH_RADIUS + t * 500);
        pos[i*3+2] = (Math.random() - 0.5) * sp;
        const b = (1 - t * 0.8) * (0.5 + Math.random() * 0.5);
        col[i*3] = 0.2*b; col[i*3+1] = 0.5*b; col[i*3+2] = 1.0*b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({
        size: 4, vertexColors: true,
        transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    };
    bhGroup.add(makeJet(1), makeJet(-1));

    // ── Dust lane ─────────────────────────────────────────────────────────────
    const dc = document.createElement('canvas');
    dc.width = 256; dc.height = 64;
    const dCtx = dc.getContext('2d')!;
    const dg = dCtx.createLinearGradient(0, 0, 0, 64);
    dg.addColorStop(0,    'rgba(0,0,0,0)');
    dg.addColorStop(0.35, 'rgba(0,0,0,0)');
    dg.addColorStop(0.48, 'rgba(0,0,0,0.85)');
    dg.addColorStop(0.52, 'rgba(0,0,0,0.85)');
    dg.addColorStop(0.65, 'rgba(0,0,0,0)');
    dg.addColorStop(1,    'rgba(0,0,0,0)');
    dCtx.fillStyle = dg;
    dCtx.fillRect(0, 0, 256, 64);
    const dustLane = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 80),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(dc),
        transparent: true, opacity: 0.75,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    dustLane.rotation.x = THREE.MathUtils.degToRad(12);
    bhGroup.add(dustLane);

    // ── Helper: project BH world position → background shader UV ─────────────
    const bhWorldPos = new THREE.Vector3();

    // ── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ── Animation loop ────────────────────────────────────────────────────────
    const animate = () => {
      state.rafId = requestAnimationFrame(animate);
      state.time += 0.016;

      const targetSpeed = isPlayingRef.current ? 3.5 : 0.4;
      state.rotSpeed = THREE.MathUtils.lerp(state.rotSpeed, targetSpeed, 0.02);

      // Compute BH screen-space UV dynamically so lensing always centers correctly
      bhGroup.getWorldPosition(bhWorldPos);
      const projected = bhWorldPos.clone().project(camera);
      // projected is in NDC [-1,1]; convert to UV [0,1]
      lensMat.uniforms['uBhScreen']!.value.set(
        (projected.x + 1) * 0.5,
        (projected.y + 1) * 0.5,
      );

      lensMat.uniforms['uTime']!.value     = state.time;
      diskMat.uniforms['uTime']!.value     = state.time;
      diskMat.uniforms['uRotSpeed']!.value = state.rotSpeed;
      ghostMat.uniforms['uTime']!.value    = state.time;
      ghostMat.uniforms['uRotSpeed']!.value = state.rotSpeed;

      // Photon ring pulse
      const pulse = 0.85 + Math.sin(state.time * 3.2) * 0.15;
      (photonRingMesh.material as THREE.MeshBasicMaterial).opacity = pulse * 0.9;
      (innerRingMesh.material as THREE.MeshBasicMaterial).opacity  = 0.7 + Math.sin(state.time * 4.1 + 1.2) * 0.3;

      bhGroup.rotation.y = Math.sin(state.time * 0.08) * 0.02;
      bhGroup.rotation.z = Math.cos(state.time * 0.06) * 0.015;

      // Slow equatorial drift — camera stays near the plane
      camera.position.x = Math.sin(state.time * 0.04) * 14;
      camera.position.y = 35 + Math.cos(state.time * 0.03) * 6;
      camera.lookAt(0, -10, 0);

      renderer.autoClear = true;
      renderer.render(bgScene, bgCamera);
      renderer.autoClear = false;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      sceneRef.current = false;
      cancelAnimationFrame(state.rafId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-hidden="true" />;
});
