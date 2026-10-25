# Real-Time 1:1 Motion Tracking Digital Twin Lab (54-DOF Robotics Edition)

A high-performance **real-time 1:1 human digital twin mirror** built with **React, TypeScript, Three.js, and MediaPipe Holistic**, featuring:

- **54-DOF Full-Body Biomechanical Kinematics Solver**: Solves 6-DOF pelvis & 3-link spine/chest tilt and twist, clavicle elevation, 3D Swing-Twist upper/lower arms with forearm pronation/supination, 3-phalange articulated fingers (MCP, PIP, DIP + lateral splay) across all 10 digits, and lower-body hip/knee/ankle kinematics.
- **Decoupled 60–120Hz Render-Loop Interpolation**: Separates webcam inference from display-rate quaternion damping (`1 - Math.exp(-lambda * dt)`) and zero-GC pre-allocated `TargetPoseBuffer` updates for buttery-smooth skeletal motion.
- **Dual-Mode 3D Humanoid Architecture**:
  - **Procedural 54-Bone Robotics Twin** with 3 switchable industrial finishes (*Hybrid III Safety Yellow*, *Optimus Titanium*, and *Figure Stealth Carbon*).
  - **Custom `.GLB` / `.GLTF` / `.VRM` Auto-Retargeter**: Upload or drag-and-drop any VRM 1.0, Mixamo, or Ready Player Me humanoid model to automatically bind its skeleton to the 54-DOF solver and fingertip collision probes.
- **Velocity-Sensitive 17-Key 3D Virtual Piano**: Tracks downward world-space fingertip strike velocity ($v_y$) to control dual-oscillator harmonic synthesis, low-pass filter brightness, and spring-damped key depression physics.
- **Studio & Kinematics Drawer**: Live 1€ filter tuning (`minCutoff`, `beta`, `dampingLambda`), biomechanical channel toggles, tabular joint-angle telemetry, and a 2D skeletal verification overlay on the Picture-in-Picture webcam mirror.
