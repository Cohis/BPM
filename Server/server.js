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

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
  console.log('[INFO] Pasta songs/ criada automaticamente');
}

// Middlewares
app.use(express.json());
app.use(cors());

// --- CACHE DE BIBLIOTECA ---
// Evita ler o disco toda vez que o app abre
let libraryCache = null;
let libraryCacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 segundos

function getLibraryFromDisk() {
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
  return library;
}

function getLibrary() {
  const now = Date.now();
  if (!libraryCache || (now - libraryCacheTime) > CACHE_TTL) {
    libraryCache = getLibraryFromDisk();
    libraryCacheTime = now;
  }
  return libraryCache;
}

// --- RATE LIMITING ---
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
// ROTAS DA API
// ============================================

app.get('/library', authmiddleware, (req, res) => {
  try {
    res.json(getLibrary());
  } catch (err) {
    console.error('[ERRO] Falha ao ler biblioteca:', err);
    res.status(500).json({ error: 'Erro ao ler biblioteca de músicas' });
  }
});

app.get('/artists', authmiddleware, (req, res) => {
  try {
    const artists = Object.keys(getLibrary());
    res.json(artists);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler artistas' });
  }
});

app.get('/albums/:artist', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const lib = getLibrary();
    if (!lib[artist]) {
      return res.status(404).json({ error: 'Artista não encontrado' });
    }
    res.json(Object.keys(lib[artist]));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler álbuns' });
  }
});

app.get('/songs/:artist/:album', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const album = path.basename(req.params.album);
    const lib = getLibrary();
    if (!lib[artist] || !lib[artist][album]) {
      return res.status(404).json({ error: 'Álbum não encontrado' });
    }
    res.json(lib[artist][album]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler músicas' });
  }
});

// --- CACHE DE CAPAS (em memória) ---
const coverCache = new Map();
const COVER_MAX_AGE = 5 * 60 * 1000; // 5 minutos

app.get('/cover/:artist/:album', authmiddleware, (req, res) => {
  try {
    const artist = path.basename(req.params.artist);
    const album = path.basename(req.params.album);
    const cacheKey = `${artist}/${album}`;
    const cached = coverCache.get(cacheKey);

    // Se tem cache válido, usa
    if (cached && (Date.now() - cached.time) < COVER_MAX_AGE) {
      res.setHeader('Content-Type', cached.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(cached.buffer);
    }

    const albumPath = path.resolve(SONGS_DIR, artist, album);
    if (!albumPath.startsWith(SONGS_DIR) || !fs.existsSync(albumPath)) {
      return res.status(404).json({ error: 'Álbum não encontrado' });
    }

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

    // Lê a capa em buffer e cacheia
    const buffer = fs.readFileSync(coverPath);
    coverCache.set(cacheKey, { buffer, mimeType, time: Date.now() });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler capa' });
  }
});

// ============================================
// STREAMING OTIMIZADO
// ============================================

/**
 * Buffer maior para streaming = menos operações de I/O = mais velocidade
 * Padrão do Node.js: 64KB. Para MP3, 256KB é ideal (menor overhead).
 */
const STREAM_BUFFER_SIZE = 256 * 1024; // 256KB

app.get('/stream/:artist/:album/:file', authmiddleware, (req, res) => {
  const artist = path.basename(req.params.artist);
  const album = path.basename(req.params.album);
  const filename = path.basename(req.params.file);
  streamsong(req, res, artist, album, filename);
});

app.get('/download/:artist/:album/:file', authmiddleware, (req, res) => {
  const artist = path.basename(req.params.artist);
  const album = path.basename(req.params.album);
  const filename = path.basename(req.params.file);
  streamsong(req, res, artist, album, filename, true);
});

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

  // Download direto
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    const stream = fs.createReadStream(songPath, { highWaterMark: STREAM_BUFFER_SIZE });
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[ERRO Stream download]', err.message);
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

  // Streaming com Range (seek)
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
    // Buffer maior = chunks maiores enviados de uma vez
    const stream = fs.createReadStream(songPath, { 
      start, 
      end,
      highWaterMark: STREAM_BUFFER_SIZE 
    });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400', // Cache de 1 dia para chunks
    });

    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('[ERRO Stream range]', err.message);
      if (!res.headersSent) res.sendStatus(500);
    });
    res.on('close', () => stream.destroy());
    return;
  }

  // Streaming sem Range (primeira requisição)
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const stream = fs.createReadStream(songPath, { highWaterMark: STREAM_BUFFER_SIZE });
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[ERRO Stream]', err.message);
    if (!res.headersSent) res.sendStatus(500);
  });
  res.on('close', () => stream.destroy());
}

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), cacheSize: coverCache.size });
});

// --- 404 GLOBAL ---
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`[HeartBeat] Server running at port ${PORT}`);
  console.log(`[HeartBeat] Songs dir: ${SONGS_DIR}`);
  console.log(`[HeartBeat] Stream buffer: ${STREAM_BUFFER_SIZE / 1024}KB`);
});