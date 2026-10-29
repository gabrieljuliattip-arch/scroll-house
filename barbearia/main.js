/* ==========================================================
   Navalha Barbearia — cena 3D + animações de scroll
   Three.js: poste de barbeiro (listras em canvas que sobem)
   GSAP ScrollTrigger: move o poste entre as seções
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const isMobile = () => window.innerWidth < 768;
const COLORS = { red: '#c4372d', blue: '#2a56a8', bone: '#f3ece0', brass: 0xc9a35c };

/* ---------- Renderer, cena, câmera ---------- */
const canvas = document.querySelector('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

// Luz quente de cima (como a luminária da barbearia) + contraluz fria
const key = new THREE.SpotLight(0xffd9a8, 220, 40, Math.PI / 6, 0.6, 1.4);
key.position.set(2, 10, 6);
scene.add(key);
const rim = new THREE.PointLight(0x7fa6ff, 35, 30);
rim.position.set(-5, 1, -4);
scene.add(rim);
const warm = new THREE.PointLight(0xff6a4a, 25, 30);
warm.position.set(5, -3, 2);
scene.add(warm);
scene.add(new THREE.AmbientLight(0xffffff, 0.2));

/* ---------- Listras do poste (canvas que repete) ---------- */
function makeStripes() {
  const S = 512, w = 64; // período de 4 faixas = 256px, encaixa no tile de 512
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const seq = [COLORS.red, COLORS.bone, COLORS.blue, COLORS.bone];
  for (let k = -16; k < 16; k++) {
    ctx.fillStyle = seq[((k % 4) + 4) % 4];
    ctx.beginPath();
    ctx.moveTo(k * w, 0);
    ctx.lineTo((k + 1) * w, 0);
    ctx.lineTo((k + 1) * w + S, S);
    ctx.lineTo(k * w + S, S);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2.4);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ---------- Poste 3D ---------- */
const rig = new THREE.Group();   // controlado pelo scroll
const pole = new THREE.Group();  // flutuação e mouse
rig.add(pole);
scene.add(rig);

const H = 3.4, R = 0.5;
const stripes = makeStripes();
const inner = new THREE.Mesh(
  new THREE.CylinderGeometry(R, R, H, 96, 1, true),
  new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.35, metalness: 0.0, emissive: 0xffffff, emissiveMap: stripes, emissiveIntensity: 0.18 }),
);
pole.add(inner);

// Vidro por fora
const glass = new THREE.Mesh(
  new THREE.CylinderGeometry(R + 0.07, R + 0.07, H, 96, 1, true),
  new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 2, depthWrite: false }),
);
glass.renderOrder = 2;
pole.add(glass);

// Metal latão: tampas de cima e de baixo
const brass = new THREE.MeshStandardMaterial({ color: COLORS.brass, metalness: 1, roughness: 0.22, side: THREE.DoubleSide });
const capPts = [
  [0.0, 0], [0.66, 0], [0.7, 0.04], [0.7, 0.14], [0.64, 0.18], [0.62, 0.24], [0.66, 0.28], [0.6, 0.34],
  [0.42, 0.42], [0.22, 0.5], [0.1, 0.56], [0.08, 0.62],
].map(([x, y]) => new THREE.Vector2(x, y));
const capGeo = new THREE.LatheGeometry(capPts, 96);
const topCap = new THREE.Mesh(capGeo, brass);
topCap.position.y = H / 2;
pole.add(topCap);
const finial = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 32), brass);
finial.position.y = H / 2 + 0.76;
pole.add(finial);
const botCap = new THREE.Mesh(capGeo, brass);
botCap.rotation.x = Math.PI;
botCap.position.y = -H / 2;
pole.add(botCap);
const botBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), brass);
botBall.position.y = -H / 2 - 0.7;
pole.add(botBall);

// Anéis finos
const ringGeo = new THREE.TorusGeometry(R + 0.09, 0.025, 12, 96);
[H / 2 - 0.02, -H / 2 + 0.02].forEach((y) => {
  const ring = new THREE.Mesh(ringGeo, brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  pole.add(ring);
});

/* ---------- Poeira na luz ---------- */
function makeDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const COUNT = 220;
const dustPos = new Float32Array(COUNT * 3);
const seed = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 18;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
  seed[i] = Math.random() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.06, map: makeDot(), color: 0xffd9a8, transparent: true, opacity: 0.55,
  depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(dust);

/* ---------- Poses do poste em cada seção ---------- */
const sx = () => {
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
  return isMobile() ? 0 : Math.min(halfW * 0.48, 3.4);
};
const m = isMobile;

const POSES = {
  hero:     () => ({ x: m() ? 0 : sx() * 0.18, y: m() ? 1.7 : -0.15, z: 0, rz: 0, ry: 0, s: m() ? 0.55 : 1 }),
  casa:     () => ({ x: sx(),   y: m() ? 1.7 : 0,     z: 0, rz: m() ? 0 : -0.16, ry: 1.2,  s: m() ? 0.5 : 1 }),
  servicos: () => ({ x: sx(),   y: m() ? 1.9 : 0,     z: 0, rz: m() ? 0 : 0.14,  ry: 2.4,  s: m() ? 0.45 : 1 }),
  equipe:   () => ({ x: -sx(),  y: m() ? 1.9 : 0,     z: 0, rz: m() ? 0 : -0.14, ry: 3.6,  s: m() ? 0.45 : 1 }),
  agendar:  () => ({ x: 0,      y: m() ? 2.85 : 1.85, z: 0, rz: Math.PI / 2,     ry: 4.8,  s: m() ? 0.42 : 0.85 }),
};

function applyPose(p) {
  rig.position.set(p.x, p.y, p.z);
  rig.rotation.set(0, 0, p.rz);
  pole.rotation.y = p.ry;
  rig.scale.setScalar(p.s);
}

// Cada trecho interpola entre duas poses; o alvo vem do último trecho já iniciado
let currentTarget = POSES.hero();
const segments = [];
const ease = gsap.parseEase('power2.inOut');
function updateTarget() {
  let seg = null;
  for (const s of segments) if (s.st.progress > 0) seg = s;
  if (!seg) { currentTarget = POSES.hero(); return; }
  const a = POSES[seg.from](), b = POSES[seg.to](), e = ease(seg.st.progress);
  const mix = {};
  for (const k in a) mix[k] = a[k] + (b[k] - a[k]) * e;
  currentTarget = mix;
}
function segment(trigger, from, to) {
  const st = ScrollTrigger.create({
    trigger, start: 'top 75%', end: 'top 10%', invalidateOnRefresh: true,
    onUpdate: updateTarget, onRefresh: updateTarget,
  });
  segments.push({ st, from, to });
}

/* ---------- Mouse ---------- */
const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
const live = { ...POSES.hero() };
let introDone = false;
let lastY = window.scrollY;
let boost = 0; // listras aceleram quando a pessoa rola

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  if (introDone) {
    const k = 1 - Math.exp(-dt * 5);
    for (const key in live) live[key] += (currentTarget[key] - live[key]) * k;
  }
  applyPose(live);

  // Velocidade das listras = base + scroll
  const dy = window.scrollY - lastY;
  lastY = window.scrollY;
  boost += (Math.min(Math.abs(dy) * 0.02, 2.5) - boost) * 0.1;
  stripes.offset.y -= dt * (0.18 + boost);

  // Flutuação + mouse
  rig.position.y += Math.sin(t * 1.1) * 0.06;
  pole.rotation.x = mouse.y * 0.1;
  pole.rotation.z = -mouse.x * 0.06 + Math.sin(t * 0.7) * 0.02;

  // Poeira flutuando
  const arr = dustGeo.attributes.position.array;
  for (let i = 0; i < COUNT; i++) {
    arr[i * 3] += Math.sin(t * 0.3 + seed[i]) * 0.002;
    arr[i * 3 + 1] += 0.003 + Math.cos(t * 0.4 + seed[i]) * 0.001;
    if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
  }
  dustGeo.attributes.position.needsUpdate = true;
  dust.rotation.y = window.scrollY * 0.0003;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

/* ---------- Animações de scroll do HTML ---------- */
function setupScroll() {
  segment('.casa', 'hero', 'casa');
  segment('.servicos', 'casa', 'servicos');
  segment('.equipe', 'servicos', 'equipe');
  segment('.agendar', 'equipe', 'agendar');

  // Título do hero abre para os lados
  gsap.to('.hero__line--a', { xPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__line--b', { xPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Textos entram (começam visíveis caso o JS demore)
  gsap.utils.toArray('.panel__text, .agendar__title, .agendar__grid').forEach((el) => {
    gsap.from(el, {
      y: 70, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
    });
  });

  // Linhas da tabela entram uma a uma
  gsap.from('.menu li', {
    x: -30, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07,
    scrollTrigger: { trigger: '.menu', start: 'top 80%' },
  });
  gsap.from('.barber', {
    y: 30, opacity: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1,
    scrollTrigger: { trigger: '.team', start: 'top 85%' },
  });
}

/* ---------- Início ---------- */
async function init() {
  const bar = document.getElementById('loaderBar');
  bar.style.width = '40%';
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 100px Fraunces'), document.fonts.load('italic 400 100px Fraunces')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* segue com fonte reserva */ }

  renderer.compile(scene, camera);
  const start = { ...POSES.hero(), y: -7, ry: -3, rz: 0.4 };
  Object.assign(live, start);
  tick();
  bar.style.width = '100%';

  await new Promise((r) => setTimeout(r, 400));
  document.getElementById('loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  setupScroll();

  // Entrada: poste sobe girando, título desliza
  gsap.to(live, {
    ...POSES.hero(), duration: 2, ease: 'expo.out', delay: 0.1,
    onComplete: () => { introDone = true; ScrollTrigger.update(); },
  });
  gsap.from('.hero__line > *', { yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
  gsap.from('.reveal, .nav', { y: 20, opacity: 0, duration: 1, delay: 0.7, ease: 'power3.out', stagger: 0.1 });
}

document.body.classList.add('is-loading');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
init();
