import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Layers, ArrowRight, Award } from 'lucide-react';
import { BlueprintDef } from '../types/game';
import { RARITY_COLORS } from '../data/constants';
import { sound } from '../utils/audio';

interface EpiphanyModalProps {
  blueprint: BlueprintDef | null;
  onClose: () => void;
}

export const EpiphanyModal: React.FC<EpiphanyModalProps> = ({ blueprint, onClose }) => {
  useEffect(() => {
    if (blueprint) {
      sound.playEpiphanyFanfare();

      // 连续两次彩带烟花礼炮
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      const timer = setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [blueprint]);

  if (!blueprint) return null;

  const rStyle = RARITY_COLORS[blueprint.rarity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-amber-950/90 via-forge-900 to-forge-950 border-2 border-amber-400 rounded-3xl p-6 shadow-glow-gold overflow-hidden text-center">
        {/* 背景金光旋转光环 */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* 顶部神圣徽标 */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 p-0.5 shadow-glow-gold flex items-center justify-center mb-4">
          <div className="w-full h-full bg-forge-900 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-9 h-9 text-amber-400 animate-spin" />
          </div>
        </div>

        {/* 标题 */}
        <div className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-widest mb-1.5">
          灵 光 一 闪 · 顿 悟 契 机
        </div>
        <h2 className="text-2xl font-black font-fantasy text-amber-100 tracking-wide">
          领悟更高阶插槽拓扑结构！
        </h2>
        <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
          在日复一日的敲打沉淀中，铁砧的火星点亮了你的匠人灵感，你自动顿悟了传世古谱！
        </p>

        {/* 解锁的图纸展示卡 */}
        <div className="mt-5 p-4 rounded-2xl bg-forge-800/90 border border-amber-500/50 text-left space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${rStyle.border} ${rStyle.text}`}>
                {rStyle.name}图纸
              </span>
              <h3 className="text-base font-bold text-slate-100">{blueprint.name}</h3>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">
              商会统购基价: ${blueprint.guildBaseSellPrice} G
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {blueprint.description}
          </p>

          {/* 插槽结构深度演进 */}
          <div className="bg-forge-900/80 p-2.5 rounded-xl border border-slate-700/80 text-xs space-y-1">
            <div className="text-amber-300 font-semibold flex items-center gap-1 text-[11px]">
              <Layers className="w-3.5 h-3.5" />
              <span>结构拓扑规范: {blueprint.slots.length} 部件深度</span>
            </div>
            <div className="font-mono text-slate-300 text-[11px]">
              {blueprint.slots.join(' ➔ ')}
            </div>
          </div>
        </div>

        {/* 确认关闭按钮 */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="mt-6 w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-sm shadow-glow-gold transition-transform active:scale-98 flex items-center justify-center gap-1.5"
        >
          <span>收录至我的工匠台账</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
