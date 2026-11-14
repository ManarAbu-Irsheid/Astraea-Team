/**
 * TerraTwin - Interactive 3D Planetary Explorer (Earth, Mars, Moon)
 * Built with Three.js (WebGL). Features photorealistic day/night shading,
 * city lights, atmospheric Fresnel rim, realistic cloud layer, ocean specular
 * glint, interactive 360° drag rotation, zoom, clickable analog site pins with
 * telemetry popups, and smooth planet switching.
 */

const Planetary3D = {
  currentPlanet: 'earth', // 'earth', 'mars', 'moon'
  planetsList: ['earth', 'mars', 'moon'],
  scene: null,
  camera: null,
  renderer: null,
  container: null,
  planetGroup: null,
  globeMesh: null,
  cloudsMesh: null,
  atmosphereMesh: null,
  markersGroup: null,
  starsGroup: null,
  sunLight: null,
  sunDirection: null,

  // Interaction State
  isDragging: false,
  previousMousePosition: { x: 0, y: 0 },
  rotationVelocity: { x: 0.0005, y: 0.0005 },
  autoRotate: true,
  idleTimeout: null,
  raycaster: null,
  mouse: null,
  hoveredMarker: null,

  // Celestial Bodies Metadata & Telemetry
  planetData: {
    earth: {
      id: 'earth',
      name_en: 'Earth (Terra)',
      name_ar: 'كوكب الأرض',
      kicker_en: 'Terrestrial Analog Host',
      kicker_ar: 'المستضيف الأرضي للمواقع الشبيهة',
      color: '#00a3ff',
      slope: '6.8° Mean (Flat <2° to Steep >12°)',
      slope_ar: '6.8° متوسط (منبسط إلى حاد)',
      roughness: '12.4 m (Geomorpho90m Multi-Scale)',
      roughness_ar: '12.4 متر (قاعدة Geomorpho90m)',
      albedo: '0.26 (NASA MODIS MCD43A3)',
      albedo_ar: '0.26 (مقياس MODIS اليومي)',
      temp_swing: 'Δ44.5°C (NASA MODIS LST)',
      temp_swing_ar: 'Δ44.5° مئوية (حرارة السطح MODIS LST)',
      ndvi_gate: 'Passed (NDVI ≤ 0.20 Abiotic Gate)',
      ndvi_gate_ar: 'مجتاز (NDVI ≤ 0.20 بيئة غير حيوية)',
      catalog_sites: '53 Sites (47 Analogs + 6 Controls)',
      catalog_sites_ar: '53 موقعاً (47 شبيهاً + 6 ضبط)',
      sites: [
        { id: 'earth-devon-island', name: 'Devon Island / Haughton Crater', name_ar: 'جزيرة ديفون / فوهة هوتون', lat: 75.42, lon: -89.85, target: 'Polar Cryo-Permafrost | Match: Shackleton 76.0% / Jezero 53.8%', target_ar: 'تربة جليدية قطبية | مطابق لشاكلتون 76.0% / جيزيرو 53.8%' },
        { id: 'earth-atacama-yungay', name: 'Atacama Desert (Yungay)', name_ar: 'صحراء أتاكاما (يونغاي)', lat: -24.09, lon: -69.98, target: 'Hyper-Arid Basin | Match: Jezero 79.1% / Meridiani 75.8%', target_ar: 'حوض شديد الجفاف | مطابق لجيزيرو 79.1% / ميريدياني 75.8%' },
        { id: 'earth-mdrs-utah', name: 'Mars Desert Research Station (MDRS)', name_ar: 'محطة أبحاث صحراء المريخ (MDRS)', lat: 38.40, lon: -110.79, target: 'Hyper-Arid Basin | Match: Meridiani 89.3% / Jezero 72.6%', target_ar: 'حوض صلصالي جاف | مطابق لميريدياني 89.3% / جيزيرو 72.6%' },
        { id: 'earth-hiseas-hawaii', name: 'HI-SEAS Mauna Loa', name_ar: 'محطة هاي سيز، ماونا لوا', lat: 19.47, lon: -155.59, target: 'Volcanic Basalt | Match: Mare Tranquillitatis 82.5% / Jezero 74.5%', target_ar: 'حقول لابة بركانية | مطابق لبحر السكون 82.5% / جيزيرو 74.5%' },
        { id: 'earth-mafraq', name: 'Mafraq Basalt Plain', name_ar: 'سهل المفرق البازلتي، الأردن', lat: 32.00, lon: 37.50, target: 'Candidate Basalt Plain | Match: Jezero 95.8% / Mare Tranquillitatis 81.3%', target_ar: 'مرشح بازلتي منبسط | مطابق لجيزيرو 95.8% / بحر السكون 81.3%' },
        { id: 'earth-wadirum-jordan', name: 'Wadi Rum', name_ar: 'وادي رم، الأردن', lat: 29.56, lon: 35.41, target: 'Candidate Desert | Match: Mons Mouton 82.5% / Copernicus 82.4%', target_ar: 'مرشح صحراوي تضاريسي | مطابق لمونس موتون 82.5% / كوبرنيكوس 82.4%' },
        { id: 'earth-riotinto', name: 'Rio Tinto', name_ar: 'ريو تينتو، إسبانيا', lat: 37.70, lon: -6.60, target: 'Acidic Iron River | Match: Valles Marineris 85.0%', target_ar: 'نهر كبريتي حمضي | مطابق لأخاديد مارينيريس 85.0%' },
        { id: 'earth-dhofar-oman', name: 'Dhofar AMADEE Site', name_ar: 'موقع ظفار (أمادي)، عمان', lat: 17.00, lon: 54.00, target: 'Hyper-Arid Basin | Match: Rima Ariadaeus 89.5% / Jezero 70.5%', target_ar: 'حوض صحراوي جاف | مطابق لأخدود أرياديوس 89.5% / جيزيرو 70.5%' }
      ]
    },
    mars: {
      id: 'mars',
      name_en: 'Mars (Ares)',
      name_ar: 'كوكب المريخ',
      kicker_en: 'Target Exploration Body',
      kicker_ar: 'الجرم الاستكشافي المستهدف',
      color: '#e05638',
      slope: '3.4° Mean (MGS MOLA MEGDR 463m)',
      slope_ar: '3.4° متوسط (رادار MOLA MEGDR)',
      roughness: '58.2 m (HRSC-MOLA Blend 200m)',
      roughness_ar: '58.2 متر (رادار HRSC-MOLA)',
      albedo: '0.19 (MRO TES Global Albedo)',
      albedo_ar: '0.19 (مستشعر MRO TES المريخي)',
      temp_swing: 'Δ78.4°C (Mars Climate Database v6.1)',
      temp_swing_ar: 'Δ78.4° مئوية (قاعدة مناخ المريخ MCD)',
      ndvi_gate: '0.000 (Pure Abiotic Regolith)',
      ndvi_gate_ar: '0.000 (تربة ريغوليث غير حيوية كلياً)',
      catalog_sites: '31 Target Sites (Jezero, Gale...)',
      catalog_sites_ar: '31 هدفاً مريخياً (جيزيرو، غيل...)',
      sites: [
        { id: 'mars-jezero', name: 'Jezero Crater Delta', name_ar: 'دلتا فوهة جيزيرو', lat: 18.41, lon: 77.69, target: 'Perseverance Landing Delta | Best Analog: Mafraq 95.8%, Atacama 79.1%', target_ar: 'دلتا هبوط بيرسيفيرنس | أفضل شبيه: المفرق 95.8%، أتاكاما 79.1%' },
        { id: 'mars-gale', name: 'Gale Crater (Mount Sharp)', name_ar: 'فوهة غيل (جبل شارب)', lat: -5.37, lon: 137.81, target: 'Curiosity Landing Basin | Best Analog: Atacama 77.6%, Rio Tinto 68.8%', target_ar: 'حوض هبوط كوريوسيتي | أفضل شبيه: أتاكاما 77.6%، ريو تينتو 68.8%' },
        { id: 'mars-elysium', name: 'Elysium Planitia', name_ar: 'سهل إليسيوم بلانيتيا', lat: 2.98, lon: 154.74, target: 'InSight Basalt Landing Plain | Best Analog: Dhofar 72.4%, Gobi 69.1%', target_ar: 'سهل هبوط إنسايت البازلتي | أفضل شبيه: ظفار 72.4%، جوبي 69.1%' },
        { id: 'mars-olympus', name: 'Olympus Mons', name_ar: 'بركان أوليمبوس مونس', lat: 18.65, lon: -133.80, target: 'Largest Volcanic Shield | Best Analog: Devon Island 83.1%, Iceland 71.3%', target_ar: 'أضخم بركان درعي بالمجموعة الشمسية | أفضل شبيه: ديفون 83.1%، آيسلندا 71.3%' },
        { id: 'mars-valles', name: 'Valles Marineris', name_ar: 'أخاديد فالس مارينيريس', lat: -14.01, lon: -58.59, target: 'Grand Canyon of Mars | Best Analog: Rio Tinto 85.0%, Wadi Rum 83.4%', target_ar: 'الأخدود الأعظم للمريخ | أفضل شبيه: ريو تينتو 85.0%، وادي رم 83.4%' },
        { id: 'mars-meridiani', name: 'Meridiani Planum', name_ar: 'سهل ميريدياني بلانوم', lat: -0.04, lon: -3.14, target: 'Opportunity Hematite Plain | Best Analog: MDRS Utah 89.3%, Atacama 75.8%', target_ar: 'سهل الهيماتيت (أبورتيونيتي) | أفضل شبيه: يوتا 89.3%، أتاكاما 75.8%' }
      ]
    },
    moon: {
      id: 'moon',
      name_en: 'The Moon (Luna)',
      name_ar: 'القمر',
      kicker_en: 'Target Exploration Body',
      kicker_ar: 'الجرم الاستكشافي المستهدف',
      color: '#cbd5e1',
      slope: '3.7° Mean (LRO LOLA Altimetry)',
      slope_ar: '3.7° متوسط (مقياس ليزر LRO LOLA)',
      roughness: '1.2 m (LRO LOLA LDRM Residual)',
      roughness_ar: '1.2 متر (انحراف نبضات LRO LOLA)',
      albedo: '0.24 (LOLA Normal Albedo 1064nm)',
      albedo_ar: '0.24 (انعكاس الليزر 1064nm)',
      temp_swing: 'Δ268.0°C (LRO Diviner GCP Extreme)',
      temp_swing_ar: 'Δ268.0° مئوية (مقياس Diviner القمري)',
      ndvi_gate: '0.000 (Physical Vacuum / Abiotic)',
      ndvi_gate_ar: '0.000 (فراغ فيزيائي غير حيوي)',
      catalog_sites: '30 Lunar Targets (Artemis, Maria...)',
      catalog_sites_ar: '30 هدفاً قمرياً (أرتميس، بحار القمر...)',
      sites: [
        { id: 'moon-shackleton', name: 'Shackleton Crater Rim', name_ar: 'حافة فوهة شاكلتون (القطب الجنوبي)', lat: -89.67, lon: 129.78, target: 'Artemis Polar Base Candidate | Best Analog: Norway 84.6%, Devon 76.0%', target_ar: 'مرشح قاعدة أرتميس القطبية | أفضل شبيه: النرويج 84.6%، ديفون 76.0%' },
        { id: 'moon-mouton', name: 'Mons Mouton', name_ar: 'مونس موتون (الكتلة القطبية)', lat: -84.60, lon: 31.00, target: 'Artemis III Landing Target | Best Analog: Al Wahat 85.7%, Maan 85.5%', target_ar: 'هدف هبوط أرتميس 3 | أفضل شبيه: الواحات 85.7%، معان 85.5%' },
        { id: 'moon-tranquillitatis', name: 'Mare Tranquillitatis', name_ar: 'بحر السكون (أبولو 11)', lat: 8.35, lon: 30.83, target: 'Apollo 11 Basaltic Mare | Best Analog: Chubut 91.0%, HI-SEAS 82.5%, Mafraq 81.3%', target_ar: 'سهل هبوط أبولو 11 البازلتي | أفضل شبيه: تشوبوت 91.0%، هاي سيز 82.5%، المفرق 81.3%' },
        { id: 'moon-copernicus', name: 'Copernicus Crater', name_ar: 'فوهة كوبرنيكوس المركزية', lat: 9.62, lon: -20.08, target: 'Central Peak Complex | Best Analog: Wadi Rum 82.4%, Hardap 80.0%', target_ar: 'مجمع القمة المركزية | أفضل شبيه: وادي رم 82.4%، هاراداب 80.0%' },
        { id: 'moon-aristarchus', name: 'Aristarchus Plateau', name_ar: 'هضبة أريستارخوس البركانية', lat: 23.73, lon: -47.49, target: 'High-Albedo Volcanic Complex | Best Analog: Iceland 69.6%, Devon 67.2%', target_ar: 'مجمع بركاني عالي البياض | أفضل شبيه: آيسلندا 69.6%، ديفون 67.2%' },
        { id: 'moon-ariadaeus', name: 'Rima Ariadaeus', name_ar: 'أخدود ريما أرياديوس', lat: 6.48, lon: 13.44, target: 'Linear Lunar Rille | Best Analog: Australia 94.0%, Dhofar 89.5%', target_ar: 'أخدود قمري انكساري خطي | أفضل شبيه: أستراليا 94.0%، ظفار 89.5%' }
      ]
    }
  },

  // Replace the globe pins + body stats with the generated data (data/planetary-dataset.js)
  applyGeneratedData() {
    const globe = window.PLANETARY_DATABASE && window.PLANETARY_DATABASE.globe;
    if (!globe) return;
    Object.keys(globe).forEach(body => {
      if (this.planetData[body]) Object.assign(this.planetData[body], globe[body]);
    });
  },

  // "View in Site Finder": open the Finder on the clicked place
  finderLink(site) {
    const id = String(site.id || '');
    const body = id.split('-')[0];
    if (body === 'mars' || body === 'moon') return `finder.html?body=${body}&ref=${encodeURIComponent(site.name)}`;
    if (body === 'earth' && typeof site.lat === 'number') return `finder.html?lat=${site.lat}&lon=${site.lon}`;
    return 'finder.html';
  },

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.applyGeneratedData();

    if (typeof THREE === 'undefined') {
      console.warn('Three.js library not loaded yet, waiting...');
      return;
    }

    this.setupScene();
    this.setupLights();
    this.createStarfield();
    this.loadPlanet(this.currentPlanet);
    this.setupInteraction();
    this.animate();

    this.renderTelemetryHUD();
    this.bindDOMControls();

    window.addEventListener('resize', () => this.onWindowResize());
    document.addEventListener('languageChanged', () => {
      this.renderTelemetryHUD();
      this.updateActiveTabs();
    });
  },

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 2.8;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Requirement 1: sRGB encoding, ACESFilmicToneMapping, exposure 1.0
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.container.appendChild(this.renderer.domElement);

    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    this.markersGroup = new THREE.Group();
    this.planetGroup.add(this.markersGroup);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  },

  setupLights() {
    // Requirement 3: Sun from side and slightly behind (~1/3 in night)
    // Key directional sunlight
    this.sunLight = new THREE.DirectionalLight(0xfffaee, 1.85);
    this.sunLight.position.set(5.0, 1.8, 2.0);
    this.scene.add(this.sunLight);

    // Cache normalized sun direction for shaders
    this.sunDirection = this.sunLight.position.clone().normalize();

    // Requirement 3: Very low ambient (0x0b1530, 0.06)
    const ambientLight = new THREE.AmbientLight(0x0b1530, 0.06);
    this.scene.add(ambientLight);

    // Cyan rim light is removed per Requirement 3
  },

  createStarfield() {
    const starCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 25 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const brightness = 0.5 + Math.random() * 0.5;
      colors[i] = brightness;
      colors[i + 1] = brightness * 0.95;
      colors[i + 2] = brightness * 1.1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.75
    });

    this.starsGroup = new THREE.Points(geometry, material);
    this.scene.add(this.starsGroup);
  },

  /* ==========================================================================
     TEXTURE LOADER WITH FALLBACKS & ENCODING/ANISOTROPY CONTROL
     ========================================================================== */
  textureLoader: null,
  textureCache: {},

  getTextureLoader() {
    if (!this.textureLoader && typeof THREE !== 'undefined') {
      this.textureLoader = new THREE.TextureLoader();
    }
    return this.textureLoader;
  },

  loadTextureSafe(primaryPath, fallbackPath, isColor = false, fallbackGenerator = null) {
    const cacheKey = primaryPath + (isColor ? '_srgb' : '_lin');
    if (this.textureCache[cacheKey]) {
      return this.textureCache[cacheKey];
    }

    const loader = this.getTextureLoader();
    const maxAniso = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 16;

    const configureTexture = (tex) => {
      if (isColor) {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = maxAniso;
      }
      tex.needsUpdate = true;
    };

    if (!loader) {
      if (fallbackGenerator) {
        const genTex = fallbackGenerator.call(this);
        configureTexture(genTex);
        return genTex;
      }
      return null;
    }

    const texture = loader.load(
      primaryPath,
      (loaded) => {
        configureTexture(loaded);
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
      },
      undefined,
      (err) => {
        console.warn(`[Planetary3D] Primary texture failed: ${primaryPath}, trying fallback...`);
        if (fallbackPath) {
          loader.load(
            fallbackPath,
            (fbLoaded) => {
              texture.image = fbLoaded.image;
              configureTexture(texture);
              if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
              }
            },
            undefined,
            (fbErr) => {
              console.warn(`[Planetary3D] Fallback texture failed: ${fallbackPath}, using procedural generator`);
              if (fallbackGenerator) {
                const genTex = fallbackGenerator.call(this);
                if (genTex && genTex.image) {
                  texture.image = genTex.image;
                  configureTexture(texture);
                  if (this.renderer && this.scene && this.camera) {
                    this.renderer.render(this.scene, this.camera);
                  }
                }
              }
            }
          );
        } else if (fallbackGenerator) {
          const genTex = fallbackGenerator.call(this);
          if (genTex && genTex.image) {
            texture.image = genTex.image;
            configureTexture(texture);
            if (this.renderer && this.scene && this.camera) {
              this.renderer.render(this.scene, this.camera);
            }
          }
        }
      }
    );

    configureTexture(texture);
    this.textureCache[cacheKey] = texture;
    return texture;
  },

  /* ==========================================================================
     PROCEDURAL FALLBACK TEXTURE GENERATORS
     ========================================================================== */
  generatePlanetTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (type === 'earth') {
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      oceanGrad.addColorStop(0, '#0c2340');
      oceanGrad.addColorStop(0.5, '#04162e');
      oceanGrad.addColorStop(1, '#08213e');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      ctx.fillStyle = '#1c3d26';
      this.drawContinentBlobs(ctx, [
        { x: 500, y: 350, rx: 260, ry: 190, color: '#2a5438' },
        { x: 700, y: 680, rx: 170, ry: 240, color: '#385e34' },
        { x: 1050, y: 300, rx: 180, ry: 120, color: '#335832' },
        { x: 1080, y: 550, rx: 210, ry: 220, color: '#91794b' },
        { x: 1450, y: 350, rx: 340, ry: 200, color: '#2d5236' },
        { x: 1680, y: 700, rx: 150, ry: 120, color: '#87693d' },
        { x: 1024, y: 980, rx: 900, ry: 80, color: '#eef6fc' },
        { x: 600, y: 100, rx: 180, ry: 70, color: '#e2f0fa' }
      ]);
    } else if (type === 'mars') {
      const marsGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      marsGrad.addColorStop(0, '#662211');
      marsGrad.addColorStop(0.5, '#993318');
      marsGrad.addColorStop(1, '#551d10');
      ctx.fillStyle = marsGrad;
      ctx.fillRect(0, 0, 2048, 1024);

      this.drawContinentBlobs(ctx, [
        { x: 1400, y: 500, rx: 200, ry: 140, color: '#3d160c' },
        { x: 800, y: 360, rx: 240, ry: 130, color: '#3a170f' },
        { x: 500, y: 600, rx: 320, ry: 80, color: '#2f120a' }
      ]);
    } else if (type === 'moon') {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(0, 0, 2048, 1024);

      this.drawContinentBlobs(ctx, [
        { x: 900, y: 400, rx: 210, ry: 160, color: '#252a32' },
        { x: 1200, y: 480, rx: 220, ry: 180, color: '#282d35' },
        { x: 650, y: 460, rx: 260, ry: 200, color: '#22272e' },
        { x: 1350, y: 400, rx: 120, ry: 110, color: '#292f37' }
      ]);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  drawContinentBlobs(ctx, blobs) {
    blobs.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const wobble = 0.8 + Math.random() * 0.4;
        const x = b.x + Math.cos(angle) * (b.rx * wobble);
        const y = b.y + Math.sin(angle) * (b.ry * wobble);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    });
  },

  generateNightTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#010206';
    ctx.fillRect(0, 0, 2048, 1024);

    const hubs = [
      { x: 520, y: 340, r: 70 },
      { x: 470, y: 390, r: 60 },
      { x: 1040, y: 300, r: 85 },
      { x: 1450, y: 360, r: 90 },
      { x: 1560, y: 380, r: 70 },
      { x: 1400, y: 460, r: 60 }
    ];
    hubs.forEach(h => {
      const grad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      grad.addColorStop(0, 'rgba(255, 215, 120, 0.95)');
      grad.addColorStop(0.35, 'rgba(240, 160, 60, 0.45)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  generateCloudsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 2048, 1024);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';

    for (let i = 0; i < 60; i++) {
      const cx = Math.random() * 2048;
      const cy = 150 + Math.random() * 724;
      const rx = 80 + Math.random() * 220;
      const ry = 25 + Math.random() * 65;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.random() * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  },

  /* ==========================================================================
     EARTH MATERIAL & SHADERS (Requirements 1 & 2)
     MeshPhongMaterial with day map, normal map, specular map, and
     night lights injected via onBeforeCompile.
     ========================================================================== */
  earthNightUniforms: null,
  earthAtmoUniforms: null,

  createEarthMaterial() {
    const dayTex = this.loadTextureSafe(
      'assets/textures/earth_day_2k.jpg',
      'assets/textures/earth_atmos_2048.jpg',
      true,
      () => this.generatePlanetTexture('earth')
    );

    const nightTex = this.loadTextureSafe(
      'assets/textures/earth_night_2k.jpg',
      null,
      true,
      () => this.generateNightTexture()
    );

    // Normal & Specular maps: non-color data maps (isColor = false -> LinearEncoding)
    const normalTex = this.loadTextureSafe('assets/textures/earth_normal_2048.jpg', null, false);
    const specularTex = this.loadTextureSafe('assets/textures/earth_specular_2048.jpg', null, false);

    // Requirement 1: MeshPhongMaterial (map sRGB, normalScale 0.5, specular 0x222222, shininess 12)
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
      specularMap: specularTex,
      specular: new THREE.Color(0x0a0a0a),
      shininess: 5
    });

    // Requirement 2: Night lights injected via onBeforeCompile
    if (nightTex) {
      this.earthNightUniforms = {
        nightMap: { value: nightTex },
        sunDirectionInViewSpace: { value: new THREE.Vector3() }
      };

      earthMat.onBeforeCompile = (shader) => {
        shader.uniforms.nightMap = this.earthNightUniforms.nightMap;
        shader.uniforms.sunDirectionInViewSpace = this.earthNightUniforms.sunDirectionInViewSpace;

        shader.fragmentShader = `
          uniform sampler2D nightMap;
          uniform vec3 sunDirectionInViewSpace;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <output_fragment>',
          `
          #ifdef USE_MAP
            vec4 nightTexel = texture2D( nightMap, vUv );
            float nightFactor = (1.0 - smoothstep(-0.1, 0.2, dot(normal, sunDirectionInViewSpace))) * 1.4;
            outgoingLight += pow(nightTexel.rgb, vec3(2.2)) * nightFactor;
          #endif
          #include <output_fragment>
          `
        );
      };
    }

    return earthMat;
  },

  /* ==========================================================================
     CLOUDS MESH (Requirement 3)
     Separate sphere radius 1.008 with map AND alphaMap = earth_clouds_1024.png,
     transparent true, opacity 0.75, depthWrite false, MeshLambertMaterial.
     ========================================================================== */
  createCloudsMesh(radius, segments) {
    const cloudGeom = new THREE.SphereGeometry(radius * 1.008, segments, segments);
    const cloudTex = this.loadTextureSafe(
      'assets/textures/earth_clouds_1024.png',
      null,
      true,
      () => this.generateCloudsTexture()
    );

    const cloudMat = new THREE.MeshLambertMaterial({
      map: cloudTex,
      alphaMap: cloudTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    return new THREE.Mesh(cloudGeom, cloudMat);
  },

  /* ==========================================================================
     EARTH ATMOSPHERE MESH (Requirement 4)
     Centered on Earth, radius 1.06, BackSide, AdditiveBlending, depthWrite false,
     Fresnel rim color #4da6ff with even thickness all around, slightly brighter
     on the sun side.
     ========================================================================== */
  createEarthAtmosphereMesh(radius, segments) {
    const atmoGeom = new THREE.SphereGeometry(radius * 1.035, segments, segments);
    const atmoColor = new THREE.Color('#7fbcff');

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirView: { value: new THREE.Vector3() },
        atmoColor: { value: atmoColor }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirView;
        uniform vec3 atmoColor;

        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          float rim = 1.0 - abs(dot(vNormal, vViewDir));
          rim = pow(rim, 3.4);

          // Thin haze, visible mostly on the sun side (a real limb, not a ring)
          float sunSide = clamp(dot(vNormal, sunDirView) * 0.5 + 0.5, 0.0, 1.0);
          float intensity = rim * (0.10 + 0.75 * sunSide * sunSide);

          gl_FragColor = vec4(atmoColor * intensity, intensity);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    this.earthAtmoUniforms = atmoMat.uniforms;
    return new THREE.Mesh(atmoGeom, atmoMat);
  },

  /* ==========================================================================
     MARS ATMOSPHERE MESH (Keep unchanged for Mars)
     ========================================================================== */
  createAtmosphereMesh(radiusMultiplier, colorHex, intensityCoeff) {
    const atmoGeom = new THREE.SphereGeometry(1.0 * radiusMultiplier, 64, 64);
    const atmoColor = new THREE.Color(colorHex);

    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: this.sunDirection },
        atmoColor: { value: atmoColor },
        intensityCoeff: { value: intensityCoeff }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        uniform vec3 atmoColor;
        uniform float intensityCoeff;
        varying vec3 vWorldPos;

        void main() {
          vec3 outward = normalize(vWorldPos);
          vec3 viewDir = normalize(cameraPosition - vWorldPos);

          // Thin Fresnel rim on back-side sphere
          float rim = 1.0 - max(0.0, dot(outward, viewDir));
          rim = pow(rim, 3.8);

          // Strongest on sun side, fading on night side
          vec3 sunDir = normalize(sunDirection);
          float sunDot = dot(outward, sunDir);
          float sunSideFactor = smoothstep(-0.25, 0.45, sunDot);
          float fade = mix(0.03, 1.0, sunSideFactor);

          float alpha = rim * fade * intensityCoeff;
          gl_FragColor = vec4(atmoColor * alpha, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    return new THREE.Mesh(atmoGeom, atmoMat);
  },

  /* ==========================================================================
     LOAD & SWITCH PLANET
     ========================================================================== */
  loadPlanet(planetKey) {
    this.currentPlanet = planetKey;

    // Clear existing meshes
    if (this.globeMesh) this.planetGroup.remove(this.globeMesh);
    if (this.cloudsMesh) this.planetGroup.remove(this.cloudsMesh);
    if (this.atmosphereMesh) this.planetGroup.remove(this.atmosphereMesh);
    this.cloudsMesh = null;
    this.atmosphereMesh = null;
    this.earthNightUniforms = null;
    this.earthAtmoUniforms = null;
    this.clearMarkers();

    const radius = 1.0;
    const segments = 64;
    const geometry = new THREE.SphereGeometry(radius, segments, segments);

    let material;
    if (planetKey === 'earth') {
      // Requirement 6: Earth axial tilt 23.4°
      this.planetGroup.rotation.z = 23.44 * (Math.PI / 180);

      // Requirements 1 & 2: MeshPhongMaterial with night lights onBeforeCompile
      material = this.createEarthMaterial();

      // Requirement 3: Clouds sphere radius 1.008 with map AND alphaMap
      this.cloudsMesh = this.createCloudsMesh(radius, segments);
      this.planetGroup.add(this.cloudsMesh);

      // Requirement 4: Atmosphere radius 1.06, BackSide, Additive, #4da6ff
      this.atmosphereMesh = this.createEarthAtmosphereMesh(radius, segments);
      this.planetGroup.add(this.atmosphereMesh);

    } else if (planetKey === 'mars') {
      // Mars axial tilt: 25.2°
      this.planetGroup.rotation.z = 25.19 * (Math.PI / 180);

      // Requirement 6: mars_2k_hd.jpg with sRGB, bump from own texture
      const marsMap = this.loadTextureSafe(
        'assets/textures/mars_2k_hd.jpg',
        'assets/textures/mars_2k.jpg',
        true,
        () => this.generatePlanetTexture('mars')
      );

      material = new THREE.MeshStandardMaterial({
        map: marsMap,
        bumpMap: marsMap,
        bumpScale: 0.022,
        roughness: 0.90,
        metalness: 0.02
      });

      // Requirement 5: Mars thin dusty orange rim (#ff9a5a), weaker
      this.atmosphereMesh = this.createAtmosphereMesh(1.028, '#e9a27a', 0.28);
      this.planetGroup.add(this.atmosphereMesh);

    } else {
      // Moon - Axial tilt: 1.5°
      this.planetGroup.rotation.z = 1.54 * (Math.PI / 180);

      // Requirement 6: moon_2k.jpg with sRGB, bump from own texture
      const moonMap = this.loadTextureSafe(
        'assets/textures/moon_2k.jpg',
        'assets/textures/moon_1024.jpg',
        true,
        () => this.generatePlanetTexture('moon')
      );

      material = new THREE.MeshStandardMaterial({
        map: moonMap,
        bumpMap: moonMap,
        bumpScale: 0.018,
        roughness: 0.95,
        metalness: 0.01
      });

      // Requirement 5: Moon has NO atmosphere
      this.atmosphereMesh = null;
    }

    this.globeMesh = new THREE.Mesh(geometry, material);
    this.planetGroup.add(this.globeMesh);

    // Requirement 8: Spawn 3D Analog Site Pins
    this.createSiteMarkers(planetKey);

    // Update Telemetry HUD Card & Tabs
    this.renderTelemetryHUD();
    this.updateActiveTabs();
  },

  /* ==========================================================================
     INTERACTIVE 3D SITE PINS (Requirement 8)
     ~40% of original size, glowing cyan dots with soft pulse, hidden on far side.
     ========================================================================== */
  latLonToVector3(lat, lon, radius = 1.02) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return new THREE.Vector3(x, y, z);
  },

  createSiteMarkers(planetKey) {
    const data = this.planetData[planetKey];
    if (!data || !data.sites) return;

    data.sites.forEach(site => {
      const pos = this.latLonToVector3(site.lat, site.lon, 1.018);

      // Glowing cyan dot (40% of 0.024 radius ≈ 0.0096)
      const pinGeom = new THREE.SphereGeometry(0.0096, 16, 16);
      const pinColor = 0x00f5ff;
      const pinMat = new THREE.MeshBasicMaterial({ color: pinColor });
      const pinMesh = new THREE.Mesh(pinGeom, pinMat);
      pinMesh.position.copy(pos);
      pinMesh.userData = site;

      // Outer pulsating ring (40% of 0.035, 0.048 ≈ 0.014, 0.0192)
      const ringGeom = new THREE.RingGeometry(0.014, 0.0192, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      ringMesh.userData = site;

      this.markersGroup.add(pinMesh);
      this.markersGroup.add(ringMesh);
    });
  },

  clearMarkers() {
    while (this.markersGroup.children.length > 0) {
      const obj = this.markersGroup.children[0];
      this.markersGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }
  },

  /* ==========================================================================
     SMOOTH MOUSE & TOUCH ROTATION INTERACTION
     ========================================================================== */
  setupInteraction() {
    const dom = this.renderer.domElement;

    // Mouse Controls
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.resetIdleTimer();
    });

    dom.addEventListener('mousemove', (e) => {
      this.onPointerMove(e);

      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.rotationVelocity.y = deltaX * 0.004;
      this.rotationVelocity.x = deltaY * 0.004;

      this.planetGroup.rotation.y += this.rotationVelocity.y;
      this.planetGroup.rotation.x += this.rotationVelocity.x;

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Touch Controls
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.autoRotate = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
        this.previousMousePosition = { x: touchStartX, y: touchStartY };
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      if (Math.hypot(curX - touchStartX, curY - touchStartY) > 8) {
        touchMoved = true;
      }
      const deltaX = curX - this.previousMousePosition.x;
      const deltaY = curY - this.previousMousePosition.y;

      this.planetGroup.rotation.y += deltaX * 0.004;
      this.planetGroup.rotation.x += deltaY * 0.004;

      this.previousMousePosition = { x: curX, y: curY };
    }, { passive: true });

    dom.addEventListener('touchend', () => {
      this.isDragging = false;
      this.resetIdleTimer();
      if (!touchMoved) {
        this.onPointerClick({ clientX: touchStartX, clientY: touchStartY });
      }
    });

    // Zoom on Wheel
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.z += e.deltaY * 0.0015;
      this.camera.position.z = Math.min(Math.max(this.camera.position.z, 1.8), 4.5);
    }, { passive: false });

    // Click Detection for Site Pins
    dom.addEventListener('click', (e) => {
      if (!touchMoved) {
        this.onPointerClick(e);
      }
    });
  },

  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Only intersect pins that are currently visible on the near side
    const visibleMarkers = this.markersGroup.children.filter(obj => obj.visible);
    const intersects = this.raycaster.intersectObjects(visibleMarkers);

    if (intersects.length > 0) {
      document.body.style.cursor = 'pointer';
      const site = intersects[0].object.userData;
      this.showPinTooltip(e.clientX, e.clientY, site);
    } else {
      document.body.style.cursor = 'default';
      this.hidePinTooltip();
    }
  },

  onPointerClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Only intersect pins that are currently visible on the near side
    const visibleMarkers = this.markersGroup.children.filter(obj => obj.visible);
    const intersects = this.raycaster.intersectObjects(visibleMarkers);

    if (intersects.length > 0) {
      const site = intersects[0].object.userData;
      this.selectPinSite(site);
    }
  },

  selectPinSite(site) {
    const lang = window.I18n ? window.I18n.currentLang : 'en';
    const isAr = lang === 'ar';
    const title = isAr ? site.name_ar : site.name;
    const target = isAr ? site.target_ar : site.target;

    // Award Gamification XP for exploring 3D Planet site
    if (window.UserSystem) {
      window.UserSystem.discoverSite(site.id || site.name, title);
    }

    // Trigger Dynamic Twin Showcase Below Globe
    if (window.HomeShowcase && typeof window.HomeShowcase.displayCustomSitePair === 'function') {
      window.HomeShowcase.displayCustomSitePair(site.id || site.name);
    }
    document.dispatchEvent(new CustomEvent('planetSiteSelected', { detail: site }));

    const popup = document.getElementById('planetSiteSelectedPopup');
    if (popup) {
      popup.innerHTML = `
        <div class="planet-site-popup-inner">
          <div class="popup-top">
            <span class="sci-badge validated">3D TELEMETRY LOCK</span>
            <button class="popup-close" onclick="document.getElementById('planetSiteSelectedPopup').style.display='none'">✕</button>
          </div>
          <div class="popup-site-name">${title}</div>
          <div class="popup-site-coords">LAT: ${site.lat.toFixed(2)}° • LON: ${site.lon.toFixed(2)}°</div>
          <div class="popup-site-desc">${target}</div>
          <div class="popup-actions">
            <a href="${this.finderLink(site)}" class="btn-popup-action primary">${isAr ? 'عرض في مستكشف المواقع' : 'View in Site Finder'}</a>
            <a href="compare.html?${String(site.id).startsWith('earth-') ? 'siteA' : 'target'}=${site.id}" class="btn-popup-action">${isAr ? 'مقارنة معيارية' : 'Compare Site'}</a>
          </div>
        </div>
      `;
      popup.style.display = 'block';
    }
  },

  showPinTooltip(x, y, site) {
    let tip = document.getElementById('planetPinTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'planetPinTooltip';
      tip.className = 'planet-pin-tooltip';
      document.body.appendChild(tip);
    }

    const lang = window.I18n ? window.I18n.currentLang : 'en';
    const isAr = lang === 'ar';
    tip.innerHTML = `
      <div class="tip-title">${isAr ? site.name_ar : site.name}</div>
      <div class="tip-sub">${isAr ? site.target_ar : site.target}</div>
    `;

    tip.style.top = `${y - 48}px`;
    tip.style.left = `${x + 16}px`;
    tip.style.display = 'block';
  },

  hidePinTooltip() {
    const tip = document.getElementById('planetPinTooltip');
    if (tip) tip.style.display = 'none';
  },

  resetIdleTimer() {
    clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.autoRotate = true;
    }, 2800);
  },

  /* ==========================================================================
     ANIMATION LOOP
     ========================================================================== */
  animate() {
    requestAnimationFrame(() => this.animate());

    // Requirement 7: Slow auto-rotation (~120 s per turn), paused while dragging
    const autoRotateSpeed = (Math.PI * 2) / (120 * 60);

    if (this.autoRotate && !this.isDragging) {
      this.planetGroup.rotation.y += autoRotateSpeed;
    } else if (!this.isDragging) {
      // Gentle damping inertia when released
      this.planetGroup.rotation.y += this.rotationVelocity.y;
      this.planetGroup.rotation.x += this.rotationVelocity.x;
      this.rotationVelocity.x *= 0.94;
      this.rotationVelocity.y *= 0.94;
    }

    // Clouds rotating slightly faster than Earth
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += 0.0004;
    }

    // Update view-space sun direction for Earth night lights and atmosphere
    if (this.camera && (this.earthNightUniforms || this.earthAtmoUniforms)) {
      this.camera.updateMatrixWorld();
      const sunView = this.sunDirection.clone()
        .transformDirection(this.camera.matrixWorldInverse)
        .normalize();

      if (this.earthNightUniforms && this.earthNightUniforms.sunDirectionInViewSpace) {
        this.earthNightUniforms.sunDirectionInViewSpace.value.copy(sunView);
      }
      if (this.earthAtmoUniforms && this.earthAtmoUniforms.sunDirView) {
        this.earthAtmoUniforms.sunDirView.value.copy(sunView);
      }
    }

    // Requirement 8: Soft pulse & Far-side culling for pins
    const time = performance.now() * 0.002;
    const pulseScale = 1.0 + Math.sin(time * 2.5) * 0.18;
    const pulseOpacity = 0.52 + Math.sin(time * 2.5) * 0.24;
    const dotPulse = 1.0 + Math.sin(time * 2.5) * 0.10;

    const camPos = this.camera.position;
    const markerWorldPos = new THREE.Vector3();
    const toCam = new THREE.Vector3();

    this.markersGroup.children.forEach(child => {
      child.getWorldPosition(markerWorldPos);
      toCam.subVectors(camPos, markerWorldPos).normalize();
      const normal = markerWorldPos.clone().normalize();
      const dotProd = normal.dot(toCam);

      // Requirement 8: Hidden on the far side
      if (dotProd <= 0.05) {
        child.visible = false;
      } else {
        child.visible = true;
        if (child.geometry && child.geometry.type === 'RingGeometry') {
          child.scale.set(pulseScale, pulseScale, pulseScale);
          if (child.material) child.material.opacity = pulseOpacity;
        } else if (child.geometry && child.geometry.type === 'SphereGeometry') {
          child.scale.set(dotPulse, dotPulse, dotPulse);
        }
      }
    });

    this.renderer.render(this.scene, this.camera);
  },

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  },

  /* ==========================================================================
     TELEMETRY HUD & CONTROLS
     ========================================================================== */
  renderTelemetryHUD() {
    const data = this.planetData[this.currentPlanet];
    if (!data) return;

    const lang = window.I18n ? window.I18n.currentLang : 'en';
    const isAr = lang === 'ar';

    const kickerEl = document.getElementById('hudPlanetKicker');
    const nameEl = document.getElementById('hudPlanetName');
    const kickerDot = document.querySelector('.planet-station-kicker-dot');

    if (kickerEl) kickerEl.textContent = isAr ? data.kicker_ar : data.kicker_en;
    if (nameEl) {
      nameEl.textContent = isAr ? data.name_ar : data.name_en;
      nameEl.style.color = data.color || '#fff';
    }
    if (kickerDot) {
      kickerDot.style.background = data.color || '#00a3ff';
      kickerDot.style.boxShadow = '0 0 10px ' + (data.color || '#00a3ff');
    }

    // Real Scientific Metrics from User Dataset
    const slopeEl = document.getElementById('hudSlope') || document.getElementById('hudDiameter');
    const roughnessEl = document.getElementById('hudRoughness') || document.getElementById('hudGravity');
    const albedoEl = document.getElementById('hudAlbedo') || document.getElementById('hudAtmosphere');
    const tempSwingEl = document.getElementById('hudTempSwing') || document.getElementById('hudTemp');
    const ndviGateEl = document.getElementById('hudNdviGate') || document.getElementById('hudRotationPeriod');
    const catalogEl = document.getElementById('hudCatalogedSites') || document.getElementById('hudAnalogsCount');

    if (slopeEl) slopeEl.textContent = isAr ? data.slope_ar : data.slope;
    if (roughnessEl) roughnessEl.textContent = isAr ? data.roughness_ar : data.roughness;
    if (albedoEl) albedoEl.textContent = isAr ? data.albedo_ar : data.albedo;
    if (tempSwingEl) tempSwingEl.textContent = isAr ? data.temp_swing_ar : data.temp_swing;
    if (ndviGateEl) ndviGateEl.textContent = isAr ? data.ndvi_gate_ar : data.ndvi_gate;
    if (catalogEl) catalogEl.textContent = isAr ? data.catalog_sites_ar : data.catalog_sites;
  },

  updateActiveTabs() {
    const lang = window.I18n ? window.I18n.currentLang : 'en';
    const isAr = lang === 'ar';

    document.querySelectorAll('.planet-tab-btn').forEach(btn => {
      const p = btn.getAttribute('data-planet');
      btn.classList.toggle('active', p === this.currentPlanet);
      btn.setAttribute('aria-selected', p === this.currentPlanet ? 'true' : 'false');
      
      const titleEl = btn.querySelector('.planet-tab-name');
      if (titleEl) {
        if (p === 'earth') titleEl.textContent = isAr ? 'الأرض' : 'Earth';
        else if (p === 'mars') titleEl.textContent = isAr ? 'المريخ' : 'Mars';
        else if (p === 'moon') titleEl.textContent = isAr ? 'القمر' : 'Moon';
      }
    });
  },

  cyclePlanet(direction) {
    const currentIndex = this.planetsList.indexOf(this.currentPlanet);
    const nextIndex = (currentIndex + direction + this.planetsList.length) % this.planetsList.length;
    this.switchPlanet(this.planetsList[nextIndex]);
  },

  switchPlanet(planetKey) {
    if (planetKey === this.currentPlanet) return;
    this.loadPlanet(planetKey);
  },

  bindDOMControls() {
    // Side Navigation Arrows [ ❮ | ❯ ]
    const prevBtn = document.getElementById('planetNavPrev');
    const nextBtn = document.getElementById('planetNavNext');

    if (prevBtn) prevBtn.addEventListener('click', () => this.cyclePlanet(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.cyclePlanet(1));

    // Planet Switcher Tabs
    document.querySelectorAll('.planet-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = e.currentTarget.getAttribute('data-planet');
        this.switchPlanet(p);
      });
    });
  }
};

window.Planetary3D = Planetary3D;
