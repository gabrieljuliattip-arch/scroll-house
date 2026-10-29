/* Copão: copo plástico suado, drink em degradê com redemoinho, gelo irregular,
   bolhas e gotas de condensação escorrendo.
   Truque de realismo: "fresnel" — superfícies transparentes ficam mais opacas
   e brilhantes nas bordas, como plástico, gelo e água de verdade. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const Y0 = -1.6, Y1 = 1.6;      // fundo e borda do copo
const R0 = 0.74, R1 = 1.06;     // raio no fundo e na boca
const LIQ = 0.95;               // altura do líquido
const cupR = (y) => R0 + (R1 - R0) * ((y - Y0) / (Y1 - Y0));

/* Adiciona efeito fresnel a um material transparente */
function fresnel(mat, edgeAlpha = 0.8, power = 3.0, glow = 0.12) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float fres = pow(1.0 - saturate(abs(dot(normalize(normal), normalize(vViewPosition)))), ${power.toFixed(2)});
      gl_FragColor.a = mix(gl_FragColor.a, ${edgeAlpha.toFixed(2)}, fres);
      gl_FragColor.rgb += fres * ${glow.toFixed(2)};`,
    );
  };
  mat.customProgramCacheKey = () => `fres-${edgeAlpha}-${power}-${glow}`;
  return mat;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Condensação: névoa de pontinhos (mais densa embaixo) + escorridos + marca */
function frostTexture() {
  return canvasTex(1024, 1024, (ctx, W, H) => {
    const liquidV = (LIQ - Y0) / (Y1 - Y0);
    // névoa suave
    const g = ctx.createLinearGradient(0, H, 0, H - liquidV * H * 1.05);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.045)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // micro gotas
    for (let i = 0; i < 16000; i++) {
      const x = Math.random() * W;
      const v = Math.pow(Math.random(), 0.75) * liquidV * 1.04;
      const y = H - v * H;
      const r = 0.5 + Math.pow(Math.random(), 3) * 3.2;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.28})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // trilhas limpas deixadas pelas gotas que escorreram (mais escuras = sem névoa)
    for (let i = 0; i < 45; i++) {
      const x = Math.random() * W, y0 = H - Math.random() * liquidV * H * 0.95;
      const len = 60 + Math.random() * 260;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(x, y0, 3 + Math.random() * 3, len);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(x + 3, y0 + len, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    // marca impressa no copo (u = 0.5 fica de frente)
    ctx.save();
    ctx.translate(W / 2, H * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '400 96px "Archivo Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIKEBRAS', 0, 0);
    ctx.fillStyle = 'rgba(224,43,43,0.95)';
    ctx.fillRect(-170, 56, 340, 13);
    ctx.restore();
  });
}

// Frisos verticais do copo plástico (relevo)
function ribBump() {
  const t = canvasTex(512, 64, (ctx, W, H) => {
    for (let x = 0; x < W; x++) {
      const v = 128 + Math.sin((x / W) * Math.PI * 2 * 48) * 90;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, H);
    }
  }, false);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Ruído simples para deformar o gelo
const noise3 = (x, y, z, s) =>
  Math.sin(x * 3.1 + s) * 0.5 + Math.sin(y * 4.3 + s * 1.7) * 0.35 + Math.sin(z * 5.7 + s * 0.6) * 0.25 + Math.sin((x + y + z) * 7.9 + s) * 0.15;

function iceGeometry(seed) {
  const g = new RoundedBoxGeometry(0.52, 0.46, 0.5, 4, 0.09);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x, v.y, v.z, seed) * 0.035;
    v.multiplyScalar(1 + n / v.length());
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createDrink() {
  const group = new THREE.Group();
  const cup = new THREE.Group();
  group.add(cup);

  /* Copo */
  const wallPts = [[0, Y0], [R0 - 0.02, Y0], [R0, Y0 + 0.02], [R0 + 0.01, Y0 + 0.06], [R1, Y1 - 0.06], [R1 + 0.02, Y1 - 0.02]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const ribs = ribBump();
  const shellMat = fresnel(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
    bumpMap: ribs, bumpScale: 0.35, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4,
  }), 0.62, 2.6, 0.1);
  const shell = new THREE.Mesh(new THREE.LatheGeometry(wallPts, 128, Math.PI), shellMat);
  shell.renderOrder = 3;
  cup.add(shell);

  const frost = new THREE.Mesh(
    new THREE.LatheGeometry([new THREE.Vector2(R0 + 0.022, Y0 + 0.06), new THREE.Vector2(R1 + 0.012, Y1 - 0.06)], 128, Math.PI),
    new THREE.MeshPhysicalMaterial({ map: frostTexture(), transparent: true, depthWrite: false, roughness: 0.35, envMapIntensity: 0.8 }),
  );
  frost.renderOrder = 4;
  cup.add(frost);

  // Borda enrolada do copo
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R1 + 0.035, 0.03, 16, 128),
    fresnel(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.08, clearcoat: 1 }), 0.9, 2.0, 0.15),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = Y1;
  rim.renderOrder = 4;
  cup.add(rim);

  /* Gelo (desenhado antes do líquido, para a parte submersa ficar tingida) */
  const iceMat = fresnel(new THREE.MeshPhysicalMaterial({
    color: 0xe6f4ff, transparent: true, opacity: 0.28, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08,
    envMapIntensity: 2.2, depthWrite: false,
  }), 0.92, 2.2, 0.22);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false });
  const ices = [0, 1, 2, 3, 4].map((i) => {
    const m = new THREE.Mesh(iceGeometry(i * 13.7), iceMat);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), coreMat); // miolo esbranquiçado
    core.scale.set(1.2, 0.8, 1);
    m.add(core);
    m.userData = {
      a: (i / 5) * Math.PI * 2, r: 0.28 + (i % 3) * 0.12, h: (i % 2) * 0.06,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
    };
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    m.renderOrder = 0;
    cup.add(m);
    return m;
  });

  /* Líquido com degradê (vermelho em cima, laranja embaixo) */
  const liqPts = [new THREE.Vector2(0, Y0 + 0.07)];
  for (let i = 0; i <= 24; i++) {
    const y = Y0 + 0.07 + (LIQ - Y0 - 0.07) * (i / 24);
    liqPts.push(new THREE.Vector2(cupR(y) - 0.03, y));
  }
  const liqGeo = new THREE.LatheGeometry(liqPts, 96);
  const colTop = new THREE.Color('#a8061f'), colMid = new THREE.Color('#e8201f'), colBot = new THREE.Color('#ff7a0a'), tmp = new THREE.Color();
  const lp = liqGeo.attributes.position;
  const colors = new Float32Array(lp.count * 3);
  for (let i = 0; i < lp.count; i++) {
    const k = THREE.MathUtils.clamp((lp.getY(i) - Y0) / (LIQ - Y0), 0, 1);
    if (k < 0.45) tmp.copy(colBot).lerp(colMid, THREE.MathUtils.smoothstep(k, 0.05, 0.45));
    else tmp.copy(colMid).lerp(colTop, THREE.MathUtils.smoothstep(k, 0.45, 0.95));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  liqGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const liquid = new THREE.Mesh(liqGeo, fresnel(new THREE.MeshPhysicalMaterial({
    vertexColors: true, transparent: true, opacity: 0.93, roughness: 0.05, clearcoat: 1,
    emissive: 0x7a0a08, emissiveIntensity: 0.6, depthWrite: false,
  }), 0.98, 2.2, 0.0));
  liquid.renderOrder = 1;
  cup.add(liquid);

  // Superfície com ondas + redemoinho
  const topR = cupR(LIQ) - 0.03;
  const surfGeo = new THREE.RingGeometry(0.001, topR, 96, 20);
  const surfBase = surfGeo.attributes.position.array.slice();
  const surface = new THREE.Mesh(surfGeo, new THREE.MeshPhysicalMaterial({
    color: 0xb80a26, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.9,
    emissive: 0x4a0010, emissiveIntensity: 0.35, side: THREE.DoubleSide, envMapIntensity: 1.6,
  }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = LIQ;
  surface.renderOrder = 2;
  cup.add(surface);
  // Menisco (líquido "subindo" na parede)
  const meniscus = new THREE.Mesh(
    new THREE.TorusGeometry(topR, 0.022, 10, 128),
    new THREE.MeshPhysicalMaterial({ color: 0xff5a4a, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.7, emissive: 0x500010, emissiveIntensity: 0.4 }),
  );
  meniscus.rotation.x = Math.PI / 2;
  meniscus.position.y = LIQ + 0.01;
  meniscus.renderOrder = 2;
  cup.add(meniscus);

  /* Canudo listrado */
  const strawTex = canvasTex(64, 512, (ctx, W, H) => {
    ctx.fillStyle = '#ff3d8b'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let y = -W; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + W); ctx.lineTo(W, y + W + 14); ctx.lineTo(0, y + 14); ctx.fill(); }
  });
  strawTex.wrapT = THREE.RepeatWrapping;
  strawTex.repeat.set(1, 3);
  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 4.0, 32, 1, true),
    new THREE.MeshPhysicalMaterial({ map: strawTex, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }),
  );
  straw.position.set(0.32, 0.75, -0.15);
  straw.rotation.z = -0.24;
  straw.renderOrder = 0;
  cup.add(straw);

  /* Bolhinhas subindo dentro do líquido */
  const BUB = 70;
  const bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    fresnel(new THREE.MeshPhysicalMaterial({ color: 0xffd6c0, transparent: true, opacity: 0.12, roughness: 0, depthWrite: false }), 0.85, 1.6, 0.3),
    BUB,
  );
  bubbles.renderOrder = 1;
  const bubData = Array.from({ length: BUB }, () => ({
    a: Math.random() * Math.PI * 2, r: Math.random() * 0.62, y: Y0 + Math.random() * (LIQ - Y0),
    s: 0.008 + Math.random() * 0.018, v: 0.15 + Math.random() * 0.45, w: Math.random() * 10,
  }));
  cup.add(bubbles);

  /* Gotas de condensação: paradas e escorrendo (aceleram ao descer) */
  const DROPS = 520;
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 14, 10),
    fresnel(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0, clearcoat: 1, envMapIntensity: 3, depthWrite: false,
    }), 0.95, 1.4, 0.35),
    DROPS,
  );
  drops.renderOrder = 5;
  const dropData = Array.from({ length: DROPS }, () => {
    const runs = Math.random() < 0.12;
    return {
      a: Math.random() * Math.PI * 2,
      y: Y0 + 0.1 + Math.pow(Math.random(), 0.7) * (LIQ + 0.15 - Y0),
      s: runs ? 0.028 + Math.random() * 0.016 : 0.007 + Math.pow(Math.random(), 2) * 0.026,
      v: 0, run: runs, wait: Math.random() * 6,
    };
  });
  cup.add(drops);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), e = new THREE.Euler();

  /** stir: 0..1 intensidade de mexer o drink */
  function update(dt, t, stir) {
    // Ondas + redemoinho (afunda no centro quando mexe)
    const arr = surfGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = surfBase[i], y = surfBase[i + 1];
      const r = Math.min(1, Math.hypot(x, y) / topR), th = Math.atan2(y, x);
      const waves = Math.sin(r * 9 - t * 3.0 + th * 3) * 0.012 + Math.sin(th * 2 - t * 1.7) * 0.015 * r;
      const vortex = -stir * 0.14 * Math.pow(1 - r, 2.2);
      arr[i + 2] = waves * (0.5 + stir) + vortex;
    }
    surfGeo.attributes.position.needsUpdate = true;
    surfGeo.computeVertexNormals();

    // Gelo girando no redemoinho, balançando
    ices.forEach((m, i) => {
      const d = m.userData;
      d.a += dt * (0.18 + stir * 0.9) * (1.1 - d.r);
      m.position.set(Math.cos(d.a) * d.r, LIQ - 0.05 + d.h + Math.sin(t * 1.5 + i * 1.3) * 0.035, Math.sin(d.a) * d.r);
      m.rotation.x += d.spin.x * dt * (0.15 + stir * 0.6);
      m.rotation.y += d.spin.y * dt * (0.2 + stir * 0.8);
      m.rotation.z += d.spin.z * dt * 0.15;
    });
    straw.rotation.x = Math.sin(t * 0.8) * 0.04 * (0.5 + stir);
    straw.position.x = 0.32 + Math.sin(t * 0.6) * 0.03 * stir;

    // Bolhas sobem fazendo zigue-zague
    bubData.forEach((b, i) => {
      b.y += b.v * dt;
      b.a += dt * (0.25 + stir * 0.8);
      if (b.y > LIQ - 0.04) { b.y = Y0 + 0.1; b.r = Math.random() * 0.62; }
      p3.set(Math.cos(b.a) * b.r + Math.sin(t * 3 + b.w) * 0.01, b.y, Math.sin(b.a) * b.r);
      s3.setScalar(b.s);
      m4.compose(p3, q.identity(), s3);
      bubbles.setMatrixAt(i, m4);
    });
    bubbles.instanceMatrix.needsUpdate = true;

    // Gotas: as que escorrem esperam, descem acelerando e recomeçam
    dropData.forEach((d, i) => {
      if (d.run) {
        if (d.wait > 0) d.wait -= dt;
        else {
          d.v = Math.min(0.9, d.v + dt * 0.5);
          d.y -= d.v * dt;
          if (d.y < Y0 + 0.08) {
            d.y = LIQ + 0.1 - Math.random() * 0.5; d.a = Math.random() * Math.PI * 2; d.v = 0; d.wait = 1 + Math.random() * 5;
          }
        }
      }
      const r = cupR(d.y) + 0.022 + d.s * 0.35;
      p3.set(Math.sin(d.a) * r, d.y, Math.cos(d.a) * r);
      e.set(0, d.a, 0);
      q.setFromEuler(e);
      const stretch = d.run ? 1.25 + d.v * 0.8 : 1.1;
      s3.set(d.s, d.s * stretch, d.s * 0.5);
      m4.compose(p3, q, s3);
      drops.setMatrixAt(i, m4);
    });
    drops.instanceMatrix.needsUpdate = true;
  }

  return { group, cup, update };
}
