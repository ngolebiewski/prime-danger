// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // 🚨 This line is the fix!
  base: './', // Tells Vite to use relative paths for assets
  build: {
    // Optional: Ensure all necessary assets are included
    assetsDir: 'assets',
  },
});