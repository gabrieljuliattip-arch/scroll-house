/* Tesoura de barbeiro + navalha, tudo em aço cromado.
   Feitas em código: cada peça é um contorno 2D extrudado com borda
   arredondada; as lâminas afinam até o fio (afiação côncava). */
import * as THREE from 'three';
import { toCreasedNormals, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- Materiais ---------- */
const mirror = new THREE.MeshPhysicalMaterial({
  color: 0xf4f6f9, metalness: 1, roughness: 0.06, clearcoat: 0.4, clearcoatRoughness: 0.05,
});
const satin = new THREE.MeshPhysicalMaterial({
  color: 0xe9ecf0, metalness: 1, roughness: 0.2, anisotropy: 0.75, anisotropyRotation: 0,
});
const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0xb9bec6, metalness: 1, roughness: 0.32 });

/* ---------- Utilidades de forma ---------- */
const V = (x, y) => new THREE.Vector2(x, y);

// Faixa com largura variável ao longo de uma curva (hastes e apoio de dedo)
function bandShape(points, w0, w1) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => V(x, y)));
  const N = 40, left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t), tan = curve.getTangent(t);
    const n = V(-tan.y, tan.x);
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push(p.clone().addScaledVector(n, w));
    right.push(p.clone().addScaledVector(n, -w));
  }
  return new THREE.Shape([...left, ...right.reverse()]);
}

// Argola oval com furo
function ringShape(cx, cy, rx, ry, irx, iry, rot = 0) {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot);
  const h = new THREE.Path();
  h.absellipse(cx, cy, irx, iry, 0, Math.PI * 2, true, rot);
  s.holes.push(h);
  return s;
}

function extrude(shape, depth, bevel, segments = 40) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9,
    bevelSegments: 7, curveSegments: segments, steps: 1,
  });
}

// Afina a lâmina: perto do fio fica fina, perto das costas mantém a espessura
function grind(geo, { sign = 1, xMin = 0.25, minF = 0.1, power = 0.55 } = {}) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const zc = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
  const bins = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i) / 0.03), y = pos.getY(i) * sign;
    const b = bins.get(k) || { min: Infinity, max: -Infinity };
    b.min = Math.min(b.min, y); b.max = Math.max(b.max, y);
    bins.set(k, b);
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (x < xMin) continue;
    const b = bins.get(Math.round(x / 0.03));
    const t = THREE.MathUtils.clamp((pos.getY(i) * sign - b.min) / Math.max(1e-4, b.max - b.min), 0, 1);
    const ramp = THREE.MathUtils.smoothstep(x, xMin, xMin + 0.25); // transição suave no começo da lâmina
    const f = 1 - ramp * (1 - (minF + (1 - minF) * Math.pow(t, power)));
    pos.setZ(i, zc + (pos.getZ(i) - zc) * f);
  }
  pos.needsUpdate = true;
}

// Normais: as laterais/chanfros ficam lisas (arredondadas) e as faces da frente
// continuam planas — evita "riscos" de sombreamento nas faces grandes.
function smooth(geo, ground = false) {
  const parts = [];
  for (const g of geo.groups) {
    const sub = new THREE.BufferGeometry();
    for (const name of ['position', 'uv']) {
      const src = geo.attributes[name];
      if (!src) continue;
      const n = src.itemSize;
      sub.setAttribute(name, new THREE.BufferAttribute(src.array.slice(g.start * n, (g.start + g.count) * n), n));
    }
    const isSide = g.materialIndex === 1;
    if (isSide || ground) parts.push(toCreasedNormals(sub, isSide ? Math.PI / 3 : Math.PI / 6));
    else {
      const nrm = geo.attributes.normal;
      sub.setAttribute('normal', new THREE.BufferAttribute(nrm.array.slice(g.start * 3, (g.start + g.count) * 3), 3));
      parts.push(sub);
    }
  }
  return mergeGeometries(parts, false);
}

// Cabeça de parafuso abaulada (meia esfera achatada, voltada para +y)
function screwHead(r, h) {
  const g = new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, h / r, 1);
  return g;
}

/* ---------- Tesoura ---------- */
function shearPiece(sign) {
  const g = new THREE.Group();
  const s = sign; // +1: lâmina de cima, argola de baixo

  // Lâmina: fio quase reto, costas curvas, ponta arredondada
  const blade = new THREE.Shape();
  blade.moveTo(-0.2, -0.02 * s);
  blade.lineTo(0.05, -0.03 * s);
  blade.quadraticCurveTo(1.3, -0.05 * s, 2.34, 0.0 * s);
  blade.quadraticCurveTo(2.42, 0.03 * s, 2.32, 0.07 * s);
  blade.bezierCurveTo(1.7, 0.15 * s, 0.7, 0.24 * s, 0.1, 0.23 * s);
  blade.quadraticCurveTo(-0.22, 0.22 * s, -0.24, 0.05 * s);
  blade.closePath();
  const bladeGeo = extrude(blade, 0.022, 0.014, 64);
  grind(bladeGeo, { sign: s, xMin: 0.3, minF: 0.12 });
  const bladeMesh = new THREE.Mesh(smooth(bladeGeo, true), mirror);

  // Disco do pivô
  const boss = new THREE.Shape();
  boss.absarc(0, 0, 0.19, 0, Math.PI * 2, false);
  const bossMesh = new THREE.Mesh(smooth(extrude(boss, 0.03, 0.016)), mirror);

  // Haste curva até a argola
  const ringC = V(-1.18, -0.42 * s);
  const shank = bandShape([[-0.12, -0.02 * s], [-0.55, -0.12 * s], [-0.86, -0.3 * s], [ringC.x + 0.28, ringC.y + 0.08 * s]], 0.17, 0.12);
  const shankMesh = new THREE.Mesh(smooth(extrude(shank, 0.034, 0.018)), mirror);

  // Argola
  const ring = ringShape(ringC.x, ringC.y, 0.36, 0.29, 0.25, 0.185, -0.25 * s);
  const ringMesh = new THREE.Mesh(smooth(extrude(ring, 0.036, 0.022, 64)), mirror);

  [bladeMesh, bossMesh, shankMesh, ringMesh].forEach((m) => { m.position.z = -0.018; });
  g.add(bladeMesh, bossMesh, shankMesh, ringMesh);

  // Apoio de dedo (só na peça de cima, como nas tesouras de barbeiro)
  if (s > 0) {
    const spur = bandShape([[ringC.x - 0.2, ringC.y - 0.24], [ringC.x - 0.42, ringC.y - 0.42], [ringC.x - 0.66, ringC.y - 0.44]], 0.09, 0.05);
    const spurMesh = new THREE.Mesh(smooth(extrude(spur, 0.03, 0.016)), mirror);
    spurMesh.position.z = -0.016;
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), mirror);
    tipBall.position.set(ringC.x - 0.68, ringC.y - 0.44, 0);
    g.add(spurMesh, tipBall);
  }
  g.position.z = 0.036 * s;
  return g;
}

/* ---------- Navalha ---------- */
function buildRazor() {
  const razor = new THREE.Group();

  // Cabo: duas placas levemente curvas, aço escovado
  const scale = new THREE.Shape();
  scale.moveTo(0, -0.13);
  scale.quadraticCurveTo(1.3, -0.21, 2.55, -0.1);
  scale.quadraticCurveTo(2.74, 0.01, 2.55, 0.12);
  scale.quadraticCurveTo(1.3, 0.05, 0, 0.15);
  scale.quadraticCurveTo(-0.18, 0.01, 0, -0.13);
  const scaleGeo = smooth(extrude(scale, 0.026, 0.02));
  const front = new THREE.Mesh(scaleGeo, satin);
  front.position.z = 0.04;
  const back = new THREE.Mesh(scaleGeo, satin);
  back.position.z = -0.066;
  // Espaçador no fundo do cabo
  const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24), darkSteel);
  wedge.rotation.x = Math.PI / 2;
  wedge.position.x = 2.45;

  // Pinos com cabeça abaulada dos dois lados
  const headGeo = screwHead(0.07, 0.03);
  [[0, 0], [2.45, 0]].forEach(([x, y]) => {
    const a = new THREE.Mesh(headGeo, mirror);
    a.rotation.x = Math.PI / 2; a.position.set(x, y, 0.086);
    const b = new THREE.Mesh(headGeo, mirror);
    b.rotation.x = -Math.PI / 2; b.position.set(x, y, -0.086);
    razor.add(a, b);
  });

  // Lâmina: espiga, fio curvo, ponta redonda; afiação côncava
  const bl = new THREE.Shape();
  bl.moveTo(-0.2, 0.0);
  bl.quadraticCurveTo(-0.2, -0.07, -0.05, -0.07);
  bl.lineTo(0.42, -0.08);
  bl.quadraticCurveTo(1.3, -0.29, 2.16, -0.22);
  bl.bezierCurveTo(2.34, -0.2, 2.36, 0.1, 2.2, 0.14);
  bl.lineTo(0.55, 0.14);
  bl.quadraticCurveTo(0.38, 0.14, 0.32, 0.08);
  bl.lineTo(-0.05, 0.07);
  bl.quadraticCurveTo(-0.2, 0.07, -0.2, 0.0);
  const blGeo = extrude(bl, 0.03, 0.01, 64);
  grind(blGeo, { sign: 1, xMin: 0.45, minF: 0.07, power: 0.5 });
  const bladeMesh = new THREE.Mesh(smooth(blGeo, true), mirror);
  bladeMesh.position.z = -0.015;
  const hinge = new THREE.Group();
  hinge.add(bladeMesh);

  razor.add(front, back, wedge, hinge);
  return { razor, hinge };
}

export function createTools() {
  const group = new THREE.Group();

  const pieceA = shearPiece(1);
  const pieceB = shearPiece(-1);
  const screwA = new THREE.Mesh(screwHead(0.1, 0.045), mirror);
  screwA.rotation.x = Math.PI / 2;
  screwA.position.z = 0.072;
  const screwB = screwA.clone();
  screwB.rotation.x = -Math.PI / 2;
  screwB.position.z = -0.072;

  const scissors = new THREE.Group();
  scissors.add(pieceA, pieceB, screwA, screwB);
  scissors.position.x = -0.45;
  const scissorsHolder = new THREE.Group();
  scissorsHolder.add(scissors);
  scissorsHolder.rotation.z = 0.6;
  scissorsHolder.position.z = 0.22;
  group.add(scissorsHolder);

  const { razor, hinge } = buildRazor();
  razor.position.x = -0.25;
  const razorHolder = new THREE.Group();
  razorHolder.add(razor);
  razorHolder.rotation.z = Math.PI - 0.6;
  razorHolder.position.z = -0.22;
  group.add(razorHolder);

  /** snip 0..1 abre a tesoura; open 0..1 abre a navalha */
  function update(snip, open) {
    const a = 0.03 + snip * 0.5;
    pieceA.rotation.z = a / 2;
    pieceB.rotation.z = -a / 2;
    hinge.rotation.z = Math.PI * open;
  }

  return { group, update };
}
