import * as THREE from 'three';

/**
 * Procedural Articulated Crash-Test Dummy (Hybrid III Style)
 * Built with standard humanoid bone hierarchies compatible with Kalidokit / IK solvers.
 * Features signature crash-test safety yellow, carbon accents, and target crosshairs.
 */
export class CrashTestDummy {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "CrashTestDummy_Root";
    this.bones = {};
    this.fingertips = { left: [], right: [] };
    this.buildRig();
    this.scene.add(this.group);
  }

  buildRig() {
    // Materials
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xdeb018,
      roughness: 0.35,
      metalness: 0.15,
      name: "DummySafetyYellow"
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      roughness: 0.5,
      metalness: 0.3,
      name: "DummyDarkChassis"
    });

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.25,
      metalness: 0.8,
      name: "DummyJointSteel"
    });

    const targetMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x005577,
      roughness: 0.2,
      metalness: 0.5
    });

    // Helper to create joints and segments
    const createSegment = (geom, mat, name) => {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      return mesh;
    };

    // 1. Root / Hips
    const hipsGroup = new THREE.Group();
    hipsGroup.position.set(0, 0.95, 0);
    hipsGroup.name = "Hips";
    this.bones["Hips"] = hipsGroup;
    this.group.add(hipsGroup);

    const pelvisMesh = createSegment(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 16), darkMat, "Pelvis");
    hipsGroup.add(pelvisMesh);

    // 2. Spine & Chest
    const spineGroup = new THREE.Group();
    spineGroup.position.set(0, 0.12, 0);
    spineGroup.name = "Spine";
    this.bones["Spine"] = spineGroup;
    hipsGroup.add(spineGroup);

    const spineMesh = createSegment(new THREE.CylinderGeometry(0.12, 0.13, 0.16, 16), yellowMat, "SpineMesh");
    spineGroup.add(spineMesh);

    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 0.16, 0);
    chestGroup.name = "Chest";
    this.bones["Chest"] = chestGroup;
    spineGroup.add(chestGroup);

    const chestMesh = createSegment(new THREE.BoxGeometry(0.32, 0.24, 0.19), yellowMat, "ChestMesh");
    chestMesh.position.set(0, 0.08, 0);
    chestGroup.add(chestMesh);

    // Target crosshairs on chest
    const targetDisc = createSegment(new THREE.CylinderGeometry(0.045, 0.045, 0.005, 16), targetMat, "TargetDisc");
    targetDisc.rotation.x = Math.PI / 2;
    targetDisc.position.set(0, 0.08, 0.10);
    chestGroup.add(targetDisc);

    // 3. Neck & Head
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.22, 0);
    neckGroup.name = "Neck";
    this.bones["Neck"] = neckGroup;
    chestGroup.add(neckGroup);

    const neckMesh = createSegment(new THREE.CylinderGeometry(0.06, 0.07, 0.09, 16), jointMat, "NeckMesh");
    neckMesh.position.set(0, 0.04, 0);
    neckGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.10, 0);
    headGroup.name = "Head";
    this.bones["Head"] = headGroup;
    neckGroup.add(headGroup);

    const headMesh = createSegment(new THREE.SphereGeometry(0.11, 24, 20), yellowMat, "HeadMesh");
    headMesh.scale.set(1.0, 1.25, 1.05);
    headMesh.position.set(0, 0.11, 0);
    headGroup.add(headMesh);

    // Head target markers on temples
    const headTargetL = createSegment(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 16), darkMat, "HeadTargetL");
    headTargetL.rotation.z = Math.PI / 2;
    headTargetL.position.set(-0.115, 0.11, 0);
    headGroup.add(headTargetL);

    const headTargetR = createSegment(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 16), darkMat, "HeadTargetR");
    headTargetR.rotation.z = Math.PI / 2;
    headTargetR.position.set(0.115, 0.11, 0);
    headGroup.add(headTargetR);

    // 4. Arms & Hands
    this.buildArm("Right", 1, chestGroup, yellowMat, darkMat, jointMat);
    this.buildArm("Left", -1, chestGroup, yellowMat, darkMat, jointMat);

    // 5. Legs & Feet
    this.buildLeg("Right", 1, hipsGroup, yellowMat, darkMat, jointMat);
    this.buildLeg("Left", -1, hipsGroup, yellowMat, darkMat, jointMat);
  }

  buildArm(side, sign, chestGroup, yellowMat, darkMat, jointMat) {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(sign * 0.20, 0.16, 0);
    shoulderGroup.name = `${side}Shoulder`;
    this.bones[`${side}Shoulder`] = shoulderGroup;
    chestGroup.add(shoulderGroup);

    const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), jointMat);
    shoulderGroup.add(shoulderJoint);

    const upperArmGroup = new THREE.Group();
    upperArmGroup.name = `${side}UpperArm`;
    this.bones[`${side}UpperArm`] = upperArmGroup;
    shoulderGroup.add(upperArmGroup);

    const upperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.26, 16), yellowMat);
    upperArmMesh.position.set(sign * 0.02, -0.13, 0);
    upperArmMesh.castShadow = true;
    upperArmGroup.add(upperArmMesh);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(sign * 0.02, -0.26, 0);
    elbowGroup.name = `${side}LowerArm`;
    this.bones[`${side}LowerArm`] = elbowGroup;
    upperArmGroup.add(elbowGroup);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), jointMat);
    elbowGroup.add(elbowJoint);

    const forearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.24, 16), yellowMat);
    forearmMesh.position.set(0, -0.12, 0);
    forearmMesh.castShadow = true;
    elbowGroup.add(forearmMesh);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.24, 0);
    handGroup.name = `${side}Hand`;
    this.bones[`${side}Hand`] = handGroup;
    elbowGroup.add(handGroup);

    const palmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.025), darkMat);
    palmMesh.position.set(0, -0.04, 0);
    palmMesh.castShadow = true;
    handGroup.add(palmMesh);

    // Build articulated fingers (Thumb, Index, Middle, Ring, Pinky)
    const fingerNames = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
    const xOffsets = sign > 0 
      ? [-0.032, -0.018, 0.0, 0.018, 0.032]
      : [0.032, 0.018, 0.0, -0.018, -0.032];

    fingerNames.forEach((fname, fidx) => {
      const fBase = new THREE.Group();
      fBase.position.set(xOffsets[fidx], -0.08, 0);
      fBase.name = `${side}${fname}Proximal`;
      this.bones[`${side}${fname}Proximal`] = fBase;
      handGroup.add(fBase);

      const fProxMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.03, 8), jointMat);
      fProxMesh.position.set(0, -0.015, 0);
      fBase.add(fProxMesh);

      const fDistal = new THREE.Group();
      fDistal.position.set(0, -0.03, 0);
      fDistal.name = `${side}${fname}Distal`;
      this.bones[`${side}${fname}Distal`] = fDistal;
      fBase.add(fDistal);

      const fDistMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.025, 8), yellowMat);
      fDistMesh.position.set(0, -0.0125, 0);
      fDistal.add(fDistMesh);

      // Fingertip marker node (useful for piano collisions)
      const tipNode = new THREE.Group();
      tipNode.position.set(0, -0.025, 0);
      tipNode.name = `${side}${fname}Tip`;
      fDistal.add(tipNode);
      this.fingertips[side.toLowerCase()].push(tipNode);
    });
  }

  buildLeg(side, sign, hipsGroup, yellowMat, darkMat, jointMat) {
    const hipJoint = new THREE.Group();
    hipJoint.position.set(sign * 0.09, -0.08, 0);
    hipJoint.name = `${side}UpperLeg`;
    this.bones[`${side}UpperLeg`] = hipJoint;
    hipsGroup.add(hipJoint);

    const upperLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.38, 16), yellowMat);
    upperLegMesh.position.set(0, -0.19, 0);
    upperLegMesh.castShadow = true;
    hipJoint.add(upperLegMesh);

    const kneeJoint = new THREE.Group();
    kneeJoint.position.set(0, -0.38, 0);
    kneeJoint.name = `${side}LowerLeg`;
    this.bones[`${side}LowerLeg`] = kneeJoint;
    hipJoint.add(kneeJoint);

    const kneeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), jointMat);
    kneeJoint.add(kneeMesh);

    const lowerLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.38, 16), yellowMat);
    lowerLegMesh.position.set(0, -0.19, 0);
    lowerLegMesh.castShadow = true;
    kneeJoint.add(lowerLegMesh);

    const footJoint = new THREE.Group();
    footJoint.position.set(0, -0.38, 0);
    footJoint.name = `${side}Foot`;
    this.bones[`${side}Foot`] = footJoint;
    kneeJoint.add(footJoint);

    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.20), darkMat);
    footMesh.position.set(0, -0.025, 0.05);
    footMesh.castShadow = true;
    footJoint.add(footMesh);
  }

  /**
   * Apply direct kinematics computed from MediaPipe landmarks
   */
  applyDirectKinematics(headQ, rightArm, leftArm, rightFingers, leftFingers, slerpFactor = 0.4) {
    // 1. Head Rotation
    if (headQ && this.bones["Head"]) {
      this.bones["Head"].quaternion.slerp(headQ, slerpFactor);
    }

    // 2. Right Arm (Upper & Lower)
    if (rightArm) {
      if (rightArm.upperQ && this.bones["RightUpperArm"]) {
        this.bones["RightUpperArm"].quaternion.slerp(rightArm.upperQ, slerpFactor);
      }
      if (rightArm.lowerQ && this.bones["RightLowerArm"]) {
        this.bones["RightLowerArm"].quaternion.slerp(rightArm.lowerQ, slerpFactor);
      }
    }

    // 3. Left Arm (Upper & Lower)
    if (leftArm) {
      if (leftArm.upperQ && this.bones["LeftUpperArm"]) {
        this.bones["LeftUpperArm"].quaternion.slerp(leftArm.upperQ, slerpFactor);
      }
      if (leftArm.lowerQ && this.bones["LeftLowerArm"]) {
        this.bones["LeftLowerArm"].quaternion.slerp(leftArm.lowerQ, slerpFactor);
      }
    }

    // 4. Right Hand & Fingers
    if (rightFingers) {
      if (rightFingers.wristQ && this.bones["RightHand"]) {
        this.bones["RightHand"].quaternion.slerp(rightFingers.wristQ, slerpFactor);
      }
      this.applyFingerCurls("Right", rightFingers.curls, slerpFactor);
    }

    // 5. Left Hand & Fingers
    if (leftFingers) {
      if (leftFingers.wristQ && this.bones["LeftHand"]) {
        this.bones["LeftHand"].quaternion.slerp(leftFingers.wristQ, slerpFactor);
      }
      this.applyFingerCurls("Left", leftFingers.curls, slerpFactor);
    }
  }

  applyFingerCurls(side, curls, slerpFactor = 0.4) {
    if (!curls) return;
    const digits = ["Thumb", "Index", "Middle", "Ring", "Pinky"];

    digits.forEach((digit) => {
      const curlAngle = curls[digit] || 0;
      const proxBone = this.bones[`${side}${digit}Proximal`];
      const distBone = this.bones[`${side}${digit}Distal`];

      // Curl rotates forward around X axis
      const targetProxRot = -curlAngle * 0.65;
      const targetDistRot = -curlAngle * 0.45;

      if (proxBone) {
        proxBone.rotation.x = THREE.MathUtils.lerp(proxBone.rotation.x, targetProxRot, slerpFactor);
      }
      if (distBone) {
        distBone.rotation.x = THREE.MathUtils.lerp(distBone.rotation.x, targetDistRot, slerpFactor);
      }
    });
  }

  /**
   * Legacy Kalidokit wrapper
   */
  applyPose(solvedPose, solvedLeftHand, solvedRightHand, slerpFactor = 0.4) {
    const applyBoneRot = (boneName, rot) => {
      const bone = this.bones[boneName];
      if (bone && rot) {
        const euler = new THREE.Euler(rot.x, rot.y, rot.z, 'XYZ');
        const targetQ = new THREE.Quaternion().setFromEuler(euler);
        bone.quaternion.slerp(targetQ, slerpFactor);
      }
    };

    if (solvedPose) {
      applyBoneRot("Spine", solvedPose.Spine);
      applyBoneRot("Chest", solvedPose.Chest);
      applyBoneRot("Neck", solvedPose.Neck);
      applyBoneRot("Head", solvedPose.Head);
      applyBoneRot("RightUpperArm", solvedPose.RightUpperArm);
      applyBoneRot("RightLowerArm", solvedPose.RightLowerArm);
      applyBoneRot("LeftUpperArm", solvedPose.LeftUpperArm);
      applyBoneRot("LeftLowerArm", solvedPose.LeftLowerArm);
    }
  }
}
