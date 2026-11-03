import * as THREE from 'three';
import gsap from 'gsap';
import { WeaponAssembler } from './WeaponAssembler';
import { BlueprintDef, MaterialDef, SlotType } from '../types/game';
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
  private anvilGroup: THREE.Group = new THREE.Group();
  private dummyGroup: THREE.Group = new THREE.Group();
  private hammerMesh: THREE.Group = new THREE.Group();
  private sparkParticles: THREE.Points | null = null;
  private sparkPositions: Float32Array = new Float32Array(300);
  private sparkVelocities: THREE.Vector3[] = [];
  private fireLight: THREE.PointLight | null = null;

  // 交互控制状态
  private isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private cameraAngle = { theta: 0.35, phi: 1.25, radius: 2.8 };
  public autoRotate: boolean = true;
  private showSockets: boolean = false;
  private animationFrameId: number | null = null;

  // 回调
  private onDamagePopup: ((dmg: DamageNumber) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.assembler = new WeaponAssembler();

    // 1. 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e0e14);
    this.scene.fog = new THREE.FogExp2(0x0e0e14, 0.15);

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
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // 4. 构建环境灯光与道具
    this.setupLighting();
    this.buildWorkshopEnvironment();
    this.buildAnvil();
    this.buildTrainingDummy();
    this.buildHammer();
    this.setupSparkParticleSystem();

    // 5. 事件监听
    this.setupEventListeners();
    this.startRenderLoop();
  }

  public setDamagePopupCallback(cb: (dmg: DamageNumber) => void) {
    this.onDamagePopup = cb;
  }

  // ==================== 灯光系统 ====================
  private setupLighting() {
    // 环境底光 (深青蓝调)
    const ambientLight = new THREE.AmbientLight(0x1a202c, 1.4);
    this.scene.add(ambientLight);

    // 暖炉火光 (跳动的暖橙色点光源)
    this.fireLight = new THREE.PointLight(0xff7722, 4.0, 8);
    this.fireLight.position.set(-1.2, 0.4, -0.6);
    this.fireLight.castShadow = true;
    this.scene.add(this.fireLight);

    // 主顶光 (聚光灯射向中央铁砧)
    const spotLight = new THREE.SpotLight(0xfff5e6, 3.5);
    spotLight.position.set(0.5, 4.0, 1.8);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.4;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    this.scene.add(spotLight);

    // 冷白轮廓光 (给刀刃提供金属镜面反光)
    const rimLight = new THREE.DirectionalLight(0x90cdf4, 2.0);
    rimLight.position.set(-2, 3, -2);
    this.scene.add(rimLight);
  }

  // ==================== 工坊环境 ====================
  private buildWorkshopEnvironment() {
    // 地面石砖
    const floorGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.2, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181822,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.7;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 圆形锻造基台符文圈
    const ringGeo = new THREE.RingGeometry(0.7, 0.76, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.59;
    this.scene.add(ring);
  }

  // ==================== 铁砧构建 ====================
  private buildAnvil() {
    this.anvilGroup = new THREE.Group();
    this.anvilGroup.position.set(0, -0.6, 0);

    // 垫木桩底座
    const stumpGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.4, 16);
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.9, metalness: 0.05 });
    const stump = new THREE.Mesh(stumpGeo, stumpMat);
    stump.position.y = 0.2;
    stump.receiveShadow = true;
    this.anvilGroup.add(stump);

    // 铁砧主体 (铸铁质感)
    const anvilMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.85 });
    const baseGeo = new THREE.BoxGeometry(0.32, 0.12, 0.5);
    const base = new THREE.Mesh(baseGeo, anvilMat);
    base.position.y = 0.46;
    base.castShadow = true;
    this.anvilGroup.add(base);

    // 砧面 (工作台面)
    const topGeo = new THREE.BoxGeometry(0.26, 0.08, 0.58);
    const top = new THREE.Mesh(topGeo, anvilMat);
    top.position.y = 0.54;
    top.castShadow = true;
    this.anvilGroup.add(top);

    // 砧角 (尖头圆锥)
    const hornGeo = new THREE.ConeGeometry(0.08, 0.22, 12);
    hornGeo.rotateX(-Math.PI / 2);
    const horn = new THREE.Mesh(hornGeo, anvilMat);
    horn.position.set(0, 0.54, 0.38);
    this.anvilGroup.add(horn);

    this.scene.add(this.anvilGroup);
  }

  // ==================== 试刀木桩假人 ====================
  private buildTrainingDummy() {
    this.dummyGroup = new THREE.Group();
    this.dummyGroup.name = 'TrainingDummy';
    this.dummyGroup.position.set(1.1, -0.6, -0.2);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85, metalness: 0.1 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9, metalness: 0.05 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9, metalness: 0.05 });

    // 主干木柱
    const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.5, 12);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 0.75;
    post.castShadow = true;
    this.dummyGroup.add(post);

    // 横木手臂
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 10);
    armGeo.rotateZ(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, woodMat);
    arm.position.y = 1.05;
    arm.castShadow = true;
    this.dummyGroup.add(arm);

    // 草人头部
    const headGeo = new THREE.SphereGeometry(0.16, 12, 12);
    const head = new THREE.Mesh(headGeo, strawMat);
    head.position.y = 1.55;
    head.castShadow = true;
    this.dummyGroup.add(head);

    // 头部红头巾
    const wrapGeo = new THREE.TorusGeometry(0.165, 0.03, 8, 16);
    wrapGeo.rotateX(Math.PI / 2);
    const wrap = new THREE.Mesh(wrapGeo, clothMat);
    wrap.position.y = 1.56;
    this.dummyGroup.add(wrap);

    // 胸前靶心红布标靶
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

  // ==================== 铁锤构建 ====================
  private buildHammer() {
    this.hammerMesh = new THREE.Group();
    this.hammerMesh.name = 'ForgeHammer';

    // 锤柄
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.022, 0.5, 10);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.25;
    this.hammerMesh.add(handle);

    // 锤头 (重型锻造方锤)
    const headGeo = new THREE.BoxGeometry(0.12, 0.1, 0.18);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.9 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.48, 0);
    head.castShadow = true;
    this.hammerMesh.add(head);

    // 初始位置：隐藏在铁砧斜上方待命
    this.hammerMesh.position.set(0.4, 0.4, 0.3);
    this.hammerMesh.rotation.set(-0.4, 0.2, 0.7);
    this.scene.add(this.hammerMesh);
  }

  // ==================== 火花粒子系统 ====================
  private setupSparkParticleSystem() {
    const count = 100;
    this.sparkPositions = new Float32Array(count * 3);
    this.sparkVelocities = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffaa22,
      size: 0.04,
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

  /**
   * 触发火花飞溅爆发
   */
  public triggerSparkBurst(origin: THREE.Vector3, count: number = 60, colorHex: number = 0xffaa22) {
    if (!this.sparkParticles) return;

    const positions = this.sparkParticles.geometry.attributes.position.array as Float32Array;
    (this.sparkParticles.material as THREE.PointsMaterial).color.setHex(colorHex);
    (this.sparkParticles.material as THREE.PointsMaterial).opacity = 1.0;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;

      // 向上半球散射的高初速
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI / 2.2);
      const speed = 1.5 + Math.random() * 2.5;

      this.sparkVelocities[i].set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed
      );
    }

    this.sparkParticles.geometry.attributes.position.needsUpdate = true;

    // 粒子渐隐动画
    gsap.to(this.sparkParticles.material, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out'
    });
  }

  // ==================== 武器装配与呈现 ====================
  public displayWeapon(blueprint: BlueprintDef, slotMaterials: Partial<Record<SlotType, MaterialDef>> = {}) {
    // 移除旧武器
    if (this.weaponGroup) {
      this.scene.remove(this.weaponGroup);
      this.weaponGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      this.weaponGroup = null;
    }

    // 重新装配生成新武器
    this.weaponGroup = this.assembler.assembleWeapon(blueprint, slotMaterials, this.showSockets);

    // 悬浮在铁砧上方优雅展示
    this.weaponGroup.position.set(0, 0.4, 0);
    this.weaponGroup.rotation.set(0, 0, 0);
    this.scene.add(this.weaponGroup);

    // 进场微弹簧动画
    this.weaponGroup.scale.set(0.1, 0.1, 0.1);
    gsap.to(this.weaponGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.6,
      ease: 'back.out(1.7)'
    });
  }

  public toggleSocketVisualizer() {
    this.showSockets = !this.showSockets;
  }

  // ==================== 🔨 敲击锻造动画 ====================
  public animateHammerStrike(isPerfect: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      // 锤子蓄力高举并狠狠砸向铁砧
      const anvilHitPos = new THREE.Vector3(0, 0.05, 0.05);

      const tl = gsap.timeline({
        onComplete: () => {
          resolve();
        }
      });

      tl.to(this.hammerMesh.position, {
        x: 0.1,
        y: 0.9,
        z: 0.2,
        duration: 0.18,
        ease: 'power1.out'
      })
      .to(this.hammerMesh.rotation, {
        x: -0.8,
        y: 0.1,
        z: 0.2,
        duration: 0.18,
        ease: 'power1.out'
      }, '<')
      .to(this.hammerMesh.position, {
        x: 0,
        y: 0.08,
        z: 0,
        duration: 0.1,
        ease: 'power4.in',
        onComplete: () => {
          // 砸击瞬间：音效 + 顿帧 + 火花
          sound.playHammerHit(isPerfect);
          this.triggerSparkBurst(anvilHitPos, isPerfect ? 80 : 45, isPerfect ? 0xffcc00 : 0xff7711);

          // 砧面炽热反光
          if (this.fireLight) {
            const originalIntensity = this.fireLight.intensity;
            this.fireLight.intensity = 8.0;
            gsap.to(this.fireLight, { intensity: originalIntensity, duration: 0.3 });
          }

          // 武器微颤抖动
          if (this.weaponGroup) {
            gsap.fromTo(this.weaponGroup.position, 
              { y: 0.38 }, 
              { y: 0.4, duration: 0.2, ease: 'bounce.out' }
            );
          }
        }
      })
      .to(this.hammerMesh.position, {
        x: 0.4,
        y: 0.4,
        z: 0.3,
        duration: 0.28,
        ease: 'power2.out'
      }, '+=0.06')
      .to(this.hammerMesh.rotation, {
        x: -0.4,
        y: 0.2,
        z: 0.7,
        duration: 0.28,
        ease: 'power2.out'
      }, '<');
    });
  }

  // ==================== ⚔️ 试刀挥砍木桩动画 ====================
  public animateTestStrike(damage: number, isCrit: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.weaponGroup) {
        resolve();
        return;
      }

      // 试刀：武器平举，横切暴砍假人，然后回归原位
      const startPos = this.weaponGroup.position.clone();
      const startRot = this.weaponGroup.rotation.clone();

      const tl = gsap.timeline({
        onComplete: () => {
          resolve();
        }
      });

      // 1. 蓄力侧拉
      tl.to(this.weaponGroup.position, {
        x: 0.5,
        y: 0.45,
        z: 0.6,
        duration: 0.18,
        ease: 'power2.out'
      })
      .to(this.weaponGroup.rotation, {
        x: -0.4,
        y: 0.8,
        z: -1.2,
        duration: 0.18,
        ease: 'power2.out'
      }, '<')
      // 2. 闪电斩向木桩 (高速横砍)
      .to(this.weaponGroup.position, {
        x: 1.05,
        y: 0.35,
        z: -0.15,
        duration: 0.1,
        ease: 'power3.in',
        onComplete: () => {
          // 击中瞬间：音效 + 假人剧烈回弹 + 飞溅木屑 + 伤害跳字
          sound.playSlashHit(isCrit);

          const hitWorldPos = new THREE.Vector3(1.1, 0.4, -0.15);
          this.triggerSparkBurst(hitWorldPos, isCrit ? 70 : 35, isCrit ? 0xff4422 : 0xeab308);

          // 假人受击晃动 (GSAP 弹性阻尼摆动)
          gsap.fromTo(this.dummyGroup.rotation,
            { z: isCrit ? -0.45 : -0.25, x: 0.15 },
            { z: 0, x: 0, duration: 0.85, ease: 'elastic.out(1.2, 0.25)' }
          );

          // 计算屏幕 2D 坐标以便跳出伤害数字
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
      // 3. 挥砍后停滞收招并回位
      .to(this.weaponGroup.position, {
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
        duration: 0.35,
        ease: 'back.out(1.4)'
      }, '+=0.1')
      .to(this.weaponGroup.rotation, {
        x: startRot.x,
        y: startRot.y,
        z: startRot.z,
        duration: 0.35,
        ease: 'back.out(1.4)'
      }, '<');
    });
  }

  // ==================== 相机与事件交互 ====================
  private updateCameraPosition() {
    const { theta, phi, radius } = this.cameraAngle;
    this.camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    this.camera.position.y = radius * Math.cos(phi) + 0.3;
    this.camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    this.camera.lookAt(0.3, 0.35, 0);
  }

  public resetCamera() {
    gsap.to(this.cameraAngle, {
      theta: 0.35,
      phi: 1.25,
      radius: 2.8,
      duration: 0.5,
      onUpdate: () => this.updateCameraPosition()
    });
  }

  public focusPart(part: 'all' | 'blade' | 'guard') {
    let targetTheta = 0.35;
    let targetPhi = 1.25;
    let targetRadius = 2.8;

    if (part === 'blade') {
      targetPhi = 1.1;
      targetRadius = 1.6;
    } else if (part === 'guard') {
      targetPhi = 1.35;
      targetRadius = 1.4;
    }

    gsap.to(this.cameraAngle, {
      theta: targetTheta,
      phi: targetPhi,
      radius: targetRadius,
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
      this.cameraAngle.radius = Math.max(1.1, Math.min(5.0, this.cameraAngle.radius + e.deltaY * 0.002));
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

      // 武器自转或悬浮待机浮动
      if (this.weaponGroup) {
        if (this.autoRotate && !this.isDragging) {
          this.weaponGroup.rotation.y += delta * 0.5;
        }
        this.weaponGroup.position.y = 0.4 + Math.sin(elapsedTime * 2.5) * 0.015;
      }

      // 炉火跳动模拟
      if (this.fireLight) {
        this.fireLight.intensity = 3.6 + Math.sin(elapsedTime * 9) * 0.4 + Math.cos(elapsedTime * 17) * 0.2;
      }

      // 粒子物理更新
      if (this.sparkParticles && (this.sparkParticles.material as THREE.PointsMaterial).opacity > 0) {
        const positions = this.sparkParticles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.sparkVelocities.length; i++) {
          const vel = this.sparkVelocities[i];
          positions[i * 3] += vel.x * delta;
          positions[i * 3 + 1] += vel.y * delta;
          positions[i * 3 + 2] += vel.z * delta;

          // 重力衰减
          vel.y -= 7.0 * delta;
        }
        this.sparkParticles.geometry.attributes.position.needsUpdate = true;
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
