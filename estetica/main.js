/* ==========================================================
   Espelhado — cena 3D: peça pintada (speed shape), politriz e água.
   A pose da peça vem da posição das seções na tela;
   o polimento e as gotas seguem o progresso das seções fixas.
   ========================================================== */
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createDetailingStudio } from './js/env.js';
import { createShape } from './js/shape.js';
import { createPolisher } from './js/polisher.js';
import { createWater } from './js/water.js';

gsap.registerPlugin(ScrollTrigger);

const isMobile = () => window.innerWidth < 768;
const clamp = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------- Renderer ---------- */
const canvas = document.querySelector('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.environment = createDetailingStudio(renderer);
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(-3, 6, 8);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.15));

/* ---------- Objetos ---------- */
const shape = createShape();
const polisher = createPolisher();
polisher.group.scale.setScalar(0.62);
shape.group.add(polisher.group);
const water = createWater(shape.sample);
shape.group.add(water.mesh);
const rig = new THREE.Group();
rig.add(shape.group);
scene.add(rig);

const halfW = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
const sx = () => Math.min(halfW() * 0.42, 3.1);
const M = isMobile;

const SECTIONS = [...document.querySelectorAll('main > section')];
const POSES = [
  () => ({ x: M() ? 0 : sx() * 0.92, y: M() ? 1.65 : -0.35, rx: 0.32, ry: -0.36, s: M() ? 0.5 : 0.9 }), // hero
  () => ({ x: M() ? 0 : sx() * 0.95, y: M() ? 1.75 : -0.3, rx: M() ? 0.34 : 0.26, ry: M() ? -0.18 : -0.24, s: M() ? 0.52 : 0.92 }),     // polimento
  () => ({ x: M() ? 0 : sx() * 0.95, y: M() ? 1.85 : -0.35, rx: M() ? 0.5 : 0.42, ry: -0.12, s: M() ? 0.52 : 0.92 }),   // vitrificação
  () => ({ x: M() ? 0 : -sx() * 0.8, y: M() ? 7 : 1.55, rx: 0.3, ry: 0.5, s: M() ? 0.45 : 0.48 }),     // serviços
  () => ({ x: M() ? 0 : -sx() * 0.75, y: 8, rx: 0.12, ry: 0.9, s: 0.5 }),                                 // contato
];

function zone(el) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  return { stick: clamp(-r.top / Math.max(1, r.height - vh)), enter: clamp((vh - r.top) / vh) };
}

/* ---------- Mouse ---------- */
const mouseRaw = { x: 0, y: 0 }, mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouseRaw.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseRaw.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------- HUD do polimento ---------- */
const $micron = document.getElementById('gaugeMicron');
const $pct = document.getElementById('gaugePct');
const $steps = [...document.querySelectorAll('#process li')];
let lastPct = -1;

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
const live = { ...POSES[0](), y: -6, wipe: 0.35, pol: 0, wat: 0 };
let started = false;
const P = new THREE.Vector3(), N = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  const k = 1 - Math.exp(-dt * 5);
  const vh = window.innerHeight;
  mouse.x = lerp(mouse.x, mouseRaw.x, 1 - Math.exp(-dt * 3));
  mouse.y = lerp(mouse.y, mouseRaw.y, 1 - Math.exp(-dt * 3));

  // pose: mistura sequencial conforme cada seção entra na tela
  const pose = POSES[0]();
  for (let i = 1; i < SECTIONS.length; i++) {
    const r = SECTIONS[i].getBoundingClientRect();
    const kk = ease(clamp((vh * 0.8 - r.top) / (vh * 0.7)));
    const q = POSES[i]();
    for (const key in pose) pose[key] = lerp(pose[key], q[key], kk);
  }
  if (started) for (const key in pose) live[key] = lerp(live[key], pose[key], k);

  // progresso do polimento e da água
  const zp = zone(SECTIONS[1]), zw = zone(SECTIONS[2]);
  live.pol = lerp(live.pol, zp.stick, k * 1.3);
  live.wat = lerp(live.wat, zw.stick, k * 1.3);
  const wipe = lerp(0.35, 3.4, ease(clamp(live.pol / 0.92)));
  shape.uniforms.uWipe.value = wipe;
  shape.uniforms.uTime.value = t;

  rig.position.set(live.x, live.y + Math.sin(t * 0.9) * 0.05, 0);
  rig.rotation.set(live.rx + mouse.y * 0.08, live.ry + mouse.x * 0.14 + Math.sin(t * 0.35) * 0.04, -0.04);
  rig.scale.setScalar(live.s);

  // politriz segue a linha de polimento, subindo e descendo em passadas
  const lift = THREE.MathUtils.smoothstep(wipe, 2.7, 3.3);
  polisher.group.visible = lift < 0.999;
  if (polisher.group.visible) {
    const yPass = 0.3 + Math.sin(t * 1.1) * 0.55;
    let hit = shape.sample(wipe, yPass, P, N) || shape.sample(wipe, 0.18, P, N) || shape.sample(Math.min(wipe, 2.4), 0.12, P, N);
    if (hit) {
      P.addScaledVector(N, lift * 1.5);
      polisher.place(P, N, t, dt, -0.55 + Math.sin(t * 0.7) * 0.08);
    }
  }

  // HUD
  const pct = Math.round(clamp((wipe - 0.35) / 3.05) * 100);
  if (pct !== lastPct) {
    lastPct = pct;
    $pct.textContent = `${pct}%`;
    $micron.textContent = `${(118 - pct * 0.04).toFixed(0)} µm`;
    $steps.forEach((li, i) => li.classList.toggle('is-on', live.pol >= i * 0.24 || (i === 0 && live.pol > 0.01)));
  }

  water.update(live.wat);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

/* ---------- Formulário (site conceito: nada é enviado) ---------- */
document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('fName').value.trim().split(' ')[0] || 'tudo certo';
  document.getElementById('formMsg').textContent = `Valeu, ${name}! Num site real, a equipe responderia no WhatsApp. (Site conceito: nada foi enviado.)`;
  e.target.reset();
});

/* ---------- Rolagem suave + textos ---------- */
function setupScroll() {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); lenis.scrollTo(target, { duration: 1.6 }); }
    }));
  }
  gsap.utils.toArray('.stage__text, .servicos__head, .card, .contato__text, .form').forEach((el, i) => {
    gsap.from(el, {
      y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', delay: el.classList.contains('card') ? (i % 4) * 0.08 : 0,
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
    });
  });
}

/* ---------- Início ---------- */
(async function init() {
  const bar = document.getElementById('loaderBar');
  bar.style.width = '40%';
  try {
    await Promise.race([document.fonts.load('900 100px "Big Shoulders Display"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch (_) { /* fonte reserva */ }
  renderer.compile(scene, camera);
  tick();
  bar.style.width = '100%';
  await new Promise((r) => setTimeout(r, 350));
  document.getElementById('loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  setupScroll();
  gsap.to(live, { y: POSES[0]().y, duration: 1.8, ease: 'expo.out', onComplete: () => { started = true; } });
  gsap.from('.hero__title span', { yPercent: 100, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 });
  gsap.from('.reveal, .nav', { y: 20, opacity: 0, duration: 0.9, delay: 0.4, ease: 'power3.out', stagger: 0.08 });
})();

document.body.classList.add('is-loading');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
