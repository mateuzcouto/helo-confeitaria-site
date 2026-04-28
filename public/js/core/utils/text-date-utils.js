(function initHeloCoreUtils(globalScope) {
    'use strict';

    // Fase 1 da modularização: utilitários puros extraídos para pasta core.
    // Contrato estável: funções ficam disponíveis em window.HeloCoreUtils.
    const existing = globalScope.HeloCoreUtils || {};

    const safeText = (val, fallback = '') => {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'object') return fallback;
        return String(val);
    };

    const pad2 = (value) => String(value).padStart(2, '0');

    const getDateOnlyPartsFromDate = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
        };
    };

    const getDateOnlyParts = (value) => {
        if (!value) return null;
        if (value instanceof Date) return getDateOnlyPartsFromDate(value);

        if (typeof value === 'object') {
            try {
                if (typeof value.toDate === 'function') return getDateOnlyPartsFromDate(value.toDate());
                if (typeof value.seconds === 'number') return getDateOnlyPartsFromDate(new Date(value.seconds * 1000));
            } catch {
                return null;
            }
            return null;
        }

        const raw = String(value).trim();
        if (!raw) return null;

        const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (dateOnlyMatch) {
            return {
                year: Number(dateOnlyMatch[1]),
                month: Number(dateOnlyMatch[2]),
                day: Number(dateOnlyMatch[3]),
            };
        }

        return getDateOnlyPartsFromDate(new Date(raw));
    };

    const normalizeDateOnlyValue = (value, fallback = '') => {
        const parts = getDateOnlyParts(value);
        if (!parts) return fallback;
        return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
    };

    const formatDateOnlyForDisplay = (value, fallback = 'Data Invalida') => {
        const parts = getDateOnlyParts(value);
        if (!parts) return fallback;
        return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
    };

    const toLocalDateFromDateOnly = (value) => {
        const parts = getDateOnlyParts(value);
        if (!parts) return null;
        return new Date(parts.year, parts.month - 1, parts.day);
    };

    const getLocalMonthStr = (value = new Date()) => {
        const parts = getDateOnlyParts(value);
        if (!parts) return '';
        return `${parts.year}-${pad2(parts.month)}`;
    };

    const fmtBRL = (n) => Number(n || 0).toFixed(2).replace('.', ',');

    const cardTotalWithRate = (amount, installments = 1, installmentRates = {}) =>
        Number(amount || 0) * (1 + (installmentRates[installments] ?? 0));

    const installmentText = (price, installmentRates = {}) =>
        `3x de R$ ${fmtBRL(cardTotalWithRate(price, 3, installmentRates) / 3)} no cartão`;

    const getMillis = (ts) => {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts.seconds) return ts.seconds * 1000;
        return 0;
    };

    const formatDate = (ts) => {
        if (!ts) return 'Data N/A';
        const d = typeof ts.toDate === 'function' ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
        if (!d) return 'Data N/A';
        return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const formatDateStr = (dateStr) => {
        if (!dateStr) return 'Data N/A';
        return formatDateOnlyForDisplay(dateStr);
    };

    const fmtAgendamento = (s) => {
        if (!s) return 'N/A';
        const v = String(s);
        return v.includes('-') ? v.split('-').reverse().join('/') : v;
    };

    globalScope.HeloCoreUtils = {
        ...existing,
        safeText,
        pad2,
        getDateOnlyPartsFromDate,
        getDateOnlyParts,
        normalizeDateOnlyValue,
        formatDateOnlyForDisplay,
        toLocalDateFromDateOnly,
        getLocalMonthStr,
        fmtBRL,
        cardTotalWithRate,
        installmentText,
        getMillis,
        formatDate,
        formatDateStr,
        fmtAgendamento,
    };
})(window);
