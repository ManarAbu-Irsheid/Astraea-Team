/* TerraTwin — Compare page 3D terrain, "v4" look.
   Keeps the existing viewer (landforms, hover inspect, heatmap, layers, buttons)
   and only changes how the surface is drawn:
   - smooth elevation colour ramp per world (Mars / Moon / Earth) with soft contour bands
   - dark slab under the terrain like a museum diorama
   - warm key light + cool rim light, no coloured fog
   - faint white wireframe, terrain "grows" up when it loads
   Loaded right after js/compare.js. Remove the <script> line to get the old look back. */
(function () {
  if (typeof Terrain3DViewer === 'undefined' || typeof THREE === 'undefined') return;
  const V = Terrain3DViewer;
  // open on the clean surface (like v4); the heatmap stays one click away
  V.visualMode = 'natural';
  document.addEventListener('DOMContentLoaded', () => {
    const on = document.getElementById('btn3dLayerNatural'), off = document.getElementById('btn3dLayerSpectral');
    if (on) on.classList.add('active'); if (off) off.classList.remove('active');
  });

  const RAMP = {
    mars: [[0, '#2a0f0a'], [0.35, '#8a3b22'], [0.65, '#d07a45'], [1, '#f3d2ae']],
    moon: [[0, '#15171c'], [0.4, '#5a5f69'], [0.75, '#a7acb5'], [1, '#f0f1f3']],
    earth: [[0, '#1b1612'], [0.35, '#5b4532'], [0.7, '#b08e62'], [1, '#efe2c8']]
  };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function rampFn(body) {
    const st = (RAMP[body] || RAMP.mars).map(([p, h]) => [p, hex(h)]);
    return (t) => {
      t = Math.min(1, Math.max(0, t));
      for (let i = 1; i < st.length; i++) if (t <= st[i][0]) {
        const a = st[i - 1], b = st[i], k = (t - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map((j) => a[1][j] + (b[1][j] - a[1][j]) * k);
      }
      return st[st.length - 1][1];
    };
  }
  function bodyOf(t) { const b = (t && t.body || '').toLowerCase(); return b === 'moon' ? 'moon' : b === 'earth' ? 'earth' : 'mars'; }

  /* 1) surface colour = elevation ramp + soft contour bands (replaces the old rock texture) */
  V.generateBaseAlbedo = function (target) {
    if (!this.baseAlbedoCtx || !this.vertexMetadata || !this.vertexMetadata.length) return;
    const meta = this.vertexMetadata, dim = this.gridSegments + 1;
    let mn = Infinity, mx = -Infinity;
    for (const m of meta) { const z = +m.z; if (z < mn) mn = z; if (z > mx) mx = z; }
    const rp = rampFn(bodyOf(target)), span = (mx - mn) || 1;
    const small = document.createElement('canvas'); small.width = dim; small.height = dim;
    const sctx = small.getContext('2d'), img = sctx.createImageData(dim, dim), d = img.data;
    for (let i = 0; i < meta.length; i++) {
      const t = (+meta[i].z - mn) / span;
      let c = rp(t);
      if (this.showContours !== false && Math.abs((t * 12) % 1) < 0.07) c = c.map((v) => v * 0.72);  // contour band
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const ctx = this.baseAlbedoCtx, w = this.baseAlbedoCanvas.width, h = this.baseAlbedoCanvas.height;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, w, h);
    // very light grain so it does not look plastic
    const g = ctx.getImageData(0, 0, w, h), gd = g.data;
    for (let i = 0; i < gd.length; i += 4) { const n = (Math.random() - 0.5) * 10; gd[i] += n; gd[i + 1] += n; gd[i + 2] += n; }
    ctx.putImageData(g, 0, 0);
  };

  /* 2) old dashed circles / crosshair grid are replaced by the contour bands above */
  const origComposite = V.updateCompositeTexture;
  V.updateCompositeTexture = function () {
    const keep = this.showContours; this.showContours = false;
    try { origComposite.call(this); } finally { this.showContours = keep; }
  };
  V.toggleContours = function () {
    this.showContours = !this.showContours;
    const btn = document.getElementById('btn3dContours');
    if (btn) btn.classList.toggle('active', this.showContours);
    this.generateBaseAlbedo(this.currentTarget);
    this.updateCompositeTexture();
  };

  /* 3) lights, slab, wireframe, grow-in */
  const origBuild = V.buildTerrain;
  V.buildTerrain = function (target, siteA, siteB) {
    origBuild.call(this, target, siteA, siteB);
    if (!this.scene || !this.terrainMesh) return;

    this.scene.fog = null;
    if (!this.__v4Lights) {
      this.__v4Lights = true;
      if (this.ambientLight) { this.ambientLight.color.setHex(0x3a4660); this.ambientLight.intensity = 0.9; }
      if (this.sunLight) { this.sunLight.color.setHex(0xfff0dd); this.sunLight.intensity = 1.7; }
      const rim = new THREE.DirectionalLight(0x5aa9ff, 0.5); rim.position.set(20, 8, -16); this.scene.add(rim);
      this.scene.traverse((o) => { if (o.isDirectionalLight && o.color && o.color.getHex() === 0xd9b77e) o.intensity = 0; });
    }
    const mat = this.terrainMesh.material;
    if (mat) { mat.roughness = 0.92; mat.metalness = 0.02; mat.normalMap = null; mat.needsUpdate = true; }
    if (this.wireframeMesh && this.wireframeMesh.material) {
      this.wireframeMesh.material.color.setHex(0xffffff);
      this.wireframeMesh.material.opacity = 0.07;
    }

    // dark slab under the terrain (diorama base)
    if (this.__v4Base) { this.scene.remove(this.__v4Base); this.__v4Base.geometry.dispose(); this.__v4Base.material.dispose(); }
    const g = this.terrainMesh.geometry; g.computeBoundingBox();
    const bb = g.boundingBox, size = this.gridSize, sz = this.terrainMesh.scale.z || 1;
    const thick = 1.1, bottom = bb.min.z * sz;
    const base = new THREE.Mesh(new THREE.BoxGeometry(size, size, thick),
      new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 1, metalness: 0 }));
    base.position.set(0, 0, bottom - thick / 2 - 0.02);
    base.rotation.copy(this.terrainMesh.rotation);
    // follow the terrain's parent transform (the plane is rotated flat by the viewer)
    (this.terrainMesh.parent || this.scene).add(base);
    this.__v4Base = base;
    const minZ = bb.min.z;

    // grow-in animation
    const target_ = this.terrainMesh.scale.z, wire = this.wireframeMesh, mesh = this.terrainMesh;
    let t = 0;
    const step = () => {
      t += (1 - t) * 0.06;
      const s = Math.max(0.001, target_ * t);
      mesh.scale.z = s; if (wire) wire.scale.z = s; base.position.z = minZ * s - thick / 2 - 0.02;
      if (t < 0.995 && mesh === this.terrainMesh) requestAnimationFrame(step); else { mesh.scale.z = target_; if (wire) wire.scale.z = target_; base.position.z = minZ * target_ - thick / 2 - 0.02; }
    };
    if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: reduce)').matches) step();
  };
})();
