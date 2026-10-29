/* "Estúdio fotográfico" virtual: caixas de luz (softboxes) numa sala escura.
   Vira um mapa de reflexo (PMREM) — é ele que faz o cromado parecer cromado. */
import * as THREE from 'three';

export function createStudioEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(
    new THREE.BoxGeometry(40, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0x080808, side: THREE.BackSide }),
  ));

  const panel = (w, h, color, intensity, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };

  panel(10, 3, '#ffffff', 7, [0, 10, 3]);        // softbox de cima
  panel(2.5, 12, '#ffffff', 5, [-10, 1, 4]);     // faixa esquerda
  panel(2.5, 12, '#ffffff', 3.5, [10, 0, -1]);   // faixa direita
  panel(14, 1.2, '#ffffff', 3, [0, -1.5, 11]);   // faixa baixa na frente (linha de horizonte no metal)
  panel(6, 6, '#ff3326', 2.2, [-6, -7, -8]);     // rebatedor vermelho (cor da marca)
  panel(7, 5, '#ffd9a8', 1.6, [8, 6, -10]);      // luz quente de fundo
  panel(3, 3, '#ffffff', 9, [4, 4, 9]);          // ponto de brilho forte
  // Painel grande atrás da câmera com faixas de luz em degradê:
  // é o que as faces planas refletem — dá o contraste claro/escuro do cromado
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  [[0, '#000'], [0.12, '#111'], [0.22, '#bfc6cf'], [0.27, '#fff'], [0.33, '#556'], [0.45, '#0b0b0b'],
    [0.55, '#2a2d33'], [0.62, '#e8edf3'], [0.66, '#fff'], [0.72, '#3b3f46'], [0.85, '#080808'], [1, '#000']]
    .forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);
  const bandTex = new THREE.CanvasTexture(c);
  bandTex.colorSpace = THREE.SRGBColorSpace;
  const bands = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 16),
    new THREE.MeshBasicMaterial({ map: bandTex, color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide }),
  );
  bands.position.set(0, 1, 15);
  bands.lookAt(0, 0, 0);
  s.add(bands);
  panel(16, 2, '#ffffff', 2.2, [0, 7, 12]);      // faixa alta na frente

  // chão cinza com degradê para o reflexo de baixo não ficar preto chapado
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2a2a') }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -12;
  s.add(floor);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.015).texture;
  pmrem.dispose();
  return tex;
}
