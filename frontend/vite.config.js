import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' để bản build mở được ở bất kỳ thư mục nào; điều hướng dùng HashRouter nên không cần cấu hình server.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
});
