require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();

//recriar arquivo do 0 (um dia)

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
app.use(cors());

// --- RATE LIMITING SIMPLES (memória) ---
const authAttempts = new Map();
function rateLimitAuth(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = authAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
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

// ============================================
// NOVAS ROTAS COM ESTRUTURA DE PASTAS
// ============================================

/**
 * GET /library
 * Retorna a biblioteca completa como árvore JSON:
 * {
 *   "Deftones": {
 *     "White Pony": ["Change (In the House of Flies).mp3", "Digital Bath.mp3"],
 *     "Around the Fur": ["My Own Summer.mp3"]
 *   },
 *   "The Strokes": { ... }
 * }
 */
app.get('/library', authmiddleware, (req, res) => {
  try {
    const library = {};
    const artists = fs.readdirSync(SONGS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const artist of artists) {
      const artistPath = path.join(SONGS_DIR, artist);
      const albums = fs.readdirSync(artistPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      library[artist] = {};

      for (const album of albums) {
        const albumPath = path.join(artistPath, album);
        const files = fs.readdirSync(albumPath)
          .filter(f => f.endsWith('.mp3'));
        library[artist][album] = files;
      }
    }

    res.json(library);
  } catch (err) {
    console.error('[ERRO] Falha ao ler biblioteca:', err);
    res.status(500).json({ error: 'Erro ao ler biblioteca de músicas' });
  }
});

/**
 * GET /artists
 * Retorna lista simples de artistas
 */
app.get('/artists', authmiddleware, (req, res) => {
  try {
    const artists = fs.readdirSync(SONGS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler artistas' });
  }
});

/**
 * GET /albums/:artist
 * Retorna os álbuns de um artista
 */
app.get('/albums/:artist', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const artistPath = path.resolve(SONGS_DIR, artist);

    if (!artistPath.startsWith(SONGS_DIR) || !fs.existsSync(artistPath)) {
      return res.status(404).json({ error: 'Artista não encontrado' });
    }

    const albums = fs.readdirSync(artistPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    res.json(albums);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler álbuns' });
  }
});

/**
 * GET /songs/:artist/:album
 * Retorna as músicas de um álbum
 */
app.get('/songs/:artist/:album', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const album = path.basename(req.params.album);
    const albumPath = path.resolve(SONGS_DIR, artist, album);

    if (!albumPath.startsWith(SONGS_DIR) || !fs.existsSync(albumPath)) {
      return res.status(404).json({ error: 'Álbum não encontrado' });
    }

    const songs = fs.readdirSync(albumPath)
      .filter(f => f.endsWith('.mp3'));

    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler músicas' });
  }
});

/**
 * GET /cover/:artist/:album
 * Retorna a imagem de capa do álbum (cover.jpg, cover.png, folder.jpg, etc.)
 */
app.get('/cover/:artist/:album', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const album = path.basename(req.params.album);
    const albumPath = path.resolve(SONGS_DIR, artist, album);

    if (!albumPath.startsWith(SONGS_DIR) || !fs.existsSync(albumPath)) {
      return res.status(404).json({ error: 'Álbum não encontrado' });
    }

    // Procura por arquivos de capa comuns
    const possibleCovers = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.jpeg', 'folder.png', 'artwork.jpg', 'artwork.jpeg', 'artwork.png'];
    let coverPath = null;

    for (const coverName of possibleCovers) {
      const testPath = path.join(albumPath, coverName);
      if (fs.existsSync(testPath)) {
        coverPath = testPath;
        break;
      }
    }

    if (!coverPath) {
      return res.status(404).json({ error: 'Capa não encontrada' });
    }

    const ext = path.extname(coverPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    res.setHeader('Content-Type', mimeType);
    const stream = fs.createReadStream(coverPath);
    stream.pipe(res);
    stream.on('error', (err) => {
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());

  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler capa' });
  }
});

/**
 * GET /stream/:artist/:album/:file
 * Stream de uma música específica
 */
app.get('/stream/:artist/:album/:file', authmiddleware, (req, res) => {
  const artist = path.basename(req.params.artist);
  const album = path.basename(req.params.album);
  const filename = path.basename(req.params.file);
  streamsong(req, res, artist, album, filename);
});

/**
 * GET /download/:artist/:album/:file
 * Download de uma música
 */
app.get('/download/:artist/:album/:file', authmiddleware, (req, res) => {
  const artist = path.basename(req.params.artist);
  const album = path.basename(req.params.album);
  const filename = path.basename(req.params.file);
  streamsong(req, res, artist, album, filename, true);
});

// ============================================
// FUNÇÃO DE STREAMING
// ============================================
function streamsong(req, res, artist, album, filename, download = false) {
  const songPath = path.resolve(SONGS_DIR, artist, album, filename);

  if (!songPath.startsWith(SONGS_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(songPath)) {
    return res.status(404).json({ error: 'Música não encontrada' });
  }

  const stat = fs.statSync(songPath);
  const fileSize = stat.size;

  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    const stream = fs.createReadStream(songPath);
    stream.pipe(res);
    stream.on('error', (err) => {
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

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
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(songPath);
  stream.pipe(res);
  stream.on('error', (err) => {
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