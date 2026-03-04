import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const shouldAnalyze = process.env.ANALYZE === "true" || process.env.ANALYZE === "1";
  const plugins = [react()];

  if (shouldAnalyze) {
    plugins.push(
      visualizer({
        filename: "bundle-analyzer.html",
        gzipSize: true,
        brotliSize: true,
        open: true,
      })
    );
  }

  return {
    server: {
      host: "::",
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/files': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/users': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/cases': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/blockchain': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/documents': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/signature-requests': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
        '/signature-requests-sent': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@api": path.resolve(__dirname, "./src/api"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@lib": path.resolve(__dirname, "./src/lib"),
        "@contexts": path.resolve(__dirname, "./src/contexts"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@types": path.resolve(__dirname, "./src/types"),
        "@config": path.resolve(__dirname, "./src/config"),
      },
    },
    build: {
      rollupOptions: {
        // Let Vite handle chunk splitting automatically
        // Manual chunks were causing React context issues in production
      },
      chunkSizeWarningLimit: 1000,
      minify: 'esbuild', // esbuild is faster than terser
      target: 'es2015',
      sourcemap: false, // Disable sourcemaps in production for smaller bundles
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
      exclude: ['@vite/client', '@vite/env'],
    },
    worker: {
      format: 'es',
    },
  };
});
