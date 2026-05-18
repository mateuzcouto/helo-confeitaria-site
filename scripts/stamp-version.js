#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   stamp-version.js — CARIMBO DE VERSÃO PARA CACHE-BUST AUTOMÁTICO
   ═══════════════════════════════════════════════════════════════════════
   Gera uma versão única baseada em timestamp UTC e substitui automaticamente
   TODOS os "?v=..." em index.html e admin.html pelo novo valor.

   Por que existe:
   - O Firebase Hosting cacheia JS/CSS por 1 ano (immutable). Sem versionamento,
     clientes ficariam com a versão antiga até o cache expirar.
   - Adicionar `?v=NOVA_VERSAO` muda a URL e força o navegador a baixar a versão
     nova, mantendo o cache imutável (continua funcionando rápido).

   Quando rodar:
   - Manual:    `node scripts/stamp-version.js`
   - Automático (predeploy): rodado por `npm run prepare:hosting`

   Formato da versão: YYYYMMDD-HHmmss (UTC para evitar drift entre máquinas).

   Riscos:
   - O padrão de busca (regex global) que casa "?v=" até o próximo delimitador
     é AGRESSIVO: substitui qualquer ocorrência de query string ?v= no HTML.
     Se algum atributo legítimo precisar manter um parâmetro ?v= específico
     (improvável), não vai sobreviver. Aceitável dado o uso atual (todos os
     ?v= no projeto são para cache-bust).

   @update 2026-05-09 — Adicionado JSDoc por bloco sem alterar lógica.
   @update 2026-05-18 — Gera deploy-version.json e sincroniza VERSAO_ASSETS_ESTATICOS.
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

const fs   = require('fs');
const path = require('path');

/** HTMLs que recebem o carimbo de versão (vitrine + admin + confirmação PIX). */
const HTML_PATHS = [
    path.resolve(__dirname, '..', 'public', 'index.html'),
    path.resolve(__dirname, '..', 'public', 'admin.html'),
    path.resolve(__dirname, '..', 'public', 'confirmacao.html'),
];

/** JSON público consultado pelo bootstrap (WebView Instagram ignora cache do HTML). */
const DEPLOY_VERSION_JSON_PATH = path.resolve(__dirname, '..', 'public', 'deploy-version.json');

/** Fonte da constante VERSAO_ASSETS_ESTATICOS em admin-utils.js. */
const ADMIN_UTILS_PATH = path.resolve(__dirname, '..', 'public', 'js', 'core', 'utils', 'admin-utils.js');

/* ── Gera versão única no formato YYYYMMDD-HHmmss em UTC ─────────────────
   Por que UTC e não horário local?
   - Garante que dois deploys feitos em fusos diferentes (dev no Brasil,
     CI nos EUA) gerem versões em ordem cronológica correta.
   - Evita confusão com horário de verão. */
const now = new Date();

/**
 * Padroniza um número em string de 2 caracteres com zero à esquerda.
 *
 * @param {number|string} n - Valor a padronizar (ex: 5)
 * @returns {string} Valor com pelo menos 2 dígitos (ex: '05')
 */
const pad = (n) => String(n).padStart(2, '0');

const version = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),  // getUTCMonth retorna 0-11
    pad(now.getUTCDate()),
    '-',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
].join('');

/* ── Aplica a substituição em cada HTML configurado ──────────────────────
   Pula silenciosamente arquivos que não existem (ex: alguém rodou em
   um setup parcial). Não falha o deploy por causa disso. */
HTML_PATHS.forEach((htmlPath) => {
    if (!fs.existsSync(htmlPath)) return;

    let html = fs.readFileSync(htmlPath, 'utf8');

    // Substitui todas as ocorrências de ?v=QUALQUER_COISA (em href, src, etc.)
    html = html.replace(/\?v=[^"'\s>]*/g, `?v=${version}`);

    // Atualiza o meta tag deploy-version (usado por monitoria e debug em produção)
    html = html.replace(
        /(<meta\s+name="deploy-version"\s+content=")[^"]*(")/,
        `$1${version}$2`
    );

    fs.writeFileSync(htmlPath, html, 'utf8');
});

/* ── deploy-version.json — fonte da verdade para o bootstrap no <head> ───
   Sempre no-store no Firebase; o cliente compara com meta deploy-version. */
fs.writeFileSync(
    DEPLOY_VERSION_JSON_PATH,
    JSON.stringify({ version }, null, 2) + '\n',
    'utf8'
);

/* ── admin-utils.js — URLs dinâmicas com o mesmo ?v= do deploy ─────────── */
if (fs.existsSync(ADMIN_UTILS_PATH)) {
    let adminUtils = fs.readFileSync(ADMIN_UTILS_PATH, 'utf8');
    const substituido = adminUtils.replace(
        /(const VERSAO_ASSETS_ESTATICOS = ')[^']*(')/,
        `$1${version}$2`
    );
    if (substituido !== adminUtils) {
        fs.writeFileSync(ADMIN_UTILS_PATH, substituido, 'utf8');
        console.log(`[stamp-version] VERSAO_ASSETS_ESTATICOS → ${version}`);
    }
}

console.log(`[stamp-version] versão aplicada: ${version}`);
console.log(`[stamp-version] deploy-version.json atualizado`);
