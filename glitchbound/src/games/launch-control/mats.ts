/** Materials, mesh helpers and static-mesh merging shared by the world and the car builders. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- materials
export const cache = new Map<string, THREE.Material>();
export const std = (color: string, o: { metal?: number; rough?: number; emissive?: string; ei?: number } = {}): THREE.MeshStandardMaterial => {
  const key = `s|${color}|${o.metal ?? 0}|${o.rough ?? 0.7}|${o.emissive ?? ''}|${o.ei ?? 1}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.7, emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 1 });
    cache.set(key, m);
  }
  return m;
};
export const lam = (color: string): THREE.MeshLambertMaterial => {
  const key = `l|${color}`;
  let m = cache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    cache.set(key, m);
  }
  return m;
};
export const CHROME = (): THREE.MeshStandardMaterial => std('#f2f2f6', { metal: 1, rough: 0.15 });
export const TRIM = (): THREE.MeshStandardMaterial => std('#22212a', { rough: 0.55 });
export const RUBBER = (): THREE.MeshStandardMaterial => std('#1a1a1f', { rough: 0.92 });
export const LAMP = (): THREE.MeshStandardMaterial => std('#ffffff', { emissive: '#fff4d0', ei: 1.4, rough: 0.05 });
export const DRL = (): THREE.MeshStandardMaterial => std('#bff6ff', { emissive: '#9ef0ff', ei: 1.6, rough: 0.05 });
export const TAIL = (): THREE.MeshStandardMaterial => std('#ff2236', { emissive: '#ff1a2e', ei: 1.3, rough: 0.1 });
export const GLASS = (): THREE.MeshPhysicalMaterial => {
  let m = cache.get('glass') as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: '#16233a', metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
    cache.set('glass', m);
  }
  return m;
};

export const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
};
export const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
export const ball = (rx: number, ry: number, rz: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh => {
  const o = mesh(new THREE.SphereGeometry(1, seg, Math.max(6, seg >> 1)), m, x, y, z);
  o.scale.set(rx, ry, rz);
  return o;
};
/** A rounded box (pillow): good for lamps, mirrors, scoops. */
export const pillow = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const g = new THREE.SphereGeometry(1, 16, 10);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const s = (c: number): number => Math.sign(c) * Math.pow(Math.abs(c), 0.45);
    p.setXYZ(i, s(v.x) * w * 0.5, s(v.y) * h * 0.5, s(v.z) * d * 0.5);
  }
  g.computeVertexNormals();
  return mesh(g, m, x, y, z);
};

/**
 * Merges the static meshes under `root` into one mesh per material (draw calls are what a phone
 * chokes on). Meshes for which `keep` returns true, and everything under them, stay as they are.
 */
export function mergeStatic(root: THREE.Object3D, keep: (o: THREE.Object3D) => boolean, shadows: { cast: boolean; receive: boolean }): THREE.BufferGeometry[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const victims: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D): void => {
    if (o !== root && keep(o)) return;
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && !Array.isArray(o.material)) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
      g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const list = buckets.get(o.material) ?? [];
      list.push(g);
      buckets.set(o.material, list);
      victims.push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  for (const v of victims) {
    v.removeFromParent();
    v.geometry.dispose();
  }
  const made: THREE.BufferGeometry[] = [];
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = shadows.cast;
    m.receiveShadow = shadows.receive;
    root.add(m);
    made.push(merged);
  }
  return made;
}


let blobTex: THREE.CanvasTexture | null = null;
export function blobTexture(): THREE.CanvasTexture {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(cv);
  return blobTex;
}
