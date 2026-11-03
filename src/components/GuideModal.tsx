import React from 'react';
import { X, BookOpen, Layers, Shield, Sparkles, Hammer, Coins } from 'lucide-react';
import { sound } from '../utils/audio';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-forge-800 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* 标题 */}
        <div className="bg-forge-900 border-b border-forge-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-amber-100 font-fantasy">工匠法则与技术架构指南</h2>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-forge-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容滚动区 */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* 1. 概念哲学 */}
          <div className="bg-forge-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              1. 核心定位：图纸即骨架 (Blueprint as Scaffold)
            </h3>
            <p>
              在《铁匠物语》中，图纸不是死板的整块 3D 模型，而是<strong>插槽树规范（Socket Tree Topology）</strong>。
              部件 = 几何网格 + 相对连接挂点 (Sockets) + 物理/战斗词缀。
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li><strong>⚪ 白色图纸（学徒）</strong>：2 部件（握柄 + 剑身），一体粗铸，省去护手。</li>
              <li><strong>🟢 绿色图纸（工匠）</strong>：3 部件（握柄 + 护手 + 剑身），引入十字架招防御。</li>
              <li><strong>🔵 蓝色图纸（精工）</strong>：3 部件（细握柄 + 环状盘护手 + 破甲刺剑）。</li>
              <li><strong>🟣 紫色图纸（大师）</strong>：4 部件（加装实心配重球 Pommel）。</li>
              <li><strong>🟠 橙色图纸（神兵）</strong>：5 部件（加装配重球 + 熔岩星核宝石槽 Gem）。</li>
            </ul>
          </div>

          {/* 2. 3D 挂点协议 */}
          <div className="bg-forge-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-sky-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-sky-400" />
              2. 3D 挂点协议 (Socket Protocol) 与降级回退
            </h3>
            <p>
              组装引擎采用局部坐标系相对吸附，实现部件代码层完全解耦：
            </p>
            <div className="bg-forge-950 p-2.5 rounded font-mono text-[11px] text-amber-200/90 space-y-1">
              <div>[根节点: Grip 握柄] ➔ 原点 (0,0,0) 手持受力点，顶端提供 Socket_Guard (y=+0.22m)</div>
              <div>[中继件: Guard 护手] ➔ 吸附至 Socket_Guard，顶端提供 Socket_Blade (y=+0.05m)</div>
              <div>[叶节点: Blade 剑身] ➔ 吸附至 Socket_Blade，向上延伸 0.8~1.4m</div>
              <div className="text-emerald-400">★ 特化回退：白色图纸无 Guard，Blade 直接降级回退吸附到握柄的 Socket_Guard！</div>
            </div>
          </div>

          {/* 3. 经营全闭环与统购包销 */}
          <div className="bg-forge-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              3. 经济全闭环与商会统购包销
            </h3>
            <p>
              商会保证<strong>无拒收统购</strong>，成品回收价严格按经济杠杆结算：
            </p>
            <div className="bg-forge-950 p-2.5 rounded font-mono text-[11px] text-yellow-300">
              成品回收价 = ∑(原料基准成本) × 图纸品级倍率 × 锻造质量倍率
            </div>
            <p className="text-slate-400">
              敲击锻造时命中完美打击区可获得<strong>传世品级 (2.2倍回收溢价)</strong>！
            </p>
          </div>

          {/* 4. 灵光一闪与云游商人 */}
          <div className="bg-forge-900/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              4. 灵光一闪 (Epiphany) 与云游商人
            </h3>
            <p>
              在打铁过程中，每次挥锤都有概率触发<strong>【灵光一闪】</strong>，直接领悟更高阶图纸！
              此外，云游商人每隔 90 秒限时到访，兜售珍稀的<strong>星陨石</strong>与<strong>渊火巨剑残卷</strong>。
            </p>
          </div>
        </div>

        {/* 底部关闭 */}
        <div className="bg-forge-900 p-3.5 border-t border-forge-border text-right">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
          >
            领会，返回工坊
          </button>
        </div>
      </div>
    </div>
  );
};
