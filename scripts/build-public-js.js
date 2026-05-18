#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build-public-js.js — TRANSPILA OS ARQUIVOS JSX DA VITRINE / ADMIN
   ═══════════════════════════════════════════════════════════════════════
   Lê todos os arquivos JSX listados em `filesToCompile`, transpila para
   JavaScript ES2020 puro via esbuild, e grava o resultado em `js-build/`.

   - Origem:  public/js/
   - Destino: public/js-build/  (NÃO editar à mão — é regenerado)
   - Browsers servidos pelo Firebase Hosting carregam os arquivos JÁ
     compilados, então JSX nunca chega no cliente em forma bruta.

   Quando rodar:
   - Manual: `npm run build:public`
   - Automático (predeploy): rodado por `npm run prepare:hosting`

   Arquivos especiais — entrypoints (main-app.js / app-admin.js):
   Eles recebem um wrapper IIFE com a desestruturação completa dos módulos
   `window.Helo*` no topo. Isso replica o efeito de `core-globals.js` em
   escopo local, garantindo que `useState`, `auth`, `fmtBRL` etc. estejam
   disponíveis mesmo se o `<script>` tag de `core-globals.js` falhar em
   carregar (cache antigo, ordem errada, etc.) — o entrypoint segue de pé.

   @update 2026-05-09 — Adicionado JSDoc por função sem alterar lógica.
   ═══════════════════════════════════════════════════════════════════════ */

const fs = require("fs/promises");
const path = require("path");
const { transform } = require("esbuild");

/* ── Caminhos derivados de __dirname para funcionar de qualquer cwd ───── */
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sourceDir = path.join(publicDir, "js");
const outputDir = path.join(publicDir, "js-build");

/**
 * Lista canônica de arquivos JSX que precisam ser compilados.
 *
 * Manter na ordem aproximada de carregamento para facilitar revisão:
 * 1. Componentes React (vitrine + admin)
 * 2. Core utilities
 * 3. Módulos de negócio (carrinho, crm, financeiro, estoque)
 * 4. Entrypoints e shell global
 *
 * Importante: ao adicionar um novo arquivo aqui, lembrar de:
 * - Referenciá-lo no HTML correto (index.html ou admin.html)
 * - Atualizar `validate-html-pages.js` se for sensível a contexto
 * - Garantir que ele use `var` para identificadores compartilhados
 *   (ver site-helo-final/site-helo-final/PDR.md §3 — Namespace Conflict)
 */
const filesToCompile = [
  // Componentes React
  "components/brand-logo.component.js",
  "components/cabecalho.component.js",
  "components/rodape-site.component.js",
  "components/product-card.component.js",
  "components/vitrine-produtos.component.js",
  "components/chat-widget.component.js",
  "components/store-closed-vitrina.component.js",
  "components/admin/admin-toggle-pill.component.js",
  "components/admin/admin-settings-card.component.js",

  // Core utilities
  "core/config/app-config.js",
  "core/constants/contatos-loja-publica.js",
  "core/utils/text-date-utils.js",
  "core/utils/admin-utils.js",
  "core/campaign/campaign-utils.js",
  "core/analytics/client-ranking.js",
  "core/catalog.js",

  // Módulos de negócio (precisam compilar JSX)
  "app.js",
  "app-admin.js",
  "carrinho.js",
  "cart-ui.js",
  "crm.js",
  "estoque.js",
  "financeiro.js",
  "main-app.js",
  "script.js",
  "core-globals.js",
  "confirmacao.js",
];

/** Banner inserido no topo de cada arquivo gerado para sinalizar origem. */
const banner =
  "/* Arquivo gerado automaticamente por scripts/build-public-js.js */\n";

/**
 * Conjunto dos arquivos que recebem o wrapper IIFE com globals embutidos.
 *
 * Esses são os entrypoints "raiz" do app: se o `core-globals.js` falhar
 * em carregar (cache antigo, ordem de scripts errada), o entrypoint ainda
 * tem acesso às APIs globais via wrapper local. Mesmo bloco que está no
 * core-globals.js, repetido aqui em escopo de função para evitar
 * ReferenceError em ambiente degradado.
 */
const ENTRYPOINT_WRAP_FILES = new Set(["main-app.js", "app-admin.js"]);

/**
 * Prefixo que abre a IIFE e desestrutura todos os globals usados pelos
 * entrypoints. Mantido em sincronia manual com core-globals.js — qualquer
 * mudança em um precisa ser refletida no outro.
 */
const ENTRYPOINT_GLOBALS_PREFIX = `(() => {
const { useState, useEffect, useMemo, useCallback, useRef } = window.React || {};
const {
    auth, db, getCol, getMetaDoc, CAMPAIGN_LEGACY_ID, CAMPAIGN_GENERAL_ID,
    CAMPAIGN_DEFAULT_NAME, CAMPAIGN_GENERAL_NAME, CAMPAIGN_MODE_MANUAL,
    CAMPAIGN_MODE_AUTO, CAMPAIGN_MODE_HYBRID, ADMIN_CLAIM_KEY, DELIVERY_FEE,
    DAY_TO_DAY_DELIVERY_FEE, VIP_THRESHOLD, VIP_DISCOUNT, CARD_INSTALLMENT_RATES,
    DEFAULT_THERMAL_PRINT_SETTINGS, safeText, pad2, getDateOnlyPartsFromDate,
    getDateOnlyParts, normalizeDateOnlyValue, formatDateOnlyForDisplay,
    toLocalDateFromDateOnly, getLocalMonthStr, fmtBRL, cardTotalWithRate,
    installmentText, formatDate, formatDateStr, fmtAgendamento, normalizeCampaignStatus,
    normalizeCampaignId, normalizeCampaignName, normalizeCampaignMode,
    normalizeDateOnlyOrEmpty, normalizeCampaignPriority, toLocalDayStart,
    toLocalDayEnd, isCampaignAutoActiveNow, getCampaignScheduleRange,
    buildCampaignScheduleConflicts, formatCampaignWindowLabel,
    isFirestorePermissionDenied, slugifyCampaignId, normalizeCampaignDoc,
    campaignBadgeStyle, QZ_SECURITY_ENABLED, QZ_CERT_ENDPOINT, QZ_SIGN_ENDPOINT,
    QZ_SIGN_ALGORITHM, normalizeThermalPrintMode, normalizeThermalPrintTicketMode,
    normalizeThermalPrintSettings
} = window.HeloApp || {};
const {
    useCart, useSpecialClient, useOrderTotal
} = window.HeloCart || {};
const {
    formatPhoneForWhatsApp, getTodayStr, normalizeTimeValue, combineDateTime,
    getDaysUntilDateOnlyValue, ADMIN_SCHEDULE_CATEGORIES, ADMIN_SCHEDULE_STATUSES,
    adminScheduleCategoryLabel, normalizeSchedulePaymentToOrder, normalizeScheduleStatusToOrder,
    normalizeOrderStatusToSchedule, adminScheduleStatusColor, createAdminScheduleForm,
    ADMIN_SCHEDULE_NOTIFICATION_KEY, ADMIN_SCHEDULE_ALERT_SETTINGS_KEY,
    DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS, readAdminScheduleNotifications,
    writeAdminScheduleNotifications, readAdminScheduleAlertSettings,
    writeAdminScheduleAlertSettings, runAsyncInBatches, statusColor, buildDuplicateSet
} = window.HeloCrm || {};
const { safeMoney } = window.HeloFinance || {};
const {
    normalizeText, toTimestampMillis, isConcludedStatusValue, getOrderCreatedAtMillis,
    ensureFormFieldIdentifiers, ensureLabelAssociations, buildStaticAssetUrl,
    normalizeSearchTerm, buildSearchableText, ORDER_STATUS_CONCLUDED_KEY,
    OPERATION_CONCLUDED_VISIBILITY_MINUTES, OPERATION_CONCLUDED_VISIBILITY_MS,
    OPERATION_ACTIVE_STATUSES, STATIC_ASSET_VERSION
} = window.HeloAdminUtils || {};
const {
    CATEGORIAS, UNITS, CONVERSION_UNITS, RECIPE_TYPES, DEFAULT_MENU_TAB_OPTIONS,
    catLabel, typeLabel, typeColor, toMenuTabLabel, toMenuTabOption, mergeMenuTabOptions,
    collectMenuTabsFromProducts, buildMenuTabOptions, normalizeMenuTabKey, getMenuTabLabel,
    obterChaveAbaBebidas, produtoPertenceAbaBebidas, selecionarProdutosSugestaoCocaColaZero,
    resolveProductMenuTab, normalizeProductForMenu, normalizeProductIdentityPart,
    buildProductIdentityKey, getTimestampMillis, getProductCompletenessScore,
    shouldPreferProductCandidate, dedupeProductsByIdentity, normalizeProductImages
} = window.HeloCatalog || {};
const {
    Cabecalho, RodapeSite, BrandLogo, ProductCard, VitrineProdutos
} = window.HeloComponents || {};
`;

/** Sufixo que fecha a IIFE aberta pelo prefixo acima. */
const ENTRYPOINT_GLOBALS_SUFFIX = `
})();`;

/**
 * Compila um único arquivo JSX para JavaScript ES2020.
 *
 * @param {string} fileName - Caminho relativo dentro de `public/js/`
 *                            (ex: 'components/product-card.component.js')
 * @returns {Promise<{fileName:string, bytes:number}>} Estatísticas para log
 *
 * Pipeline:
 * 1. Lê o arquivo fonte como UTF-8
 * 2. Roda esbuild.transform com loader='jsx' e target='es2020'
 *    - jsxFactory: React.createElement (compatível com React 18 via CDN)
 *    - jsxFragment: React.Fragment
 *    - sem source-map: economiza ~30% do tamanho do bundle
 * 3. Se for entrypoint, embrulha com IIFE + globals (proteção defensiva)
 * 4. Cria pasta de destino se não existir
 * 5. Grava com banner no topo (sinaliza que é arquivo gerado)
 */
async function buildFile(fileName) {
  const sourcePath = path.join(sourceDir, fileName);
  const targetPath = path.join(outputDir, fileName);
  const targetDir = path.dirname(targetPath);
  const sourceCode = await fs.readFile(sourcePath, "utf8");
  const result = await transform(sourceCode, {
    loader: "jsx",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "es2020",
    charset: "utf8",
    sourcemap: false,
  });

  let out = result.code;
  if (ENTRYPOINT_WRAP_FILES.has(fileName)) {
    // Entrypoints recebem wrapper IIFE com globals locais (defensivo)
    out = ENTRYPOINT_GLOBALS_PREFIX + out + ENTRYPOINT_GLOBALS_SUFFIX;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, `${banner}${out}`, "utf8");
  return { fileName, bytes: Buffer.byteLength(out, "utf8") };
}

/**
 * Orquestra a compilação de todos os arquivos da lista `filesToCompile`.
 *
 * Compila SERIALMENTE (não em paralelo) por escolha consciente:
 * - Build inteiro leva < 1s mesmo serial (esbuild é rápido)
 * - Logs ficam ordenados, facilita diagnóstico em CI
 * - Evita picos de I/O em discos lentos / Windows com OneDrive
 *
 * @returns {Promise<void>} Conclui quando todos os arquivos foram gravados
 */
async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const results = [];

  for (const fileName of filesToCompile) {
    results.push(await buildFile(fileName));
  }

  // Imprime tabela simples de tamanho final por arquivo (ajuda a flagar bloat)
  results.forEach((result) => {
    console.log(
      `[build-public-js] ${result.fileName} -> ${result.bytes} bytes`,
    );
  });
}

/* ── Entrypoint do script: erro fatal vira exit code != 0 (CI friendly) ── */
main().catch((error) => {
  console.error("[build-public-js] erro ao compilar scripts JSX");
  console.error(error);
  process.exitCode = 1;
});
