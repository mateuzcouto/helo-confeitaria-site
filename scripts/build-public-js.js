const fs = require("fs/promises");
const path = require("path");
const { transform } = require("esbuild");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sourceDir = path.join(publicDir, "js");
const outputDir = path.join(publicDir, "js-build");

const filesToCompile = [
  // Componentes React
  "components/brand-logo.component.js",
  "components/cabecalho.component.js",
  "components/rodape-site.component.js",
  "components/product-card.component.js",
  "components/vitrine-produtos.component.js",
  "components/chat-widget.component.js",

  // Core utilities
  "core/config/app-config.js",
  "core/utils/text-date-utils.js",
  "core/utils/admin-utils.js",
  "core/campaign/campaign-utils.js",
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
];

const banner =
  "/* Arquivo gerado automaticamente por scripts/build-public-js.js */\n";

/** Mesmo bloco de core-globals.js, em escopo local — evita ReferenceError nos
 *  entrypoints se a ordem de <script> falhar ou cache servir HTML antigo. */
const ENTRYPOINT_WRAP_FILES = new Set(["main-app.js", "app-admin.js"]);
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
    resolveProductMenuTab, normalizeProductForMenu, normalizeProductIdentityPart,
    buildProductIdentityKey, getTimestampMillis, getProductCompletenessScore,
    shouldPreferProductCandidate, dedupeProductsByIdentity, normalizeProductImages
} = window.HeloCatalog || {};
const {
    Cabecalho, RodapeSite, BrandLogo, ProductCard, VitrineProdutos
} = window.HeloComponents || {};
`;

const ENTRYPOINT_GLOBALS_SUFFIX = `
})();`;

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
    out = ENTRYPOINT_GLOBALS_PREFIX + out + ENTRYPOINT_GLOBALS_SUFFIX;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, `${banner}${out}`, "utf8");
  return { fileName, bytes: Buffer.byteLength(out, "utf8") };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const results = [];

  for (const fileName of filesToCompile) {
    results.push(await buildFile(fileName));
  }

  results.forEach((result) => {
    console.log(
      `[build-public-js] ${result.fileName} -> ${result.bytes} bytes`,
    );
  });
}

main().catch((error) => {
  console.error("[build-public-js] erro ao compilar scripts JSX");
  console.error(error);
  process.exitCode = 1;
});
