import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbSeed } from "@/lib/resonance";

type Props = {
  seed: OrbSeed;
  size?: number;
  className?: string;
  /** When true, render a single frame (no animation, no breathing). */
  staticFrame?: boolean;
};

// --- Shaders ---------------------------------------------------------------
//
// Rewritten from scratch:
//  * Smooth high-poly sphere geometry (no visible facets).
//  * Domain-warped fbm noise for a soft nebula look.
//  * Analytical fresnel rim + soft specular instead of a second back-face mesh.
//  * Full device pixel ratio so it doesn't look pixelated on retina.
//
// The shader writes its own alpha so the orb fades out gently at the silhouette
// instead of clipping on a hard sphere edge.

const VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const NOISE = /* glsl */ `
  // Simplex 3D
  vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_*ns.x + ns.yyyy;
    vec4 y = y_*ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m*m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Domain-warped fractal brownian motion — gives the nebula its "swirly" feel.
  float fbm(vec3 p){
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p = p * 2.05 + vec3(11.3, 7.7, 5.1);
      a *= 0.5;
    }
    return v;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform float uTime;
  uniform float uHue;
  uniform float uSat;
  uniform float uTurb;
  uniform float uHash;
  ${NOISE}

  vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);

    // Domain warp for the swirly look.
    vec3 p = vPos * uTurb + vec3(uHash * 13.0);
    vec3 warp = vec3(
      fbm(p + vec3(0.0, 0.0, uTime * 0.10)),
      fbm(p + vec3(5.2, 1.3, uTime * 0.13)),
      fbm(p + vec3(2.1, 4.7, uTime * 0.07))
    );
    float density = fbm(p + warp * 0.85 + vec3(uTime * 0.08));
    density = smoothstep(-0.55, 0.95, density);

    // Three palette stops mixed by density.
    vec3 colHi  = hsv2rgb(vec3(uHue,                       uSat,        1.00));
    vec3 colMid = hsv2rgb(vec3(mod(uHue + 0.08, 1.0),      uSat * 0.95, 0.70));
    vec3 colLo  = hsv2rgb(vec3(mod(uHue + 0.55, 1.0),      uSat * 0.55, 0.18));
    vec3 col = mix(colLo, colMid, smoothstep(0.0, 0.55, density));
    col = mix(col, colHi, smoothstep(0.55, 1.0, density));

    // Soft lighting + rim.
    vec3 L = normalize(vec3(0.4, 0.8, 0.9));
    float diff = max(dot(N, L), 0.0) * 0.55 + 0.55;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
    col *= diff;
    col += fres * hsv2rgb(vec3(mod(uHue - 0.04, 1.0), 0.6, 1.0)) * 0.7;

    // Subtle specular pop.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 64.0);
    col += spec * 0.45;

    // Silhouette fade so the edge isn't a hard circle.
    float edge = smoothstep(0.0, 0.35, dot(N, V));
    float alpha = clamp(edge + fres * 0.6, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

export function NebulaOrb({ seed, size = 220, className, staticFrame = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const test = document.createElement("canvas");
    const hasWebGL = !!(test.getContext("webgl2") || test.getContext("webgl"));
    if (!hasWebGL) {
      // Graceful CSS fallback so the screen never goes empty.
      host.style.background = `radial-gradient(circle at 35% 35%,
        hsl(${seed.hue * 360} ${seed.saturation * 100}% 65%),
        hsl(${(seed.hue + 0.12) * 360} 60% 25%) 60%,
        transparent 75%)`;
      host.style.borderRadius = "50%";
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    // Full retina, capped at 2 for battery on dense mobile screens.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 3.4);

    const uniforms = {
      uTime: { value: seed.hash * 8.0 },
      uHue: { value: seed.hue },
      uSat: { value: seed.saturation },
      uTurb: { value: seed.turbulence },
      uHash: { value: seed.hash },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
    });

    // Smooth sphere — no visible polygon facets at any reasonable size.
    const geometry = new THREE.SphereGeometry(1, 96, 96);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = seed.hash * Math.PI * 2;
    mesh.rotation.x = seed.hash * 0.6;
    scene.add(mesh);

    let raf = 0;
    let lastFrame = 0;
    const TARGET_FPS = 30;
    const FRAME_MS = 1000 / TARGET_FPS;

    const renderOnce = () => renderer.render(scene, camera);

    if (staticFrame) {
      renderOnce();
    } else {
      const start = performance.now();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - lastFrame < FRAME_MS) return;
        lastFrame = now;
        const t = (now - start) / 1000;
        uniforms.uTime.value = t * 0.6 + seed.hash * 8.0;
        // Breathing — gentle, ~4s period.
        const breathe = 1.0 + Math.sin((t * Math.PI * 2) / 4) * 0.055;
        mesh.scale.setScalar(breathe);
        mesh.rotation.y = t * 0.12 * seed.speed + seed.hash * Math.PI * 2;
        mesh.rotation.x = Math.sin(t * 0.08 * seed.speed) * 0.18;
        renderOnce();
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [seed.hue, seed.saturation, seed.speed, seed.turbulence, seed.hash, size, staticFrame]);

  return <div ref={ref} className={className} style={{ width: size, height: size }} />;
}
