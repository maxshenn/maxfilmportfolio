// ───────────────────────────────────────────────
//  Scroll orchestration — GSAP + ScrollTrigger
//
//  State machine:
//    HERO ── scroll ──► REVEAL ── scroll ──► INTERACTIVE ── scroll ──► SNAP ──► PORTAL
//                                  ▲                                            │
//                                  └─────────── reverse ────────────────────────┘
//
//  - REVEAL is scrubbed (camera pulls out of the viewfinder).
//  - INTERACTIVE enables OrbitControls; scroll progress is "parked".
//  - SNAP rotates camera back to lens-facing if user dragged away.
//  - PORTAL zooms into the lens glass and fades in the Frames overlay.
// ───────────────────────────────────────────────

import { getState, setRevealProgress } from './scene.js';
import { showFramesOverlay, hideFramesOverlay, setHintText } from './overlays.js';

const PHASE = { HERO: 0, REVEAL: 1, INTERACTIVE: 2, SNAP: 3, PORTAL: 4 };
let phase = PHASE.HERO;
let revealTl = null;
let snapTl = null;
let portalTl = null;
let scrollTrigger = null;

export function initScroll() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) {
    console.error('[scroll] GSAP not loaded');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  const s = getState();

  // ── REVEAL timeline (scrubbed) ─────────────────────────
  // Drives a single normalized 0→1 value; setRevealProgress orbits the
  // camera in spherical coords from inside-the-viewfinder out to a
  // 3/4 front view.
  const revealState = { t: 0 };
  revealTl = gsap.timeline({ paused: true });
  revealTl.to(revealState, {
    t: 1,
    duration: 1,
    ease: 'none',
    onUpdate: () => setRevealProgress(revealState.t),
  });

  // ── Master ScrollTrigger ───────────────────────────────
  scrollTrigger = ScrollTrigger.create({
    trigger: '#cameraStage',
    start: 'top top',
    end: '+=420%',
    pin: true,
    scrub: 0.4,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const p = self.progress;

      // Drive the scrubbed REVEAL between 5% and 32% of total scroll
      if (p <= 0.32) {
        const t = Math.max(0, (p - 0.05) / 0.27);
        revealTl.progress(Math.min(1, t));
      } else {
        revealTl.progress(1);
      }

      // Phase determination from scroll position
      let target;
      if (p < 0.05) target = PHASE.HERO;
      else if (p < 0.32) target = PHASE.REVEAL;
      else if (p < 0.62) target = PHASE.INTERACTIVE;
      else if (p < 0.74) target = PHASE.SNAP;
      else target = PHASE.PORTAL;

      if (target !== phase) {
        handleTransition(phase, target);
        phase = target;
      }
    },
  });
}

// ───────────────────────────────────────────────
//  Phase transition handler
// ───────────────────────────────────────────────
function handleTransition(from, to) {
  const s = getState();
  const gsap = window.gsap;
  const body = document.body;

  // Wipe out class flags so we can set the right one cleanly
  body.classList.remove('cs-hero', 'cs-reveal', 'cs-interactive', 'cs-portal');

  // Whenever we leave PORTAL (forward or back), restore canvas opacity
  // since the PORTAL fade-out only applies while diving into the lens.
  if (from === PHASE.PORTAL && to !== PHASE.PORTAL && s.renderer?.domElement) {
    gsap.killTweensOf(s.renderer.domElement);
    gsap.to(s.renderer.domElement, { opacity: 1, duration: 0.4, ease: 'power2.out' });
  }

  if (to === PHASE.HERO) {
    body.classList.add('cs-hero');
    s.controls.enabled = false;
    setHintText('');
    // Reset to the inside-viewfinder camera pose (REVEAL timeline @ progress 0)
    if (revealTl) revealTl.progress(0);
  }

  if (to === PHASE.REVEAL) {
    body.classList.add('cs-reveal');
    s.controls.enabled = false;
    setHintText('');
    if (portalTl) { portalTl.kill(); portalTl = null; }
    hideFramesOverlay();
  }

  if (to === PHASE.INTERACTIVE) {
    body.classList.add('cs-interactive');
    if (snapTl) { snapTl.kill(); snapTl = null; }
    if (portalTl) { portalTl.kill(); portalTl = null; }
    hideFramesOverlay();

    if (from > PHASE.INTERACTIVE) {
      // Returning from forward phases — restore reveal end-pose
      gsap.to({ t: 0 }, {
        duration: 0.55,
        ease: 'power2.inOut',
        onStart: () => { s.controls.enabled = false; },
        onUpdate: function () { setRevealProgress(1); },
        onComplete: () => { s.controls.enabled = true; },
      });
    } else {
      s.controls.enabled = true;
    }
    setHintText('drag to rotate · keep scrolling to look closer');
  }

  if (to === PHASE.SNAP) {
    body.classList.add('cs-portal');
    s.controls.enabled = false;
    setHintText('');
    if (snapTl) snapTl.kill();
    // Lens points -Z. Snap to directly-front-of-lens pose for clean zoom-in.
    snapTl = gsap.timeline();
    snapTl.to(s.camera.position, {
      x: 0,
      y: 0,
      z: -0.85,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => s.camera.lookAt(0, 0, 0),
    });
    snapTl.to(s.camera, {
      fov: 36,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => s.camera.updateProjectionMatrix(),
    }, 0);
  }

  if (to === PHASE.PORTAL) {
    body.classList.add('cs-portal');
    s.controls.enabled = false;
    setHintText('');
    if (portalTl) portalTl.kill();
    portalTl = gsap.timeline();
    // Push virtual camera through the lens mount (front face near z=-0.167).
    portalTl.to(s.camera.position, {
      x: 0,
      y: 0,
      z: -0.22,
      duration: 1.0,
      ease: 'power2.in',
      onUpdate: () => s.camera.lookAt(0, 0, -0.4),
    }, 0);
    // Crossfade the WebGL canvas as we pierce the lens glass — this
    // dovetails into the frames-section reveal once the pin releases.
    if (s.renderer?.domElement) {
      portalTl.to(s.renderer.domElement, {
        opacity: 0,
        duration: 0.85,
        ease: 'power2.in',
      }, 0.15);
    }
  }
}

// ───────────────────────────────────────────────
//  External controls (used by overlays.js for play-button panel)
//  When the Portfolio Panel opens, we suspend the scroll-driven scene.
// ───────────────────────────────────────────────
export function suspendScroll() {
  if (scrollTrigger) scrollTrigger.disable(false);
  document.body.style.overflow = 'hidden';
}

export function resumeScroll() {
  if (scrollTrigger) scrollTrigger.enable();
  document.body.style.overflow = '';
}
