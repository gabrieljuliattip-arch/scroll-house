/* Gotas de água na pintura vitrificada: caem, formam bolinhas (hidrofobia)
   e escorrem. Tudo é função do progresso do scroll — dá para rolar para trás. */
import * as THREE from 'three';

function fresnel(mat, edgeAlpha, power, glow) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float fres = pow(1.0 - saturate(abs(dot(normalize(normal), normalize(vViewPosition)))), ${power.toFixed(2)});
      gl_FragColor.a = mix(gl_FragColor.a, ${edgeAlpha.toFixed(2)}, fres);
      gl_FragColor.rgb += fres * ${glow.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => `fres-${edgeAlpha}-${power}-${glow}`;
  return mat;
}

export function createWater(sample) {
  const N = 420;
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 20, 14),
    fresnel(new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, envMapIntensity: 3.2, depthWrite: false,
    }), 0.97, 1.5, 0.3),
    N,
  );
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;

  // posição inicial, tamanho, quando aparece e quando começa a escorrer
  const rnd = (a, b) => a + Math.random() * (b - a);
  const drops = Array.from({ length: N }, () => {
    const big = Math.random() < 0.18;
    return {
      x: rnd(-2.7, 2.4), y: rnd(-0.4, 1.4),
      r: big ? rnd(0.04, 0.065) : rnd(0.012, 0.035),
      born: rnd(0.02, 0.28), run: rnd(0.36, 0.62), accel: big ? rnd(18, 30) : rnd(8, 16),
    };
  });

  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0);

  /** q: progresso 0..1 da seção de vitrificação */
  function update(prog) {
    drops.forEach((d, i) => {
      const grow = THREE.MathUtils.smoothstep(prog, d.born, d.born + 0.06);
      if (grow <= 0) { mesh.setMatrixAt(i, zero); return; }
      const fall = Math.max(0, prog - d.run);
      const y = d.y - fall * fall * d.accel;
      const hit = sample(d.x, y, p, n);
      if (!hit) { mesh.setMatrixAt(i, zero); return; }
      q.setFromUnitVectors(zAxis, n);
      const stretch = fall > 0 ? 1 + Math.min(1.2, fall * 6) : 1;  // alonga quando escorre
      s.set(d.r * grow, d.r * grow * stretch, d.r * 0.62 * grow);
      p.addScaledVector(n, d.r * 0.25);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}
