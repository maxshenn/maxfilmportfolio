// ───────────────────────────────────────────────
//  Three.js scene module
//  - Renderer, scene, camera, lights, environment
//  - GLTF model loader (with primitive fallback)
//  - Raycaster for interactive meshes
//  - Render loop + resize handling
// ───────────────────────────────────────────────

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const state = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  raycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  model: null,
  meshes: { screen: null, lensGlass: null, playButton: null },
  heroVideo: null,
  lcdMesh: null,
  hovering: false,
  onPlayButtonClick: null,
};

const MODEL_PATH = 'public/models/nikon_z6_camera (1).glb';
// Hero video is served same-origin so VideoTexture can sample its pixels
// (R2 doesn't send Access-Control-Allow-Origin, which would taint a WebGL texture).
const HERO_VIDEO_PATH = 'public/videos/hero.mp4';

export function getState() { return state; }

export async function initScene(container) {
  // ── Renderer ────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.classList.add('cs-canvas');
  container.appendChild(renderer.domElement);
  state.renderer = renderer;

  // ── Scene ───────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = null;
  state.scene = scene;

  // ── Environment (procedural studio HDRI) ───────────────
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // ── Camera ──────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    32,
    container.clientWidth / container.clientHeight,
    0.05,
    100
  );
  state.camera = camera;

  // ── Lights ──────────────────────────────────────────────
  // Key light — soft warm fill from upper-left
  const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
  key.position.set(-2.5, 3, 2.8);
  scene.add(key);

  // Rim light — cool from behind-right for edge definition
  const rim = new THREE.DirectionalLight(0xb8d4ff, 0.7);
  rim.position.set(3, 1.5, -2.5);
  scene.add(rim);

  // Soft ambient floor light
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambient);

  // ── Controls ────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.target.set(0, 0, 0);
  controls.enabled = false; // enabled later by scroll orchestrator
  state.controls = controls;

  // Position the camera behind the back screen — the "viewfinder" hero pose
  setRevealProgress(0);

  // ── Model load ──────────────────────────────────────────
  const model = await loadModel();
  scene.add(model);
  state.model = model;

  identifyMeshes(model);

  // ── Hero LCD video plane ───────────────────────────────
  // A flat plane positioned at the back of the camera body, textured with
  // the hero footage. The HERO scroll pose frames just this plane — it
  // reads as if the video plays inside the camera's screen.
  attachHeroVideoPlane(scene);

  // DEBUG (remove for prod) — used to tune plane position interactively
  if (window.location.hash === '#debug') window.__cs = { state, THREE };

  // ── Pointer events for raycasting ──────────────────────
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onCanvasClick);

  // ── Resize ──────────────────────────────────────────────
  window.addEventListener('resize', () => onResize(container));

  // ── Render loop ─────────────────────────────────────────
  renderer.setAnimationLoop(render);

  return state;
}

// ───────────────────────────────────────────────
//  Model loading
// ───────────────────────────────────────────────
function loadModel() {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);

    loader.load(
      MODEL_PATH,
      (gltf) => {
        const m = gltf.scene;
        normalizeModel(m);
        resolve(m);
      },
      undefined,
      () => {
        console.info('[scene] model load failed, using primitive fallback');
        resolve(buildPrimitiveCamera());
      }
    );
  });
}

function normalizeModel(model) {
  // Center the model and normalize its size so framing is predictable
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = 0.6;
  const scale = targetSize / maxDim;
  model.position.sub(center.multiplyScalar(scale));
  model.scale.setScalar(scale);
}

// Mount a flat plane in WORLD space at the back of the camera body and
// stream the hero footage to it. We add it to the scene root (not the
// model) so the position is in the same units as our reveal-progress
// camera coords — `normalizeModel()` shrinks the GLB by ~50x in local
// space, which would otherwise require absurd plane offsets.
function attachHeroVideoPlane(scene) {
  const video = document.createElement('video');
  video.src = HERO_VIDEO_PATH;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  // Some browsers won't decode an off-DOM <video> reliably; keep it in the
  // DOM but visually hidden so VideoTexture can sample fresh frames.
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);
  video.play().catch(() => { /* autoplay may be deferred — that's fine */ });

  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  // 16:9 to match frames2025.mp4 source aspect; depthTest off so the GLB's
  // baked LCD geometry can't occlude us.
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(0.22, 0.124);
  const plane = new THREE.Mesh(geo, mat);
  plane.name = 'HeroLcdScreen';
  // Plane normal default = +Z, which is exactly the back-of-camera direction
  // for this model — so no rotation needed; the plane faces the viewer.
  // World coords: LCD bezel is offset slightly toward -X (ports side, since
  // the +X half of the back is occupied by buttons/joypad/grip).
  plane.position.set(-0.043, -0.006, 0.17);
  plane.renderOrder = 999;
  scene.add(plane);

  state.heroVideo = video;
  state.lcdMesh = plane;
}

function identifyMeshes(model) {
  // Look for named meshes in the GLB. Common conventions:
  //   "ViewfinderScreen" / "Screen" / "BackScreen"
  //   "LensGlass" / "Lens_Front"
  //   "PlayButton" / "Library_Button" / "Play"
  model.traverse((node) => {
    if (!node.isMesh) return;
    const name = (node.name || '').toLowerCase();
    if (!state.meshes.screen && /screen|viewfinder|lcd/.test(name)) {
      state.meshes.screen = node;
    }
    if (!state.meshes.lensGlass && /lens.*glass|glass|lens_front/.test(name)) {
      state.meshes.lensGlass = node;
    }
    if (!state.meshes.playButton && /play|library/.test(name)) {
      state.meshes.playButton = node;
    }
  });
}

// ───────────────────────────────────────────────
//  Primitive fallback camera
//  Builds a stylized Z6III silhouette using primitives.
//  Drops in cleanly when no GLB exists, with named meshes
//  that the raycaster and scroll logic look for.
// ───────────────────────────────────────────────
function buildPrimitiveCamera() {
  const group = new THREE.Group();

  const matMatte = new THREE.MeshPhysicalMaterial({
    color: 0x1a1916,
    roughness: 0.78,
    metalness: 0.18,
    clearcoat: 0.35,
    clearcoatRoughness: 0.6,
  });
  const matRubber = new THREE.MeshPhysicalMaterial({
    color: 0x0d0c0b,
    roughness: 0.95,
    metalness: 0.0,
  });
  const matMetal = new THREE.MeshPhysicalMaterial({
    color: 0x2a2826,
    roughness: 0.32,
    metalness: 0.85,
  });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x101418,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.9,
    thickness: 0.1,
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const matRedDot = new THREE.MeshStandardMaterial({
    color: 0xc8362d,
    roughness: 0.4,
    metalness: 0.2,
  });

  // ── Body — slightly rounded box ──
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.10),
    matMatte
  );
  body.name = 'CameraBody';
  group.add(body);

  // ── Grip — protrudes right side ──
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.22, 0.13),
    matRubber
  );
  grip.position.set(0.16, -0.005, 0.018);
  grip.name = 'Grip';
  group.add(grip);

  // ── Top hump (pentaprism housing) ──
  const hump = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.05, 0.10),
    matMatte
  );
  hump.position.set(-0.05, 0.13, 0);
  group.add(hump);

  // ── Lens mount ring ──
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.012, 48),
    matMetal
  );
  mount.rotation.x = Math.PI / 2;
  mount.position.set(-0.05, -0.005, 0.056);
  group.add(mount);

  // ── Lens barrel ──
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.072, 0.16, 48),
    matMatte
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-0.05, -0.005, 0.142);
  lens.name = 'LensBarrel';
  group.add(lens);

  // ── Lens focus ring ──
  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.024, 64),
    matRubber
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(-0.05, -0.005, 0.18);
  group.add(focusRing);

  // ── Lens glass (front element) ──
  const lensGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.008, 48),
    matGlass
  );
  lensGlass.rotation.x = Math.PI / 2;
  lensGlass.position.set(-0.05, -0.005, 0.222);
  lensGlass.name = 'LensGlass';
  group.add(lensGlass);

  // Inner lens ring (creates depth in the glass)
  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.062, 48),
    matMetal
  );
  innerRing.position.set(-0.05, -0.005, 0.226);
  group.add(innerRing);

  // Bezel — sits flush on the body's back, screen mounts in front of it.
  // Order matters: bezel must be CLOSER to body, screen CLOSER to viewer.
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.235, 0.165, 0.002),
    matRubber
  );
  bezel.position.set(-0.04, 0, -0.0515);
  group.add(bezel);

  // ── Back screen (viewfinder display) — front-most layer on -Z face ──
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.15),
    makeScreenMaterial()
  );
  screen.position.set(-0.04, 0, -0.053);
  screen.rotation.y = Math.PI;
  screen.name = 'ViewfinderScreen';
  group.add(screen);

  // ── Play / Library button (named for raycasting) ──
  const playBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.004, 24),
    matMetal
  );
  playBtn.rotation.x = Math.PI / 2;
  playBtn.position.set(0.135, 0.06, -0.052);
  playBtn.name = 'PlayButton';
  group.add(playBtn);

  // Triangle play icon on the button
  const playIcon = new THREE.Mesh(
    new THREE.CircleGeometry(0.005, 3),
    new THREE.MeshBasicMaterial({ color: 0xf0ece2 })
  );
  playIcon.position.set(0.135, 0.06, -0.054);
  playIcon.rotation.z = -Math.PI / 2;
  group.add(playIcon);

  // ── Shutter button on top ──
  const shutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24),
    matMetal
  );
  shutter.position.set(0.135, 0.118, 0.022);
  group.add(shutter);

  // ── Mode dial ──
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.018, 32),
    matMatte
  );
  dial.position.set(0.085, 0.122, -0.012);
  group.add(dial);

  // ── Red accent dot (Nikon-ish) ──
  const redDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.005, 24),
    matRedDot
  );
  redDot.position.set(0.04, 0.02, 0.0501);
  group.add(redDot);

  // ── Hot shoe ──
  const hotShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.012, 0.04),
    matMetal
  );
  hotShoe.position.set(-0.05, 0.16, 0);
  group.add(hotShoe);

  // ── Brand text plate (just a subtle inset) ──
  const brandPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.014),
    new THREE.MeshStandardMaterial({
      color: 0xcfc8b8,
      roughness: 0.5,
      metalness: 0.4,
    })
  );
  brandPlate.position.set(-0.05, 0.085, 0.0501);
  group.add(brandPlate);

  // Cache mesh references for raycaster / scroll logic
  state.meshes.screen = screen;
  state.meshes.lensGlass = lensGlass;
  state.meshes.playButton = playBtn;

  // The model's "forward" (lens direction) is +Z
  return group;
}

function makeScreenMaterial() {
  // Canvas texture: cinematic viewfinder-style display showing the brand
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 700;
  const ctx = c.getContext('2d');

  // Base — dark slate, subtle vignette
  const grad = ctx.createRadialGradient(512, 350, 80, 512, 350, 560);
  grad.addColorStop(0, '#1a1d22');
  grad.addColorStop(1, '#06070a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 700);

  // Subtle scanlines (LCD feel)
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#000';
  for (let y = 0; y < 700; y += 3) ctx.fillRect(0, y, 1024, 1);
  ctx.globalAlpha = 1;

  // Focus brackets (corners)
  ctx.strokeStyle = '#f0ece2';
  ctx.lineWidth = 3;
  const bSize = 36;
  const margin = 80;
  const drawBracket = (x, y, dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * bSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * bSize, y);
    ctx.stroke();
  };
  drawBracket(margin, margin, 1, 1);
  drawBracket(1024 - margin, margin, -1, 1);
  drawBracket(margin, 700 - margin, 1, -1);
  drawBracket(1024 - margin, 700 - margin, -1, -1);

  // Brand text
  ctx.fillStyle = '#f0ece2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 142px "Barlow Condensed", sans-serif';
  ctx.fillText('MAX SHEN', 512, 320);

  ctx.font = '300 22px Montserrat, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillStyle = 'rgba(240,236,226,0.6)';
  ctx.fillText('M Y   D I G I T A L   P O R T F O L I O', 512, 400);

  // Bottom HUD strip
  ctx.fillStyle = 'rgba(240,236,226,0.45)';
  ctx.font = '300 18px Montserrat, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('1/250s   f/2.8   ISO 400   AWB', 80, 660);
  ctx.textAlign = 'right';
  ctx.fillText('REC ●', 1024 - 80, 660);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}

// ───────────────────────────────────────────────
//  Pointer / raycaster
// ───────────────────────────────────────────────
function onPointerMove(e) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function onCanvasClick() {
  if (!state.meshes.playButton) return;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const hits = state.raycaster.intersectObject(state.meshes.playButton, true);
  if (hits.length && state.onPlayButtonClick) {
    state.onPlayButtonClick();
  }
}

export function setPlayButtonHandler(fn) {
  state.onPlayButtonClick = fn;
}

// ───────────────────────────────────────────────
//  Resize
// ───────────────────────────────────────────────
function onResize(container) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(w, h);
}

// ───────────────────────────────────────────────
//  Render loop
// ───────────────────────────────────────────────
function render() {
  // Hover detection on play button (cursor change)
  if (state.meshes.playButton && state.controls?.enabled) {
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const hits = state.raycaster.intersectObject(state.meshes.playButton, true);
    const hovering = hits.length > 0;
    if (hovering !== state.hovering) {
      state.hovering = hovering;
      state.renderer.domElement.style.cursor = hovering ? 'pointer' : '';
    }
  }

  if (state.controls?.enabled) state.controls.update();
  state.renderer.render(state.scene, state.camera);
}

// ───────────────────────────────────────────────
//  Reveal progress driver
//  Tweens the camera in spherical coords around the LCD plane (at t=0)
//  fading toward the model's center (at t=1).
//  Model axes (nikon_z6_camera (1).glb):
//    +X = grip side             -X = ports side
//    +Y = top                   -Y = bottom
//    +Z = back of camera (LCD)  -Z = lens / front
//  HERO (t=0): camera on +Z axis, LCD plane fills viewport (hero video)
//  END  (t=1): camera at front-grip-3/4, body in frame
//  Arc sweeps through +X (grip side) for a ~128° reveal.
// ───────────────────────────────────────────────
const _spherical = new THREE.Spherical();
const _orbitFrom  = new THREE.Vector3(-0.043, -0.006, 0.17); // LCD plane center
const _orbitTo    = new THREE.Vector3(0, 0, 0);              // model center
const _orbitCenter = new THREE.Vector3();

export function setRevealProgress(t) {
  if (!state.camera) return;
  t = Math.max(0, Math.min(1, t));
  const e = easeInOut(t);
  _orbitCenter.copy(_orbitFrom).lerp(_orbitTo, e);
  // theta=0 → +Z direction (looking at LCD head-on)
  // theta=2.234 (~128°) → front-grip 3/4 view (over the +X grip toward the -Z lens)
  const theta = THREE.MathUtils.lerp(0, 2.234, e);
  const phi   = THREE.MathUtils.lerp(Math.PI / 2 - 0.04, 1.35, e);
  // r is small at t=0 so the LCD plane fully overflows the viewport (hero
  // video reads as a full-bleed shot); expands at t=1 for the full body view.
  const r     = THREE.MathUtils.lerp(0.20, 0.95, e);
  _spherical.set(r, phi, theta);
  state.camera.position.setFromSpherical(_spherical).add(_orbitCenter);
  state.camera.lookAt(_orbitCenter);
  state.camera.fov = THREE.MathUtils.lerp(30, 38, t);
  state.camera.updateProjectionMatrix();
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ───────────────────────────────────────────────
//  Lens-facing helpers (for snap-to-lens)
// ───────────────────────────────────────────────
export function getLensFacingAngle() {
  // Returns angle in radians between camera-forward and model-+Z (lens direction)
  if (!state.model || !state.camera) return 0;
  const lensForward = new THREE.Vector3(0, 0, 1);
  // Account for both controls orbit and any model rotation
  const toCamera = state.camera.position.clone()
    .sub(state.controls.target).normalize();
  return lensForward.angleTo(toCamera);
}

export function getLensFrontWorldPosition() {
  // The point just in front of the lens glass, used as the zoom destination
  if (!state.meshes.lensGlass) return new THREE.Vector3(0, 0, 0.3);
  const p = new THREE.Vector3();
  state.meshes.lensGlass.getWorldPosition(p);
  p.z += 0.05;
  return p;
}
