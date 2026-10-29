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

// Tubo com espessura que afina ao longo do caminho (hastes e argolas arredondadas)
function taperTube(points3, r0, r1, { closed = false, seg = 96, radial = 24, zScale = 0.72 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points3, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, closed);
  const pos = g.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / (radial + 1)) / seg;
    curve.getPointAt(Math.min(1, t), c);
    v.fromBufferAttribute(pos, i).sub(c);
    const r = r0 + (r1 - r0) * t;
    v.multiplyScalar(r);
    v.z *= zScale;
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.computeVertexNormals();
  return g;
}
const ellipsePts = (cx, cy, rx, ry, rot, n = 64) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return new THREE.Vector3(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), 0);
});

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

  // Haste curva até a argola (seção redonda, afinando)
  const ringC = V(-1.18, -0.42 * s);
  const P = (x, y) => new THREE.Vector3(x, y, 0);
  const shankGeo = taperTube([P(-0.05, -0.01 * s), P(-0.45, -0.08 * s), P(-0.78, -0.24 * s), P(ringC.x + 0.25, ringC.y + 0.12 * s)], 0.105, 0.075);
  const shankMesh = new THREE.Mesh(shankGeo, mirror);

  // Argola oval com seção redonda
  const ringMesh = new THREE.Mesh(taperTube(ellipsePts(ringC.x, ringC.y, 0.31, 0.245, -0.25 * s), 0.07, 0.07, { closed: true, seg: 128 }), mirror);

  bladeMesh.position.z = -0.018;
  bossMesh.position.z = -0.018;
  g.add(bladeMesh, bossMesh, shankMesh, ringMesh);

  // Apoio de dedo (só na peça de cima, como nas tesouras de barbeiro)
  if (s > 0) {
    const spurGeo = taperTube([P(ringC.x - 0.12, ringC.y - 0.26), P(ringC.x - 0.36, ringC.y - 0.42), P(ringC.x - 0.62, ringC.y - 0.47)], 0.05, 0.03, { seg: 48 });
    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.042, 32, 20), mirror);
    tipBall.position.set(ringC.x - 0.63, ringC.y - 0.47, 0);
    tipBall.scale.z = 0.72;
    g.add(new THREE.Mesh(spurGeo, mirror), tipBall);
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
