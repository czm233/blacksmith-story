import * as THREE from 'three';
import gsap from 'gsap';
import { WeaponAssembler } from './WeaponAssembler';
import { BlueprintDef, LightingConfig, MaterialDef, SlotType } from '../types/game';
import { DEFAULT_LIGHTING_CONFIG, MATERIALS } from '../data/constants';
import { sound } from '../utils/audio';

export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  text: string;
  isCrit: boolean;
  color: string;
}

export type SceneInteractionMode = 'fps' | 'forging';

export class ForgeScene3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private assembler: WeaponAssembler;

  // 场景核心模式：'fps' 第一人称工坊漫游 或 'forging' 打铁特写视角
  public mode: SceneInteractionMode = 'fps';

  // 场景主要物体
  private weaponGroup: THREE.Group | null = null;
  private workpieceGroup: THREE.Group = new THREE.Group();
  private hotBilletMesh: THREE.Mesh | null = null;
  private ghostBlueprintGroup: THREE.Group | null = null;

  private anvilGroup: THREE.Group = new THREE.Group();
  private dummyGroup: THREE.Group = new THREE.Group();
  
  // 右手持锤系统 (打铁视角使用)
  private rightArmGroup: THREE.Group = new THREE.Group();

  // 第一人称手持武器视图模型 (FPS 漫游手持视角)
  private heldWeaponViewmodelGroup: THREE.Group = new THREE.Group();
  public isHoldingWeapon: boolean = false;
  private isSlashing: boolean = false;
  private currentBlueprint: BlueprintDef | null = null;

  // 粒子系统
  private sparkParticles: THREE.Points | null = null;
  private sparkPositions: Float32Array = new Float32Array(300);
  private sparkVelocities: THREE.Vector3[] = [];

  private steamParticles: THREE.Points | null = null;
  private steamPositions: Float32Array = new Float32Array(150);
  private steamVelocities: THREE.Vector3[] = [];

  // 灯光系统实例
  private ambientLight!: THREE.AmbientLight;
  private spotLight!: THREE.SpotLight;
  private rimLight!: THREE.DirectionalLight;
  private fireLight!: THREE.PointLight;
  private fillLight!: THREE.DirectionalLight;

  // 第一人称漫游控制状态 (FPS)
  private playerPos = new THREE.Vector3(0.85, 1.45, 0.0); // 眼睛高度 1.45m
  private yaw: number = Math.PI / 2; // 水平朝向 (默认面对铁砧宽侧)
  private pitch: number = -0.15; // 垂直俯仰
  private keysPressed: Set<string> = new Set();
  public isPointerLocked: boolean = false;

  // 准星射线拾取检测
  private raycaster = new THREE.Raycaster();
  private currentInteractTarget: 'anvil' | 'weapon' | 'dummy' | null = null;

  // 打击状态
  private isHammerStriking: boolean = false;
  private animationFrameId: number | null = null;

  // 外部回调接口
  private onDamagePopup: ((dmg: DamageNumber) => void) | null = null;
  private onPromptChange: ((prompt: string | null) => void) | null = null;
  private onEnterForgeModeCallback: (() => void) | null = null;
  private onWeaponPickupCallback: (() => void) | null = null;
  private onWeaponDropCallback: (() => void) | null = null;
  private onMeleeAttackCallback: (() => { damage: number; isCrit: boolean }) | null = null;

  constructor(container: HTMLElement, initialLighting: LightingConfig = DEFAULT_LIGHTING_CONFIG) {
    this.container = container;
    this.assembler = new WeaponAssembler();

    // 1. 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x13131c);
    this.scene.fog = new THREE.FogExp2(0x13131c, 0.08);

    // 2. 初始化相机 (第一人称视点)
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
    this.camera.rotation.order = 'YXZ';
    this.updateFPSCamera();
    this.scene.add(this.camera);

    // 3. 构建手持武器 Viewmodel (随相机移动)
    this.buildHeldWeaponViewmodel();

    // 4. 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = initialLighting.exposure;
    container.appendChild(this.renderer.domElement);

    // 5. 构建环境灯光与道具
    this.setupLighting(initialLighting);
    this.buildWorkshopEnvironment();
    this.buildAnvil();
    this.buildWorkpieceElements();
    this.buildTrainingDummy();
    this.buildRightArmAndHammer();
    this.setupSparkParticleSystem();
    this.setupSteamParticleSystem();

    // 6. 事件监听与主循环
    this.setupEventListeners();
    this.startRenderLoop();
  }

  // 绑定外部回调
  public setDamagePopupCallback(cb: (dmg: DamageNumber) => void) {
    this.onDamagePopup = cb;
  }
  public setPromptCallback(cb: (prompt: string | null) => void) {
    this.onPromptChange = cb;
  }
  public setEnterForgeModeCallback(cb: () => void) {
    this.onEnterForgeModeCallback = cb;
  }
  public setWeaponPickupCallback(cb: () => void) {
    this.onWeaponPickupCallback = cb;
  }
  public setWeaponDropCallback(cb: () => void) {
    this.onWeaponDropCallback = cb;
  }
  public setMeleeAttackCallback(cb: () => { damage: number; isCrit: boolean }) {
    this.onMeleeAttackCallback = cb;
  }

  // ==================== 第一人称持剑 Viewmodel ====================
  private buildHeldWeaponViewmodel() {
    this.heldWeaponViewmodelGroup = new THREE.Group();
    this.heldWeaponViewmodelGroup.name = 'HeldWeaponViewmodel';

    // 初始就位在视线右下侧
    this.heldWeaponViewmodelGroup.position.set(0.26, -0.25, -0.48);
    this.heldWeaponViewmodelGroup.rotation.set(0.2, -0.35, 0.45);
    this.heldWeaponViewmodelGroup.visible = false;
    this.camera.add(this.heldWeaponViewmodelGroup);
  }

  // ==================== 灯光系统与实时调节 ====================
  private setupLighting(config: LightingConfig) {
    this.ambientLight = new THREE.AmbientLight(0xfff8ee, config.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.fireLight = new THREE.PointLight(0xff7722, config.fireIntensity, 10);
    this.fireLight.position.set(-1.2, 0.4, -0.6);
    this.fireLight.castShadow = true;
    this.scene.add(this.fireLight);

    this.spotLight = new THREE.SpotLight(0xfff2df, config.spotIntensity);
    this.spotLight.position.set(0.6, 4.2, 1.8);
    this.spotLight.angle = Math.PI / 3.8;
    this.spotLight.penumbra = 0.35;
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 1024;
    this.spotLight.shadow.mapSize.height = 1024;
    this.scene.add(this.spotLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, config.rimIntensity);
    this.rimLight.position.set(-2.5, 3.2, -2.5);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    this.fillLight.position.set(2, 2.5, 2.5);
    this.scene.add(this.fillLight);
  }

  public applyLighting(config: LightingConfig) {
    if (this.ambientLight) this.ambientLight.intensity = config.ambientIntensity;
    if (this.spotLight) this.spotLight.intensity = config.spotIntensity;
    if (this.fireLight) this.fireLight.intensity = config.fireIntensity;
    if (this.rimLight) this.rimLight.intensity = config.rimIntensity;
    if (this.renderer) this.renderer.toneMappingExposure = config.exposure;

    const bgVal = Math.max(0.04, 0.16 * (1 - config.bgDarkness * 0.7));
    const bgColor = new THREE.Color(bgVal, bgVal * 1.05, bgVal * 1.3);
    this.scene.background = bgColor;
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color = bgColor;
      (this.scene.fog as THREE.FogExp2).density = 0.05 + config.bgDarkness * 0.1;
    }
  }

  // ==================== 工坊环境 ====================
  private buildWorkshopEnvironment() {
    const floorGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.2, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1c28,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.7;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ringGeo = new THREE.RingGeometry(0.7, 0.76, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.59;
    this.scene.add(ring);
  }

  // ==================== 铁砧构建 (长轴沿 Z，宽侧在 X) ====================
  private buildAnvil() {
    this.anvilGroup = new THREE.Group();
    this.anvilGroup.name = 'AnvilInteractive';
    this.anvilGroup.position.set(0, -0.6, 0);

    // 垫木桩底座
    const stumpGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.4, 16);
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x452b1f, roughness: 0.9, metalness: 0.05 });
    const stump = new THREE.Mesh(stumpGeo, stumpMat);
    stump.position.y = 0.2;
    stump.receiveShadow = true;
    this.anvilGroup.add(stump);

    // 铁砧主体
    const anvilMat = new THREE.MeshStandardMaterial({ color: 0x2e3038, roughness: 0.35, metalness: 0.85 });
    const baseGeo = new THREE.BoxGeometry(0.32, 0.12, 0.5);
    const base = new THREE.Mesh(baseGeo, anvilMat);
    base.position.y = 0.46;
    base.castShadow = true;
    this.anvilGroup.add(base);

    // 砧面 (工作台面，顶部高约 -0.02m)
    const topGeo = new THREE.BoxGeometry(0.26, 0.08, 0.58);
    const top = new THREE.Mesh(topGeo, anvilMat);
    top.position.y = 0.54;
    top.castShadow = true;
    this.anvilGroup.add(top);

    // 砧角 (尖圆锥在 +Z 端)
    const hornGeo = new THREE.ConeGeometry(0.08, 0.22, 12);
    hornGeo.rotateX(-Math.PI / 2);
    const horn = new THREE.Mesh(hornGeo, anvilMat);
    horn.position.set(0, 0.54, 0.38);
    this.anvilGroup.add(horn);

    this.scene.add(this.anvilGroup);
  }

  // ==================== 烧红粗胚构建 (横卧在铁砧台面) ====================
  private buildWorkpieceElements() {
    this.workpieceGroup = new THREE.Group();
    this.workpieceGroup.name = 'WorkpieceGroup';
    this.workpieceGroup.position.set(0, -0.012, 0);

    const billetGeo = new THREE.BoxGeometry(0.065, 0.02, 0.42);
    const billetMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0xff3b00,
      emissiveIntensity: 2.6,
    });
    this.hotBilletMesh = new THREE.Mesh(billetGeo, billetMat);
    this.hotBilletMesh.castShadow = true;
    this.workpieceGroup.add(this.hotBilletMesh);

    const glowGeo = new THREE.PlaneGeometry(0.18, 0.48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const glowPlane = new THREE.Mesh(glowGeo, glowMat);
    glowPlane.rotation.x = -Math.PI / 2;
    glowPlane.position.y = 0.002;
    this.workpieceGroup.add(glowPlane);

    this.scene.add(this.workpieceGroup);
  }

  // ==================== 试刀木桩假人 ====================
  private buildTrainingDummy() {
    this.dummyGroup = new THREE.Group();
    this.dummyGroup.name = 'TrainingDummy';
    this.dummyGroup.position.set(1.1, -0.6, -0.2);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, metalness: 0.1 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9, metalness: 0.05 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9, metalness: 0.05 });

    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.5, 12);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 0.75;
    post.castShadow = true;
    this.dummyGroup.add(post);

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 10);
    armGeo.rotateZ(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.position.y = 1.05;
    arm.castShadow = true;
    this.dummyGroup.add(arm);

    const headGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const head = new THREE.Mesh(headGeo, strawMat);
    head.position.y = 1.55;
    head.castShadow = true;
    this.dummyGroup.add(head);

    const wrapGeo = new THREE.TorusGeometry(0.165, 0.03, 8, 16);
    wrapGeo.rotateX(Math.PI / 2);
    const wrap = new THREE.Mesh(wrapGeo, clothMat);
    wrap.position.y = 1.56;
    this.dummyGroup.add(wrap);

    const targetGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16);
    targetGeo.rotateX(Math.PI / 2);
    const target = new THREE.Mesh(targetGeo, clothMat);
    target.position.set(0, 0.95, 0.12);
    this.dummyGroup.add(target);

    const bullseyeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.025, 16);
    bullseyeGeo.rotateX(Math.PI / 2);
    const bullseye = new THREE.Mesh(bullseyeGeo, strawMat);
    bullseye.position.set(0, 0.95, 0.122);
    this.dummyGroup.add(bullseye);

    this.scene.add(this.dummyGroup);
  }

  // ==================== 右手持锤系统 (打铁特写视角) ====================
  private buildRightArmAndHammer() {
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.name = 'RightArmAndHammer';

    // 1. 小臂 (皮护腕工匠手臂，位于屏幕右侧 Z < 0)
    const forearmGeo = new THREE.CylinderGeometry(0.036, 0.046, 0.32, 12);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x482b18,
      roughness: 0.85,
      metalness: 0.1
    });
    const forearm = new THREE.Mesh(forearmGeo, armMat);
    forearm.rotation.z = Math.PI / 3;
    forearm.rotation.y = Math.PI / 6;
    forearm.position.set(0.16, -0.06, -0.08);
    this.rightArmGroup.add(forearm);

    // 2. 拳套
    const fistGeo = new THREE.BoxGeometry(0.06, 0.065, 0.085);
    const fistMat = new THREE.MeshStandardMaterial({
      color: 0x5c3822,
      roughness: 0.8,
      metalness: 0.15
    });
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.position.set(0.04, 0.02, -0.02);
    this.rightArmGroup.add(fist);

    // 3. 锤柄
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.017, 0.44, 10);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.75 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = -Math.PI / 4;
    handle.rotation.z = -Math.PI / 12;
    handle.position.set(0.04, 0.06, -0.04);
    this.rightArmGroup.add(handle);

    // 4. 重型精铸方锤头
    const headGeo = new THREE.BoxGeometry(0.09, 0.08, 0.15);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x272b33,
      roughness: 0.3,
      metalness: 0.92
    });
    const hammerHeadMesh = new THREE.Mesh(headGeo, headMat);
    hammerHeadMesh.castShadow = true;
    hammerHeadMesh.position.set(0.04, 0.22, -0.15);
    this.rightArmGroup.add(hammerHeadMesh);

    // 初始位置在右侧
    this.rightArmGroup.position.set(0.24, 0.22, -0.22);
    this.rightArmGroup.rotation.set(0.3, 0.35, -0.25);
    this.rightArmGroup.visible = false; // 仅在打铁视角显现
    this.scene.add(this.rightArmGroup);
  }

  // ==================== 火花与蒸汽粒子系统 ====================
  private setupSparkParticleSystem() {
    const count = 100;
    this.sparkPositions = new Float32Array(count * 3);
    this.sparkVelocities = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffaa22,
      size: 0.045,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    this.sparkParticles = new THREE.Points(geo, mat);
    this.scene.add(this.sparkParticles);

    for (let i = 0; i < count; i++) {
      this.sparkVelocities.push(new THREE.Vector3());
    }
  }

  private setupSteamParticleSystem() {
    const count = 50;
    this.steamPositions = new Float32Array(count * 3);
    this.steamVelocities = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.steamPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xddeeff,
      size: 0.12,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending
    });

    this.steamParticles = new THREE.Points(geo, mat);
    this.scene.add(this.steamParticles);

    for (let i = 0; i < count; i++) {
      this.steamVelocities.push(new THREE.Vector3());
    }
  }

  public triggerSparkBurst(origin: THREE.Vector3, count: number = 50, colorHex: number = 0xffaa22) {
    if (!this.sparkParticles) return;

    const positions = this.sparkParticles.geometry.attributes.position.array as Float32Array;
    (this.sparkParticles.material as THREE.PointsMaterial).color.setHex(colorHex);
    (this.sparkParticles.material as THREE.PointsMaterial).opacity = 1.0;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI / 2.1);
      const speed = 1.6 + Math.random() * 2.8;

      this.sparkVelocities[i].set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed
      );
    }

    this.sparkParticles.geometry.attributes.position.needsUpdate = true;

    gsap.to(this.sparkParticles.material, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out'
    });
  }

  public triggerSteamBurst(origin: THREE.Vector3) {
    if (!this.steamParticles) return;

    const positions = this.steamParticles.geometry.attributes.position.array as Float32Array;
    (this.steamParticles.material as THREE.PointsMaterial).opacity = 0.85;

    for (let i = 0; i < 50; i++) {
      positions[i * 3] = origin.x + (Math.random() - 0.5) * 0.15;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.15;

      this.steamVelocities[i].set(
        (Math.random() - 0.5) * 0.4,
        0.8 + Math.random() * 0.9,
        (Math.random() - 0.5) * 0.4
      );
    }

    this.steamParticles.geometry.attributes.position.needsUpdate = true;

    gsap.to(this.steamParticles.material, {
      opacity: 0,
      duration: 1.1,
      ease: 'power1.out'
    });
  }

  // ==================== 模式切换：FPS 漫游 ⇄ 打铁特写 ====================

  /**
   * 切换至打铁特写视角 (拿锤子)
   */
  public enterForgingMode(blueprint: BlueprintDef) {
    this.mode = 'forging';
    this.currentBlueprint = blueprint;

    // 如果手持武器，先放下到铁砧上
    if (this.isHoldingWeapon) {
      this.dropWeapon(true);
    }

    this.rightArmGroup.visible = true;

    // 镜头平滑运镜到铁砧宽侧工作面近景
    gsap.to(this.camera.position, {
      x: 0.72,
      y: 0.35,
      z: 0.0,
      duration: 0.65,
      ease: 'power2.inOut'
    });

    const targetRot = new THREE.Euler(-0.45, Math.PI / 2, 0, 'YXZ');
    gsap.to(this.camera.rotation, {
      x: targetRot.x,
      y: targetRot.y,
      z: targetRot.z,
      duration: 0.65,
      ease: 'power2.inOut'
    });

    if (this.onEnterForgeModeCallback) {
      this.onEnterForgeModeCallback();
    }
  }

  /**
   * 退出打铁特写，返回第一人称自由漫游
   */
  public exitForgingMode() {
    this.mode = 'fps';
    this.rightArmGroup.visible = false;

    // 镜头平滑返回站立视角
    gsap.to(this.camera.position, {
      x: this.playerPos.x,
      y: this.playerPos.y,
      z: this.playerPos.z,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => {
        this.updateFPSCamera();
      }
    });
  }

  // ==================== 武器捡起与丢弃 (左键拾起 / 右键松手丢弃) ====================

  /**
   * 按左键捡起武器
   */
  public pickupWeapon() {
    if (this.isHoldingWeapon || !this.currentBlueprint) return;

    sound.playClick();
    this.isHoldingWeapon = true;

    // 隐藏铁砧/地面上的静态武器
    if (this.weaponGroup) {
      this.weaponGroup.visible = false;
    }

    // 在相机上挂载第一人称 Viewmodel 武器
    this.rebuildHeldWeaponViewmodel(this.currentBlueprint);
    this.heldWeaponViewmodelGroup.visible = true;

    // 抓起武器进场微弹簧
    this.heldWeaponViewmodelGroup.position.set(0.26, -0.4, -0.48);
    gsap.to(this.heldWeaponViewmodelGroup.position, {
      y: -0.25,
      duration: 0.35,
      ease: 'back.out(1.5)'
    });

    if (this.onWeaponPickupCallback) {
      this.onWeaponPickupCallback();
    }
  }

  /**
   * 按右键松手扔掉武器
   */
  public dropWeapon(placeOnAnvil: boolean = false) {
    if (!this.isHoldingWeapon) return;

    sound.playClick();
    this.isHoldingWeapon = false;
    this.heldWeaponViewmodelGroup.visible = false;

    // 如果在铁砧附近，整齐放回铁砧；否则丢在身前地面
    if (this.weaponGroup) {
      this.weaponGroup.visible = true;

      if (placeOnAnvil || this.playerPos.distanceTo(new THREE.Vector3(0, 0, 0)) < 1.8) {
        // 放回铁砧横卧位 (手柄在左，剑刃在右)
        this.weaponGroup.rotation.set(-Math.PI / 2, 0, 0);
        this.weaponGroup.position.set(0, -0.015, 0.15);
      } else {
        // 丢在玩家身前地面
        const fwd = this.getCameraForwardFlat();
        this.weaponGroup.rotation.set(-Math.PI / 2, Math.random() * 0.4, 0);
        this.weaponGroup.position.set(
          this.playerPos.x + fwd.x * 0.9,
          -0.68,
          this.playerPos.z + fwd.z * 0.9
        );
      }
    }

    if (this.onWeaponDropCallback) {
      this.onWeaponDropCallback();
    }
  }

  /**
   * 重构第一人称手持武器 Viewmodel
   */
  private rebuildHeldWeaponViewmodel(blueprint: BlueprintDef) {
    while (this.heldWeaponViewmodelGroup.children.length > 0) {
      this.heldWeaponViewmodelGroup.remove(this.heldWeaponViewmodelGroup.children[0]);
    }

    const meshGroup = this.assembler.assembleWeapon(blueprint, {}, false);
    // 缩放到适合第一人称握持的大小
    meshGroup.scale.set(0.7, 0.7, 0.7);
    this.heldWeaponViewmodelGroup.add(meshGroup);
  }

  // ==================== 挥剑攻击木桩 (第一人称左键斩击) ====================
  public swingWeaponAttack() {
    if (!this.isHoldingWeapon || this.isSlashing) return;
    this.isSlashing = true;

    // 第一人称快速斜切斩击 (GSAP)
    const tl = gsap.timeline({
      onComplete: () => {
        this.isSlashing = false;
      }
    });

    // 1. 蓄力微拉
    tl.to(this.heldWeaponViewmodelGroup.position, {
      x: 0.32,
      y: -0.18,
      z: -0.4,
      duration: 0.08,
      ease: 'power1.out'
    })
    .to(this.heldWeaponViewmodelGroup.rotation, {
      x: 0.4,
      y: -0.1,
      z: 0.65,
      duration: 0.08,
      ease: 'power1.out'
    }, '<')
    // 2. 闪电斜向破空横斩
    .to(this.heldWeaponViewmodelGroup.position, {
      x: -0.15,
      y: -0.22,
      z: -0.52,
      duration: 0.1,
      ease: 'power3.in',
      onComplete: () => {
        sound.playSlashHit(false);
        this.checkMeleeDummyHit();
      }
    })
    .to(this.heldWeaponViewmodelGroup.rotation, {
      x: -0.6,
      y: 0.6,
      z: -0.9,
      duration: 0.1,
      ease: 'power3.in'
    }, '<')
    // 3. 收招回位
    .to(this.heldWeaponViewmodelGroup.position, {
      x: 0.26,
      y: -0.25,
      z: -0.48,
      duration: 0.22,
      ease: 'back.out(1.4)'
    }, '+=0.06')
    .to(this.heldWeaponViewmodelGroup.rotation, {
      x: 0.2,
      y: -0.35,
      z: 0.45,
      duration: 0.22,
      ease: 'back.out(1.4)'
    }, '<');
  }

  /**
   * 检测第一人称斩击是否命中木桩
   */
  private checkMeleeDummyHit() {
    // 检查玩家与木桩距离
    const dummyWorldPos = new THREE.Vector3(1.1, 0.4, -0.2);
    const dist = this.playerPos.distanceTo(dummyWorldPos);

    if (dist < 2.5) {
      // 准星朝向木桩
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const toDummy = dummyWorldPos.clone().sub(this.camera.position).normalize();
      const dot = dir.dot(toDummy);

      if (dot > 0.65) {
        // 成功砍中木桩！
        const isCrit = Math.random() < 0.25;
        const damageResult = this.onMeleeAttackCallback ? this.onMeleeAttackCallback() : { damage: 85, isCrit };

        sound.playSlashHit(damageResult.isCrit);
        this.triggerSparkBurst(dummyWorldPos, damageResult.isCrit ? 65 : 35, damageResult.isCrit ? 0xff3b00 : 0xf59e0b);

        // 木桩剧烈弹性晃动
        gsap.fromTo(this.dummyGroup.rotation,
          { z: damageResult.isCrit ? -0.45 : -0.25, x: 0.15 },
          { z: 0, x: 0, duration: 0.85, ease: 'elastic.out(1.2, 0.25)' }
        );

        // 计算屏幕跳字
        if (this.onDamagePopup) {
          const screenPos = dummyWorldPos.clone().project(this.camera);
          const halfWidth = this.container.clientWidth / 2;
          const halfHeight = this.container.clientHeight / 2;
          const screenX = screenPos.x * halfWidth + halfWidth;
          const screenY = -screenPos.y * halfHeight + halfHeight;

          this.onDamagePopup({
            id: Math.random().toString(36).substring(2, 9),
            x: screenX,
            y: screenY,
            text: damageResult.isCrit ? `💥 暴击! ${damageResult.damage}` : `⚔️ 命中 ${damageResult.damage}`,
            isCrit: damageResult.isCrit,
            color: damageResult.isCrit ? '#ef4444' : '#fbbf24'
          });
        }
      }
    }
  }

  // ==================== 模版与渐进式锻造成型 ====================
  public displayWorkpieceTemplate(blueprint: BlueprintDef) {
    this.currentBlueprint = blueprint;

    if (this.weaponGroup) {
      this.scene.remove(this.weaponGroup);
      this.weaponGroup = null;
    }

    this.workpieceGroup.visible = true;
    if (this.hotBilletMesh) {
      this.hotBilletMesh.scale.set(1, 1, 1);
      (this.hotBilletMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6;
    }

    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    // 横卧在铁砧上
    this.ghostBlueprintGroup = this.assembler.assembleWeapon(blueprint, {}, true);
    this.ghostBlueprintGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.38
        });
      }
    });

    this.ghostBlueprintGroup.rotation.set(-Math.PI / 2, 0, 0);
    this.ghostBlueprintGroup.position.set(0, 0.015, 0.15);
    this.ghostBlueprintGroup.scale.set(0.9, 0.9, 0.9);
    this.scene.add(this.ghostBlueprintGroup);
  }

  public updateForgingProgress(progress: number, _blueprint: BlueprintDef) {
    const p = Math.max(0, Math.min(1, progress));

    if (this.hotBilletMesh) {
      const sx = 1 + p * 0.7;
      const sy = Math.max(0.25, 1 - p * 0.65);
      const sz = 1 + p * 1.5;
      this.hotBilletMesh.scale.set(sx, sy, sz);

      const mat = this.hotBilletMesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(p > 0.8 ? 0xd97706 : 0xff3b00);
      mat.emissiveIntensity = 2.6 + Math.sin(Date.now() * 0.01) * 0.6;
    }

    if (this.ghostBlueprintGroup) {
      const ghostOpacity = Math.max(0.12, 0.42 * (1 - p * 0.55));
      this.ghostBlueprintGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          (child.material as THREE.MeshBasicMaterial).opacity = ghostOpacity;
          if (p > 0.5) {
            (child.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
          }
        }
      });
      this.ghostBlueprintGroup.position.y = 0.015 - p * 0.02;
    }
  }

  public quenchAndReveal(blueprint: BlueprintDef, slotMaterials: Partial<Record<SlotType, MaterialDef>> = {}) {
    this.workpieceGroup.visible = false;
    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    sound.playQuenchSteam();
    this.triggerSteamBurst(new THREE.Vector3(0, -0.01, 0));
    this.triggerSparkBurst(new THREE.Vector3(0, 0.02, 0), 45, 0xffffff);

    this.displayWeapon(blueprint, slotMaterials);
  }

  public displayWeapon(blueprint: BlueprintDef, slotMaterials: Partial<Record<SlotType, MaterialDef>> = {}) {
    this.currentBlueprint = blueprint;
    this.workpieceGroup.visible = false;
    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    if (this.weaponGroup) {
      this.scene.remove(this.weaponGroup);
      this.weaponGroup = null;
    }

    this.weaponGroup = this.assembler.assembleWeapon(blueprint, slotMaterials, false);
    // 横卧在铁砧上，手柄在左 (+Z)，剑身在右 (-Z)
    this.weaponGroup.rotation.set(-Math.PI / 2, 0, 0);
    this.weaponGroup.position.set(0, -0.015, 0.15);
    this.scene.add(this.weaponGroup);

    this.weaponGroup.scale.set(0.1, 0.1, 0.1);
    gsap.to(this.weaponGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.5,
      ease: 'back.out(1.5)'
    });
  }

  // ==================== 右手持锤打铁敲击 (按一下敲一锤) ====================
  public triggerHammerTap(isPerfect: boolean = false) {
    if (this.isHammerStriking || this.mode !== 'forging') return;
    this.isHammerStriking = true;

    const anvilHitPos = new THREE.Vector3(0, -0.01, -0.02);

    gsap.timeline({
      onComplete: () => {
        this.isHammerStriking = false;
      }
    })
    .to(this.rightArmGroup.position, {
      x: 0.08,
      y: 0.06,
      z: -0.06,
      duration: 0.07,
      ease: 'power4.in',
      onComplete: () => {
        this.triggerSparkBurst(anvilHitPos, isPerfect ? 65 : 40, isPerfect ? 0xffea00 : 0xff5500);

        if (this.hotBilletMesh) {
          const mat = this.hotBilletMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 4.8;
          gsap.to(mat, { emissiveIntensity: 2.6, duration: 0.18 });
        }

        // 镜头微幅物理震颤
        gsap.fromTo(this.camera.position,
          { y: 0.35 + (Math.random() - 0.5) * 0.015 },
          { y: 0.35, duration: 0.12, ease: 'rough' }
        );
      }
    })
    .to(this.rightArmGroup.rotation, {
      x: -0.15,
      y: 0.12,
      z: 0.15,
      duration: 0.07,
      ease: 'power4.in'
    }, '<')
    .to(this.rightArmGroup.position, {
      x: 0.24,
      y: 0.22,
      z: -0.22,
      duration: 0.13,
      ease: 'power2.out'
    }, '+=0.02')
    .to(this.rightArmGroup.rotation, {
      x: 0.3,
      y: 0.35,
      z: -0.25,
      duration: 0.13,
      ease: 'power2.out'
    }, '<');
  }

  // ==================== 第一人称漫游与事件处理 ====================
  private updateFPSCamera() {
    this.camera.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private getCameraForwardFlat(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  private getCameraRightFlat(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  public requestPointerLock() {
    this.container.requestPointerLock();
  }

  // 左键点击处理
  private handleLeftClick() {
    if (this.mode === 'forging') {
      return; // 打铁模式下由打铁小游戏组件处理单次敲打
    }

    // 漫游模式下：
    // 1. 如果瞄准铁砧 -> 切换成打铁视角
    if (this.currentInteractTarget === 'anvil' && this.currentBlueprint) {
      this.enterForgingMode(this.currentBlueprint);
      return;
    }

    // 2. 如果瞄准武器且未手持 -> 捡起武器
    if (this.currentInteractTarget === 'weapon' && !this.isHoldingWeapon) {
      this.pickupWeapon();
      return;
    }

    // 3. 如果手持武器 -> 挥剑斩击 (若近身瞄准木桩则造成伤害)
    if (this.isHoldingWeapon) {
      this.swingWeaponAttack();
      return;
    }
  }

  // 右键点击处理 (松手扔掉武器)
  private handleRightClick() {
    if (this.mode === 'fps' && this.isHoldingWeapon) {
      this.dropWeapon(false);
    }
  }

  private setupEventListeners() {
    const dom = this.renderer.domElement;

    // 点击请求 Pointer Lock
    dom.addEventListener('click', () => {
      if (this.mode === 'fps' && !this.isPointerLocked) {
        dom.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === dom;
    });

    // 鼠标移动视线
    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'fps' && this.isPointerLocked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch - e.movementY * 0.0022));
        this.updateFPSCamera();
      }
    });

    // 鼠标按键
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.handleLeftClick();
      } else if (e.button === 2) {
        e.preventDefault();
        this.handleRightClick();
      }
    });

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // 键盘 WASD 移动
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'fps') {
        this.keysPressed.add(e.code);

        // 按 E 快捷捡起武器
        if (e.code === 'KeyE') {
          if (!this.isHoldingWeapon && this.currentInteractTarget === 'weapon') {
            this.pickupWeapon();
          } else if (this.currentInteractTarget === 'anvil' && this.currentBlueprint) {
            this.enterForgingMode(this.currentBlueprint);
          }
        }

        // 按 G 快捷丢下武器
        if (e.code === 'KeyG' && this.isHoldingWeapon) {
          this.dropWeapon(false);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // ==================== 渲染与物理主循环 ====================
  private startRenderLoop() {
    let clock = new THREE.Clock();

    const loop = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 1. 第一人称移动 (WASD)
      if (this.mode === 'fps') {
        const moveSpeed = 3.2 * delta;
        const fwd = this.getCameraForwardFlat();
        const right = this.getCameraRightFlat();
        const moveDelta = new THREE.Vector3();

        if (this.keysPressed.has('KeyW')) moveDelta.add(fwd);
        if (this.keysPressed.has('KeyS')) moveDelta.sub(fwd);
        if (this.keysPressed.has('KeyD')) moveDelta.add(right);
        if (this.keysPressed.has('KeyA')) moveDelta.sub(right);

        if (moveDelta.lengthSq() > 0) {
          moveDelta.normalize().multiplyScalar(moveSpeed);
          this.playerPos.add(moveDelta);

          // 圆形工坊围栏碰撞边界
          const distFromCenter = Math.sqrt(this.playerPos.x * this.playerPos.x + this.playerPos.z * this.playerPos.z);
          if (distFromCenter > 4.2) {
            this.playerPos.x = (this.playerPos.x / distFromCenter) * 4.2;
            this.playerPos.z = (this.playerPos.z / distFromCenter) * 4.2;
          }

          // 走路轻微视线与手部颠簸 (Headbob & Weapon sway)
          const bob = Math.sin(elapsedTime * 10) * 0.008;
          this.playerPos.y = 1.45 + Math.abs(bob);

          if (this.isHoldingWeapon && !this.isSlashing) {
            this.heldWeaponViewmodelGroup.position.y = -0.25 + bob * 0.8;
            this.heldWeaponViewmodelGroup.position.x = 0.26 + Math.cos(elapsedTime * 5) * 0.005;
          }
        }

        this.updateFPSCamera();

        // 2. 准星射线检测交互物 (Raycast interaction)
        this.updateCrosshairRaycast();
      }

      // 3. 粒子系统更新
      if (this.sparkParticles && (this.sparkParticles.material as THREE.PointsMaterial).opacity > 0) {
        const positions = this.sparkParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.sparkVelocities.length; i++) {
          const vel = this.sparkVelocities[i];
          positions[i * 3] += vel.x * delta;
          positions[i * 3 + 1] += vel.y * delta;
          positions[i * 3 + 2] += vel.z * delta;

          vel.y -= 7.5 * delta;
        }
        this.sparkParticles.geometry.attributes.position.needsUpdate = true;
      }

      if (this.steamParticles && (this.steamParticles.material as THREE.PointsMaterial).opacity > 0) {
        const positions = this.steamParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.steamVelocities.length; i++) {
          const vel = this.steamVelocities[i];
          positions[i * 3] += vel.x * delta;
          positions[i * 3 + 1] += vel.y * delta;
          positions[i * 3 + 2] += vel.z * delta;
        }
        this.steamParticles.geometry.attributes.position.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * 射线检测中心十字准星所指向的对象
   */
  private updateCrosshairRaycast() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const checkObjects: THREE.Object3D[] = [];
    if (this.anvilGroup) checkObjects.push(this.anvilGroup);
    if (this.weaponGroup && this.weaponGroup.visible) checkObjects.push(this.weaponGroup);
    if (this.dummyGroup) checkObjects.push(this.dummyGroup);

    const intersects = this.raycaster.intersectObjects(checkObjects, true);

    let newTarget: 'anvil' | 'weapon' | 'dummy' | null = null;
    let promptText: string | null = null;

    if (intersects.length > 0) {
      const firstHit = intersects[0];
      if (firstHit.distance < 3.2) {
        let cur: THREE.Object3D | null = firstHit.object;
        while (cur && cur.parent && cur !== this.scene) {
          if (cur === this.anvilGroup) {
            newTarget = 'anvil';
            break;
          }
          if (cur === this.weaponGroup) {
            newTarget = 'weapon';
            break;
          }
          if (cur === this.dummyGroup) {
            newTarget = 'dummy';
            break;
          }
          cur = cur.parent;
        }
      }
    }

    this.currentInteractTarget = newTarget;

    if (newTarget === 'anvil') {
      promptText = '⚒️ [左键点击铁砧] 切换打铁视角';
    } else if (newTarget === 'weapon' && !this.isHoldingWeapon) {
      promptText = `✋ [左键] 拾起 ${this.currentBlueprint?.name || '武器'}`;
    } else if (newTarget === 'dummy' && this.isHoldingWeapon) {
      promptText = '⚔️ [左键] 挥击木桩假人';
    } else if (this.isHoldingWeapon) {
      promptText = '⚔️ [左键] 挥砍 | 🖐️ [右键] 松手扔掉武器';
    }

    if (this.onPromptChange) {
      this.onPromptChange(promptText);
    }
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
