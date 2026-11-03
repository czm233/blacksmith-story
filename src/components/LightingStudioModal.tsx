import React from 'react';
import { Sun, Sparkles, Sliders, RotateCcw, X, Check } from 'lucide-react';
import { LightingConfig } from '../types/game';
import { DEFAULT_LIGHTING_CONFIG, LIGHTING_PRESETS } from '../data/constants';
import { sound } from '../utils/audio';

interface LightingStudioModalProps {
  isOpen: boolean;
  lightingConfig: LightingConfig;
  onChangeConfig: (newConfig: LightingConfig) => void;
  onClose: () => void;
}

export const LightingStudioModal: React.FC<LightingStudioModalProps> = ({
  isOpen,
  lightingConfig,
  onChangeConfig,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleSliderChange = (key: keyof LightingConfig, value: number) => {
    const updated = {
      ...lightingConfig,
      [key]: value,
    };
    onChangeConfig(updated);
  };

  const handleApplyPreset = (presetKey: keyof typeof LIGHTING_PRESETS) => {
    sound.playClick();
    onChangeConfig(LIGHTING_PRESETS[presetKey].config);
  };

  const handleResetDefault = () => {
    sound.playClick();
    onChangeConfig(DEFAULT_LIGHTING_CONFIG);
  };

  return (
    <div className="absolute top-14 right-3 z-30 w-88 bg-forge-900/95 backdrop-blur-xl border-2 border-amber-500/50 rounded-2xl shadow-2xl p-4 text-xs select-none animate-fade-in text-slate-200">
      {/* 标题 */}
      <div className="flex items-center justify-between pb-2.5 border-b border-forge-border">
        <div className="flex items-center gap-2 text-amber-300 font-bold font-fantasy">
          <Sun className="w-4 h-4 text-amber-400" />
          <span>工坊光影与采光调校</span>
        </div>
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-forge-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
        {/* 1. 预设快速切换 */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">一键场景光照预设</span>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(LIGHTING_PRESETS).map(([key, item]) => (
              <button
                key={key}
                onClick={() => handleApplyPreset(key as keyof typeof LIGHTING_PRESETS)}
                className="p-2 rounded-lg bg-forge-800 hover:bg-amber-600/30 hover:border-amber-500/60 border border-slate-700/80 text-left transition-colors"
              >
                <div className="font-bold text-slate-100 text-[11px]">{item.name}</div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. 精细参数滑块 */}
        <div className="space-y-3 pt-2 border-t border-forge-border">
          <span className="text-[11px] font-semibold text-slate-400 block">细化光强调节</span>

          {/* 环境光 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">环境底光 (Ambient)</span>
              <span className="font-mono text-amber-400 font-bold">{lightingConfig.ambientIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.1"
              value={lightingConfig.ambientIntensity}
              onChange={(e) => handleSliderChange('ambientIntensity', parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* 聚光灯 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">主顶光射灯 (Spotlight)</span>
              <span className="font-mono text-amber-400 font-bold">{lightingConfig.spotIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.2"
              value={lightingConfig.spotIntensity}
              onChange={(e) => handleSliderChange('spotIntensity', parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* 轮廓光 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">金属冷冽反光 (Rim Light)</span>
              <span className="font-mono text-sky-400 font-bold">{lightingConfig.rimIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="6.0"
              step="0.2"
              value={lightingConfig.rimIntensity}
              onChange={(e) => handleSliderChange('rimIntensity', parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* 暖炉火光 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">熔炉烈火跳动 (Fireplace)</span>
              <span className="font-mono text-orange-400 font-bold">{lightingConfig.fireIntensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.2"
              value={lightingConfig.fireIntensity}
              onChange={(e) => handleSliderChange('fireIntensity', parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* 曝光度 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">画面曝光度 (Exposure)</span>
              <span className="font-mono text-yellow-300 font-bold">{lightingConfig.exposure.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.05"
              value={lightingConfig.exposure}
              onChange={(e) => handleSliderChange('exposure', parseFloat(e.target.value))}
              className="w-full accent-yellow-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {/* 背景明暗度 */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-300">背景深邃度 (Background Dark)</span>
              <span className="font-mono text-slate-400 font-bold">{(lightingConfig.bgDarkness * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={lightingConfig.bgDarkness}
              onChange={(e) => handleSliderChange('bgDarkness', parseFloat(e.target.value))}
              className="w-full accent-slate-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="pt-2 border-t border-forge-border flex items-center justify-between">
          <button
            onClick={handleResetDefault}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>完成调整</span>
          </button>
        </div>
      </div>
    </div>
  );
};
