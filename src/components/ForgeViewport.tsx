import React, { useEffect, useRef, useState } from 'react';
import { Sun, Sword, Hammer, Sparkles, Layers, ArrowLeft, MousePointer, Hand } from 'lucide-react';
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

  // 视角与交互状态
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [isLightingOpen, setIsLightingOpen] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null);
  const [isHoldingWeapon, setIsHoldingWeapon] = useState(false);

  // 打铁小游戏状态
  const [isMinigameActive, setIsMinigameActive] = useState(false);

  // 1. 初始化 3D 场景与第一人称系统
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ForgeScene3D(containerRef.current, lightingConfig);
    sceneRef.current = scene;

    // 伤害跳字
    scene.setDamagePopupCallback((dmg) => {
      setDamageNumbers((prev) => [...prev, dmg]);
      setTimeout(() => {
        setDamageNumbers((prev) => prev.filter((d) => d.id !== dmg.id));
      }, 900);
    });

    // 准星射线交互提示
    scene.setPromptCallback((prompt) => {
      setInteractionPrompt(prompt);
    });

    // 点击铁砧触发打铁模式
    scene.setEnterForgeModeCallback(() => {
      handleTriggerForgeMode();
    });

    // 拾起/丢下武器同步
    scene.setWeaponPickupCallback(() => {
      setIsHoldingWeapon(true);
    });

    scene.setWeaponDropCallback(() => {
      setIsHoldingWeapon(false);
    });

    // 第一人称木桩攻击计算
    scene.setMeleeAttackCallback(() => {
      return onTestStrike();
    });

    // 准星锁定状态监听
    const handleLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === containerRef.current);
    };
    document.addEventListener('pointerlockchange', handleLockChange);

    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
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

  // 3. 待锻造粗胚与成品状态管理
  useEffect(() => {
    if (!sceneRef.current) return;

    if (currentWeapon) {
      if (!isHoldingWeapon) {
        sceneRef.current.displayWeapon(blueprint);
      }
    } else if (!isMinigameActive) {
      sceneRef.current.displayWorkpieceTemplate(blueprint);
    }
  }, [blueprint, currentWeapon, isMinigameActive, isHoldingWeapon]);

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

  // 点击铁砧开启打铁
  const handleTriggerForgeMode = () => {
    if (!canAffordMaterials) {
      sound.playClick();
      // 原料不足，退出打铁视角
      sceneRef.current?.exitForgingMode();
      return;
    }

    sound.playClick();
    onStartForge();
    setIsMinigameActive(true);
    sceneRef.current?.enterForgingMode(blueprint);
  };

  // 退出打铁特写，返回自由漫游
  const handleExitForgeMode = () => {
    sound.playClick();
    setIsMinigameActive(false);
    sceneRef.current?.exitForgingMode();
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
    sceneRef.current?.quenchAndReveal(blueprint);
    onFinishForge(accuracyScore);

    // 淬火展现后平稳回到第一人称漫游站位，武器横躺在铁砧上供捡起
    setTimeout(() => {
      sceneRef.current?.exitForgingMode();
    }, 1200);
  };

  // 捡起武器
  const handlePickupWeapon = () => {
    sceneRef.current?.pickupWeapon();
  };

  // 扔下武器
  const handleDropWeapon = () => {
    sceneRef.current?.dropWeapon(false);
  };

  return (
    <main className="flex-1 h-full relative flex flex-col bg-forge-900 select-none overflow-hidden">
      {/* 1. 3D WebGL 视口容器 */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-crosshair active:cursor-crosshair"
      />

      {/* 2. 第一人称中心准星与交互提示 (Crosshair & Interaction HUD) */}
      {!isMinigameActive && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
          {/* 十字准星 */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-glow-gold" />
            <div className="absolute w-4 h-0.5 bg-white/50" />
            <div className="absolute h-4 w-0.5 bg-white/50" />
          </div>

          {/* 准星指向对象的交互提示浮标 */}
          {interactionPrompt && (
            <div className="mt-3 px-3.5 py-1.5 bg-forge-900/95 border border-amber-400/80 rounded-xl shadow-glow-amber text-xs font-bold text-amber-200 backdrop-blur-md flex items-center gap-1.5 animate-bounce">
              <span>{interactionPrompt}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. 第一人称漫游提示横幅 (当鼠标未锁定时提示) */}
      {!isPointerLocked && !isMinigameActive && (
        <div
          onClick={() => sceneRef.current?.requestPointerLock()}
          className="cursor-pointer absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-forge-800/90 hover:bg-forge-700/95 border border-amber-500/50 rounded-full shadow-lg text-xs text-amber-200 backdrop-blur-md flex items-center gap-2 transition-all hover:scale-105"
        >
          <MousePointer className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>点击视口进入第一人称漫游 (WASD 走路 · 鼠标转头 · ESC 释放鼠标)</span>
        </div>
      )}

      {/* 4. 手持武器状态指示标 (Held Weapon HUD) */}
      {isHoldingWeapon && !isMinigameActive && (
        <div className="absolute bottom-6 left-6 z-20 bg-forge-900/90 border border-emerald-500/60 rounded-xl px-4 py-2 shadow-glow-amber backdrop-blur-md flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
            <Sword className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>手持：{currentWeapon ? currentWeapon.name : blueprint.name}</span>
            </div>
            <div className="text-[10px] text-slate-400">
              左键挥斩（近身砍木桩） · 右键松手丢弃
            </div>
          </div>
          <button
            onClick={handleDropWeapon}
            className="px-2.5 py-1 bg-forge-700 hover:bg-rose-600 text-slate-200 rounded text-[11px] font-medium transition-colors"
          >
            丢弃 (G)
          </button>
        </div>
      )}

      {/* 5. 悬浮光影工坊调节工具栏 (Top-Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20 bg-forge-800/85 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/80 shadow-md">
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

      {/* 6. 伤害跳字特效 */}
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

      {/* 7. 光影参数面板弹窗 */}
      <LightingStudioModal
        isOpen={isLightingOpen}
        lightingConfig={lightingConfig}
        onChangeConfig={onUpdateLighting}
        onClose={() => setIsLightingOpen(false)}
      />

      {/* 8. 打铁模式专属界面 (Forging Mode HUD) */}
      {isMinigameActive && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          {/* 退出打铁视角按钮 */}
          <button
            onClick={handleExitForgeMode}
            className="px-3.5 py-1 bg-forge-800/90 hover:bg-forge-700 border border-slate-600 rounded-full text-xs text-slate-300 backdrop-blur-md flex items-center gap-1 transition-colors mb-1 shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>退出打铁 (返回工坊漫游)</span>
          </button>

          {/* 星露谷风格淬火打铁小游戏 */}
          <StardewForgeMinigame
            blueprint={blueprint}
            onHammerTap={handleMinigameTap}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleMinigameComplete}
          />
        </div>
      )}

      {/* 9. 未处于打铁时底部的快速指引条 */}
      {!isMinigameActive && !isHoldingWeapon && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[90vw] max-w-xl bg-forge-800/90 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Hammer className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-slate-200">
                当前图纸：{blueprint.name}
              </div>
              <div className="text-[11px] text-slate-400">
                走到铁砧前<strong>左键点击铁砧</strong>开炉，或直接点击下方按钮开锤
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {currentWeapon && (
              <button
                onClick={handlePickupWeapon}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>拾起武器</span>
              </button>
            )}

            {canAffordMaterials ? (
              <button
                onClick={() => {
                  handleTriggerForgeMode();
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-glow-gold transition-all active:scale-95 flex items-center gap-1"
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>开始打铁</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-rose-400">缺少原料</span>
                {missingMaterials[0] && (
                  <button
                    onClick={() => onQuickBuyMissing(missingMaterials[0].id)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                  >
                    商会进货
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
