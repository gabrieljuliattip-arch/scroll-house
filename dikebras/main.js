/* ==========================================================
   Dikebras — cena 3D única com três "atos":
   1) tesoura + navalha (barbearia)  2) sinuca  3) copão
   A posição de cada objeto vem da posição das seções na tela.
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createTools } from './js/tools.js';
import { createPool } from './js/pool.js';
import { createDrink } from './js/drink.js';

gsap.registerPlugin(ScrollTrigger);

const isMobile = () => window.innerWidth < 768;
const clamp = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------- Renderer ---------- */
const canvas = document.querySelector('#webgl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 14);

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 7, 8);
scene.add(key);
const redRim = new THREE.PointLight(0xff2a2a, 55, 30);
redRim.position.set(-5, 2, -3);
scene.add(redRim);
const fill = new THREE.PointLight(0xffd2a0, 30, 30);
fill.position.set(5, -3, 4);
scene.add(fill);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

/* ---------- Objetos ---------- */
const tools = createTools();
const pool = createPool(renderer);
const drink = createDrink();
scene.add(tools.group, pool.group, drink.group);

// metade da largura visível no plano z=0
const halfW = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
const sx = () => (isMobile() ? 0 : Math.min(halfW() * 0.48, 3.4));

/* Poses da tesoura/navalha por seção */
const TOOL_POSES = [
  () => ({ x: 0, y: isMobile() ? 1.7 : 0.1, rz: 0, s: isMobile() ? 0.62 : 1.05 }),       // hero
  () => ({ x: sx(), y: isMobile() ? 2.0 : 0, rz: 0.5, s: isMobile() ? 0.5 : 0.95 }),      // cardápio
  () => ({ x: -sx(), y: isMobile() ? 2.0 : 0, rz: -0.4, s: isMobile() ? 0.5 : 0.95 }),    // mensal
  () => ({ x: sx(), y: isMobile() ? 2.0 : 0, rz: 1.2, s: isMobile() ? 0.5 : 0.95 }),      // equipe
];
const toolSections = [...document.querySelectorAll('.zone-tools > section')];
const zoneTools = document.querySelector('.zone-tools');
const sinucaEl = document.querySelector('.sinuca');
const barEl = document.querySelector('.bar');

// Estado de uma seção: entrando (0→1), fixa (0→1), saindo (0→1)
function zone(el) {
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  return {
    enter: clamp((vh - r.top) / vh),
    stick: clamp(-r.top / Math.max(1, r.height - vh)),
    exit: clamp(1 - r.bottom / vh),
  };
}

/* ---------- Mouse ---------- */
const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
const live = { tools: { ...TOOL_POSES[0](), y: -8 }, open: 0.45, snip: 0.3, pool: 0, drinkStir: 0 };
let started = false;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  const k = 1 - Math.exp(-dt * 5);
  const vh = window.innerHeight;

  /* 1) Tesoura + navalha */
  let pose = TOOL_POSES[0]();
  let cardK = 0;
  for (let i = 1; i < toolSections.length; i++) {
    const r = toolSections[i].getBoundingClientRect();
    const kk = ease(clamp((vh * 0.85 - r.top) / (vh * 0.75)));
    if (i === 1) cardK = kk;
    const q = TOOL_POSES[i]();
    for (const key in pose) pose[key] = lerp(pose[key], q[key], kk);
  }
  const zt = zone(zoneTools);
  pose.y += ease(zt.exit) * 10;
  if (started) for (const key in pose) live.tools[key] = lerp(live.tools[key], pose[key], k);
  const P = live.tools;
  tools.group.position.set(P.x, P.y + Math.sin(t * 1.2) * 0.08, 0);
  tools.group.rotation.set(mouse.y * 0.15, Math.sin(t * 0.5) * 0.35 + mouse.x * 0.25, P.rz);
  tools.group.scale.setScalar(P.s);
  tools.group.visible = zt.exit < 0.999;
  // tesoura corta conforme o scroll; navalha abre ao entrar no cardápio
  const snipTarget = 0.5 + 0.5 * Math.sin(window.scrollY * 0.012 + t * 0.6);
  live.snip = lerp(live.snip, snipTarget, k * 1.5);
  live.open = lerp(live.open, 0.45 + 0.55 * cardK, k);
  tools.update(live.snip, live.open);

  /* 2) Sinuca */
  const zs = zone(sinucaEl);
  live.pool = lerp(live.pool, zs.stick, k * 1.4);
  const poolScale = isMobile() ? 1.0 : Math.min(1.3, halfW() / 3.6);
  pool.group.position.set(0, (isMobile() ? -1.3 : -1.15) + (1 - ease(zs.enter)) * -10 + ease(zs.exit) * 10, 0);
  pool.group.rotation.set(0.95, 0, 0);
  pool.table.rotation.y = isMobile() ? Math.PI / 2 : 0;
  pool.group.scale.setScalar(poolScale);
  pool.group.visible = zs.enter > 0 && zs.exit < 1;
  pool.update(live.pool);

  /* 3) Copão */
  const zb = zone(barEl);
  live.drinkStir = lerp(live.drinkStir, zb.stick, k);
  drink.group.position.set(
    isMobile() ? 0 : sx() * 0.95,
    (isMobile() ? 1.45 : -0.1) + (1 - ease(zb.enter)) * -10 + ease(zb.exit) * 10,
    0,
  );
  drink.group.scale.setScalar(isMobile() ? 0.62 : 1.05);
  drink.cup.rotation.y = Math.sin(t * 0.4) * 0.35 + mouse.x * 0.2;
  drink.cup.rotation.x = 0.12 + mouse.y * 0.06;
  drink.group.visible = zb.enter > 0 && zb.exit < 1;
  if (drink.group.visible) drink.update(dt, t, 0.3 + 0.7 * live.drinkStir);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  ScrollTrigger.refresh();
});

/* ---------- Abas do cardápio ---------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    gsap.from(`#${tab.getAttribute('aria-controls')} li`, { x: -20, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
  });
});

/* ---------- Animações do texto ---------- */
function setupScroll() {
  gsap.to('.hero__title', {
    yPercent: 30, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.utils.toArray('.panel__text, .stage__text, .contato__title, .contato__grid').forEach((el) => {
    gsap.from(el, {
      y: 70, opacity: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
    });
  });
  gsap.to('.stage__hint', {
    opacity: 0, scrollTrigger: { trigger: '.sinuca', start: 'top -20%', end: 'top -40%', scrub: true },
  });
}

/* ---------- Início ---------- */
async function init() {
  const bar = document.getElementById('loaderBar');
  bar.style.width = '40%';
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 100px "Archivo Black"'), document.fonts.load('400 40px "Permanent Marker"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* segue com fonte reserva */ }
  renderer.compile(scene, camera);
  tick();
  bar.style.width = '100%';
  await new Promise((r) => setTimeout(r, 400));
  document.getElementById('loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  setupScroll();

  // Entrada: ferramentas sobem girando
  live.tools.y = -8;
  gsap.to(live.tools, {
    y: TOOL_POSES[0]().y, duration: 1.6, ease: 'expo.out', delay: 0.1,
    onComplete: () => { started = true; },
  });
  gsap.from('.hero__title span', { yPercent: 100, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 });
  gsap.from('.reveal, .nav', { y: 20, opacity: 0, duration: 0.9, delay: 0.5, ease: 'power3.out', stagger: 0.08 });
}

document.body.classList.add('is-loading');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
init();
