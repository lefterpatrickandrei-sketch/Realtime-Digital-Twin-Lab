import * as THREE from 'three';
import type { LandmarkPoint } from './one_euro_filter';

/**
 * 54-DOF Whole-Body Humanoid Retargeting & Analytical Task-Space IK Engine
 *
 * Incorporates industry-standard robotics teleoperation architectures:
 * 1. Analytical 2-Bone Law-of-Cosines SE(3) Arm IK + Swivel Pole Vector
 *    (Unitree avp_teleoperate / Open-TeleVision / NVIDIA Isaac GR00T)
 * 2. DexPilot Pinch-Vector & Tendon-Coupled Hand Retargeting (DIP = 0.68 * PIP)
 *    (dexsuite/dex-retargeting / Tesla Optimus 22-DOF / Fourier GR-2)
 * 3. Whole-Body Center-of-Mass (CoM) & ZMP Balance Compensator
 *    (LeCAR-Lab OmniH2O / Neura 4NE-1 / 1X NEO Task-Space Impedance Compliance)
 */

export const CANONICAL_BONES = [
  // Torso & Head (6)
  'Hips',
  'Spine',
  'Chest',
  'UpperChest',
  'Neck',
  'Head',
  // Arms & Shoulders (8)
  'LeftShoulder',
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightShoulder',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
  // Right Hand 3-Phalange Fingers (15)
  'RightThumbProximal',
  'RightThumbIntermediate',
  'RightThumbDistal',
  'RightIndexProximal',
  'RightIndexIntermediate',
  'RightIndexDistal',
  'RightMiddleProximal',
  'RightMiddleIntermediate',
  'RightMiddleDistal',
  'RightRingProximal',
  'RightRingIntermediate',
  'RightRingDistal',
  'RightPinkyProximal',
  'RightPinkyIntermediate',
  'RightPinkyDistal',
  // Left Hand 3-Phalange Fingers (15)
  'LeftThumbProximal',
  'LeftThumbIntermediate',
  'LeftThumbDistal',
  'LeftIndexProximal',
  'LeftIndexIntermediate',
  'LeftIndexDistal',
  'LeftMiddleProximal',
  'LeftMiddleIntermediate',
  'LeftMiddleDistal',
  'LeftRingProximal',
  'LeftRingIntermediate',
  'LeftRingDistal',
  'LeftPinkyProximal',
  'LeftPinkyIntermediate',
  'LeftPinkyDistal',
  // Lower Body Legs & Feet (8)
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'LeftToes',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot',
  'RightToes'
] as const;

export type CanonicalBoneName = (typeof CANONICAL_BONES)[number];

export interface JointTelemetry {
  headYaw: number;
  headPitch: number;
  headRoll: number;
  spinePitch: number;
  spineYaw: number;
  rightShoulderElev: number;
  leftShoulderElev: number;
  rightElbowFlex: number;
  leftElbowFlex: number;
  rightWristSupination: number;
  leftWristSupination: number;
  rightIndexCurl: number;
  leftIndexCurl: number;
  rightPinchDistCm: number;
  leftPinchDistCm: number;
  kneeFlexAvg: number;
  comOffsetX: number;
  comOffsetZ: number;
  zmpStabilityPct: number;
}

export interface KinematicsConfig {
  minCutoff: number;
  beta: number;
  dampingLambda: number;
  enableSpineTracking: boolean;
  enableLegTracking: boolean;
  enableIdleBreathing: boolean;
  enableWristSupination: boolean;
  enableAnalyticalIK?: boolean;
  enablePianoCompliance?: boolean;
  enableWbcBalance?: boolean;
  reverseHands?: boolean;
}

export class TargetPoseBuffer {
  quaternions: Record<CanonicalBoneName, THREE.Quaternion>;
  hipsPositionOffset: THREE.Vector3;
  rightWristTargetWorld: THREE.Vector3;
  leftWristTargetWorld: THREE.Vector3;
  comGroundProjection: THREE.Vector3;
  telemetry: JointTelemetry;
  lastUpdatedTime: number;

  constructor() {
    this.quaternions = {} as Record<CanonicalBoneName, THREE.Quaternion>;
    for (const bone of CANONICAL_BONES) {
      this.quaternions[bone] = new THREE.Quaternion();
    }
    this.hipsPositionOffset = new THREE.Vector3(0, 0, 0);
    this.rightWristTargetWorld = new THREE.Vector3(0.2, 1.12, 0.38);
    this.leftWristTargetWorld = new THREE.Vector3(-0.2, 1.12, 0.38);
    this.comGroundProjection = new THREE.Vector3(0, 0.004, 0);
    this.telemetry = {
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
    };
    this.lastUpdatedTime = performance.now();
  }

  resetToNeutral() {
    for (const bone of CANONICAL_BONES) {
      this.quaternions[bone].identity();
    }
    this.hipsPositionOffset.set(0, 0, 0);
    this.rightWristTargetWorld.set(0.21, 0.9, 0.05);
    this.leftWristTargetWorld.set(-0.21, 0.9, 0.05);
    this.comGroundProjection.set(0, 0.004, 0);
    this.telemetry.headYaw = 0;
    this.telemetry.headPitch = 0;
    this.telemetry.headRoll = 0;
    this.telemetry.spinePitch = 0;
    this.telemetry.spineYaw = 0;
    this.telemetry.rightShoulderElev = 0;
    this.telemetry.leftShoulderElev = 0;
    this.telemetry.rightElbowFlex = 0;
    this.telemetry.leftElbowFlex = 0;
    this.telemetry.rightWristSupination = 0;
    this.telemetry.leftWristSupination = 0;
    this.telemetry.rightIndexCurl = 0;
    this.telemetry.leftIndexCurl = 0;
    this.telemetry.rightPinchDistCm = 8.5;
    this.telemetry.leftPinchDistCm = 8.5;
    this.telemetry.kneeFlexAvg = 0;
    this.telemetry.comOffsetX = 0;
    this.telemetry.comOffsetZ = 0;
    this.telemetry.zmpStabilityPct = 99;
  }
}

// Pre-allocated scratch vectors & quaternions (Zero GC in hot loop)
const V_DOWN = new THREE.Vector3(0, -1, 0);
const V_UP = new THREE.Vector3(0, 1, 0);

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _upperDir = new THREE.Vector3();
const _lowerDir = new THREE.Vector3();
const _palmNormal = new THREE.Vector3();
const _euler = new THREE.Euler();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();

// Robot link lengths for Analytical 2-Bone Cosine-Rule IK
const L1_UPPER_ARM = 0.26;
const L2_LOWER_ARM = 0.24;
const SHOULDER_WORLD_Y = 1.405;
const SHOULDER_WORLD_X = 0.21;

const RAD2DEG = 180 / Math.PI;

export class KinematicsSolver {
  /**
   * Solve full 54-DOF humanoid pose directly into a pre-allocated TargetPoseBuffer
   */
  static solveFullBodyIntoBuffer(
    poseLandmarks: LandmarkPoint[] | null | undefined,
    worldLandmarks: LandmarkPoint[] | null | undefined,
    leftHandLandmarks: LandmarkPoint[] | null | undefined,
    rightHandLandmarks: LandmarkPoint[] | null | undefined,
    buffer: TargetPoseBuffer,
    config: KinematicsConfig,
    isPianoModeActive = false
  ) {
    buffer.lastUpdatedTime = performance.now();

    const pose = poseLandmarks;
    const world = worldLandmarks && worldLandmarks.length >= 25 ? worldLandmarks : pose;
    const swapHands = Boolean(config.reverseHands);

    const rHandInput = swapHands ? leftHandLandmarks : rightHandLandmarks;
    const lHandInput = swapHands ? rightHandLandmarks : leftHandLandmarks;

    if (pose && pose.length >= 25) {
      // 1. Head & Cervical Neck Distribution (Landmarks: 0 Nose, 7 Left Ear, 8 Right Ear)
      this.solveCervicalHeadAndNeck(pose[0], pose[7], pose[8], buffer);

      // 2. Spine, Chest, UpperChest & Hips 6-DOF Solver + OmniH2O Whole-Body CoM Balance
      if (config.enableSpineTracking) {
        this.solveTorsoAndWbcBalance(
          pose[11],
          pose[12],
          pose[23],
          pose[24],
          world?.[11],
          world?.[12],
          config.enableWbcBalance !== false,
          buffer
        );
      } else {
        buffer.quaternions.Hips.identity();
        buffer.quaternions.Spine.identity();
        buffer.quaternions.Chest.identity();
        buffer.quaternions.UpperChest.identity();
        buffer.hipsPositionOffset.set(0, 0, 0);
        buffer.comGroundProjection.set(0, 0.004, 0);
      }

      // 3. Clavicle / Shoulder Girdle Elevation (Landmarks: 11 Left, 12 Right)
      this.solveClavicles(pose[11], pose[12], buffer);

      // 4. Right Arm: Analytical 2-Bone SE(3) IK + Swivel Pole Vector + Piano Task-Space Compliance
      this.solveAnalyticalTwoBoneArmIK(
        pose[12],
        pose[14],
        pose[16],
        rHandInput,
        true,
        config,
        isPianoModeActive,
        buffer
      );

      // 5. Left Arm: Analytical 2-Bone SE(3) IK + Swivel Pole Vector + Piano Task-Space Compliance
      this.solveAnalyticalTwoBoneArmIK(
        pose[11],
        pose[13],
        pose[15],
        lHandInput,
        false,
        config,
        isPianoModeActive,
        buffer
      );

      // 6. Lower Body Legs & Knees (Landmarks 23-28)
      if (config.enableLegTracking && pose.length >= 29) {
        this.solveLegs(pose, buffer);
      } else {
        buffer.quaternions.LeftUpperLeg.identity();
        buffer.quaternions.LeftLowerLeg.identity();
        buffer.quaternions.LeftFoot.identity();
        buffer.quaternions.RightUpperLeg.identity();
        buffer.quaternions.RightLowerLeg.identity();
        buffer.quaternions.RightFoot.identity();
        buffer.telemetry.kneeFlexAvg = 0;
      }
    }

    // 7. DexPilot Pinch-Vector & Tendon-Coupled Hand Retargeting (30 Finger Bones)
    if (rHandInput && rHandInput.length >= 21) {
      this.solveDexPilotHand('Right', rHandInput, buffer);
    } else {
      this.relaxHandToNaturalRest('Right', buffer);
    }

    if (lHandInput && lHandInput.length >= 21) {
      this.solveDexPilotHand('Left', lHandInput, buffer);
    } else {
      this.relaxHandToNaturalRest('Left', buffer);
    }
  }

  /**
   * Solve Head & Neck with anatomical C1-C7 cervical distribution
   */
  private static solveCervicalHeadAndNeck(
    nose: LandmarkPoint | undefined,
    leftEar: LandmarkPoint | undefined,
    rightEar: LandmarkPoint | undefined,
    buffer: TargetPoseBuffer
  ) {
    if (!nose || !leftEar || !rightEar) return;

    const earMidX = (leftEar.x + rightEar.x) * 0.5;
    const earMidY = (leftEar.y + rightEar.y) * 0.5;

    const rawYaw = -(nose.x - earMidX) * 2.35;
    const rawPitch = (nose.y - earMidY) * 1.9;
    const rawRoll = -(leftEar.y - rightEar.y) * 1.45;

    const pitch = THREE.MathUtils.clamp(rawPitch, -0.52, 0.58);
    const yaw = THREE.MathUtils.clamp(rawYaw, -0.85, 0.85);
    const roll = THREE.MathUtils.clamp(rawRoll, -0.42, 0.42);

    _euler.set(pitch * 0.35, yaw * 0.35, roll * 0.35, 'YXZ');
    buffer.quaternions.Neck.setFromEuler(_euler);

    _euler.set(pitch * 0.65, yaw * 0.65, roll * 0.65, 'YXZ');
    buffer.quaternions.Head.setFromEuler(_euler);

    buffer.telemetry.headYaw = Math.round(yaw * RAD2DEG);
    buffer.telemetry.headPitch = Math.round(pitch * RAD2DEG);
    buffer.telemetry.headRoll = Math.round(roll * RAD2DEG);
  }

  /**
   * Solve 6-DOF Pelvis, Spine, Chest & Whole-Body Center-of-Mass (CoM) ZMP Compensator (OmniH2O)
   */
  private static solveTorsoAndWbcBalance(
    lShoulder: LandmarkPoint | undefined,
    rShoulder: LandmarkPoint | undefined,
    lHip: LandmarkPoint | undefined,
    rHip: LandmarkPoint | undefined,
    wLShoulder: LandmarkPoint | undefined,
    wRShoulder: LandmarkPoint | undefined,
    enableWbcBalance: boolean,
    buffer: TargetPoseBuffer
  ) {
    if (!lShoulder || !rShoulder) return;

    const shMidX = (lShoulder.x + rShoulder.x) * 0.5;
    const shMidY = (lShoulder.y + rShoulder.y) * 0.5;
    const shMidZ = ((lShoulder.z || 0) + (rShoulder.z || 0)) * 0.5;

    const hipMidX = lHip && rHip ? (lHip.x + rHip.x) * 0.5 : 0.5;
    const hipMidY = lHip && rHip ? (lHip.y + rHip.y) * 0.5 : 0.78;

    const shoulderTilt = -(lShoulder.y - rShoulder.y) * 0.9;
    const lateralLean = -(shMidX - hipMidX) * 0.85;
    const totalRoll = THREE.MathUtils.clamp(shoulderTilt * 0.5 + lateralLean * 0.5, -0.35, 0.35);

    const lZ = wLShoulder?.z ?? lShoulder.z ?? 0;
    const rZ = wRShoulder?.z ?? rShoulder.z ?? 0;
    const rawTwistYaw = THREE.MathUtils.clamp((lZ - rZ) * 1.35, -0.55, 0.55);

    const rawPitch = THREE.MathUtils.clamp(-shMidZ * 0.45 + (shMidY - 0.34) * 0.3, -0.28, 0.35);

    // OmniH2O / Whole-Body Control (WBC) CoM Counter-Balance:
    // When torso pitches forward (+rawPitch) or leans laterally, counter-shift the pelvis
    // slightly in the opposite direction so the Center of Mass stays inside the foot support polygon!
    const wbcCounterZ = enableWbcBalance ? -rawPitch * 0.14 : 0;
    const wbcCounterX = enableWbcBalance ? -totalRoll * 0.08 : 0;

    const hipOffsetX = THREE.MathUtils.clamp(-(shMidX - 0.5) * 0.32 + wbcCounterX, -0.18, 0.18);
    const hipOffsetY = THREE.MathUtils.clamp(-(hipMidY - 0.78) * 0.16, -0.12, 0.06);
    const hipOffsetZ = THREE.MathUtils.clamp(-shMidZ * 0.12 + wbcCounterZ, -0.12, 0.12);
    buffer.hipsPositionOffset.set(hipOffsetX, hipOffsetY, hipOffsetZ);

    // Compute Ground CoM Projection & ZMP Stability Margin (%)
    const comX = hipOffsetX + Math.sin(totalRoll) * 0.12;
    const comZ = hipOffsetZ + Math.sin(rawPitch) * 0.14;
    buffer.comGroundProjection.set(comX, 0.004, comZ);

    const distFromSupportCenter = Math.hypot(comX, comZ);
    const stabilityPct = Math.round(THREE.MathUtils.clamp((1.0 - distFromSupportCenter / 0.28) * 100, 60, 99));

    _euler.set(rawPitch * 0.15, rawTwistYaw * 0.2, totalRoll * 0.15, 'YXZ');
    buffer.quaternions.Hips.setFromEuler(_euler);

    _euler.set(rawPitch * 0.35, rawTwistYaw * 0.3, totalRoll * 0.35, 'YXZ');
    buffer.quaternions.Spine.setFromEuler(_euler);

    _euler.set(rawPitch * 0.3, rawTwistYaw * 0.3, totalRoll * 0.3, 'YXZ');
    buffer.quaternions.Chest.setFromEuler(_euler);

    _euler.set(rawPitch * 0.2, rawTwistYaw * 0.2, totalRoll * 0.2, 'YXZ');
    buffer.quaternions.UpperChest.setFromEuler(_euler);

    buffer.telemetry.spinePitch = Math.round(rawPitch * RAD2DEG);
    buffer.telemetry.spineYaw = Math.round(rawTwistYaw * RAD2DEG);
    buffer.telemetry.comOffsetX = Math.round(comX * 100);
    buffer.telemetry.comOffsetZ = Math.round(comZ * 100);
    buffer.telemetry.zmpStabilityPct = stabilityPct;
  }

  /**
   * Solve Clavicle / Shoulder shrug & protraction
   */
  private static solveClavicles(
    lShoulder: LandmarkPoint | undefined,
    rShoulder: LandmarkPoint | undefined,
    buffer: TargetPoseBuffer
  ) {
    if (!lShoulder || !rShoulder) return;

    const rElev = THREE.MathUtils.clamp((0.36 - rShoulder.y) * 0.6, -0.18, 0.24);
    const lElev = THREE.MathUtils.clamp((0.36 - lShoulder.y) * 0.6, -0.18, 0.24);

    _euler.set(0, 0, rElev, 'XYZ');
    buffer.quaternions.RightShoulder.setFromEuler(_euler);

    _euler.set(0, 0, -lElev, 'XYZ');
    buffer.quaternions.LeftShoulder.setFromEuler(_euler);

    buffer.telemetry.rightShoulderElev = Math.round(rElev * RAD2DEG);
    buffer.telemetry.leftShoulderElev = Math.round(lElev * RAD2DEG);
  }

  /**
   * Analytical Two-Bone Law-of-Cosines SE(3) Arm IK + Swivel Pole Vector
   * (Inspired by Unitree avp_teleoperate, Open-TeleVision, and NVIDIA Isaac GR00T)
   */
  private static solveAnalyticalTwoBoneArmIK(
    shoulderLm: LandmarkPoint | undefined,
    elbowLm: LandmarkPoint | undefined,
    wristLm: LandmarkPoint | undefined,
    handLandmarks: LandmarkPoint[] | null | undefined,
    isRight: boolean,
    config: KinematicsConfig,
    isPianoModeActive: boolean,
    buffer: TargetPoseBuffer
  ) {
    if (!shoulderLm || !elbowLm) return;

    const sign = isRight ? 1 : -1;
    const totalArmReach = L1_UPPER_ARM + L2_LOWER_ARM; // 0.50m

    // 1. Compute scaled shoulder-to-elbow and elbow-to-wrist vectors in robot metric space
    let rawUpperZ = -((elbowLm.z || 0) - (shoulderLm.z || 0)) * 0.85;
    if (wristLm && wristLm.y < elbowLm.y + 0.12) {
      rawUpperZ = Math.max(rawUpperZ, 0.15);
    }

    _upperDir.set(
      -(elbowLm.x - shoulderLm.x) * 1.48,
      -(elbowLm.y - shoulderLm.y),
      THREE.MathUtils.clamp(rawUpperZ, -0.12, 0.95)
    );
    if (isRight) _upperDir.x = Math.max(_upperDir.x, -0.42);
    else _upperDir.x = Math.min(_upperDir.x, 0.42);

    if (_upperDir.lengthSq() < 1e-4) _upperDir.copy(V_DOWN);
    else _upperDir.normalize();

    let bendAngle = 0.2;
    let forearmTwist = 0;

    if (wristLm) {
      _lowerDir.set(
        -(wristLm.x - elbowLm.x) * 1.48,
        -(wristLm.y - elbowLm.y),
        -((wristLm.z || 0) - (elbowLm.z || 0)) * 0.85
      );
      if (_lowerDir.lengthSq() < 1e-4) _lowerDir.copy(_upperDir);
      else _lowerDir.normalize();

      // Construct 3D SE(3) Wrist Target relative to Shoulder in metric robot space
      // _v3 = Shoulder-to-Wrist displacement vector
      _v3.copy(_upperDir).multiplyScalar(L1_UPPER_ARM).addScaledVector(_lowerDir, L2_LOWER_ARM);

      // Task-Space Piano Impedance Compliance (Neura 4NE-1 / 1X NEO / Open-TeleVision):
      // When Piano Mode is active and the user's hands are raised in the playing zone,
      // softly attract the wrist target Z and Y coordinates into the ergonomic keyboard corridor
      // so horizontal hand motion effortlessly glides across all 17 keys!
      if (isPianoModeActive && config.enablePianoCompliance !== false && wristLm.y < 0.88) {
        const targetRelY = THREE.MathUtils.lerp(_v3.y, -0.24, 0.55); // Places wrist at y ≈ 1.16m
        const targetRelZ = THREE.MathUtils.lerp(Math.max(_v3.z, 0.28), 0.34, 0.65); // Places wrist at z ≈ 0.34m
        _v3.y = targetRelY;
        _v3.z = targetRelZ;
      }

      // Store world-space wrist IK target for 3D visual telemetry gizmo
      const targetWorld = isRight ? buffer.rightWristTargetWorld : buffer.leftWristTargetWorld;
      targetWorld.set(
        sign * SHOULDER_WORLD_X + _v3.x + buffer.hipsPositionOffset.x,
        SHOULDER_WORLD_Y + _v3.y + buffer.hipsPositionOffset.y,
        _v3.z + buffer.hipsPositionOffset.z
      );

      // Analytical Law-of-Cosines Two-Bone IK Resolution:
      // Given L1 (0.26m), L2 (0.24m), and target reach distance d = ||_v3||:
      if (config.enableAnalyticalIK !== false) {
        const d = THREE.MathUtils.clamp(_v3.length(), 0.06, totalArmReach - 0.005);
        // Interior elbow angle via Law of Cosines: c^2 = a^2 + b^2 - 2ab cos(C)
        const cosInterior = THREE.MathUtils.clamp(
          (L1_UPPER_ARM * L1_UPPER_ARM + L2_LOWER_ARM * L2_LOWER_ARM - d * d) /
            (2 * L1_UPPER_ARM * L2_LOWER_ARM),
          -1.0,
          1.0
        );
        // Physiological elbow flexion angle (0 = straight, pi - interior = flexed)
        bendAngle = THREE.MathUtils.clamp(Math.PI - Math.acos(cosInterior), 0.05, 2.42);

        // Shoulder pitch offset angle alpha via Law of Cosines:
        const cosAlpha = THREE.MathUtils.clamp(
          (L1_UPPER_ARM * L1_UPPER_ARM + d * d - L2_LOWER_ARM * L2_LOWER_ARM) /
            (2 * L1_UPPER_ARM * d),
          -1.0,
          1.0
        );
        const shoulderAlpha = Math.acos(cosAlpha);

        // Aim UpperArm toward wrist target and pitch downward by -shoulderAlpha in the elbow swivel plane
        _v4.copy(_v3).normalize();
        _q1.setFromUnitVectors(V_DOWN, _v4);
        _euler.set(shoulderAlpha, 0, 0, 'XYZ');
        _q2.setFromEuler(_euler);
        _q1.multiply(_q2);
      } else {
        const dot = THREE.MathUtils.clamp(_upperDir.dot(_lowerDir), -1.0, 1.0);
        bendAngle = THREE.MathUtils.clamp(Math.acos(dot), 0.0, 2.45);
        _q1.setFromUnitVectors(V_DOWN, _upperDir);
      }

      // Apply Swivel / Cross-Body Yaw alignment so forearms sweep across the keyboard
      const crossArmYaw = THREE.MathUtils.clamp(_lowerDir.x * 0.58, -0.68, 0.68);
      _qTwist.setFromAxisAngle(V_UP, crossArmYaw);
      _q1.multiply(_qTwist);
    } else {
      _q1.setFromUnitVectors(V_DOWN, _upperDir);
    }

    // 3. Forearm Pronation / Supination from Hand Palm Normal (Wrist 0, Index MCP 5, Pinky MCP 17)
    if (config.enableWristSupination && handLandmarks && handLandmarks.length >= 18) {
      const w = handLandmarks[0];
      const idxMcp = handLandmarks[5];
      const pnkMcp = handLandmarks[17];
      if (w && idxMcp && pnkMcp) {
        _v1.set(-(idxMcp.x - w.x), -(idxMcp.y - w.y), -((idxMcp.z || 0) - (w.z || 0)));
        _v2.set(-(pnkMcp.x - w.x), -(pnkMcp.y - w.y), -((pnkMcp.z || 0) - (w.z || 0)));
        _palmNormal.crossVectors(_v1, _v2).normalize();
        forearmTwist = THREE.MathUtils.clamp(_palmNormal.x * (isRight ? -0.95 : 0.95), -1.2, 1.2);
      }
    }

    // Negative X rotation (-bendAngle) flexes the elbow FORWARD (+Z) toward the piano
    _euler.set(-bendAngle, forearmTwist, 0, 'XYZ');
    _q2.setFromEuler(_euler);

    if (isRight) {
      buffer.quaternions.RightUpperArm.copy(_q1);
      buffer.quaternions.RightLowerArm.copy(_q2);
      buffer.telemetry.rightElbowFlex = Math.round(bendAngle * RAD2DEG);
      buffer.telemetry.rightWristSupination = Math.round(forearmTwist * RAD2DEG);
    } else {
      buffer.quaternions.LeftUpperArm.copy(_q1);
      buffer.quaternions.LeftLowerArm.copy(_q2);
      buffer.telemetry.leftElbowFlex = Math.round(bendAngle * RAD2DEG);
      buffer.telemetry.leftWristSupination = Math.round(forearmTwist * RAD2DEG);
    }
  }

  /**
   * DexPilot Pinch-Vector & Tendon-Coupled Hand Retargeting
   * (Inspired by dexsuite/dex-retargeting, Tesla Optimus 22-DOF Tendon Drive & Fourier GR-2)
   *
   * - Computes normalized thumb-to-index pinch distance vector (in cm) to drive accurate opposition
   * - Enforces anatomical DIP = 0.68 * PIP tendon coupling to eliminate distal phalange noise
   * - Positive X rotation (+curl) flexes fingers downward onto the piano keys
   */
  private static solveDexPilotHand(
    side: 'Right' | 'Left',
    hand: LandmarkPoint[],
    buffer: TargetPoseBuffer
  ) {
    // 1. Normalize hand scale by palm length (Wrist 0 -> Middle MCP 9)
    const palmLen = Math.max(
      Math.hypot(
        hand[9].x - hand[0].x,
        hand[9].y - hand[0].y,
        (hand[9].z || 0) - (hand[0].z || 0)
      ),
      0.04
    );

    // 2. DexPilot Pinch Vector: 3D distance between Thumb Tip (4) and Index Tip (8)
    const pinchDistRaw = Math.hypot(
      hand[8].x - hand[4].x,
      hand[8].y - hand[4].y,
      (hand[8].z || 0) - (hand[4].z || 0)
    );
    const pinchRatio = THREE.MathUtils.clamp(pinchDistRaw / palmLen, 0.0, 1.5);
    const pinchCm = Math.round(pinchRatio * 7.5 * 10) / 10;
    if (side === 'Right') buffer.telemetry.rightPinchDistCm = pinchCm;
    else buffer.telemetry.leftPinchDistCm = pinchCm;

    // 3. Subtle Wrist ulnar/radial deviation
    const wristLateral = THREE.MathUtils.clamp(-(hand[9].x - hand[0].x) * 0.45, -0.3, 0.3);
    _euler.set(0, 0, wristLateral, 'XYZ');
    buffer.quaternions[`${side}Hand`].setFromEuler(_euler);

    // 4. Thumb 3-Segment Articulation + DexPilot Pinch Opposition Boost
    const pinchBoost = THREE.MathUtils.clamp(1.0 - pinchRatio / 0.45, 0.0, 1.0) * 0.35;
    const thumbMcp = this.computeJointAngle(hand[0], hand[1], hand[2], 1.2) + pinchBoost;
    const thumbPip = this.computeJointAngle(hand[1], hand[2], hand[3], 1.4) + pinchBoost * 0.8;
    const thumbDip = thumbPip * 0.68; // Tendon-coupled distal phalange
    const sign = side === 'Right' ? 1 : -1;

    _euler.set(thumbMcp * 0.55, -sign * (0.25 + pinchBoost * 0.4), sign * thumbMcp * 0.48, 'XYZ');
    buffer.quaternions[`${side}ThumbProximal`].setFromEuler(_euler);

    _euler.set(thumbPip * 0.6, 0, sign * thumbPip * 0.32, 'XYZ');
    buffer.quaternions[`${side}ThumbIntermediate`].setFromEuler(_euler);

    _euler.set(thumbDip * 0.68, 0, 0, 'XYZ');
    buffer.quaternions[`${side}ThumbDistal`].setFromEuler(_euler);

    // 5. Four Fingers (Index, Middle, Ring, Pinky) with Tendon-Coupled DIP = 0.68 * PIP
    const fingerSpecs: Array<{
      name: 'Index' | 'Middle' | 'Ring' | 'Pinky';
      mcpIdx: number;
      pipIdx: number;
      dipIdx: number;
      tipIdx: number;
    }> = [
      { name: 'Index', mcpIdx: 5, pipIdx: 6, dipIdx: 7, tipIdx: 8 },
      { name: 'Middle', mcpIdx: 9, pipIdx: 10, dipIdx: 11, tipIdx: 12 },
      { name: 'Ring', mcpIdx: 13, pipIdx: 14, dipIdx: 15, tipIdx: 16 },
      { name: 'Pinky', mcpIdx: 17, pipIdx: 18, dipIdx: 19, tipIdx: 20 }
    ];

    for (const f of fingerSpecs) {
      const mcpFlex = this.computeJointAngle(hand[0], hand[f.mcpIdx], hand[f.pipIdx], 1.65);
      const pipFlex = this.computeJointAngle(hand[f.mcpIdx], hand[f.pipIdx], hand[f.dipIdx], 1.85);
      const rawDipFlex = this.computeJointAngle(hand[f.pipIdx], hand[f.dipIdx], hand[f.tipIdx], 1.45);
      // Fuse measured DIP with anatomical tendon-coupled PIP (0.68 ratio) for ultra-clean finger curl
      const coupledDipFlex = rawDipFlex * 0.4 + pipFlex * 0.68 * 0.6;

      const rawSplay = -(hand[f.pipIdx].x - hand[f.mcpIdx].x) * 0.55;
      const splay = THREE.MathUtils.clamp(rawSplay, -0.2, 0.2);

      _euler.set(mcpFlex * 0.78 + pipFlex * 0.2, 0, splay, 'XYZ');
      buffer.quaternions[`${side}${f.name}Proximal` as CanonicalBoneName].setFromEuler(_euler);

      _euler.set(pipFlex * 0.88, 0, 0, 'XYZ');
      buffer.quaternions[`${side}${f.name}Intermediate` as CanonicalBoneName].setFromEuler(_euler);

      _euler.set(coupledDipFlex * 0.85, 0, 0, 'XYZ');
      buffer.quaternions[`${side}${f.name}Distal` as CanonicalBoneName].setFromEuler(_euler);

      if (f.name === 'Index') {
        const totalDeg = Math.round(((mcpFlex + pipFlex) * 0.5) * RAD2DEG);
        if (side === 'Right') buffer.telemetry.rightIndexCurl = totalDeg;
        else buffer.telemetry.leftIndexCurl = totalDeg;
      }
    }
  }

  /**
   * Relax hand fingers to natural slight ergonomic palmar curve when out of camera frame
   */
  private static relaxHandToNaturalRest(side: 'Right' | 'Left', buffer: TargetPoseBuffer) {
    buffer.quaternions[`${side}Hand`].identity();
    const digits: Array<'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky'> = [
      'Thumb',
      'Index',
      'Middle',
      'Ring',
      'Pinky'
    ];
    digits.forEach((d, idx) => {
      const restCurl = 0.14 + idx * 0.025;
      _euler.set(restCurl, 0, 0, 'XYZ');
      buffer.quaternions[`${side}${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
      buffer.quaternions[`${side}${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
      buffer.quaternions[`${side}${d}Distal` as CanonicalBoneName].setFromEuler(_euler);
    });
  }

  /**
   * Solve lower-body legs & knee hinges when visible in frame
   */
  private static solveLegs(pose: LandmarkPoint[], buffer: TargetPoseBuffer) {
    const lHip = pose[23];
    const rHip = pose[24];
    const lKnee = pose[25];
    const rKnee = pose[26];
    const lAnkle = pose[27];
    const rAnkle = pose[28];

    const visThreshold = 0.45;
    let rKneeAngle = 0;
    let lKneeAngle = 0;

    if (rHip && rKnee && (rKnee.visibility ?? 1) > visThreshold) {
      _v1.set(-(rKnee.x - rHip.x) * 1.2, -(rKnee.y - rHip.y), -((rKnee.z || 0) - (rHip.z || 0)) * 0.6).normalize();
      buffer.quaternions.RightUpperLeg.setFromUnitVectors(V_DOWN, _v1);

      if (rAnkle && (rAnkle.visibility ?? 1) > visThreshold) {
        _v2.set(-(rAnkle.x - rKnee.x) * 1.2, -(rAnkle.y - rKnee.y), -((rAnkle.z || 0) - (rKnee.z || 0)) * 0.6).normalize();
        const dot = THREE.MathUtils.clamp(_v1.dot(_v2), -1, 1);
        rKneeAngle = THREE.MathUtils.clamp(Math.acos(dot), 0, 2.35);
        _euler.set(rKneeAngle, 0, 0, 'XYZ');
        buffer.quaternions.RightLowerLeg.setFromEuler(_euler);
        _euler.set(-rKneeAngle * 0.35, 0, 0, 'XYZ');
        buffer.quaternions.RightFoot.setFromEuler(_euler);
      }
    }

    if (lHip && lKnee && (lKnee.visibility ?? 1) > visThreshold) {
      _v1.set(-(lKnee.x - lHip.x) * 1.2, -(lKnee.y - lHip.y), -((lKnee.z || 0) - (lHip.z || 0)) * 0.6).normalize();
      buffer.quaternions.LeftUpperLeg.setFromUnitVectors(V_DOWN, _v1);

      if (lAnkle && (lAnkle.visibility ?? 1) > visThreshold) {
        _v2.set(-(lAnkle.x - lKnee.x) * 1.2, -(lAnkle.y - lKnee.y), -((lAnkle.z || 0) - (lKnee.z || 0)) * 0.6).normalize();
        const dot = THREE.MathUtils.clamp(_v1.dot(_v2), -1, 1);
        lKneeAngle = THREE.MathUtils.clamp(Math.acos(dot), 0, 2.35);
        _euler.set(lKneeAngle, 0, 0, 'XYZ');
        buffer.quaternions.LeftLowerLeg.setFromEuler(_euler);
        _euler.set(-lKneeAngle * 0.35, 0, 0, 'XYZ');
        buffer.quaternions.LeftFoot.setFromEuler(_euler);
      }
    }

    buffer.telemetry.kneeFlexAvg = Math.round(((rKneeAngle + lKneeAngle) * 0.5) * RAD2DEG);
  }

  /**
   * Compute 3-point anatomical joint bend angle clamped to [0, maxRad]
   */
  private static computeJointAngle(
    a: LandmarkPoint | undefined,
    b: LandmarkPoint | undefined,
    c: LandmarkPoint | undefined,
    maxRad: number
  ): number {
    if (!a || !b || !c) return 0.12;
    _v3.set(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0));
    _v4.set(c.x - b.x, c.y - b.y, (c.z || 0) - (b.z || 0));
    if (_v3.lengthSq() < 1e-6 || _v4.lengthSq() < 1e-6) return 0.12;
    _v3.normalize();
    _v4.normalize();
    const dot = THREE.MathUtils.clamp(_v3.dot(_v4), -1.0, 1.0);
    return THREE.MathUtils.clamp(Math.acos(dot), 0.0, maxRad);
  }

  /**
   * Procedural Full-Body Simulation Presets (Piano Virtuoso, 54-DOF Calibration, Tai Chi Flow)
   */
  static applySimulationPresetIntoBuffer(
    preset: 'piano-virtuoso' | 'robotics-calibration' | 'taichi-flow',
    t: number,
    buffer: TargetPoseBuffer
  ) {
    buffer.lastUpdatedTime = performance.now();
    const digits: Array<'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky'> = [
      'Thumb',
      'Index',
      'Middle',
      'Ring',
      'Pinky'
    ];

    if (preset === 'piano-virtuoso') {
      const headYaw = Math.sin(t * 1.4) * 0.22;
      const headPitch = 0.24 + Math.cos(t * 2.1) * 0.07;
      _euler.set(headPitch * 0.35, headYaw * 0.35, 0, 'YXZ');
      buffer.quaternions.Neck.setFromEuler(_euler);
      _euler.set(headPitch * 0.65, headYaw * 0.65, Math.sin(t * 1.1) * 0.05, 'YXZ');
      buffer.quaternions.Head.setFromEuler(_euler);

      const spinePitch = 0.06 + Math.sin(t * 1.8) * 0.03;
      const spineYaw = Math.sin(t * 1.4) * 0.1;
      _euler.set(spinePitch * 0.5, spineYaw * 0.5, Math.cos(t * 1.4) * 0.03, 'YXZ');
      buffer.quaternions.Spine.setFromEuler(_euler);
      buffer.quaternions.Chest.setFromEuler(_euler);

      const hipX = Math.sin(t * 1.4) * 0.03;
      buffer.hipsPositionOffset.set(hipX, 0, -0.01);
      buffer.comGroundProjection.set(hipX, 0.004, 0.01);

      const rSweep = Math.sin(t * 2.2) * 0.26;
      const lSweep = Math.cos(t * 1.9) * 0.24;

      const rUpperPitch = -0.46 - Math.sin(t * 4.2) * 0.06;
      const rElbowFlex = 1.06 + Math.cos(t * 4.2) * 0.09;
      _euler.set(rUpperPitch, rSweep - 0.1, -0.06, 'YXZ');
      buffer.quaternions.RightUpperArm.setFromEuler(_euler);
      _euler.set(-rElbowFlex, -0.12, 0, 'XYZ');
      buffer.quaternions.RightLowerArm.setFromEuler(_euler);

      const lUpperPitch = -0.46 - Math.cos(t * 3.8) * 0.06;
      const lElbowFlex = 1.06 + Math.sin(t * 3.8) * 0.09;
      _euler.set(lUpperPitch, lSweep + 0.1, 0.06, 'YXZ');
      buffer.quaternions.LeftUpperArm.setFromEuler(_euler);
      _euler.set(-lElbowFlex, 0.12, 0, 'XYZ');
      buffer.quaternions.LeftLowerArm.setFromEuler(_euler);

      buffer.rightWristTargetWorld.set(0.14 + rSweep * 0.35, 1.13, 0.39);
      buffer.leftWristTargetWorld.set(-0.14 + lSweep * 0.35, 1.13, 0.39);

      digits.forEach((d, idx) => {
        const rStrike = Math.max(0, Math.sin(t * 7.5 + idx * 1.35)) * 0.78;
        const lStrike = Math.max(0, Math.cos(t * 6.8 + idx * 1.45)) * 0.78;

        _euler.set(0.22 + rStrike * 0.65, 0, 0, 'XYZ');
        buffer.quaternions[`Right${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        _euler.set(0.32 + rStrike * 0.5, 0, 0, 'XYZ');
        buffer.quaternions[`Right${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
        _euler.set(0.18 + rStrike * 0.35, 0, 0, 'XYZ');
        buffer.quaternions[`Right${d}Distal` as CanonicalBoneName].setFromEuler(_euler);

        _euler.set(0.22 + lStrike * 0.65, 0, 0, 'XYZ');
        buffer.quaternions[`Left${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        _euler.set(0.32 + lStrike * 0.5, 0, 0, 'XYZ');
        buffer.quaternions[`Left${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
        _euler.set(0.18 + lStrike * 0.35, 0, 0, 'XYZ');
        buffer.quaternions[`Left${d}Distal` as CanonicalBoneName].setFromEuler(_euler);
      });

      buffer.telemetry.headYaw = Math.round(headYaw * RAD2DEG);
      buffer.telemetry.headPitch = Math.round(headPitch * RAD2DEG);
      buffer.telemetry.spineYaw = Math.round(spineYaw * RAD2DEG);
      buffer.telemetry.rightElbowFlex = Math.round(rElbowFlex * RAD2DEG);
      buffer.telemetry.leftElbowFlex = Math.round(lElbowFlex * RAD2DEG);
      buffer.telemetry.rightWristSupination = -7;
      buffer.telemetry.leftWristSupination = 7;
      buffer.telemetry.zmpStabilityPct = 98;
    } else if (preset === 'robotics-calibration') {
      const squat = Math.max(0, Math.sin(t * 1.5)) * 0.42;
      const hipX = Math.sin(t * 1.1) * 0.08;
      buffer.hipsPositionOffset.set(hipX, -squat * 0.22, -squat * 0.06);
      buffer.comGroundProjection.set(hipX, 0.004, -squat * 0.03);

      _euler.set(Math.sin(t * 1.6) * 0.18, Math.cos(t * 1.2) * 0.32, Math.sin(t * 0.9) * 0.12, 'YXZ');
      buffer.quaternions.Head.setFromEuler(_euler);

      _euler.set(squat * 0.18, Math.sin(t * 1.1) * 0.18, Math.cos(t * 1.1) * 0.08, 'YXZ');
      buffer.quaternions.Spine.setFromEuler(_euler);
      buffer.quaternions.Chest.setFromEuler(_euler);

      const rFlex = 0.85 + Math.sin(t * 2.4) * 0.55;
      const lFlex = 0.85 + Math.cos(t * 2.4) * 0.55;
      const wristRot = Math.sin(t * 3.2) * 0.85;

      _euler.set(-0.58 - Math.sin(t * 1.7) * 0.32, -0.25, 0.25 + Math.abs(Math.cos(t * 1.5)) * 0.25, 'YXZ');
      buffer.quaternions.RightUpperArm.setFromEuler(_euler);
      _euler.set(-rFlex, wristRot, 0, 'XYZ');
      buffer.quaternions.RightLowerArm.setFromEuler(_euler);

      _euler.set(-0.58 - Math.cos(t * 1.7) * 0.32, 0.25, -0.25 - Math.abs(Math.sin(t * 1.5)) * 0.25, 'YXZ');
      buffer.quaternions.LeftUpperArm.setFromEuler(_euler);
      _euler.set(-lFlex, -wristRot, 0, 'XYZ');
      buffer.quaternions.LeftLowerArm.setFromEuler(_euler);

      digits.forEach((d, idx) => {
        const wave = (Math.sin(t * 5.0 - idx * 0.55) + 1) * 0.45;
        _euler.set(wave * 0.78, 0, 0, 'XYZ');
        buffer.quaternions[`Right${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Right${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Right${d}Distal` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Left${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Left${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Left${d}Distal` as CanonicalBoneName].setFromEuler(_euler);
      });

      _euler.set(-squat, 0, 0, 'XYZ');
      buffer.quaternions.RightUpperLeg.setFromEuler(_euler);
      buffer.quaternions.LeftUpperLeg.setFromEuler(_euler);
      _euler.set(squat * 1.85, 0, 0, 'XYZ');
      buffer.quaternions.RightLowerLeg.setFromEuler(_euler);
      buffer.quaternions.LeftLowerLeg.setFromEuler(_euler);
      _euler.set(-squat * 0.85, 0, 0, 'XYZ');
      buffer.quaternions.RightFoot.setFromEuler(_euler);
      buffer.quaternions.LeftFoot.setFromEuler(_euler);

      buffer.telemetry.rightElbowFlex = Math.round(rFlex * RAD2DEG);
      buffer.telemetry.leftElbowFlex = Math.round(lFlex * RAD2DEG);
      buffer.telemetry.rightWristSupination = Math.round(wristRot * RAD2DEG);
      buffer.telemetry.leftWristSupination = Math.round(-wristRot * RAD2DEG);
      buffer.telemetry.kneeFlexAvg = Math.round(squat * 1.85 * RAD2DEG);
      buffer.telemetry.zmpStabilityPct = Math.round(98 - squat * 12);
    } else {
      const phase = t * 0.95;
      const hipX = Math.sin(phase) * 0.11;
      buffer.hipsPositionOffset.set(hipX, -0.04 + Math.cos(phase * 2) * 0.03, 0);
      buffer.comGroundProjection.set(hipX * 0.85, 0.004, 0);

      _euler.set(Math.sin(phase) * 0.08, Math.cos(phase) * 0.22, Math.sin(phase * 0.5) * 0.07, 'YXZ');
      buffer.quaternions.Spine.setFromEuler(_euler);
      buffer.quaternions.Chest.setFromEuler(_euler);
      buffer.quaternions.Head.setFromEuler(_euler);

      _euler.set(-0.62 - Math.sin(phase) * 0.28, Math.cos(phase) * 0.35, 0.2, 'YXZ');
      buffer.quaternions.RightUpperArm.setFromEuler(_euler);
      _euler.set(-0.98 - Math.cos(phase) * 0.3, Math.sin(phase) * 0.5, 0, 'XYZ');
      buffer.quaternions.RightLowerArm.setFromEuler(_euler);

      _euler.set(-0.62 + Math.sin(phase) * 0.28, Math.cos(phase) * 0.35, -0.2, 'YXZ');
      buffer.quaternions.LeftUpperArm.setFromEuler(_euler);
      _euler.set(-0.98 + Math.cos(phase) * 0.3, -Math.sin(phase) * 0.5, 0, 'XYZ');
      buffer.quaternions.LeftLowerArm.setFromEuler(_euler);

      digits.forEach((d, idx) => {
        const gentle = 0.22 + Math.sin(phase * 2 + idx * 0.4) * 0.15;
        _euler.set(gentle, 0, 0, 'XYZ');
        buffer.quaternions[`Right${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Right${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Left${d}Proximal` as CanonicalBoneName].setFromEuler(_euler);
        buffer.quaternions[`Left${d}Intermediate` as CanonicalBoneName].setFromEuler(_euler);
      });
      buffer.telemetry.zmpStabilityPct = 96;
    }
  }
}
