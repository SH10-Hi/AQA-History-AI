import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode, command }) => {
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production' || command === 'build';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Strictly disable HMR in production or when DISABLE_HMR is set
      hmr: isProduction ? false : process.env.DISABLE_HMR !== 'true',
      watch: (isProduction || process.env.DISABLE_HMR === 'true') ? null : {},
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
  };
});
