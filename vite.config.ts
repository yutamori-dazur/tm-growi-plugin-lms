import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Growi v7 スクリプト型プラグインの標準ビルド設定
// manifest.json + assets/ 形式で出力する（ライブラリモードではない）
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      input: ['/client-entry.tsx'],
    },
  },
});
