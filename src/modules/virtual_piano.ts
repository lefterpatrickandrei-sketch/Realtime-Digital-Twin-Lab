import * as THREE from 'three';

export interface PianoNote {
  name: string;
  freq: number;
  isBlack: boolean;
  offset: number;
}

export interface KeyUserData {
  note: PianoNote;
  originalY: number;
  targetY: number;
  originalColor: number;
  isPressed: boolean;
  pressVelocity: number;
  glowIntensity: number;
}

// Pre-allocated scratch vectors for zero-GC collision detection
const _tipWorldPos = new THREE.Vector3();
const _hitTolerance = new THREE.Vector3(0.014, 0.036, 0.028);
const _keyBox = new THREE.Box3();

/**
 * Interactive Velocity-Sensitive 3D Virtual Piano Module
 * Features dual-oscillator harmonic Web Audio synthesis, world-space fingertip
 * velocity tracking (vy = -dy/dt), and spring-damped 3D key mechanics.
 */
export class VirtualPiano {
  scene: THREE.Scene;
  group: THREE.Group;
  keys: THREE.Mesh[];
  active: boolean;
  sustainEnabled: boolean;
  audioCtx: AudioContext | null;
  lastPlayedTime: Record<string, number>;
  notes: PianoNote[];

  prevTipPositions: THREE.Vector3[];
  prevTipInitialized: boolean[];
  lastCheckTime: number;
  onNotePlayed?: (noteName: string, velocityNorm: number) => void;

  constructor(scene: THREE.Scene, onNotePlayed?: (noteName: string, velocityNorm: number) => void) {
    this.scene = scene;
    this.onNotePlayed = onNotePlayed;
    this.group = new THREE.Group();
    this.group.name = 'VirtualPiano';
    // Ergonomic chest/hand level aligned directly beneath forward-reaching fingertips
    this.group.position.set(0, 1.08, 0.40);
    this.group.rotation.x = -0.12;
    this.keys = [];
    this.active = false;
    this.sustainEnabled = true;
    this.audioCtx = null;
    this.lastPlayedTime = {};
    this.prevTipPositions = Array.from({ length: 12 }, () => new THREE.Vector3());
    this.prevTipInitialized = Array.from({ length: 12 }, () => false);
    this.lastCheckTime = performance.now();

    // 17-key extended range (C4 to E5) for wider bimanual performance
    this.notes = [
      { name: 'C4', freq: 261.63, isBlack: false, offset: -0.27 },
      { name: 'C#4', freq: 277.18, isBlack: true, offset: -0.24 },
      { name: 'D4', freq: 293.66, isBlack: false, offset: -0.21 },
      { name: 'D#4', freq: 311.13, isBlack: true, offset: -0.18 },
      { name: 'E4', freq: 329.63, isBlack: false, offset: -0.15 },
      { name: 'F4', freq: 349.23, isBlack: false, offset: -0.09 },
      { name: 'F#4', freq: 369.99, isBlack: true, offset: -0.06 },
      { name: 'G4', freq: 392.0, isBlack: false, offset: -0.03 },
      { name: 'G#4', freq: 415.3, isBlack: true, offset: 0.0 },
      { name: 'A4', freq: 440.0, isBlack: false, offset: 0.03 },
      { name: 'A#4', freq: 466.16, isBlack: true, offset: 0.06 },
      { name: 'B4', freq: 493.88, isBlack: false, offset: 0.09 },
      { name: 'C5', freq: 523.25, isBlack: false, offset: 0.15 },
      { name: 'C#5', freq: 554.37, isBlack: true, offset: 0.18 },
      { name: 'D5', freq: 587.33, isBlack: false, offset: 0.21 },
      { name: 'D#5', freq: 622.25, isBlack: true, offset: 0.24 },
      { name: 'E5', freq: 659.25, isBlack: false, offset: 0.27 }
    ];

    this.buildPiano();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioCtxConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxConstructor) {
        this.audioCtx = new AudioCtxConstructor();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Play velocity-sensitive synthesized note with dynamic low-pass filter brightness
   */
  playNote(note: PianoNote, velocityNorm = 0.75) {
    this.initAudio();
    if (!this.audioCtx) return;

    const now = performance.now();
    if (this.lastPlayedTime[note.name] && now - this.lastPlayedTime[note.name] < 105) {
      return;
    }
    this.lastPlayedTime[note.name] = now;

    const clampedVel = THREE.MathUtils.clamp(velocityNorm, 0.15, 1.0);
    if (this.onNotePlayed) {
      this.onNotePlayed(note.name, clampedVel);
    }

    try {
      const t0 = this.audioCtx.currentTime;
      const duration = this.sustainEnabled ? 1.15 : 0.48;

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc1.type = note.isBlack ? 'sawtooth' : 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(note.freq, t0);
      osc2.frequency.setValueAtTime(note.freq * 2.0, t0); // Octave harmonic overtone
      osc2.detune.setValueAtTime(4, t0);

      // Velocity-sensitive brightness filter
      filter.type = 'lowpass';
      const peakCutoff = 900 + clampedVel * 3400;
      filter.frequency.setValueAtTime(peakCutoff, t0);
      filter.frequency.exponentialRampToValueAtTime(420, t0 + duration);

      // Velocity-sensitive amplitude envelope
      const peakGain = 0.06 + clampedVel * 0.24;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + duration + 0.04);
      osc2.stop(t0 + duration + 0.04);
    } catch (err) {
      console.warn('Audio synth error:', err);
    }
  }

  buildPiano() {
    // Composite multi-part synthesizer chassis
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0f1522,
      roughness: 0.32,
      metalness: 0.85
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.042, 0.2), baseMat);
    baseMesh.position.set(0, -0.02, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    // Brushed aluminum side cheeks
    const cheekMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.25,
      metalness: 0.9
    });
    const leftCheek = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.056, 0.21), cheekMat);
    leftCheek.position.set(-0.325, -0.012, 0);
    this.group.add(leftCheek);

    const rightCheek = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.056, 0.21), cheekMat);
    rightCheek.position.set(0.325, -0.012, 0);
    this.group.add(rightCheek);

    // Telemetry cyan laser rail
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.004, 0.005), neonMat);
    strip.position.set(0, 0.004, 0.098);
    this.group.add(strip);

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.18,
      metalness: 0.12
    });

    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x141821,
      roughness: 0.28,
      metalness: 0.55
    });

    this.notes.forEach((note) => {
      const isBlack = note.isBlack;
      const width = isBlack ? 0.022 : 0.035;
      const length = isBlack ? 0.095 : 0.155;
      const height = isBlack ? 0.022 : 0.018;
      const yPos = isBlack ? 0.013 : 0.009;
      const zPos = isBlack ? -0.025 : 0.006;

      const keyGeom = new THREE.BoxGeometry(width, height, length);
      const keyMesh = new THREE.Mesh(keyGeom, isBlack ? blackMat.clone() : whiteMat.clone());
      keyMesh.position.set(note.offset, yPos, zPos);
      keyMesh.castShadow = true;
      keyMesh.receiveShadow = true;
      keyMesh.userData = {
        note,
        originalY: yPos,
        targetY: yPos,
        originalColor: isBlack ? 0x141821 : 0xf1f5f9,
        isPressed: false,
        pressVelocity: 0.75,
        glowIntensity: 0
      } as KeyUserData;

      this.group.add(keyMesh);
      this.keys.push(keyMesh);
    });
  }

  show() {
    this.active = true;
    this.group.visible = true;
    this.initAudio();
  }

  hide() {
    this.active = false;
    this.group.visible = false;
  }

  adjustHeight(delta: number): number {
    this.group.position.y = THREE.MathUtils.clamp(this.group.position.y + delta, 0.7, 1.45);
    return this.group.position.y;
  }

  /**
   * Smoothly animate 3D key depression & spring rebound every render frame
   */
  updateFrame(dt: number) {
    if (!this.active) return;
    const springAlpha = 1.0 - Math.exp(-28.0 * Math.min(dt, 0.1));
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i];
      const uData = key.userData as KeyUserData;
      key.position.y = THREE.MathUtils.lerp(key.position.y, uData.targetY, springAlpha);
    }
  }

  /**
   * Check collision and downward impact velocity between fingertips and 3D piano keys
   */
  checkCollisions(fingertipObjects: THREE.Object3D[]) {
    if (!this.active || !fingertipObjects || fingertipObjects.length === 0) return;

    const now = performance.now();
    const dt = Math.max((now - this.lastCheckTime) / 1000.0, 0.004);
    this.lastCheckTime = now;

    // 1. Sample current world positions & downward velocities for all fingertips
    const tipCount = Math.min(fingertipObjects.length, this.prevTipPositions.length);
    const currentPositions: THREE.Vector3[] = [];
    const downwardVelocities: number[] = [];

    for (let i = 0; i < tipCount; i++) {
      fingertipObjects[i].getWorldPosition(_tipWorldPos);
      const prev = this.prevTipPositions[i];
      let vy = 0.65;
      if (this.prevTipInitialized[i]) {
        const dy = prev.y - _tipWorldPos.y; // positive when moving downward
        const speed = Math.abs(dy) / dt;
        vy = THREE.MathUtils.clamp(0.35 + speed * 0.95, 0.25, 1.0);
      } else {
        this.prevTipInitialized[i] = true;
      }
      prev.copy(_tipWorldPos);
      currentPositions.push(prev);
      downwardVelocities.push(vy);
    }

    // 2. Evaluate bounding-box intersection for each key
    for (let k = 0; k < this.keys.length; k++) {
      const key = this.keys[k];
      const uData = key.userData as KeyUserData;
      let isHit = false;
      let hitVelocity = 0.7;

      _keyBox.setFromObject(key);
      _keyBox.expandByVector(_hitTolerance);

      for (let i = 0; i < tipCount; i++) {
        if (_keyBox.containsPoint(currentPositions[i])) {
          isHit = true;
          hitVelocity = downwardVelocities[i];
          break;
        }
      }

      const mat = key.material as THREE.MeshStandardMaterial;

      if (isHit && !uData.isPressed) {
        uData.isPressed = true;
        uData.pressVelocity = hitVelocity;
        uData.targetY = uData.originalY - (0.006 + hitVelocity * 0.006);
        mat.color.setHex(0x00e5ff);
        mat.emissive.setHex(0x005577);
        this.playNote(uData.note, hitVelocity);
      } else if (!isHit && uData.isPressed) {
        uData.isPressed = false;
        uData.targetY = uData.originalY;
        mat.color.setHex(uData.originalColor);
        mat.emissive.setHex(0x000000);
      }
    }
  }

  /**
   * Trigger a key manually from UI or pointer click
   */
  triggerKeyByName(noteName: string, velocity = 0.85) {
    const key = this.keys.find((k) => (k.userData as KeyUserData).note.name === noteName);
    if (!key) return;
    const uData = key.userData as KeyUserData;
    const mat = key.material as THREE.MeshStandardMaterial;

    uData.isPressed = true;
    uData.targetY = uData.originalY - 0.01;
    mat.color.setHex(0x00e5ff);
    mat.emissive.setHex(0x005577);
    this.playNote(uData.note, velocity);

    setTimeout(() => {
      uData.isPressed = false;
      uData.targetY = uData.originalY;
      mat.color.setHex(uData.originalColor);
      mat.emissive.setHex(0x000000);
    }, 220);
  }

  dispose() {
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    this.scene.remove(this.group);
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
    }
  }
}
