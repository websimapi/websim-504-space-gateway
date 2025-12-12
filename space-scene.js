import * as THREE from 'three';

/**
 * Initializes the Space Scene within a specific DOM element.
 * @param {string} containerId - The ID of the div to render into.
 */
export function initSpaceScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container #${containerId} not found.`);
    return;
  }

  // --- Configuration ---
  const CONFIG = {
    colors: {
      primary: 0x00f5ff,    // Cyan
      secondary: 0xff00ff,  // Magenta
      accent: 0x7b2dff,     // Purple
      bg: 0x050510,         // Deep Dark Blue
    },
    planet: {
      radius: 3.5,
      detail: 64
    }
  };

  // --- Setup Scene ---
  const scene = new THREE.Scene();
  // Add some fog for depth
  scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.035);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.z = 12;

  const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // --- Mouse / Interaction State ---
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // --- Asset Generators (Procedural Textures) ---

  // Generate a detailed ring texture
  function createRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const center = 512;

    ctx.clearRect(0, 0, 1024, 1024);

    // Underlying glow
    const glow = ctx.createRadialGradient(center, center, 200, center, center, 500);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(0.3, 'rgba(123, 45, 255, 0.05)');
    glow.addColorStop(0.6, 'rgba(0, 245, 255, 0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 1024);

    // Draw many detailed rings
    for(let i = 0; i < 400; i++) {
      const radius = 250 + Math.random() * 260;
      const width = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.4 + 0.1;

      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.lineWidth = width;
      
      // Randomly pick between scene colors (Purple, Cyan, White)
      const r = Math.random();
      if (r > 0.6) {
        ctx.strokeStyle = `rgba(123, 45, 255, ${alpha})`; // Purple
      } else if (r > 0.3) {
        ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`; // Cyan
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; // White
      }
      ctx.stroke();
    }
    
    // Add noise/grain to the rings
    const imageData = ctx.getImageData(0, 0, 1024, 1024);
    const data = imageData.data;
    for(let i=0; i<data.length; i+=4) {
      if(data[i+3] > 0) { // If pixel exists
        const noise = (Math.random() - 0.5) * 30;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.rotation = -Math.PI / 2; // Fix canvas orientation
    texture.center.set(0.5, 0.5);
    return texture;
  }

  // Generate a planet surface texture
  function createPlanetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Dark base
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, 0, 1024, 512);
    
    // Horizontal bands
    for(let i=0; i<30; i++) {
      const y = Math.random() * 512;
      const height = Math.random() * 100 + 20;
      ctx.fillStyle = `rgba(20, 10, 60, ${Math.random() * 0.5})`;
      ctx.fillRect(0, y, 1024, height);
    }

    // "Storms" and details
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const r = Math.random() * 80 + 20;
      
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const colorType = Math.random();
      let colorStr = '255, 255, 255';
      if(colorType > 0.6) colorStr = '123, 45, 255'; // Purple
      else if(colorType > 0.3) colorStr = '0, 245, 255'; // Cyan
      
      grad.addColorStop(0, `rgba(${colorStr}, ${Math.random() * 0.15})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }

  // --- Object Creation Classes ---

  class Starfield {
    constructor(count = 1500) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const colors = new Float32Array(count * 3);

      const color1 = new THREE.Color(CONFIG.colors.primary);
      const color2 = new THREE.Color(CONFIG.colors.secondary);

      for (let i = 0; i < count; i++) {
        // Spread stars in a wide volume
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10; // Bias towards back

        sizes[i] = Math.random() * 0.5;

        // Mix colors
        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i * 3] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
      });

      this.mesh = new THREE.Points(geometry, material);
    }
  }

  class Planet {
    constructor() {
      this.group = new THREE.Group();

      // Main Sphere
      const geometry = new THREE.SphereGeometry(CONFIG.planet.radius, 64, 64);

      // Physically based material for the planet body with texture
      const material = new THREE.MeshStandardMaterial({
        map: createPlanetTexture(),
        roughness: 0.6,
        metalness: 0.2,
        emissive: 0x050510,
        emissiveIntensity: 0.5
      });

      this.mesh = new THREE.Mesh(geometry, material);
      this.group.add(this.mesh);

      // Atmosphere Glow (slightly larger sphere, rendered behind)
      const atmoGeo = new THREE.SphereGeometry(CONFIG.planet.radius + 0.2, 64, 64);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.accent,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
      });
      const atmo = new THREE.Mesh(atmoGeo, atmoMat);
      this.group.add(atmo);

      // Rings
      this.createRings();
    }

    createRings() {
      // 1. Main Textured Disk Ring (The "Saturn" look)
      const ringGeo = new THREE.RingGeometry(4.2, 7.5, 128);
      const pos = ringGeo.attributes.position;
      const uvs = new Float32Array(pos.count * 2);

      // Calculate UVs manually for RingGeometry to map the circular texture correctly
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Map x,y coordinates to 0..1 UV space
        uvs[i * 2] = (x / 15) + 0.5;
        uvs[i * 2 + 1] = (y / 15) + 0.5;
      }
      ringGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      const ringMat = new THREE.MeshBasicMaterial({
        map: createRingTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false // Don't occlude particles behind it
      });

      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      // Increased tilt for better visibility
      this.ringMesh.rotation.x = Math.PI / 2 + 0.35; 
      this.ringMesh.rotation.y = -0.1;
      this.group.add(this.ringMesh);
    }

    update(time) {
      // Rotate planet slowly
      this.mesh.rotation.y = time * 0.03;
      // Rotate rings independently and faster
      this.ringMesh.rotation.z = time * 0.05;
    }
  }

  class Moon {
    constructor(radius, distance, speed, color, offset) {
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.6
      });
      this.mesh = new THREE.Mesh(geometry, material);
      this.distance = distance;
      this.speed = speed;
      this.offset = offset;
    }

    update(time) {
      const angle = (time * this.speed) + this.offset;
      // Orbit on XZ plane, slightly tilted
      this.mesh.position.x = Math.cos(angle) * this.distance;
      this.mesh.position.z = Math.sin(angle) * this.distance;
      this.mesh.position.y = Math.sin(angle) * (this.distance * 0.3); // Tilt
    }
  }

  // Refactored Text3D from original code
  class Text3D {
    constructor() {
      this.group = new THREE.Group();
      this.createText();
    }

    createText() {
      const digits = ['5', '0', '4'];
      const spacing = 2.5;

      digits.forEach((digit, index) => {
        const digitGroup = this.createDigit(digit);
        digitGroup.position.x = (index - 1) * spacing;
        this.group.add(digitGroup);
      });
    }

    createDigit(digit) {
      const group = new THREE.Group();
      const segments = this.getSegments(digit);

      segments.forEach(seg => {
        // Main block
        const geometry = new THREE.BoxGeometry(seg.w, seg.h, 0.4);
        const material = new THREE.MeshStandardMaterial({
          color: CONFIG.colors.primary,
          emissive: CONFIG.colors.primary,
          emissiveIntensity: 0.4,
          metalness: 0.9,
          roughness: 0.1,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(seg.x, seg.y, 0);

        // Glass/Glow shell
        const glowGeometry = new THREE.BoxGeometry(seg.w + 0.1, seg.h + 0.1, 0.5);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: CONFIG.colors.primary,
          transparent: true,
          opacity: 0.15,
          wireframe: true // Adds a techy look
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.set(seg.x, seg.y, 0);

        group.add(mesh);
        group.add(glowMesh);
      });

      return group;
    }

    getSegments(digit) {
      const w = 0.35; const h = 0.9; 
      const hw = 1.6; const hh = 0.35;

      const patterns = {
        '5': [{ x: 0, y: 1.3, w: hw, h: hh }, { x: -0.65, y: 0.65, w: w, h: h }, { x: 0, y: 0, w: hw, h: hh }, { x: 0.65, y: -0.65, w: w, h: h }, { x: 0, y: -1.3, w: hw, h: hh }],
        '0': [{ x: 0, y: 1.3, w: hw, h: hh }, { x: -0.65, y: 0.65, w: w, h: h }, { x: 0.65, y: 0.65, w: w, h: h }, { x: -0.65, y: -0.65, w: w, h: h }, { x: 0.65, y: -0.65, w: w, h: h }, { x: 0, y: -1.3, w: hw, h: hh }],
        '4': [{ x: -0.65, y: 0.65, w: w, h: h }, { x: 0.65, y: 0.65, w: w, h: h }, { x: 0, y: 0, w: hw, h: hh }, { x: 0.65, y: -0.65, w: w, h: h }],
      };
      return patterns[digit] || [];
    }
  }

  // --- Initialize Objects ---

  // Starfield
  const starfield = new Starfield();
  scene.add(starfield.mesh);

  // Planet & Rings
  const planet = new Planet();
  planet.group.position.z = -5; // Push planet back
  scene.add(planet.group);

  // Moons
  const moon1 = new Moon(0.3, 6, 0.5, CONFIG.colors.secondary, 0);
  const moon2 = new Moon(0.2, 5, 0.8, CONFIG.colors.primary, 2);
  scene.add(moon1.mesh);
  scene.add(moon2.mesh);

  // Text
  const text3D = new Text3D();
  scene.add(text3D.group);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  // The sun (Key light)
  const sunLight = new THREE.PointLight(0xffffff, 2, 50);
  sunLight.position.set(10, 10, 10);
  scene.add(sunLight);

  // Rim light (Backlight for planet)
  const rimLight = new THREE.PointLight(CONFIG.colors.accent, 4, 20);
  rimLight.position.set(-5, 5, -10);
  scene.add(rimLight);

  // Interaction Light (Follows mouse)
  const mouseLight = new THREE.PointLight(CONFIG.colors.primary, 1, 10);
  mouseLight.position.z = 5;
  scene.add(mouseLight);

  // --- Events ---

  function onMouseMove(e) {
    // Calculate mouse position relative to container
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normalize to -1 to 1
    mouse.targetX = (x / rect.width) * 2 - 1;
    mouse.targetY = -(y / rect.height) * 2 + 1;
  }

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('resize', onResize);

  // --- Animation Loop ---

  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Smooth mouse interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Camera Parallax
    camera.position.x = mouse.x * 0.5;
    camera.position.y = mouse.y * 0.5;
    camera.lookAt(0, 0, -2); // Look slightly past center

    // Object Updates
    planet.update(time);
    moon1.update(time);
    moon2.update(time);

    // Text Animation
    text3D.group.rotation.x = mouse.y * 0.1;
    text3D.group.rotation.y = mouse.x * 0.1;
    // Bobbing motion
    text3D.group.position.y = Math.sin(time * 2) * 0.1;

    // Mouse Light Update
    mouseLight.position.x = mouse.x * 5;
    mouseLight.position.y = mouse.y * 5;

    // Twinkle stars
    const colors = starfield.mesh.geometry.attributes.color;
    // Randomly update a few star colors for twinkle effect
    for(let i=0; i<50; i++) {
        const index = Math.floor(Math.random() * 1500);
        const intensity = 0.5 + Math.random() * 0.5;
        colors.setXYZ(index, colors.getX(index)*intensity, colors.getY(index)*intensity, colors.getZ(index)*intensity);
    }
    colors.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();
}