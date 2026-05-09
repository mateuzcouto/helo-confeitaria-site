/* ═══════════════════════════════════════════════════════════════════════
   core-globals.js — VARIÁVEIS GLOBAIS COMPARTILHADAS
   ═══════════════════════════════════════════════════════════════════════
   Centraliza a desestruturação de módulos e hooks do React para que
   fiquem disponíveis tanto na vitrine pública (index.html) quanto
   no painel administrativo (admin.html), sem precisar carregar o
   script inteiro do admin.
   ═══════════════════════════════════════════════════════════════════════ */

var { useState, useEffect, useMemo, useCallback, useRef } = window.React || {};

var {
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

var {
    useCart, useSpecialClient, useOrderTotal
} = window.HeloCart || {};

var {
    formatPhoneForWhatsApp, getTodayStr, normalizeTimeValue, combineDateTime,
    getDaysUntilDateOnlyValue, ADMIN_SCHEDULE_CATEGORIES, ADMIN_SCHEDULE_STATUSES,
    adminScheduleCategoryLabel, normalizeSchedulePaymentToOrder, normalizeScheduleStatusToOrder,
    normalizeOrderStatusToSchedule, adminScheduleStatusColor, createAdminScheduleForm,
    ADMIN_SCHEDULE_NOTIFICATION_KEY, ADMIN_SCHEDULE_ALERT_SETTINGS_KEY,
    DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS, readAdminScheduleNotifications,
    writeAdminScheduleNotifications, readAdminScheduleAlertSettings,
    writeAdminScheduleAlertSettings, runAsyncInBatches, statusColor, buildDuplicateSet
} = window.HeloCrm || {};

var { safeMoney } = window.HeloFinance || {};

var {
    normalizeText, toTimestampMillis, isConcludedStatusValue, getOrderCreatedAtMillis,
    ensureFormFieldIdentifiers, ensureLabelAssociations, buildStaticAssetUrl,
    normalizeSearchTerm, buildSearchableText, ORDER_STATUS_CONCLUDED_KEY,
    OPERATION_CONCLUDED_VISIBILITY_MINUTES, OPERATION_CONCLUDED_VISIBILITY_MS,
    OPERATION_ACTIVE_STATUSES, STATIC_ASSET_VERSION
} = window.HeloAdminUtils || {};

var {
    CATEGORIAS, UNITS, CONVERSION_UNITS, RECIPE_TYPES, DEFAULT_MENU_TAB_OPTIONS,
    catLabel, typeLabel, typeColor, toMenuTabLabel, toMenuTabOption, mergeMenuTabOptions,
    collectMenuTabsFromProducts, buildMenuTabOptions, normalizeMenuTabKey, getMenuTabLabel,
    resolveProductMenuTab, normalizeProductForMenu, normalizeProductIdentityPart,
    buildProductIdentityKey, getTimestampMillis, getProductCompletenessScore,
    shouldPreferProductCandidate, dedupeProductsByIdentity, normalizeProductImages
} = window.HeloCatalog || {};

var {
    Cabecalho, RodapeSite, BrandLogo, ProductCard, VitrineProdutos
} = window.HeloComponents || {};
