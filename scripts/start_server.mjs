/**
 * scripts/start_server.mjs — `npm start` 的静态服务入口（本地与 Railway 共用）
 *
 * - 本地：默认 http://localhost:3002（AGENTS.md「本地 npm 测试/预览默认端口」）。
 * - Railway：服务转发到 8080。优先用平台注入的 PORT；没有 PORT 但处在 Railway 环境时用 8080。
 *   写死 `-l 3002` 会让平台转发落空，所有请求 502（"Application failed to respond"）。
 * 缓存头等配置仍由根目录 serve.json 提供。
 */
import { spawn } from 'node:child_process';

const onRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
const port = String(process.env.PORT || (onRailway ? 8080 : 3002));
console.log(`[start_server] serving . on port ${port}${process.env.PORT ? ' (PORT)' : onRailway ? ' (Railway default)' : ' (local default)'}`);
const child = spawn('npx', ['serve', '.', '-l', port], {
    stdio: 'inherit',
    shell: process.platform === 'win32', // Windows 上 npx 是 .cmd，需要经 shell 启动
});

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig));
}
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
