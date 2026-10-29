/* Tesoura + navalha 3D (geometria feita em código, sem modelos externos) */
import * as THREE from 'three';

export function createTools() {
  const group = new THREE.Group();

  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.14 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe02b2b, metalness: 0.05, roughness: 0.3 });
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xf1ebe0, metalness: 0, roughness: 0.25, clearcoat: 1 });

  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24,
  });

  /* ---------- Tesoura: duas peças que giram no parafuso ---------- */
  function piece(sign) {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.12, -0.02 * sign);
    s.lineTo(2.3, 0);
    s.quadraticCurveTo(1.0, 0.27 * sign, -0.12, 0.16 * sign);
    s.closePath();
    const blade = new THREE.Mesh(ext(s, 0.03), chrome);
    blade.position.z = -0.015;

    // Haste até a argola (do lado oposto da lâmina)
    const ringPos = new THREE.Vector2(-1.05, -0.24 * sign);
    const from = new THREE.Vector2(-0.08, 0);
    const len = from.distanceTo(ringPos) - 0.26;
    const ang = Math.atan2(ringPos.y - from.y, ringPos.x - from.x);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.13, 0.06), red);
    arm.position.set(from.x + Math.cos(ang) * len / 2, from.y + Math.sin(ang) * len / 2, 0);
    arm.rotation.z = ang;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.075, 18, 56), red);
    ring.position.set(ringPos.x - 0.05, ringPos.y, 0);
    ring.scale.x = 1.2;

    g.add(blade, arm, ring);
    g.position.z = 0.032 * sign;
    return g;
  }
  const pieceA = piece(1);
  const pieceB = piece(-1);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.17, 24), chrome);
  screw.rotation.x = Math.PI / 2;

  const scissors = new THREE.Group();
  scissors.add(pieceA, pieceB, screw);
  scissors.position.x = -0.5; // centraliza o objeto
  const scissorsHolder = new THREE.Group();
  scissorsHolder.add(scissors);
  scissorsHolder.rotation.z = 0.62;
  scissorsHolder.position.z = 0.18;
  group.add(scissorsHolder);

  /* ---------- Navalha: cabo preto + lâmina que abre ---------- */
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.15);
  hs.lineTo(2.35, -0.12);
  hs.quadraticCurveTo(2.62, 0, 2.35, 0.12);
  hs.lineTo(0, 0.15);
  hs.quadraticCurveTo(-0.22, 0, 0, -0.15);
  const handleGeo = ext(hs, 0.035);
  const scaleA = new THREE.Mesh(handleGeo, bone);
  scaleA.position.z = 0.03;
  const scaleB = new THREE.Mesh(handleGeo, bone);
  scaleB.position.z = -0.065;
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.035, 0.012), red);
  inlay.position.set(1.25, 0, 0.08);

  const pinGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.19, 16);
  const pin1 = new THREE.Mesh(pinGeo, chrome);
  pin1.rotation.x = Math.PI / 2;
  const pin2 = pin1.clone();
  pin2.position.x = 2.3;

  const bs = new THREE.Shape();
  bs.moveTo(-0.05, -0.05);
  bs.lineTo(0.3, -0.07);
  bs.quadraticCurveTo(1.2, -0.3, 2.05, -0.2);
  bs.quadraticCurveTo(2.25, -0.04, 2.08, 0.13);
  bs.lineTo(0.3, 0.13);
  bs.lineTo(-0.05, 0.07);
  bs.closePath();
  const blade = new THREE.Mesh(ext(bs, 0.016), chrome);
  blade.position.z = -0.008;
  const hinge = new THREE.Group();
  hinge.add(blade);

  const razor = new THREE.Group();
  razor.add(scaleA, scaleB, inlay, pin1, pin2, hinge);
  razor.position.x = -0.25;
  const razorHolder = new THREE.Group();
  razorHolder.add(razor);
  razorHolder.rotation.z = Math.PI - 0.62;
  razorHolder.position.z = -0.18;
  group.add(razorHolder);

  /**
   * snip: 0 (fechada) a 1 (aberta) — abertura da tesoura
   * open: 0 (navalha fechada) a 1 (aberta)
   */
  function update(snip, open) {
    const a = 0.04 + snip * 0.55;
    pieceA.rotation.z = a / 2;
    pieceB.rotation.z = -a / 2;
    hinge.rotation.z = Math.PI * open;
  }

  return { group, update };
}
