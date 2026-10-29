/* Copão: copo plástico suado, drink em degradê girando, gelo boiando e canudo */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const Y0 = -1.6, Y1 = 1.6;      // fundo e borda do copo
const R0 = 0.74, R1 = 1.06;     // raio no fundo e na boca
const LIQ = 0.95;               // altura do líquido
const cupR = (y) => R0 + (R1 - R0) * ((y - Y0) / (Y1 - Y0));

/* Textura da condensação: pontinhos brancos, mais densos embaixo, + marca no copo */
function frostTexture() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const liquidV = (LIQ - Y0) / (Y1 - Y0); // fração da altura com líquido
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * W;
    const v = Math.pow(Math.random(), 0.8) * liquidV * 1.05; // concentra até a linha do líquido
    const y = H - v * H;
    const r = 0.6 + Math.random() * 2.2;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.28})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Escorridos verticais
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * W;
    const y0 = H - Math.random() * liquidV * H;
    const len = 40 + Math.random() * 180;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 2 + Math.random() * 2, len);
  }
  // Marca impressa no copo (u = 0.5 fica de frente)
  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '900 92px "Archivo Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DIKEBRAS', 0, 0);
  ctx.fillStyle = 'rgba(224,43,43,0.95)';
  ctx.fillRect(-150, 52, 300, 12);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createDrink() {
  const group = new THREE.Group();
  const cup = new THREE.Group();
  group.add(cup);

  /* Copo */
  const wallPts = [[0, Y0], [R0, Y0], [R0 + 0.02, Y0 + 0.03], [R1, Y1 - 0.04], [R1 + 0.03, Y1]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(wallPts, 96, Math.PI),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.2, clearcoat: 1,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
    }),
  );
  shell.renderOrder = 3;
  cup.add(shell);

  const frost = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(R0 + 0.03, Y0 + 0.03), new THREE.Vector2(R1 + 0.012, Y1 - 0.04)], 96, Math.PI),
    new THREE.MeshStandardMaterial({ map: frostTexture(), transparent: true, depthWrite: false, roughness: 0.3 }),
  );
  frost.renderOrder = 4;
  cup.add(frost);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R1 + 0.03, 0.025, 12, 96),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.1 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = Y1;
  cup.add(rim);

  /* Líquido com degradê (vermelho em cima, laranja embaixo) */
  const liqPts = [];
  for (let i = 0; i <= 20; i++) {
    const y = Y0 + 0.05 + (LIQ - Y0 - 0.05) * (i / 20);
    liqPts.push(new THREE.Vector2(cupR(y) - 0.035, y));
  }
  liqPts.unshift(new THREE.Vector2(0, Y0 + 0.05));
  const liqGeo = new THREE.LatheGeometry(liqPts, 72);
  const colTop = new THREE.Color('#d9123a'), colBot = new THREE.Color('#ff8a1f'), tmp = new THREE.Color();
  const pos = liqGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep(pos.getY(i), Y0 + 0.3, 0.2);
    tmp.copy(colBot).lerp(colTop, k);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  liqGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const liquid = new THREE.Mesh(liqGeo, new THREE.MeshPhysicalMaterial({
    vertexColors: true, transparent: true, opacity: 0.88, roughness: 0.08, clearcoat: 0.6,
    emissive: 0x5a0010, emissiveIntensity: 0.35,
  }));
  liquid.renderOrder = 1;
  cup.add(liquid);

  // Superfície com ondas (anéis concêntricos para poder deformar)
  const topR = cupR(LIQ) - 0.035;
  const surfGeo = new THREE.RingGeometry(0.001, topR, 64, 14);
  const surfBase = surfGeo.attributes.position.array.slice();
  const surface = new THREE.Mesh(surfGeo, new THREE.MeshPhysicalMaterial({
    color: 0xe0163f, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.95,
    emissive: 0x4a0010, emissiveIntensity: 0.3, side: THREE.DoubleSide,
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = LIQ;
  cup.add(surface);

  /* Gelo */
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff, transparent: true, opacity: 0.55, roughness: 0.06, clearcoat: 1,
    envMapIntensity: 2, depthWrite: false,
  });
  const ices = [0, 1, 2, 3].map((i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.46, 0.48, 3, 0.07), iceMat);
    m.userData = { a: (i / 4) * Math.PI * 2, r: 0.34 + (i % 2) * 0.12, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()) };
    m.renderOrder = 2;
    cup.add(m);
    return m;
  });

  /* Canudo */
  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 4.0, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff3d8b, roughness: 0.35, side: THREE.DoubleSide }),
  );
  straw.position.set(0.32, 0.75, -0.15);
  straw.rotation.z = -0.24;
  cup.add(straw);

  /* Bolhinhas subindo dentro do líquido */
  const BUB = 40;
  const bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd0b0, transparent: true, opacity: 0.5 }),
    BUB,
  );
  const bubData = Array.from({ length: BUB }, () => ({
    a: Math.random() * Math.PI * 2, r: Math.random() * 0.6, y: Y0 + Math.random() * (LIQ - Y0), s: 0.012 + Math.random() * 0.02, v: 0.2 + Math.random() * 0.5,
  }));
  cup.add(bubbles);

  /* Gotas de condensação (algumas escorrem) */
  const DROPS = 340;
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, roughness: 0, clearcoat: 1, envMapIntensity: 2.2 }),
    DROPS,
  );
  drops.renderOrder = 5;
  const dropData = Array.from({ length: DROPS }, () => {
    const runs = Math.random() < 0.22;
    return {
      a: Math.random() * Math.PI * 2,
      y: Y0 + 0.1 + Math.pow(Math.random(), 0.7) * (LIQ + 0.2 - Y0),
      s: runs ? 0.03 + Math.random() * 0.02 : 0.01 + Math.random() * 0.022,
      v: runs ? 0.08 + Math.random() * 0.2 : 0,
    };
  });
  cup.add(drops);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), e = new THREE.Euler();

  /** stir: 0..1 intensidade de mexer o drink */
  function update(dt, t, stir) {
    // Ondas na superfície
    const arr = surfGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = surfBase[i], y = surfBase[i + 1];
      const r = Math.hypot(x, y), th = Math.atan2(y, x);
      arr[i + 2] = (Math.sin(r * 7 - t * 3.2 + th * 2) * 0.025 + Math.sin(th * 3 + t * 2.1) * 0.02 * r) * (0.4 + stir);
    }
    surfGeo.attributes.position.needsUpdate = true;
    surfGeo.computeVertexNormals();

    // Gelo girando em volta do centro (redemoinho)
    ices.forEach((m, i) => {
      const d = m.userData;
      d.a += dt * (0.25 + stir * 1.1);
      m.position.set(Math.cos(d.a) * d.r, LIQ - 0.1 + Math.sin(t * 1.7 + i) * 0.05, Math.sin(d.a) * d.r);
      m.rotation.x += d.spin.x * dt * (0.2 + stir);
      m.rotation.y += d.spin.y * dt * (0.3 + stir);
      m.rotation.z += d.spin.z * dt * 0.2;
    });
    straw.rotation.x = Math.sin(t * 0.9) * 0.05 * (0.5 + stir);

    // Bolhas
    bubData.forEach((b, i) => {
      b.y += b.v * dt;
      b.a += dt * (0.3 + stir);
      if (b.y > LIQ - 0.05) { b.y = Y0 + 0.1; b.r = Math.random() * 0.6; }
      p3.set(Math.cos(b.a) * b.r, b.y, Math.sin(b.a) * b.r);
      s3.setScalar(b.s);
      m4.compose(p3, q.identity(), s3);
      bubbles.setMatrixAt(i, m4);
    });
    bubbles.instanceMatrix.needsUpdate = true;

    // Gotas na parede de fora
    dropData.forEach((d, i) => {
      if (d.v) {
        d.y -= d.v * dt;
        if (d.y < Y0 + 0.05) { d.y = LIQ + 0.1 - Math.random() * 0.6; d.a = Math.random() * Math.PI * 2; }
      }
      const r = cupR(d.y) + 0.015 + d.s * 0.4;
      p3.set(Math.sin(d.a) * r, d.y, Math.cos(d.a) * r);
      e.set(0, d.a, 0);
      q.setFromEuler(e);
      s3.set(d.s, d.s * (d.v ? 1.6 : 1.15), d.s * 0.55);
      m4.compose(p3, q, s3);
      drops.setMatrixAt(i, m4);
    });
    drops.instanceMatrix.needsUpdate = true;
  }

  return { group, cup, update };
}
