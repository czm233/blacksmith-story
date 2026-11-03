import React from 'react';
import { Coins, Flame, Volume2, VolumeX, HelpCircle, Sparkles, ShoppingBag } from 'lucide-react';
import { sound } from '../utils/audio';

interface HeaderBarProps {
  gold: number;
  masteryLevel: number;
  masteryExp: number;
  masteryMaxExp: number;
  merchantActive: boolean;
  merchantArrivalCountdown: number;
  merchantStayRemaining: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenMerchant: () => void;
  onOpenGuide: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  gold,
  masteryLevel,
  masteryExp,
  masteryMaxExp,
  merchantActive,
  merchantArrivalCountdown,
  merchantStayRemaining,
  soundEnabled,
  onToggleSound,
  onOpenMerchant,
  onOpenGuide,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const expPercent = Math.min(100, Math.round((masteryExp / masteryMaxExp) * 100));

  return (
    <header className="h-14 bg-forge-800/95 border-b border-forge-border px-4 flex items-center justify-between shadow-md backdrop-blur-md z-30 select-none">
      {/* 标题 & 工匠名号 */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-glow-amber border border-amber-400/40">
          <Flame className="w-5 h-5 text-amber-200 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-wide font-fantasy text-amber-100 flex items-center gap-1.5">
            铁匠物语 <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">工匠与商会</span>
          </h1>
          <p className="text-[10px] text-slate-400 font-mono">Web 3D MVP · 插槽树装配与商会统购</p>
        </div>
      </div>

      {/* 核心数值状态：金币、熟练度、云游商人 */}
      <div className="flex items-center space-x-5">
        {/* 金币总览 */}
        <div className="flex items-center bg-forge-900/90 border border-amber-500/40 px-3.5 py-1.5 rounded-lg shadow-inner">
          <Coins className="w-5 h-5 text-amber-400 mr-2 drop-shadow-sm" />
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-500/80 uppercase font-semibold leading-none">资金储备</span>
            <span className="text-base font-black text-amber-300 font-mono leading-tight tracking-wider">
              {gold.toLocaleString()} <span className="text-xs font-normal text-amber-400/80">G</span>
            </span>
          </div>
        </div>

        {/* 熟练度等级 */}
        <div className="flex items-center bg-forge-900/90 border border-slate-700 px-3 py-1.5 rounded-lg min-w-[150px]">
          <div className="w-7 h-7 rounded bg-amber-950/80 border border-amber-600/50 flex items-center justify-center font-bold text-xs text-amber-400 mr-2.5">
            Lv.{masteryLevel}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5 font-mono">
              <span>工匠造诣</span>
              <span>{masteryExp}/{masteryMaxExp}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 云游商人状态指示器 */}
        {merchantActive ? (
          <button
            onClick={() => {
              sound.playClick();
              onOpenMerchant();
            }}
            className="flex items-center bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-glow-gold animate-bounce transition-transform hover:scale-105"
          >
            <ShoppingBag className="w-4 h-4 mr-1.5" />
            <span>云游商人在此! ({formatTime(merchantStayRemaining)})</span>
            <Sparkles className="w-3.5 h-3.5 ml-1 animate-spin" />
          </button>
        ) : (
          <div 
            onClick={() => {
              sound.playClick();
              onOpenMerchant();
            }}
            className="cursor-pointer flex items-center bg-forge-900/80 border border-slate-700/80 hover:border-amber-500/40 px-3 py-1.5 rounded-lg text-xs text-slate-400 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-amber-500/70 mr-1.5" />
            <span>云游商人:</span>
            <span className="font-mono text-amber-400/90 ml-1.5 font-medium">
              {formatTime(merchantArrivalCountdown)} 后抵达
            </span>
          </div>
        )}
      </div>

      {/* 右侧实用按钮：音效、玩法指南 */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            sound.playClick();
            onOpenGuide();
          }}
          className="p-2 rounded-lg bg-forge-700/60 hover:bg-forge-600 text-slate-300 hover:text-amber-300 border border-slate-700 transition-all flex items-center gap-1 text-xs"
          title="工匠指南与插槽树原理"
        >
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">工匠图说</span>
        </button>

        <button
          onClick={onToggleSound}
          className={`p-2 rounded-lg border transition-all ${
            soundEnabled
              ? 'bg-forge-700/60 hover:bg-forge-600 text-amber-400 border-amber-500/30'
              : 'bg-forge-900 text-slate-500 border-slate-800'
          }`}
          title={soundEnabled ? '关闭音效' : '开启音效'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
