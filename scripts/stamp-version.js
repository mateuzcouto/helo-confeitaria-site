#!/usr/bin/env node
/**
 * stamp-version.js
 *
 * Gera uma versão única baseada em timestamp e substitui automaticamente
 * TODOS os "?v=..." no index.html pelo novo valor.
 *
 * Executado como parte do prepare:hosting — garante que cada deploy
 * invalide o cache de todos os assets (JS, CSS, favicon) sem intervenção manual.
 *
 * Formato da versão: YYYYMMDD-HHmmss (UTC)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '..', 'public', 'index.html');

// ── Gera versão única ──────────────────────────────────────────────────────
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    '-',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
].join('');

// ── Lê e atualiza index.html ───────────────────────────────────────────────
let html = fs.readFileSync(HTML_PATH, 'utf8');

// Substitui todas as ocorrências de ?v=QUALQUER_COISA (em href, src, etc.)
html = html.replace(/\?v=[^"'\s>]*/g, `?v=${version}`);

// Atualiza o meta tag deploy-version
html = html.replace(
    /(<meta\s+name="deploy-version"\s+content=")[^"]*(")/,
    `$1${version}$2`
);

fs.writeFileSync(HTML_PATH, html, 'utf8');

console.log(`[stamp-version] versão aplicada: ${version}`);
