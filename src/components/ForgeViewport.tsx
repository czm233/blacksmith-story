import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, RefreshCw, Eye, Sun, Sword, Hammer, Target, Sparkles, Layers } from 'lucide-react';
import { ForgeScene3D, DamageNumber } from '../engine/ForgeScene3D';
import { BlueprintDef, ForgedWeapon, LightingConfig, MaterialId } from '../types/game';
import { MATERIALS, QUALITY_CONFIGS } from '../data/constants';
import { StardewForgeMinigame } from './StardewForgeMinigame';
import { LightingStudioModal } from './LightingStudioModal';
import { sound } from '../utils/audio';

interface ForgeViewportProps {
  blueprint: BlueprintDef;
  inventory: Record<MaterialId, number>;
  currentWeapon: ForgedWeapon | null;
  lightingConfig: LightingConfig;
  onUpdateLighting: (cfg: LightingConfig) => void;
  onStartForge: () => void;
  onFinishForge: (score: number) => void;
  onTestStrike: () => { damage: number; isCrit: boolean };
  onQuickBuyMissing: (matId: MaterialId) => void;
}

export const ForgeViewport: React.FC<ForgeViewportProps> = ({
  blueprint,
  inventory,
  currentWeapon,
  lightingConfig,
  onUpdateLighting,
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
  const [isLightingOpen, setIsLightingOpen] = useState(false);

  // 打铁小游戏状态
  const [isMinigameActive, setIsMinigameActive] = useState(false);

  // 1. 初始化 3D 场景
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ForgeScene3D(containerRef.current, lightingConfig);
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

  // 2. 实时同步光照参数变动
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.applyLighting(lightingConfig);
    }
  }, [lightingConfig]);

  // 3. 核心机制：未打造完成前绝不提前画出武器！仅显示粗胚与全息线框！
  useEffect(() => {
    if (!sceneRef.current) return;

    if (currentWeapon) {
      // 已经完成的武器：展示成品真容
      sceneRef.current.displayWeapon(blueprint);
    } else if (!isMinigameActive) {
      // 待打造状态：仅展示烧红的金属粗胚与全息插槽树模板
      sceneRef.current.displayWorkpieceTemplate(blueprint);
    }
  }, [blueprint, currentWeapon, isMinigameActive]);

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

  // 开始打铁（画面聚焦到铁砧，开启星露谷打铁小游戏）
  const handleBeginForge = () => {
    sound.playClick();
    onStartForge();
    setIsMinigameActive(true);

    // ★ 关键需求2：画面平滑平移特写到铁砧工作面上！
    sceneRef.current?.focusAnvil();
  };

  // 小游戏中每一次敲击传递到 3D 场景
  const handleMinigameTap = (isPerfect: boolean) => {
    sceneRef.current?.triggerHammerTap(isPerfect);
  };

  // 小游戏中实时锻造进度同步给 3D 粗胚
  const handleProgressUpdate = (progress: number) => {
    sceneRef.current?.updateForgingProgress(progress, blueprint);
  };

  // 打铁完成 (进度 100%)
  const handleMinigameComplete = (accuracyScore: number) => {
    setIsMinigameActive(false);

    // ★ 关键需求3：淬火白雾升腾，展现武器真面目，镜头拉回全景！
    sceneRef.current?.quenchAndReveal(blueprint);

    onFinishForge(accuracyScore);
  };

  // 试刀横砍木桩
  const handleTestStrike = async () => {
    if (!sceneRef.current) return;
    const { damage, isCrit } = onTestStrike();
    await sceneRef.current.animateTestStrike(damage, isCrit);
  };

  // 视角操作
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
    if (currentWeapon) {
      sceneRef.current?.displayWeapon(blueprint);
    } else {
      sceneRef.current?.displayWorkpieceTemplate(blueprint);
    }
  };

  return (
    <main className="flex-1 h-full relative flex flex-col bg-forge-900 select-none overflow-hidden">
      {/* 1. 3D WebGL 视口容器 */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 2. 悬浮镜头与挂点工具栏 (Top-Left) */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 bg-forge-800/85 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/80 shadow-md">
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
          title="显示挂点相对吸附标记"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>挂点骨架</span>
        </button>

        {/* ★ 关键需求4：采光与场景调节入口 */}
        <button
          onClick={() => {
            sound.playClick();
            setIsLightingOpen(!isLightingOpen);
          }}
          className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
            isLightingOpen
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-forge-700/80 text-amber-300 hover:bg-forge-600 border border-amber-500/40'
          }`}
          title="自定义工坊环境光与画面曝光"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>光影工坊</span>
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

      {/* 4. 试刀受击浮动伤害跳字 */}
      {damageNumbers.map((dmg) => (
        <div
          key={dmg.id}
          className="absolute pointer-events-none font-black font-fantasy tracking-wider animate-bounce select-none z-20"
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

      {/* ★ 关键需求4：场景光影调节面板弹窗 */}
      <LightingStudioModal
        isOpen={isLightingOpen}
        lightingConfig={lightingConfig}
        onChangeConfig={onUpdateLighting}
        onClose={() => setIsLightingOpen(false)}
      />

      {/* 5. 底部打铁操作台 (Bottom Console) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        {/* 情况 1：星露谷风格打铁淬火小游戏 (Stardew Minigame) */}
        {isMinigameActive ? (
          <StardewForgeMinigame
            blueprint={blueprint}
            onHammerTap={handleMinigameTap}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleMinigameComplete}
          />
        ) : currentWeapon ? (
          /* 情况 2：武器已淬火成型，真身显现 (Finished weapon ready) */
          <div className="w-[92vw] max-w-2xl bg-forge-800/95 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
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
              <button
                onClick={handleTestStrike}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold rounded-xl text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                title="挥剑斩击右侧木桩假人"
              >
                <Target className="w-4 h-4" />
                <span>试刀砍木桩</span>
              </button>

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
          /* 情况 3：待锻造准备界面 (粗胚与全息图纸态) */
          <div className="w-[92vw] max-w-2xl bg-forge-800/95 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* 配方原料消耗清单 */}
            <div className="space-y-1 w-full sm:w-auto">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>待锻造粗胚所需原料:</span>
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
                <span>置入粗胚 开始淬火锻造</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] text-rose-400 font-medium">原料不足</span>
                {missingMaterials[0] && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      onQuickBuyMissing(missingMaterials[0].id);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                  >
                    <span>商会进货 {MATERIALS[missingMaterials[0].id].name}</span>
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
