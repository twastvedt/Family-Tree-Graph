import { fileURLToPath, URL } from 'node:url';

import { defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const config: UserConfig = {
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
};

if (process.env.BASE_URL) {
  config.base = process.env.BASE_URL;
}

export default defineConfig(config);
