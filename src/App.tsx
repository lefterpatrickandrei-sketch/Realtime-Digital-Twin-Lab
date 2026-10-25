import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CrashTestDummy,
  ChassisPreset,
  CostumeCustomization,
  DEFAULT_RK900_COSTUME,
  RK900_OUTFIT_PRESETS,
  SynthSkinMode
} from './modules/dummy_avatar';
import { VirtualPiano, KeyUserData } from './modules/virtual_piano';
import { MultiPointFilter, LandmarkPoint } from './modules/one_euro_filter';
import { CommandArbiter } from './modules/command_arbiter';
import {
  KinematicsSolver,
  TargetPoseBuffer,
  KinematicsConfig,
  JointTelemetry
} from './modules/kinematics_solver';

declare global {
  interface Window {
    Holistic?: any;
    Camera?: any;
  }
}

type SimulationPreset = 'piano-virtuoso' | 'robotics-calibration' | 'taichi-flow';
type StudioTab = 'rk900-costume' | 'robotics-ik';

const JACKET_SWATCHES = ['#f1f5f9', '#27303f', '#18181b', '#7f1d1d', '#1e3a8a'];
const TRIM_SWATCHES = ['#0f172a', '#334155', '#450a0a', '#f8fafc', '#172554'];
const LED_SWATCHES = ['#00e5ff', '#f59e0b', '#ef4444', '#10b981', '#a855f7'];

export const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HUD & Studio UI State
  const [systemState, setSystemState] = useState<'IDLE' | 'PIANO_MODE'>('IDLE');
  const [stateSource, setStateSource] = useState<string>('TRACKING');
  const [fps, setFps] = useState<number>(60);
  const [cvLatencyMs, setCvLatencyMs] = useState<number>(8);
  const [voiceText, setVoiceText] = useState<string>('Say "piano mode" or "reset"');
  const [voiceActive, setVoiceActive] = useState<boolean>(false);
  const [gestureProgress, setGestureProgress] = useState<number>(0);
  const [isCameraRunning, setIsCameraRunning] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simPreset, setSimPreset] = useState<SimulationPreset>('piano-virtuoso');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [studioTab, setStudioTab] = useState<StudioTab>('rk900-costume');
  const [chassisPreset, setChassisPreset] = useState<ChassisPreset>('rk900-cyberlife');
  const [costume, setCostume] = useState<CostumeCustomization>(DEFAULT_RK900_COSTUME);
  const [customModelLabel, setCustomModelLabel] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [lastNoteInfo, setLastNoteInfo] = useState<string>('Ready · 17 Keys');
  const [sustainEnabled, setSustainEnabled] = useState<boolean>(true);

  // Kinematics & 1€ Filter Config State
  const [config, setConfig] = useState<KinematicsConfig>({
    minCutoff: 1.1,
    beta: 0.015,
    dampingLambda: 18,
    enableSpineTracking: true,
    enableLegTracking: true,
    enableIdleBreathing: true,
    enableWristSupination: true,
    enableAnalyticalIK: true,
    enablePianoCompliance: true,
    enableWbcBalance: true,
    reverseHands: false
  });

  // Live Joint Telemetry State (updated at 10Hz for clean UI reading)
  const [telemetry, setTelemetry] = useState<JointTelemetry>({
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    spinePitch: 0,
    spineYaw: 0,
    rightShoulderElev: 0,
    leftShoulderElev: 0,
    rightElbowFlex: 0,
    leftElbowFlex: 0,
    rightWristSupination: 0,
    leftWristSupination: 0,
    rightIndexCurl: 0,
    leftIndexCurl: 0,
    rightPinchDistCm: 8.5,
    leftPinchDistCm: 8.5,
    kneeFlexAvg: 0,
    comOffsetX: 0,
    comOffsetZ: 0,
    zmpStabilityPct: 99
  });

  // Mutable refs for zero-re-render access inside 60-120Hz animation loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const dummyRef = useRef<CrashTestDummy | null>(null);
  const pianoRef = useRef<VirtualPiano | null>(null);
  const arbiterRef = useRef<CommandArbiter | null>(null);
  const cameraHelperRef = useRef<any>(null);

  const targetPoseBufferRef = useRef<TargetPoseBuffer>(new TargetPoseBuffer());
  const configRef = useRef<KinematicsConfig>(config);
  const isSimulatingRef = useRef<boolean>(isSimulating);
  const simPresetRef = useRef<SimulationPreset>(simPreset);
  const systemStateRef = useRef<'IDLE' | 'PIANO_MODE'>(systemState);

  // 1€ Filters (Pose, World Pose, Left Hand, Right Hand)
  const poseFilterRef = useRef<MultiPointFilter>(new MultiPointFilter(33, 60, 1.1, 0.015));
  const worldFilterRef = useRef<MultiPointFilter>(new MultiPointFilter(33, 60, 1.1, 0.015));
  const leftHandFilterRef = useRef<MultiPointFilter>(new MultiPointFilter(21, 60, 1.1, 0.015));
  const rightHandFilterRef = useRef<MultiPointFilter>(new MultiPointFilter(21, 60, 1.1, 0.015));

  const voiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync React config state to refs and 1€ filters
  useEffect(() => {
    configRef.current = config;
    poseFilterRef.current.updateParams(config.minCutoff, config.beta);
    worldFilterRef.current.updateParams(config.minCutoff, config.beta);
    leftHandFilterRef.current.updateParams(config.minCutoff, config.beta);
    rightHandFilterRef.current.updateParams(config.minCutoff, config.beta);
  }, [config]);

  // Sync RK900 / GLB Costume Customization live to 3D Avatar
  useEffect(() => {
    dummyRef.current?.applyCostumeCustomization(costume);
  }, [costume]);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    simPresetRef.current = simPreset;
  }, [simPreset]);

  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  // Draw 2D skeletal overlay onto PiP canvas
  const drawPipSkeleton = useCallback(
    (
      pose: LandmarkPoint[] | null,
      leftHand: LandmarkPoint[] | null,
      rightHand: LandmarkPoint[] | null
    ) => {
      const canvas = pipCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (pose && pose.length >= 25) {
        const connections: Array<[number, number]> = [
          [11, 12],
          [11, 13],
          [13, 15],
          [12, 14],
          [14, 16],
          [11, 23],
          [12, 24],
          [23, 24]
        ];
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [a, b] of connections) {
          if (pose[a] && pose[b]) {
            ctx.moveTo(pose[a].x * w, pose[a].y * h);
            ctx.lineTo(pose[b].x * w, pose[b].y * h);
          }
        }
        ctx.stroke();

        ctx.fillStyle = '#deb018';
        for (const idx of [0, 11, 12, 13, 14, 15, 16, 23, 24]) {
          if (pose[idx]) {
            ctx.beginPath();
            ctx.arc(pose[idx].x * w, pose[idx].y * h, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const drawHandPts = (hand: LandmarkPoint[] | null, color: string) => {
        if (!hand) return;
        ctx.fillStyle = color;
        for (let i = 0; i < hand.length; i++) {
          const pt = hand[i];
          if (!pt) continue;
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawHandPts(leftHand, '#00e676');
      drawHandPts(rightHand, '#00e5ff');
    },
    []
  );

  // Initialize Three.js Studio Scene & 60-120Hz Render Loop
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.075);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.28, 2.65);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Procedural Studio Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.96, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.minDistance = 0.8;
    controls.maxDistance = 6.0;
    controlsRef.current = controls;

    // 6. Warm/Cool 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.65);
    scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.45);
    mainLight.position.set(2.2, 4.2, 3.0);
    mainLight.castShadow = !isSoftwareGl;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);

    const rimLightCyan = new THREE.DirectionalLight(0x00e5ff, 0.95);
    rimLightCyan.position.set(-3, 2.2, -2);
    scene.add(rimLightCyan);

    const fillLightBlue = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLightBlue.position.set(0, -1, 2.2);
    scene.add(fillLightBlue);

    // 7. Grounded Studio Floor & Offset Calibration Grid
    const floorGeo = new THREE.PlaneGeometry(18, 18);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07090e,
      roughness: 0.28,
      metalness: 0.82
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(10, 20, 0x00e5ff, 0x1e293b);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    // 8. Initialize 54-Bone Connor RK900 CyberLife Android & Velocity-Sensitive 3D Piano
    const dummy = new CrashTestDummy(scene);
    dummyRef.current = dummy;

    const piano = new VirtualPiano(scene, (noteName, velNorm) => {
      setLastNoteInfo(`${noteName} · Vel ${Math.round(velNorm * 100)}%`);
    });
    pianoRef.current = piano;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Initialize Dual Command Arbiter (Voice + 2-Finger Gesture)
    const arbiter = new CommandArbiter({
      onStateChange: (newState, source) => {
        setSystemState(newState);
        setStateSource(source);
        if (newState === 'PIANO_MODE') {
          pianoRef.current?.show();
        } else {
          pianoRef.current?.hide();
        }
      },
      onProgressUpdate: (progressPercent) => {
        setGestureProgress(progressPercent);
      },
      onVoiceTranscript: (phrase) => {
        setVoiceText(`"${phrase}"`);
        setVoiceActive(true);
        if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
        voiceTimeoutRef.current = setTimeout(() => {
          setVoiceActive(false);
        }, 2500);
      }
    });
    arbiterRef.current = arbiter;

    // 10. Pointer Raycasting for clicking 3D Piano Keys directly in viewport
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (e: PointerEvent) => {
      if (!pianoRef.current || !pianoRef.current.active) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(pianoRef.current.keys, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const uData = hitMesh.userData as KeyUserData;
        if (uData?.note) {
          pianoRef.current.triggerKeyByName(uData.note.name, 0.88);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 11. Window resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 12. Decoupled 60-120Hz Render & Kinematics Interpolation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let lastTelemetryTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const now = performance.now();

      if (isSimulatingRef.current) {
        KinematicsSolver.applySimulationPresetIntoBuffer(
          simPresetRef.current,
          elapsed,
          targetPoseBufferRef.current
        );
      }

      dummy.updateFrame(dt, targetPoseBufferRef.current, configRef.current, elapsed);

      if (piano.active) {
        piano.updateFrame(dt);
        const allTips = [...dummy.fingertips.left, ...dummy.fingertips.right];
        piano.checkCollisions(allTips);
      }

      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }

      if (now - lastTelemetryTime >= 100) {
        setTelemetry({ ...targetPoseBufferRef.current.telemetry });
        lastTelemetryTime = now;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
      arbiter.destroy();
      piano.dispose();
      dummy.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // MediaPipe Holistic Pipeline Callback
  const handleMediaPipeResults = useCallback(
    (results: any) => {
      const t0 = performance.now();

      const smoothPose = results.poseLandmarks
        ? poseFilterRef.current.filterLandmarks(results.poseLandmarks as LandmarkPoint[], t0)
        : null;

      const smoothWorld = results.poseWorldLandmarks
        ? worldFilterRef.current.filterLandmarks(results.poseWorldLandmarks as LandmarkPoint[], t0)
        : null;

      const smoothLeftHand = results.leftHandLandmarks
        ? leftHandFilterRef.current.filterLandmarks(results.leftHandLandmarks as LandmarkPoint[], t0)
        : null;

      const smoothRightHand = results.rightHandLandmarks
        ? rightHandFilterRef.current.filterLandmarks(results.rightHandLandmarks as LandmarkPoint[], t0)
        : null;

      KinematicsSolver.solveFullBodyIntoBuffer(
        smoothPose,
        smoothWorld,
        smoothLeftHand,
        smoothRightHand,
        targetPoseBufferRef.current,
        configRef.current,
        systemStateRef.current === 'PIANO_MODE'
      );

      drawPipSkeleton(smoothPose, smoothLeftHand, smoothRightHand);

      const activeHand = smoothRightHand || smoothLeftHand;
      arbiterRef.current?.evaluateGesture(activeHand);

      const elapsedMs = Math.max(1, Math.round(performance.now() - t0));
      setCvLatencyMs(elapsedMs);
    },
    [drawPipSkeleton]
  );

  // Start / Stop Webcam Tracking
  const toggleCamera = async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (cameraHelperRef.current) {
      cameraHelperRef.current.stop();
      cameraHelperRef.current = null;
      setIsCameraRunning(false);
      setCameraLoading(false);
      drawPipSkeleton(null, null, null);
      return;
    }

    try {
      setCameraLoading(true);
      if (!window.Holistic || !window.Camera) {
        throw new Error('MediaPipe Holistic runtime is still initializing.');
      }

      const holistic = new window.Holistic({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      });

      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        refineFaceLandmarks: false
      });

      holistic.onResults(handleMediaPipeResults);

      const cameraHelper = new window.Camera(videoElement, {
        onFrame: async () => {
          if (videoElement.readyState >= 2) {
            await holistic.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480
      });

      await cameraHelper.start();
      cameraHelperRef.current = cameraHelper;
      setIsCameraRunning(true);
      setCameraLoading(false);
      setIsSimulating(false);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraLoading(false);
      setIsCameraRunning(false);
      setVoiceText('Camera unavailable — using Demo Mode');
      setIsSimulating(true);
    }
  };

  // Switch Procedural Chassis or RK900 Android Preset
  const handleSelectChassis = (preset: Exclude<ChassisPreset, 'custom-glb'>) => {
    setChassisPreset(preset);
    dummyRef.current?.setChassisPreset(preset);
  };

  // Load Custom .GLB / .GLTF / .VRM Humanoid File (e.g. Connor RK900 from skfb.ly/oRROK)
  const handleLoadCustomModelFile = async (file: File) => {
    if (!dummyRef.current) return;
    try {
      const { mappedBonesCount, modelName } = await dummyRef.current.loadCustomGLBOrVRM(file);
      setChassisPreset('custom-glb');
      setCustomModelLabel(`${modelName} (${mappedBonesCount} bones)`);
      dummyRef.current.applyCostumeCustomization(costume);
    } catch (err: any) {
      console.error('Failed to load custom GLB/VRM model:', err);
      setVoiceText('Model load error: use valid .glb/.vrm');
    }
  };

  // Toggle Piano Mode
  const handleTogglePiano = () => {
    if (!arbiterRef.current) return;
    const nextState = systemState === 'PIANO_MODE' ? 'IDLE' : 'PIANO_MODE';
    arbiterRef.current.setSystemState(nextState, 'UI CONTROL');
  };

  // Toggle Simulation Mode
  const handleToggleSimulation = () => {
    const next = !isSimulating;
    setIsSimulating(next);
    if (next && simPreset === 'piano-virtuoso' && systemState !== 'PIANO_MODE') {
      arbiterRef.current?.setSystemState('PIANO_MODE', 'SIMULATION');
    } else if (!next) {
      dummyRef.current?.resetPose(targetPoseBufferRef.current);
    }
  };

  // Select Simulation Routine
  const handleSelectSimPreset = (preset: SimulationPreset) => {
    setSimPreset(preset);
    if (!isSimulating) {
      setIsSimulating(true);
    }
    if (preset === 'piano-virtuoso' && systemState !== 'PIANO_MODE') {
      arbiterRef.current?.setSystemState('PIANO_MODE', 'SIMULATION');
    }
  };

  // Reset View & Pose
  const handleResetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.28, 2.65);
      controlsRef.current.target.set(0, 0.96, 0);
    }
    if (!isSimulating && !isCameraRunning) {
      dummyRef.current?.resetPose(targetPoseBufferRef.current);
    }
  };

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleLoadCustomModelFile(file);
      }}
    >
      {/* Hidden File Input for .GLB / .GLTF / .VRM Humanoid Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.vrm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLoadCustomModelFile(file);
        }}
      />

      {/* Drag & Drop Custom 3D Model Banner */}
      {isDraggingFile && (
        <div className="dropzone-banner">
          <span>Drop Sketchfab Connor RK900 (.GLB / .VRM) to Auto-Rig 54-DOF + Customize Costume</span>
        </div>
      )}

      {/* 3D Three.js Studio Viewport */}
      <div id="canvas-container" ref={canvasContainerRef} />

      {/* Top-Left HUD: Title & Unboxed Status Metadata */}
      <div id="hud-header" className="hud-panel">
        <div className="logo-badge">
          <div className="dummy-icon" style={{ background: costume.ledColor, color: '#080b11' }}>
            RK
          </div>
          <div className="title-wrap">
            <h1>Connor RK900 · Digital Twin Lab</h1>
            <p>CyberLife 54-DOF Customizer · SE(3) IK · DexPilot</p>
          </div>
        </div>
        <div className="header-divider" />
        <span
          id="status-text"
          className={`status-meta ${systemState === 'PIANO_MODE' ? 'piano-active' : ''}`}
        >
          {systemState === 'PIANO_MODE' ? `Piano Mode · ${stateSource}` : 'RK900 Active · 54-DOF'}
        </span>
      </div>

      {/* Top-Right HUD: Tabular Telemetry Metrics */}
      <div id="hud-telemetry" className="hud-panel">
        <div className="metric-item">
          <span className="metric-label">Display Rate</span>
          <span id="metric-fps" className="metric-val">
            {fps} FPS
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">SE(3) IK + DexPilot</span>
          <span className="metric-val" style={{ fontSize: '14px' }}>
            {config.enableAnalyticalIK ? '2-Bone Cos' : 'FK'} ({cvLatencyMs}ms)
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">ZMP Balance</span>
          <span className="metric-val" style={{ fontSize: '14px', color: 'var(--accent-green)' }}>
            {telemetry.zmpStabilityPct}% Stable
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Synthesizer</span>
          <span className="metric-val" style={{ fontSize: '14px', color: 'var(--text-main)' }}>
            {lastNoteInfo}
          </span>
        </div>
      </div>

      {/* Bottom-Left HUD: Voice & Gesture Command Telemetry */}
      <div id="hud-commands" className="hud-panel">
        <div className="command-row">
          <span className="cmd-desc">Voice Arbiter</span>
          <span
            id="voice-text"
            className="cmd-value"
            style={{ color: voiceActive ? 'var(--accent-green)' : 'var(--accent-cyan)' }}
          >
            {voiceText}
          </span>
        </div>

        <div className="command-row">
          <span className="cmd-desc">2-Finger Hold (1.0s)</span>
          <span id="gesture-label" className="cmd-value">
            {Math.round(gestureProgress)}%
          </span>
        </div>

        <div className="progress-bar-container">
          <div
            id="gesture-progress"
            className="progress-bar-fill"
            style={{ width: `${gestureProgress}%` }}
          />
        </div>
      </div>

      {/* Bottom-Center: Collapsible RK900 Costume & Robotics Studio Drawer + Main Control Dock */}
      <div id="hud-dock-wrapper">
        {isDrawerOpen && (
          <div id="hud-drawer" className="hud-panel">
            {/* Drawer Mode Switcher Header */}
            <div className="drawer-tabs">
              <div className="drawer-tab-group">
                <button
                  className={`drawer-tab-btn ${studioTab === 'rk900-costume' ? 'active' : ''}`}
                  onClick={() => setStudioTab('rk900-costume')}
                >
                  Connor RK900 Costume Customizer (skfb.ly/oRROK)
                </button>
                <button
                  className={`drawer-tab-btn ${studioTab === 'robotics-ik' ? 'active' : ''}`}
                  onClick={() => setStudioTab('robotics-ik')}
                >
                  Global Robotics Fleet &amp; SE(3) IK Tuning
                </button>
              </div>
              <button
                className="seg-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Load downloaded Connor RK900 .glb from Sketchfab or any .vrm/.glb"
              >
                Import .GLB / .VRM File
              </button>
            </div>

            {studioTab === 'rk900-costume' ? (
              <>
                <div className="drawer-grid">
                  {/* Column 1: RK900 Costume Style Presets & Android Dermis Mode */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">RK900 Costume Presets</span>
                    <div className="segmented-group">
                      {RK900_OUTFIT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={`seg-btn ${
                            chassisPreset === 'rk900-cyberlife' &&
                            costume.jacketColor === preset.config.jacketColor &&
                            costume.ledColor === preset.config.ledColor
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => {
                            if (chassisPreset !== 'rk900-cyberlife' && chassisPreset !== 'custom-glb') {
                              handleSelectChassis('rk900-cyberlife');
                            }
                            setCostume({ ...preset.config });
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <span className="drawer-section-title" style={{ marginTop: '6px' }}>
                      Biocomponent Skin / Endoskeleton
                    </span>
                    <div className="segmented-group">
                      {(
                        [
                          ['synth-porcelain', 'Porcelain Skin'],
                          ['synth-warm', 'Warm Dermis'],
                          ['exposed-white', 'White Chassis'],
                          ['exposed-chrome', 'Chrome Chassis']
                        ] as Array<[SynthSkinMode, string]>
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          className={`seg-btn ${costume.skinMode === mode ? 'active' : ''}`}
                          onClick={() => setCostume((prev) => ({ ...prev, skinMode: mode }))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Custom Color Pickers (Jacket, Lapel/Trim, CyberLife LED) */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">Custom Costume &amp; LED Palette</span>

                    {/* Jacket Color */}
                    <div className="color-picker-row">
                      <span>Jacket Coat</span>
                      <div className="swatch-group">
                        {JACKET_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            className={`color-swatch ${costume.jacketColor === hex ? 'active' : ''}`}
                            style={{ backgroundColor: hex }}
                            onClick={() => setCostume((p) => ({ ...p, jacketColor: hex }))}
                            title={`Jacket ${hex}`}
                          />
                        ))}
                        <input
                          type="color"
                          className="color-input-native"
                          value={costume.jacketColor}
                          onChange={(e) => setCostume((p) => ({ ...p, jacketColor: e.target.value }))}
                          title="Custom Jacket Color"
                        />
                      </div>
                    </div>

                    {/* Lapel & Trousers Trim Color */}
                    <div className="color-picker-row">
                      <span>Lapel &amp; Trim</span>
                      <div className="swatch-group">
                        {TRIM_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            className={`color-swatch ${costume.trimColor === hex ? 'active' : ''}`}
                            style={{ backgroundColor: hex }}
                            onClick={() => setCostume((p) => ({ ...p, trimColor: hex }))}
                            title={`Trim ${hex}`}
                          />
                        ))}
                        <input
                          type="color"
                          className="color-input-native"
                          value={costume.trimColor}
                          onChange={(e) => setCostume((p) => ({ ...p, trimColor: e.target.value }))}
                          title="Custom Trim Color"
                        />
                      </div>
                    </div>

                    {/* CyberLife LED Ring & Triangle Glow */}
                    <div className="color-picker-row">
                      <span>CyberLife LED</span>
                      <div className="swatch-group">
                        {LED_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            className={`color-swatch ${costume.ledColor === hex ? 'active' : ''}`}
                            style={{ backgroundColor: hex }}
                            onClick={() => setCostume((p) => ({ ...p, ledColor: hex }))}
                            title={`LED ${hex}`}
                          />
                        ))}
                        <input
                          type="color"
                          className="color-input-native"
                          value={costume.ledColor}
                          onChange={(e) => setCostume((p) => ({ ...p, ledColor: e.target.value }))}
                          title="Custom CyberLife LED Color"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Modular Costume Parts & Material Finish */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">Modular Costume Parts &amp; Finish</span>
                    <div className="toggle-grid">
                      <button
                        className={`seg-btn ${costume.showHighCollarJacket ? 'active' : ''}`}
                        onClick={() =>
                          setCostume((p) => ({
                            ...p,
                            showHighCollarJacket: !p.showHighCollarJacket
                          }))
                        }
                      >
                        High-Collar Jacket
                      </button>
                      <button
                        className={`seg-btn ${costume.showCyberLifeInsignia ? 'active' : ''}`}
                        onClick={() =>
                          setCostume((p) => ({
                            ...p,
                            showCyberLifeInsignia: !p.showCyberLifeInsignia
                          }))
                        }
                      >
                        CyberLife Triangles
                      </button>
                      <button
                        className={`seg-btn ${costume.showTempleLed ? 'active' : ''}`}
                        onClick={() =>
                          setCostume((p) => ({ ...p, showTempleLed: !p.showTempleLed }))
                        }
                      >
                        Temple LED Ring
                      </button>
                      <button
                        className={`seg-btn ${config.reverseHands ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, reverseHands: !p.reverseHands }))
                        }
                      >
                        Swap L/R Hands
                      </button>
                    </div>

                    <div className="slider-row" style={{ marginTop: '4px' }}>
                      <div className="slider-header">
                        <span>Coat Roughness / Metallic Weave</span>
                        <span className="slider-val">
                          {costume.fabricRoughness.toFixed(2)} / {costume.armorMetalness.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="cyber-range"
                        min={0.05}
                        max={0.85}
                        step={0.05}
                        value={costume.armorMetalness}
                        onChange={(e) =>
                          setCostume((p) => ({ ...p, armorMetalness: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Sketchfab Reference & Custom GLB Status Bar */}
                <div className="sketchfab-bar">
                  <span>
                    Active Rig:{' '}
                    <strong style={{ color: 'var(--text-main)' }}>
                      {chassisPreset === 'custom-glb'
                        ? customModelLabel
                        : 'Connor RK900 CyberLife Android (54-DOF Built-In + Customizer)'}
                    </strong>
                  </span>
                  <span>
                    Sketchfab Source:{' '}
                    <a
                      href="https://sketchfab.com/3d-models/connor-rk900-detroit-become-human-623e3f52b7da4116a4576f38479eaaaf"
                      target="_blank"
                      rel="noreferrer"
                      className="sketchfab-link"
                    >
                      skfb.ly/oRROK (Connor RK900 by Q.SARDOR)
                    </a>{' '}
                    — Drag &amp; drop downloaded <code>.glb</code> anywhere to auto-rig
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="drawer-grid">
                  {/* Column 1: Global Robotics Fleet Presets & Simulation Routine */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">Global Robotics Fleet (US / CN / EU)</span>
                    <div className="segmented-group">
                      <button
                        className={`seg-btn ${chassisPreset === 'rk900-cyberlife' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('rk900-cyberlife')}
                      >
                        Connor RK900 (CyberLife)
                      </button>
                      <button
                        className={`seg-btn ${chassisPreset === 'hybrid-iii' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('hybrid-iii')}
                      >
                        Atlas / Hybrid III (US)
                      </button>
                      <button
                        className={`seg-btn ${chassisPreset === 'optimus-titanium' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('optimus-titanium')}
                      >
                        Optimus / Figure (US)
                      </button>
                      <button
                        className={`seg-btn ${chassisPreset === 'unitree-g1' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('unitree-g1')}
                      >
                        Unitree G1 / GR-2 (CN)
                      </button>
                      <button
                        className={`seg-btn ${chassisPreset === 'neura-4ne1' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('neura-4ne1')}
                      >
                        Neura 4NE-1 / 1X (EU)
                      </button>
                      <button
                        className={`seg-btn ${chassisPreset === 'figure-carbon' ? 'active' : ''}`}
                        onClick={() => handleSelectChassis('figure-carbon')}
                      >
                        Stealth Carbon
                      </button>
                    </div>

                    <span className="drawer-section-title" style={{ marginTop: '6px' }}>
                      Motion Simulation Preset
                    </span>
                    <div className="segmented-group">
                      <button
                        className={`seg-btn ${isSimulating && simPreset === 'piano-virtuoso' ? 'active' : ''}`}
                        onClick={() => handleSelectSimPreset('piano-virtuoso')}
                      >
                        Piano Virtuoso
                      </button>
                      <button
                        className={`seg-btn ${isSimulating && simPreset === 'robotics-calibration' ? 'active' : ''}`}
                        onClick={() => handleSelectSimPreset('robotics-calibration')}
                      >
                        54-DOF Calibration
                      </button>
                      <button
                        className={`seg-btn ${isSimulating && simPreset === 'taichi-flow' ? 'active' : ''}`}
                        onClick={() => handleSelectSimPreset('taichi-flow')}
                      >
                        Tai Chi Fluidity
                      </button>
                    </div>
                  </div>

                  {/* Column 2: 60-120Hz Damping & 1€ Jitter Filter Tuning */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">Fluidity &amp; 1€ Filter Tuning</span>

                    <div className="slider-row">
                      <div className="slider-header">
                        <span>Render Damping Stiffness (λ)</span>
                        <span className="slider-val">{config.dampingLambda}</span>
                      </div>
                      <input
                        type="range"
                        className="cyber-range"
                        min={6}
                        max={35}
                        step={1}
                        value={config.dampingLambda}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, dampingLambda: Number(e.target.value) }))
                        }
                      />
                    </div>

                    <div className="slider-row">
                      <div className="slider-header">
                        <span>1€ Min Cutoff Frequency (Hz)</span>
                        <span className="slider-val">{config.minCutoff.toFixed(2)} Hz</span>
                      </div>
                      <input
                        type="range"
                        className="cyber-range"
                        min={0.3}
                        max={3.0}
                        step={0.05}
                        value={config.minCutoff}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, minCutoff: Number(e.target.value) }))
                        }
                      />
                    </div>

                    <div className="slider-row">
                      <div className="slider-header">
                        <span>1€ Velocity Beta (Responsiveness)</span>
                        <span className="slider-val">{config.beta.toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        className="cyber-range"
                        min={0.001}
                        max={0.05}
                        step={0.001}
                        value={config.beta}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, beta: Number(e.target.value) }))
                        }
                      />
                    </div>
                  </div>

                  {/* Column 3: NVIDIA / GitHub / EU / CN Biomechanical Solver Channels */}
                  <div className="drawer-section">
                    <span className="drawer-section-title">Solver Architecture (NVIDIA / GitHub)</span>
                    <div className="toggle-grid">
                      <button
                        className={`seg-btn ${config.enableAnalyticalIK ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, enableAnalyticalIK: !p.enableAnalyticalIK }))
                        }
                      >
                        2-Bone SE(3) IK
                      </button>
                      <button
                        className={`seg-btn ${config.enablePianoCompliance ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, enablePianoCompliance: !p.enablePianoCompliance }))
                        }
                      >
                        Piano Compliance
                      </button>
                      <button
                        className={`seg-btn ${config.enableWbcBalance ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, enableWbcBalance: !p.enableWbcBalance }))
                        }
                      >
                        WBC CoM Balance
                      </button>
                      <button
                        className={`seg-btn ${config.enableWristSupination ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, enableWristSupination: !p.enableWristSupination }))
                        }
                      >
                        Wrist Supination
                      </button>
                      <button
                        className={`seg-btn ${config.reverseHands ? 'active' : ''}`}
                        onClick={() =>
                          setConfig((p) => ({ ...p, reverseHands: !p.reverseHands }))
                        }
                      >
                        Swap L/R Hands
                      </button>
                      <button
                        className={`seg-btn ${sustainEnabled ? 'active' : ''}`}
                        onClick={() => {
                          const next = !sustainEnabled;
                          setSustainEnabled(next);
                          if (pianoRef.current) pianoRef.current.sustainEnabled = next;
                        }}
                      >
                        Piano Sustain
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Tabular Joint-Angle & DexPilot / ZMP Telemetry Strip */}
                <div className="telemetry-strip">
                  <span className="telemetry-pair">
                    Elbow R/L: <strong>{telemetry.rightElbowFlex}° / {telemetry.leftElbowFlex}°</strong>
                  </span>
                  <span>·</span>
                  <span className="telemetry-pair">
                    Wrist Twist R/L: <strong>{telemetry.rightWristSupination}° / {telemetry.leftWristSupination}°</strong>
                  </span>
                  <span>·</span>
                  <span className="telemetry-pair">
                    DexPilot Pinch R/L: <strong>{telemetry.rightPinchDistCm}cm / {telemetry.leftPinchDistCm}cm</strong>
                  </span>
                  <span>·</span>
                  <span className="telemetry-pair">
                    Spine P/Y: <strong>{telemetry.spinePitch}° / {telemetry.spineYaw}°</strong>
                  </span>
                  <span>·</span>
                  <span className="telemetry-pair">
                    ZMP Stability: <strong>{telemetry.zmpStabilityPct}%</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Main Interactive Control Toolbar */}
        <div id="hud-toolbar" className="hud-panel">
          <button
            id="btn-camera"
            className={`btn-cyber ${!isCameraRunning ? 'primary' : ''}`}
            onClick={toggleCamera}
            disabled={cameraLoading}
          >
            {cameraLoading ? 'Starting...' : isCameraRunning ? 'Stop Camera' : 'Start Camera'}
          </button>

          <button
            id="btn-piano"
            className={`btn-cyber ${systemState === 'PIANO_MODE' ? 'active' : ''}`}
            onClick={handleTogglePiano}
          >
            Toggle Piano
          </button>

          <button
            id="btn-piano-up"
            className="btn-cyber"
            title="Raise Piano Height"
            onClick={() => pianoRef.current?.adjustHeight(0.05)}
          >
            ▲ Up
          </button>

          <button
            id="btn-piano-down"
            className="btn-cyber"
            title="Lower Piano Height"
            onClick={() => pianoRef.current?.adjustHeight(-0.05)}
          >
            ▼ Down
          </button>

          <button
            id="btn-demo"
            className={`btn-cyber ${isSimulating ? 'active' : ''}`}
            onClick={handleToggleSimulation}
          >
            {isSimulating ? 'Stop Motion' : 'Simulate Motion'}
          </button>

          <button id="btn-recenter" className="btn-cyber" onClick={handleResetView}>
            Reset View
          </button>

          <button
            id="btn-studio-drawer"
            className={`btn-cyber ${isDrawerOpen ? 'active' : ''}`}
            onClick={() => setIsDrawerOpen((prev) => !prev)}
          >
            {isDrawerOpen ? '▾ Hide Customizer' : '▴ RK900 Costume & Rig'}
          </button>
        </div>
      </div>

      {/* Bottom-Right: Picture-in-Picture Webcam Mirror + 2D Skeleton Canvas */}
      <div id="pip-camera-container" className="hud-panel">
        <video id="webcam-video" ref={videoRef} playsInline autoPlay muted />
        <canvas id="pip-skeleton-canvas" ref={pipCanvasRef} width={224} height={168} />
        {!isCameraRunning && (
          <div className="pip-placeholder">
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Webcam Mirror</span>
            <span style={{ fontSize: '11px' }}>Click &quot;Start Camera&quot; for 1:1 tracking</span>
          </div>
        )}
      </div>
    </div>
  );
};
