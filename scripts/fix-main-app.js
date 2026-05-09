const fs = require('fs');
const path = './public/js/main-app.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/const \{ useState, useEffect, useMemo, useCallback, useRef \} = React;\n*/g, '');

const header = `(() => {
const { useState, useEffect, useMemo, useCallback, useRef } = React;
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
    QZ_SIGN_ALGORITHM
} = window.HeloApp || {};

const {
    useCart, useSpecialClient, useOrderTotal
} = window.HeloCart || {};

const {
    normalizeText, toTimestampMillis, isConcludedStatusValue, getOrderCreatedAtMillis,
    ensureFormFieldIdentifiers, ensureLabelAssociations, buildStaticAssetUrl,
    normalizeSearchTerm, buildSearchableText, ORDER_STATUS_CONCLUDED_KEY,
    OPERATION_CONCLUDED_VISIBILITY_MINUTES, OPERATION_CONCLUDED_VISIBILITY_MS,
    OPERATION_ACTIVE_STATUSES, STATIC_ASSET_VERSION
} = window.HeloAdminUtils || {};

`;

const footer = `
})();
`;

fs.writeFileSync(path, header + content + footer);
console.log('Feito');
