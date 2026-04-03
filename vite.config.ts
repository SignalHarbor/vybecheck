import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {

  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/ws': {
          target: env.VITE_SERVER_URL,
          ws: true,
        },
        '/api': {
          target: env.VITE_SERVER_URL,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
    },
  }
});
