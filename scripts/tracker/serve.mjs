#!/usr/bin/env node
/**
 * Serves the tracker Kanban UI on localhost. Every request to /api/tracker
 * re-parses docs/tracker/TRACKER.md and rewrites tracker.json, so the board
 * always reflects the latest edit to the tracker doc with no separate sync
 * step -- the UI itself only ever reads the JSON.
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { TRACKER_MD_PATH, TRACKER_JSON_PATH, buildTrackerJson } from './parse-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = join(__dirname, 'ui');
const PORT = Number(process.env.TRACKER_PORT) || 4777;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(res, path) {
  if (!existsSync(path)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const type = CONTENT_TYPES[extname(path)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type }).end(readFileSync(path));
}

function serveTrackerJson(res) {
  if (!existsSync(TRACKER_MD_PATH)) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({ error: `TRACKER.md not found at ${TRACKER_MD_PATH}` }),
    );
    return;
  }
  const markdown = readFileSync(TRACKER_MD_PATH, 'utf8');
  const json = buildTrackerJson(markdown, 'docs/tracker/TRACKER.md');
  writeFileSync(TRACKER_JSON_PATH, JSON.stringify(json, null, 2) + '\n');
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(json));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/tracker') {
    try {
      serveTrackerJson(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  const requested = resolve(UI_DIR, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!requested.startsWith(UI_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  serveStatic(res, requested);
});

server.listen(PORT, () => {
  console.log(`Practise360 tracker board: http://localhost:${PORT}`);
});
