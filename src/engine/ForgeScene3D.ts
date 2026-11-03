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

export class ForgeScene3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private assembler: WeaponAssembler;

  // 场景物体
  private weaponGroup: THREE.Group | null = null;
  private workpieceGroup: THREE.Group = new THREE.Group();
  private hotBilletMesh: THREE.Mesh | null = null;
  private ghostBlueprintGroup: THREE.Group | null = null;

  private anvilGroup: THREE.Group = new THREE.Group();
  private dummyGroup: THREE.Group = new THREE.Group();
  
  // 右手持锤系统 (右手臂 + 拳头 + 铁锤)
  private rightArmGroup: THREE.Group = new THREE.Group();
  private hammerHeadMesh: THREE.Mesh | null = null;

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

  // 交互与视角状态 (默认站在铁砧宽的一侧: theta ≈ PI/2)
  private isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private cameraAngle = { theta: Math.PI / 2, phi: 1.05, radius: 1.05 };
  private cameraLookTarget = new THREE.Vector3(0, -0.015, 0);
  public autoRotate: boolean = false;
  private showSockets: boolean = false;
  private animationFrameId: number | null = null;

  // 打击状态
  private isHammerStriking: boolean = false;

  // 回调
  private onDamagePopup: ((dmg: DamageNumber) => void) | null = null;

  constructor(container: HTMLElement, initialLighting: LightingConfig = DEFAULT_LIGHTING_CONFIG) {
    this.container = container;
    this.assembler = new WeaponAssembler();

    // 1. 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x13131c);
    this.scene.fog = new THREE.FogExp2(0x13131c, 0.08);

    // 2. 初始化相机
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.updateCameraPosition();

    // 3. 初始化渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = initialLighting.exposure;
    container.appendChild(this.renderer.domElement);

    // 4. 构建环境灯光与道具
    this.setupLighting(initialLighting);
    this.buildWorkshopEnvironment();
    this.buildAnvil();
    this.buildWorkpieceElements();
    this.buildTrainingDummy();
    this.buildRightArmAndHammer();
    this.setupSparkParticleSystem();
    this.setupSteamParticleSystem();

    // 5. 事件监听
    this.setupEventListeners();
    this.startRenderLoop();
  }

  public setDamagePopupCallback(cb: (dmg: DamageNumber) => void) {
    this.onDamagePopup = cb;
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

    // 砧面 (工作台面，顶部高约 -0.02m，长 0.58m 沿 Z，宽 0.26m 沿 X)
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
    // 铁砧顶面实际高度在 y = -0.02m，粗胚横卧其上
    this.workpieceGroup.position.set(0, -0.012, 0);

    // 1. 横卧长条金属粗胚 (Hot Billet，长轴沿 Z 延展)
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

    // 2. 粗胚底部炽热反光
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

  // ==================== 右手持锤系统 (右手臂 + 拳套 + 锻造方锤) ====================
  private buildRightArmAndHammer() {
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.name = 'RightArmAndHammer';

    // 1. 小臂 (皮护腕工匠手臂)
    const forearmGeo = new THREE.CylinderGeometry(0.036, 0.046, 0.32, 12);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x482b18,
      roughness: 0.85,
      metalness: 0.1
    });
    const forearm = new THREE.Mesh(forearmGeo, armMat);
    forearm.rotation.z = Math.PI / 3;
    forearm.rotation.y = -Math.PI / 6;
    forearm.position.set(0.16, -0.06, 0.08);
    this.rightArmGroup.add(forearm);

    // 2. 握持铁锤的手部拳套 (Gloved Fist)
    const fistGeo = new THREE.BoxGeometry(0.06, 0.065, 0.085);
    const fistMat = new THREE.MeshStandardMaterial({
      color: 0x5c3822,
      roughness: 0.8,
      metalness: 0.15
    });
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.position.set(0.04, 0.02, 0.02);
    this.rightArmGroup.add(fist);

    // 3. 锤柄 (白蜡木坚韧长柄，被拳头紧握)
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.017, 0.44, 10);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.75 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 4;
    handle.rotation.z = -Math.PI / 12;
    handle.position.set(0.04, 0.06, 0.04);
    this.rightArmGroup.add(handle);

    // 4. 重型精铸方锤头 (Hammerhead)
    const headGeo = new THREE.BoxGeometry(0.09, 0.08, 0.15);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x272b33,
      roughness: 0.3,
      metalness: 0.92
    });
    this.hammerHeadMesh = new THREE.Mesh(headGeo, headMat);
    this.hammerHeadMesh.castShadow = true;
    this.hammerHeadMesh.position.set(0.04, 0.22, 0.15);
    this.rightArmGroup.add(this.hammerHeadMesh);

    // 待命准备姿态：位于视线右前方，斜向上举起
    this.rightArmGroup.position.set(0.24, 0.22, 0.18);
    this.rightArmGroup.rotation.set(-0.3, 0.35, 0.25);
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

  // ==================== 人的视角：站在铁砧宽的一侧 ====================

  /**
   * 打造聚焦视角：人站在铁砧宽的一侧 (+X 侧)，近距离俯视横卧在铁砧上的粗胚与武器
   */
  public focusAnvil() {
    this.autoRotate = false;
    // theta = Math.PI / 2 (直对宽侧), phi = 1.05 (俯视约 30 度), radius = 0.92m
    gsap.to(this.cameraAngle, {
      theta: Math.PI / 2,
      phi: 1.05,
      radius: 0.92,
      duration: 0.75,
      ease: 'power2.inOut',
      onUpdate: () => this.updateCameraPosition()
    });
    gsap.to(this.cameraLookTarget, {
      x: 0,
      y: -0.015,
      z: 0.02,
      duration: 0.75,
      ease: 'power2.inOut',
      onUpdate: () => this.updateCameraPosition()
    });
  }

  /**
   * 全景站位视角：站在宽侧稍远处纵观全局
   */
  public focusHeroPedestal() {
    gsap.to(this.cameraAngle, {
      theta: Math.PI / 2 + 0.25,
      phi: 1.12,
      radius: 1.85,
      duration: 0.85,
      ease: 'power2.out',
      onUpdate: () => this.updateCameraPosition()
    });
    gsap.to(this.cameraLookTarget, {
      x: 0,
      y: 0.05,
      z: 0,
      duration: 0.85,
      ease: 'power2.out',
      onUpdate: () => this.updateCameraPosition(),
      onComplete: () => {
        this.autoRotate = false;
      }
    });
  }

  // ==================== 武器横卧铁砧 + 渐进式显现 ====================

  /**
   * 待锻造状态：粗胚与全息图纸模版严格【横卧】在铁砧上
   */
  public displayWorkpieceTemplate(blueprint: BlueprintDef) {
    if (this.weaponGroup) {
      this.scene.remove(this.weaponGroup);
      this.weaponGroup = null;
    }

    // 粗胚横卧
    this.workpieceGroup.visible = true;
    if (this.hotBilletMesh) {
      this.hotBilletMesh.scale.set(1, 1, 1);
      (this.hotBilletMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6;
    }

    // 移除旧全息线框
    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    // 生成全息图纸线框构架，并【横着平放在铁砧上】(沿 Z 轴横向延伸)
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

    // ★ 关键需求：武器横着放在铁砧上 (旋转 90 度躺平)
    this.ghostBlueprintGroup.rotation.set(Math.PI / 2, 0, 0);
    this.ghostBlueprintGroup.position.set(0, 0.015, -0.15);
    this.ghostBlueprintGroup.scale.set(0.9, 0.9, 0.9);
    this.scene.add(this.ghostBlueprintGroup);

    // 视角自动回到宽侧
    this.focusAnvil();
  }

  /**
   * 打造过程中动态更新（进度 0% ~ 100%）：
   * 粗胚横向延展变薄，全息线框逐渐凝实为实体！
   */
  public updateForgingProgress(progress: number, _blueprint: BlueprintDef) {
    const p = Math.max(0, Math.min(1, progress));

    if (this.hotBilletMesh) {
      // 沿着铁砧长轴横向延展
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
      // 随着锤打逐渐贴近砧面
      this.ghostBlueprintGroup.position.y = 0.015 - p * 0.02;
    }
  }

  /**
   * 淬火大功告成：横卧在铁砧上展现成品真容！
   */
  public quenchAndReveal(blueprint: BlueprintDef, slotMaterials: Partial<Record<SlotType, MaterialDef>> = {}) {
    this.workpieceGroup.visible = false;
    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    // 淬火白雾
    sound.playQuenchSteam();
    this.triggerSteamBurst(new THREE.Vector3(0, -0.01, 0));
    this.triggerSparkBurst(new THREE.Vector3(0, 0.02, 0), 45, 0xffffff);

    // ★ 关键需求：成品武器横卧在铁砧上展现！
    this.displayWeapon(blueprint, slotMaterials);
  }

  /**
   * 展示成品武器：【横卧在铁砧上】
   */
  public displayWeapon(blueprint: BlueprintDef, slotMaterials: Partial<Record<SlotType, MaterialDef>> = {}) {
    this.workpieceGroup.visible = false;
    if (this.ghostBlueprintGroup) {
      this.scene.remove(this.ghostBlueprintGroup);
      this.ghostBlueprintGroup = null;
    }

    if (this.weaponGroup) {
      this.scene.remove(this.weaponGroup);
      this.weaponGroup = null;
    }

    this.weaponGroup = this.assembler.assembleWeapon(blueprint, slotMaterials, this.showSockets);

    // ★ 关键需求：武器横着放在铁砧上！
    // 旋转 90 度使剑身沿 Z 轴横向平铺，剑刃躺在砧面 (y = -0.015m)
    this.weaponGroup.rotation.set(Math.PI / 2, 0, 0);
    this.weaponGroup.position.set(0, -0.015, -0.15);
    this.scene.add(this.weaponGroup);

    // 轻微进场弹力
    this.weaponGroup.scale.set(0.1, 0.1, 0.1);
    gsap.to(this.weaponGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.5,
      ease: 'back.out(1.5)'
    });
  }

  public toggleSocketVisualizer() {
    this.showSockets = !this.showSockets;
  }

  // ==================== 右手持锤挥打：按一下再敲 ====================

  /**
   * 每次鼠标点击打铁：右手持锤由蓄势位下砸砧面，顿帧反弹，绝不自动连击
   */
  public triggerHammerTap(isPerfect: boolean = false) {
    if (this.isHammerStriking) return;
    this.isHammerStriking = true;

    const anvilHitPos = new THREE.Vector3(0, -0.01, 0.05);

    // 右手持锤挥砸动作
    gsap.timeline({
      onComplete: () => {
        this.isHammerStriking = false;
      }
    })
    .to(this.rightArmGroup.position, {
      x: 0.08,
      y: 0.06,
      z: 0.06,
      duration: 0.07,
      ease: 'power4.in',
      onComplete: () => {
        // 瞬间命中铁砧：火花暴射 + 粗胚受力炽亮 + 屏幕微震
        this.triggerSparkBurst(anvilHitPos, isPerfect ? 65 : 40, isPerfect ? 0xffea00 : 0xff5500);

        if (this.hotBilletMesh) {
          const mat = this.hotBilletMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 4.8;
          gsap.to(mat, { emissiveIntensity: 2.6, duration: 0.18 });
        }

        // 镜头微幅物理震颤
        const shakeIntensity = isPerfect ? 0.025 : 0.012;
        gsap.fromTo(this.cameraLookTarget,
          { y: -0.015 + (Math.random() - 0.5) * shakeIntensity },
          { y: -0.015, duration: 0.12, ease: 'rough' }
        );
      }
    })
    .to(this.rightArmGroup.rotation, {
      x: 0.15,
      y: 0.12,
      z: -0.15,
      duration: 0.07,
      ease: 'power4.in'
    }, '<')
    // 砸中后回弹就位
    .to(this.rightArmGroup.position, {
      x: 0.24,
      y: 0.22,
      z: 0.18,
      duration: 0.13,
      ease: 'power2.out'
    }, '+=0.02')
    .to(this.rightArmGroup.rotation, {
      x: -0.3,
      y: 0.35,
      z: 0.25,
      duration: 0.13,
      ease: 'power2.out'
    }, '<');
  }

  // ==================== ⚔️ 试刀挥砍木桩动画 ====================
  public animateTestStrike(damage: number, isCrit: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.weaponGroup) {
        resolve();
        return;
      }

      // 试刀：拿起横卧的武器，挥斩右侧木桩假人
      const startPos = this.weaponGroup.position.clone();
      const startRot = this.weaponGroup.rotation.clone();

      const tl = gsap.timeline({
        onComplete: () => {
          resolve();
        }
      });

      // 1. 抓起武器立起蓄力
      tl.to(this.weaponGroup.position, {
        x: 0.5,
        y: 0.45,
        z: 0.6,
        duration: 0.2,
        ease: 'power2.out'
      })
      .to(this.weaponGroup.rotation, {
        x: -0.4,
        y: 0.8,
        z: -1.2,
        duration: 0.2,
        ease: 'power2.out'
      }, '<')
      // 2. 闪电斩向木桩
      .to(this.weaponGroup.position, {
        x: 1.05,
        y: 0.35,
        z: -0.15,
        duration: 0.1,
        ease: 'power3.in',
        onComplete: () => {
          sound.playSlashHit(isCrit);

          const hitWorldPos = new THREE.Vector3(1.1, 0.4, -0.15);
          this.triggerSparkBurst(hitWorldPos, isCrit ? 70 : 35, isCrit ? 0xff4422 : 0xeab308);

          gsap.fromTo(this.dummyGroup.rotation,
            { z: isCrit ? -0.45 : -0.25, x: 0.15 },
            { z: 0, x: 0, duration: 0.85, ease: 'elastic.out(1.2, 0.25)' }
          );

          if (this.onDamagePopup) {
            const screenPos = hitWorldPos.clone().project(this.camera);
            const halfWidth = this.container.clientWidth / 2;
            const halfHeight = this.container.clientHeight / 2;
            const screenX = screenPos.x * halfWidth + halfWidth;
            const screenY = -screenPos.y * halfHeight + halfHeight;

            this.onDamagePopup({
              id: Math.random().toString(36).substring(2, 9),
              x: screenX,
              y: screenY,
              text: isCrit ? `💥 暴击! ${damage}` : `⚔️ 命中 ${damage}`,
              isCrit,
              color: isCrit ? '#ef4444' : '#fbbf24'
            });
          }
        }
      })
      // 3. 挥砍后平稳放回铁砧横卧态
      .to(this.weaponGroup.position, {
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
        duration: 0.35,
        ease: 'back.out(1.2)'
      }, '+=0.1')
      .to(this.weaponGroup.rotation, {
        x: startRot.x,
        y: startRot.y,
        z: startRot.z,
        duration: 0.35,
        ease: 'back.out(1.2)'
      }, '<');
    });
  }

  // ==================== 相机更新与鼠标操作 ====================
  private updateCameraPosition() {
    const { theta, phi, radius } = this.cameraAngle;
    this.camera.position.x = this.cameraLookTarget.x + radius * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = this.cameraLookTarget.y + radius * Math.cos(phi);
    this.camera.position.z = this.cameraLookTarget.z + radius * Math.sin(phi) * Math.cos(theta);
    this.camera.lookAt(this.cameraLookTarget);
  }

  public resetCamera() {
    gsap.to(this.cameraAngle, {
      theta: Math.PI / 2,
      phi: 1.05,
      radius: 0.95,
      duration: 0.5,
      onUpdate: () => this.updateCameraPosition()
    });
    gsap.to(this.cameraLookTarget, {
      x: 0,
      y: -0.015,
      z: 0.02,
      duration: 0.5,
      onUpdate: () => this.updateCameraPosition()
    });
  }

  public focusPart(part: 'all' | 'blade' | 'guard') {
    let targetRadius = 0.95;
    let targetZ = 0.02;

    if (part === 'blade') {
      targetZ = 0.18; // 剑身位于 +Z 方向
      targetRadius = 0.75;
    } else if (part === 'guard') {
      targetZ = -0.08; // 护手位于近握柄端
      targetRadius = 0.65;
    }

    gsap.to(this.cameraAngle, {
      radius: targetRadius,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => this.updateCameraPosition()
    });
    gsap.to(this.cameraLookTarget, {
      z: targetZ,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => this.updateCameraPosition()
    });
  }

  private setupEventListeners() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.cameraAngle.theta -= deltaX * 0.008;
      this.cameraAngle.phi = Math.max(0.4, Math.min(Math.PI / 2.05, this.cameraAngle.phi - deltaY * 0.008));

      this.updateCameraPosition();
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraAngle.radius = Math.max(0.65, Math.min(3.5, this.cameraAngle.radius + e.deltaY * 0.002));
      this.updateCameraPosition();
    }, { passive: false });

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

  // ==================== 渲染主循环 ====================
  private startRenderLoop() {
    let clock = new THREE.Clock();

    const loop = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // 全息虚线框自转微浮动
      if (this.ghostBlueprintGroup) {
        this.ghostBlueprintGroup.position.y = 0.015 + Math.sin(elapsedTime * 2.5) * 0.003;
      }

      // 粗胚呼吸热度
      if (this.hotBilletMesh && this.workpieceGroup.visible) {
        const mat = this.hotBilletMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 2.4 + Math.sin(elapsedTime * 4) * 0.4;
      }

      // 炉火跳动
      if (this.fireLight) {
        this.fireLight.intensity = this.fireLight.intensity * (0.95 + Math.sin(elapsedTime * 9) * 0.05);
      }

      // 火花粒子物理更新
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

      // 蒸汽粒子物理更新
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
