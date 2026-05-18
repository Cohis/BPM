require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();

// --- CONFIGURAÇÕES ---
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;
const AUTH_USER = process.env.AUTH_USER || 'myself';
const AUTH_PASS = process.env.AUTH_PASS || 'password';
const SONGS_DIR = path.resolve(__dirname, 'songs');

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET não definido no .env');
  process.exit(1);
}

// Cria pasta songs se não existir
if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
  console.log('[INFO] Pasta songs/ criada automaticamente');
}

// Middlewares
app.use(express.json());
app.use(cors()); // libera CORS para desenvolvimento/mobile

// --- RATE LIMITING SIMPLES (memória) ---
const authAttempts = new Map();
function rateLimitAuth(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = authAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000); // 15 min
  if (recent.length >= 10) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  }
  recent.push(now);
  authAttempts.set(ip, recent);
  next();
}

// --- AUTH ---
app.post('/auth', rateLimitAuth, (req, res) => {
  const { us, pass } = req.body;
  if (!us || !pass) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  if (us === AUTH_USER && pass === AUTH_PASS) {
    const token = jwt.sign({ user: us }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

// --- MIDDLEWARE JWT ---
function authmiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const queryToken = req.query.token;
  const rawToken = authHeader ? authHeader.split(' ')[1] : queryToken;

  if (!rawToken) return res.sendStatus(401);

  jwt.verify(rawToken, JWT_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
}

// --- LISTAR MÚSICAS ---
app.get('/songs', authmiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(SONGS_DIR).filter(f => f.endsWith('.mp3'));
    res.json(files);
  } catch (err) {
    console.error('[ERRO] Falha ao ler songs:', err);
    res.status(500).json({ error: 'Erro ao ler diretório de músicas' });
  }
});

// --- STREAM / DOWNLOAD ---
app.get('/songs/:file', authmiddleware, (req, res) => {
  streamsong(req, res, req.params.file, false);
});

app.get('/songs/:file/download', authmiddleware, (req, res) => {
  streamsong(req, res, req.params.file, true);
});

function streamsong(req, res, filename, download = false) {
  // 1. Sanitização contra Path Traversal
  const safeName = path.basename(filename);
  const songPath = path.resolve(SONGS_DIR, safeName);

  if (!songPath.startsWith(SONGS_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(songPath)) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  const stat = fs.statSync(songPath);
  const fileSize = stat.size;

  // 2. Download direto
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    const stream = fs.createReadStream(songPath);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[ERRO Stream download]', err.message);
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

  // 3. Streaming com suporte a HTTP Range (permite seek no player)
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).send('Range Not Satisfiable');
    }

    const chunkSize = (end - start) + 1;
    const stream = fs.createReadStream(songPath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/mpeg',
    });

    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[ERRO Stream range]', err.message);
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

  // 4. Streaming sem Range (primeira requisição)
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(songPath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[ERRO Stream]', err.message);
    if (!res.headersSent) res.sendStatus(500);
  });
  res.on('close', () => stream.destroy());
}

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- 404 GLOBAL ---
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`[HeartBeat] Server running at port ${PORT}`);
  console.log(`[HeartBeat] Songs dir: ${SONGS_DIR}`);
});