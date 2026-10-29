/* ==========================================================
   RAIO Energy — cena 3D + animações de scroll
   Three.js: lata 3D com rótulo desenhado em canvas
   GSAP ScrollTrigger: move/gira a lata conforme o scroll
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ---------- Sabores ---------- */
const FLAVORS = [
  { name: 'Original',   sub: 'Cítrico elétrico',          base: '#5b3df5', dark: '#120838', accent: '#9d8bff', bg: '#0b0720', ink: '#ffffff' },
  { name: 'Maracujá',   sub: 'Tropical e azedinho',       base: '#ffb400', dark: '#7a3a00', accent: '#ffcf4d', bg: '#1a0f02', ink: '#1a0f02' },
  { name: 'Açaí',       sub: 'Intenso, com guaraná',      base: '#c2185b', dark: '#3a0420', accent: '#ff5fa2', bg: '#16030d', ink: '#ffffff' },
  { name: 'Limão Zero', sub: 'Zero açúcar, zero caloria', base: '#22d36f', dark: '#04361b', accent: '#6dffab', bg: '#03140a', ink: '#03140a' },
];

const isMobile = () => window.innerWidth < 768;
const TAU = Math.PI * 2;

/* ---------- Renderer, cena, câmera ---------- */
const canvas = document.querySelector('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

// Luzes: principal branca + contraluz na cor do sabor
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 6, 8);
scene.add(key);
const rim = new THREE.PointLight(FLAVORS[0].accent, 60, 30);
rim.position.set(-4, 2, -4);
scene.add(rim);
const rim2 = new THREE.PointLight(FLAVORS[0].accent, 40, 30);
rim2.position.set(5, -3, -2);
scene.add(rim2);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

/* ---------- Rótulo (desenhado em canvas) ---------- */
function makeLabel(f) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Fundo em degradê
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, f.base);
  g.addColorStop(1, f.dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Raios diagonais sutis
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = f.ink;
  for (let x = -H; x < W + H; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, H); ctx.lineTo(x + 40, H); ctx.lineTo(x + 40 + H * 0.6, 0); ctx.lineTo(x + H * 0.6, 0);
    ctx.fill();
  }
  ctx.restore();

  // Faixas metálicas em cima e embaixo
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, 34, W, 6);
  ctx.fillRect(0, H - 40, W, 6);

  // Símbolo do raio
  const bolt = (cx, cy, s, color) => {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(1, -10); ctx.lineTo(-8, 2); ctx.lineTo(-2, 2); ctx.lineTo(-3, 10); ctx.lineTo(6, -2); ctx.lineTo(0, -2); ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Marca vertical, no centro (u = 0.5 fica de frente para a câmera)
  const cx = W / 2;
  ctx.save();
  ctx.translate(cx, H / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = f.ink;
  ctx.font = '400 330px Anton, Impact, sans-serif';
  ctx.fillText('RAIO', 0, 0);
  ctx.restore();
  bolt(cx, 130, 6.5, f.ink);

  // Textos verticais laterais
  const vtext = (x, txt, size, alpha = 1) => {
    ctx.save();
    ctx.translate(x, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.ink;
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  };
  vtext(cx - 250, 'ENERGY DRINK', 44, 0.85);
  vtext(cx + 250, f.name.toUpperCase(), 52);
  vtext(cx + 320, 'ZERO AÇÚCAR', 30, 0.7);

  // Verso da lata
  ctx.fillStyle = f.ink;
  ctx.globalAlpha = 0.75;
  ctx.textAlign = 'center';
  ctx.font = '700 34px Inter, Arial, sans-serif';
  ['473 ml', '160 mg CAFEÍNA', '10 kcal', 'FEITO EM SP'].forEach((t, i) => {
    ctx.fillText(t, 150, 380 + i * 70);
    ctx.fillText(t, W - 150, 380 + i * 70);
  });
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ---------- Lata 3D ---------- */
const rig = new THREE.Group();   // controlado pelo scroll
const can = new THREE.Group();   // flutuação, mouse e troca de sabor
rig.add(can);
scene.add(rig);

const R = 1, H = 3.4;
const bodyMat = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.3 });
const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 128, 1, true, Math.PI, TAU), bodyMat);
can.add(body);

const metal = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.2, side: THREE.DoubleSide });

// Parte de cima: ombro, borda e tampa
const topPts = [
  [1.0, 0], [0.99, 0.08], [0.93, 0.24], [0.86, 0.34], [0.855, 0.39], [0.87, 0.42], [0.855, 0.45],
  [0.82, 0.44], [0.8, 0.38], [0.0, 0.38],
].map(([x, y]) => new THREE.Vector2(x * R, y));
const top = new THREE.Mesh(new THREE.LatheGeometry(topPts, 128), metal);
top.position.y = H / 2;
can.add(top);

// Parte de baixo
const botPts = [
  [0.0, -0.12], [0.6, -0.2], [0.78, -0.27], [0.86, -0.27], [0.95, -0.16], [0.99, -0.06], [1.0, 0],
].map(([x, y]) => new THREE.Vector2(x * R, y));
const bottom = new THREE.Mesh(new THREE.LatheGeometry(botPts, 128), metal);
bottom.position.y = -H / 2;
can.add(bottom);

// Anel de abrir
const tab = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 12, 32), metal);
tab.rotation.x = Math.PI / 2;
tab.scale.set(1.5, 1, 1);
tab.position.set(0, H / 2 + 0.4, 0.2);
can.add(tab);
const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), metal);
rivet.position.set(0, H / 2 + 0.4, 0);
can.add(rivet);

/* ---------- Partículas (faíscas) ---------- */
function makeDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const COUNT = 260;
const pos = new Float32Array(COUNT * 3);
const speed = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 18;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  speed[i] = 0.2 + Math.random() * 0.6;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const pMat = new THREE.PointsMaterial({
  size: 0.09, map: makeDot(), color: FLAVORS[0].accent, transparent: true, opacity: 0.8,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* ---------- Poses da lata em cada seção ---------- */
// sx = deslocamento lateral (some no celular); escala menor no celular
const sx = () => {
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
  return isMobile() ? 0 : Math.min(halfW * 0.45, 3.2);
};
const sc = () => (isMobile() ? 0.62 : 1);
const my = () => (isMobile() ? 1.3 : 0); // no celular a lata sobe para dar espaço ao texto

const POSES = {
  hero:    () => ({ x: 0,          y: -0.1,         z: 0,   rx: 0.12, ry: -0.5,         rz: 0.18,  s: sc() }),
  intro:   () => ({ x: sx(),       y: my(),         z: 0,   rx: 0.05, ry: TAU - 0.3,    rz: -0.14, s: sc() }),
  flavors: () => ({ x: sx() * 0.9, y: my(),         z: 0.6, rx: 0,    ry: TAU * 2 - 0.2, rz: 0.06, s: sc() * 1.05 }),
  specs:   () => ({ x: -sx(),      y: my(),         z: 0,   rx: 0.5,  ry: TAU * 2 + 0.6, rz: -0.25, s: sc() }),
  cta:     () => ({ x: 0,          y: isMobile() ? -0.5 : -0.35, z: 0.8, rx: 0.08, ry: TAU * 3, rz: 0, s: sc() * 1.1 }),
};

function applyPose(p) {
  rig.position.set(p.x, p.y, p.z);
  rig.rotation.set(p.rx, p.ry, p.rz);
  rig.scale.setScalar(p.s);
}

// Interpola entre duas poses enquanto a próxima seção entra na tela
function segment(trigger, from, to, opts = {}) {
  const state = { t: 0 };
  ScrollTrigger.create({
    trigger,
    start: opts.start || 'top bottom',
    end: opts.end || 'top top',
    scrub: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      state.t = self.progress;
      const a = POSES[from](), b = POSES[to]();
      const e = gsap.parseEase('power2.inOut')(state.t);
      const mix = {};
      for (const k in a) mix[k] = a[k] + (b[k] - a[k]) * e;
      currentTarget = mix;
    },
  });
}

let currentTarget = POSES.hero();

/* ---------- Troca de sabor ---------- */
const textures = [];
let flavorIdx = 0;
const root = document.documentElement;
const $name = document.getElementById('flavorName');
const $sub = document.getElementById('flavorSub');
const $idx = document.getElementById('flavorIndex');
const $list = [...document.querySelectorAll('#flavorList li')];

function setColors(f, instant = false) {
  const d = instant ? 0 : 0.8;
  gsap.to(root, { '--bg': f.bg, '--base': f.base, '--accent': f.accent, duration: d, ease: 'power2.out' });
  gsap.to(rim.color, { ...hex(f.accent), duration: d });
  gsap.to(rim2.color, { ...hex(f.accent), duration: d });
  gsap.to(pMat.color, { ...hex(f.accent), duration: d });
}
const hex = (h) => { const c = new THREE.Color(h); return { r: c.r, g: c.g, b: c.b }; };

function setFlavor(i) {
  if (i === flavorIdx) return;
  const dir = i > flavorIdx ? 1 : -1;
  flavorIdx = i;
  const f = FLAVORS[i];

  // Gira a lata e troca o rótulo no meio do giro
  gsap.killTweensOf(can.rotation);
  gsap.to(can.rotation, {
    y: can.rotation.y + TAU * dir, duration: 1.1, ease: 'power3.inOut',
    onUpdate() {
      if (this.progress() > 0.35 && bodyMat.map !== textures[i]) { bodyMat.map = textures[i]; bodyMat.needsUpdate = true; }
    },
  });
  gsap.fromTo(can.position, { y: 0 }, { y: 0.35, duration: 0.55, yoyo: true, repeat: 1, ease: 'power2.out' });

  setColors(f);

  // Texto
  gsap.to([$name, $sub], {
    yPercent: -30 * dir, opacity: 0, duration: 0.25, ease: 'power2.in',
    onComplete: () => {
      $name.textContent = f.name;
      $sub.textContent = f.sub;
      $idx.textContent = String(i + 1).padStart(2, '0');
      gsap.fromTo([$name, $sub], { yPercent: 30 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.05 });
    },
  });
  $list.forEach((li, n) => li.classList.toggle('is-active', n === i));
}

/* ---------- Mouse ---------- */
const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------- Loop de renderização ---------- */
const clock = new THREE.Clock();
const live = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };
let introDone = false;

function tick() {
  const t = clock.getElapsedTime();

  // Suaviza o caminho até a pose alvo
  if (introDone) {
    const k = 0.09;
    for (const key in live) live[key] += (currentTarget[key] - live[key]) * k;
    applyPose(live);
  }

  // Flutuação + inclinação pelo mouse
  can.rotation.x = Math.sin(t * 0.8) * 0.04 + mouse.y * 0.12;
  can.rotation.z = Math.cos(t * 0.6) * 0.03 - mouse.x * 0.08;
  rig.position.y += Math.sin(t * 1.1) * 0.08;

  // Faíscas sobem devagar
  const arr = pGeo.attributes.position.array;
  for (let i = 0; i < COUNT; i++) {
    arr[i * 3 + 1] += speed[i] * 0.012;
    if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
  }
  pGeo.attributes.position.needsUpdate = true;
  particles.rotation.y = window.scrollY * 0.0004;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ---------- Resize ---------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

/* ---------- Animações de scroll do HTML ---------- */
function setupScroll() {
  segment('.intro', 'hero', 'intro');
  segment('.flavors', 'intro', 'flavors');
  segment('.specs', 'flavors', 'specs');
  segment('.cta', 'specs', 'cta');

  // Seção de sabores fica fixa enquanto troca 4 sabores
  ScrollTrigger.create({
    trigger: '.flavors',
    start: 'top top',
    end: '+=300%',
    pin: true,
    onUpdate: (self) => {
      const i = Math.min(FLAVORS.length - 1, Math.floor(self.progress * FLAVORS.length));
      setFlavor(i);
      document.getElementById('flavorProgress').style.width = `${self.progress * 100}%`;
    },
  });

  // Palavra gigante do hero se afasta
  gsap.to('.hero__word', {
    yPercent: 35, opacity: 0.15, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Textos entram
  gsap.utils.toArray('.panel__text, .flavors__text, .cta__title, .cta__actions').forEach((el) => {
    gsap.from(el, {
      y: 80, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
    });
  });

  // Contadores
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => { el.textContent = Math.round(o.v); },
    });
  });
}

/* ---------- Início ---------- */
async function init() {
  const bar = document.getElementById('loaderBar');
  bar.style.width = '30%';
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 40px Inter')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* segue com fonte reserva */ }
  bar.style.width = '70%';

  FLAVORS.forEach((f) => textures.push(makeLabel(f)));
  bodyMat.map = textures[0];
  bodyMat.needsUpdate = true;
  setColors(FLAVORS[0], true);

  renderer.compile(scene, camera);
  tick();
  bar.style.width = '100%';

  await new Promise((r) => setTimeout(r, 400));
  document.getElementById('loader').classList.add('is-done');
  document.body.classList.remove('is-loading');

  setupScroll();
  currentTarget = POSES.hero();

  // Entrada: lata cai girando, letras sobem
  const start = { ...POSES.hero(), y: 6, ry: -TAU - 0.5, rz: 0.6 };
  Object.assign(live, start);
  applyPose(live);
  gsap.to(live, {
    ...POSES.hero(), duration: 1.8, ease: 'expo.out', delay: 0.15,
    onUpdate: () => applyPose(live),
    onComplete: () => { introDone = true; ScrollTrigger.update(); },
  });
  gsap.from('.hero__word span', { yPercent: 110, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05 });
  gsap.from('.reveal, .nav', { y: 20, opacity: 0, duration: 1, delay: 0.6, ease: 'power3.out', stagger: 0.1 });
}

document.body.classList.add('is-loading');
window.scrollTo(0, 0);
init();
