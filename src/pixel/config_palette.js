/**
 * src/pixel/config_palette.js — 像素模式下把配置里的属性色 / 材质色统一到像素调色板
 *
 * 原配置里同一属性有两套互相冲突的颜色（符文表 vs 属性表，闪电与增幅同为紫色等）。
 * 像素模式启动时用 icons.js 的 ATTRIBUTE_STYLE（唯一来源）覆盖：
 * - CONFIG.ui.attributeDisplay[*].color —— DOM 属性标签、真理之书等；
 * - CONFIG.colors.mat* / 钉子 / 背景 —— 仍走矢量绘制的特效与钉盘元素。
 * 位图模式不调用本模块，配置保持原值。
 * @module pixel/config_palette
 */
import { RAMPS } from './palette.js';
import { ATTRIBUTE_STYLE, attributeColor } from './icons.js';

function rampAt(name, frac) {
    const R = RAMPS[name];
    return R[Math.max(0, Math.min(R.length - 1, Math.round((R.length - 1) * frac)))];
}

export function applyPixelPaletteToConfig(CONFIG) {
    if (!CONFIG || CONFIG.__pixelPaletteApplied) return false;
    const disp = CONFIG.ui && CONFIG.ui.attributeDisplay;
    if (disp) {
        for (const [key, d] of Object.entries(disp)) {
            if (!ATTRIBUTE_STYLE[key] || key === 'rainbow') continue;
            d.color = attributeColor(key);
        }
    }
    const c = CONFIG.colors || {};
    const set = (k, v) => { if (k in c) c[k] = v; };
    set('bg', RAMPS.slate[0]);
    set('peg', RAMPS.slate[4]);
    set('pegActive', RAMPS.slate[8]);
    set('pegPink', attributeColor('bounce'));
    set('matBase', RAMPS.ice[3]);
    set('matBounce', attributeColor('bounce'));
    set('matPierce', attributeColor('pierce'));
    set('matScatter', attributeColor('scatter'));
    set('matDamage', attributeColor('damage'));
    set('matCryo', attributeColor('cryo'));
    set('matPyro', attributeColor('pyro'));
    set('matLightning', attributeColor('lightning'));
    set('matWind', attributeColor('wind'));
    set('matWind_lv2', rampAt('mint', 0.45));
    set('matWind_lv3', rampAt('mint', 0.3));
    set('matVenom', attributeColor('venom'));
    set('matOvercharge', rampAt('volt', 0.5));
    set('matEcho', rampAt('ice', 0.85));
    set('matMatryoshka', rampAt('rose', 0.5));
    set('marbleWhite', RAMPS.slate[9]);
    set('flying_sword', attributeColor('flying_sword'));
    set('flying_sword_lv2', rampAt('arcane', 0.6));
    set('flying_sword_lv3', rampAt('blood', 0.7));
    set('laser', attributeColor('laser'));
    set('resonance', attributeColor('resonance'));
    CONFIG.__pixelPaletteApplied = true;
    return true;
}
