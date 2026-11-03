import React, { useState } from 'react';
import { BookOpen, Warehouse, History, Sparkles, Check, ChevronRight, Layers, Flame } from 'lucide-react';
import { BlueprintDef, BlueprintId, LogMessage, MaterialId, PlayerStats, Rarity } from '../types/game';
import { BLUEPRINTS, MATERIALS, RARITY_COLORS } from '../data/constants';
import { sound } from '../utils/audio';

interface LedgerPanelProps {
  unlockedBlueprints: string[];
  selectedBlueprintId: BlueprintId;
  inventory: Record<MaterialId, number>;
  stats: PlayerStats;
  logs: LogMessage[];
  onSelectBlueprint: (bpId: BlueprintId) => void;
}

export const LedgerPanel: React.FC<LedgerPanelProps> = ({
  unlockedBlueprints,
  selectedBlueprintId,
  inventory,
  stats,
  logs,
  onSelectBlueprint,
}) => {
  const [activeTab, setActiveTab] = useState<'blueprints' | 'inventory' | 'history'>('blueprints');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');

  // 图纸过滤
  const allUnlockedDefs = unlockedBlueprints
    .map((id) => BLUEPRINTS[id as BlueprintId])
    .filter(Boolean);

  const filteredBlueprints = allUnlockedDefs.filter((bp) => {
    if (rarityFilter === 'all') return true;
    return bp.rarity === rarityFilter;
  });

  return (
    <aside className="w-84 h-full bg-forge-800/90 border-l border-forge-border flex flex-col justify-between overflow-hidden select-none backdrop-blur-md">
      {/* 顶部二级导航 Tabs */}
      <div className="flex border-b border-forge-border bg-forge-900/60 p-1">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('blueprints');
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'blueprints'
              ? 'bg-forge-700 text-amber-300 shadow-sm border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>已掌握图纸</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('inventory');
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'inventory'
              ? 'bg-forge-700 text-amber-300 shadow-sm border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          <span>材料仓库</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('history');
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'history'
              ? 'bg-forge-700 text-amber-300 shadow-sm border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>工坊台账</span>
        </button>
      </div>

      {/* Tab 1: 已掌握图纸 */}
      {activeTab === 'blueprints' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 品质过滤按钮条 */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px]">
            {(['all', 'white', 'green', 'blue', 'purple', 'orange'] as const).map((rarity) => (
              <button
                key={rarity}
                onClick={() => setRarityFilter(rarity)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  rarityFilter === rarity
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-forge-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {rarity === 'all' ? '全部' : RARITY_COLORS[rarity].name}
              </button>
            ))}
          </div>

          {/* 图纸列表 */}
          <div className="space-y-2.5">
            {filteredBlueprints.map((bp) => {
              const isSelected = selectedBlueprintId === bp.id;
              const rStyle = RARITY_COLORS[bp.rarity];

              return (
                <div
                  key={bp.id}
                  onClick={() => {
                    sound.playClick();
                    onSelectBlueprint(bp.id);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? `bg-forge-900 border-2 ${rStyle.border} shadow-lg shadow-amber-500/10`
                      : 'bg-forge-900/70 border-slate-700/80 hover:border-slate-500'
                  }`}
                >
                  {/* 选定指示角标 */}
                  {isSelected && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-bl-lg font-black text-[9px] flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> 当前选定
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rStyle.border} ${rStyle.text}`}>
                      {rStyle.name}
                    </span>
                    <h3 className="text-xs font-bold text-slate-100">{bp.name}</h3>
                  </div>

                  {/* 插槽树拓扑 */}
                  <div className="mt-1.5 flex items-center text-[10px] text-slate-400 gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>插槽树: {bp.slots.join(' ➔ ')}</span>
                  </div>

                  {/* 原料配方需求与商会基价 */}
                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(bp.recipe).map(([matId, count]) => (
                        <span key={matId} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {MATERIALS[matId as MaterialId].name} x{count}
                        </span>
                      ))}
                    </div>
                    <div className="font-mono text-amber-400 font-bold">
                      ${bp.guildBaseSellPrice} G
                    </div>
                  </div>

                  {/* 灵光一闪概率提示 */}
                  {bp.epiphanyUnlocks && (
                    <div className="mt-1.5 text-[9px] text-amber-300/80 flex items-center gap-1 font-mono">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      <span>锻造可能顿悟更高阶图纸 ({(bp.epiphanyRate * 100).toFixed(1)}%)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: 材料仓库 */}
      {activeTab === 'inventory' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
            <Warehouse className="w-3.5 h-3.5 text-amber-400" />
            <span>工坊原物料实盘</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(MATERIALS) as MaterialId[]).map((matId) => {
              const mat = MATERIALS[matId];
              const count = inventory[matId] || 0;

              return (
                <div
                  key={matId}
                  className="bg-forge-900/90 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center border font-bold text-sm shadow"
                      style={{
                        backgroundColor: `${mat.visual.color}25`,
                        borderColor: mat.visual.color,
                        color: mat.visual.color
                      }}
                    >
                      {mat.category === 'wood' ? '🪵' : mat.category === 'rare' ? '💎' : '⛏️'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{mat.name}</span>
                        {mat.category === 'rare' && (
                          <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                            稀世奇珍
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{mat.visualDesc}</div>
                      <div className="text-[10px] text-amber-400/90">{mat.statDesc}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-slate-200">
                      {count} <span className="text-[10px] font-normal text-slate-400">件</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: 工坊台账与历史 */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 经营成就数据卡 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-forge-900 p-2.5 rounded-lg border border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 block">累计锻造武器</span>
              <span className="text-base font-black text-amber-300 font-mono">{stats.weaponsForged} 把</span>
            </div>
            <div className="bg-forge-900 p-2.5 rounded-lg border border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 block">累计交付营利</span>
              <span className="text-base font-black text-amber-400 font-mono">${stats.goldEarned} G</span>
            </div>
            <div className="bg-forge-900 p-2.5 rounded-lg border border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 block">灵光一闪突破</span>
              <span className="text-base font-black text-sky-400 font-mono">{stats.epiphaniesUnlocked} 次</span>
            </div>
            <div className="bg-forge-900 p-2.5 rounded-lg border border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 block">试刀最高伤害</span>
              <span className="text-base font-black text-rose-400 font-mono">{stats.maxDamageDealt} 伤</span>
            </div>
          </div>

          {/* 实时工坊操作日志 */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <History className="w-3 h-3 text-slate-400" />
              <span>工坊实时日志</span>
            </div>
            <div className="bg-forge-900/90 border border-slate-800 rounded-lg p-2 max-h-56 overflow-y-auto space-y-1.5 font-mono text-[10px]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-1.5 leading-snug">
                  <span className="text-slate-500 shrink-0">{log.timestamp}</span>
                  <span
                    className={
                      log.type === 'epiphany'
                        ? 'text-amber-300 font-bold'
                        : log.type === 'gold'
                        ? 'text-yellow-400'
                        : log.type === 'success'
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 底部装饰标语 */}
      <div className="p-2.5 border-t border-forge-border bg-forge-900/50 text-center text-[10px] text-slate-500 font-serif">
        《铁匠物语》图纸为骨架 · 品质定深度
      </div>
    </aside>
  );
};
