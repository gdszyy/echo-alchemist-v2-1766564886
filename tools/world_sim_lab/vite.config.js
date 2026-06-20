import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// 实时引用 echo 仓库内的引擎源码（不复制、不打包快照）：
//   tools/world_sim_lab/  →  ../../src/world_sim/
// 这样改引擎源码后，刷新页面即可看到最新行为，符合「验证 / 调参」诉求。
const engineDir = fileURLToPath(new URL('../../src/world_sim', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      // import { SimulationEngine } from '@engine/engine.js'
      '@engine': engineDir,
    },
  },
  server: {
    fs: {
      // 允许 dev server 读取项目根目录之外的引擎源码
      allow: [repoRoot],
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
