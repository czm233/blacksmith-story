import * as THREE from 'three';
import { BlueprintDef, MaterialDef, SlotType } from '../types/game';
import { MATERIALS } from '../data/constants';

export interface SocketDefinition {
  name: string;
  position: THREE.Vector3;
  rotation?: THREE.Euler;
}

export interface PartMeshBundle {
  slot: SlotType;
  group: THREE.Group;
  sockets: Record<string, THREE.Vector3>;
}

export class WeaponAssembler {
  private materialsCache: Map<string, THREE.Material> = new Map();

  /**
   * 获取或创建带有材质参数的 PBR 材质
   */
  public getMaterial(matDef: MaterialDef, tint?: string): THREE.MeshStandardMaterial {
    const key = `${matDef.id}_${tint || ''}`;
    if (this.materialsCache.has(key)) {
      return this.materialsCache.get(key) as THREE.MeshStandardMaterial;
    }

    const color = tint || matDef.visual.color;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: matDef.visual.roughness,
      metalness: matDef.visual.metalness,
      emissive: matDef.visual.emissive ? new THREE.Color(matDef.visual.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: matDef.visual.emissiveIntensity || 0,
      envMapIntensity: 1.2,
    });

    this.materialsCache.set(key, material);
    return material;
  }

  /**
   * 组装整把武器，返回包含完整层级树的 THREE.Group
   */
  public assembleWeapon(
    blueprint: BlueprintDef,
    slotMaterials: Partial<Record<SlotType, MaterialDef>>,
    showSockets: boolean = false
  ): THREE.Group {
    const rootGroup = new THREE.Group();
    rootGroup.name = `Weapon_${blueprint.id}`;

    // 默认材料回退
    const defaultWood = MATERIALS.oak_wood;
    const defaultMetal = blueprint.recipe.meteoric_ore
      ? MATERIALS.meteoric_ore
      : blueprint.recipe.steel_ingot
      ? MATERIALS.steel_ingot
      : MATERIALS.iron_ingot;

    const gripMat = slotMaterials['Grip'] || defaultWood;
    const bladeMat = slotMaterials['Blade'] || defaultMetal;
    const guardMat = slotMaterials['Guard'] || defaultMetal;
    const pommelMat = slotMaterials['Pommel'] || defaultMetal;
    const gemMat = slotMaterials['Gem'] || (blueprint.recipe.meteoric_ore ? MATERIALS.meteoric_ore : MATERIALS.steel_ingot);

    // 1. 创建根节点：Grip (握柄)
    const gripBundle = this.createGripMesh(blueprint, gripMat);
    rootGroup.add(gripBundle.group);

    // 2. 判断是否有 Pommel (配重球)
    if (blueprint.slots.includes('Pommel') && gripBundle.sockets['Socket_Pommel']) {
      const pommelBundle = this.createPommelMesh(blueprint, pommelMat);
      pommelBundle.group.position.copy(gripBundle.sockets['Socket_Pommel']);
      gripBundle.group.add(pommelBundle.group);
    }

    // 3. 判断是否有 Guard (护手)
    if (blueprint.slots.includes('Guard')) {
      const guardBundle = this.createGuardMesh(blueprint, guardMat);
      guardBundle.group.position.copy(gripBundle.sockets['Socket_Guard']);
      gripBundle.group.add(guardBundle.group);

      // 4.1 挂载 Blade (剑身) 到 Guard 的 Socket_Blade
      const bladeBundle = this.createBladeMesh(blueprint, bladeMat);
      const bladeSocket = guardBundle.sockets['Socket_Blade'] || new THREE.Vector3(0, 0.05, 0);
      bladeBundle.group.position.copy(bladeSocket);
      guardBundle.group.add(bladeBundle.group);

      // 4.2 判断是否有 Gem (附魔宝珠/星核)
      if (blueprint.slots.includes('Gem') && guardBundle.sockets['Socket_Gem']) {
        const gemBundle = this.createGemMesh(blueprint, gemMat);
        gemBundle.group.position.copy(guardBundle.sockets['Socket_Gem']);
        guardBundle.group.add(gemBundle.group);
      }
    } else {
      // ★ 白色图纸特化处理 (Socket Fallback):
      // 没有 Guard 槽位时，Blade 直接降级回退挂载至握柄的 Socket_Guard！
      const bladeBundle = this.createBladeMesh(blueprint, bladeMat);
      bladeBundle.group.position.copy(gripBundle.sockets['Socket_Guard']);
      gripBundle.group.add(bladeBundle.group);
    }

    // 如果开启挂点调试显示，给各个挂点添加指示标记
    if (showSockets) {
      this.attachSocketVisualizers(rootGroup);
    }

    // 稍微调校整把剑的视觉中心：使手握持点或剑身中部处于局部原点上方
    rootGroup.position.set(0, 0, 0);

    return rootGroup;
  }

  // ==================== 部件网格参数化生成 ====================

  /**
   * 创建握柄 Grip
   * 原点 (0, 0, 0) 位于手握持受力点
   * 顶端提供 Socket_Guard (y = +0.22m)
   * 底端提供 Socket_Pommel (y = -0.12m)
   */
  private createGripMesh(bp: BlueprintDef, matDef: MaterialDef): PartMeshBundle {
    const group = new THREE.Group();
    group.name = 'Part_Grip';

    const gripLength = bp.rarity === 'purple' || bp.rarity === 'orange' ? 0.30 : 0.22;
    const socketGuardY = gripLength * 0.72;
    const socketPommelY = -gripLength * 0.38;

    const mainMat = this.getMaterial(matDef);
    const metalMat = this.getMaterial(bp.recipe.steel_ingot ? MATERIALS.steel_ingot : MATERIALS.iron_ingot);

    // 握柄主体：微收腰柱体
    const gripRadius = bp.id === 'bp_stiletto' ? 0.016 : 0.022;
    const gripGeo = new THREE.CylinderGeometry(gripRadius * 0.9, gripRadius, gripLength, 16);
    const gripMesh = new THREE.Mesh(gripGeo, mainMat);
    gripMesh.castShadow = true;
    gripMesh.receiveShadow = true;
    gripMesh.position.y = (socketGuardY + socketPommelY) / 2;
    group.add(gripMesh);

    // 缠绳 / 金属环凹槽装饰
    const rings = bp.rarity === 'orange' ? 6 : 4;
    for (let i = 0; i < rings; i++) {
      const ringGeo = new THREE.TorusGeometry(gripRadius * 1.08, 0.003, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, metalMat);
      ringMesh.position.y = socketPommelY + 0.03 + (i * (gripLength - 0.06)) / (rings - 1);
      group.add(ringMesh);
    }

    // 顶端金属箍圈 (Collar)
    const topCollarGeo = new THREE.CylinderGeometry(gripRadius * 1.15, gripRadius * 1.1, 0.02, 16);
    const topCollar = new THREE.Mesh(topCollarGeo, metalMat);
    topCollar.position.y = socketGuardY - 0.01;
    group.add(topCollar);

    // 底端金属箍圈
    const botCollarGeo = new THREE.CylinderGeometry(gripRadius * 1.1, gripRadius * 1.15, 0.015, 16);
    const botCollar = new THREE.Mesh(botCollarGeo, metalMat);
    botCollar.position.y = socketPommelY + 0.01;
    group.add(botCollar);

    return {
      slot: 'Grip',
      group,
      sockets: {
        Socket_Guard: new THREE.Vector3(0, socketGuardY, 0),
        Socket_Pommel: new THREE.Vector3(0, socketPommelY, 0)
      }
    };
  }

  /**
   * 创建护手 Guard
   * 原点位于底座截面，顶端提供 Socket_Blade (y = +0.05m)
   * 侧面或中央提供 Socket_Gem
   */
  private createGuardMesh(bp: BlueprintDef, matDef: MaterialDef): PartMeshBundle {
    const group = new THREE.Group();
    group.name = 'Part_Guard';
    const mat = this.getMaterial(matDef);

    let guardSocketBladeY = 0.05;

    if (bp.id === 'bp_guard_sword') {
      // 卫兵经典十字护手
      const crossWidth = 0.32;
      const crossGeo = new THREE.BoxGeometry(crossWidth, 0.03, 0.04);
      const crossMesh = new THREE.Mesh(crossGeo, mat);
      crossMesh.position.y = 0.025;
      crossMesh.castShadow = true;
      group.add(crossMesh);

      // 两端球形止挡配重
      const ballGeo = new THREE.SphereGeometry(0.025, 12, 12);
      const leftBall = new THREE.Mesh(ballGeo, mat);
      leftBall.position.set(-crossWidth / 2, 0.025, 0);
      const rightBall = new THREE.Mesh(ballGeo, mat);
      rightBall.position.set(crossWidth / 2, 0.025, 0);
      group.add(leftBall, rightBall);

      guardSocketBladeY = 0.04;
    } else if (bp.id === 'bp_stiletto') {
      // 刺剑花式盘形/环形护手 (Rapier basket / ring)
      const ringOuterGeo = new THREE.TorusGeometry(0.07, 0.008, 12, 28);
      ringOuterGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringOuterGeo, mat);
      ringMesh.position.y = 0.03;
      group.add(ringMesh);

      // 纤细短横挡
      const crossGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 12);
      crossGeo.rotateZ(Math.PI / 2);
      const crossMesh = new THREE.Mesh(crossGeo, mat);
      crossMesh.position.y = 0.025;
      group.add(crossMesh);

      guardSocketBladeY = 0.045;
    } else if (bp.id === 'bp_knight_claymore') {
      // 骑士重剑双斜掠翼厚重护手
      const centerGeo = new THREE.BoxGeometry(0.08, 0.05, 0.05);
      const centerMesh = new THREE.Mesh(centerGeo, mat);
      centerMesh.position.y = 0.03;
      group.add(centerMesh);

      // 两侧上扬剑格翼
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.18, 0.04);
      wingShape.lineTo(0.17, 0.08);
      wingShape.lineTo(0, 0.05);
      wingShape.closePath();

      const extrudeSettings = { depth: 0.04, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.005, bevelThickness: 0.005 };
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      wingGeo.center();

      const rightWing = new THREE.Mesh(wingGeo, mat);
      rightWing.position.set(0.12, 0.04, 0);
      const leftWing = rightWing.clone();
      leftWing.rotation.y = Math.PI;
      leftWing.position.set(-0.12, 0.04, 0);
      group.add(rightWing, leftWing);

      guardSocketBladeY = 0.06;
    } else if (bp.id === 'bp_abyss_slayer') {
      // 渊火巨剑熔岩翼护手
      const magmaMat = this.getMaterial(MATERIALS.meteoric_ore);
      const centerGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8);
      const centerMesh = new THREE.Mesh(centerGeo, magmaMat);
      centerMesh.position.y = 0.035;
      group.add(centerMesh);

      // 狂暴尖刺龙翼剑格
      const spikeGeo = new THREE.ConeGeometry(0.025, 0.24, 6);
      spikeGeo.rotateZ(-Math.PI / 2.5);
      const rightSpike = new THREE.Mesh(spikeGeo, mat);
      rightSpike.position.set(0.14, 0.07, 0);

      const leftSpike = new THREE.Mesh(spikeGeo.clone().rotateZ(Math.PI * 0.8), mat);
      leftSpike.position.set(-0.14, 0.07, 0);

      group.add(rightSpike, leftSpike);

      guardSocketBladeY = 0.065;
    }

    return {
      slot: 'Guard',
      group,
      sockets: {
        Socket_Blade: new THREE.Vector3(0, guardSocketBladeY, 0),
        Socket_Gem: new THREE.Vector3(0, guardSocketBladeY * 0.6, 0.032)
      }
    };
  }

  /**
   * 创建剑身 Blade
   * 原点位于底座截面中心，向上延伸 0.8 ~ 1.4m
   */
  private createBladeMesh(bp: BlueprintDef, matDef: MaterialDef): PartMeshBundle {
    const group = new THREE.Group();
    group.name = 'Part_Blade';
    const mat = this.getMaterial(matDef);

    if (bp.id === 'bp_apprentice') {
      // 学徒平刃剑：双刃粗铸平刃 (长度 0.85m)
      const bladeLength = 0.85;
      const bladeWidth = 0.065;
      const bladeThickness = 0.015;

      const shape = new THREE.Shape();
      shape.moveTo(-bladeWidth / 2, 0);
      shape.lineTo(bladeWidth / 2, 0);
      shape.lineTo(bladeWidth / 2, bladeLength - 0.12);
      shape.lineTo(0, bladeLength); // 尖端
      shape.lineTo(-bladeWidth / 2, bladeLength - 0.12);
      shape.closePath();

      const extrudeSettings = { depth: bladeThickness, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2 };
      const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      bladeGeo.center();
      const bladeMesh = new THREE.Mesh(bladeGeo, mat);
      bladeMesh.position.y = bladeLength / 2;
      bladeMesh.castShadow = true;
      group.add(bladeMesh);
    } else if (bp.id === 'bp_guard_sword') {
      // 卫兵十字剑：开血槽的精工锋刃 (长度 0.95m)
      const bladeLength = 0.95;
      const bladeWidth = 0.07;
      const bladeThickness = 0.018;

      const shape = new THREE.Shape();
      shape.moveTo(-bladeWidth / 2, 0);
      shape.lineTo(bladeWidth / 2, 0);
      shape.lineTo(bladeWidth * 0.45, bladeLength - 0.15);
      shape.lineTo(0, bladeLength);
      shape.lineTo(-bladeWidth * 0.45, bladeLength - 0.15);
      shape.closePath();

      const extrudeSettings = { depth: bladeThickness, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.008, bevelSegments: 3 };
      const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      bladeGeo.center();
      const bladeMesh = new THREE.Mesh(bladeGeo, mat);
      bladeMesh.position.y = bladeLength / 2;
      bladeMesh.castShadow = true;
      group.add(bladeMesh);

      // 中央血槽 (Fuller)
      const fullerGeo = new THREE.BoxGeometry(0.012, bladeLength * 0.65, bladeThickness * 1.05);
      const fullerMat = this.getMaterial(MATERIALS.iron_ingot);
      const fullerMesh = new THREE.Mesh(fullerGeo, fullerMat);
      fullerMesh.position.y = bladeLength * 0.45;
      group.add(fullerMesh);
    } else if (bp.id === 'bp_stiletto') {
      // 精钢刺剑：四棱纤细破甲刺刃 (长度 1.05m)
      const bladeLength = 1.05;
      const bladeGeo = new THREE.ConeGeometry(0.018, bladeLength, 4);
      bladeGeo.rotateY(Math.PI / 4);
      const bladeMesh = new THREE.Mesh(bladeGeo, mat);
      bladeMesh.position.y = bladeLength / 2;
      bladeMesh.castShadow = true;
      group.add(bladeMesh);
    } else if (bp.id === 'bp_knight_claymore') {
      // 破军斩马剑：宽厚双刃重剑，带有根部钝刃段 (Ricasso) (长度 1.25m)
      const bladeLength = 1.25;
      const bladeWidth = 0.11;
      const shape = new THREE.Shape();
      shape.moveTo(-bladeWidth * 0.35, 0);
      shape.lineTo(bladeWidth * 0.35, 0);
      shape.lineTo(bladeWidth * 0.4, 0.15); // ricasso notch
      shape.lineTo(bladeWidth * 0.5, 0.18);
      shape.lineTo(bladeWidth * 0.48, bladeLength - 0.18);
      shape.lineTo(0, bladeLength);
      shape.lineTo(-bladeWidth * 0.48, bladeLength - 0.18);
      shape.lineTo(-bladeWidth * 0.5, 0.18);
      shape.lineTo(-bladeWidth * 0.35, 0.15);
      shape.closePath();

      const extrudeSettings = { depth: 0.024, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.01, bevelSegments: 3 };
      const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      bladeGeo.center();
      const bladeMesh = new THREE.Mesh(bladeGeo, mat);
      bladeMesh.position.y = bladeLength / 2;
      bladeMesh.castShadow = true;
      group.add(bladeMesh);

      // 双深凹槽
      const fullerGeo = new THREE.BoxGeometry(0.016, bladeLength * 0.6, 0.026);
      const fullerMat = this.getMaterial(MATERIALS.steel_ingot);
      const fullerMesh = new THREE.Mesh(fullerGeo, fullerMat);
      fullerMesh.position.y = bladeLength * 0.45;
      group.add(fullerMesh);
    } else if (bp.id === 'bp_abyss_slayer') {
      // 渊火巨剑：霸气锯齿重刃，中央带有熔岩星流 (长度 1.4m)
      const bladeLength = 1.4;
      const bladeWidth = 0.15;
      const shape = new THREE.Shape();
      shape.moveTo(-bladeWidth * 0.4, 0);
      shape.lineTo(bladeWidth * 0.4, 0);
      
      // 锯齿边缘
      shape.lineTo(bladeWidth * 0.48, 0.3);
      shape.lineTo(bladeWidth * 0.42, 0.35);
      shape.lineTo(bladeWidth * 0.52, 0.65);
      shape.lineTo(bladeWidth * 0.45, 0.7);
      shape.lineTo(bladeWidth * 0.55, 1.05);
      shape.lineTo(bladeWidth * 0.48, 1.12);
      shape.lineTo(0, bladeLength); // 巨剑裂口尖端
      shape.lineTo(-bladeWidth * 0.48, 1.12);
      shape.lineTo(-bladeWidth * 0.55, 1.05);
      shape.lineTo(-bladeWidth * 0.45, 0.7);
      shape.lineTo(-bladeWidth * 0.52, 0.65);
      shape.lineTo(-bladeWidth * 0.42, 0.35);
      shape.lineTo(-bladeWidth * 0.48, 0.3);
      shape.closePath();

      const extrudeSettings = { depth: 0.032, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3 };
      const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      bladeGeo.center();
      const bladeMesh = new THREE.Mesh(bladeGeo, mat);
      bladeMesh.position.y = bladeLength / 2;
      bladeMesh.castShadow = true;
      group.add(bladeMesh);

      // 剑身自发光炽火熔核槽
      const coreGeo = new THREE.BoxGeometry(0.024, bladeLength * 0.75, 0.035);
      const magmaMat = this.getMaterial(MATERIALS.meteoric_ore);
      const coreMesh = new THREE.Mesh(coreGeo, magmaMat);
      coreMesh.position.y = bladeLength * 0.45;
      group.add(coreMesh);
    }

    return {
      slot: 'Blade',
      group,
      sockets: {}
    };
  }

  /**
   * 创建配重球 Pommel
   */
  private createPommelMesh(bp: BlueprintDef, matDef: MaterialDef): PartMeshBundle {
    const group = new THREE.Group();
    group.name = 'Part_Pommel';
    const mat = this.getMaterial(matDef);

    if (bp.id === 'bp_abyss_slayer') {
      // 龙首/熔岩多面配重体
      const geo = new THREE.DodecahedronGeometry(0.045, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = -0.03;
      mesh.castShadow = true;
      group.add(mesh);

      // 内置微光
      const innerGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const innerMat = this.getMaterial(MATERIALS.meteoric_ore);
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      innerMesh.position.y = -0.03;
      group.add(innerMesh);
    } else {
      // 实心八角配重球 / 扁球形配重
      const geo = new THREE.SphereGeometry(0.035, 12, 10);
      geo.scale(1, 0.8, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = -0.025;
      mesh.castShadow = true;
      group.add(mesh);
    }

    return {
      slot: 'Pommel',
      group,
      sockets: {}
    };
  }

  /**
   * 创建附魔宝石/星核 Gem
   */
  private createGemMesh(_bp: BlueprintDef, matDef: MaterialDef): PartMeshBundle {
    const group = new THREE.Group();
    group.name = 'Part_Gem';

    // 晶体多面体
    const gemGeo = new THREE.OctahedronGeometry(0.022, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xff6600),
      emissive: new THREE.Color(0xff3300),
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.95
    });

    const gemMesh = new THREE.Mesh(gemGeo, gemMat);
    group.add(gemMesh);

    // 宝石金属镶嵌爪 (Bezel)
    const bezelGeo = new THREE.TorusGeometry(0.024, 0.003, 8, 16);
    const bezelMat = this.getMaterial(matDef);
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    group.add(bezelMesh);

    return {
      slot: 'Gem',
      group,
      sockets: {}
    };
  }

  /**
   * 为挂点添加 3D 调试标记球
   */
  private attachSocketVisualizers(root: THREE.Group) {
    const markerGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });

    root.traverse((obj) => {
      if (obj.name && obj.name.startsWith('Part_')) {
        const marker = new THREE.Mesh(markerGeo, markerMat);
        obj.add(marker);
      }
    });
  }
}
