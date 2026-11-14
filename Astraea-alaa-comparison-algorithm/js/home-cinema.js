/* TerraTwin — cinematic home page.
   - Live 3D space (three.js): Earth, Mars, Moon with real textures, pins for every site in the dataset.
   - Scroll story (GSAP ScrollTrigger + Lenis): Hero → Explore → Twin pair → Results → Outro.
   - Similarity is computed here with the team's TASI formula from data/terratwin-real.js. */
import * as THREE from 'three';

/* ================= page links (edit here once) ================= */
const LINKS = {
  finder: 'finder.html',
  compare: 'compare.html',
  lab: 'lab.html',
  evidence: 'evidence.html',
  guide: 'guide.html',
  login: 'login.html',
  register: 'register.html',
};
document.querySelectorAll('[data-link]').forEach((a) => { a.href = LINKS[a.dataset.link] || '#'; });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEG = Math.PI / 180;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
gsap.registerPlugin(ScrollTrigger);

/* ================= data + TASI ================= */
const R = window.TERRATWIN_REAL;
const EARTH = R.earth;                                   // sites that passed the NDVI gate
const TARGETS = [...R.targets.mars, ...R.targets.moon];
const W = { slope: 0.25, roughness: 0.25, albedo: 0.25, thermal: 0.25 }; // TASI Baseline
function tasi(e, t) {
  const keys = t.body === 'moon' ? ['slope', 'roughness', 'albedo'] : ['slope', 'roughness', 'albedo', 'thermal'];
  let s = 0, w = 0;
  for (const k of keys) { const d = e.f[k] - t.f[k]; s += W[k] * d * d; w += W[k]; }
  return 100 * (1 - Math.sqrt(s / w));
}
const bestEarth = (t) => EARTH.reduce((b, e) => { const s = tasi(e, t); return s > b.s ? { e, s } : b; }, { e: null, s: -1 });
const bestTarget = (e) => TARGETS.reduce((b, t) => { const s = tasi(e, t); return s > b.s ? { t, s } : b; }, { t: null, s: -1 });
const ORDER = ['mars-1', 'moon-11', 'mars-3', 'moon-25', 'moon-27', 'mars-8', 'mars-2', 'moon-28', 'mars-5', 'moon-3', 'mars-7', 'moon-4'];
const featured = TARGETS.filter((t) => t.featured).sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99);
const PAIRS = featured.map((t) => { const b = bestEarth(t); return { t, e: b.e, s: b.s }; });

/* ================= renderer / scene ================= */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 1200);
const CAM_Z = 6.5;
camera.position.set(0, 0, 110);

const sunDir = new THREE.Vector3(-4, 1.6, 3).normalize();
const sun = new THREE.DirectionalLight(0xffffff, 2.7); sun.position.copy(sunDir).multiplyScalar(10); scene.add(sun);
scene.add(new THREE.AmbientLight(0x8899bb, 0.07));

/* loading manager drives the start screen counter */
const manager = new THREE.LoadingManager();
let loadPct = 0;
manager.onProgress = (_, l, t) => { loadPct = l / t; };
manager.onLoad = () => { loadPct = 1; };
manager.onError = () => {};
const tl = new THREE.TextureLoader(manager);
const TEX = 'assets/home-cinema/tex/';
const tex = (f, srgb = true) => { const t = tl.load(TEX + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/* ---------- stars: a long tunnel so the camera can warp through it ---------- */
function makeStars(n, spread, zMin, zMax, size) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3), ph = new Float32Array(n);
  const tint = [new THREE.Color('#ffffff'), new THREE.Color('#cfe4ff'), new THREE.Color('#ffe2c2'), new THREE.Color('#bcd2ff')];
  for (let i = 0; i < n; i++) {
    const r = spread * Math.sqrt(Math.random()) + 8, a = Math.random() * Math.PI * 2;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.sin(a) * r * 0.75; p[i * 3 + 2] = zMin + Math.random() * (zMax - zMin);
    const col = tint[(Math.random() * tint.length) | 0]; c.set([col.r, col.g, col.b], i * 3); ph[i] = Math.random() * 6.28;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uT: { value: 0 }, uSize: { value: size * renderer.getPixelRatio() } },
    vertexShader: `attribute float ph; varying vec3 vC; varying float vA; uniform float uT; uniform float uSize;
      void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
      float tw=.55+.45*sin(uT*1.6+ph*3.);
      vA=tw*clamp(-mv.z/30.,0.,1.); gl_PointSize=uSize*(.6+.8*fract(ph*7.13))*(60./-mv.z); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d);
      float a=smoothstep(.5,0.,r); a*=a; gl_FragColor=vec4(vC*a*vA,1.); }`,
  });
  return new THREE.Points(g, m);
}
const starsFar = makeStars(9000, 260, -500, 140, 2.4);
const starsNear = makeStars(1800, 60, -120, 140, 3.2);
scene.add(starsFar, starsNear);

/* ---------- nebula: soft coloured light far behind ---------- */
function glowTex(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
[['rgba(60,90,200,1)', -40, 18, -140, 150, .16], ['rgba(140,60,160,1)', 60, -25, -170, 170, .1], ['rgba(255,120,60,1)', 70, 30, -220, 120, .07], ['rgba(40,140,190,1)', -80, -40, -200, 140, .08]]
  .forEach(([c, x, y, z, s, o]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(c), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(x, y, z); sp.scale.setScalar(s); scene.add(sp); });

/* ---------- planets ---------- */
function atmosphere(color, scale, strength) {
  return new THREE.Mesh(new THREE.SphereGeometry(scale, 64, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uS: { value: strength }, uSun: { value: sunDir }, uEdge: { value: Math.sqrt(1 - 1 / (scale * scale)) } },
    vertexShader: `varying vec3 vN; varying vec3 vNw; void main(){ vN=normalize(normalMatrix*normal); vNw=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uC; uniform float uS; uniform vec3 uSun; uniform float uEdge; varying vec3 vN; varying vec3 vNw;
      void main(){ float z=-vN.z; float i=smoothstep(0.,uEdge,z); i=pow(i,2.2);
        float lit=.25+.75*smoothstep(-.4,.6,dot(vNw,uSun));
        gl_FragColor=vec4(uC*i*uS*lit,1.); }`,
  }));
}
function makeEarth() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: tex('earth_atmos_2048.jpg') }, uNight: { value: tex('earth_lights_2048.png') }, uSun: { value: sunDir } },
    vertexShader: `varying vec2 vUv; varying vec3 vNw; varying vec3 vPw;
      void main(){ vUv=uv; vNw=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vPw=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; varying vec2 vUv; varying vec3 vNw; varying vec3 vPw;
      void main(){ vec3 n=normalize(vNw); float d=dot(n,uSun); float day=smoothstep(-.12,.28,d);
        vec3 dc=texture2D(uDay,vUv).rgb*(.06+1.05*max(d,0.));
        vec3 nc=texture2D(uNight,vUv).rgb*vec3(1.,.78,.5)*1.4;
        vec3 col=mix(nc,dc,day);
        vec3 v=normalize(cameraPosition-vPw); float fr=pow(1.-max(dot(n,v),0.),3.);
        col+=vec3(.32,.6,1.)*fr*(.1+.9*smoothstep(-.3,.6,d))*.45;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surf = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), mat);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 96), new THREE.MeshLambertMaterial({ map: tex('earth_clouds_1024.png'), transparent: true, opacity: .75, depthWrite: false }));
  g.add(surf, clouds, atmosphere('#4c9bff', 1.07, .9));
  g.userData.clouds = clouds;
  return g;
}
function makeRocky(map, bump, bumpScale, atmo) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), new THREE.MeshStandardMaterial({ map: tex(map), bumpMap: tex(bump, false), bumpScale, roughness: 1, metalness: 0 }));
  g.add(m);
  if (atmo) g.add(atmosphere(atmo, 1.035, .35));
  return g;
}
const PL = {
  earth: { g: makeEarth() },
  mars: { g: makeRocky('marsmap1k.jpg', 'marsbump1k.jpg', 3, '#ff8a55') },
  moon: { g: makeRocky('moon_1024.jpg', 'moon_1024.jpg', 2.2, null) },
};
for (const [k, p] of Object.entries(PL)) {
  p.k = k; p.pos = new THREE.Vector3(0, 0, -30); p.s = 0.0001; p.tgt = { x: 0, y: 0, z: 0, s: 0.0001 };
  p.face = null; p.userY = 0; p.spin = k === 'earth' ? 0.05 : 0.035; p.g.rotation.x = 0.18;
  p.g.rotation.y = k === 'earth' ? -2.2 : 0.6; p.g.scale.setScalar(0.0001); p.pins = [];
  scene.add(p.g);
}

/* ---------- pins (one per site in the dataset) ---------- */
const pinTex = glowTex('rgba(255,255,255,1)');
const COL = { mars: '#ff8a55', moon: '#e4ecf6', earth: '#f2cf8a' };
function latLon(lat, lon, r = 1.008) {
  const phi = (90 - lat) * DEG, th = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
function addPin(body, d, big) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex, color: COL[body], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.copy(latLon(d.lat, d.lon)); sp.userData = { body, d, base: big ? .085 : .055, on: 0, hi: 0, ph: Math.random() * 6 };
  sp.scale.setScalar(sp.userData.base); PL[body].g.add(sp); PL[body].pins.push(sp); return sp;
}
EARTH.forEach((e) => addPin('earth', e, e.is_official));
TARGETS.forEach((t) => addPin(t.body, t, t.featured));
const pinOf = (d) => PL[d.body].pins.find((p) => p.userData.d === d);

/* ---------- twin beam: particles flowing from the target pin to its Earth twin ---------- */
const BEAM_N = 140;
const beamGeo = new THREE.BufferGeometry();
beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BEAM_N * 3), 3));
const bt = new Float32Array(BEAM_N); for (let i = 0; i < BEAM_N; i++) bt[i] = i / BEAM_N + Math.random() * .004;
beamGeo.setAttribute('aT', new THREE.BufferAttribute(bt, 1));
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uO: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uT: { value: 0 } },
  vertexShader: `attribute float aT; varying float vF; uniform float uPx; uniform float uT; void main(){ vF=sin(fract(aT+uT*.18)*3.1416); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*(2.+5.*vF)*(7./-mv.z); }`,
  fragmentShader: `uniform float uO; varying float vF; void main(){ float r=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,r); gl_FragColor=vec4(vec3(1.,.82,.52)*a*uO*(.35+vF),1.); }`,
});
const beam = new THREE.Points(beamGeo, beamMat); beam.frustumCulled = false; scene.add(beam);
const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
const lineMat = new THREE.LineBasicMaterial({ color: 0xe9c47e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const line = new THREE.Line(lineGeo, lineMat); line.frustumCulled = false; scene.add(line);

/* ---------- shock ring when switching worlds ---------- */
const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.012, 128), new THREE.MeshBasicMaterial({ color: 0xe9c47e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(ring);
function shock(p) { if (reduced) return; ring.position.copy(p.pos); ring.scale.setScalar(p.tgt.s * 1.05); ring.material.opacity = .9; gsap.to(ring.scale, { x: p.tgt.s * 2.6, y: p.tgt.s * 2.6, duration: 1.4, ease: 'expo.out' }); gsap.to(ring.material, { opacity: 0, duration: 1.4, ease: 'power2.out' }); }

/* ================= scene layouts ================= */
let SCENE = 'hero', world = 'earth', pair = null, pairIdx = 0;
const narrow = () => innerWidth / innerHeight < .9;
const H = { x: 0, y: 0, z: 0, s: 0.0001 };
function layout() {
  const n = narrow();
  const L = {
    hero: n ? { earth: { x: .15, y: 1.45, s: .78 }, moon: { x: .85, y: 2.05, z: -1, s: .12 }, mars: { x: -.8, y: 2.3, z: -6, s: .4 } }
            : { earth: { x: 2.2, y: -.15, s: 1.55 }, moon: { x: .45, y: 1.4, z: -1, s: .2 }, mars: { x: .35, y: -1.85, z: -5, s: .42 } },
    explore: { [world]: n ? { x: 0, y: 1.25, s: .8 } : { x: 1.8, y: -.05, s: 1.42 } },
    twin: pair ? (n ? { [pair.t.body]: { x: -.52, y: .55, s: .4 }, earth: { x: .52, y: .55, s: .4 } }
                    : { [pair.t.body]: { x: -2.15, y: .5, s: .7 }, earth: { x: 2.15, y: .5, s: .7 } }) : {},
    results: n ? { moon: { x: -1.1, y: 1.5, s: .3 }, earth: { x: 0, y: 1.55, s: .42 }, mars: { x: 1.1, y: 1.5, s: .34 } }
               : { moon: { x: -2.6, y: 1.2, s: .42 }, earth: { x: 0, y: 1.25, s: .62 }, mars: { x: 2.6, y: 1.2, s: .5 } },
    outro: { earth: { x: n ? 0 : 1.4, y: n ? -3.4 : -4.25, s: n ? 2.4 : 3.05 }, moon: { x: -3.1, y: 1.35, z: -5, s: .28 }, mars: { x: 3.4, y: 1.6, z: -8, s: .42 } },
  }[SCENE];
  for (const k in PL) {
    const t = L[k], p = PL[k];
    if (t) p.tgt = { x: t.x, y: t.y, z: t.z || 0, s: t.s };
    else p.tgt = { x: p.tgt.x * 1.6 || (k === 'mars' ? 5 : -5), y: p.tgt.y, z: -4, s: 0.0001 };
  }
  // facing: in twin mode each planet turns its pin toward the camera
  for (const k in PL) PL[k].face = null;
  if (SCENE === 'twin' && pair) { setFace(PL[pair.t.body], pair.t); setFace(PL.earth, pair.e); }
  // pins
  for (const k in PL) for (const s of PL[k].pins) {
    const d = s.userData.d;
    s.userData.on = SCENE === 'explore' && k === world ? 1 : SCENE === 'twin' && pair && (d === pair.t || d === pair.e) ? 1 : 0;
    s.userData.hi = SCENE === 'twin' && pair && (d === pair.t || d === pair.e) ? 1 : 0;
  }
}
function setFace(p, d) {
  const phi = (90 - d.lat) * DEG, th = (d.lon + 180) * DEG;
  const a = Math.atan2(-Math.sin(phi) * Math.cos(th), Math.sin(phi) * Math.sin(th));
  const yaw = Math.atan2(-p.tgt.x, CAM_Z - p.tgt.z), pitch = Math.atan2(p.tgt.y, CAM_Z);
  p.face = { ry: -a + yaw * .9, rx: d.lat * DEG * .9 + pitch * .6 };
}
function setScene(name) {
  if (SCENE === name) return;
  SCENE = name; layout();
  $$('#chap a').forEach((a) => a.classList.toggle('on', a.dataset.sec === name));
  $('#chap').classList.toggle('on', name !== 'hero');
  beamTarget = name === 'twin' ? 1 : 0;
  if (name === 'twin') startAuto(); else stopAuto();
}

/* ================= loop ================= */
const clock = new THREE.Clock();
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
let beamTarget = 0, camZ = 110, introDone = false;
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), tmp = new THREE.Vector3();
function shortest(from, to) { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return from + d; }
// In the twin and results sections the planets ride with their section while it
// scrolls, so they never slide over the text of that section.
const VIEW_H = 2 * Math.tan(camera.fov * DEG / 2);           // world height per unit of camera distance
function sectionShift() {
  if (SCENE !== 'twin' && SCENE !== 'results') return 0;
  const sec = document.getElementById(SCENE); if (!sec) return 0;
  return (-sec.getBoundingClientRect().top / innerHeight) * VIEW_H * CAM_Z;
}
function tick() {
  const dt = Math.min(clock.getDelta(), .1), T = clock.elapsedTime;
  const k = 1 - Math.exp(-dt * 2.6), ky = 1 - Math.exp(-dt * 7);
  const shiftY = sectionShift();
  for (const p of Object.values(PL)) {
    p.pos.x += (p.tgt.x - p.pos.x) * k; p.pos.y += (p.tgt.y + shiftY - p.pos.y) * ky; p.pos.z += (p.tgt.z - p.pos.z) * k;
    p.s += (p.tgt.s - p.s) * k;
    p.g.position.copy(p.pos); p.g.scale.setScalar(Math.max(p.s, 0.0001)); p.g.visible = p.s > 0.003;
    if (p.face) {
      p.g.rotation.y += (shortest(p.g.rotation.y, p.face.ry) - p.g.rotation.y) * k * 1.3;
      p.g.rotation.x += (p.face.rx - p.g.rotation.x) * k * 1.3;
    } else {
      p.g.rotation.y += (p.spin + p.userY) * dt; p.userY *= .94;
      p.g.rotation.x += (.18 - p.g.rotation.x) * k * .5;
    }
    if (p.g.userData.clouds) p.g.userData.clouds.rotation.y += dt * .012;
    for (const s of p.pins) {
      const u = s.userData; const o = s.material.opacity, to = u.on * (u.hi ? 1 : .85);
      s.material.opacity = o + (to - o) * k * 1.5;
      const pulse = u.hi ? 1.6 + .5 * Math.sin(T * 3 + u.ph) : 1 + .18 * Math.sin(T * 2 + u.ph);
      s.scale.setScalar(u.base * pulse * (hoverPin === s ? 1.8 : 1));
    }
  }
  // camera: intro warp + mouse parallax
  mouse.sx += (mouse.x - mouse.sx) * k; mouse.sy += (mouse.y - mouse.sy) * k;
  camera.position.set(mouse.sx * .22, -mouse.sy * .14, camZ);
  camera.lookAt(mouse.sx * .06, -mouse.sy * .04, 0);
  starsFar.material.uniforms.uT.value = T; starsNear.material.uniforms.uT.value = T;
  starsNear.rotation.z = T * .004; starsFar.rotation.z = -T * .002;
  ring.lookAt(camera.position);
  // twin beam
  const bo = beamMat.uniforms.uO.value; beamMat.uniforms.uO.value = bo + (beamTarget * (pair ? 1 : 0) - bo) * k;
  lineMat.opacity = beamMat.uniforms.uO.value * .28; beamMat.uniforms.uT.value = T;
  if (pair && beamMat.uniforms.uO.value > .01) {
    pinOf(pair.t).getWorldPosition(A); pinOf(pair.e).getWorldPosition(B);
    C.addVectors(A, B).multiplyScalar(.5); C.y += .45; C.z += 1.2;
    const bp = beamGeo.attributes.position.array, at = beamGeo.attributes.aT.array;
    for (let i = 0; i < BEAM_N; i++) { const t = (at[i] + T * .18) % 1; bez(t, tmp); bp[i * 3] = tmp.x; bp[i * 3 + 1] = tmp.y; bp[i * 3 + 2] = tmp.z; }
    beamGeo.attributes.position.needsUpdate = true;
    const lp = lineGeo.attributes.position.array;
    for (let i = 0; i < 80; i++) { bez(i / 79, tmp); lp[i * 3] = tmp.x; lp[i * 3 + 1] = tmp.y; lp[i * 3 + 2] = tmp.z; }
    lineGeo.attributes.position.needsUpdate = true;
  }
  // hero coordinate readout follows the meridian facing the camera
  if (SCENE === 'hero' && T % .25 < dt) {
    const ry = PL.earth.g.rotation.y; let lon = Math.atan2(-Math.cos(ry), -Math.sin(ry)) / DEG;
    $('#heroCoords').textContent = `EARTH · LIVE MERIDIAN ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  }
  updateTip();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function bez(t, out) { const u = 1 - t; out.set(u * u * A.x + 2 * u * t * C.x + t * t * B.x, u * u * A.y + 2 * u * t * C.y + t * t * B.y, u * u * A.z + 2 * u * t * C.z + t * t * B.z); return out; }
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); layout(); ScrollTrigger.refresh(); });
addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });

/* ================= pins: hover + click, drag to rotate ================= */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hoverPin = null, drag = null;
function pickPin(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const live = []; for (const p of Object.values(PL)) if (p.g.visible) for (const s of p.pins) if (s.material.opacity > .3) live.push(s);
  const hits = ray.intersectObjects(live, false);
  for (const h of hits) { const s = h.object, pg = PL[s.userData.body].g; s.getWorldPosition(A); B.copy(camera.position).sub(pg.position); if (A.sub(pg.position).dot(B) > 0) return s; }
  return null;
}
canvas.addEventListener('pointermove', (e) => {
  if (drag) { const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); const p = PL[world]; if (SCENE === 'explore' || SCENE === 'hero') p.g.rotation.y += dx * .006; return; }
  hoverPin = pickPin(e.clientX, e.clientY); canvas.style.cursor = hoverPin ? 'pointer' : (SCENE === 'explore' ? 'grab' : 'default');
  $('#cur').classList.toggle('big', !!hoverPin);
});
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, moved: 0 }; });
addEventListener('pointerup', (e) => {
  const d = drag; drag = null; if (!d || d.moved > 6) return;
  const s = pickPin(e.clientX, e.clientY); if (!s) return;
  const site = s.userData.d;
  if (site.body === 'earth') { const b = bestTarget(site); showPair({ t: b.t, e: site, s: tasi(site, b.t) }, true); }
  else { const b = bestEarth(site); showPair({ t: site, e: b.e, s: b.s }, true); }
});
const tip = $('#pinTip');
function updateTip() {
  if (!hoverPin) { tip.hidden = true; return; }
  hoverPin.getWorldPosition(tmp); tmp.project(camera);
  const d = hoverPin.userData.d; tip.hidden = false;
  tip.style.left = (tmp.x * .5 + .5) * innerWidth + 'px'; tip.style.top = (-tmp.y * .5 + .5) * innerHeight + 'px';
  tip.innerHTML = `${d.body === 'earth' ? (d.region || 'Earth') : d.body.toUpperCase()}<b>${d.name}</b>`;
}

/* ================= explore UI ================= */
const fmtLat = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? 'E' : 'W'}`;
// Earth readout computed from the site's own data file (data/terratwin-real.js)
function earthReadout() {
  const E = (R.earth || []), rej = (R.rejected || []).length;
  const mean = (k) => { const v = E.map((e) => +e[k]).filter((x) => isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
  const desert = E.filter((e) => /desert|barren/i.test(e.terrain || '')).length, ice = E.filter((e) => /polar|ice/i.test(e.terrain || '')).length;
  const f = (v, d, u = '') => (isFinite(v) ? v.toFixed(d) + u : '—');
  return [
    ['Surface Slope (mean)', f(mean('slope_deg'), 1, '°'), 'NASADEM / GMTED2010'],
    ['Land type', `${desert} · ${ice}`, 'Barren · Snow & ice (MODIS MCD12C1)'],
    ['Optical Albedo (mean)', f(mean('albedo'), 2), 'NASA MODIS MCD43C3'],
    ['Thermal Swing (mean)', 'Δ' + f(mean('temp_swing_C'), 1, '°C'), 'NASA MODIS MOD11C3 (day − night)'],
    ['Abiotic NDVI Filter', `${E.length} passed`, `${rej} rejected · NDVI ≤ 0.20`],
    ['Earth regions scanned', `${E.length + rej}`, 'about 17 km each'],
  ];
}
function renderExplore() {
  $$('#worlds button').forEach((b) => b.classList.toggle('on', b.dataset.w === world));
  const host = { earth: ['Terrestrial Analog Host', 'Earth (Terra)'], mars: ['Martian Target Host', `Mars · ${R.targets.mars.length} mapped sites`], moon: ['Lunar Target Host', `Moon · ${R.targets.moon.length} mapped sites`] }[world];
  $('#hostLabel').innerHTML = `<span class="dim">${host[0]}</span> ${host[1]}`;
  const ro = $('#readout');
  if (world === 'earth') ro.innerHTML = earthReadout().map(([a, b, c]) => `<div><dt>${a}</dt><dd>${b}<small>${c}</small></dd></div>`).join('');
  else ro.innerHTML = featured.filter((t) => t.body === world).map((t, i) => `<button data-t="${t.id}"><code>0${i + 1}</code><span>${t.name}</span><em>${t.description.split('/')[0].trim()}</em></button>`).join('');
  $('#hints').innerHTML = world === 'earth' ? '<li>Drag to rotate 360°</li><li>Click pins to inspect analog telemetry</li>' : '<li>Drag to rotate 360°</li><li>Click a glowing pin or a name to find its Earth twin</li>';
  if (!reduced) gsap.fromTo('#readout > *', { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: .06, duration: .9, ease: 'expo.out' });
}
$('#worlds').addEventListener('click', (e) => {
  const w = e.target.closest('button')?.dataset.w; if (!w || w === world) return;
  const old = PL[world]; world = w; renderExplore();
  old.tgt = { ...old.tgt, x: old.tgt.x + (narrow() ? 0 : 3), s: 0.0001 };
  const p = PL[w]; p.pos.set(p.tgt.x - 2, p.tgt.y, -6); p.s = 0.0001; layout(); setTimeout(() => shock(p), 250);
});
$('#readout').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; const t = TARGETS.find((x) => x.id === b.dataset.t); const be = bestEarth(t); showPair({ t, e: be.e, s: be.s }, true); });

/* ================= twin UI ================= */
const GLYPH = '!<>-_\\/[]{}—=+*^?#ΔΣΩ0123456789';
function scramble(el, text) {
  // calm swap: the old name fades out, the new one rises in (no random symbols)
  if (reduced || !el.textContent || el.textContent === '—') { el.textContent = text; return; }
  if (el.textContent === text) return;
  gsap.killTweensOf(el);
  gsap.to(el, { opacity: 0, y: -10, filter: 'blur(6px)', duration: .28, ease: 'power2.in', onComplete: () => {
    el.textContent = text;
    gsap.fromTo(el, { opacity: 0, y: 12, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .6, ease: 'expo.out' });
  } });
}
const CRIT = [['slope', 'Slope', (d) => `${d.slope_deg}°`], ['roughness', 'Roughness', (d) => (d.roughness_m == null ? '—' : `${d.roughness_m} m`)], ['albedo', 'Albedo', (d) => `${d.albedo}`], ['thermal', 'Thermal swing', (d) => `Δ${d.temp_swing_C}°C`]];
$('#matrix').innerHTML = CRIT.map(([k, l]) => `<div class="mx" data-k="${k}"><div class="mx-lab"><span>${l}</span><span class="d"></span></div><div class="mx-track"><i class="mx-gap"></i><i class="mx-dot a"></i><i class="mx-dot b"></i></div><div class="mx-vals"><span class="va"></span><span class="vb"></span></div></div>`).join('');
$('#pairDots').innerHTML = PAIRS.map((_, i) => `<button data-i="${i}" aria-label="Pair ${i + 1}"></button>`).join('');
function showPair(p, go) {
  pair = p; const t = p.t, e = p.e, moon = t.body === 'moon';
  const idx = PAIRS.findIndex((x) => x.t === t && x.e === e); if (idx >= 0) pairIdx = idx;
  $$('#pairDots button').forEach((b, i) => b.classList.toggle('on', i === idx));
  const badge = $('#aBadge'); badge.textContent = moon ? 'Lunar Target' : 'Martian Target'; badge.className = 'badge mono ' + (moon ? 'moon' : '');
  scramble($('#aName'), `${t.name}, ${moon ? 'Moon' : 'Mars'}`);
  scramble($('#bName'), e.name);
  $('#aMeta').textContent = `${fmtLat(t.lat)}, ${fmtLon(t.lon)} • Elevation ${Math.round(t.elevation_m)}m`;
  $('#bMeta').textContent = `${fmtLat(e.lat)}, ${fmtLon(e.lon)} • Elevation ${Math.round(e.elevation_m)}m`;
  $('#aDesc').textContent = `${t.description}. ${t.environment}.`;
  $('#bDesc').textContent = `${e.environment} · ${e.region} · NDVI ${e.ndvi}${e.is_official ? ' · known analog site' : ''}`;
  const n = $('#scoreNum'), from = parseFloat(n.textContent) || 0, o = { v: from };
  gsap.to(o, { v: p.s, duration: 1.4, ease: 'expo.out', onUpdate: () => { n.textContent = o.v.toFixed(1); } });
  gsap.to('#ringFg', { strokeDashoffset: 628.3 * (1 - p.s / 100), duration: 1.6, ease: 'expo.out' });
  for (const [k, , fmt] of CRIT) {
    const el = $(`.mx[data-k=${k}]`), skip = moon && k === 'thermal';
    const fa = t.f[k], fb = e.f[k];
    el.querySelector('.mx-dot.a').style.left = fa * 100 + '%'; el.querySelector('.mx-dot.a').classList.toggle('moon', moon);
    el.querySelector('.mx-dot.b').style.left = fb * 100 + '%';
    const g = el.querySelector('.mx-gap'); g.style.left = Math.min(fa, fb) * 100 + '%'; g.style.width = Math.abs(fa - fb) * 100 + '%';
    el.querySelector('.va').innerHTML = skip ? `${fmt(t)} <span class="na">not scored</span>` : fmt(t);
    el.querySelector('.vb').textContent = fmt(e);
    el.querySelector('.d').textContent = skip ? 'vacuum' : `${(100 * (1 - Math.abs(fa - fb))).toFixed(0)}% close`;
    el.style.opacity = skip ? .45 : 1;
  }
  $('#twLive').innerHTML = go ? `<span class="ok">● 3D telemetry locked</span> // ${t.name} → ${e.name}` : 'Rotate the 3D celestial bodies above and click any pin to inspect real multi-criteria physical similarity below.';
  if (SCENE === 'twin') layout();
  if (go) { locked = true; stopAuto(); lenis ? lenis.scrollTo('#twin', { duration: 1.8 }) : $('#twin').scrollIntoView({ behavior: 'smooth' }); }
}
let auto = null, locked = false;
const step = (d) => { locked = false; showPair(PAIRS[(pairIdx + d + PAIRS.length) % PAIRS.length]); };
function startAuto() { stopAuto(); if (!locked) auto = setInterval(() => step(1), 10000); }
function stopAuto() { clearInterval(auto); auto = null; }
$('#prevPair').onclick = () => { step(-1); startAuto(); };
$('#nextPair').onclick = () => { step(1); startAuto(); };
$('#pairDots').onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { locked = false; showPair(PAIRS[+b.dataset.i]); startAuto(); } };

/* ================= results + data sources ================= */
// offline copy written by tools/build-site-data.py (works even when the page is opened as a file)
const STORE = (window.__TERRATWIN_DATA__ && window.__TERRATWIN_DATA__.validation) || null;
let KPI = (STORE && STORE.kpis) || window.TERRATWIN_VALIDATION_FALLBACK.kpis, CATALOG = (STORE && STORE.data_catalog) ? STORE.data_catalog.map((d) => d.name) : null;
fetch('data/validation.json').then((r) => r.ok ? r.json() : null).then((v) => { if (v && v.kpis) KPI = v.kpis; if (v && v.data_catalog) { CATALOG = v.data_catalog.map((d) => d.name); fillMarquee(); } }).catch(() => {});
function countUp() {
  // no known analogs in the data -> show the NDVI rejections instead of a 0% recall
  const noKnown = KPI.known_total === 0;
  const ar = document.documentElement.lang === 'ar';
  if (noKnown) {
    $('#kpi2lab').textContent = ar ? 'رُفضت بفحص NDVI' : 'Rejected by the NDVI gate';
    $('#kpi2sub').textContent = ar ? 'مناطق فيها نباتات استُبعدت قبل المقارنة' : 'Regions with vegetation removed before matching';
  } else {
    if (KPI.known_total) $('#kpi2sub').textContent = ar ? `${KPI.known_validated} من ${KPI.known_total} مواقع معروفة ظهرت ضمن أعلى 25%` : `${KPI.known_validated} of ${KPI.known_total} known analog sites ranked in the top 25%`;
  }
  [['#kpi1', KPI.cells_scanned, (v) => Math.round(v).toLocaleString()], noKnown ? ['#kpi2', KPI.rejected_by_ndvi, (v) => Math.round(v).toString()] : ['#kpi2', KPI.recall_rate, (v) => v.toFixed(1) + '%'], ['#kpi3', KPI.new_candidates, (v) => Math.round(v).toString()]]
    .forEach(([s, end, f], i) => { const o = { v: 0 }; gsap.to(o, { v: end || 0, duration: 2.2, delay: i * .15, ease: 'expo.out', onUpdate: () => { $(s).textContent = f(o.v); } }); });
}
function fillMarquee() {
  const names = ['NASA Earthdata · MODIS MOD11C3', 'MODIS MCD43C3 Albedo', 'MODIS MCD12C1 Land Cover', 'MODIS MOD13A3 NDVI', 'NASADEM', 'USGS GMTED2010', 'NASA PDS · MGS MOLA', 'Mars Odyssey GRS', 'LRO LOLA', 'LRO Diviner', 'LRO LEND', 'JAXA G-Portal · GSMaP'];
  const row = names.map((n) => `<span>${n}</span>`).join('');
  $('#mq').innerHTML = row + row;
}
fillMarquee();

/* ================= text: split headline ================= */
function split(el) {
  const walk = (node) => [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.append(document.createTextNode(' ')); return; }
        const ws = document.createElement('span'); ws.className = 'w';
        [...w].forEach((ch) => { const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; ws.append(c); });
        frag.append(ws);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
  });
  walk(el);
}
$$('.split').forEach(split);

/* ================= smooth scroll + chapters ================= */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new Lenis({ duration: 1.25, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const id = a.getAttribute('href'); if (id.length > 1 && $(id)) { e.preventDefault(); lenis ? lenis.scrollTo(id, { duration: 1.8 }) : $(id).scrollIntoView({ behavior: 'smooth' }); } }));
$$('[data-scene]').forEach((sec) => ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => s.isActive && setScene(sec.dataset.scene) }));
ScrollTrigger.create({ trigger: '#results', start: 'top 60%', once: true, onEnter: countUp });
ScrollTrigger.create({ trigger: '#explore', start: 'top 60%', once: true, onEnter: renderExplore });
// section headings rise in
$$('.sec:not(.hero) .eyebrow, .tw-sub, .worlds, .host, .kpi, .next-link, .tw-grid, .matrix, .tw-ctrl').forEach((el) => {
  if (reduced) return;
  gsap.from(el, { y: 60, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
});
// hero text drifts up and fades as Earth takes over
if (!reduced) gsap.to('.hero-in', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '40% top', scrub: true } }); // fully gone before it reaches the header
// header hides on scroll down
let lastY = 0;
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { const y = s.scroll(); $('#hdr').classList.toggle('hide', y > lastY && y > 200); $('#hdr').classList.toggle('solid', y > 40); lastY = y; } });
$('#burger').onclick = () => $('#nav').classList.toggle('open');

/* ================= start screen → warp intro ================= */
const ldNum = $('#ldNum'), ldBar = $('#ldBar');
let shown = 0;
// returning visitor: hide the 000–100% counter and show only a quiet black screen while planets load
(function loadLoop() {
  shown += (loadPct * 100 - shown) * .14 + (loadPct === 1 ? 2.5 : .05);
  shown = Math.min(shown, loadPct * 100);
  ldNum.textContent = String(Math.floor(shown)).padStart(3, '0'); ldBar.style.width = shown + '%';
  if (shown >= 99.5) { ldNum.textContent = '100'; ldBar.style.width = '100%'; ready(); } else requestAnimationFrame(loadLoop);
})();
function ready() {
  $('#ldMsg').textContent = 'Systems ready';
  $('#ldBtns').classList.add('on');
  gsap.to('#ldBtns', { opacity: 1, y: 0, duration: 1, ease: 'expo.out', startAt: { y: 20 } });
  // nobody clicks? continue on our own so visitors (and judges) are never stuck here
  autoGo = setTimeout(() => begin(false), 4000);
}
let autoGo = 0, begun = false;
function begin(tourAfter) {
  if (begun) return; begun = true; clearTimeout(autoGo);
  try { localStorage.setItem('tt_started', '1'); } catch (e) {}
  const t = gsap.timeline({ onComplete: () => { const ld = $('#loader'); if (ld) ld.remove(); document.body.classList.remove('is-loading'); lenis && lenis.start(); introDone = true; ScrollTrigger.refresh(); if (tourAfter) setTimeout(() => tour(0), 300); } });
  t.to('.ld-in', { opacity: 0, y: -30, duration: .6, ease: 'power2.in' })
    .to('.ld-top', { yPercent: -100, duration: 1.4, ease: 'expo.inOut' }, '-=.1')
    .to('.ld-bot', { yPercent: 100, duration: 1.4, ease: 'expo.inOut' }, '<')
    .to({ z: camZ }, { z: CAM_Z, duration: reduced ? .01 : 3.2, ease: 'expo.inOut', onUpdate() { camZ = this.targets()[0].z; } }, '<')
    .from('#hdr > *', { y: -30, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08 }, '-=1.1')
    .from('.hero .c', { yPercent: 115, rotate: 6, duration: 1.4, ease: 'expo.out', stagger: .018 }, '-=1.2')
    .from('.hero .reveal-up', { y: 30, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .12 }, '-=1.1')
    .from('.scroll-cue, .hero-coords', { opacity: 0, duration: 1 }, '-=.6');
}
$('#goBtn').onclick = () => begin(false);
$('#goTour').onclick = () => begin(true);

/* ================= guided tour: the card flies to each element ================= */
const TOUR = [
  ['#worlds', 'explore', 'Choose a world', 'Switch between Earth, Mars and the Moon. The globe changes with you.'],
  ['#hints', 'explore', 'Click a glowing pin', 'Every pin is a real site from the dataset. Click one on Mars or the Moon to see its closest Earth twin.'],
  ['#twScore', 'twin', 'Similarity score', 'TASI compares slope, roughness, albedo and thermal swing. The Moon skips thermal, because it has no air.'],
  ['#matrix', 'twin', 'Criterion by criterion', 'Each line shows where the two sites sit inside their own world. A short gold gap means a close match.'],
  ['.tw-ctrl', 'twin', 'More pairs', 'Step through the featured targets, or let them play on their own.'],
  ['.kpis', 'results', 'Results', 'Validation numbers, read from the dataset.'],
  ['#tourBtn', null, 'Replay anytime', 'Press ? to see this tour again. Site Finder, Compare Sites and Evidence continue from the menu.'],
];
let ti = 0;
function tour(i) {
  ti = i; const tr = $('#tour'), rg = $('#tourRing');
  if (i >= TOUR.length) { gsap.to([tr, rg], { opacity: 0, duration: .4, onComplete: () => { tr.hidden = rg.hidden = true; } }); return; }
  const [sel, sec, title, text] = TOUR[i];
  const go = () => {
    const r = $(sel).getBoundingClientRect(), pad = 14;
    tr.hidden = rg.hidden = false; $('#tourStep').textContent = `Step ${i + 1} / ${TOUR.length}`; $('#tourTitle').textContent = title; $('#tourText').textContent = text;
    $('#tourNext span').textContent = i === TOUR.length - 1 ? 'Done' : 'Next';
    gsap.to(rg, { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2, opacity: 1, duration: .9, ease: 'expo.inOut' });
    const tw = 300, below = r.bottom + 24 + 190 < innerHeight;
    const x = Math.min(Math.max(16, r.left), innerWidth - tw - 16), y = below ? r.bottom + 24 : Math.max(16, r.top - 214);
    gsap.to(tr, { left: x, top: y, opacity: 1, duration: .9, ease: 'expo.inOut' });
  };
  if (sec && SCENE !== sec) { lenis ? lenis.scrollTo('#' + sec, { duration: 1.2, onComplete: () => setTimeout(go, 120) }) : ($('#' + sec).scrollIntoView(), setTimeout(go, 300)); }
  else if (sec) { const r = $(sel).getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) { lenis ? lenis.scrollTo(sel, { offset: -innerHeight * .3, duration: 1, onComplete: go }) : ($(sel).scrollIntoView(), go()); } else go(); }
  else go();
}
$('#tourBtn').onclick = () => tour(0);
$('#tourNext').onclick = () => tour(ti + 1);
$('#tourSkip').onclick = () => tour(TOUR.length);

/* ================= cursor + magnetic buttons ================= */
const cur = $('#cur'); let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
gsap.ticker.add(() => { cx += (tx - cx) * .2; cy += (ty - cy) * .2; cur.style.transform = `translate(${cx}px, ${cy}px)`; });
$$('a, button').forEach((el) => { el.addEventListener('pointerenter', () => cur.classList.add('big')); el.addEventListener('pointerleave', () => cur.classList.remove('big')); });
$$('.magnetic').forEach((el) => {
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * .3, y: (e.clientY - r.top - r.height / 2) * .3, duration: .6, ease: 'expo.out' }); });
  el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1, .4)' }));
});

/* ================= go ================= */
showPair(PAIRS[0]);
layout();
tick();
window.TT_HOME = { tasi, PAIRS, setScene, showPair, stopAuto };
