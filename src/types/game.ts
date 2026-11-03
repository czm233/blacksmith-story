export type MaterialId = 'oak_wood' | 'iron_ingot' | 'steel_ingot' | 'meteoric_ore';

export type MaterialCategory = 'wood' | 'metal' | 'rare';

export interface MaterialVisual {
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  clearcoat?: number;
}

export interface MaterialAffixes {
  atkBonus: number;
  weightBonus: number;
  speedBonus: number;
  critBonus: number;
  parryBonus?: number;
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  category: MaterialCategory;
  guildBuyPrice: number;
  visual: MaterialVisual;
  affixes: MaterialAffixes;
  visualDesc: string;
  statDesc: string;
}

export type SlotType = 'Grip' | 'Pommel' | 'Guard' | 'Blade' | 'Gem';

export type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'orange';

export type BlueprintId = 
  | 'bp_apprentice' 
  | 'bp_guard_sword' 
  | 'bp_stiletto' 
  | 'bp_knight_claymore' 
  | 'bp_abyss_slayer';

export interface BlueprintDef {
  id: BlueprintId;
  name: string;
  rarity: Rarity;
  slots: SlotType[];
  recipe: Partial<Record<MaterialId, number>>;
  guildBaseSellPrice: number;
  guildUnlockPrice?: number;
  epiphanyRate: number; // 0.12 = 12%
  epiphanyUnlocks?: BlueprintId;
  sourceDesc: string;
  description: string;
  topologyDesc: string;
}

export type QualityTier = 'normal' | 'fine' | 'masterwork' | 'legendary';

export interface QualityConfig {
  tier: QualityTier;
  label: string;
  multiplier: number;
  color: string;
  minScore: number;
}

export interface WeaponStats {
  atk: number;
  weight: number;
  speed: number;
  crit: number;
  parry: number;
}

export interface ForgedWeapon {
  id: string;
  blueprintId: BlueprintId;
  name: string;
  rarity: Rarity;
  quality: QualityTier;
  qualityMultiplier: number;
  forgedScore: number;
  stats: WeaponStats;
  guildPrice: number;
  slots: SlotType[];
  slotMaterials: Partial<Record<SlotType, MaterialId>>;
  materialsUsed: Partial<Record<MaterialId, number>>;
  createdAt: number;
}

export interface WanderingMerchantItem {
  id: string;
  name: string;
  type: 'material' | 'blueprint';
  targetId: MaterialId | BlueprintId;
  price: number;
  stock: number;
  rarity: Rarity;
  description: string;
}

export interface WanderingMerchantState {
  active: boolean;
  nextArrivalCountdown: number; // seconds until arrival
  stayRemaining: number; // seconds remaining while present
  stock: WanderingMerchantItem[];
}

export interface PlayerStats {
  weaponsForged: number;
  weaponsSold: number;
  goldEarned: number;
  epiphaniesUnlocked: number;
  dummyStrikes: number;
  maxDamageDealt: number;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  text: string;
  type: 'info' | 'success' | 'gold' | 'epiphany' | 'alert';
}

export interface LightingConfig {
  ambientIntensity: number; // 0.5 ~ 4.0
  spotIntensity: number; // 1.0 ~ 8.0
  fireIntensity: number; // 0.5 ~ 8.0
  rimIntensity: number; // 0.5 ~ 6.0
  exposure: number; // 0.8 ~ 2.5
  bgDarkness: number; // 0.0 ~ 1.0
}
