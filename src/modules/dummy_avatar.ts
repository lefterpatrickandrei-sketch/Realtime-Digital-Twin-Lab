import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CANONICAL_BONES,
  CanonicalBoneName,
  KinematicsConfig,
  TargetPoseBuffer
} from './kinematics_solver';

export type ChassisPreset =
  | 'rk900-cyberlife'
  | 'hybrid-iii'
  | 'optimus-titanium'
  | 'unitree-g1'
  | 'neura-4ne1'
  | 'figure-carbon'
  | 'custom-glb';

export type SynthSkinMode = 'synth-porcelain' | 'synth-warm' | 'exposed-white' | 'exposed-chrome';

export interface CostumeCustomization {
  jacketColor: string;
  trimColor: string;
  ledColor: string;
  skinMode: SynthSkinMode;
  showHighCollarJacket: boolean;
  showCyberLifeInsignia: boolean;
  showTempleLed: boolean;
  fabricRoughness: number;
  armorMetalness: number;
}

export const DEFAULT_RK900_COSTUME: CostumeCustomization = {
  jacketColor: '#f1f5f9', // RK900 Ceramic White tactical jacket
  trimColor: '#0f172a',   // Obsidian black lapel, collar & trousers
  ledColor: '#00e5ff',    // CyberLife Blue LED & triangle insignia
  skinMode: 'synth-porcelain',
  showHighCollarJacket: true,
  showCyberLifeInsignia: true,
  showTempleLed: true,
  fabricRoughness: 0.34,
  armorMetalness: 0.22
};

export interface RK900OutfitPreset {
  id: string;
  label: string;
  config: CostumeCustomization;
}

export const RK900_OUTFIT_PRESETS: RK900OutfitPreset[] = [
  {
    id: 'rk900-canonical',
    label: 'RK900 White Tactical',
    config: {
      jacketColor: '#f1f5f9',
      trimColor: '#0f172a',
      ledColor: '#00e5ff',
      skinMode: 'synth-porcelain',
      showHighCollarJacket: true,
      showCyberLifeInsignia: true,
      showTempleLed: true,
      fabricRoughness: 0.34,
      armorMetalness: 0.22
    }
  },
  {
    id: 'rk800-detective',
    label: 'RK800 Detective Suit',
    config: {
      jacketColor: '#27303f',
      trimColor: '#090d16',
      ledColor: '#38bdf8',
      skinMode: 'synth-warm',
      showHighCollarJacket: true,
      showCyberLifeInsignia: true,
      showTempleLed: true,
      fabricRoughness: 0.48,
      armorMetalness: 0.15
    }
  },
  {
    id: 'deviant-crimson',
    label: 'Deviant Red Ops',
    config: {
      jacketColor: '#18181b',
      trimColor: '#450a0a',
      ledColor: '#ef4444',
      skinMode: 'exposed-white',
      showHighCollarJacket: true,
      showCyberLifeInsignia: true,
      showTempleLed: true,
      fabricRoughness: 0.28,
      armorMetalness: 0.45
    }
  },
  {
    id: 'cyberlife-endoskeleton',
    label: 'Exposed Endoskeleton',
    config: {
      jacketColor: '#cbd5e1',
      trimColor: '#1e293b',
      ledColor: '#00e5ff',
      skinMode: 'exposed-chrome',
      showHighCollarJacket: false,
      showCyberLifeInsignia: true,
      showTempleLed: true,
      fabricRoughness: 0.18,
      armorMetalness: 0.85
    }
  }
];

interface ChassisPalette {
  primaryColor: number;
  primaryRoughness: number;
  primaryMetalness: number;
  secondaryColor: number;
  secondaryRoughness: number;
  secondaryMetalness: number;
  jointColor: number;
  jointRoughness: number;
  jointMetalness: number;
  accentColor: number;
  accentEmissive: number;
}

const CHASSIS_PALETTES: Record<Exclude<ChassisPreset, 'custom-glb'>, ChassisPalette> = {
  'rk900-cyberlife': {
    // Connor RK900 (skfb.ly/oRROK) - Detroit: Become Human CyberLife Android
    primaryColor: 0xf1f5f9,
    primaryRoughness: 0.34,
    primaryMetalness: 0.22,
    secondaryColor: 0x0f172a,
    secondaryRoughness: 0.45,
    secondaryMetalness: 0.28,
    jointColor: 0x334155,
    jointRoughness: 0.25,
    jointMetalness: 0.78,
    accentColor: 0x00e5ff,
    accentEmissive: 0x0099cc
  },
  'hybrid-iii': {
    // USA: Hybrid III / Boston Dynamics Atlas Safety Gold & Brushed Steel
    primaryColor: 0xdeb018,
    primaryRoughness: 0.32,
    primaryMetalness: 0.18,
    secondaryColor: 0x181c24,
    secondaryRoughness: 0.55,
    secondaryMetalness: 0.35,
    jointColor: 0x526075,
    jointRoughness: 0.22,
    jointMetalness: 0.85,
    accentColor: 0x00e5ff,
    accentEmissive: 0x006688
  },
  'optimus-titanium': {
    // USA: Tesla Optimus Gen-2 / Figure 02 Satin Titanium & Obsidian Carbon
    primaryColor: 0xe2e8f0,
    primaryRoughness: 0.22,
    primaryMetalness: 0.48,
    secondaryColor: 0x0f172a,
    secondaryRoughness: 0.4,
    secondaryMetalness: 0.68,
    jointColor: 0x94a3b8,
    jointRoughness: 0.18,
    jointMetalness: 0.92,
    accentColor: 0x38bdf8,
    accentEmissive: 0x0284c7
  },
  'unitree-g1': {
    // China: Unitree G1 / Fourier GR-2 Anodized Space Grey & Cyan LiDAR
    primaryColor: 0x475569,
    primaryRoughness: 0.28,
    primaryMetalness: 0.62,
    secondaryColor: 0x111827,
    secondaryRoughness: 0.45,
    secondaryMetalness: 0.5,
    jointColor: 0x1e293b,
    jointRoughness: 0.2,
    jointMetalness: 0.88,
    accentColor: 0x00e5ff,
    accentEmissive: 0x0088aa
  },
  'neura-4ne1': {
    // EU: Neura Robotics 4NE-1 / 1X NEO Alpine White, Soft Compliant Weave & Cognitive Amber
    primaryColor: 0xf8fafc,
    primaryRoughness: 0.35,
    primaryMetalness: 0.12,
    secondaryColor: 0x27272a,
    secondaryRoughness: 0.72,
    secondaryMetalness: 0.15,
    jointColor: 0x52525b,
    jointRoughness: 0.28,
    jointMetalness: 0.75,
    accentColor: 0xf59e0b,
    accentEmissive: 0xb45309
  },
  'figure-carbon': {
    // Stealth Matte Carbon & Copper Harmonic Drives
    primaryColor: 0x1e2430,
    primaryRoughness: 0.48,
    primaryMetalness: 0.42,
    secondaryColor: 0x0b0e14,
    secondaryRoughness: 0.65,
    secondaryMetalness: 0.3,
    jointColor: 0xd97706,
    jointRoughness: 0.2,
    jointMetalness: 0.88,
    accentColor: 0x10b981,
    accentEmissive: 0x047857
  }
};

/**
 * Dictionary mapping VRM 1.0/0.0, Mixamo, Sketchfab RK900 (Blender/Unreal/FBX), Ready Player Me,
 * and Unity bone names to our Canonical 54-Bone Humanoid Rig.
 */
const BONE_NAME_ALIASES: Array<[RegExp, CanonicalBoneName]> = [
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(hips|pelvis|root_pelvis)$/i, 'Hips'],
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(spine|spine_01|spine01)$/i, 'Spine'],
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(spine1|spine_02|spine02|chest)$/i, 'Chest'],
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(spine2|spine_03|spine03|upperchest)$/i, 'UpperChest'],
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(neck|neck_01)$/i, 'Neck'],
  [/^(mixamorig:?|j_bip_c_|bip01_|def_)?(head)$/i, 'Head'],

  [/^(mixamorig:?|j_bip_l_|def_)?(leftshoulder|l_clavicle|clavicle_l|shoulder_l)$/i, 'LeftShoulder'],
  [/^(mixamorig:?|j_bip_l_|def_)?(leftarm|leftupperarm|upperarm_l|l_upperarm)$/i, 'LeftUpperArm'],
  [/^(mixamorig:?|j_bip_l_|def_)?(leftforearm|leftlowerarm|lowerarm_l|forearm_l|l_forearm)$/i, 'LeftLowerArm'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthand|hand_l|l_hand)$/i, 'LeftHand'],

  [/^(mixamorig:?|j_bip_r_|def_)?(rightshoulder|r_clavicle|clavicle_r|shoulder_r)$/i, 'RightShoulder'],
  [/^(mixamorig:?|j_bip_r_|def_)?(rightarm|rightupperarm|upperarm_r|r_upperarm)$/i, 'RightUpperArm'],
  [/^(mixamorig:?|j_bip_r_|def_)?(rightforearm|rightlowerarm|lowerarm_r|forearm_r|r_forearm)$/i, 'RightLowerArm'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthand|hand_r|r_hand)$/i, 'RightHand'],

  // Right Hand Fingers
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandthumb1|thumb1_r|rightthumbproximal|thumb_01_r)$/i, 'RightThumbProximal'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandthumb2|thumb2_r|rightthumbintermediate|thumb_02_r)$/i, 'RightThumbIntermediate'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandthumb3|thumb3_r|rightthumbdistal|thumb_03_r)$/i, 'RightThumbDistal'],

  [/^(mixamorig:?|j_bip_r_|def_)?(righthandindex1|index1_r|rightindexproximal|index_01_r|f_index01_r)$/i, 'RightIndexProximal'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandindex2|index2_r|rightindexintermediate|index_02_r|f_index02_r)$/i, 'RightIndexIntermediate'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandindex3|index3_r|rightindexdistal|index_03_r|f_index03_r)$/i, 'RightIndexDistal'],

  [/^(mixamorig:?|j_bip_r_|def_)?(righthandmiddle1|middle1_r|rightmiddleproximal|middle_01_r|f_middle01_r)$/i, 'RightMiddleProximal'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandmiddle2|middle2_r|rightmiddleintermediate|middle_02_r|f_middle02_r)$/i, 'RightMiddleIntermediate'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandmiddle3|middle3_r|rightmiddledistal|middle_03_r|f_middle03_r)$/i, 'RightMiddleDistal'],

  [/^(mixamorig:?|j_bip_r_|def_)?(righthandring1|ring1_r|rightringproximal|ring_01_r|f_ring01_r)$/i, 'RightRingProximal'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandring2|ring2_r|rightringintermediate|ring_02_r|f_ring02_r)$/i, 'RightRingIntermediate'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandring3|ring3_r|rightringdistal|ring_03_r|f_ring03_r)$/i, 'RightRingDistal'],

  [/^(mixamorig:?|j_bip_r_|def_)?(righthandpinky1|pinky1_r|little1_r|rightpinkyproximal|pinky_01_r|f_pinky01_r)$/i, 'RightPinkyProximal'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandpinky2|pinky2_r|little2_r|rightpinkyintermediate|pinky_02_r|f_pinky02_r)$/i, 'RightPinkyIntermediate'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righthandpinky3|pinky3_r|little3_r|rightpinkydistal|pinky_03_r|f_pinky03_r)$/i, 'RightPinkyDistal'],

  // Left Hand Fingers
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandthumb1|thumb1_l|leftthumbproximal|thumb_01_l)$/i, 'LeftThumbProximal'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandthumb2|thumb2_l|leftthumbintermediate|thumb_02_l)$/i, 'LeftThumbIntermediate'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandthumb3|thumb3_l|leftthumbdistal|thumb_03_l)$/i, 'LeftThumbDistal'],

  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandindex1|index1_l|leftindexproximal|index_01_l|f_index01_l)$/i, 'LeftIndexProximal'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandindex2|index2_l|leftindexintermediate|index_02_l|f_index02_l)$/i, 'LeftIndexIntermediate'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandindex3|index3_l|leftindexdistal|index_03_l|f_index03_l)$/i, 'LeftIndexDistal'],

  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandmiddle1|middle1_l|leftmiddleproximal|middle_01_l|f_middle01_l)$/i, 'LeftMiddleProximal'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandmiddle2|middle2_l|leftmiddleintermediate|middle_02_l|f_middle02_l)$/i, 'LeftMiddleIntermediate'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandmiddle3|middle3_l|leftmiddledistal|middle_03_l|f_middle03_l)$/i, 'LeftMiddleDistal'],

  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandring1|ring1_l|leftringproximal|ring_01_l|f_ring01_l)$/i, 'LeftRingProximal'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandring2|ring2_l|leftringintermediate|ring_02_l|f_ring02_l)$/i, 'LeftRingIntermediate'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandring3|ring3_l|leftringdistal|ring_03_l|f_ring03_l)$/i, 'LeftRingDistal'],

  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandpinky1|pinky1_l|little1_l|leftpinkyproximal|pinky_01_l|f_pinky01_l)$/i, 'LeftPinkyProximal'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandpinky2|pinky2_l|little2_l|leftpinkyintermediate|pinky_02_l|f_pinky02_l)$/i, 'LeftPinkyIntermediate'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefthandpinky3|pinky3_r|little3_l|leftpinkydistal|pinky_03_l|f_pinky03_l)$/i, 'LeftPinkyDistal'],

  // Legs
  [/^(mixamorig:?|j_bip_l_|def_)?(leftupleg|leftupperleg|thigh_l|l_thigh)$/i, 'LeftUpperLeg'],
  [/^(mixamorig:?|j_bip_l_|def_)?(leftleg|leftlowerleg|calf_l|shin_l|l_calf)$/i, 'LeftLowerLeg'],
  [/^(mixamorig:?|j_bip_l_|def_)?(leftfoot|foot_l|l_foot)$/i, 'LeftFoot'],
  [/^(mixamorig:?|j_bip_l_|def_)?(lefttoebase|lefttoes|toeend_l|ball_l)$/i, 'LeftToes'],

  [/^(mixamorig:?|j_bip_r_|def_)?(rightupleg|rightupperleg|thigh_r|r_thigh)$/i, 'RightUpperLeg'],
  [/^(mixamorig:?|j_bip_r_|def_)?(rightleg|rightlowerleg|calf_r|shin_r|r_calf)$/i, 'RightLowerLeg'],
  [/^(mixamorig:?|j_bip_r_|def_)?(rightfoot|foot_r|r_foot)$/i, 'RightFoot'],
  [/^(mixamorig:?|j_bip_r_|def_)?(righttoebase|righttoes|toeend_r|ball_r)$/i, 'RightToes']
];

const _interpQ = new THREE.Quaternion();
const _breathEuler = new THREE.Euler();
const _breathQ = new THREE.Quaternion();
const _targetHipsPos = new THREE.Vector3();

/**
 * 54-Bone Articulated Humanoid Robotics Digital Twin + Connor RK900 CyberLife Android Customizer
 * Supports Sketchfab RK900 (skfb.ly/oRROK) modular costume customization & GLB/VRM retargeting.
 */
export class CrashTestDummy {
  scene: THREE.Scene;
  group: THREE.Group;
  proceduralRoot: THREE.Group;
  customModelRoot: THREE.Group | null = null;
  comMarker: THREE.Group;

  bones: Partial<Record<CanonicalBoneName, THREE.Object3D>> = {};
  proceduralBones: Partial<Record<CanonicalBoneName, THREE.Object3D>> = {};
  bindQuaternions: Partial<Record<CanonicalBoneName, THREE.Quaternion>> = {};
  currentQuaternions: Record<CanonicalBoneName, THREE.Quaternion>;

  fingertips: { left: THREE.Object3D[]; right: THREE.Object3D[] } = { left: [], right: [] };
  proceduralFingertips: { left: THREE.Object3D[]; right: THREE.Object3D[] } = { left: [], right: [] };

  primaryMat!: THREE.MeshStandardMaterial;
  secondaryMat!: THREE.MeshStandardMaterial;
  jointMat!: THREE.MeshStandardMaterial;
  accentMat!: THREE.MeshStandardMaterial;
  synthSkinMat!: THREE.MeshStandardMaterial;
  hairMat!: THREE.MeshStandardMaterial;

  // Modular RK900 Costume Groups for live toggling & customization
  rk900JacketMeshes: THREE.Object3D[] = [];
  rk900InsigniaMeshes: THREE.Object3D[] = [];
  rk900TempleLedGroup!: THREE.Group;
  rk900HeadFeatureMeshes: THREE.Object3D[] = [];
  robotVisorMeshes: THREE.Object3D[] = [];
  skinTargetMeshes: THREE.Mesh[] = [];

  activePreset: ChassisPreset = 'rk900-cyberlife';
  currentCostume: CostumeCustomization = { ...DEFAULT_RK900_COSTUME };
  baseHipsY = 0.96;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'HumanoidDigitalTwin_Root';

    this.proceduralRoot = new THREE.Group();
    this.proceduralRoot.name = 'Procedural54BoneRig';
    this.group.add(this.proceduralRoot);

    this.comMarker = new THREE.Group();
    this.comMarker.name = 'ZMP_CoM_GroundTelemetry';
    this.group.add(this.comMarker);

    this.currentQuaternions = {} as Record<CanonicalBoneName, THREE.Quaternion>;
    for (const bone of CANONICAL_BONES) {
      this.currentQuaternions[bone] = new THREE.Quaternion();
    }

    this.buildProceduralRig();
    this.buildZmpSupportTelemetry();
    this.setChassisPreset('rk900-cyberlife');
    this.applyCostumeCustomization(this.currentCostume);
    this.scene.add(this.group);
  }

  /**
   * Build 3D Ground Support Polygon & Center-of-Mass (CoM) Projection Marker (OmniH2O / WBC)
   */
  private buildZmpSupportTelemetry() {
    const ringGeo = new THREE.RingGeometry(0.23, 0.245, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const supportRing = new THREE.Mesh(ringGeo, ringMat);
    supportRing.position.y = 0.003;
    this.group.add(supportRing);

    const comDiscGeo = new THREE.RingGeometry(0.018, 0.032, 24);
    comDiscGeo.rotateX(-Math.PI / 2);
    const comDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const comDisc = new THREE.Mesh(comDiscGeo, comDiscMat);
    this.comMarker.add(comDisc);

    const comDotGeo = new THREE.CircleGeometry(0.008, 16);
    comDotGeo.rotateX(-Math.PI / 2);
    const comDot = new THREE.Mesh(comDotGeo, comDiscMat);
    this.comMarker.add(comDot);
    this.comMarker.position.set(0, 0.004, 0);
  }

  /**
   * Apply live RK900 / Custom GLB Costume Customization (Colors, LED, Skin vs Endoskeleton, Collar/Insignia)
   */
  applyCostumeCustomization(custom: CostumeCustomization) {
    this.currentCostume = { ...custom };

    // 1. Update Jacket / Primary Material
    this.primaryMat.color.set(custom.jacketColor);
    this.primaryMat.roughness = custom.fabricRoughness;
    this.primaryMat.metalness = custom.armorMetalness;

    // 2. Update Trim / Lapels / Trousers Material
    this.secondaryMat.color.set(custom.trimColor);
    this.secondaryMat.roughness = Math.min(1, custom.fabricRoughness + 0.12);
    this.secondaryMat.metalness = Math.max(0.1, custom.armorMetalness * 0.7);

    // 3. Update CyberLife LED & Triangle Insignia Emissive Material
    this.accentMat.color.set(custom.ledColor);
    this.accentMat.emissive.set(custom.ledColor);
    this.accentMat.emissiveIntensity = 0.85;

    // 4. Update Synthetic Dermis / Endoskeleton Mode (Head & Hands)
    switch (custom.skinMode) {
      case 'synth-porcelain':
        this.synthSkinMat.color.setHex(0xf3dfd3);
        this.synthSkinMat.roughness = 0.42;
        this.synthSkinMat.metalness = 0.06;
        break;
      case 'synth-warm':
        this.synthSkinMat.color.setHex(0xe2be9f);
        this.synthSkinMat.roughness = 0.45;
        this.synthSkinMat.metalness = 0.05;
        break;
      case 'exposed-white':
        this.synthSkinMat.color.setHex(0xf8fafc);
        this.synthSkinMat.roughness = 0.22;
        this.synthSkinMat.metalness = 0.55;
        break;
      case 'exposed-chrome':
        this.synthSkinMat.color.setHex(0xcbd5e1);
        this.synthSkinMat.roughness = 0.14;
        this.synthSkinMat.metalness = 0.92;
        break;
    }

    const isRk900Mode = this.activePreset === 'rk900-cyberlife';

    // 5. Toggle modular RK900 High-Collar Jacket, CyberLife Insignia & Temple LED
    for (const m of this.rk900JacketMeshes) {
      m.visible = isRk900Mode && custom.showHighCollarJacket;
    }
    for (const m of this.rk900InsigniaMeshes) {
      m.visible = isRk900Mode && custom.showCyberLifeInsignia;
    }
    if (this.rk900TempleLedGroup) {
      this.rk900TempleLedGroup.visible = isRk900Mode && custom.showTempleLed;
    }
    for (const m of this.rk900HeadFeatureMeshes) {
      m.visible = isRk900Mode;
    }
    for (const m of this.robotVisorMeshes) {
      m.visible = !isRk900Mode;
    }

    // Swap head/hand material between synthetic skin (in RK900 mode) and primary chassis (in industrial robot presets)
    for (const mesh of this.skinTargetMeshes) {
      mesh.material = isRk900Mode ? this.synthSkinMat : this.primaryMat;
    }

    // 6. If a custom .GLB / Sketchfab model is loaded, also apply live costume tinting to its meshes!
    if (this.customModelRoot && this.activePreset === 'custom-glb') {
      let meshIndex = 0;
      this.customModelRoot.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const matName = (
            (Array.isArray(mesh.material) ? mesh.material[0]?.name : mesh.material?.name) ||
            mesh.name ||
            ''
          ).toLowerCase();

          const applyToMat = (mat: THREE.Material) => {
            const std = mat as THREE.MeshStandardMaterial;
            if (!std.isMeshStandardMaterial) return;
            if (
              matName.includes('led') ||
              matName.includes('emissive') ||
              matName.includes('glow') ||
              matName.includes('cyber') ||
              matName.includes('triangle')
            ) {
              std.color.set(custom.ledColor);
              std.emissive.set(custom.ledColor);
              std.emissiveIntensity = 1.1;
            } else if (
              matName.includes('jacket') ||
              matName.includes('coat') ||
              matName.includes('shirt') ||
              matName.includes('suit') ||
              matName.includes('cloth') ||
              matName.includes('white') ||
              meshIndex === 0
            ) {
              std.color.set(custom.jacketColor);
              std.roughness = custom.fabricRoughness;
              std.metalness = custom.armorMetalness;
            } else if (
              matName.includes('pant') ||
              matName.includes('trouser') ||
              matName.includes('trim') ||
              matName.includes('collar') ||
              matName.includes('black')
            ) {
              std.color.set(custom.trimColor);
            }
          };

          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(applyToMat);
          } else if (mesh.material) {
            applyToMat(mesh.material);
          }
          meshIndex++;
        }
      });
    }
  }

  /**
   * Switch between procedural robotics chassis presets or RK900 CyberLife Android
   */
  setChassisPreset(preset: Exclude<ChassisPreset, 'custom-glb'>) {
    this.activePreset = preset;
    const pal = CHASSIS_PALETTES[preset];

    if (this.customModelRoot) {
      this.customModelRoot.visible = false;
    }
    this.proceduralRoot.visible = true;
    this.bones = { ...this.proceduralBones };
    this.fingertips = {
      left: [...this.proceduralFingertips.left],
      right: [...this.proceduralFingertips.right]
    };
    this.baseHipsY = 0.96;

    for (const bone of CANONICAL_BONES) {
      this.bindQuaternions[bone] = new THREE.Quaternion();
    }

    this.primaryMat.color.setHex(pal.primaryColor);
    this.primaryMat.roughness = pal.primaryRoughness;
    this.primaryMat.metalness = pal.primaryMetalness;

    this.secondaryMat.color.setHex(pal.secondaryColor);
    this.secondaryMat.roughness = pal.secondaryRoughness;
    this.secondaryMat.metalness = pal.secondaryMetalness;

    this.jointMat.color.setHex(pal.jointColor);
    this.jointMat.roughness = pal.jointRoughness;
    this.jointMat.metalness = pal.jointMetalness;

    this.accentMat.color.setHex(pal.accentColor);
    this.accentMat.emissive.setHex(pal.accentEmissive);

    if (preset === 'rk900-cyberlife') {
      this.applyCostumeCustomization(this.currentCostume);
    } else {
      // Hide RK900-specific tailored coat & facial hair features on industrial humanoid presets
      for (const m of this.rk900JacketMeshes) m.visible = false;
      for (const m of this.rk900InsigniaMeshes) m.visible = false;
      if (this.rk900TempleLedGroup) this.rk900TempleLedGroup.visible = false;
      for (const m of this.rk900HeadFeatureMeshes) m.visible = false;
      for (const m of this.robotVisorMeshes) m.visible = true;
      for (const mesh of this.skinTargetMeshes) {
        mesh.material = this.primaryMat;
      }
    }
  }

  /**
   * Load an external .glb / .gltf / .vrm humanoid model (such as Connor RK900 from Sketchfab skfb.ly/oRROK)
   * and auto-map its skeleton to our 54-DOF solver + live material customizer.
   */
  async loadCustomGLBOrVRM(fileOrUrl: File | string): Promise<{ mappedBonesCount: number; modelName: string }> {
    const loader = new GLTFLoader();
    const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    const modelName = typeof fileOrUrl === 'string' ? 'Connor RK900 (GLB)' : fileOrUrl.name;

    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      if (this.customModelRoot) {
        this.group.remove(this.customModelRoot);
      }

      const model = gltf.scene as THREE.Group;
      model.name = `CustomModel_${modelName}`;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 0.01) {
        const scale = 1.72 / size.y;
        model.scale.setScalar(scale);
      }
      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.y -= scaledBox.min.y;
      model.position.x -= (scaledBox.min.x + scaledBox.max.x) * 0.5;
      model.position.z -= (scaledBox.min.z + scaledBox.max.z) * 0.5;

      const mappedBones: Partial<Record<CanonicalBoneName, THREE.Object3D>> = {};
      const mappedBinds: Partial<Record<CanonicalBoneName, THREE.Quaternion>> = {};
      let mappedCount = 0;

      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Clone materials so live costume customization is non-destructive
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else if (mesh.material) {
            mesh.material = mesh.material.clone();
          }
        }

        if ((obj as THREE.Bone).isBone || obj.type === 'Bone' || obj.name) {
          const cleanName = obj.name.replace(/[\s._-]+/g, '');
          for (const [regex, canonical] of BONE_NAME_ALIASES) {
            if (regex.test(cleanName) || regex.test(obj.name)) {
              if (!mappedBones[canonical]) {
                mappedBones[canonical] = obj;
                mappedBinds[canonical] = obj.quaternion.clone();
                mappedCount++;
              }
              break;
            }
          }
        }
      });

      const leftTips: THREE.Object3D[] = [];
      const rightTips: THREE.Object3D[] = [];
      const digits: Array<'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky'> = [
        'Thumb',
        'Index',
        'Middle',
        'Ring',
        'Pinky'
      ];

      for (const d of digits) {
        const rDistal = mappedBones[`Right${d}Distal` as CanonicalBoneName] || mappedBones.RightHand;
        if (rDistal) {
          const tip = new THREE.Group();
          tip.position.set(0, -0.02, 0);
          rDistal.add(tip);
          rightTips.push(tip);
        }
        const lDistal = mappedBones[`Left${d}Distal` as CanonicalBoneName] || mappedBones.LeftHand;
        if (lDistal) {
          const tip = new THREE.Group();
          tip.position.set(0, -0.02, 0);
          lDistal.add(tip);
          leftTips.push(tip);
        }
      }

      this.customModelRoot = model;
      this.group.add(model);
      this.proceduralRoot.visible = false;
      this.activePreset = 'custom-glb';

      this.bones = mappedBones;
      this.bindQuaternions = mappedBinds;
      this.fingertips = {
        left: leftTips.length > 0 ? leftTips : this.proceduralFingertips.left,
        right: rightTips.length > 0 ? rightTips : this.proceduralFingertips.right
      };

      if (mappedBones.Hips) {
        this.baseHipsY = mappedBones.Hips.position.y;
      }

      return { mappedBonesCount: mappedCount, modelName };
    } finally {
      if (typeof fileOrUrl !== 'string') {
        URL.revokeObjectURL(url);
      }
    }
  }

  /**
   * Build the 54-Bone Procedural Humanoid Twin + Connor RK900 CyberLife Android Costume & Sculpt
   */
  private buildProceduralRig() {
    const pal = CHASSIS_PALETTES['rk900-cyberlife'];

    this.primaryMat = new THREE.MeshStandardMaterial({
      color: pal.primaryColor,
      roughness: pal.primaryRoughness,
      metalness: pal.primaryMetalness,
      name: 'TwinPrimaryArmor'
    });

    this.secondaryMat = new THREE.MeshStandardMaterial({
      color: pal.secondaryColor,
      roughness: pal.secondaryRoughness,
      metalness: pal.secondaryMetalness,
      name: 'TwinSecondaryChassis'
    });

    this.jointMat = new THREE.MeshStandardMaterial({
      color: pal.jointColor,
      roughness: pal.jointRoughness,
      metalness: pal.jointMetalness,
      name: 'TwinHarmonicJoint'
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: pal.accentColor,
      emissive: pal.accentEmissive,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.6,
      name: 'TwinTelemetryAccent'
    });

    this.synthSkinMat = new THREE.MeshStandardMaterial({
      color: 0xf3dfd3,
      roughness: 0.42,
      metalness: 0.06,
      name: 'RK900BiocomponentSkin'
    });

    this.hairMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.72,
      metalness: 0.08,
      name: 'RK900SculptedHair'
    });

    const createPart = (geom: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      return mesh;
    };

    const registerBone = (name: CanonicalBoneName, group: THREE.Group) => {
      group.name = name;
      this.proceduralBones[name] = group;
      this.bones[name] = group;
      this.bindQuaternions[name] = new THREE.Quaternion();
      return group;
    };

    // 1. HIPS / PELVIS + RK900 Coat Tails
    const hipsGroup = registerBone('Hips', new THREE.Group());
    hipsGroup.position.set(0, this.baseHipsY, 0);
    this.proceduralRoot.add(hipsGroup);

    const pelvisCore = createPart(new THREE.CylinderGeometry(0.135, 0.11, 0.14, 20), this.secondaryMat, 'PelvisCore');
    hipsGroup.add(pelvisCore);

    const pelvisBelt = createPart(new THREE.BoxGeometry(0.28, 0.055, 0.17), this.secondaryMat, 'PelvisArmorBelt');
    pelvisBelt.position.set(0, 0.035, 0);
    hipsGroup.add(pelvisBelt);

    // RK900 Tailored Coat Lower Side/Back Skirt Panels
    const coatSkirtL = createPart(new THREE.BoxGeometry(0.08, 0.22, 0.185), this.primaryMat, 'RK900CoatSkirtL');
    coatSkirtL.position.set(-0.115, -0.05, -0.005);
    coatSkirtL.rotation.z = 0.06;
    hipsGroup.add(coatSkirtL);
    this.rk900JacketMeshes.push(coatSkirtL);

    const coatSkirtR = createPart(new THREE.BoxGeometry(0.08, 0.22, 0.185), this.primaryMat, 'RK900CoatSkirtR');
    coatSkirtR.position.set(0.115, -0.05, -0.005);
    coatSkirtR.rotation.z = -0.06;
    hipsGroup.add(coatSkirtR);
    this.rk900JacketMeshes.push(coatSkirtR);

    const coatBackTail = createPart(new THREE.BoxGeometry(0.24, 0.24, 0.035), this.primaryMat, 'RK900CoatBackTail');
    coatBackTail.position.set(0, -0.06, -0.09);
    coatBackTail.rotation.x = -0.05;
    hipsGroup.add(coatBackTail);
    this.rk900JacketMeshes.push(coatBackTail);

    const hipPodL = createPart(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), this.jointMat, 'HipActuatorL');
    hipPodL.rotation.z = Math.PI / 2;
    hipPodL.position.set(-0.1, -0.04, 0);
    hipsGroup.add(hipPodL);

    const hipPodR = createPart(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), this.jointMat, 'HipActuatorR');
    hipPodR.rotation.z = Math.PI / 2;
    hipPodR.position.set(0.1, -0.04, 0);
    hipsGroup.add(hipPodR);

    // 2. SPINE -> CHEST -> UPPERCHEST (RK900 Tailored Jacket + CyberLife Insignia)
    const spineGroup = registerBone('Spine', new THREE.Group());
    spineGroup.position.set(0, 0.09, 0);
    hipsGroup.add(spineGroup);

    const lumbarColumn = createPart(new THREE.CylinderGeometry(0.105, 0.115, 0.12, 16), this.secondaryMat, 'LumbarCol');
    lumbarColumn.position.set(0, 0.05, 0);
    spineGroup.add(lumbarColumn);

    const lumbarRing = createPart(new THREE.CylinderGeometry(0.122, 0.12, 0.1, 20), this.primaryMat, 'LumbarWaistCoat');
    lumbarRing.position.set(0, 0.055, 0);
    spineGroup.add(lumbarRing);

    const chestGroup = registerBone('Chest', new THREE.Group());
    chestGroup.position.set(0, 0.11, 0);
    spineGroup.add(chestGroup);

    const lowerThorax = createPart(new THREE.BoxGeometry(0.275, 0.135, 0.18), this.primaryMat, 'LowerThorax');
    lowerThorax.position.set(0, 0.06, 0);
    chestGroup.add(lowerThorax);

    // RK900 Vertical Black Center Zip/Placket Trim
    const centerPlacket = createPart(new THREE.BoxGeometry(0.055, 0.14, 0.186), this.secondaryMat, 'RK900CenterPlacket');
    centerPlacket.position.set(0, 0.06, 0.002);
    chestGroup.add(centerPlacket);
    this.rk900JacketMeshes.push(centerPlacket);

    const upperChestGroup = registerBone('UpperChest', new THREE.Group());
    upperChestGroup.position.set(0, 0.12, 0);
    chestGroup.add(upperChestGroup);

    const upperThorax = createPart(new THREE.BoxGeometry(0.32, 0.16, 0.195), this.primaryMat, 'UpperThorax');
    upperThorax.position.set(0, 0.07, 0);
    upperChestGroup.add(upperThorax);

    const sternumPlate = createPart(new THREE.BoxGeometry(0.13, 0.155, 0.203), this.secondaryMat, 'SternumPlate');
    sternumPlate.position.set(0, 0.072, 0);
    upperChestGroup.add(sternumPlate);

    // RK900 Tailored Angled Lapel Panels & High Standing Collar
    const lapelLeft = createPart(new THREE.BoxGeometry(0.085, 0.155, 0.018), this.secondaryMat, 'RK900LapelL');
    lapelLeft.position.set(-0.068, 0.075, 0.098);
    lapelLeft.rotation.z = -0.18;
    upperChestGroup.add(lapelLeft);
    this.rk900JacketMeshes.push(lapelLeft);

    const lapelRight = createPart(new THREE.BoxGeometry(0.085, 0.155, 0.018), this.secondaryMat, 'RK900LapelR');
    lapelRight.position.set(0.068, 0.075, 0.098);
    lapelRight.rotation.z = 0.18;
    upperChestGroup.add(lapelRight);
    this.rk900JacketMeshes.push(lapelRight);

    // RK900 Iconic High Stiff White-and-Obsidian Standing Collar
    const highCollarOuter = createPart(
      new THREE.CylinderGeometry(0.088, 0.095, 0.072, 20, 1, true, Math.PI * 0.22, Math.PI * 1.56),
      this.primaryMat,
      'RK900HighCollarOuter'
    );
    highCollarOuter.position.set(0, 0.175, -0.005);
    upperChestGroup.add(highCollarOuter);
    this.rk900JacketMeshes.push(highCollarOuter);

    const highCollarInner = createPart(
      new THREE.CylinderGeometry(0.083, 0.09, 0.068, 20, 1, true, Math.PI * 0.22, Math.PI * 1.56),
      this.secondaryMat,
      'RK900HighCollarInner'
    );
    highCollarInner.position.set(0, 0.175, -0.005);
    upperChestGroup.add(highCollarInner);
    this.rk900JacketMeshes.push(highCollarInner);

    // CyberLife Inverted glowing geometric triangles on Left & Right Chest + Back
    const triGeo = new THREE.ConeGeometry(0.032, 0.052, 3);
    triGeo.rotateX(Math.PI); // Point downward like the CyberLife triangle
    triGeo.scale(1.0, 1.0, 0.18);

    const cyberTriRightChest = createPart(triGeo, this.accentMat, 'RK900ChestTriangle');
    cyberTriRightChest.position.set(-0.095, 0.095, 0.102);
    upperChestGroup.add(cyberTriRightChest);
    this.rk900InsigniaMeshes.push(cyberTriRightChest);

    const cyberBeatStripL = createPart(new THREE.BoxGeometry(0.09, 0.01, 0.01), this.accentMat, 'RK900ChestStripL');
    cyberBeatStripL.position.set(0.095, 0.105, 0.101);
    upperChestGroup.add(cyberBeatStripL);
    this.rk900InsigniaMeshes.push(cyberBeatStripL);

    const cyberBackTri = createPart(triGeo.clone().scale(1.8, 1.8, 1), this.accentMat, 'RK900BackTriangle');
    cyberBackTri.position.set(0, 0.08, -0.102);
    upperChestGroup.add(cyberBackTri);
    this.rk900InsigniaMeshes.push(cyberBackTri);

    // Standard Robot Core Ring (visible when switching to Atlas/Optimus/Unitree presets)
    const coreRing = createPart(new THREE.CylinderGeometry(0.046, 0.046, 0.008, 24), this.accentMat, 'ChestCore');
    coreRing.rotation.x = Math.PI / 2;
    coreRing.position.set(0, 0.075, 0.103);
    upperChestGroup.add(coreRing);
    this.robotVisorMeshes.push(coreRing);

    // 3. NECK & HEAD (Connor RK900 Android Head + Glowing Right-Temple LED Ring)
    const neckGroup = registerBone('Neck', new THREE.Group());
    neckGroup.position.set(0, 0.16, 0);
    upperChestGroup.add(neckGroup);

    const neckColumn = createPart(new THREE.CylinderGeometry(0.052, 0.06, 0.085, 16), this.synthSkinMat, 'NeckColumn');
    neckColumn.position.set(0, 0.04, 0);
    neckGroup.add(neckColumn);
    this.skinTargetMeshes.push(neckColumn);

    const headGroup = registerBone('Head', new THREE.Group());
    headGroup.position.set(0, 0.08, 0);
    neckGroup.add(headGroup);

    const cranium = createPart(new THREE.SphereGeometry(0.106, 28, 24), this.synthSkinMat, 'Cranium');
    cranium.scale.set(0.96, 1.22, 1.04);
    cranium.position.set(0, 0.11, 0);
    headGroup.add(cranium);
    this.skinTargetMeshes.push(cranium);

    // Connor RK900 Sculpted Hair Cap & Side-Swept Fringe
    const hairCrown = createPart(
      new THREE.SphereGeometry(0.111, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
      this.hairMat,
      'RK900HairCrown'
    );
    hairCrown.scale.set(0.98, 1.18, 1.07);
    hairCrown.position.set(0, 0.118, -0.006);
    hairCrown.rotation.x = -0.18;
    headGroup.add(hairCrown);
    this.rk900HeadFeatureMeshes.push(hairCrown);

    const hairFringe = createPart(new THREE.BoxGeometry(0.135, 0.036, 0.055), this.hairMat, 'RK900HairFringe');
    hairFringe.position.set(0.012, 0.195, 0.082);
    hairFringe.rotation.set(0.15, 0.08, -0.12);
    headGroup.add(hairFringe);
    this.rk900HeadFeatureMeshes.push(hairFringe);

    // Subtle RK900 Android Eyes & Brow Line
    const eyeLeft = createPart(new THREE.SphereGeometry(0.012, 12, 12), this.secondaryMat, 'RK900EyeL');
    eyeLeft.position.set(0.036, 0.12, 0.098);
    headGroup.add(eyeLeft);
    this.rk900HeadFeatureMeshes.push(eyeLeft);

    const eyeRight = createPart(new THREE.SphereGeometry(0.012, 12, 12), this.secondaryMat, 'RK900EyeR');
    eyeRight.position.set(-0.036, 0.12, 0.098);
    headGroup.add(eyeRight);
    this.rk900HeadFeatureMeshes.push(eyeRight);

    const eyePupilL = createPart(new THREE.SphereGeometry(0.006, 10, 10), this.accentMat, 'RK900IrisL');
    eyePupilL.position.set(0.036, 0.12, 0.106);
    headGroup.add(eyePupilL);
    this.rk900HeadFeatureMeshes.push(eyePupilL);

    const eyePupilR = createPart(new THREE.SphereGeometry(0.006, 10, 10), this.accentMat, 'RK900IrisR');
    eyePupilR.position.set(-0.036, 0.12, 0.106);
    headGroup.add(eyePupilR);
    this.rk900HeadFeatureMeshes.push(eyePupilR);

    // Iconic CyberLife Right-Temple Glowing LED Ring (In character's right side = -X in our rig or +X; let's place on right temple -0.098 and +0.098 so it's visible from all angles, with primary prominent ring on right temple)
    this.rk900TempleLedGroup = new THREE.Group();
    this.rk900TempleLedGroup.name = 'RK900TempleLedGroup';
    const ledTorusGeo = new THREE.TorusGeometry(0.016, 0.0038, 12, 28);
    const templeLedR = createPart(ledTorusGeo, this.accentMat, 'RK900TempleLedRight');
    templeLedR.rotation.y = Math.PI / 2;
    templeLedR.position.set(-0.098, 0.138, 0.038);
    this.rk900TempleLedGroup.add(templeLedR);

    const templeLedL = createPart(ledTorusGeo, this.accentMat, 'RK900TempleLedLeft');
    templeLedL.rotation.y = Math.PI / 2;
    templeLedL.position.set(0.098, 0.138, 0.038);
    this.rk900TempleLedGroup.add(templeLedL);
    headGroup.add(this.rk900TempleLedGroup);

    // Industrial Robot Optical Visor (shown when in Optimus / Atlas / Unitree / Neura preset)
    const visor = createPart(new THREE.BoxGeometry(0.165, 0.065, 0.08), this.secondaryMat, 'OpticalVisor');
    visor.position.set(0, 0.115, 0.068);
    headGroup.add(visor);
    this.robotVisorMeshes.push(visor);

    const visorStrip = createPart(new THREE.BoxGeometry(0.14, 0.012, 0.084), this.accentMat, 'VisorSensorStrip');
    visorStrip.position.set(0, 0.118, 0.068);
    headGroup.add(visorStrip);
    this.robotVisorMeshes.push(visorStrip);

    const earEncoderL = createPart(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 16), this.jointMat, 'EarEncoderL');
    earEncoderL.rotation.z = Math.PI / 2;
    earEncoderL.position.set(-0.104, 0.108, 0);
    headGroup.add(earEncoderL);

    const earEncoderR = createPart(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 16), this.jointMat, 'EarEncoderR');
    earEncoderR.rotation.z = Math.PI / 2;
    earEncoderR.position.set(0.104, 0.108, 0);
    headGroup.add(earEncoderR);

    // 4. ARMS, CLAVICLES & 3-PHALANGE HANDS
    this.buildProceduralArm('Right', 1, upperChestGroup);
    this.buildProceduralArm('Left', -1, upperChestGroup);

    // 5. LEGS, KNEES, FEET & TOES
    this.buildProceduralLeg('Right', 1, hipsGroup);
    this.buildProceduralLeg('Left', -1, hipsGroup);
  }

  private buildProceduralArm(side: 'Right' | 'Left', sign: number, upperChestGroup: THREE.Group) {
    const register = (suffix: string, grp: THREE.Group) => {
      const canonical = `${side}${suffix}` as CanonicalBoneName;
      grp.name = canonical;
      this.proceduralBones[canonical] = grp;
      this.bones[canonical] = grp;
      this.bindQuaternions[canonical] = new THREE.Quaternion();
      return grp;
    };

    const shoulderGroup = register('Shoulder', new THREE.Group());
    shoulderGroup.position.set(sign * 0.15, 0.125, 0);
    upperChestGroup.add(shoulderGroup);

    const clavicleBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.042, 0.065), this.secondaryMat);
    clavicleBar.position.set(sign * 0.03, 0, 0);
    clavicleBar.castShadow = true;
    shoulderGroup.add(clavicleBar);

    const upperArmGroup = register('UpperArm', new THREE.Group());
    upperArmGroup.position.set(sign * 0.06, 0, 0);
    shoulderGroup.add(upperArmGroup);

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16), this.primaryMat);
    upperArmGroup.add(shoulderBall);

    const deltoidCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.047, 0.095, 16), this.primaryMat);
    deltoidCuff.position.set(0, -0.055, 0);
    deltoidCuff.castShadow = true;
    upperArmGroup.add(deltoidCuff);

    const humerusShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.25, 16), this.primaryMat);
    humerusShaft.position.set(0, -0.135, 0);
    humerusShaft.castShadow = true;
    upperArmGroup.add(humerusShaft);

    const bicepShell = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.14, 0.072), this.primaryMat);
    bicepShell.position.set(0, -0.135, 0.005);
    bicepShell.castShadow = true;
    upperArmGroup.add(bicepShell);

    // RK900 Glowing CyberLife Sleeve Armband Strip
    const cyberArmband = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.048, 0.018, 20), this.accentMat);
    cyberArmband.position.set(0, -0.16, 0);
    upperArmGroup.add(cyberArmband);
    this.rk900InsigniaMeshes.push(cyberArmband);

    const lowerArmGroup = register('LowerArm', new THREE.Group());
    lowerArmGroup.position.set(0, -0.26, 0);
    upperArmGroup.add(lowerArmGroup);

    const elbowDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.065, 18), this.jointMat);
    elbowDrum.rotation.z = Math.PI / 2;
    lowerArmGroup.add(elbowDrum);

    const forearmShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.23, 16), this.primaryMat);
    forearmShaft.position.set(0, -0.12, 0);
    forearmShaft.castShadow = true;
    lowerArmGroup.add(forearmShaft);

    // RK900 Obsidian Forearm Cuff Trim
    const forearmCasing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.036, 0.055, 16), this.secondaryMat);
    forearmCasing.position.set(0, -0.2, 0);
    forearmCasing.castShadow = true;
    lowerArmGroup.add(forearmCasing);

    const handGroup = register('Hand', new THREE.Group());
    handGroup.position.set(0, -0.24, 0);
    lowerArmGroup.add(handGroup);

    const wristGimbal = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 14), this.jointMat);
    handGroup.add(wristGimbal);

    const palmChassis = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.078, 0.026), this.synthSkinMat);
    palmChassis.position.set(0, -0.042, 0);
    palmChassis.castShadow = true;
    handGroup.add(palmChassis);
    this.skinTargetMeshes.push(palmChassis);

    const dorsalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.064, 0.012), this.synthSkinMat);
    dorsalPlate.position.set(0, -0.04, 0.012);
    handGroup.add(dorsalPlate);
    this.skinTargetMeshes.push(dorsalPlate);

    const fingerSpecs: Array<{
      name: 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';
      xOffset: number;
      yOffset: number;
      lenScale: number;
    }> = [
      { name: 'Thumb', xOffset: sign > 0 ? -0.038 : 0.038, yOffset: -0.045, lenScale: 0.82 },
      { name: 'Index', xOffset: sign > 0 ? -0.024 : 0.024, yOffset: -0.08, lenScale: 1.0 },
      { name: 'Middle', xOffset: 0.0, yOffset: -0.082, lenScale: 1.08 },
      { name: 'Ring', xOffset: sign > 0 ? 0.022 : -0.022, yOffset: -0.08, lenScale: 0.98 },
      { name: 'Pinky', xOffset: sign > 0 ? 0.038 : -0.038, yOffset: -0.076, lenScale: 0.82 }
    ];

    const sideKey = side === 'Right' ? 'right' : 'left';

    for (const f of fingerSpecs) {
      const l1 = 0.026 * f.lenScale;
      const l2 = 0.021 * f.lenScale;
      const l3 = 0.017 * f.lenScale;

      const proxGroup = register(`${f.name}Proximal`, new THREE.Group());
      proxGroup.position.set(f.xOffset, f.yOffset, 0);
      handGroup.add(proxGroup);

      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 10), this.jointMat);
      proxGroup.add(knuckle);

      const proxMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0062, l1, 10), this.synthSkinMat);
      proxMesh.position.set(0, -l1 * 0.5, 0);
      proxGroup.add(proxMesh);
      this.skinTargetMeshes.push(proxMesh);

      const interGroup = register(`${f.name}Intermediate`, new THREE.Group());
      interGroup.position.set(0, -l1, 0);
      proxGroup.add(interGroup);

      const pipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), this.jointMat);
      interGroup.add(pipJoint);

      const interMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0055, l2, 10), this.synthSkinMat);
      interMesh.position.set(0, -l2 * 0.5, 0);
      interGroup.add(interMesh);
      this.skinTargetMeshes.push(interMesh);

      const distGroup = register(`${f.name}Distal`, new THREE.Group());
      distGroup.position.set(0, -l2, 0);
      interGroup.add(distGroup);

      const dipMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0054, 0.0046, l3, 10), this.synthSkinMat);
      dipMesh.position.set(0, -l3 * 0.5, 0);
      distGroup.add(dipMesh);
      this.skinTargetMeshes.push(dipMesh);

      const tipPad = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 10, 10), this.accentMat);
      tipPad.position.set(0, -l3, -0.002);
      distGroup.add(tipPad);

      const tipNode = new THREE.Group();
      tipNode.position.set(0, -l3 - 0.003, 0);
      tipNode.name = `${side}${f.name}Tip`;
      distGroup.add(tipNode);

      this.proceduralFingertips[sideKey].push(tipNode);
      this.fingertips[sideKey].push(tipNode);
    }
  }

  private buildProceduralLeg(side: 'Right' | 'Left', sign: number, hipsGroup: THREE.Group) {
    const register = (suffix: string, grp: THREE.Group) => {
      const canonical = `${side}${suffix}` as CanonicalBoneName;
      grp.name = canonical;
      this.proceduralBones[canonical] = grp;
      this.bones[canonical] = grp;
      this.bindQuaternions[canonical] = new THREE.Quaternion();
      return grp;
    };

    const upperLeg = register('UpperLeg', new THREE.Group());
    upperLeg.position.set(sign * 0.095, -0.06, 0);
    hipsGroup.add(upperLeg);

    // RK900 Dark Tailored Trousers on Lower Body
    const thighShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.052, 0.42, 18), this.secondaryMat);
    thighShaft.position.set(0, -0.21, 0);
    thighShaft.castShadow = true;
    upperLeg.add(thighShaft);

    const thighArmor = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.11), this.secondaryMat);
    thighArmor.position.set(0, -0.19, 0.008);
    thighArmor.castShadow = true;
    upperLeg.add(thighArmor);

    const lowerLeg = register('LowerLeg', new THREE.Group());
    lowerLeg.position.set(0, -0.42, 0);
    upperLeg.add(lowerLeg);

    const kneeDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.075, 18), this.jointMat);
    kneeDrum.rotation.z = Math.PI / 2;
    lowerLeg.add(kneeDrum);

    const shinShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.42, 18), this.secondaryMat);
    shinShaft.position.set(0, -0.21, 0);
    shinShaft.castShadow = true;
    lowerLeg.add(shinShaft);

    const footGroup = register('Foot', new THREE.Group());
    footGroup.position.set(0, -0.42, 0);
    lowerLeg.add(footGroup);

    const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 14), this.jointMat);
    footGroup.add(ankleJoint);

    const heelChassis = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.055, 0.14), this.secondaryMat);
    heelChassis.position.set(0, -0.032, 0.02);
    heelChassis.castShadow = true;
    footGroup.add(heelChassis);

    const toesGroup = register('Toes', new THREE.Group());
    toesGroup.position.set(0, -0.045, 0.09);
    footGroup.add(toesGroup);

    const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.032, 0.075), this.secondaryMat);
    toeCap.position.set(0, 0, 0.035);
    toeCap.castShadow = true;
    toesGroup.add(toeCap);
  }

  /**
   * Frame-rate-independent 60-120Hz render-loop interpolation
   * Steps all 54 canonical bones and CoM ground marker toward TargetPoseBuffer.
   */
  updateFrame(dt: number, targetBuffer: TargetPoseBuffer, config: KinematicsConfig, elapsedSec: number) {
    const clampedDt = Math.min(dt, 0.1);
    const alpha = 1.0 - Math.exp(-config.dampingLambda * clampedDt);
    const fingerAlpha = 1.0 - Math.exp(-(config.dampingLambda * 1.35) * clampedDt);

    for (const boneName of CANONICAL_BONES) {
      const boneObj = this.bones[boneName];
      if (!boneObj) continue;

      const isFinger =
        boneName.includes('Thumb') ||
        boneName.includes('Index') ||
        boneName.includes('Middle') ||
        boneName.includes('Ring') ||
        boneName.includes('Pinky');

      const curQ = this.currentQuaternions[boneName];
      const targetQ = targetBuffer.quaternions[boneName];
      curQ.slerp(targetQ, isFinger ? fingerAlpha : alpha);

      _interpQ.copy(curQ);
      if (config.enableIdleBreathing) {
        if (boneName === 'Chest' || boneName === 'UpperChest') {
          const breathPitch = Math.sin(elapsedSec * 2.1) * 0.014;
          _breathEuler.set(breathPitch, 0, 0, 'XYZ');
          _breathQ.setFromEuler(_breathEuler);
          _interpQ.multiply(_breathQ);
        }
      }

      const bindQ = this.bindQuaternions[boneName];
      if (bindQ) {
        boneObj.quaternion.copy(bindQ).multiply(_interpQ);
      } else {
        boneObj.quaternion.copy(_interpQ);
      }
    }

    const hipsBone = this.bones.Hips;
    if (hipsBone) {
      _targetHipsPos.set(
        targetBuffer.hipsPositionOffset.x,
        this.baseHipsY + targetBuffer.hipsPositionOffset.y,
        targetBuffer.hipsPositionOffset.z
      );
      hipsBone.position.lerp(_targetHipsPos, alpha);
    }

    // Subtle CyberLife LED ring telemetry pulse on RK900
    if (this.activePreset === 'rk900-cyberlife' && this.currentCostume.showTempleLed) {
      this.accentMat.emissiveIntensity = 0.75 + Math.sin(elapsedSec * 3.2) * 0.22;
    }

    // Update 3D Ground Center-of-Mass (CoM) marker position
    this.comMarker.position.lerp(targetBuffer.comGroundProjection, alpha);
  }

  resetPose(targetBuffer?: TargetPoseBuffer) {
    if (targetBuffer) {
      targetBuffer.resetToNeutral();
    }
    for (const boneName of CANONICAL_BONES) {
      this.currentQuaternions[boneName].identity();
      const boneObj = this.bones[boneName];
      const bindQ = this.bindQuaternions[boneName];
      if (boneObj) {
        if (bindQ) boneObj.quaternion.copy(bindQ);
        else boneObj.quaternion.identity();
      }
    }
    if (this.bones.Hips) {
      this.bones.Hips.position.set(0, this.baseHipsY, 0);
    }
    this.comMarker.position.set(0, 0.004, 0);
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
  }
}
