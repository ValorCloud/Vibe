import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface WarpFieldProps {
  isPlaying: boolean;
}

export function WarpField({ isPlaying }: WarpFieldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<boolean>(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    sceneRef.current = true;

    const refs = { rafId: 0, currentSpeed: 0.3 };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    scene.fog = new THREE.FogExp2(0x000005, 0.0004);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 10000);
    camera.position.set(0, 0, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const starCanvas = document.createElement('canvas');
    starCanvas.width = 64; starCanvas.height = 64;
    const sc = starCanvas.getContext('2d')!;
    const sg = sc.createRadialGradient(32,32,0,32,32,32);
    sg.addColorStop(0,'rgba(255,255,255,1)'); sg.addColorStop(0.3,'rgba(255,255,255,0.8)'); sg.addColorStop(1,'rgba(255,255,255,0)');
    sc.fillStyle = sg; sc.fillRect(0,0,64,64);
    const starTex = new THREE.CanvasTexture(starCanvas);

    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const velocities = new Float32Array(starCount);
    const starGeometry = new THREE.BufferGeometry();
    const starColors = [
      new THREE.Color(0xffffff), new THREE.Color(0xaaccff),
      new THREE.Color(0xffead1), new THREE.Color(0xffd1d1),
    ];
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3000;
      positions[i * 3 + 2] = Math.random() * 3000;
      const c = starColors[i % starColors.length] ?? starColors[0]!;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      velocities[i] = Math.random() * 1.5 + 0.5;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({ size: 4, map: starTex, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(starGeometry, starMat));

    const makeNebula = (count: number, spread: number, color: number) => {
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        p[i * 3] = (Math.random() - 0.5) * spread;
        p[i * 3 + 1] = (Math.random() - 0.5) * spread;
        p[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const nc = document.createElement('canvas'); nc.width = 128; nc.height = 128;
      const nc2 = nc.getContext('2d')!;
      const ng = nc2.createRadialGradient(64,64,0,64,64,64);
      ng.addColorStop(0,'rgba(255,255,255,0.4)'); ng.addColorStop(0.5,'rgba(255,255,255,0.1)'); ng.addColorStop(1,'rgba(255,255,255,0)');
      nc2.fillStyle = ng; nc2.fillRect(0,0,128,128);
      return new THREE.Points(g, new THREE.PointsMaterial({ size: 600, color, map: new THREE.CanvasTexture(nc), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    };
    const nebula1 = makeNebula(4, 2500, 0x0044ff);
    const nebula2 = makeNebula(2, 2500, 0xee00aa);
    scene.add(nebula1, nebula2);

    const galaxyGroup = new THREE.Group();
    const gGeom = new THREE.BufferGeometry();
    const gPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      const a = i * 0.15; const r = i * 0.8 + Math.random() * 15;
      gPos[i*3] = Math.cos(a)*r; gPos[i*3+1] = (Math.random()-0.5)*5; gPos[i*3+2] = Math.sin(a)*r;
    }
    gGeom.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    galaxyGroup.add(new THREE.Points(gGeom, new THREE.PointsMaterial({ size: 3, color: 0xffffee, transparent: true, opacity: 0.5, map: starTex, blending: THREE.AdditiveBlending })));
    galaxyGroup.position.set(500, 300, -1500);
    scene.add(galaxyGroup);

    const gridCount = 20; const gridSize = 3000;
    const gridGeom = new THREE.BufferGeometry();
    const gridLines: number[] = [];
    for (let i = 0; i <= gridCount; i++) {
      const z = (i / gridCount) * gridSize - gridSize / 2;
      gridLines.push(-gridSize/2, 0, z, gridSize/2, 0, z);
      const x = (i / gridCount) * gridSize - gridSize / 2;
      gridLines.push(x, 0, -gridSize/2, x, 0, gridSize/2);
    }
    gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gridLines, 3));
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
    const grid = new THREE.LineSegments(gridGeom, gridMaterial);
    grid.position.y = -400;
    scene.add(grid);

    const bhGroup = new THREE.Group();
    bhGroup.add(new THREE.Mesh(new THREE.SphereGeometry(40,32,32), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    const diskCount = 800;
    const diskGeom = new THREE.BufferGeometry();
    const diskPos = new Float32Array(diskCount * 3);
    const diskColors = new Float32Array(diskCount * 3);
    for (let i = 0; i < diskCount; i++) {
      const a = Math.random() * Math.PI * 2; const r = 60 + Math.random() * 100;
      diskPos[i*3] = Math.cos(a)*r; diskPos[i*3+1] = (Math.random()-0.5)*10; diskPos[i*3+2] = Math.sin(a)*r;
      const c = new THREE.Color().setHSL(0.5 + Math.random()*0.2, 1, 0.5);
      diskColors[i*3] = c.r; diskColors[i*3+1] = c.g; diskColors[i*3+2] = c.b;
    }
    diskGeom.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
    diskGeom.setAttribute('color', new THREE.BufferAttribute(diskColors, 3));
    const disk = new THREE.Points(diskGeom, new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, map: starTex }));
    const cGeom = new THREE.BufferGeometry();
    cGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
    const coronaMat = new THREE.PointsMaterial({ size: 450, color: 0x4488ff, map: starTex, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
    bhGroup.add(disk, new THREE.Points(cGeom, coronaMat));
    bhGroup.position.set(-300, 100, -800);
    scene.add(bhGroup);

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      refs.rafId = requestAnimationFrame(animate);
      const playing = sceneRef.current ? isPlaying : false;
      const targetSpeed = playing ? 8 : 0.3;
      refs.currentSpeed = THREE.MathUtils.lerp(refs.currentSpeed, targetSpeed, 0.03);
      const posAttr = starGeometry.attributes['position'];
      if (posAttr) {
        const pos = posAttr.array as Float32Array;
        for (let i = 0; i < starCount; i++) {
          const vel = velocities[i] ?? 1;
          pos[i*3+2] += vel * refs.currentSpeed;
          if ((pos[i*3+2] ?? 0) > 1500) {
            pos[i*3+2] = -1500;
            pos[i*3] = (Math.random()-0.5)*3000;
            pos[i*3+1] = (Math.random()-0.5)*3000;
          }
        }
        posAttr.needsUpdate = true;
      }
      nebula1.rotation.y += 0.001; nebula2.rotation.z += 0.001;
      nebula1.position.z += refs.currentSpeed * 0.5; nebula2.position.z += refs.currentSpeed * 0.5;
      if (nebula1.position.z > 2000) nebula1.position.z = -2000;
      if (nebula2.position.z > 2000) nebula2.position.z = -2000;
      galaxyGroup.rotation.y += 0.01; galaxyGroup.position.z += refs.currentSpeed;
      if (galaxyGroup.position.z > 2000) galaxyGroup.position.z = -2000;
      bhGroup.rotation.y += 0.005;
      disk.rotation.y += 0.01 * (1 + refs.currentSpeed * 0.1);
      grid.position.z += refs.currentSpeed * 0.3;
      if (grid.position.z > 150) grid.position.z -= 150;
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
  }, [isPlaying]);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />;
}
