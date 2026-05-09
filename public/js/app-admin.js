/* ═══════════════════════════════════════════════════════════════════════
   app-admin.js — ENTRYPOINT EXCLUSIVO DO PAINEL ADMINISTRATIVO
   Deploy: 08/05/2026 | Versão: 20260508-235421
   ═══════════════════════════════════════════════════════════════════════
   Este é o componente raiz carregado pelo admin.html. Ele centraliza
   todos os estados, listeners e lógica necessários para o painel de
   administração da Helô Confeitaria, SEM conter nenhum código da
   vitrine pública (hero, carrinho de cliente, busca de produtos).

   Criado na Fase 2 da otimização de separação Vitrine × Admin.
   @update 2026-05-08 — Extraído do main-app.js para isolar o bundle admin.

   Estrutura:
   1. ESTADOS GLOBAIS — Produtos, pedidos, campanhas, cupons, estoque,
      financeiro, feedbacks, configurações do site
   2. CÁLCULOS MEMOIZADOS — Campanha ativa, normalização
   3. EFEITOS (useEffect) — Auth listener, migração de campanhas,
      listeners Firestore (públicos + admin), timeout de skeleton
   4. FUNÇÕES DE LOGIN — handleEmailLogin, syncAdminClaimForUser,
      awaitAdminClaimPropagation, hasAdminClaim
   5. RENDERIZAÇÃO — FeedbackExperience > AreaAdministrativa
   ═══════════════════════════════════════════════════════════════════════ */

const AdminApp = () => {
    /* ════════════════════════════════════════════════════════════════
       ESTADOS GLOBAIS — Dados do Firebase e configurações
       ════════════════════════════════════════════════════════════════ */
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [allOrders, setAllOrders] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [ordersLoaded, setOrdersLoaded] = useState(false);
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [allCoupons, setAllCoupons] = useState([]);
    const [financialEntries, setFinancialEntries] = useState([]);
    const [visitsData, setVisitsData] = useState({ count: 0, lastVisit: null });
    const [siteSettings, setSiteSettings] = useState({
        maxUnits: 70, orderDeadline: '2026-03-31T19:00', siteMode: 'livre',
        campaignMode: CAMPAIGN_MODE_MANUAL, activeCampaignOverrideId: '',
        isDeliveryAvailable: true, chavePix: '88996549074', nomeTitularPix: '',
        ...DEFAULT_THERMAL_PRINT_SETTINGS
    });
    const [ingredients, setIngredients] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);

    /* ── Estados de UI e controle admin ──────────────────────────── */
    const [isAdmin, setIsAdmin] = useState(false);
    const [dbError, setDbError] = useState(null);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [adminActiveTab, setAdminActiveTab] = useState('orders');
    const [ordersPageSize, setOrdersPageSize] = useState(50);
    const [ordersHasMore, setOrdersHasMore] = useState(false);
    const [adminShellLoaded, setAdminShellLoaded] = useState(false);
    const [ordersLastSyncAt, setOrdersLastSyncAt] = useState(0);
    const [ordersRealtimeChannelStatus, setOrdersRealtimeChannelStatus] = useState('idle');
    const [ordersRealtimeRecentFailures, setOrdersRealtimeRecentFailures] = useState(0);

    /* ── Refs para evitar closure stale nos error handlers ───────── */
    const isAdminRef = React.useRef(false);
    useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);
    const loginInProgressRef = React.useRef(false);
    const lightOrdersKnownKeysRef = React.useRef(new Set());

    /**
     * Garante `id` e `name` em campos de formulário do painel admin.
     *
     * @returns {void}
     * @update 2026-05-09 — Adiciona observador de mutações para campos dinâmicos do script.js.
     */
    useEffect(() => {
        const garantirIdsCampos = window?.HeloAdminUtils?.garantirIdsUnicosCamposFormulario;
        const garantirLabelsCampos = window?.HeloAdminUtils?.garantirAssociacaoLabelsCampos;
        if (typeof garantirIdsCampos !== 'function' || typeof garantirLabelsCampos !== 'function') return undefined;

        garantirIdsCampos(document);
        garantirLabelsCampos(document);

        let queued = false;
        const observer = new MutationObserver((mutations) => {
            if (queued) return;
            const hasRelevantNode = mutations.some((mutation) =>
                Array.from(mutation.addedNodes || []).some((node) =>
                    node && node.nodeType === 1
                    && ((node.matches && node.matches('input, select, textarea, label'))
                        || (node.querySelector && node.querySelector('input, select, textarea, label')))
                )
            );
            if (!hasRelevantNode) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                garantirIdsCampos(document);
                garantirLabelsCampos(document);
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    /* ════════════════════════════════════════════════════════════════
       CÁLCULOS MEMOIZADOS — Campanhas
       ════════════════════════════════════════════════════════════════ */
    const normalizedCampaigns = useMemo(() => {
        const list = (Array.isArray(campaigns) ? campaigns : []).map(normalizeCampaignDoc);
        if (list.length === 0) {
            return [
                { id: CAMPAIGN_GENERAL_ID, nome: CAMPAIGN_GENERAL_NAME, status: 'ativo', autoEnabled: false, startDate: '', endDate: '', priority: 0, data_criacao: null },
                { id: CAMPAIGN_LEGACY_ID, nome: CAMPAIGN_DEFAULT_NAME, status: 'inativo', autoEnabled: false, startDate: '', endDate: '', priority: 0, data_criacao: null },
            ];
        }
        return list;
    }, [campaigns]);

    const activeCampaign = useMemo(() => {
        const fallbackGeneral = normalizedCampaigns.find(item => item.id === CAMPAIGN_GENERAL_ID)
            || normalizedCampaigns[0]
            || { id: CAMPAIGN_GENERAL_ID, nome: CAMPAIGN_GENERAL_NAME, status: 'ativo', autoEnabled: false, startDate: '', endDate: '', priority: 0 };

        const overrideId = safeText(siteSettings.activeCampaignOverrideId).trim();
        if (overrideId) {
            const overrideCampaign = normalizedCampaigns.find(item => item.id === overrideId);
            if (overrideCampaign) return overrideCampaign;
        }

        const manualActive = normalizedCampaigns.find(item => normalizeCampaignStatus(item.status) === 'ativo');

        const autoCandidates = normalizedCampaigns
            .filter(item => isCampaignAutoActiveNow(item))
            .sort((a, b) => {
                const byPriority = normalizeCampaignPriority(b.priority) - normalizeCampaignPriority(a.priority);
                if (byPriority !== 0) return byPriority;
                return safeText(b.id).localeCompare(safeText(a.id));
            });
        const autoActive = autoCandidates[0] || null;

        const mode = normalizeCampaignMode(siteSettings.campaignMode);
        if (mode === CAMPAIGN_MODE_AUTO) {
            return autoActive || manualActive || fallbackGeneral;
        }
        if (mode === CAMPAIGN_MODE_HYBRID) {
            return manualActive || autoActive || fallbackGeneral;
        }
        return manualActive || autoActive || fallbackGeneral;
    }, [normalizedCampaigns, siteSettings.campaignMode, siteSettings.activeCampaignOverrideId]);

    /* ── feedbackOrderId: ID do pedido para tela de feedback ──────── */
    const feedbackOrderId = useMemo(() => {
        try {
            return new URLSearchParams(window.location.search).get('feedback');
        } catch (_) {
            return null;
        }
    }, []);

    const hasAdminClaim = useCallback(async (candidateUser, forceRefresh = false) => {
        try {
            const tokenResult = await candidateUser.getIdTokenResult(forceRefresh);
            return !!tokenResult?.claims?.[ADMIN_CLAIM_KEY];
        } catch (_) {
            return false;
        }
    }, [ADMIN_CLAIM_KEY]);

    const isTransientFirestoreError = useCallback((error) => {
        const message = safeText(error?.message).toLowerCase();
        const code = safeText(error?.code).toLowerCase();
        return (
            message.includes('offline')
            || message.includes('network')
            || message.includes('unavailable')
            || message.includes('failed to get')
            || message.includes('webchannelconnection')
            || code.includes('unavailable')
        );
    }, []);

    const loadAdminShellScript = useCallback(() => {
        if (typeof window === 'undefined') return Promise.resolve(false);
        if (window.AreaAdministrativa || window.AdminPanel || window.FeedbackExperience) {
            setAdminShellLoaded(true);
            return Promise.resolve(true);
        }

        const scriptAlreadyInDom = Array.from(document.scripts || []).find((item) => safeText(item.src).includes('/js-build/script.js'));
        if (scriptAlreadyInDom) {
            return new Promise((resolve) => {
                if (window.AreaAdministrativa || window.AdminPanel || window.FeedbackExperience) {
                    setAdminShellLoaded(true);
                    resolve(true);
                    return;
                }
                scriptAlreadyInDom.addEventListener('load', () => {
                    setAdminShellLoaded(true);
                    resolve(true);
                }, { once: true });
                scriptAlreadyInDom.addEventListener('error', () => resolve(false), { once: true });
            });
        }

        const appAdminScript = Array.from(document.scripts || []).find((item) => safeText(item.src).includes('/js-build/app-admin.js'));
        const fallbackSrc = './js-build/script.js';
        const source = appAdminScript?.src
            ? appAdminScript.src.replace('/app-admin.js', '/script.js')
            : fallbackSrc;
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = source;
            script.defer = true;
            script.onload = () => {
                setAdminShellLoaded(true);
                resolve(true);
            };
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }, []);

    const toOrderCreatedAtMillis = useCallback((orderLike = {}) => {
        const createdAt = orderLike?.createdAt;
        return getOrderCreatedAtMillis({ createdAt }) || 0;
    }, []);

    const buildOrderRealtimeKey = useCallback((orderLike = {}) => {
        const orderId = safeText(orderLike?.id).trim();
        const createdMs = toOrderCreatedAtMillis(orderLike);
        return `${orderId}::${createdMs}`;
    }, [toOrderCreatedAtMillis]);

    const emitOrderCreatedEvent = useCallback((orderLike = {}) => {
        if (typeof window === 'undefined') return;
        try {
            window.dispatchEvent(new window.CustomEvent('helo:order-created', {
                detail: { order: orderLike, source: 'admin-light-orders-listener' }
            }));
        } catch (error) {
            console.warn('Falha ao emitir evento de pedido em tempo real:', error);
        }
    }, []);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Auth listener — Firebase Auth (onAuthStateChanged)
       ════════════════════════════════════════════════════════════════
       Sempre inicia auth anônimo. Se admin logar via email/senha,
       verifica claim de admin. Se login em andamento (handleEmailLogin),
       apenas seta user e pula verificação de claim (handleEmailLogin
       assume o controle após propagação da claim). */
    useEffect(() => {
        let unsub = () => {};
        try {
            unsub = auth.onAuthStateChanged(async (u) => {
                if (!u) {
                    setUser(null);
                    setIsAdmin(false);
                    try { await auth.signInAnonymously(); } catch (_) {}
                    return;
                }
                setUser(u);
                if (loginInProgressRef.current) return;
                const isAllowedAdmin = await hasAdminClaim(u, true);
                setIsAdmin(isAllowedAdmin);
            });
        } catch (e) {
            console.error('[Auth] Erro ao iniciar listener:', e);
        }
        return () => { try { unsub(); } catch (_) {} };
    }, [hasAdminClaim]);

    useEffect(() => {
        if (!(isAdmin || feedbackOrderId)) return;
        loadAdminShellScript().catch(() => {});
    }, [isAdmin, feedbackOrderId, loadAdminShellScript]);

    /* ── Listener leve de novos pedidos (sempre ativo no admin) ─────
       Mantém agilidade de notificação mesmo fora da aba de pedidos. */
    useEffect(() => {
        if (!isAdmin) {
            lightOrdersKnownKeysRef.current = new Set();
            setOrdersRealtimeChannelStatus('idle');
            return undefined;
        }
        let unsub = () => {};
        let retryTimerId = 0;
        let initialized = false;
        let disposed = false;

        const subscribe = (attempt = 0) => {
            if (disposed) return;
            setOrdersRealtimeChannelStatus(attempt > 0 ? 'reconnecting' : 'connecting');
            try {
                unsub = getCol('orders')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .onSnapshot((snap) => {
                        setOrdersLastSyncAt(Date.now());
                        setOrdersRealtimeChannelStatus('online');
                        setOrdersRealtimeRecentFailures(0);
                        const nextKeys = new Set();
                        const newlyCreatedOrders = [];

                        snap.docs.forEach((docSnap) => {
                            const data = docSnap.data() || {};
                            const orderLike = { id: docSnap.id, ...data };
                            const orderKey = buildOrderRealtimeKey(orderLike);
                            if (orderKey) nextKeys.add(orderKey);
                            if (!initialized) return;
                            if (!orderKey || lightOrdersKnownKeysRef.current.has(orderKey)) return;
                            newlyCreatedOrders.push(orderLike);
                        });

                        if (initialized && newlyCreatedOrders.length > 0) {
                            newlyCreatedOrders
                                .sort((a, b) => toOrderCreatedAtMillis(a) - toOrderCreatedAtMillis(b))
                                .forEach((orderLike) => emitOrderCreatedEvent(orderLike));
                        }

                        lightOrdersKnownKeysRef.current = nextKeys;
                        initialized = true;
                    }, (error) => {
                        const transient = isTransientFirestoreError(error);
                        if (transient && attempt < 4) {
                            setOrdersRealtimeRecentFailures((prev) => Math.min(prev + 1, 99));
                            setOrdersRealtimeChannelStatus('reconnecting');
                            const delayMs = 700 * (2 ** attempt);
                            retryTimerId = window.setTimeout(() => subscribe(attempt + 1), delayMs);
                            console.warn(`[Firestore] Listener leve de pedidos em reconexão (${attempt + 1}/4)...`);
                            return;
                        }
                        setOrdersRealtimeRecentFailures((prev) => Math.min(prev + 1, 99));
                        setOrdersRealtimeChannelStatus('error');
                        console.warn('[Firestore] Listener leve de pedidos falhou:', error);
                    });
            } catch (error) {
                setOrdersRealtimeRecentFailures((prev) => Math.min(prev + 1, 99));
                setOrdersRealtimeChannelStatus('error');
                console.warn('[Firestore] Falha ao iniciar listener leve de pedidos:', error);
            }
        };

        subscribe(0);
        return () => {
            disposed = true;
            clearTimeout(retryTimerId);
            try { unsub(); } catch (_) {}
        };
    }, [isAdmin, buildOrderRealtimeKey, emitOrderCreatedEvent, isTransientFirestoreError, toOrderCreatedAtMillis]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Migração de campanhas v1 (roda apenas se admin)
       ════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        const runCampaignMigration = async () => {
            try {
                const migrationRef = getMetaDoc('campaigns_migration_v1');
                let migrationSnap;
                try {
                    migrationSnap = await migrationRef.get();
                } catch (connErr) {
                    const msg = (connErr?.message || '').toLowerCase();
                    if (msg.includes('offline') || msg.includes('network') || msg.includes('unavailable') || msg.includes('failed to get')) {
                        console.warn('[Migração] Firestore indisponível — migração de campanhas será tentada na próxima sessão com conexão.');
                        return;
                    }
                    throw connErr;
                }
                if (migrationSnap.exists && migrationSnap.data()?.done === true) return;

                const campaignGeneralRef = getCol('campanhas').doc(CAMPAIGN_GENERAL_ID);
                const campaignLegacyRef = getCol('campanhas').doc(CAMPAIGN_LEGACY_ID);

                await campaignGeneralRef.set({
                    nome: CAMPAIGN_GENERAL_NAME, status: 'ativo', autoEnabled: false,
                    startDate: '', endDate: '', priority: 0,
                    data_criacao: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                await campaignLegacyRef.set({
                    nome: CAMPAIGN_DEFAULT_NAME, status: 'inativo', autoEnabled: false,
                    startDate: '', endDate: '', priority: -1,
                    data_criacao: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                const [ordersSnap, productsSnap, financeSnap] = await Promise.all([
                    getCol('orders').get(), getCol('products').get(), getCol('financeiro').get(),
                ]);
                const pendingUpdates = [];
                ordersSnap.docs.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (safeText(data.campaignId).trim()) return;
                    pendingUpdates.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
                });
                productsSnap.docs.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (safeText(data.campaignId).trim()) return;
                    pendingUpdates.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
                });
                financeSnap.docs.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    if (safeText(data.campaignId).trim()) return;
                    pendingUpdates.push({ ref: docSnap.ref, payload: { campaignId: CAMPAIGN_LEGACY_ID } });
                });
                for (let i = 0; i < pendingUpdates.length; i += 400) {
                    const chunk = pendingUpdates.slice(i, i + 400);
                    const batch = db.batch();
                    chunk.forEach(item => batch.update(item.ref, item.payload));
                    await batch.commit();
                }
                await migrationRef.set({
                    done: true, version: 1, updatedItems: pendingUpdates.length,
                    doneAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (error) {
                if (cancelled) return;
                if (isFirestorePermissionDenied(error)) return;
                console.error('Erro ao executar migração de campanhas:', error);
            }
        };
        runCampaignMigration();
        return () => { cancelled = true; };
    }, [isAdmin]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Listeners Firestore — DADOS BASE DO ADMIN
       ════════════════════════════════════════════════════════════════
       Somente após sessão administrativa válida para reduzir custo
       de boot no login (especialmente em rede móvel instável). */
    useEffect(() => {
        if (!isAdmin) {
            setCatalogLoaded(true);
            return;
        }
        const unsubs = [];
        const normalizeStockLimit = (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return null;
            return Math.max(0, Math.trunc(parsed));
        };
        let snapshotFired = false;
        let fallbackTimerId = 0;
        let fallbackRetryTimerId = 0;

        const loadProductsFallback = (attempt = 0) => {
            getCol('products').get().then(snap => {
                if (snapshotFired) return;
                snapshotFired = true;
                try {
                    setProducts(snap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id, ...data,
                            stockLimit: normalizeStockLimit(data.stockLimit),
                            isVisible: data.isVisible !== false,
                            campaignId: normalizeCampaignId(data.campaignId, CAMPAIGN_LEGACY_ID),
                        };
                    }));
                } catch (mapErr) { console.warn('[Firestore] Erro ao mapear produtos (fallback):', mapErr); }
                setCatalogLoaded(true);
            }).catch(getErr => {
                const getErrMsg = (getErr?.message || '').toLowerCase();
                if (getErrMsg.includes('permission') || getErrMsg.includes('insufficient')) {
                    setCatalogLoaded(true);
                    return;
                }
                if (isTransientFirestoreError(getErr) && attempt < 3) {
                    const delayMs = 900 * (2 ** attempt);
                    fallbackRetryTimerId = window.setTimeout(() => loadProductsFallback(attempt + 1), delayMs);
                    return;
                }
                console.warn('[Firestore] Fallback get() de produtos falhou:', getErr);
                if (!snapshotFired) {
                    setCatalogLoaded(true);
                    setDbError('Não foi possível carregar o catálogo. Verifique sua conexão.');
                }
            });
        };

        /* ── Listener de produtos ─────────────────────────────────── */
        unsubs.push(getCol('products').onSnapshot(
            snap => {
                snapshotFired = true;
                try {
                    setProducts(snap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id, ...data,
                            stockLimit: normalizeStockLimit(data.stockLimit),
                            isVisible: data.isVisible !== false,
                            campaignId: normalizeCampaignId(data.campaignId, CAMPAIGN_LEGACY_ID),
                        };
                    }));
                } catch (mapErr) { console.error('[Firestore] Erro ao mapear produtos:', mapErr); }
                setCatalogLoaded(true);
            },
            err => {
                const errMsg = (err?.message || '').toLowerCase();
                if (errMsg.includes('permission') || errMsg.includes('insufficient')) { setCatalogLoaded(true); return; }
                if (isTransientFirestoreError(err)) {
                    console.warn('[Firestore] Listener de produtos com oscilação de rede. Aplicando fallback get().');
                } else {
                    console.warn('[Firestore] Erro no listener de produtos:', err);
                }
                loadProductsFallback(0);
            }
        ));

        /* ── Fallback com get() se onSnapshot não dispara em 8s ───── */
        fallbackTimerId = setTimeout(() => {
            if (snapshotFired) return;
            console.warn('[Firestore] onSnapshot de produtos não disparou em 8s. Executando fallback com backoff.');
            loadProductsFallback(0);
        }, 8000);

        const silenciarPermissao = (nome) => (err) => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('insufficient')) return;
            if (msg.includes('offline') || msg.includes('network') || msg.includes('unavailable') || msg.includes('failed to get')) return;
            console.error(`[Firestore] Erro no listener de ${nome}:`, err);
        };

        /* ── Campanhas: onSnapshot ─────────────────────────────────── */
        unsubs.push(getCol('campanhas').onSnapshot(
            snap => setCampaigns(snap.docs.map(d => normalizeCampaignDoc({ id: d.id, ...d.data() }))),
            silenciarPermissao('campanhas')
        ));

        /* ── site_settings: onSnapshot ─────────────────────────────── */
        unsubs.push(getMetaDoc('site_settings').onSnapshot(
            doc => { if (doc.exists) setSiteSettings(prev => ({ ...prev, ...doc.data() })); },
            silenciarPermissao('site_settings')
        ));

        /* ── Coupons: get() (não precisa de real-time para o admin aqui) ── */
        getCol('coupons').get().then(snap => {
            setAllCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(err => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('offline') || msg.includes('network') || msg.includes('unavailable')) return;
            console.warn('[Firestore] Falha ao carregar cupons (get):', err.message || err);
        });

        /* ── visits: get() (contador legado) ─────────────────────── */
        getMetaDoc('visits').get().then(doc => {
            if (doc.exists) setVisitsData(doc.data());
        }).catch(err => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('offline') || msg.includes('network') || msg.includes('unavailable')) return;
            console.warn('[Firestore] Falha ao carregar visits (get):', err.message || err);
        });

        return () => {
            clearTimeout(fallbackTimerId);
            clearTimeout(fallbackRetryTimerId);
            unsubs.forEach(unsub => typeof unsub === 'function' && unsub());
        };
    }, [isAdmin, isTransientFirestoreError]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Listeners Firestore — DADOS SENSÍVEIS (somente ADMIN)
       ════════════════════════════════════════════════════════════════
       Coleções protegidas por regras Firestore que exigem isAdmin. */
    useEffect(() => {
        if (!isAdmin) {
            setOrdersLoaded(true);
            setOrdersHasMore(false);
            return;
        }
        const unsubs = [];
        const orderTabsWithLightWindow = new Set(['orders']);
        const shouldUseLimitedOrders = orderTabsWithLightWindow.has(adminActiveTab);
        const needsFinanceListener = adminActiveTab === 'finance';
        const needsCouponsListener = adminActiveTab === 'coupons' || adminActiveTab === 'menu' || adminActiveTab === 'finance';
        const needsInventoryListener = adminActiveTab === 'production';
        const needsFeedbackListener = adminActiveTab === 'feedback';

        setOrdersLoaded(false);

        /* ── Listener de pedidos — PRIORIDADE ALTA ───────────────── */
        let ordersQuery = getCol('orders').orderBy('createdAt', 'desc');
        if (shouldUseLimitedOrders) {
            ordersQuery = ordersQuery.limit(ordersPageSize);
        }
        let retryOrdersTimerId = 0;
        let ordersUnsub = () => {};
        const subscribeOrders = (attempt = 0) => {
            try {
                ordersUnsub = ordersQuery.onSnapshot(
                    snap => {
                        setOrdersLastSyncAt(Date.now());
                        setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data(), campaignId: normalizeCampaignId(d.data()?.campaignId, CAMPAIGN_LEGACY_ID) })));
                        setOrdersHasMore(shouldUseLimitedOrders && snap.docs.length >= ordersPageSize);
                        setOrdersLoaded(true);
                    },
                    err => {
                        if (isTransientFirestoreError(err) && attempt < 4) {
                            const delayMs = 700 * (2 ** attempt);
                            retryOrdersTimerId = window.setTimeout(() => subscribeOrders(attempt + 1), delayMs);
                            console.warn(`[Firestore] Listener de pedidos em reconexão (${attempt + 1}/4)...`);
                            return;
                        }
                        console.warn('[Firestore] Erro no listener de pedidos:', err);
                        setOrdersLoaded(true);
                    }
                );
            } catch (error) {
                console.warn('[Firestore] Falha ao iniciar listener de pedidos:', error);
                setOrdersLoaded(true);
            }
        };
        subscribeOrders(0);
        unsubs.push(() => {
            clearTimeout(retryOrdersTimerId);
            try { ordersUnsub(); } catch (_) {}
        });

        /* ── Listeners de prioridade média (on-demand por aba) ───── */
        requestAnimationFrame(() => {
            if (!isAdminRef.current || !needsFinanceListener) return;
            unsubs.push(getCol('financeiro').onSnapshot(
                snap => setFinancialEntries(snap.docs.map(d => ({ id: d.id, ...d.data(), campaignId: normalizeCampaignId(d.data()?.campaignId, CAMPAIGN_LEGACY_ID) }))),
                err => console.error('[Firestore] Erro no listener de financeiro:', err)
            ));
        });
        requestAnimationFrame(() => {
            if (!isAdminRef.current || !needsCouponsListener) return;
            unsubs.push(getCol('coupons').onSnapshot(
                snap => setAllCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                err => console.error('[Firestore] Erro no listener de coupons:', err)
            ));
        });

        /* ── Listeners de baixa prioridade (lazy por aba) ─────────── */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!isAdminRef.current) return;
                if (needsInventoryListener) {
                    unsubs.push(getCol('ingredients').onSnapshot(
                        snap => setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                        err => console.error('[Firestore] Erro no listener de ingredients:', err)
                    ));
                    unsubs.push(getCol('recipes').onSnapshot(
                        snap => setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                        err => console.error('[Firestore] Erro no listener de recipes:', err)
                    ));
                }
                if (needsFeedbackListener) {
                    unsubs.push(getCol('feedbacks').onSnapshot(
                        snap => setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                        err => console.error('[Firestore] Erro no listener de feedbacks:', err)
                    ));
                }
            });
        });

        return () => unsubs.forEach(unsub => typeof unsub === 'function' && unsub());
    }, [isAdmin, adminActiveTab, ordersPageSize, isTransientFirestoreError]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Timeout de segurança para skeleton infinito
       ════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        if (catalogLoaded) return;
        const timer = setTimeout(() => { console.warn('[AdminApp] Timeout: catálogo não carregou em 10s.'); setCatalogLoaded(true); }, 10000);
        return () => clearTimeout(timer);
    }, [catalogLoaded]);

    useEffect(() => {
        if (ordersLoaded) return;
        const timer = setTimeout(() => { console.warn('[AdminApp] Timeout: pedidos não carregaram em 10s.'); setOrdersLoaded(true); }, 10000);
        return () => clearTimeout(timer);
    }, [ordersLoaded]);

    /* ════════════════════════════════════════════════════════════════
       FUNÇÕES DE LOGIN ADMIN
       ════════════════════════════════════════════════════════════════ */

    /* ── syncAdminClaimForUser: Sincroniza claim de admin via Cloud Function ──
       Recebe: candidateUser (Firebase User)
       Retorna: { ok: true } ou { ok: false, reason: string } */
    const syncAdminClaimForUser = useCallback(async (candidateUser) => {
        if (!candidateUser || candidateUser.isAnonymous) return { ok: false, reason: 'invalid_user' };
        try {
            const idToken = await candidateUser.getIdToken(true);
            const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
            const host = typeof window !== 'undefined' ? window.location.host : 'heloconfeitarianr.web.app';
            const endpoint = `${protocol}//${host}/api/admin/claim/sync`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ uid: candidateUser.uid }),
            });
            if (!response.ok) {
                const text = await response.text();
                return { ok: false, reason: `http_${response.status}`, detail: text };
            }
            const data = await response.json();
            return { ok: true, ...data };
        } catch (err) {
            return { ok: false, reason: 'network', detail: err?.message || String(err) };
        }
    }, []);

    /* ── awaitAdminClaimPropagation: Aguarda propagação da claim ────
       Recebe: candidateUser (Firebase User)
       Retorna: true se claim detectada, false se esgotou tentativas */
    const awaitAdminClaimPropagation = useCallback(async (candidateUser) => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, 500 * attempt));
            }
            const tokenResult = await candidateUser.getIdTokenResult(true);
            if (tokenResult?.claims?.[ADMIN_CLAIM_KEY]) return true;
        }
        return false;
    }, [ADMIN_CLAIM_KEY]);

    /* ── saveSettings: Salva configurações do site no Firebase ───────
       Recebe: objeto de configurações
       Usa set com merge: true no documento 'site_settings' */
    const saveSettings = useCallback(async (settings) => {
        await getMetaDoc('site_settings').set(settings, { merge: true });
    }, []);

    /* ════════════════════════════════════════════════════════════════
       handleEmailLogin: Login de administrador via email/senha
       ════════════════════════════════════════════════════════════════
       Fluxo: autentica → verifica claim → sincroniza se necessário →
       aguarda propagação → seta isAdmin=true → fecha modal */
    const handleEmailLogin = useCallback(async () => {
        if (!loginEmail || !loginPassword) return;
        setLoginLoading(true);
        loginInProgressRef.current = true;
        try {
            const normalizedEmail = safeText(loginEmail).trim().toLowerCase();
            const credential = await auth.signInWithEmailAndPassword(normalizedEmail, loginPassword);
            let isAllowed = await hasAdminClaim(credential.user, true);

            if (!isAllowed) {
                const syncResult = await syncAdminClaimForUser(credential.user);
                if (syncResult.ok) {
                    isAllowed = await awaitAdminClaimPropagation(credential.user);
                }
            }

            if (!isAllowed) {
                loginInProgressRef.current = false;
                await auth.signOut();
                alert('Usuário autenticado, porém sem privilégio admin. Verifique ADMIN_ALLOWED_EMAILS no backend e redeploy das functions.');
                return;
            }

            try { await credential.user.getIdToken(true); } catch (_) {}

            setIsAdmin(true);
            loginInProgressRef.current = false;
            setLoginEmail('');
            setLoginPassword('');
        } catch (err) {
            loginInProgressRef.current = false;
            let message = 'Não foi possível entrar. Confira o e-mail e a senha.';
            if (err.code === 'auth/user-not-found') message = 'E-mail não encontrado.';
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') message = 'Senha incorreta.';
            if (err.code === 'auth/invalid-email') message = 'Digite um e-mail válido.';
            if (err.code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
            alert(message);
        } finally {
            setLoginLoading(false);
        }
    }, [loginEmail, loginPassword, hasAdminClaim, syncAdminClaimForUser, awaitAdminClaimPropagation]);

    const handleLoadMoreOrders = useCallback(() => {
        setOrdersPageSize((prev) => Math.min(prev + 50, 500));
    }, []);

    /* ════════════════════════════════════════════════════════════════
       RENDERIZAÇÃO CONDICIONAL
       ════════════════════════════════════════════════════════════════
       1. Se ?feedback= na URL → FeedbackExperience (redireciona para
          admin.html?feedback= se componente não disponível)
       2. Se isAdmin → AreaAdministrativa (painel completo)
       3. Senão → Modal de login admin */
    if (feedbackOrderId) {
        const FExp = typeof window !== 'undefined' ? window.FeedbackExperience : null;
        if (typeof FExp !== 'undefined' && FExp) {
            return <FExp orderId={feedbackOrderId} onBack={() => window.location.href = window.location.href.split('?')[0].split('#')[0]} />;
        } else {
            return <div style={{ padding: '5rem', textAlign: 'center' }}>Carregando área de feedback...</div>;
        }
    }

    if (isAdmin) {
        if (!adminShellLoaded && typeof window !== 'undefined' && !window.AreaAdministrativa && !window.AdminPanel) {
            return <div style={{ padding: '5rem', textAlign: 'center' }}>Carregando painel administrativo...</div>;
        }
        if (typeof window !== 'undefined' && typeof window.AreaAdministrativa !== 'undefined') {
            const AreaAdmin = window.AreaAdministrativa;
            return <AreaAdmin
                allOrders={allOrders}
                allCoupons={allCoupons}
                products={products}
                visitsData={visitsData}
                ingredients={ingredients}
                recipes={recipes}
                feedbacks={feedbacks}
                financialEntries={financialEntries}
                campaigns={normalizedCampaigns}
                activeCampaignId={activeCampaign.id}
                onExitAdmin={async () => { await auth.signOut(); }}
                siteSettings={siteSettings}
                onSaveSettings={saveSettings}
                onAdminTabChange={setAdminActiveTab}
                onLoadMoreOrders={handleLoadMoreOrders}
                ordersPageSize={ordersPageSize}
                ordersHasMore={ordersHasMore}
                ordersLastSyncAt={ordersLastSyncAt}
                ordersRealtimeChannelStatus={ordersRealtimeChannelStatus}
                ordersRealtimeRecentFailures={ordersRealtimeRecentFailures}
            />;
        } else if (typeof window !== 'undefined' && typeof window.AdminPanel !== 'undefined') {
            const AdminPanelComponent = window.AdminPanel;
            return <AdminPanelComponent
                allOrders={allOrders}
                allCoupons={allCoupons}
                products={products}
                visitsData={visitsData}
                ingredients={ingredients}
                recipes={recipes}
                feedbacks={feedbacks}
                financialEntries={financialEntries}
                campaigns={normalizedCampaigns}
                activeCampaignId={activeCampaign.id}
                onExit={async () => { await auth.signOut(); }}
                siteSettings={siteSettings}
                onSaveSettings={saveSettings}
                onAdminTabChange={setAdminActiveTab}
                onLoadMoreOrders={handleLoadMoreOrders}
                ordersPageSize={ordersPageSize}
                ordersHasMore={ordersHasMore}
                ordersLastSyncAt={ordersLastSyncAt}
                ordersRealtimeChannelStatus={ordersRealtimeChannelStatus}
                ordersRealtimeRecentFailures={ordersRealtimeRecentFailures}
            />;
        } else {
            return (
                <div style={{ padding: '5rem', textAlign: 'center', fontFamily: 'sans-serif', color: 'var(--primary)' }}>
                    <h2>Erro ao carregar painel</h2>
                    <p>O componente administrativo não está disponível. Verifique se o script.js foi carregado corretamente.</p>
                </div>
            );
        }
    }

    /* ── Tela de login admin (quando não autenticado ou não é admin) ─ */
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdfbf7 0%, #f5f0e8 100%)', padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 25px 60px rgba(0,0,0,.15)' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '60px', height: '60px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <i className="ph-fill ph-lock-key" style={{ fontSize: '28px', color: 'var(--cream)' }}></i>
                    </div>
                    <h2 style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.25rem', marginBottom: '4px' }}>Acesso Reservado</h2>
                    <p style={{ fontSize: '13px', color: 'var(--s400)' }}>Entre com seu e-mail e senha para acessar o painel administrativo</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); handleEmailLogin(); }}>
                    <input id="admin-login-email" name="admin_login_email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                        autoComplete="username" placeholder="E-mail"
                        style={{ width: '100%', padding: '.85rem 1rem', borderRadius: '.75rem', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: '500', color: 'var(--primary)', marginBottom: '.75rem', fontFamily: 'inherit' }} />
                    <input id="admin-login-password" name="admin_login_password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        autoComplete="current-password" placeholder="Senha"
                        style={{ width: '100%', padding: '.85rem 1rem', borderRadius: '.75rem', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: '500', color: 'var(--primary)', marginBottom: '1rem', fontFamily: 'inherit' }} />
                    <button type="submit" disabled={loginLoading || !loginEmail || !loginPassword}
                        style={{ width: '100%', padding: '.85rem', borderRadius: '.75rem', border: 'none', background: 'var(--primary)', color: 'var(--cream)', cursor: 'pointer', fontWeight: '700', fontSize: '14px', opacity: (loginLoading || !loginPassword) ? 0.6 : 1 }}>
                        {loginLoading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                {dbError && (
                    <div style={{ marginTop: '1rem', padding: '.75rem', background: '#fefce8', borderRadius: '.5rem', fontSize: '12px', color: '#854d0e', textAlign: 'center' }}>
                        <i className="ph-bold ph-warning" style={{ marginRight: '4px' }}></i>{dbError}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Ponto de entrada: Renderiza o componente AdminApp no DOM ─────
   Busca o elemento #root no admin.html e renderiza a aplicação React.
   Usa ReactDOM.createRoot (React 18+) para renderização concorrente. */
const adminRoot = ReactDOM.createRoot(document.getElementById('root'));
adminRoot.render(<AdminApp />);
