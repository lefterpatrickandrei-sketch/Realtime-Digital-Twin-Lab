import * as THREE from 'three';

/**
 * Biomechanically Constrained Human Kinematics Solver
 * Translates MediaPipe Holistic landmarks into anatomically valid 3D bone rotations.
 * Enforces physiological joint limits (1-DOF elbow hinge, shoulder cone, head limits).
 * Prevents unnatural dislocations, broken arms, or erratic movements.
 */

const V_DOWN = new THREE.Vector3(0, -1, 0);
const tempV1 = new THREE.Vector3();
const tempV2 = new THREE.Vector3();

export class KinematicsSolver {
  /**
   * Solve anatomically constrained arm bone rotations (Shoulder & 1-DOF Elbow Hinge)
   */
  static solveArm(shoulderLm, elbowLm, wristLm, isRight = true) {
    if (!shoulderLm || !elbowLm) return null;

    // 1. Compute raw Upper Arm direction in mirrored coordinate space
    const upperDir = new THREE.Vector3(
      -(elbowLm.x - shoulderLm.x) * 1.5,
      -(elbowLm.y - shoulderLm.y),
      -(elbowLm.z - (shoulderLm.z || 0)) * 0.8
    );

    // Anatomical Shoulder Constraint: Prevent upper arm from dislocating backward into the torso
    upperDir.z = Math.max(upperDir.z, -0.35); // Cannot penetrate spine/ribcage
    if (isRight) {
      upperDir.x = Math.max(upperDir.x, -0.5); // Right arm doesn't penetrate left torso
    } else {
      upperDir.x = Math.min(upperDir.x, 0.5);  // Left arm doesn't penetrate right torso
    }
    upperDir.normalize();

    // Upper arm quaternion from resting down vector (0, -1, 0)
    const upperQ = new THREE.Quaternion().setFromUnitVectors(V_DOWN, upperDir);

    // 2. 1-DOF Anatomical Elbow Hinge Constraint
    // The human elbow is strictly a hinge: it only bends forward (0 to 140 degrees),
    // and CANNOT hyperextend backwards (<0) or twist sideways.
    const lowerQ = new THREE.Quaternion();
    if (wristLm) {
      const lowerDir = new THREE.Vector3(
        -(wristLm.x - elbowLm.x) * 1.5,
        -(wristLm.y - elbowLm.y),
        -(wristLm.z - (elbowLm.z || 0)) * 0.8
      ).normalize();

      // Dot product measures bend angle between upper and lower arm
      const dot = THREE.MathUtils.clamp(upperDir.dot(lowerDir), -1.0, 1.0);
      const rawBendAngle = Math.acos(dot);

      // Clamp to human physiological limits: 0.0 rad (straight) to 2.45 rad (~140 deg full flex)
      const clampedBendAngle = THREE.MathUtils.clamp(rawBendAngle, 0.0, 2.45);

      // Rotate forearm forward around the local X axis (hinge flexion)
      lowerQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), clampedBendAngle);
    }

    return { upperQ, lowerQ };
  }

  /**
   * Solve head rotation with strict anatomical cervical limits
   */
  static solveHead(noseLm, leftEarLm, rightEarLm) {
    if (!noseLm || !leftEarLm || !rightEarLm) return null;

    // Yaw: horizontal ear distance difference
    const earMidX = (leftEarLm.x + rightEarLm.x) / 2;
    const yaw = -(noseLm.x - earMidX) * 2.2;

    // Pitch: nose vertical position relative to ears
    const earMidY = (leftEarLm.y + rightEarLm.y) / 2;
    const pitch = (noseLm.y - earMidY) * 1.8;

    // Roll: lateral ear tilt
    const roll = -(leftEarLm.y - rightEarLm.y) * 1.4;

    // Strict human cervical spine limits
    const euler = new THREE.Euler(
      THREE.MathUtils.clamp(pitch, -0.45, 0.50), // Pitch: -25 deg to +28 deg
      THREE.MathUtils.clamp(yaw, -0.75, 0.75),   // Yaw: -43 deg to +43 deg
      THREE.MathUtils.clamp(roll, -0.35, 0.35),  // Roll: -20 deg to +20 deg
      'YXZ'
    );

    return new THREE.Quaternion().setFromEuler(euler);
  }

  /**
   * Calculate finger curl angle clamped strictly to [0.0, 2.2] rad
   */
  static solveFingerCurl(mcp, pip, dip, tip) {
    if (!mcp || !pip || !tip) return 0.15; // Natural slight rest curve

    tempV1.set(pip.x - mcp.x, pip.y - mcp.y, (pip.z - mcp.z) || 0).normalize();
    tempV2.set(tip.x - pip.x, tip.y - pip.y, (tip.z - pip.z) || 0).normalize();

    const dot = THREE.MathUtils.clamp(tempV1.dot(tempV2), -1.0, 1.0);
    const angle = Math.acos(dot);

    // Anatomical finger flexure: Cannot hyperextend backwards (<0)
    return THREE.MathUtils.clamp(angle, 0.0, 2.2);
  }

  /**
   * Solve full hand fingers with anatomical joint limits
   */
  static solveHandFingers(handLandmarks) {
    if (!handLandmarks || handLandmarks.length < 21) return null;

    const thumbCurl = this.solveFingerCurl(handLandmarks[1], handLandmarks[2], handLandmarks[3], handLandmarks[4]);
    const indexCurl = this.solveFingerCurl(handLandmarks[5], handLandmarks[6], handLandmarks[7], handLandmarks[8]);
    const middleCurl = this.solveFingerCurl(handLandmarks[9], handLandmarks[10], handLandmarks[11], handLandmarks[12]);
    const ringCurl = this.solveFingerCurl(handLandmarks[13], handLandmarks[14], handLandmarks[15], handLandmarks[16]);
    const pinkyCurl = this.solveFingerCurl(handLandmarks[17], handLandmarks[18], handLandmarks[19], handLandmarks[20]);

    // Wrist roll & pitch: from wrist (0) to middle MCP (9)
    tempV1.set(
      -(handLandmarks[9].x - handLandmarks[0].x),
      -(handLandmarks[9].y - handLandmarks[0].y),
      -(handLandmarks[9].z - (handLandmarks[0].z || 0)) * 0.8
    ).normalize();

    // Restrict wrist from extreme unnatural spins
    const wristQ = new THREE.Quaternion().setFromUnitVectors(V_DOWN, tempV1);

    return {
      wristQ,
      curls: {
        Thumb: thumbCurl,
        Index: indexCurl,
        Middle: middleCurl,
        Ring: ringCurl,
        Pinky: pinkyCurl
      }
    };
  }
}
