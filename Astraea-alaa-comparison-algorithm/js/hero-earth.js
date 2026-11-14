/* ==========================================================================
   Guide hero Earth — the same globe as the login page (NASA textures, clouds,
   atmosphere glow), drawn smaller and dimmer beside the page title.
   Needs Three.js r128; if it is missing the hero simply shows no globe.
   ========================================================================== */
(function () {
  'use strict';
  const canvas = document.getElementById('guideEarthCanvas');
  if (!canvas) return;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start() {
    if (typeof THREE === 'undefined') { canvas.style.display = 'none'; return; }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // light from above: the top of the globe is lit, the lower half falls into night
    const sun = new THREE.DirectionalLight(0xfffaee, 2.0);
    sun.position.set(-1.5, 5, 3);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x00c8ff, 0.7);
    rim.position.set(5, -2, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x061428, 0.35));

    const loader = new THREE.TextureLoader();
    const R = 1, seg = 64;
    const group = new THREE.Group();
    group.rotation.x = 0.22;
    scene.add(group);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(R, seg, seg),
      new THREE.MeshPhongMaterial({
        map: loader.load('assets/textures/earth_atmos_2048.jpg', draw),
        normalMap: loader.load('assets/textures/earth_normal_2048.jpg', draw),
        normalScale: new THREE.Vector2(0.85, 0.85),
        specularMap: loader.load('assets/textures/earth_specular_2048.jpg', draw),
        specular: new THREE.Color(0x285585),
        shininess: 24
      })
    );
    globe.rotation.y = 2.4;
    group.add(globe);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.018, seg, seg),
      new THREE.MeshPhongMaterial({ map: loader.load('assets/textures/earth_clouds_1024.png', draw), transparent: true, opacity: 0.85 })
    );
    clouds.rotation.y = 2.4;
    group.add(clouds);

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, seg, seg),
      new THREE.ShaderMaterial({
        vertexShader: 'varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vNormal; void main(){ float i = pow(0.68 - dot(vNormal, vec3(0,0,1.0)), 2.8); gl_FragColor = vec4(0.0,0.72,1.0,1.0) * i * 1.4; }',
        blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true
      })
    );
    group.add(atmo);

    function resize() {
      const w = canvas.clientWidth || 400, h = canvas.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      draw();
    }
    function draw() { renderer.render(scene, camera); }

    let visible = true, raf = 0;
    function loop() {
      raf = 0;
      if (!visible) return;
      globe.rotation.y += 0.0007;
      clouds.rotation.y += 0.00095;
      draw();
      raf = requestAnimationFrame(loop);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !reduceMotion && !raf) raf = requestAnimationFrame(loop);
      }).observe(canvas);
    }
    window.addEventListener('resize', resize);
    resize();
    if (!reduceMotion) raf = requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
