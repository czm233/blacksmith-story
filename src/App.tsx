import React, { useState, useEffect, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { GuildPanel } from './components/GuildPanel';
import { ForgeViewport } from './components/ForgeViewport';
import { LedgerPanel } from './components/LedgerPanel';
import { WanderingMerchantModal } from './components/WanderingMerchantModal';
import { EpiphanyModal } from './components/EpiphanyModal';
import { GuideModal } from './components/GuideModal';
import {
  BlueprintDef,
  BlueprintId,
  ForgedWeapon,
  LightingConfig,
  LogMessage,
  MaterialId,
  PlayerStats,
  QualityTier,
  WanderingMerchantItem,
} from './types/game';
import {
  BLUEPRINTS,
  DEFAULT_LIGHTING_CONFIG,
  INITIAL_GOLD,
  MATERIALS,
  QUALITY_CONFIGS,
  WANDERING_MERCHANT_INTERVAL_SECONDS,
  WANDERING_MERCHANT_STAY_SECONDS,
} from './data/constants';
import { sound } from './utils/audio';

export const App: React.FC = () => {
  // 1. 玩家资产与等级
  const [gold, setGold] = useState<number>(() => {
    const saved = localStorage.getItem('blacksmith_gold');
    return saved ? parseInt(saved, 10) : INITIAL_GOLD;
  });

  const [masteryLevel, setMasteryLevel] = useState<number>(() => {
    const saved = localStorage.getItem('blacksmith_level');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [masteryExp, setMasteryExp] = useState<number>(0);
  const masteryMaxExp = masteryLevel * 80;

  // 2. 材料仓库
  const [inventory, setInventory] = useState<Record<MaterialId, number>>(() => {
    const saved = localStorage.getItem('blacksmith_inventory');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      oak_wood: 4,
      iron_ingot: 4,
      steel_ingot: 0,
      meteoric_ore: 0,
    };
  });

  // 3. 图纸掌握
  const [unlockedBlueprints, setUnlockedBlueprints] = useState<string[]>(() => {
    const saved = localStorage.getItem('blacksmith_blueprints');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return ['bp_apprentice'];
  });

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<BlueprintId>('bp_apprentice');

  // 4. 当前锻造完成品
  const [currentWeapon, setCurrentWeapon] = useState<ForgedWeapon | null>(null);

  // 5. 云游商人
  const [merchantActive, setMerchantActive] = useState<boolean>(false);
  const [merchantArrivalCountdown, setMerchantArrivalCountdown] = useState<number>(WANDERING_MERCHANT_INTERVAL_SECONDS);
  const [merchantStayRemaining, setMerchantStayRemaining] = useState<number>(WANDERING_MERCHANT_STAY_SECONDS);
  const [merchantStock, setMerchantStock] = useState<WanderingMerchantItem[]>([
    {
      id: 'wm_meteoric',
      name: '星陨石',
      type: 'material',
      targetId: 'meteoric_ore',
      price: 60,
      stock: 4,
      rarity: 'orange',
      description: '域外陨火核心碎片，附带狂暴炽热光辉与暴击词缀。',
    },
    {
      id: 'wm_stiletto',
      name: '图纸：精钢刺剑',
      type: 'blueprint',
      targetId: 'bp_stiletto',
      price: 120,
      stock: 1,
      rarity: 'blue',
      description: '西方剑术家偏爱的环护手刺刃，穿透力破防极高。',
    },
    {
      id: 'wm_abyss_slayer',
      name: '神兵图纸：渊火巨剑',
      type: 'blueprint',
      targetId: 'bp_abyss_slayer',
      price: 500,
      stock: 1,
      rarity: 'orange',
      description: '远古屠神之剑，5插槽星核架构，神级统购包销溢价。',
    },
  ]);

  // 6. 统计数据与历史日志
  const [stats, setStats] = useState<PlayerStats>({
    weaponsForged: 0,
    weaponsSold: 0,
    goldEarned: 0,
    epiphaniesUnlocked: 0,
    dummyStrikes: 0,
    maxDamageDealt: 0,
  });

  const [logs, setLogs] = useState<LogMessage[]>([
    {
      id: '1',
      timestamp: '08:00',
      text: '欢迎来到铁匠铺！商会统购平价原料已到位，请选定图纸开工。',
      type: 'info',
    },
  ]);

  // 7. 弹窗控制与光影设置
  const [isMerchantOpen, setIsMerchantOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [epiphanyBlueprint, setEpiphanyBlueprint] = useState<BlueprintDef | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [lightingConfig, setLightingConfig] = useState<LightingConfig>(() => {
    const saved = localStorage.getItem('blacksmith_lighting');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_LIGHTING_CONFIG;
  });

  const handleUpdateLighting = (cfg: LightingConfig) => {
    setLightingConfig(cfg);
    localStorage.setItem('blacksmith_lighting', JSON.stringify(cfg));
  };

  // 记录日志
  const addLog = useCallback((text: string, type: LogMessage['type'] = 'info') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLogs((prev) => [{ id: Math.random().toString(36).substring(2, 9), timestamp: timeStr, text, type }, ...prev.slice(0, 40)]);
  }, []);

  // 存储持久化
  useEffect(() => {
    localStorage.setItem('blacksmith_gold', gold.toString());
    localStorage.setItem('blacksmith_level', masteryLevel.toString());
    localStorage.setItem('blacksmith_inventory', JSON.stringify(inventory));
    localStorage.setItem('blacksmith_blueprints', JSON.stringify(unlockedBlueprints));
  }, [gold, masteryLevel, inventory, unlockedBlueprints]);

  // 云游商人倒计时定时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (merchantActive) {
        setMerchantStayRemaining((prev) => {
          if (prev <= 1) {
            // 商人离开
            setMerchantActive(false);
            addLog('云游商人已收拾行囊起程远行，期待下次造访。', 'info');
            return WANDERING_MERCHANT_STAY_SECONDS;
          }
          return prev - 1;
        });
      } else {
        setMerchantArrivalCountdown((prev) => {
          if (prev <= 1) {
            // 商人抵达！
            setMerchantActive(true);
            sound.playMerchantBell();
            addLog('🔔 叮咚！云游商人的驼队已抵达门前，带来了稀世奇珍！', 'epiphany');
            return WANDERING_MERCHANT_INTERVAL_SECONDS;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [merchantActive, addLog]);

  // 增加熟练度经验
  const addMasteryExp = useCallback((exp: number) => {
    setMasteryExp((prev) => {
      const nextExp = prev + exp;
      if (nextExp >= masteryMaxExp) {
        setMasteryLevel((lvl) => {
          const newLvl = lvl + 1;
          addLog(`🎉 恭喜！工匠熟练度晋升至 Lv.${newLvl}！`, 'success');
          return newLvl;
        });
        return nextExp - masteryMaxExp;
      }
      return nextExp;
    });
  }, [masteryMaxExp, addLog]);

  // 从商会购买原料
  const handleBuyMaterial = (matId: MaterialId, quantity: number) => {
    const mat = MATERIALS[matId];
    const totalCost = mat.guildBuyPrice * quantity;
    if (gold < totalCost) {
      addLog(`金币不足！购买 ${mat.name} x${quantity} 需 $${totalCost} G`, 'alert');
      return;
    }

    setGold((prev) => prev - totalCost);
    setInventory((prev) => ({
      ...prev,
      [matId]: (prev[matId] || 0) + quantity,
    }));
    sound.playCoinSound();
    addLog(`从商会统购进货 ${mat.name} x${quantity}，共耗资 $${totalCost} G`, 'gold');
  };

  // 从商会购买图纸
  const handleBuyBlueprint = (bpId: string, cost: number) => {
    if (gold < cost) {
      addLog(`金币不足！解锁图纸需 $${cost} G`, 'alert');
      return;
    }

    setGold((prev) => prev - cost);
    setUnlockedBlueprints((prev) => [...prev, bpId]);
    setSelectedBlueprintId(bpId as BlueprintId);
    sound.playCoinSound();
    addLog(`在商会资历处成功认证研读全新图纸：【${BLUEPRINTS[bpId as BlueprintId]?.name}】！`, 'success');
    addMasteryExp(50);
  };

  // 云游商人购买商品
  const handleBuyMerchantItem = (item: WanderingMerchantItem) => {
    if (gold < item.price || item.stock <= 0) return;

    setGold((prev) => prev - item.price);

    // 扣减库存
    setMerchantStock((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, stock: i.stock - 1 } : i))
    );

    if (item.type === 'material') {
      const matId = item.targetId as MaterialId;
      setInventory((prev) => ({
        ...prev,
        [matId]: (prev[matId] || 0) + 1,
      }));
      addLog(`淘得云游商人稀奇材料：【${item.name}】，耗资 $${item.price} G`, 'gold');
    } else if (item.type === 'blueprint') {
      const bpId = item.targetId as BlueprintId;
      if (!unlockedBlueprints.includes(bpId)) {
        setUnlockedBlueprints((prev) => [...prev, bpId]);
        setSelectedBlueprintId(bpId);
        addLog(`从云游商人手中高价购得失传秘卷：【${item.name}】！`, 'epiphany');
        addMasteryExp(100);
      }
    }
  };

  // 开始打铁（扣除原料）
  const handleStartForge = () => {
    const bp = BLUEPRINTS[selectedBlueprintId];
    // 检查并扣除
    setInventory((prev) => {
      const updated = { ...prev };
      for (const [matId, needed] of Object.entries(bp.recipe)) {
        updated[matId as MaterialId] = (updated[matId as MaterialId] || 0) - (needed || 0);
      }
      return updated;
    });

    addLog(`投入原料并点燃熔炉，开始淬火敲打【${bp.name}】！`, 'info');
  };

  // 完成打铁（计算品质、价格、词缀及灵光一闪）
  const handleFinishForge = (totalScore: number) => {
    const bp = BLUEPRINTS[selectedBlueprintId];

    // 品质判定
    let qualityTier: QualityTier = 'normal';
    if (totalScore >= QUALITY_CONFIGS.legendary.minScore) {
      qualityTier = 'legendary';
    } else if (totalScore >= QUALITY_CONFIGS.masterwork.minScore) {
      qualityTier = 'masterwork';
    } else if (totalScore >= QUALITY_CONFIGS.fine.minScore) {
      qualityTier = 'fine';
    }

    const qConfig = QUALITY_CONFIGS[qualityTier];

    // 属性聚合计算
    let totalAtk = 15;
    let totalWeight = 2.0;
    let totalSpeed = 1.0;
    let totalCrit = 0.05;
    let totalParry = 5;

    for (const [matId, count] of Object.entries(bp.recipe)) {
      const mat = MATERIALS[matId as MaterialId];
      if (mat) {
        totalAtk += mat.affixes.atkBonus * (count || 1);
        totalWeight += mat.affixes.weightBonus * (count || 1);
        totalSpeed *= Math.pow(mat.affixes.speedBonus, count || 1);
        totalCrit += mat.affixes.critBonus * (count || 1);
        totalParry += (mat.affixes.parryBonus || 0) * (count || 1);
      }
    }

    // 品质系数加成
    totalAtk = Math.round(totalAtk * (1 + (qConfig.multiplier - 1) * 0.5));

    // 成品回收价结算公式：
    // 成品回收价 = 图纸基准收购价 × 锻造质量倍率
    const finalGuildPrice = Math.round(bp.guildBaseSellPrice * qConfig.multiplier);

    const weapon: ForgedWeapon = {
      id: Math.random().toString(36).substring(2, 9),
      blueprintId: bp.id,
      name: `${bp.name}`,
      rarity: bp.rarity,
      quality: qualityTier,
      qualityMultiplier: qConfig.multiplier,
      forgedScore: totalScore,
      stats: {
        atk: totalAtk,
        weight: parseFloat(totalWeight.toFixed(1)),
        speed: parseFloat(totalSpeed.toFixed(2)),
        crit: parseFloat(totalCrit.toFixed(2)),
        parry: totalParry,
      },
      guildPrice: finalGuildPrice,
      slots: bp.slots,
      slotMaterials: {},
      materialsUsed: bp.recipe,
      createdAt: Date.now(),
    };

    setCurrentWeapon(weapon);
    setStats((prev) => ({
      ...prev,
      weaponsForged: prev.weaponsForged + 1,
    }));

    addMasteryExp(25);
    addLog(`锻造大功告成！诞生出【${qConfig.label}】${weapon.name} (商会估价: $${finalGuildPrice} G)`, 'success');

    // ★ 核心机制：概率触发【灵光一闪】(自动领悟高阶图纸)
    if (bp.epiphanyUnlocks && !unlockedBlueprints.includes(bp.epiphanyUnlocks)) {
      const roll = Math.random();
      if (roll < bp.epiphanyRate) {
        const nextBp = BLUEPRINTS[bp.epiphanyUnlocks];
        setUnlockedBlueprints((prev) => [...prev, nextBp.id]);
        setEpiphanyBlueprint(nextBp);
        setStats((prev) => ({
          ...prev,
          epiphaniesUnlocked: prev.epiphaniesUnlocked + 1,
        }));
        addMasteryExp(100);
        addLog(`⚡【灵光一闪】铁砧火光如惊雷划过心头，你顿悟了传世古谱【${nextBp.name}】！`, 'epiphany');
      }
    }
  };

  // 成品一键交割商会
  const handleDeliverWeapon = () => {
    if (!currentWeapon) return;

    const payout = currentWeapon.guildPrice;
    setGold((prev) => prev + payout);
    setStats((prev) => ({
      ...prev,
      weaponsSold: prev.weaponsSold + 1,
      goldEarned: prev.goldEarned + payout,
    }));

    addLog(`商会全额包销交割【${currentWeapon.name}】，获得现款 +$${payout} G！`, 'gold');
    setCurrentWeapon(null);
    addMasteryExp(35);
  };

  // 试刀砍木桩 (伤害计算)
  const handleTestStrike = () => {
    if (!currentWeapon) {
      return { damage: 10, isCrit: false };
    }

    const isCrit = Math.random() < currentWeapon.stats.crit;
    const baseDamage = currentWeapon.stats.atk;
    const finalDamage = Math.round(isCrit ? baseDamage * 2.15 : baseDamage * (0.9 + Math.random() * 0.2));

    setStats((prev) => ({
      ...prev,
      dummyStrikes: prev.dummyStrikes + 1,
      maxDamageDealt: Math.max(prev.maxDamageDealt, finalDamage),
    }));

    addLog(`试刀斩击！剑锋在木桩上劈出 ${finalDamage} 点${isCrit ? '暴击' : ''}伤害！`, 'info');
    return { damage: finalDamage, isCrit };
  };

  // 缺料快捷商会补进
  const handleQuickBuyMissing = (matId: MaterialId) => {
    handleBuyMaterial(matId, 1);
  };

  const activeBlueprint = BLUEPRINTS[selectedBlueprintId];

  return (
    <div className="w-screen h-screen flex flex-col bg-forge-900 text-slate-100 font-sans overflow-hidden select-none">
      {/* 顶部状态栏 */}
      <HeaderBar
        gold={gold}
        masteryLevel={masteryLevel}
        masteryExp={masteryExp}
        masteryMaxExp={masteryMaxExp}
        merchantActive={merchantActive}
        merchantArrivalCountdown={merchantArrivalCountdown}
        merchantStayRemaining={merchantStayRemaining}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const newState = sound.toggleMute();
          setSoundEnabled(newState);
        }}
        onOpenMerchant={() => setIsMerchantOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* 单屏主体三栏工作区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：商会业务区 */}
        <GuildPanel
          gold={gold}
          inventory={inventory}
          unlockedBlueprints={unlockedBlueprints}
          currentWeapon={currentWeapon}
          onBuyMaterial={handleBuyMaterial}
          onBuyBlueprint={handleBuyBlueprint}
          onDeliverWeapon={handleDeliverWeapon}
          onSelectBlueprint={(bpId) => setSelectedBlueprintId(bpId as BlueprintId)}
        />

        {/* 中央：3D 装配与铁砧视口 */}
        <ForgeViewport
          blueprint={activeBlueprint}
          inventory={inventory}
          currentWeapon={currentWeapon}
          lightingConfig={lightingConfig}
          onUpdateLighting={handleUpdateLighting}
          onStartForge={handleStartForge}
          onFinishForge={handleFinishForge}
          onTestStrike={handleTestStrike}
          onQuickBuyMissing={handleQuickBuyMissing}
        />

        {/* 右侧：工匠台账 */}
        <LedgerPanel
          unlockedBlueprints={unlockedBlueprints}
          selectedBlueprintId={selectedBlueprintId}
          inventory={inventory}
          stats={stats}
          logs={logs}
          onSelectBlueprint={(bpId) => setSelectedBlueprintId(bpId)}
        />
      </div>

      {/* 弹窗浮层：云游商人特卖会 */}
      <WanderingMerchantModal
        isOpen={isMerchantOpen}
        gold={gold}
        timeRemaining={merchantStayRemaining}
        stock={merchantStock}
        unlockedBlueprints={unlockedBlueprints}
        onClose={() => setIsMerchantOpen(false)}
        onBuyItem={handleBuyMerchantItem}
      />

      {/* 灵光一闪神圣顿悟浮层 */}
      <EpiphanyModal
        blueprint={epiphanyBlueprint}
        onClose={() => setEpiphanyBlueprint(null)}
      />

      {/* 工匠指南与技术架构科普 */}
      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
};
