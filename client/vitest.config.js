import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    // @vitejs/plugin-react's automatic JSX runtime isn't kicking in under Vitest's
    // transform pipeline with this React 19 / Vite 8 combination - inject the classic
    // React import for test runs only, without touching the real build config or source files.
    esbuild: {
      jsxInject: "import React from 'react'",
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.js'],
    },
  })
);
