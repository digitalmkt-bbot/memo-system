import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PORT = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: PORT },
  // allowedHosts: true lets `vite preview` accept requests from the
  // Railway-generated domain and Railway's healthcheck. Without it, Vite 5
  // returns 403 "Blocked request" and the healthcheck fails.
  preview: { host: true, port: PORT, allowedHosts: true },
});
