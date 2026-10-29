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
  balls[0].vx = 14.5;
  balls[0].vy = 0.07;

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

/* ---------- Texturas ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Bola: faixa (listradas) + círculo branco com número dos dois lados
function ballTexture(n) {
  return canvasTex(1024, 512, (ctx, W, H) => {
    const col = n === 0 ? '#f5f1e8' : BALL_COLORS[(n - 1) % 8];
    const stripe = n > 8;
    ctx.fillStyle = stripe ? '#f5f1e8' : col;
    ctx.fillRect(0, 0, W, H);
    if (stripe) { ctx.fillStyle = col; ctx.fillRect(0, H * 0.27, W, H * 0.46); }
    if (n === 0) { // pontinho vermelho da bola branca
      ctx.fillStyle = '#c62020';
      [W * 0.25, W * 0.75].forEach((x) => { ctx.beginPath(); ctx.arc(x, H / 2, 10, 0, Math.PI * 2); ctx.fill(); });
    }
    if (n > 0) {
      for (const cx of [W * 0.25, W * 0.75]) {
        ctx.fillStyle = '#f5f1e8';
        ctx.beginPath(); ctx.ellipse(cx, H / 2, 64, 70, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#141414';
        ctx.font = 'bold 74px "Archivo Black", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), cx, H / 2 + 4);
        if (n === 6 || n === 9) ctx.fillRect(cx - 20, H / 2 + 42, 40, 6);
      }
    }
  });
}

// Feltro: verde com fibrinhas (cor) e relevo (bump)
function feltTextures() {
  const draw = (ctx, W, H, bump) => {
    ctx.fillStyle = bump ? '#808080' : '#0a5a30';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) {
      const x = Math.random() * W, y = Math.random() * H, l = 2 + Math.random() * 6, a = Math.random() * Math.PI;
      const v = Math.random();
      ctx.strokeStyle = bump ? `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},0.25)`
        : `rgba(${v > 0.5 ? 40 : 0},${v > 0.5 ? 140 : 50},${v > 0.5 ? 80 : 25},0.22)`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  };
  const map = canvasTex(1024, 1024, (c, W, H) => draw(c, W, H, false));
  const bump = canvasTex(1024, 1024, (c, W, H) => draw(c, W, H, true), false);
  [map, bump].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.6); });
  return { map, bump };
}

// Madeira escura (mogno) com veios
function woodTexture(base = '#3a1a10', vein = 'rgba(15,5,2,0.5)') {
  const t = canvasTex(1024, 256, (ctx, W, H) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * H, amp = 2 + Math.random() * 6, f = 0.004 + Math.random() * 0.01, ph = Math.random() * 10;
      ctx.strokeStyle = Math.random() > 0.3 ? vein : 'rgba(120,60,30,0.25)';
      ctx.lineWidth = 0.5 + Math.random() * 2.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin(x * f + ph) * amp;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Moldura arredondada (contorno externo com furo interno), deitada no plano XZ
function frameGeometry(ox, oy, ix, iy, r, depth, bevel) {
  const rr = (sh, w, h, rad, cw) => {
    const x = -w, y = -h;
    sh.moveTo(x + rad, y);
    sh.lineTo(x + 2 * w - rad, y); sh.quadraticCurveTo(x + 2 * w, y, x + 2 * w, y + rad);
    sh.lineTo(x + 2 * w, y + 2 * h - rad); sh.quadraticCurveTo(x + 2 * w, y + 2 * h, x + 2 * w - rad, y + 2 * h);
    sh.lineTo(x + rad, y + 2 * h); sh.quadraticCurveTo(x, y + 2 * h, x, y + 2 * h - rad);
    sh.lineTo(x, y + rad); sh.quadraticCurveTo(x, y, x + rad, y);
    return sh;
  };
  const outer = rr(new THREE.Shape(), ox, oy, r);
  const hole = new THREE.Path();
  hole.moveTo(-ix, -iy); hole.lineTo(-ix, iy); hole.lineTo(ix, iy); hole.lineTo(ix, -iy); hole.lineTo(-ix, -iy);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function createPool() {
  const group = new THREE.Group();   // inclinação/posição (controlado pelo main)
  const table = new THREE.Group();   // gira 90° no celular
  group.add(table);
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  /* Pano */
  const { map: feltMap, bump: feltBump } = feltTextures();
  const feltMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fb8a6, map: feltMap, bumpMap: feltBump, bumpScale: 0.6, roughness: 1, envMapIntensity: 0.25,
    sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color('#2f9a5c'),
  });
  const felt = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.5, 0.1, HH * 2 + 0.5), feltMat);
  felt.position.y = -0.05;
  felt.receiveShadow = true;
  table.add(felt);

  /* Tabelas (borrachas) cobertas de feltro */
  const cushion = shadowy(new THREE.Mesh(frameGeometry(HW + 0.13, HH + 0.13, HW + 0.005, HH + 0.005, 0.02, 0.07, 0.035), feltMat));
  cushion.position.y = 0.0;
  table.add(cushion);

  /* Moldura de madeira com verniz */
  const wood = woodTexture();
  wood.repeat.set(1.2, 1);
  const woodMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
  const rail = shadowy(new THREE.Mesh(frameGeometry(HW + 0.5, HH + 0.5, HW + 0.12, HH + 0.12, 0.18, 0.14, 0.05), woodMat));
  rail.position.y = 0.0;
  table.add(rail);
  // Saia da mesa (lateral escura)
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.95, 0.5, HH * 2 + 0.95),
    new THREE.MeshPhysicalMaterial({ map: woodTexture('#24100a'), roughness: 0.5, clearcoat: 0.6 }),
  );
  skirt.position.y = -0.3;
  table.add(skirt);
  // Friso vermelho na madeira (cor da marca)
  const inlayMat = new THREE.MeshPhysicalMaterial({ color: 0xd8282a, roughness: 0.35, clearcoat: 1 });
  const inlay = new THREE.Mesh(frameGeometry(HW + 0.33, HH + 0.33, HW + 0.3, HH + 0.3, 0.12, 0.01, 0.004), inlayMat);
  inlay.position.y = 0.2;
  table.add(inlay);

  /* Diamantes de mira (madrepérola) */
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xf2efe6, roughness: 0.2, clearcoat: 1, iridescence: 0.6 });
  const diamond = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 4);
  const dY = 0.215;
  for (const fx of [-0.75, -0.5, -0.25, 0.25, 0.5, 0.75]) {
    for (const sz of [-1, 1]) {
      const d = new THREE.Mesh(diamond, pearl);
      d.position.set(fx * HW, dY, sz * (HH + 0.4));
      table.add(d);
    }
  }
  for (const fz of [-0.5, 0, 0.5]) {
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(diamond, pearl);
      d.position.set(sx * (HW + 0.4), dY, fz * HH);
      table.add(d);
    }
  }

  /* Caçapas: buraco + aro de couro */
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x2a1a12, roughness: 0.5, clearcoat: 0.5 });
  for (const [px, py, pr] of POCKETS) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(pr * 0.92, pr * 0.92, 0.26, 40), holeMat);
    hole.position.set(px, 0.078, py);
    table.add(hole);
    const lip = shadowy(new THREE.Mesh(new THREE.TorusGeometry(pr * 0.94, 0.018, 10, 48), leather));
    lip.rotation.x = Math.PI / 2;
    lip.position.set(px, 0.2, py);
    table.add(lip);
  }

  /* Bolas */
  const { balls, frames } = simulate();
  const ballGeo = new THREE.SphereGeometry(R, 48, 32);
  const meshes = balls.map((b) => {
    const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({
      map: ballTexture(b.n), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2,
    }));
    m.castShadow = true;
    table.add(m);
    return m;
  });

  /* Taco */
  const cue = new THREE.Group();
  const maple = woodTexture('#d8b07a', 'rgba(140,90,40,0.35)');
  maple.center.set(0.5, 0.5);
  maple.rotation = Math.PI / 2;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.042, 3.0, 40),
    new THREE.MeshPhysicalMaterial({ map: maple, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }),
  );
  shaft.rotation.z = Math.PI / 2; shaft.position.x = -1.56;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.07, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xf3efe6, roughness: 0.25, clearcoat: 1 }));
  ferrule.rotation.z = Math.PI / 2; ferrule.position.x = -0.035;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.03, 32),
    new THREE.MeshStandardMaterial({ color: 0x2c5aa0, roughness: 0.9 }));
  tip.rotation.z = Math.PI / 2; tip.position.x = 0.0;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.7, 40),
    new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.8 }));
  wrap.rotation.z = Math.PI / 2; wrap.position.x = -3.4;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.03, 40), inlayMat);
  ring.rotation.z = Math.PI / 2; ring.position.x = -3.05;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.9, 40),
    new THREE.MeshPhysicalMaterial({ map: woodTexture('#1d0c06'), roughness: 0.3, clearcoat: 1 }));
  butt.rotation.z = Math.PI / 2; butt.position.x = -4.2;
  [shaft, ferrule, tip, wrap, ring, butt].forEach((m) => { m.castShadow = true; cue.add(m); });
  cue.rotation.z = -0.07;
  table.add(cue);

  /* Luz da luminária de sinuca (com sombra suave) */
  const lamp = new THREE.SpotLight(0xfff1d6, 0, 18, 0.58, 0.9, 1.2);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 6;
  lamp.shadow.camera.near = 2;
  lamp.shadow.camera.far = 14;
  const lampTarget = new THREE.Object3D();

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const N = frames.length;
  const STRIKE = 0.26;
  const ease = (t) => t * t * (3 - 2 * t);
  const tmp = new THREE.Vector3();

  /** p: 0..1 (progresso do scroll dentro da seção) */
  function update(p, t = 0) {
    // taco: mira tremendo levemente, recua, avança
    let gap;
    if (p < 0.17) gap = 0.25 + 0.75 * ease(p / 0.17);
    else if (p < STRIKE) gap = 1.0 * (1 - Math.pow((p - 0.17) / (STRIKE - 0.17), 2.2));
    else gap = -0.1 - Math.min(1, (p - STRIKE) * 5) * 0.2 + Math.max(0, p - 0.42) * 3;

    // simulação: câmera lenta logo após a tacada
    const q = p <= STRIKE ? 0 : Math.min(1, (p - STRIKE) / 0.64);
    const f = Math.pow(q, 1.45) * (N - 1);
    const f0 = Math.floor(f), f1 = Math.min(N - 1, f0 + 1), k = f - f0;
    const A = frames[f0], B = frames[f1];
    meshes.forEach((m, i) => {
      const o = i * 7;
      const x = A[o] + (B[o] - A[o]) * k;
      const y = A[o + 1] + (B[o + 1] - A[o + 1]) * k;
      const s = A[o + 6] + (B[o + 6] - A[o + 6]) * k;
      m.position.set(x, R - s * R * 2.4, y);
      m.scale.setScalar(1 - s * 0.3);
      m.visible = s < 0.999;
      qa.set(A[o + 2], A[o + 3], A[o + 4], A[o + 5]);
      qb.set(B[o + 2], B[o + 3], B[o + 4], B[o + 5]);
      m.quaternion.slerpQuaternions(qa, qb, k);
    });

    const cb = frames[0];
    const wobble = p < STRIKE ? Math.sin(t * 2.3) * 0.004 : 0;
    cue.position.set(cb[0] - R - 0.02 - gap, R + 0.05, cb[1] + wobble);
    cue.visible = gap < 2.6;

    // luminária acompanha a mesa (fica no mundo para não recompilar shaders)
    table.localToWorld(tmp.set(0, 5.5, 0));
    lamp.position.copy(tmp);
    table.localToWorld(tmp.set(0, 0, 0));
    lampTarget.position.copy(tmp);
    lampTarget.updateMatrixWorld();
  }
  lamp.target = lampTarget;
  update(0);

  return { group, table, update, lamp, lampTarget };
}
