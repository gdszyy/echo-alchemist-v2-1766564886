/**
 * QualityProfile.js - 3D 渲染自适应画质（M6.5）
 *
 * 自动检测：WebGL2 / GPU 信息 / 屏幕尺寸 / 像素比 → 选择 high/medium/low 三档之一。
 * 玩家也可通过 localStorage 强制锁定：
 *
 *     localStorage.echo_3d_quality = 'low' | 'medium' | 'high' | 'auto'
 *
 * 影响的子系统：
 *   - PostFX: HDR FBO / Bloom / Lens 畸变 是否启用 + 强度
 *   - BackgroundLayer: 粒子层数 + 粒子总数
 *   - GPUParticleSystem: 容量
 *   - Renderer3D: 渲染器 pixelRatio cap
 */

const PROFILES = {
    high: {
        name: 'high',
        postFX:           true,
        hdr:              true,
        bloomStrength:    0.85,
        lensDistortion:   true,
        filmGrain:        true,
        particleCapacity: 4096,
        ambientParticles: { near: 180, far: 200 },
        pixelRatioCap:    2,
    },
    medium: {
        name: 'medium',
        postFX:           true,
        hdr:              false,        // LDR 帧缓冲，节省 GPU 内存
        bloomStrength:    0.55,
        lensDistortion:   true,
        filmGrain:        false,        // 颗粒省一个 pass
        particleCapacity: 2048,
        ambientParticles: { near: 100, far: 100 },
        pixelRatioCap:    1.5,
    },
    low: {
        name: 'low',
        postFX:           false,        // 关闭全部后处理，直接 render
        hdr:              false,
        bloomStrength:    0,
        lensDistortion:   false,
        filmGrain:        false,
        particleCapacity: 1024,
        ambientParticles: { near: 50, far: 50 },
        pixelRatioCap:    1.0,
    },
};

/**
 * 简易判断是否移动端。优先用 userAgent，回退用屏幕宽度。
 */
function _isMobile() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
    if (typeof window !== 'undefined' && window.innerWidth < 700) return true;
    return false;
}

/**
 * 自动检测：返回 'high' | 'medium' | 'low'
 * @param {THREE.WebGLRenderer} renderer
 */
export function detectProfile(renderer) {
    if (typeof localStorage !== 'undefined') {
        const forced = localStorage.getItem('echo_3d_quality');
        if (forced && forced !== 'auto' && PROFILES[forced]) {
            console.info(`[QualityProfile] forced by localStorage: ${forced}`);
            return forced;
        }
    }

    const isWebGL2 = !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);
    const isMobile = _isMobile();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const screenW = (typeof window !== 'undefined' && window.innerWidth) || 1024;

    // GPU info（WebGL_debug_renderer_info 在部分浏览器可用）
    let gpuStr = '';
    try {
        if (renderer && renderer.getContext) {
            const gl = renderer.getContext();
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) gpuStr = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
        }
    } catch (e) {}
    const isSwiftShader = /SwiftShader|Software/i.test(gpuStr);

    // 决策
    let profile;
    if (isSwiftShader) {
        profile = 'low';                                      // 软件渲染必降级
    } else if (!isWebGL2) {
        profile = 'low';                                      // WebGL1 无法 HDR
    } else if (isMobile && screenW < 480) {
        profile = 'low';                                      // 小屏手机
    } else if (isMobile) {
        profile = 'medium';                                   // 一般手机
    } else if (dpr >= 2 && screenW < 1200) {
        profile = 'medium';                                   // Retina 笔记本但屏幕小
    } else {
        profile = 'high';
    }

    console.info(
        `[QualityProfile] auto = ${profile} ` +
        `(WebGL2=${isWebGL2}, mobile=${isMobile}, dpr=${dpr.toFixed(1)}, w=${screenW}, gpu=${gpuStr || 'unknown'})`
    );
    return profile;
}

/**
 * 获取指定 profile 的所有渲染参数。
 * @param {string} name
 * @returns {Object}
 */
export function getProfileConfig(name) {
    return PROFILES[name] || PROFILES.medium;
}

/** 列出所有可用 profile 名称 */
export function listProfiles() {
    return Object.keys(PROFILES);
}
