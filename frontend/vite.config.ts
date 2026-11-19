import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL } = loadEnv(mode, frontendDir, 'VITE_');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: VITE_API_BASE_URL?.trim() || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
