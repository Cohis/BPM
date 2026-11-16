# BPM (HeartBeat)

A self-hosted music streaming app: a **React Native (Expo)** mobile client and a small **Node/Express** server that streams your own MP3 library. Built to learn React Native, Node and Express.js.

## What it does

- **Streaming with seek:** the server implements HTTP `Range` requests (206 Partial Content), so the player can jump anywhere in a track without downloading the whole file.
- **Library from the filesystem:** the server reads `songs/<artist>/<album>/*.mp3` and exposes it as a JSON library, with a 30 s in-memory cache to avoid hitting the disk on every app launch.
- **Cover art:** picks `cover.*` / `folder.*` / `artwork.*` from each album folder, cached in memory.
- **Auth:** login returns a short-lived JWT (1 h); every library and stream route requires it. Login is rate-limited (10 attempts per IP per 15 min).
- **Path safety:** all path parameters go through `path.basename` and are checked to stay inside the songs directory (no path traversal).
- **Mobile player:** Expo Router app with background audio through `expo-av`.

## Stack

| Part | Tech |
| --- | --- |
| Client (`BPM/`) | Expo 54, React Native 0.81, Expo Router, TypeScript, expo-av |
| Server (`Server/`) | Node.js, Express 5, jsonwebtoken, dotenv, cors |

## Running it

Music files are **not** included in this repository. Add your own under `Server/songs/<artist>/<album>/`.

```bash
# server
cd Server
cp .env.example .env      # set JWT_SECRET and credentials
npm install
npm start                 # http://localhost:8080

# app
cd BPM
npm install
npx expo start
```

The server address is hard-coded as `SERVER` at the top of `BPM/app/index.tsx`; point it to your machine's LAN IP.

## API

| Route | Description |
| --- | --- |
| `POST /auth` | `{ us, pass }` → `{ token }` |
| `GET /library` | Full artist → album → files tree |
| `GET /artists`, `/albums/:artist`, `/songs/:artist/:album` | Partial listings |
| `GET /cover/:artist/:album` | Album cover |
| `GET /stream/:artist/:album/:file` | Range-aware audio stream |
| `GET /download/:artist/:album/:file` | File download |
| `GET /health` | Uptime and cache size |

## Status

Work in progress. Next: user registration, correct artist names and photos.
