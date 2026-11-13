// Servidor HTTP e API de Banco de Dados para o Super Treinador Visual Super
// Suporta execução local e deploy em produção na VPS com persistência em volume (/app/data)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT, 10) || 5500;
const BASE_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Garante que o diretório persistente de dados exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializa ou carrega o banco de dados persistente
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[DATABASE] Erro ao carregar banco, recriando:', err.message);
  }
  return {
    aprendizados: [],
    conversas: [],
    config: {},
    produtos: [],
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
}

// Gravação atômica para evitar corrupção de dados
function saveDatabase(db) {
  db.atualizadoEm = new Date().toISOString();
  const tmpFile = DB_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

let db = loadDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // Limite de 5MB
        req.socket.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

// Servidor com cabeçalhos expandidos
const server = http.createServer({ maxHeaderSize: 65536 }, async (req, res) => {
  const remoteIp = req.socket.remoteAddress || 'local';
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Suporte a CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // ==================== ROTAS DE API DO BANCO DE DADOS ====================

  // 1. Status do Servidor e Banco
  if (pathname === '/api/status' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'online',
      sistema: 'Super Treinador SDR - Visual Super',
      versao: '2.0.0',
      banco: {
        arquivo: DB_FILE,
        aprendizadosCount: (db.aprendizados || []).length,
        conversasCount: (db.conversas || []).length,
        atualizadoEm: db.atualizadoEm
      },
      uptime: process.uptime()
    });
  }

  // 2. Aprendizados (Listar e Salvar)
  if (pathname === '/api/aprendizados') {
    if (method === 'GET') {
      return sendJson(res, 200, db.aprendizados || []);
    }

    if (method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (Array.isArray(body)) {
          // Salva lote completo de aprendizados
          db.aprendizados = body;
        } else if (body && body.id) {
          // Atualiza ou adiciona aprendizado individual
          const idx = (db.aprendizados || []).findIndex(a => a.id === body.id);
          if (idx >= 0) {
            db.aprendizados[idx] = { ...db.aprendizados[idx], ...body, atualizadoEm: new Date().toISOString() };
          } else {
            db.aprendizados.push({ ...body, criadoEm: new Date().toISOString() });
          }
        } else {
          return sendJson(res, 400, { erro: 'Formato inválido para aprendizado' });
        }
        saveDatabase(db);
        return sendJson(res, 200, { sucesso: true, count: db.aprendizados.length });
      } catch (err) {
        return sendJson(res, 400, { erro: err.message });
      }
    }
  }

  // 3. Conversas Salvas (Histórico de Likes e Feedback)
  if (pathname === '/api/conversas') {
    if (method === 'GET') {
      return sendJson(res, 200, db.conversas || []);
    }

    if (method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (body) {
          const conversa = {
            id: body.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            data: body.data || new Date().toISOString(),
            leadPersona: body.leadPersona || null,
            mensagens: body.mensagens || [],
            feedback: body.feedback || null,
            avaliacao: body.avaliacao || 'like'
          };
          db.conversas = db.conversas || [];
          db.conversas.unshift(conversa);
          // Limite de segurança de 500 conversas salvas
          if (db.conversas.length > 500) db.conversas = db.conversas.slice(0, 500);
          saveDatabase(db);
          return sendJson(res, 201, { sucesso: true, id: conversa.id });
        }
        return sendJson(res, 400, { erro: 'Dados da conversa ausentes' });
      } catch (err) {
        return sendJson(res, 400, { erro: err.message });
      }
    }
  }

  // 4. Configurações Compartilhadas
  if (pathname === '/api/config') {
    if (method === 'GET') {
      return sendJson(res, 200, db.config || {});
    }

    if (method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        db.config = { ...db.config, ...body };
        saveDatabase(db);
        return sendJson(res, 200, { sucesso: true, config: db.config });
      } catch (err) {
        return sendJson(res, 400, { erro: err.message });
      }
    }
  }

  // 5. Backup / Exportação e Importação do Banco
  if (pathname === '/api/banco') {
    if (method === 'GET') {
      return sendJson(res, 200, db);
    }
    if (method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (body && typeof body === 'object') {
          db = {
            ...body,
            restauradoEm: new Date().toISOString()
          };
          saveDatabase(db);
          return sendJson(res, 200, { sucesso: true, mensagem: 'Banco restaurado com sucesso' });
        }
        return sendJson(res, 400, { erro: 'Dados inválidos' });
      } catch (err) {
        return sendJson(res, 400, { erro: err.message });
      }
    }
  }

  // ==================== SERVIDOR DE ARQUIVOS ESTÁTICOS ====================
  let reqUrl = pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(BASE_DIR, reqUrl);

  // Impede path traversal fora da pasta da aplicação
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Acesso negado');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - Arquivo não encontrado no Treinador Visual Super</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`Erro no servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

server.on('clientError', (err, socket) => {
  if (err.code !== 'ECONNRESET' && socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.on('error', (err) => {
  console.error('\n❌ ERRO NO SERVIDOR:', err.message);
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  const hostName = os.hostname().toLowerCase();
  console.log(`\n==================================================================`);
  console.log(`🚀 SUPER TREINADOR SDR - VISUAL SUPER ESTÁ ONLINE!`);
  console.log(`📂 Banco de Dados: ${DB_FILE}`);
  console.log(`⚙️  Porta: ${PORT}`);
  console.log(`==================================================================`);
  console.log(`💻 Local:               http://localhost:${PORT}`);
  console.log(`🌐 Rede / Host:         http://${localIp}:${PORT}`);
  console.log(`📊 API de Banco Dados:  http://localhost:${PORT}/api/status`);
  console.log(`==================================================================\n`);
});
