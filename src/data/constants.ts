import { BlueprintDef, BlueprintId, MaterialDef, MaterialId, QualityConfig, QualityTier } from '../types/game';

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  oak_wood: {
    id: 'oak_wood',
    name: '橡木条',
    category: 'wood',
    guildBuyPrice: 3,
    visual: {
      color: '#8b5a2b',
      roughness: 0.85,
      metalness: 0.05,
    },
    affixes: {
      atkBonus: 2,
      weightBonus: 0.8,
      speedBonus: 1.25,
      critBonus: 0.02,
    },
    visualDesc: '哑光棕褐，粗糙度 0.85',
    statDesc: '基础支撑，极轻，高攻速'
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: '生铁锭',
    category: 'metal',
    guildBuyPrice: 5,
    visual: {
      color: '#6b7280',
      roughness: 0.4,
      metalness: 0.82,
    },
    affixes: {
      atkBonus: 10,
      weightBonus: 2.2,
      speedBonus: 1.0,
      critBonus: 0.05,
      parryBonus: 8,
    },
    visualDesc: '铁灰拉丝，金属度 0.8',
    statDesc: '基础攻击 +10，重量中等'
  },
  steel_ingot: {
    id: 'steel_ingot',
    name: '精钢锭',
    category: 'metal',
    guildBuyPrice: 15,
    visual: {
      color: '#e2e8f0',
      roughness: 0.18,
      metalness: 0.96,
      clearcoat: 0.4
    },
    affixes: {
      atkBonus: 26,
      weightBonus: 3.0,
      speedBonus: 0.95,
      critBonus: 0.10,
      parryBonus: 16,
    },
    visualDesc: '银白镜面，金属度 0.95',
    statDesc: '基础攻击 +26，重量 +20%'
  },
  meteoric_ore: {
    id: 'meteoric_ore',
    name: '星陨石',
    category: 'rare',
    guildBuyPrice: 60,
    visual: {
      color: '#1a102f',
      roughness: 0.25,
      metalness: 0.88,
      emissive: '#f59e0b',
      emissiveIntensity: 0.75,
    },
    affixes: {
      atkBonus: 65,
      weightBonus: 4.2,
      speedBonus: 1.1,
      critBonus: 0.22,
      parryBonus: 24,
    },
    visualDesc: '黑金流动，自发微光',
    statDesc: '攻击 +65，暴击率 +22%'
  }
};

export const BLUEPRINTS: Record<BlueprintId, BlueprintDef> = {
  bp_apprentice: {
    id: 'bp_apprentice',
    name: '学徒平刃剑',
    rarity: 'white',
    slots: ['Grip', 'Blade'],
    recipe: {
      oak_wood: 1,
      iron_ingot: 1
    },
    guildBaseSellPrice: 15,
    guildUnlockPrice: 10,
    epiphanyRate: 0.15, // 15% chance to inspire Guard sword
    epiphanyUnlocks: 'bp_guard_sword',
    sourceDesc: '开局自带 / 商会 $10',
    description: '铁匠学徒的入门之作，省去护手直接铸合，轻便朴素。',
    topologyDesc: '⚪ 2 部件：[握柄 + 剑身] (剑身直接吸附至握柄顶槽)'
  },
  bp_guard_sword: {
    id: 'bp_guard_sword',
    name: '卫兵十字剑',
    rarity: 'green',
    slots: ['Grip', 'Guard', 'Blade'],
    recipe: {
      oak_wood: 1,
      iron_ingot: 2
    },
    guildBaseSellPrice: 45,
    guildUnlockPrice: 50,
    epiphanyRate: 0.08, // 8% chance to inspire Stiletto
    epiphanyUnlocks: 'bp_stiletto',
    sourceDesc: '商会 $50 / 锻造领悟 (12%)',
    description: '城镇守卫标准佩剑，宽阔十字护手提供了可靠的架招防御。',
    topologyDesc: '🟢 3 部件：[握柄 + 护手 + 剑身] (标准十字防具结构)'
  },
  bp_stiletto: {
    id: 'bp_stiletto',
    name: '精钢刺剑',
    rarity: 'blue',
    slots: ['Grip', 'Guard', 'Blade'],
    recipe: {
      oak_wood: 1,
      steel_ingot: 2
    },
    guildBaseSellPrice: 150,
    epiphanyRate: 0.04, // 4% chance to inspire Knight claymore
    epiphanyUnlocks: 'bp_knight_claymore',
    sourceDesc: '锻造领悟 (3%) / 云游商人 $120',
    description: '采用高纯度精钢淬炼，细长剑脊带来极强的破甲穿透力。',
    topologyDesc: '🔵 3 部件：[细握柄 + 环状护手 + 菱形刺刃]'
  },
  bp_knight_claymore: {
    id: 'bp_knight_claymore',
    name: '骑士重阔剑',
    rarity: 'purple',
    slots: ['Grip', 'Pommel', 'Guard', 'Blade'],
    recipe: {
      oak_wood: 1,
      iron_ingot: 1,
      steel_ingot: 2
    },
    guildBaseSellPrice: 340,
    guildUnlockPrice: 280,
    epiphanyRate: 0.015, // 1.5% chance to inspire Abyss Slayer
    epiphanyUnlocks: 'bp_abyss_slayer',
    sourceDesc: '商会 $280 / 锻造领悟 (2%)',
    description: '加装了实心配重球的双后掠翼大剑，劈砍重心调校极其优越。',
    topologyDesc: '🟣 4 部件：[长握柄 + 钢制配重球 + 战翼护手 + 破甲阔刃]'
  },
  bp_abyss_slayer: {
    id: 'bp_abyss_slayer',
    name: '渊火巨剑',
    rarity: 'orange',
    slots: ['Grip', 'Pommel', 'Guard', 'Blade', 'Gem'],
    recipe: {
      steel_ingot: 2,
      meteoric_ore: 2
    },
    guildBaseSellPrice: 680,
    epiphanyRate: 0.003, // 0.3%
    sourceDesc: '云游商人 $500 / 锻造领悟 (0.3%)',
    description: '镶嵌星陨炎晶的古代神兵，狂暴的高温热浪撕裂一切重装护甲。',
    topologyDesc: '🟠 5 部件：[龙纹握柄 + 铸炎配重球 + 炽流护手 + 锯齿巨刃 + 熔岩星核]'
  }
};

export const QUALITY_CONFIGS: Record<QualityTier, QualityConfig> = {
  normal: {
    tier: 'normal',
    label: '普通',
    multiplier: 1.0,
    color: '#9ca3af',
    minScore: 0
  },
  fine: {
    tier: 'fine',
    label: '良品',
    multiplier: 1.25,
    color: '#22c55e',
    minScore: 50
  },
  masterwork: {
    tier: 'masterwork',
    label: '极品',
    multiplier: 1.6,
    color: '#3b82f6',
    minScore: 80
  },
  legendary: {
    tier: 'legendary',
    label: '传世',
    multiplier: 2.2,
    color: '#f59e0b',
    minScore: 95
  }
};

export const RARITY_COLORS: Record<string, { text: string; bg: string; border: string; glow: string; name: string }> = {
  white: { text: 'text-slate-200', bg: 'bg-slate-800/80', border: 'border-slate-500', glow: 'shadow-slate-500/30', name: '学徒' },
  green: { text: 'text-emerald-400', bg: 'bg-emerald-950/70', border: 'border-emerald-500', glow: 'shadow-emerald-500/30', name: '工匠' },
  blue: { text: 'text-sky-400', bg: 'bg-sky-950/70', border: 'border-sky-500', glow: 'shadow-sky-500/30', name: '精工' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-950/70', border: 'border-purple-500', glow: 'shadow-purple-500/30', name: '大师' },
  orange: { text: 'text-amber-400', bg: 'bg-amber-950/70', border: 'border-amber-500', glow: 'shadow-amber-500/40', name: '神兵' }
};

export const INITIAL_GOLD = 150;
export const WANDERING_MERCHANT_INTERVAL_SECONDS = 90; // Arrives every 90s
export const WANDERING_MERCHANT_STAY_SECONDS = 45; // Stays for 45s
