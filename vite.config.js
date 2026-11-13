import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/crm': {
        target: 'https://leads.ciasuper.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crm/, '/api/mcp'),
        headers: {
          'Accept': 'application/json, text/event-stream',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJyVnNaWTUwMVc2VzFBZjkyM01NWDc5M0pBOWsxIiwiZW1haWwiOiJwcm9qZXRvcy52aXN1YWxzdXBlckBnbWFpbC5jb20iLCJuYW1lIjoiT2x6ZW5pcyBHb21lcyIsInJvbGUiOiJtYXN0ZXIiLCJwdXJwb3NlIjoiYXNzaXN0YW50IiwiZXhwIjoxODAyMTEzOTE2fQ.1Q8ZsW--eeSKuH3gqE0okK_nhP2C0Npr7aan0RS6Hcg'
        }
      },
      '/api/site-proxy': {
        target: 'https://visualsuper.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/site-proxy/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    }
  }
});

