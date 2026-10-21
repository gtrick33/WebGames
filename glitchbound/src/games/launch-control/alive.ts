/**
 * What makes the strip feel alive: a crowd that bounces out of step and jumps up at the launch and
 * the finish, flags waving along the stands, camera flashes popping in the crowd, a blimp and hot-air
 * balloons drifting over, a flock of birds, two marshals who throw their arms up at green, and
 * confetti for a win. Small, layered, desynchronised motions (instanced, a handful of draw calls).
 */
import * as THREE from 'three';

const noise = (i: number, k = 1): number => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export interface AliveOpts {
  /** Half the width of the strip (from the centre line to the outer lane edge). */
  laneW: number;
  stands: [string, string];
  /** The strip's sky colours, for the balloons' tint. */
  far: string;
}

export interface Alive {
  group: THREE.Group;
  /** Advance by dt; `excite` 0..1 (a cheer), `focusX` where the action is (flashes and birds stay near it). */
  update(t: number, dt: number, excite: number, focusX: number): void;
  /** Arms up (the marshals at green) or down. */
  marshals(up: boolean): void;
  /** Confetti cannons on both sides of the track at `x`, shooting up and in over the cars. */
  confetti(x: number, count?: number): void;
  dispose(): void;
}

const PALETTE = ['#1d1238', '#ffffff', '#ffd12e', '#22e4ff', '#ff4fc8', '#c4f034', '#ff6a1a', '#2d6cdf', '#e63946'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d'];

export function buildAlive(o: AliveOpts): Alive {
  const g = new THREE.Group();
  const trash: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(d: T): T => {
    trash.push(d);
    return d;
  };
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // ---- the crowd: a torso and a head per fan, in three rows of stands down both sides
  type Fan = { x: number; y: number; z: number; s: number; ph: number; w: number; side: number };
  const fans: Fan[] = [];
  for (let seg = 0; seg < 24; seg++) {
    const x0 = -30 + seg * 20;
    for (const side of [1, -1])
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 11; k++) {
          const i = fans.length;
          fans.push({ x: x0 - 8.5 + k * 1.7 + (noise(i, 3) - 0.5) * 0.5, y: 1.0 + row, z: side * (o.laneW + 7.5 + row * 2.6) + (noise(i, 15) - 0.5) * 0.6, s: 0.85 + noise(i, 16) * 0.35, ph: noise(i, 4) * 6.28, w: 5 + noise(i, 5) * 4, side });
        }
  }
  const torsoGeo = keep(new THREE.CapsuleGeometry(0.2, 0.36, 3, 6));
  const headGeo = keep(new THREE.SphereGeometry(0.17, 8, 6));
  const torsos = new THREE.InstancedMesh(torsoGeo, keep(new THREE.MeshLambertMaterial({ color: '#ffffff' })), fans.length);
  const heads = new THREE.InstancedMesh(headGeo, keep(new THREE.MeshLambertMaterial({ color: '#ffffff' })), fans.length);
  fans.forEach((_, i) => {
    torsos.setColorAt(i, color.set(PALETTE[(i * 7 + (i >> 5)) % PALETTE.length]!));
    heads.setColorAt(i, color.set(SKIN[i % SKIN.length]!));
  });
  torsos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  torsos.frustumCulled = false;
  heads.frustumCulled = false;
  g.add(torsos, heads);

  // ---- flags on the stand rails: hinged at the pole, waving out of step
  const flagGeo = keep(new THREE.PlaneGeometry(0.9, 0.55).translate(0.45, 0, 0));
  const poleGeo = keep(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5).translate(0, -0.45, 0));
  type Flag = { x: number; z: number; side: number; ph: number };
  const flagsAt: Flag[] = [];
  for (let x = -26; x < 450; x += 6.5) for (const side of [1, -1]) flagsAt.push({ x: x + (side > 0 ? 3 : 0), z: side * (o.laneW + 6.0), side, ph: noise(flagsAt.length, 7) * 6.28 });
  const flags = new THREE.InstancedMesh(flagGeo, keep(new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide })), flagsAt.length);
  const poles = new THREE.InstancedMesh(poleGeo, keep(new THREE.MeshLambertMaterial({ color: '#2a2833' })), flagsAt.length);
  flagsAt.forEach((f, i) => {
    flags.setColorAt(i, color.set(PALETTE[(i * 3 + 2) % PALETTE.length]!));
    dummy.position.set(f.x, 4.3, f.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
  });
  flags.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flags.frustumCulled = false;
  g.add(flags, poles);

  // ---- camera flashes in the crowd
  const FLASHES = 48;
  const flashes = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.16, 6, 4)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff' })), FLASHES);
  flashes.frustumCulled = false;
  const flashLife = new Float32Array(FLASHES);
  const flashFan = new Int32Array(FLASHES);
  g.add(flashes);

  // ---- the sky: a blimp, three balloons, a flock
  const blimp = new THREE.Group();
  const blimpMat = keep(new THREE.MeshLambertMaterial({ color: '#f4f4f8' }));
  const hull = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 20, 12)), blimpMat);
  hull.scale.set(16, 4.6, 4.6);
  blimp.add(hull);
  const finMat = keep(new THREE.MeshLambertMaterial({ color: '#ff4fc8' }));
  for (const [ry, rz] of [[0, 0], [0, Math.PI / 2], [0, Math.PI], [0, -Math.PI / 2]] as const) {
    const fin = new THREE.Mesh(keep(new THREE.BoxGeometry(4, 3.4, 0.25)), finMat);
    fin.position.set(-14, 0, 0);
    fin.rotation.set(rz, ry, 0);
    fin.translateY(2.6);
    blimp.add(fin);
  }
  const gondola = new THREE.Mesh(keep(new THREE.BoxGeometry(4, 1.2, 1.6)), keep(new THREE.MeshLambertMaterial({ color: '#1d1238' })));
  gondola.position.set(1, -5, 0);
  blimp.add(gondola);
  // the blimp's banner: a canvas with the game's name on both sides
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffd12e';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#1d1238';
  ctx.font = '900 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAUNCH CONTROL', 256, 68);
  const bannerTex = keep(new THREE.CanvasTexture(cv));
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [1, -1]) {
    const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(16, 4)), keep(new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true })));
    banner.position.set(0, 0, side * 4.62);
    if (side < 0) banner.rotation.y = Math.PI;
    blimp.add(banner);
  }
  blimp.position.set(120, 64, 70);
  g.add(blimp);

  const balloons: { m: THREE.Group; x: number; y: number; z: number; ph: number }[] = [];
  const balloonCols = [['#ff4fc8', '#ffd12e'], ['#22e4ff', '#ffffff'], ['#c4f034', '#ff6a1a']];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const env = new THREE.Mesh(keep(new THREE.SphereGeometry(5, 16, 12)), keep(new THREE.MeshLambertMaterial({ color: balloonCols[i]![0] })));
    env.scale.y = 1.2;
    b.add(env);
    const band = new THREE.Mesh(keep(new THREE.TorusGeometry(4.9, 0.5, 6, 20)), keep(new THREE.MeshLambertMaterial({ color: balloonCols[i]![1] })));
    band.rotation.x = Math.PI / 2;
    b.add(band);
    const basket = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 1.1, 1.4)), keep(new THREE.MeshLambertMaterial({ color: '#8d5524' })));
    basket.position.y = -8;
    b.add(basket);
    const x = 60 + i * 140 + noise(i, 40) * 40;
    const z = (i % 2 ? 1 : -1) * (120 + noise(i, 41) * 80);
    const y = 50 + noise(i, 42) * 30;
    b.position.set(x, y, z);
    g.add(b);
    balloons.push({ m: b, x, y, z, ph: noise(i, 43) * 6 });
  }

  const BIRDS = 9;
  const wingGeo = keep(new THREE.BoxGeometry(0.9, 0.05, 0.28).translate(0.45, 0, 0));
  const birdMat = keep(new THREE.MeshLambertMaterial({ color: '#2a2833' }));
  const wingsL = new THREE.InstancedMesh(wingGeo, birdMat, BIRDS);
  const wingsR = new THREE.InstancedMesh(wingGeo, birdMat, BIRDS);
  wingsL.frustumCulled = false;
  wingsR.frustumCulled = false;
  g.add(wingsL, wingsR);
  let flockX = -40;

  // ---- two marshals at the line: arms up at green
  const marshalParts: { arm: THREE.Mesh; side: number }[] = [];
  const vest = keep(new THREE.MeshLambertMaterial({ color: '#ff6a1a' }));
  const dark = keep(new THREE.MeshLambertMaterial({ color: '#2a2833' }));
  const skinMat = keep(new THREE.MeshLambertMaterial({ color: '#e0ac69' }));
  for (const side of [1, -1]) {
    const m = new THREE.Group();
    const legs = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, 0.9, 0.24)), dark);
    legs.position.y = 0.45;
    const body = new THREE.Mesh(keep(new THREE.BoxGeometry(0.46, 0.7, 0.3)), vest);
    body.position.y = 1.25;
    const head = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 10, 8)), skinMat);
    head.position.y = 1.78;
    m.add(legs, body, head);
    for (const k of [1, -1]) {
      const arm = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.6, 0.12).translate(0, -0.3, 0)), vest);
      arm.position.set(0, 1.55, k * 0.3);
      m.add(arm);
      marshalParts.push({ arm, side: k });
    }
    m.position.set(2.5, 0, side * (o.laneW + 0.9));
    m.rotation.y = -Math.PI / 2;
    g.add(m);
  }
  let armsUp = 0;
  let armsGoal = 0;

  // ---- confetti
  const CONFETTI = 360;
  const conf = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(0.22, 0.14)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })), CONFETTI);
  conf.frustumCulled = false;
  conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < CONFETTI; i++) conf.setColorAt(i, color.set(PALETTE[(i % (PALETTE.length - 1)) + 1]!));
  const cp = new Float32Array(CONFETTI * 3);
  const cv3 = new Float32Array(CONFETTI * 3);
  const cLife = new Float32Array(CONFETTI);
  const cSpin = new Float32Array(CONFETTI);
  let cNext = 0;
  g.add(conf);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < CONFETTI; i++) conf.setMatrixAt(i, hidden);
  for (let i = 0; i < FLASHES; i++) flashes.setMatrixAt(i, hidden);

  let frame = 0;
  return {
    group: g,
    update(t, dt, excite, focusX) {
      frame++;
      // the crowd: a gentle bounce, a jump when excited (fans near the action jump hardest)
      for (let i = 0; i < fans.length; i++) {
        const f = fans[i]!;
        const near = Math.max(0, 1 - Math.abs(f.x - focusX) / 160);
        const amp = 0.035 + excite * (0.12 + 0.3 * near);
        const jump = Math.max(0, Math.sin(t * f.w + f.ph)) * amp;
        dummy.position.set(f.x, f.y + 0.38 + jump, f.z);
        dummy.rotation.set(Math.sin(t * 1.3 + f.ph) * 0.06, 0, Math.sin(t * 1.7 + f.ph) * 0.08 * (1 + excite));
        dummy.scale.setScalar(f.s);
        dummy.updateMatrix();
        torsos.setMatrixAt(i, dummy.matrix);
        dummy.position.y = f.y + 0.38 + jump + 0.42 * f.s;
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      }
      torsos.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      // flags flap (every other frame is plenty)
      if (frame % 2 === 0) {
        flagsAt.forEach((f, i) => {
          dummy.position.set(f.x, 4.55, f.z);
          dummy.rotation.set(0, (f.side > 0 ? 0 : Math.PI) + Math.sin(t * (2.6 + excite * 2) + f.ph) * 0.55, Math.sin(t * 5 + f.ph) * 0.05);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          flags.setMatrixAt(i, dummy.matrix);
        });
        flags.instanceMatrix.needsUpdate = true;
      }
      // camera flashes: more of them when the crowd is excited, near the action
      for (let i = 0; i < FLASHES; i++) {
        if (flashLife[i]! > 0) {
          flashLife[i]! -= dt;
          if (flashLife[i]! <= 0) flashes.setMatrixAt(i, hidden);
        } else if (Math.random() < dt * (0.25 + excite * 6)) {
          let k = Math.floor(Math.random() * fans.length);
          for (let tries = 0; tries < 4 && Math.abs(fans[k]!.x - focusX) > 120; tries++) k = Math.floor(Math.random() * fans.length);
          flashFan[i] = k;
          flashLife[i] = 0.07;
          const f = fans[k]!;
          dummy.position.set(f.x, f.y + 1.1, f.z - Math.sign(f.z) * 0.3);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          flashes.setMatrixAt(i, dummy.matrix);
        }
      }
      flashes.instanceMatrix.needsUpdate = true;
      // sky
      blimp.position.x = 120 + Math.sin(t * 0.03) * 160;
      blimp.position.y = 64 + Math.sin(t * 0.4) * 1.5;
      blimp.rotation.y = Math.cos(t * 0.03) > 0 ? 0 : Math.PI;
      for (const b of balloons) {
        b.m.position.set(b.x + Math.sin(t * 0.05 + b.ph) * 20, b.y + Math.sin(t * 0.3 + b.ph) * 3, b.z);
        b.m.rotation.y = t * 0.05 + b.ph;
      }
      flockX += dt * 9;
      if (flockX > focusX + 260) flockX = focusX - 160;
      for (let i = 0; i < BIRDS; i++) {
        const row = Math.ceil(i / 2);
        const s = i % 2 ? 1 : -1;
        const flap = Math.sin(t * 9 + i) * 0.6;
        dummy.position.set(flockX - row * 2.2, 34 + Math.sin(t * 0.7 + i) * 0.4, -40 + s * row * 1.8);
        dummy.scale.setScalar(1);
        dummy.rotation.set(flap, 0, 0);
        dummy.updateMatrix();
        wingsL.setMatrixAt(i, dummy.matrix);
        dummy.rotation.set(-flap, Math.PI, 0);
        dummy.updateMatrix();
        wingsR.setMatrixAt(i, dummy.matrix);
      }
      wingsL.instanceMatrix.needsUpdate = true;
      wingsR.instanceMatrix.needsUpdate = true;
      // marshals
      armsUp += (armsGoal - armsUp) * Math.min(1, dt * 10);
      for (const p of marshalParts) p.arm.rotation.x = p.side * (0.15 + armsUp * 2.6) + Math.sin(t * 8) * 0.15 * armsUp;
      // confetti: falls, flutters, fades out of the world
      let live = false;
      for (let i = 0; i < CONFETTI; i++) {
        if (cLife[i]! <= 0) continue;
        live = true;
        cLife[i]! -= dt;
        const j = i * 3;
        cv3[j + 1]! -= 9 * dt;
        for (let k = 0; k < 3; k++) cv3[j + k]! *= 1 - Math.min(1, dt * 1.6);
        cv3[j + 1] = Math.max(cv3[j + 1]!, -2.2);
        cp[j]! += (cv3[j]! + Math.sin(t * 6 + i) * 0.6) * dt;
        cp[j + 1]! += cv3[j + 1]! * dt;
        cp[j + 2]! += cv3[j + 2]! * dt;
        if (cLife[i]! <= 0 || cp[j + 1]! < 0) {
          cLife[i] = 0;
          conf.setMatrixAt(i, hidden);
          continue;
        }
        dummy.position.set(cp[j]!, cp[j + 1]!, cp[j + 2]!);
        dummy.rotation.set(t * cSpin[i]!, t * cSpin[i]! * 0.7, t * 3);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        conf.setMatrixAt(i, dummy.matrix);
      }
      if (live) conf.instanceMatrix.needsUpdate = true;
    },
    marshals(up) {
      armsGoal = up ? 1 : 0;
    },
    confetti(x, count = 240) {
      for (let n = 0; n < count; n++) {
        const i = cNext;
        cNext = (cNext + 1) % CONFETTI;
        const j = i * 3;
        const side = n % 2 ? 1 : -1;
        cp[j] = x + (Math.random() - 0.5) * 1.5;
        cp[j + 1] = 1 + Math.random() * 0.4;
        cp[j + 2] = side * (o.laneW + 0.8);
        cv3[j] = (Math.random() - 0.3) * 5;
        cv3[j + 1] = 8 + Math.random() * 7;
        cv3[j + 2] = -side * (3 + Math.random() * 7);
        cLife[i] = 3 + Math.random() * 2;
        cSpin[i] = 4 + Math.random() * 8;
      }
    },
    dispose() {
      for (const d of trash) d.dispose();
      torsos.dispose();
      heads.dispose();
      flags.dispose();
      poles.dispose();
      flashes.dispose();
      wingsL.dispose();
      wingsR.dispose();
      conf.dispose();
    },
  };
}
