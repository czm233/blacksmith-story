import React from 'react';
import { Landmark, PackagePlus, CheckCircle2, ChevronRight, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import { BlueprintDef, ForgedWeapon, MaterialDef, MaterialId } from '../types/game';
import { MATERIALS, BLUEPRINTS, QUALITY_CONFIGS, RARITY_COLORS } from '../data/constants';
import { sound } from '../utils/audio';

interface GuildPanelProps {
  gold: number;
  inventory: Record<MaterialId, number>;
  unlockedBlueprints: string[];
  currentWeapon: ForgedWeapon | null;
  onBuyMaterial: (matId: MaterialId, quantity: number) => void;
  onBuyBlueprint: (bpId: string, cost: number) => void;
  onDeliverWeapon: () => void;
  onSelectBlueprint: (bpId: string) => void;
}

export const GuildPanel: React.FC<GuildPanelProps> = ({
  gold,
  inventory,
  unlockedBlueprints,
  currentWeapon,
  onBuyMaterial,
  onBuyBlueprint,
  onDeliverWeapon,
  onSelectBlueprint,
}) => {
  // 商会统购原料列表 (除了稀有陨石由云游商人兜售)
  const availableMaterials: MaterialId[] = ['oak_wood', 'iron_ingot', 'steel_ingot'];

  // 商会图纸
  const guildBlueprints = Object.values(BLUEPRINTS).filter(
    (bp) => bp.guildUnlockPrice && bp.guildUnlockPrice > 0
  );

  return (
    <aside className="w-80 h-full bg-forge-800/90 border-r border-forge-border flex flex-col justify-between overflow-y-auto p-3.5 space-y-4 select-none backdrop-blur-md">
      {/* 头部：商会招牌 */}
      <div className="flex items-center space-x-2 pb-2.5 border-b border-forge-border">
        <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Landmark className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-100 font-fantasy tracking-wide">本地商会柜台</h2>
          <p className="text-[10px] text-slate-400">统购包销 · 原料平价供应 · 成品秒结</p>
        </div>
      </div>

      {/* 1. 原料进货柜台 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-200/90 flex items-center gap-1">
            <PackagePlus className="w-3.5 h-3.5 text-amber-400" />
            原料进货柜台
          </span>
          <span className="text-[10px] text-slate-400">商会统一定价</span>
        </div>

        <div className="space-y-2">
          {availableMaterials.map((matId) => {
            const mat = MATERIALS[matId];
            const canAffordOne = gold >= mat.guildBuyPrice;
            const canAffordFive = gold >= mat.guildBuyPrice * 5;

            return (
              <div
                key={matId}
                className="bg-forge-900/90 border border-slate-700/80 rounded-lg p-2.5 flex items-center justify-between transition-colors hover:border-slate-600"
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center border text-xs font-bold shadow-sm"
                    style={{
                      backgroundColor: `${mat.visual.color}33`,
                      borderColor: mat.visual.color,
                      color: mat.visual.color
                    }}
                  >
                    {mat.category === 'wood' ? '🪵' : '⛏️'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {mat.name}
                      <span className="text-[10px] font-mono text-amber-400 font-normal">
                        ${mat.guildBuyPrice} G
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {mat.statDesc}
                    </div>
                  </div>
                </div>

                {/* 购买按钮组合 */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      sound.playClick();
                      onBuyMaterial(matId, 1);
                    }}
                    disabled={!canAffordOne}
                    className="px-2 py-1 bg-forge-700 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-forge-700 text-slate-100 rounded text-xs font-medium transition-colors"
                    title={`花费 $${mat.guildBuyPrice} G 购入 1 件`}
                  >
                    +1
                  </button>
                  <button
                    onClick={() => {
                      sound.playClick();
                      onBuyMaterial(matId, 5);
                    }}
                    disabled={!canAffordFive}
                    className="px-2 py-1 bg-forge-700 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-forge-700 text-slate-100 rounded text-xs font-medium transition-colors"
                    title={`花费 $${mat.guildBuyPrice * 5} G 购入 5 件`}
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 商会图纸柜台 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            商会官方图纸
          </span>
          <span className="text-[10px] text-slate-400">资历认证直购</span>
        </div>

        <div className="space-y-1.5">
          {guildBlueprints.map((bp) => {
            const isUnlocked = unlockedBlueprints.includes(bp.id);
            const canAfford = gold >= (bp.guildUnlockPrice || 0);
            const rarityStyle = RARITY_COLORS[bp.rarity];

            return (
              <div
                key={bp.id}
                className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                  isUnlocked
                    ? 'bg-forge-900/40 border-slate-800 text-slate-400'
                    : 'bg-forge-900/90 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rarityStyle.border} ${rarityStyle.text}`}>
                    {rarityStyle.name}
                  </span>
                  <div>
                    <span className="font-medium text-slate-200">{bp.name}</span>
                    <div className="text-[10px] text-slate-400">{bp.slots.length} 部件插槽规范</div>
                  </div>
                </div>

                {isUnlocked ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 已研读
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onBuyBlueprint(bp.id, bp.guildUnlockPrice || 0);
                    }}
                    disabled={!canAfford}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 font-bold rounded text-xs transition-colors flex items-center gap-1"
                  >
                    <span>${bp.guildUnlockPrice} G</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 成品交割处 (核心闭环步骤4: 统购包销 秒结金币) */}
      <section className="bg-gradient-to-b from-forge-900/95 to-forge-900/80 border-2 border-amber-500/40 rounded-xl p-3 shadow-glow-amber space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-forge-border">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            成品交割处 (包销秒结)
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
            无拒收政策
          </span>
        </div>

        {currentWeapon ? (
          <div className="space-y-2.5">
            {/* 武器名与品质徽章 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <span>{currentWeapon.name}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  插槽部件: {currentWeapon.slots.join(' + ')}
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded text-xs font-bold border"
                style={{
                  color: QUALITY_CONFIGS[currentWeapon.quality].color,
                  borderColor: QUALITY_CONFIGS[currentWeapon.quality].color,
                  backgroundColor: `${QUALITY_CONFIGS[currentWeapon.quality].color}20`
                }}
              >
                {QUALITY_CONFIGS[currentWeapon.quality].label}品级 (x{currentWeapon.qualityMultiplier})
              </span>
            </div>

            {/* 属性面板简览 */}
            <div className="grid grid-cols-4 gap-1 bg-forge-800/80 p-2 rounded-lg text-center text-[10px]">
              <div>
                <span className="text-slate-400 block">攻击</span>
                <span className="text-amber-400 font-bold font-mono">+{currentWeapon.stats.atk}</span>
              </div>
              <div>
                <span className="text-slate-400 block">攻速</span>
                <span className="text-sky-400 font-bold font-mono">{currentWeapon.stats.speed.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">暴击</span>
                <span className="text-rose-400 font-bold font-mono">{(currentWeapon.stats.crit * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-slate-400 block">格挡</span>
                <span className="text-emerald-400 font-bold font-mono">{currentWeapon.stats.parry}</span>
              </div>
            </div>

            {/* 商会估价计算公式呈现 */}
            <div className="bg-forge-800/50 p-2 rounded border border-slate-700/60 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>商会估价公式</span>
                <span className="font-mono">基准 × 品质倍率</span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-700/50">
                <span className="text-xs font-semibold text-slate-200">最终收割款</span>
                <span className="text-lg font-black text-amber-300 font-mono">
                  ${currentWeapon.guildPrice} <span className="text-xs font-normal">G</span>
                </span>
              </div>
            </div>

            {/* 一键交割按钮 */}
            <button
              onClick={() => {
                sound.playCoinSound();
                onDeliverWeapon();
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg shadow-glow-gold transition-all transform active:scale-95 flex items-center justify-center space-x-1.5 text-xs"
            >
              <span>一键交付商会 (+ ${currentWeapon.guildPrice} G)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="py-6 px-3 text-center space-y-2 border border-dashed border-slate-700 rounded-lg">
            <AlertCircle className="w-7 h-7 text-slate-500 mx-auto" />
            <div className="text-xs text-slate-300 font-medium">台面暂无完成品</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              在右侧选定图纸，并在中央铁砧敲击锻造完成后，即可在此全额结算交割。
            </p>
          </div>
        )}
      </section>
    </aside>
  );
};
