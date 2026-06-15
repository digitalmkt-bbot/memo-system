import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PORT = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: PORT },
  preview: { host: true, port: PORT, allowedHosts: true },
});
