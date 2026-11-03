import React from 'react';
import { X, Sparkles, Clock, ShoppingCart, CheckCircle, ShieldAlert } from 'lucide-react';
import { BlueprintId, MaterialId, Rarity, WanderingMerchantItem } from '../types/game';
import { RARITY_COLORS } from '../data/constants';
import { sound } from '../utils/audio';

interface WanderingMerchantModalProps {
  isOpen: boolean;
  gold: number;
  timeRemaining: number;
  stock: WanderingMerchantItem[];
  unlockedBlueprints: string[];
  onClose: () => void;
  onBuyItem: (item: WanderingMerchantItem) => void;
}

export const WanderingMerchantModal: React.FC<WanderingMerchantModalProps> = ({
  isOpen,
  gold,
  timeRemaining,
  stock,
  unlockedBlueprints,
  onClose,
  onBuyItem,
}) => {
  if (!isOpen) return null;

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl bg-gradient-to-b from-forge-800 to-forge-900 border-2 border-amber-500/60 rounded-2xl shadow-glow-gold overflow-hidden flex flex-col">
        {/* 顶部标题栏 */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 px-5 py-3.5 flex items-center justify-between text-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h2 className="text-base font-black font-fantasy tracking-wide">云游商人特卖会 (限时入市)</h2>
              <p className="text-[11px] font-semibold opacity-90">行商自远东荒原带来的孤品与失落秘卷</p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 倒计时警示条 */}
        <div className="bg-amber-950/80 border-b border-amber-600/40 px-5 py-2 flex items-center justify-between text-xs text-amber-200">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>商队启程离开倒计时:</span>
            <strong className="font-mono text-amber-300 text-sm">{formatSeconds(timeRemaining)}</strong>
          </span>
          <span className="text-[11px] text-amber-400/80">手慢则无 · 错过需等下班商队</span>
        </div>

        {/* 货物清单 */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {stock.map((item) => {
            const isBlueprintUnlocked =
              item.type === 'blueprint' && unlockedBlueprints.includes(item.targetId);
            const canAfford = gold >= item.price && item.stock > 0 && !isBlueprintUnlocked;
            const rStyle = RARITY_COLORS[item.rarity];

            return (
              <div
                key={item.id}
                className="bg-forge-900/90 border border-slate-700/80 hover:border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold border shadow-md"
                    style={{
                      borderColor: rStyle ? undefined : '#f59e0b',
                    }}
                  >
                    {item.type === 'material' ? '💎' : '📜'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-100">{item.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${rStyle.border} ${rStyle.text}`}>
                        {rStyle.name}
                      </span>
                      {item.type === 'material' && (
                        <span className="text-[10px] text-slate-400 font-mono">余量: {item.stock}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-snug">{item.description}</div>
                  </div>
                </div>

                {/* 购买按钮 */}
                <div className="text-right">
                  <div className="text-sm font-black font-mono text-amber-300 mb-1">
                    ${item.price} <span className="text-[10px] font-normal text-slate-400">G</span>
                  </div>

                  {isBlueprintUnlocked ? (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-600/50 text-emerald-400 text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 已研读
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        sound.playCoinSound();
                        onBuyItem(item);
                      }}
                      disabled={!canAfford}
                      className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 disabled:hover:from-amber-500 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 flex items-center gap-1"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>购入</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部信息栏 */}
        <div className="bg-forge-900 px-5 py-3 border-t border-forge-border flex items-center justify-between text-xs text-slate-400">
          <span>当前资金: <strong className="text-amber-400 font-mono">${gold} G</strong></span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-forge-700 hover:bg-forge-600 text-slate-200 text-xs font-medium transition-colors"
          >
            离开商队
          </button>
        </div>
      </div>
    </div>
  );
};
