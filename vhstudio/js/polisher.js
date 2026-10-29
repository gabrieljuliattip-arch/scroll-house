/* Politriz roto-orbital (DA) com boina de espuma laranja.
   Origem = centro da face da boina; a boina encosta no plano z=0 e a máquina fica em +Z. */
import * as THREE from 'three';

function foamBump() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random() > 0.5 ? 200 : 40;
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

const lathe = (pts, mat, seg = 64) => {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  g.rotateX(Math.PI / 2); // eixo do torno vira +Z
  return new THREE.Mesh(g, mat);
};

export function createPolisher() {
  const group = new THREE.Group();   // posicionado na superfície
  const machine = new THREE.Group(); // gira em volta da normal (ângulo do cabo)
  group.add(machine);

  const foam = new THREE.MeshStandardMaterial({ color: 0x26272b, roughness: 1, bumpMap: foamBump(), bumpScale: 1.2 });
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x15171b, roughness: 0.75 });
  const body = new THREE.MeshPhysicalMaterial({ color: 0x23262d, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const accent = new THREE.MeshPhysicalMaterial({ color: 0xe3262f, roughness: 0.25, clearcoat: 1 });
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xc8ccd3, metalness: 1, roughness: 0.25 });

  // Boina (gira) + prato de apoio
  const pad = new THREE.Group();
  const foamPad = lathe([[0, 0], [0.38, 0], [0.42, 0.025], [0.43, 0.08], [0.41, 0.13], [0.37, 0.15], [0, 0.15]], foam);
  const face = lathe([[0, 0.0], [0.3, 0.0], [0.3, 0.002], [0, 0.002]], new THREE.MeshStandardMaterial({ color: 0x303136, roughness: 1 }));
  const plate = lathe([[0, 0.15], [0.34, 0.15], [0.36, 0.17], [0.3, 0.2], [0.12, 0.22], [0, 0.22]], rubber);
  // marca na boina para ver o giro
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  mark.position.set(0.16, 0, 0.222);
  pad.add(foamPad, face, plate, mark);
  machine.add(pad);

  // Eixo e cabeça
  const spindle = lathe([[0, 0.22], [0.1, 0.22], [0.1, 0.32], [0.2, 0.36], [0.24, 0.5], [0.22, 0.62], [0, 0.66]], body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.022, 12, 48), accent);
  ring.position.z = 0.48;
  machine.add(spindle, ring);

  // Corpo: tubo perpendicular à boina, subindo em +Y
  const tubeGeo = new THREE.CapsuleGeometry(0.19, 1.25, 12, 32);
  const tube = new THREE.Mesh(tubeGeo, body);
  tube.position.set(0, 0.78, 0.55);
  machine.add(tube);
  // Pega emborrachada no final
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.55, 32, 1, true), rubber);
  grip.position.set(0, 1.18, 0.55);
  machine.add(grip);
  // Faixa de cor da marca e controle de velocidade
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.198, 0.06, 32), accent);
  band.position.set(0, 0.42, 0.55);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), metal);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 1.55, 0.6);
  machine.add(band, dial);
  // Manopla frontal (em cima da cabeça)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), rubber);
  knob.scale.set(1, 0.8, 1.15);
  knob.position.set(0, -0.08, 0.86);
  machine.add(knob);
  // Cabo de energia saindo do fim
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.48, 0.55), new THREE.Vector3(0.05, 1.85, 0.6), new THREE.Vector3(0.4, 2.3, 0.4), new THREE.Vector3(1.2, 2.8, 0.1),
    ]), 48, 0.035, 10),
    rubber,
  );
  machine.add(cable);

  const up = new THREE.Vector3(0, 0, 1), q = new THREE.Quaternion();
  let spin = 0;
  /** Coloca a politriz no ponto p com normal n; t = tempo para girar a boina */
  function place(p, n, t, dt, roll = -0.55) {
    q.setFromUnitVectors(up, n);
    group.quaternion.copy(q);
    group.position.copy(p).addScaledVector(n, 0.004);
    machine.rotation.z = roll;
    spin += dt * 26;
    pad.rotation.z = spin;
    // movimento orbital (excêntrico) da boina
    pad.position.set(Math.cos(t * 40) * 0.012, Math.sin(t * 40) * 0.012, 0);
  }
  return { group, place };
}
