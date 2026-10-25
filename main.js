import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Kalidokit from 'kalidokit';
import { CrashTestDummy } from './dummy_avatar.js';
import { VirtualPiano } from './virtual_piano.js';
import { MultiPointFilter } from './one_euro_filter.js';
import { CommandArbiter } from './command_arbiter.js';
import { KinematicsSolver } from './kinematics_solver.js';

// Global Three.js Scene Variables
let scene, camera, renderer, controls;
let dummy, piano;
let poseFilter, leftHandFilter, rightHandFilter;
let commandArbiter;
let videoElement;
let cameraHelper = null;
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 60;

// UI DOM references
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const metricFps = document.getElementById('metric-fps');
const voiceText = document.getElementById('voice-text');
const gestureProgress = document.getElementById('gesture-progress');
const btnCamera = document.getElementById('btn-camera');
const btnPiano = document.getElementById('btn-piano');
const btnPianoUp = document.getElementById('btn-piano-up');
const btnPianoDown = document.getElementById('btn-piano-down');
const btnRecenter = document.getElementById('btn-recenter');

function initScene() {
  const container = document.getElementById('canvas-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d14);
  scene.fog = new THREE.FogExp2(0x0a0d14, 0.08);

  // Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.25, 2.6);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.95, 0);
  controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below floor
  controls.minDistance = 0.8;
  controls.maxDistance = 6.0;

  // Studio Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
  mainLight.position.set(2, 4, 3);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  const rimLightCyan = new THREE.DirectionalLight(0x00e5ff, 1.0);
  rimLightCyan.position.set(-3, 2, -2);
  scene.add(rimLightCyan);

  const fillLightBlue = new THREE.DirectionalLight(0x3d70ff, 0.5);
  fillLightBlue.position.set(0, -1, 2);
  scene.add(fillLightBlue);

  // High-Tech Reflective Studio Floor Grid
  const gridHelper = new THREE.GridHelper(10, 20, 0x00e5ff, 0x1f293d);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x07090e,
    roughness: 0.25,
    metalness: 0.85
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Initialize Entities
  dummy = new CrashTestDummy(scene);
  piano = new VirtualPiano(scene);

  // Initialize 1€ Motion Smoothing Filters
  poseFilter = new MultiPointFilter(33, 60, 1.0, 0.007);
  leftHandFilter = new MultiPointFilter(21, 60, 1.0, 0.007);
  rightHandFilter = new MultiPointFilter(21, 60, 1.0, 0.007);

  // Initialize Command Arbiter (Voice + Gesture with priority & cooldown)
  commandArbiter = new CommandArbiter({
    onStateChange: (newState, source) => {
      if (newState === "PIANO_MODE") {
        piano.show();
        statusBadge.classList.add('piano-active');
        statusText.textContent = `PIANO MODE (${source})`;
      } else {
        piano.hide();
        statusBadge.classList.remove('piano-active');
        statusText.textContent = "IDLE / TRACKING";
      }
    },
    onProgressUpdate: (progressPercent) => {
      gestureProgress.style.width = `${progressPercent}%`;
    },
    onVoiceTranscript: (phrase) => {
      voiceText.textContent = `"${phrase}"`;
      voiceText.style.color = "#00e676";
      setTimeout(() => {
        voiceText.style.color = "var(--accent-cyan)";
      }, 2500);
    }
  });

  // Window resize handler
  window.addEventListener('resize', onWindowResize);

  // UI Button Events
  btnCamera.addEventListener('click', toggleCamera);
  btnPiano.addEventListener('click', () => {
    const next = commandArbiter.state === "PIANO_MODE" ? "IDLE" : "PIANO_MODE";
    commandArbiter.setSystemState(next, "UI BUTTON");
  });
  if (btnPianoUp) {
    btnPianoUp.addEventListener('click', () => piano.adjustHeight(0.06));
  }
  if (btnPianoDown) {
    btnPianoDown.addEventListener('click', () => piano.adjustHeight(-0.06));
  }
  btnRecenter.addEventListener('click', () => {
    camera.position.set(0, 1.25, 2.6);
    controls.target.set(0, 0.95, 0);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// MediaPipe Holistic Pipeline Callback
function onResults(results) {
  if (!dummy) return;
  const now = performance.now();

  // 1. One-Euro Filter Landmark Smoothing
  const smoothPose = results.poseLandmarks 
    ? poseFilter.filterLandmarks(results.poseLandmarks, now)
    : null;

  const smoothLeftHand = results.leftHandLandmarks
    ? leftHandFilter.filterLandmarks(results.leftHandLandmarks, now)
    : null;

  const smoothRightHand = results.rightHandLandmarks
    ? rightHandFilter.filterLandmarks(results.rightHandLandmarks, now)
    : null;

  // 2. Direct 1:1 Kinematics Solving (Works under all camera framings)
  let headQ = null;
  let rightArm = null;
  let leftArm = null;

  if (smoothPose && smoothPose.length >= 17) {
    // Head Pitch/Yaw/Roll from Nose (0), Left Ear (7), Right Ear (8)
    headQ = KinematicsSolver.solveHead(smoothPose[0], smoothPose[7], smoothPose[8]);

    // Right Arm: Right Shoulder (12), Right Elbow (14), Right Wrist (16)
    rightArm = KinematicsSolver.solveArm(smoothPose[12], smoothPose[14], smoothPose[16], true);

    // Left Arm: Left Shoulder (11), Left Elbow (13), Left Wrist (15)
    leftArm = KinematicsSolver.solveArm(smoothPose[11], smoothPose[13], smoothPose[15], false);
  }

  // Finger Curls & Wrists
  const rightFingers = smoothRightHand ? KinematicsSolver.solveHandFingers(smoothRightHand) : null;
  const leftFingers = smoothLeftHand ? KinematicsSolver.solveHandFingers(smoothLeftHand) : null;

  // 3. Apply 1:1 Movement Instantly to Crash-Test Dummy Avatar
  dummy.applyDirectKinematics(headQ, rightArm, leftArm, rightFingers, leftFingers, 0.45);

  // 4. Gesture Detection: Evaluate 2-finger hold on active hand
  const activeHandLandmarks = smoothRightHand || smoothLeftHand;
  commandArbiter.evaluateGesture(activeHandLandmarks);

  // 5. Piano Fingertip Collision Detection
  if (piano.active) {
    const allTips = [...dummy.fingertips.left, ...dummy.fingertips.right];
    piano.checkCollisions(allTips);
  }
}

// Camera initialization with MediaPipe Camera Utility
async function toggleCamera() {
  videoElement = document.getElementById('webcam-video');

  if (cameraHelper) {
    cameraHelper.stop();
    cameraHelper = null;
    btnCamera.textContent = "📷 Start Camera";
    btnCamera.classList.add('primary');
    return;
  }

  try {
    btnCamera.textContent = "⌛ Starting...";

    // Initialize MediaPipe Holistic
    const holistic = new window.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
      refineFaceLandmarks: false
    });

    holistic.onResults(onResults);

    // Initialize Camera Utility
    cameraHelper = new window.Camera(videoElement, {
      onFrame: async () => {
        await holistic.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    await cameraHelper.start();
    btnCamera.textContent = "⏹️ Stop Camera";
    btnCamera.classList.remove('primary');
  } catch (err) {
    console.error("Camera access failed:", err);
    alert("Camera access denied or unavailable: " + err.message);
    btnCamera.textContent = "📷 Start Camera";
    btnCamera.classList.add('primary');
  }
}

// 60 FPS Render Loop
function animate() {
  requestAnimationFrame(animate);

  // FPS metric calculation
  frameCount++;
  const now = performance.now();
  if (now - lastFrameTime >= 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
    metricFps.textContent = currentFps;
    frameCount = 0;
    lastFrameTime = now;
  }

  controls.update();
  renderer.render(scene, camera);
}

// Launch
initScene();
animate();
