import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, RefreshCw, Eye, Sparkles, Sword, Hammer, Check, ArrowLeft, Target } from 'lucide-react';
import { ForgeScene3D, DamageNumber } from '../engine/ForgeScene3D';
import { BlueprintDef, ForgedWeapon, MaterialId, QualityTier } from '../types/game';
import { MATERIALS, QUALITY_CONFIGS } from '../data/constants';
import { sound } from '../utils/audio';

interface ForgeViewportProps {
  blueprint: BlueprintDef;
  inventory: Record<MaterialId, number>;
  currentWeapon: ForgedWeapon | null;
  onStartForge: () => void;
  onFinishForge: (score: number) => void;
  onTestStrike: () => { damage: number; isCrit: boolean };
  onQuickBuyMissing: (matId: MaterialId) => void;
}

export const ForgeViewport: React.FC<ForgeViewportProps> = ({
  blueprint,
  inventory,
  currentWeapon,
  onStartForge,
  onFinishForge,
  onTestStrike,
  onQuickBuyMissing,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ForgeScene3D | null>(null);

  // 镜头与视觉状态
  const [autoRotate, setAutoRotate] = useState(true);
  const [showSockets, setShowSockets] = useState(false);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);

  // 打铁小游戏状态
  const [isMinigameActive, setIsMinigameActive] = useState(false);
  const [hitIndex, setHitIndex] = useState(0); // 0, 1, 2 (共 3 锤)
  const [accumulatedScore, setAccumulatedScore] = useState(0);
  const [indicatorPos, setIndicatorPos] = useState(50); // 0 ~ 100
  const [hitFeedback, setHitFeedback] = useState<string | null>(null);

  // 1. 初始化 3D 场景
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ForgeScene3D(containerRef.current);
    sceneRef.current = scene;

    scene.setDamagePopupCallback((dmg) => {
      setDamageNumbers((prev) => [...prev, dmg]);
      setTimeout(() => {
        setDamageNumbers((prev) => prev.filter((d) => d.id !== dmg.id));
      }, 900);
    });

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // 2. 当图纸改变或成品生成时，更新 3D 展示
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.displayWeapon(blueprint);
    }
  }, [blueprint, currentWeapon]);

  // 3. 打铁指针振荡动画
  useEffect(() => {
    if (!isMinigameActive) return;

    let frameId: number;
    let direction = 1;
    let pos = 50;
    const speed = 1.35; // 摆动速度

    const animateGauge = () => {
      pos += direction * speed;
      if (pos >= 98) {
        pos = 98;
        direction = -1;
      } else if (pos <= 2) {
        pos = 2;
        direction = 1;
      }
      setIndicatorPos(pos);
      frameId = requestAnimationFrame(animateGauge);
    };

    frameId = requestAnimationFrame(animateGauge);
    return () => cancelAnimationFrame(frameId);
  }, [isMinigameActive]);

  // 键盘空格键挥锤支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isMinigameActive) {
        e.preventDefault();
        handleHammerStrike();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMinigameActive, indicatorPos, accumulatedScore, hitIndex]);

  // 4. 检查原料是否齐备
  const missingMaterials: { id: MaterialId; needed: number; has: number }[] = [];
  let canAffordMaterials = true;
  for (const [matId, needed] of Object.entries(blueprint.recipe)) {
    const has = inventory[matId as MaterialId] || 0;
    if (has < (needed || 0)) {
      canAffordMaterials = false;
      missingMaterials.push({ id: matId as MaterialId, needed: needed || 0, has });
    }
  }

  // 触发单次挥锤敲打
  const handleHammerStrike = async () => {
    if (!isMinigameActive || !sceneRef.current) return;

    // 计算本次击打精确度：指针中心在 50，距离越近分越高
    const dist = Math.abs(indicatorPos - 50);
    let strikeScore = 0;
    let isPerfect = false;
    let feedback = '';

    if (dist <= 8) {
      strikeScore = 35; // 3次完美满分超 100
      isPerfect = true;
      feedback = '🔥 完美敲击! +35';
    } else if (dist <= 18) {
      strikeScore = 26;
      feedback = '✨ 优良敲击! +26';
    } else {
      strikeScore = 15;
      feedback = '粗糙敲击 +15';
    }

    setHitFeedback(feedback);
    const newTotalScore = accumulatedScore + strikeScore;
    setAccumulatedScore(newTotalScore);

    // 播放 3D 挥锤动画与火花
    await sceneRef.current.animateHammerStrike(isPerfect);

    const nextHit = hitIndex + 1;
    if (nextHit >= 3) {
      // 3 锤完成锻造！
      setIsMinigameActive(false);
      setHitIndex(0);
      setHitFeedback(null);
      onFinishForge(newTotalScore);
    } else {
      setHitIndex(nextHit);
    }
  };

  // 开始锻造
  const handleBeginForge = () => {
    sound.playClick();
    onStartForge();
    setIsMinigameActive(true);
    setHitIndex(0);
    setAccumulatedScore(0);
    setHitFeedback(null);
  };

  // 试刀横砍木桩
  const handleTestStrike = async () => {
    if (!sceneRef.current) return;
    const { damage, isCrit } = onTestStrike();
    await sceneRef.current.animateTestStrike(damage, isCrit);
  };

  // 快捷视角操作
  const toggleRotate = () => {
    if (!sceneRef.current) return;
    const next = !autoRotate;
    setAutoRotate(next);
    sceneRef.current.autoRotate = next;
  };

  const handleResetCamera = () => {
    sceneRef.current?.resetCamera();
  };

  const handleToggleSockets = () => {
    const next = !showSockets;
    setShowSockets(next);
    sceneRef.current?.toggleSocketVisualizer();
    sceneRef.current?.displayWeapon(blueprint);
  };

  return (
    <main className="flex-1 h-full relative flex flex-col bg-forge-900 select-none overflow-hidden">
      {/* 1. 3D WebGL 视口容器 */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 2. 悬浮镜头与挂点工具栏 (Top-Left) */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 bg-forge-800/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/80">
        <button
          onClick={toggleRotate}
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
            autoRotate ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="开关 360° 自转展示"
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span>自转</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-forge-700 flex items-center gap-1 transition-colors"
          title="复位默认视角"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>复位</span>
        </button>

        <button
          onClick={() => sceneRef.current?.focusPart('blade')}
          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-amber-300 hover:bg-forge-700 transition-colors"
        >
          特写剑刃
        </button>

        <button
          onClick={() => sceneRef.current?.focusPart('guard')}
          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-amber-300 hover:bg-forge-700 transition-colors"
        >
          特写护手
        </button>

        <button
          onClick={handleToggleSockets}
          className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
            showSockets ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="显示挂点相对吸附标记 (Socket_Blade/Socket_Guard)"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>插槽拓扑</span>
        </button>
      </div>

      {/* 3. 悬浮当前图纸铭牌 (Top-Right) */}
      <div className="absolute top-3 right-3 z-10 bg-forge-800/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg text-right max-w-xs">
        <div className="text-xs font-bold text-slate-200 flex items-center justify-end gap-1.5">
          <span>{blueprint.name}</span>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        </div>
        <div className="text-[10px] text-amber-400 font-mono mt-0.5">{blueprint.topologyDesc}</div>
      </div>

      {/* 4. 试刀受击浮动伤害跳字 (Screen overlay) */}
      {damageNumbers.map((dmg) => (
        <div
          key={dmg.id}
          className="absolute pointer-events-none font-black font-fantasy tracking-wider animate-bounce select-none z-20 text-shadow-lg"
          style={{
            left: `${dmg.x}px`,
            top: `${dmg.y - 20}px`,
            color: dmg.color,
            fontSize: dmg.isCrit ? '22px' : '17px',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {dmg.text}
        </div>
      ))}

      {/* 5. 底部打铁操作台 (Bottom Console) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-2xl bg-forge-800/95 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-4 shadow-2xl z-20">
        {/* 情况 1：打铁小游戏中 (Minigame Active) */}
        {isMinigameActive ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Hammer className="w-4 h-4 text-amber-400 animate-bounce" />
                正在淬火锻造：第 {hitIndex + 1} / 3 锤
              </span>
              <span className="font-mono text-slate-300">
                当前锻造值: <strong className="text-amber-400">{accumulatedScore}</strong>
                {hitFeedback && <span className="ml-2 text-emerald-400 font-bold">{hitFeedback}</span>}
              </span>
            </div>

            {/* 精准打击度量游标尺 */}
            <div className="relative w-full h-8 bg-forge-900 rounded-lg overflow-hidden border border-slate-700 flex items-center">
              {/* 完美打击区 (中心金色区) */}
              <div
                className="absolute h-full bg-amber-500/35 border-x-2 border-amber-400 flex items-center justify-center text-[10px] font-bold text-amber-200"
                style={{ left: '42%', width: '16%' }}
              >
                完美区 (PERFECT)
              </div>
              {/* 次级良好区 */}
              <div className="absolute h-full bg-sky-500/15" style={{ left: '30%', width: '40%' }} />

              {/* 摆动的游标指示针 */}
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-white shadow-glow-gold rounded-full transition-all duration-75"
                style={{ left: `${indicatorPos}%`, transform: 'translateX(-50%)' }}
              />
            </div>

            {/* 挥锤砸击按钮 */}
            <button
              onClick={handleHammerStrike}
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-sm shadow-glow-gold transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <Hammer className="w-5 h-5" />
              <span>挥锤敲击! (在完美区点击或按空格)</span>
            </button>
          </div>
        ) : currentWeapon ? (
          /* 情况 2：武器已成型 (Finished weapon ready for Test Strike or Selling) */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Sword className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>{currentWeapon.name}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.2 rounded font-bold"
                    style={{
                      color: QUALITY_CONFIGS[currentWeapon.quality].color,
                      backgroundColor: `${QUALITY_CONFIGS[currentWeapon.quality].color}20`
                    }}
                  >
                    {QUALITY_CONFIGS[currentWeapon.quality].label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  攻击力: <span className="text-amber-400 font-bold">+{currentWeapon.stats.atk}</span> · 商会估价: <span className="text-amber-300 font-bold">${currentWeapon.guildPrice} G</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              {/* 试刀按钮 */}
              <button
                onClick={handleTestStrike}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                title="挥剑斩击右侧木桩假人"
              >
                <Target className="w-4 h-4" />
                <span>试刀砍木桩</span>
              </button>

              {/* 再次锻造 */}
              <button
                onClick={handleBeginForge}
                disabled={!canAffordMaterials}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-forge-700 hover:bg-forge-600 disabled:opacity-40 text-slate-200 font-medium rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>再锻一把</span>
              </button>
            </div>
          </div>
        ) : (
          /* 情况 3：待锻造准备界面 (Ready to forge) */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* 配方原料消耗清单 */}
            <div className="space-y-1 w-full sm:w-auto">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>锻造所需原料:</span>
                <span className="text-[10px] text-slate-400">({blueprint.slots.length} 部件插槽)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(blueprint.recipe).map(([matId, needed]) => {
                  const mat = MATERIALS[matId as MaterialId];
                  const has = inventory[matId as MaterialId] || 0;
                  const isEnough = has >= (needed || 0);

                  return (
                    <span
                      key={matId}
                      className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                        isEnough
                          ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                          : 'bg-rose-950/60 border-rose-700/80 text-rose-300'
                      }`}
                    >
                      <span>{mat.name}</span>
                      <strong className={isEnough ? 'text-amber-400 font-mono' : 'text-rose-400 font-mono'}>
                        {has}/{needed}
                      </strong>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 操作主按钮 */}
            {canAffordMaterials ? (
              <button
                onClick={handleBeginForge}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-glow-gold transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Hammer className="w-4 h-4" />
                <span>投入原料 敲击锻造</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] text-rose-400">原料不足</span>
                {missingMaterials[0] && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onQuickBuyMissing(missingMaterials[0].id);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                  >
                    <span>商会补进 {MATERIALS[missingMaterials[0].id].name}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
