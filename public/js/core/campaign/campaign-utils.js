(function initHeloCampaignUtils(globalScope) {
    'use strict';

    // Fase 2 da modularização: utilitários de campanha centralizados.
    // Mantém API estável via window.HeloCampaignUtils para consumo gradual em app.js.
    const existing = globalScope.HeloCampaignUtils || {};
    const coreUtils = globalScope.HeloCoreUtils || {};

    const safeText = coreUtils.safeText || ((val, fallback = '') => {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'object') return fallback;
        return String(val);
    });

    const normalizeDateOnlyValue = coreUtils.normalizeDateOnlyValue || ((value, fallback = '') => {
        const raw = safeText(value).trim();
        return raw || fallback;
    });

    const formatDateOnlyForDisplay = coreUtils.formatDateOnlyForDisplay || ((value, fallback = 'Data Invalida') => {
        const raw = safeText(value).trim();
        if (!raw) return fallback;
        const parts = raw.split('-');
        if (parts.length !== 3) return fallback;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    });

    const getDateOnlyParts = coreUtils.getDateOnlyParts || ((value) => {
        const raw = safeText(value).trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    });

    const normalizeCampaignStatus = (value) => {
        const normalized = safeText(value, 'inativo')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        return normalized === 'ativo' ? 'ativo' : 'inativo';
    };

    const normalizeCampaignId = (value, fallback = 'evento_anterior') => {
        const id = safeText(value).trim();
        return id || fallback;
    };

    const normalizeCampaignName = (value, fallback = 'Evento Anterior') => {
        const name = safeText(value).trim();
        return name || fallback;
    };

    const normalizeCampaignMode = (value, allowedModes = ['manual', 'auto', 'hybrid'], fallback = 'manual') => {
        const mode = safeText(value, fallback).toLowerCase().trim();
        if (allowedModes.includes(mode)) return mode;
        return fallback;
    };

    const normalizeDateOnlyOrEmpty = (value) => {
        const normalized = normalizeDateOnlyValue(value, '');
        return normalized || '';
    };

    const normalizeCampaignPriority = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(-999, Math.min(999, Math.trunc(n)));
    };

    const toLocalDayStart = (dateOnlyValue) => {
        const parts = getDateOnlyParts(dateOnlyValue);
        if (!parts) return null;
        return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
    };

    const toLocalDayEnd = (dateOnlyValue) => {
        const start = toLocalDayStart(dateOnlyValue);
        if (!start) return null;
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return end;
    };

    const isCampaignAutoActiveNow = (campaign, now = new Date()) => {
        if (!campaign || campaign.autoEnabled !== true) return false;
        const start = toLocalDayStart(campaign.startDate);
        const end = toLocalDayEnd(campaign.endDate);
        if (!start && !end) return false;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
    };

    const getCampaignScheduleRange = (campaign) => {
        if (!campaign || campaign.autoEnabled !== true) return null;
        const startDate = normalizeDateOnlyOrEmpty(campaign.startDate);
        const endDate = normalizeDateOnlyOrEmpty(campaign.endDate);
        if (!startDate && !endDate) return null;
        const start = startDate ? toLocalDayStart(startDate) : null;
        const end = endDate ? toLocalDayEnd(endDate) : null;
        return {
            startDate,
            endDate,
            startMs: start ? start.getTime() : Number.NEGATIVE_INFINITY,
            endMs: end ? end.getTime() : Number.POSITIVE_INFINITY,
        };
    };

    const normalizeCampaignDoc = (docLike = {}, options = {}) => {
        const {
            generalId = 'dia_a_dia',
            generalName = 'Dia a Dia',
            defaultName = 'Evento Anterior',
            legacyId = 'evento_anterior',
        } = options;

        return {
            id: normalizeCampaignId(docLike.id, legacyId),
            nome: normalizeCampaignName(docLike.nome, docLike.id === generalId ? generalName : defaultName),
            status: normalizeCampaignStatus(docLike.status),
            autoEnabled: docLike.autoEnabled === true,
            startDate: normalizeDateOnlyOrEmpty(docLike.startDate),
            endDate: normalizeDateOnlyOrEmpty(docLike.endDate),
            priority: normalizeCampaignPriority(docLike.priority),
            data_criacao: docLike.data_criacao || docLike.createdAt || null,
        };
    };

    const buildCampaignScheduleConflicts = (campaignList = [], options = {}) => {
        const list = (Array.isArray(campaignList) ? campaignList : [])
            .map((item) => normalizeCampaignDoc(item, options))
            .map((item) => ({
                ...item,
                schedule: getCampaignScheduleRange(item),
            }))
            .filter((item) => item.schedule);

        const conflicts = [];
        for (let i = 0; i < list.length; i += 1) {
            for (let j = i + 1; j < list.length; j += 1) {
                const a = list[i];
                const b = list[j];
                if (a.priority !== b.priority) continue;
                const overlaps = a.schedule.startMs <= b.schedule.endMs && b.schedule.startMs <= a.schedule.endMs;
                if (!overlaps) continue;
                conflicts.push({
                    key: [a.id, b.id].sort().join('|'),
                    ids: [a.id, b.id],
                    names: [a.nome, b.nome],
                    priority: a.priority,
                    windows: [
                        { startDate: a.schedule.startDate, endDate: a.schedule.endDate },
                        { startDate: b.schedule.startDate, endDate: b.schedule.endDate },
                    ],
                });
            }
        }
        return conflicts;
    };

    const formatCampaignWindowLabel = (startDate, endDate) => {
        if (startDate && endDate) return `${formatDateOnlyForDisplay(startDate)} a ${formatDateOnlyForDisplay(endDate)}`;
        if (startDate) return `a partir de ${formatDateOnlyForDisplay(startDate)}`;
        if (endDate) return `ate ${formatDateOnlyForDisplay(endDate)}`;
        return 'sem janela';
    };

    const isFirestorePermissionDenied = (error) => {
        const code = safeText(error?.code).toLowerCase();
        const message = safeText(error?.message).toLowerCase();
        return code.includes('permission-denied') || message.includes('insufficient permissions');
    };

    const slugifyCampaignId = (value) => {
        const normalized = safeText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return normalized || '';
    };

    const campaignBadgeStyle = (campaignId, options = {}) => {
        const { generalId = 'dia_a_dia', legacyId = 'evento_anterior' } = options;

        if (campaignId === generalId) {
            return { background: '#ecfeff', color: '#155e75', border: '1px solid #a5f3fc' };
        }

        if (campaignId === legacyId) {
            return { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
        }

        return { background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' };
    };

    globalScope.HeloCampaignUtils = {
        ...existing,
        normalizeCampaignStatus,
        normalizeCampaignId,
        normalizeCampaignName,
        normalizeCampaignMode,
        normalizeDateOnlyOrEmpty,
        normalizeCampaignPriority,
        toLocalDayStart,
        toLocalDayEnd,
        isCampaignAutoActiveNow,
        getCampaignScheduleRange,
        normalizeCampaignDoc,
        buildCampaignScheduleConflicts,
        formatCampaignWindowLabel,
        isFirestorePermissionDenied,
        slugifyCampaignId,
        campaignBadgeStyle,
    };
})(window);
