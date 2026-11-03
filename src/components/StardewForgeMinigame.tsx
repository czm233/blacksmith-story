import React, { useEffect, useRef, useState } from 'react';
import { Hammer, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { BlueprintDef, Rarity } from '../types/game';
import { sound } from '../utils/audio';

interface StardewForgeMinigameProps {
  blueprint: BlueprintDef;
  onHammerTap: (isPerfect: boolean) => void;
  onProgressUpdate: (progress: number) => void;
  onComplete: (score: number) => void;
}

export const StardewForgeMinigame: React.FC<StardewForgeMinigameProps> = ({
  blueprint,
  onHammerTap,
  onProgressUpdate,
  onComplete,
}) => {
  // 根据图纸稀有度设定难度参数
  const getDifficultySettings = (rarity: Rarity) => {
    switch (rarity) {
      case 'white':
        return { barHeight: 32, targetSpeed: 0.55, erraticness: 0.15, fillRate: 18, decayRate: 4 };
      case 'green':
        return { barHeight: 27, targetSpeed: 0.85, erraticness: 0.35, fillRate: 16, decayRate: 5 };
      case 'blue':
        return { barHeight: 22, targetSpeed: 1.25, erraticness: 0.65, fillRate: 15, decayRate: 6 };
      case 'purple':
        return { barHeight: 18, targetSpeed: 1.65, erraticness: 0.85, fillRate: 14, decayRate: 7 };
      case 'orange':
        return { barHeight: 14, targetSpeed: 2.15, erraticness: 1.2, fillRate: 13, decayRate: 8 };
      default:
        return { barHeight: 25, targetSpeed: 1.0, erraticness: 0.5, fillRate: 15, decayRate: 5 };
    }
  };

  const diff = getDifficultySettings(blueprint.rarity);

  // 物理状态
  const [playerY, setPlayerY] = useState(20); // 0 ~ 100 - barHeight
  const [targetY, setTargetY] = useState(50); // 0 ~ 100
  const [progress, setProgress] = useState(15); // 0 ~ 100%
  const [isInZone, setIsInZone] = useState(false);

  // 引用变量供 RAF 物理循环使用
  const playerYRef = useRef(20);
  const playerVelRef = useRef(0);
  const targetYRef = useRef(50);
  const targetVelRef = useRef(0.4);
  const targetDestRef = useRef(50);
  const progressRef = useRef(15);
  const isMouseDownRef = useRef(false);
  const inZoneRef = useRef(false);
  const totalInZoneTimeRef = useRef(0);
  const totalTimeRef = useRef(0);
  const isFinishedRef = useRef(false);

  // 触发单次挥锤敲打并传递音效与3D特效 (按一下敲一锤)
  const handleStrike = (isPerfect: boolean = false) => {
    if (isFinishedRef.current) return;
    sound.playHammerHit(isPerfect, true);
    onHammerTap(isPerfect);
    // 给打铁控温条施加一次向上的跳动力
    playerVelRef.current += 1.8;
  };

  // 监听键盘空格打铁 (按一下敲一锤，按住不连击)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return; // 必须松开再按，防止按住连发
        handleStrike(inZoneRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 主物理与游标逻辑循环 (60FPS)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (isFinishedRef.current) return;

      totalTimeRef.current += dt;

      // 1. 玩家打铁控温槽物理运动 (重力 + 浮力)
      const gravity = 55; // 像素/秒^2
      const upwardThrust = 78;

      if (isMouseDownRef.current) {
        // 长按仅提供平稳向上浮力控温，不自动连续挥锤！
        playerVelRef.current += upwardThrust * dt;
      }

      playerVelRef.current -= gravity * dt;
      playerYRef.current += playerVelRef.current * dt * 2.2;

      // 边界碰撞与弹性缓冲
      const maxY = 100 - diff.barHeight;
      if (playerYRef.current <= 0) {
        playerYRef.current = 0;
        playerVelRef.current = -playerVelRef.current * 0.25;
      } else if (playerYRef.current >= maxY) {
        playerYRef.current = maxY;
        playerVelRef.current = -playerVelRef.current * 0.15;
      }

      // 2. 淬火温区目标 (类似星露谷游鱼 AI)
      if (Math.abs(targetYRef.current - targetDestRef.current) < 2 || Math.random() < diff.erraticness * dt * 2.5) {
        // 随机选择新的温区目标
        targetDestRef.current = 10 + Math.random() * 80;
        const dir = targetDestRef.current > targetYRef.current ? 1 : -1;
        targetVelRef.current = dir * (20 + Math.random() * 35) * diff.targetSpeed;
      }

      targetYRef.current += targetVelRef.current * dt;
      targetYRef.current = Math.max(5, Math.min(95, targetYRef.current));

      // 3. 判断是否在有效温区内 (Target inside Player Bar)
      const isInside =
        targetYRef.current >= playerYRef.current - 2 &&
        targetYRef.current <= playerYRef.current + diff.barHeight + 2;

      inZoneRef.current = isInside;
      setIsInZone(isInside);

      if (isInside) {
        totalInZoneTimeRef.current += dt;
        progressRef.current += diff.fillRate * dt;
      } else {
        progressRef.current -= diff.decayRate * dt;
      }

      progressRef.current = Math.max(0, Math.min(100, progressRef.current));

      // 通知 3D 场景同步更新粗胚变形进度
      onProgressUpdate(progressRef.current / 100);

      setPlayerY(playerYRef.current);
      setTargetY(targetYRef.current);
      setProgress(progressRef.current);

      // 4. 判定完成 (100% 打造成功)
      if (progressRef.current >= 100) {
        isFinishedRef.current = true;
        const accuracyScore = Math.round((totalInZoneTimeRef.current / Math.max(0.1, totalTimeRef.current)) * 100);
        onComplete(accuracyScore);
        return;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [blueprint.rarity]);

  return (
    <div
      onMouseDown={() => {
        isMouseDownRef.current = true;
        handleStrike(inZoneRef.current);
      }}
      onMouseUp={() => {
        isMouseDownRef.current = false;
      }}
      className="flex items-center gap-4 bg-forge-900/95 backdrop-blur-xl border-2 border-amber-500/70 p-4 rounded-2xl shadow-2xl select-none cursor-pointer"
      title="点击鼠标或按空格打铁！长按可升温浮起，维持温区游标在铁砧槽内！"
    >
      {/* 左侧：说明与当前状态 */}
      <div className="w-48 text-left space-y-2">
        <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs font-fantasy">
          <Hammer className="w-4 h-4 animate-bounce text-amber-400" />
          <span>淬火打铁锻造中</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-snug">
          点击鼠标或按空格<strong>按一下敲一锤</strong>，长按平稳维持浮力，将<strong>淬火温核</strong>维持在槽内！
        </p>
        <div className="text-[10px] bg-forge-800 p-2 rounded-lg border border-slate-700/80 space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>图纸难度:</span>
            <span className="font-bold text-amber-300 uppercase">{blueprint.rarity}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>当前温控:</span>
            <span className={isInZone ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {isInZone ? '🔥 完美控温中' : '⚠️ 脱离温区'}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-amber-400/90 font-medium">
          🔨 点按一下砸下一锤，伴随火花与金属回响
        </div>
      </div>

      {/* 中央：星露谷风格打铁控温竖槽 (Stardew Style Gauge) */}
      <div className="relative w-14 h-64 bg-slate-950 rounded-xl border-2 border-slate-700 shadow-inner overflow-hidden flex flex-col justify-end">
        {/* 背景刻度条 */}
        <div className="absolute inset-0 opacity-15 flex flex-col justify-between p-1 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-full h-0.5 bg-slate-400" />
          ))}
        </div>

        {/* 淬火温核 (Target - 游鱼) */}
        <div
          className="absolute left-1 right-1 h-5 -translate-y-1/2 flex items-center justify-center transition-transform duration-75 pointer-events-none z-20"
          style={{ bottom: `${targetY}%` }}
        >
          <div className="w-full h-full bg-gradient-to-r from-amber-500 via-orange-400 to-red-500 rounded-md shadow-glow-amber border border-yellow-200 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 text-yellow-100 animate-pulse" />
          </div>
        </div>

        {/* 玩家打铁控温绿槽 (Player Catch Bar) */}
        <div
          className={`absolute left-1 right-1 rounded-lg border-2 transition-colors z-10 ${
            isInZone
              ? 'bg-emerald-500/40 border-emerald-400 shadow-lg shadow-emerald-500/30'
              : 'bg-amber-600/30 border-amber-500'
          }`}
          style={{
            bottom: `${playerY}%`,
            height: `${diff.barHeight}%`,
          }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center text-[9px] font-black font-mono text-emerald-200">
            <span>砧</span>
          </div>
        </div>
      </div>

      {/* 右侧：锻造成品进度条 (Progress Bar 0% ~ 100%) */}
      <div className="flex flex-col items-center h-64 justify-between">
        <span className="text-[10px] font-mono font-bold text-amber-300">
          {Math.round(progress)}%
        </span>

        {/* 进度柱状槽 */}
        <div className="relative w-4 flex-1 bg-slate-950 rounded-full border border-slate-700 p-0.5 flex flex-col justify-end my-1 overflow-hidden">
          <div
            className="w-full rounded-full transition-all duration-100 bg-gradient-to-t from-orange-600 via-amber-500 to-yellow-400 shadow-glow-gold"
            style={{ height: `${progress}%` }}
          />
        </div>

        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
      </div>
    </div>
  );
};
