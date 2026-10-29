/* Mesa de sinuca 3D com a tacada inicial simulada.
   A física roda uma vez no carregamento (determinística) e grava os quadros;
   o scroll só escolhe qual quadro mostrar — dá para "voltar a fita". */
import * as THREE from 'three';

const R = 0.11;                 // raio da bola
const HW = 2.5, HH = 1.3;       // meia largura/altura da área de jogo
const BALL_COLORS = ['#f2c014', '#1f4fbf', '#d62828', '#5b2a86', '#f07c19', '#11804a', '#7a1f1f', '#111111'];
const POCKETS = [
  [-HW, -HH, 0.22], [0, -HH - 0.04, 0.19], [HW, -HH, 0.22],
  [-HW, HH, 0.22], [0, HH + 0.04, 0.19], [HW, HH, 0.22],
];

/* ---------- Simulação ---------- */
function simulate() {
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const balls = [{ n: 0, x: -1.55, y: 0.0, vx: 0, vy: 0, sunk: -1 }];
  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      balls.push({
        n: order[idx++],
        x: 0.95 + row * (2 * R * 0.8661 + 0.003),
        y: (j - row / 2) * (2 * R + 0.003),
        vx: 0, vy: 0, sunk: -1,
      });
    }
  }
  balls[0].vx = 12.5;
  balls[0].vy = 0.06;

  const quats = balls.map(() => new THREE.Quaternion());
  const FPS = 60, SUB = 12, SECONDS = 5;
  const frames = [];
  const dt = 1 / (FPS * SUB);
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const qStep = new THREE.Quaternion();
  const prev = balls.map((b) => ({ x: b.x, y: b.y }));

  for (let f = 0; f < FPS * SECONDS; f++) {
    for (let s = 0; s < SUB; s++) {
      // movimento + atrito
      for (const b of balls) {
        if (b.sunk >= 0) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) {
          const ns = Math.max(0, sp - 1.6 * dt);
          b.vx *= ns / sp;
          b.vy *= ns / sp;
        }
        // caçapas
        for (const [px, py, pr] of POCKETS) {
          if (Math.hypot(b.x - px, b.y - py) < pr) { b.sunk = f; b.px = px; b.py = py; b.vx = b.vy = 0; break; }
        }
        if (b.sunk >= 0) continue;
        // tabelas
        if (b.x > HW - R) { b.x = HW - R; b.vx = -Math.abs(b.vx) * 0.78; }
        if (b.x < -HW + R) { b.x = -HW + R; b.vx = Math.abs(b.vx) * 0.78; }
        if (b.y > HH - R) { b.y = HH - R; b.vy = -Math.abs(b.vy) * 0.78; }
        if (b.y < -HH + R) { b.y = -HH + R; b.vy = Math.abs(b.vy) * 0.78; }
      }
      // colisões entre bolas (elásticas, massas iguais)
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.sunk >= 0) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.sunk >= 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < 2 * R) {
            const nx = dx / d, ny = dy / d;
            const overlap = 2 * R - d;
            a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2; b.y += ny * overlap / 2;
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel > 0) {
              const imp = rel * 0.96;
              a.vx -= imp * nx; a.vy -= imp * ny;
              b.vx += imp * nx; b.vy += imp * ny;
            }
          }
        }
      }
    }
    // grava quadro: x, y, quaternion, afundou?
    const fr = new Float32Array(balls.length * 7);
    balls.forEach((b, i) => {
      const dx = b.x - prev[i].x, dy = b.y - prev[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) {
        axis.set(dy, 0, -dx).normalize();
        qStep.setFromAxisAngle(axis, dist / R);
        quats[i].premultiply(qStep);
      }
      prev[i].x = b.x; prev[i].y = b.y;
      const sunkT = b.sunk >= 0 ? Math.min(1, (f - b.sunk) / 12) : 0;
      const x = b.sunk >= 0 ? b.x + (b.px - b.x) * sunkT : b.x;
      const y = b.sunk >= 0 ? b.y + (b.py - b.y) * sunkT : b.y;
      fr.set([x, y, quats[i].x, quats[i].y, quats[i].z, quats[i].w, sunkT], i * 7);
    });
    frames.push(fr);
  }
  return { balls, frames };
}

/* ---------- Texturas das bolas ---------- */
function ballTexture(n) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const col = n === 0 ? '#f4f1ea' : BALL_COLORS[(n - 1) % 8];
  const stripe = n > 8;
  ctx.fillStyle = stripe ? '#f4f1ea' : col;
  ctx.fillRect(0, 0, 256, 128);
  if (stripe) { ctx.fillStyle = col; ctx.fillRect(0, 34, 256, 60); }
  if (n > 0) {
    for (const cx of [64, 192]) {
      ctx.fillStyle = '#f4f1ea';
      ctx.beginPath(); ctx.ellipse(cx, 64, 20, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), cx, 65);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPool(renderer) {
  const group = new THREE.Group();   // inclinação/posição (controlado pelo main)
  const table = new THREE.Group();   // gira 90° no celular
  group.add(table);

  // Pano verde + tabelas pretas com friso vermelho
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.1, 0.1, HH * 2 + 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0b5e32, roughness: 1, metalness: 0 }),
  );
  felt.position.y = -0.05;
  table.add(felt);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55, metalness: 0.1 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x0a5530, roughness: 1 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe02b2b, roughness: 0.4 });
  const T = 0.32;
  const rails = [
    [HW * 2 + T * 2 + 0.1, HH + T / 2 + 0.05, 0],
    [HW * 2 + T * 2 + 0.1, -(HH + T / 2 + 0.05), 0],
    [HH * 2 + 0.1, HW + T / 2 + 0.05, 1],
    [HH * 2 + 0.1, -(HW + T / 2 + 0.05), 1],
  ];
  for (const [len, off, vertical] of rails) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, T), railMat);
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, 0.12, 0.08), cushionMat);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.05), stripeMat);
    rail.position.y = 0.04; cushion.position.y = 0.04; stripe.position.y = 0.155;
    stripe.position.z = Math.sign(off) * (T / 2 - 0.05);
    cushion.position.z = -Math.sign(off) * (T / 2);
    const holder = new THREE.Group();
    holder.add(rail, cushion, stripe);
    if (vertical) { holder.rotation.y = Math.PI / 2; holder.position.x = off; }
    else holder.position.z = off;
    table.add(holder);
  }
  const pocketMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  for (const [px, py, pr] of POCKETS) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(pr * 0.9, 32), pocketMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.003, py);
    table.add(p);
  }

  // Bolas
  const { balls, frames } = simulate();
  const ballGeo = new THREE.SphereGeometry(R, 40, 28);
  const meshes = balls.map((b) => {
    const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({
      map: ballTexture(b.n), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
    }));
    table.add(m);
    return m;
  });

  // Taco
  const cue = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.05, 3.6, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9b27c, roughness: 0.45 }),
  );
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = -1.8;
  const butt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.055, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.3, metalness: 0.2 }),
  );
  butt.rotation.z = Math.PI / 2;
  butt.position.x = -3.0;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.08, 24), stripeMat);
  band.rotation.z = Math.PI / 2;
  band.position.x = -2.38;
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.04, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f5fa8, roughness: 0.8 }),
  );
  tip.rotation.z = Math.PI / 2;
  tip.position.x = 0.0;
  cue.add(shaft, butt, band, tip);
  cue.rotation.z = -0.08; // cabo um pouco mais alto
  table.add(cue);

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const N = frames.length;
  const STRIKE = 0.26;
  const ease = (t) => t * t * (3 - 2 * t);

  /** p: 0..1 (progresso do scroll dentro da seção) */
  function update(p) {
    // 1) taco recua e avança até a bola branca
    let gap;
    if (p < 0.17) gap = 0.25 + 0.75 * ease(p / 0.17);
    else if (p < STRIKE) gap = 1.0 * (1 - Math.pow((p - 0.17) / (STRIKE - 0.17), 2));
    else gap = -0.12 - Math.min(1, (p - STRIKE) * 4) * 0.25 + Math.max(0, p - 0.45) * 3;

    // 2) depois da tacada, mostra os quadros da simulação
    const f = p <= STRIKE ? 0 : Math.min(N - 1, ((p - STRIKE) / 0.62) * (N - 1));
    const f0 = Math.floor(f), f1 = Math.min(N - 1, f0 + 1), k = f - f0;
    const A = frames[f0], B = frames[f1];
    meshes.forEach((m, i) => {
      const o = i * 7;
      const x = A[o] + (B[o] - A[o]) * k;
      const y = A[o + 1] + (B[o + 1] - A[o + 1]) * k;
      const s = A[o + 6] + (B[o + 6] - A[o + 6]) * k;
      m.position.set(x, R - s * R * 2.2, y);
      m.scale.setScalar(1 - s * 0.35);
      m.visible = s < 0.999;
      qa.set(A[o + 2], A[o + 3], A[o + 4], A[o + 5]);
      qb.set(B[o + 2], B[o + 3], B[o + 4], B[o + 5]);
      m.quaternion.slerpQuaternions(qa, qb, k);
    });

    const cb = frames[0];
    cue.position.set(cb[0] - R - 0.02 - gap, R + 0.06, cb[1]);
    cue.visible = gap < 2.6;
  }
  update(0);

  return { group, table, update };
}
