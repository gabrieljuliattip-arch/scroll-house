/* Estúdio de estética automotiva virtual: teto com luminárias hexagonais de LED
   (o "favo de mel" que todo detalhador usa) + réguas de luz nas paredes.
   Vira o mapa de reflexo — é o que aparece espelhado na pintura. */
import * as THREE from 'three';

export function createDetailingStudio(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(60, 30, 60),
    new THREE.MeshBasicMaterial({ color: 0x0a0b0e, side: THREE.BackSide }),
  ));

  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 7.2, 7.6) });
  const bar = new THREE.BoxGeometry(1, 0.16, 0.16);

  // Grade hexagonal no teto (cada lado do hexágono é uma régua de LED)
  const R = 1.25;               // raio do hexágono
  const W = Math.sqrt(3) * R;   // largura entre lados
  const ceil = new THREE.Group();
  const seen = new Set();
  for (let row = -5; row <= 5; row++) {
    for (let col = -6; col <= 6; col++) {
      const cx = col * W + (row % 2 ? W / 2 : 0);
      const cz = row * R * 1.5;
      for (let k = 0; k < 6; k++) {
        const a0 = Math.PI / 6 + (k * Math.PI) / 3, a1 = a0 + Math.PI / 3;
        const x0 = cx + Math.cos(a0) * R, z0 = cz + Math.sin(a0) * R;
        const x1 = cx + Math.cos(a1) * R, z1 = cz + Math.sin(a1) * R;
        const key = [Math.round((x0 + x1) * 50), Math.round((z0 + z1) * 50)].join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const m = new THREE.Mesh(bar, led);
        m.scale.x = R * 0.92;
        m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
        m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
        ceil.add(m);
      }
    }
  }
  ceil.position.set(0, 7, 3);
  ceil.rotation.x = 0.12;
  s.add(ceil);

  // Réguas verticais nas paredes (reflexos longos nas laterais da peça)
  const strip = (x, z, h, intensity) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity * 1.05) }));
    m.position.set(x, 0, z);
    s.add(m);
  };
  for (const x of [-14, -9, 9, 14]) strip(x, -14, 16, 3);
  for (const z of [-6, 0, 6]) { strip(-18, z, 16, 2.4); strip(18, z, 16, 2.4); }

  // Painel de luz suave atrás da câmera (dá o "corpo" claro na pintura)
  const soft = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.6, 0.7) }));
  soft.position.set(0, 2, 20);
  soft.lookAt(0, 0, 0);
  s.add(soft);

  // Piso escuro levemente claro (horizonte embaixo da peça)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x1a1c22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  s.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.0).texture;
  pmrem.dispose();
  return tex;
}
