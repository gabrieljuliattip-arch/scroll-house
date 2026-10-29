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

  // ponto de impacto, tamanho, quando bate e quão rápido escorre
  const rnd = (a, b) => a + Math.random() * (b - a);
  const drops = Array.from({ length: N }, () => {
    const big = Math.random() < 0.2;
    return {
      x: rnd(-2.7, 2.4), y: rnd(-0.2, 1.45),
      r: big ? rnd(0.035, 0.06) : rnd(0.012, 0.032),
      hit: rnd(0.03, 0.8),                       // momento em que bate na pintura
      v0: rnd(0.6, 1.4), accel: big ? rnd(30, 45) : rnd(14, 26),
    };
  });

  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1), zero = new THREE.Matrix4().makeScale(0, 0, 0), ident = new THREE.Quaternion();
  const FALL = 0.035; // trecho do scroll em que a gota está caindo no ar

  /** prog: progresso 0..1 da seção de vitrificação (rolar para trás desfaz) */
  function update(prog) {
    drops.forEach((d, i) => {
      const t = prog - d.hit;
      if (t < -FALL) { mesh.setMatrixAt(i, zero); return; }
      if (t < 0) {
        // caindo no ar até o ponto de impacto
        if (!sample(d.x, d.y, p, n)) { mesh.setMatrixAt(i, zero); return; }
        const k = 1 + t / FALL; // 0 → 1
        p.y += (1 - k) * 1.6;
        p.z += (1 - k) * 0.6;
        s.set(d.r * 0.8, d.r * 1.5, d.r * 0.8);
        m4.compose(p, ident, s);
        mesh.setMatrixAt(i, m4);
        return;
      }
      // bateu: já escorre, acelerando
      const y = d.y - (d.v0 * t + t * t * d.accel);
      if (!sample(d.x, y, p, n)) { mesh.setMatrixAt(i, zero); return; }
      q.setFromUnitVectors(zAxis, n);
      const splash = 1 + 0.35 * Math.exp(-t * 90);          // "achata" no impacto
      const stretch = 1 + Math.min(1.4, t * 9);               // alonga ao escorrer
      s.set(d.r * splash, d.r * stretch, d.r * 0.55 / splash);
      p.addScaledVector(n, d.r * 0.22);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}
