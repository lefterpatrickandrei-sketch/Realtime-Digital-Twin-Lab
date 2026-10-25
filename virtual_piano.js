import * as THREE from 'three';

/**
 * Interactive 3D Virtual Piano Module
 * Features Web Audio synthesizer and real-time fingertip collision detection.
 */
export class VirtualPiano {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "VirtualPiano";
    // Raised from 0.85 to 1.10 (ergonomic chest/hand level) and tilted toward avatar
    this.group.position.set(0, 1.10, 0.32);
    this.group.rotation.x = -0.15; // 8.5 degree natural slope toward fingertips
    this.keys = [];
    this.active = false;
    this.audioCtx = null;
    this.lastPlayedTime = {};

    this.notes = [
      { name: "C4", freq: 261.63, isBlack: false, offset: -0.21 },
      { name: "C#4", freq: 277.18, isBlack: true, offset: -0.18 },
      { name: "D4", freq: 293.66, isBlack: false, offset: -0.15 },
      { name: "D#4", freq: 311.13, isBlack: true, offset: -0.12 },
      { name: "E4", freq: 329.63, isBlack: false, offset: -0.09 },
      { name: "F4", freq: 349.23, isBlack: false, offset: -0.03 },
      { name: "F#4", freq: 369.99, isBlack: true, offset: 0.00 },
      { name: "G4", freq: 392.00, isBlack: false, offset: 0.03 },
      { name: "G#4", freq: 415.30, isBlack: true, offset: 0.06 },
      { name: "A4", freq: 440.00, isBlack: false, offset: 0.09 },
      { name: "A#4", freq: 466.16, isBlack: true, offset: 0.12 },
      { name: "B4", freq: 493.88, isBlack: false, offset: 0.15 },
      { name: "C5", freq: 523.25, isBlack: false, offset: 0.21 }
    ];

    this.buildPiano();
    this.group.visible = false;
    this.scene.add(this.group);
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playNote(note) {
    this.initAudio();
    const now = performance.now();
    if (this.lastPlayedTime[note.name] && now - this.lastPlayedTime[note.name] < 120) {
      return; // prevent spamming the exact same note within 120ms
    }
    this.lastPlayedTime[note.name] = now;

    // Web Audio synthesizer oscillator
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = note.isBlack ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(note.freq, this.audioCtx.currentTime);

    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.65);
  }

  buildPiano() {
    // Piano base
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.4,
      metalness: 0.8
    });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.18), baseMat);
    baseMesh.position.set(0, -0.02, 0);
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    // Neon accent strip
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.005, 0.005), neonMat);
    strip.position.set(0, 0.005, 0.088);
    this.group.add(strip);

    // Key materials
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.2,
      metalness: 0.1
    });

    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.3,
      metalness: 0.5
    });

    this.notes.forEach((note) => {
      const isBlack = note.isBlack;
      const width = isBlack ? 0.022 : 0.034;
      const length = isBlack ? 0.09 : 0.15;
      const height = isBlack ? 0.022 : 0.018;
      const yPos = isBlack ? 0.012 : 0.009;
      const zPos = isBlack ? -0.025 : 0.005;

      const keyGeom = new THREE.BoxGeometry(width, height, length);
      const keyMesh = new THREE.Mesh(keyGeom, isBlack ? blackMat.clone() : whiteMat.clone());
      keyMesh.position.set(note.offset, yPos, zPos);
      keyMesh.castShadow = true;
      keyMesh.userData = {
        note: note,
        originalY: yPos,
        originalColor: isBlack ? 0x1a1a1a : 0xeeeeee,
        isPressed: false
      };

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

  adjustHeight(delta) {
    this.group.position.y = THREE.MathUtils.clamp(this.group.position.y + delta, 0.70, 1.45);
    console.log("[VirtualPiano] Height set to:", this.group.position.y.toFixed(2));
  }

  /**
   * Check collision between dummy fingertip positions (in world coords) and piano keys
   */
  checkCollisions(fingertipObjects) {
    if (!this.active || !fingertipObjects || fingertipObjects.length === 0) return;

    const tipWorldPos = new THREE.Vector3();
    const hitTolerance = new THREE.Vector3(0.015, 0.035, 0.025); // Expanded vertical & depth catch zone

    this.keys.forEach((key) => {
      let isHit = false;
      const keyBox = new THREE.Box3().setFromObject(key);
      keyBox.expandByVector(hitTolerance);

      for (const tip of fingertipObjects) {
        tip.getWorldPosition(tipWorldPos);
        if (keyBox.containsPoint(tipWorldPos)) {
          isHit = true;
          break;
        }
      }

      if (isHit && !key.userData.isPressed) {
        key.userData.isPressed = true;
        key.position.y = key.userData.originalY - 0.009; // visual key press sink
        key.material.color.setHex(0x00e5ff); // glowing cyan highlight
        this.playNote(key.userData.note);
      } else if (!isHit && key.userData.isPressed) {
        key.userData.isPressed = false;
        key.position.y = key.userData.originalY;
        key.material.color.setHex(key.userData.originalColor);
      }
    });
  }
}
