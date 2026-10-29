/* "Speed shape": a peça curva que estúdios usam para mostrar pintura.
   Pintura metálica com verniz; um shader divide a peça em
   lado polido (espelhado) e lado sem tratamento (fosco, com marcas). */
import * as THREE from 'three';

// Deforma a esfera unitária na forma de gota alongada com um vinco (linha de estilo)
export function deform(p, out = new THREE.Vector3()) {
  const t = (p.x + 1) / 2;                    // 0 = nariz, 1 = cauda
  const taper = 1 - 0.45 * Math.pow(t, 1.5);
  let X = p.x * 3.0;
  let Y = p.y * 1.55 * (0.35 + 0.65 * taper) + (p.y < 0 ? 0.12 * p.x * p.x : 0);
  let Z = p.z * 1.0 * taper;
  if (Z < 0) Z *= 0.3;
  if (Y < -0.55) Y = -0.55 + (Y + 0.55) * 0.35;      // base mais reta, como um para-lama                       // costas achatadas
  // vinco: crista estreita na face da frente
  const ridgeY = 0.22 + 0.1 * p.x;
  const d = Y - ridgeY;
  const front = THREE.MathUtils.smoothstep(Z, 0.05, 0.5);
  Z += front * (0.085 * Math.exp(-(d * d) / 0.006) - 0.045 * Math.exp(-((d + 0.35) ** 2) / 0.08));
  return out.set(X, Y, Z);
}

function speedShapeGeometry() {
  const g = new THREE.SphereGeometry(1, 420, 210);
  const pos = g.attributes.position;
  const v = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deform(v, o);
    pos.setXYZ(i, o.x, o.y, o.z);
  }
  g.computeVertexNormals();
  return g;
}

/* Mapa da superfície da frente (para posicionar politriz e gotas) */
function buildSurfaceMap(geo, NX = 160, NY = 80) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const zMap = new Float32Array(NX * NY).fill(-99);
  const nMap = new Float32Array(NX * NY * 3);
  const bx = [-3.1, 3.1], by = [-0.9, 1.7];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ix = Math.round(((x - bx[0]) / (bx[1] - bx[0])) * (NX - 1));
    const iy = Math.round(((y - by[0]) / (by[1] - by[0])) * (NY - 1));
    if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) continue;
    const k = iy * NX + ix;
    if (z > zMap[k]) {
      zMap[k] = z;
      nMap[k * 3] = nrm.getX(i); nMap[k * 3 + 1] = nrm.getY(i); nMap[k * 3 + 2] = nrm.getZ(i);
    }
  }
  /** Devolve ponto e normal da face da frente em (x, y), ou null se fora da peça */
  return function sample(x, y, outP, outN) {
    const fx = ((x - bx[0]) / (bx[1] - bx[0])) * (NX - 1), fy = ((y - by[0]) / (by[1] - by[0])) * (NY - 1);
    const ix = Math.round(fx), iy = Math.round(fy);
    if (ix < 0 || iy < 0 || ix >= NX || iy >= NY) return null;
    const k = iy * NX + ix;
    if (zMap[k] < 0.15) return null;
    outP.set(x, y, zMap[k]);
    outN.set(nMap[k * 3], nMap[k * 3 + 1], nMap[k * 3 + 2]).normalize();
    return outP;
  };
}

export function createShape() {
  const geo = speedShapeGeometry();
  const uniforms = { uWipe: { value: 0 }, uTime: { value: 0 } };

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xa30d18,          // vermelho metálico
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.15,
  });

  paint.onBeforeCompile = (shader) => {
    shader.uniforms.uWipe = uniforms.uWipe;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocal;
        uniform float uWipe;
        uniform float uTime;
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float noise2(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = hash3(vec3(i, 0.0)), b = hash3(vec3(i + vec2(1.0, 0.0), 0.0));
          float c = hash3(vec3(i + vec2(0.0, 1.0), 0.0)), d = hash3(vec3(i + vec2(1.0, 1.0), 0.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }`)
      // lado sem tratamento: cor apagada e com "névoa" de sujeira
      .replace('#include <color_fragment>', `#include <color_fragment>
        float clean = 1.0 - smoothstep(uWipe - 0.06, uWipe + 0.06, vLocal.x);
        float grime = noise2(vLocal.xy * 3.0) * 0.6 + noise2(vLocal.xy * 11.0) * 0.4;
        vec3 dull = diffuseColor.rgb * (0.55 + 0.15 * grime) + vec3(0.05, 0.055, 0.06) * grime;
        diffuseColor.rgb = mix(dull, diffuseColor.rgb, clean);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        // marcas circulares (swirls) só no lado sem polimento
        vec2 sw = vLocal.xy * 7.0;
        vec2 cell = floor(sw);
        float swirl = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = cell + vec2(float(i), float(j));
          vec2 ctr = c + vec2(hash3(vec3(c, 1.0)), hash3(vec3(c, 2.0)));
          float r = length(sw - ctr);
          swirl = max(swirl, (0.5 + 0.5 * sin(r * 90.0)) * smoothstep(0.9, 0.2, r));
        }
        material.clearcoatRoughness = clamp(mix(0.38 + 0.18 * swirl + 0.1 * grime, 0.015, clean), 0.0, 1.0);
        material.clearcoat = mix(0.55, 1.0, clean);
        material.roughness = clamp(mix(0.62, material.roughness, clean), 0.04, 1.0);`)
      // brilho metálico (flocos) que cintila com o ângulo
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float flake = step(0.9975, hash3(floor(vLocal * 520.0)));
        float view = pow(saturate(dot(normalize(normal), normalize(vViewPosition))), 8.0);
        gl_FragColor.rgb += flake * view * vec3(1.0, 0.55, 0.45) * 0.22 * clean;`);
  };
  paint.customProgramCacheKey = () => 'speed-shape-paint';

  const mesh = new THREE.Mesh(geo, paint);
  mesh.castShadow = false;
  const group = new THREE.Group();
  group.add(mesh);

  // Linha de fita crepe marcando onde termina o polimento (como no teste "50/50")
  const sample = buildSurfaceMap(geo);

  return { group, mesh, uniforms, sample };
}
