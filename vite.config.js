import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the site works locally AND on GitHub Pages
  // (served from https://<user>.github.io/<repo>/). Safe even if the repo is renamed.
  base: './',
  plugins: [react()],
})
