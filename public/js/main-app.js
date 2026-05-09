/* ═══════════════════════════════════════════════════════════════════════
   main-app.js — ENTRYPOINT DA VITRINE PÚBLICA
   Deploy: 08/05/2026 | Versão: 20260508-235421
   ═══════════════════════════════════════════════════════════════════════
   Este é o componente raiz do site da Helô Confeitaria. Ele centraliza:

   1. ESTADOS GLOBAIS — Usuário, produtos, pedidos, campanhas, cupons,
      configurações do site, ingredientes, receitas, feedbacks
   2. ESTADOS DO CARRINHO — Dados do cliente, entrega, pagamento, cupom
   3. CÁLCULOS MEMOIZADOS — Campanha ativa, escassez, best-sellers,
      taxa de cartão, total pagável
   4. EFEITOS (useEffect) — Auth listener, migração de campanhas,
      listeners Firestore (tempo real), rastreamento de visitas
   5. FUNÇÕES DE CALLBACK — Adicionar ao carrinho, aplicar cupom,
      salvar pedido (saveAndSend), login admin, copiar PIX
   6. RENDERIZAÇÃO CONDICIONAL — Feedback > Admin > Vitrine pública

   Fonte de dados: Firebase Firestore (onSnapshot em tempo real)
   Autenticação: Firebase Auth (anônimo + email/senha para admin)
   ═══════════════════════════════════════════════════════════════════════ */

const App = () => {
    /* ════════════════════════════════════════════════════════════════
       ESTADOS GLOBAIS — Dados do Firebase e configurações
       ════════════════════════════════════════════════════════════════
       - user: usuário Firebase (null se não autenticado)
       - products: lista de produtos do catálogo (collection 'products')
       - campaigns: campanhas cadastradas (collection 'campanhas')
       - allCoupons: cupons de desconto disponíveis (collection 'coupons')
       - financialEntries: lançamentos financeiros (collection 'financeiro')
       - visitsData: contador de visitas ao site (doc 'visits')
       - siteSettings: configurações gerais (doc 'site_settings')
         Inclui: maxUnits, orderDeadline, siteMode, campaignMode,
         isDeliveryAvailable, chavePix, nomeTitularPix, config térmica
       - ingredients / recipes: dados de estoque (só carrega se admin) */
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [allCoupons, setAllCoupons] = useState([]);
    const [siteSettings, setSiteSettings] = useState({
        maxUnits: 70, orderDeadline: '2026-03-31T19:00', siteMode: 'livre',
        campaignMode: CAMPAIGN_MODE_MANUAL, activeCampaignOverrideId: '',
        isDeliveryAvailable: true, chavePix: '88996549074', nomeTitularPix: '',
        ...DEFAULT_THERMAL_PRINT_SETTINGS
    });
    const [siteSettingsLoaded, setSiteSettingsLoaded] = useState(false);

    /* ── Estados de UI e controle da vitrine ───────────────────────
       - isCartOpen: drawer do carrinho aberto/fechado
       - isSaving: pedido está sendo salvo (mostra spinner)
       - dbError: mensagem de erro do banco (banner fixo)
       - searchTerm: texto de busca na vitrine de produtos
       - successData: URL do WhatsApp após pedido salvo (modal de sucesso)

       NOTA (Fase 2 — Otimização): estados admin (isAdmin, loginEmail,
       loginPassword, etc.) foram removidos da vitrine e migrados para
       app-admin.js (entrypoint exclusivo do painel administrativo). */
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dbError, setDbError] = useState(null);
    const [loadingHint, setLoadingHint] = useState('');
    const [chatWidgetComponent, setChatWidgetComponent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [successData, setSuccessData] = useState(null);
    const chatScriptLoadRef = useRef(null);

    /* ── Estados do formulário do cliente (carrinho) ────────────────
       Dados preenchidos pelo cliente no drawer do carrinho.
       - customerName / customerPhone: dados pessoais
       - orderDate / orderTime: data e hora desejada (modo evento)
       - deliveryMethod: 'retirada' ou 'entrega'
       - street / neighborhood / reference: endereço de entrega
       - paymentMethod: 'PIX', 'Dinheiro' ou 'Cartão'
       - cardInstallments: parcelas do cartão (1, 2 ou 3)
       - cashChangeFor: valor para troco (pagamento em dinheiro)
       - couponInput / appliedCoupon: cupom digitado / cupom validado
       - pixCopied: flag visual após copiar chave PIX
       - orderObservations: campo livre para personalizações
       - feedbacks: lista de feedbacks de clientes (só carrega se admin) */
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [orderDate, setOrderDate] = useState('');
    const [orderTime, setOrderTime] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState('retirada');
    const [street, setStreet] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [reference, setReference] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [cardInstallments, setCardInstallments] = useState('1');
    const [cashChangeFor, setCashChangeFor] = useState('');
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [pixCopied, setPixCopied] = useState(false);
    const [orderObservations, setOrderObservations] = useState('');
    /* ── allOrders vazio — mantém compatibilidade com useSpecialClient
       e useOrderTotal sem carregar a collection 'orders' na vitrine.
       Pedidos são gerenciados exclusivamente pelo app-admin.js.
       Fase 2 — Otimização de separação Vitrine × Admin. ───────────── */
    const allOrders = [];

    /* ── normalizedCampaigns: Lista de campanhas normalizadas ────────
       Recebe: campaigns (bruto do Firebase)
       Retorna: array com campanhas normalizadas (normalizeCampaignDoc)
       Se não houver campanhas, cria fallback com GERAL + LEGADO */
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

    /* ── activeCampaign: Determina qual campanha está ativa agora ────
       Prioridade de seleção:
       1. Override manual (activeCampaignOverrideId nas settings)
       2. Manual ativa (status === 'ativo')
       3. Auto ativa (isCampaignAutoActiveNow, por data/hora)
       Modos: AUTO → prioriza auto; HYBRID → prioriza manual
       Fallback: campanha GERAL */
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

    /* ── feedbackOrderId: ID do pedido para tela de feedback ────────
       Lê o parâmetro ?feedback=XXX da URL. Se existir, renderiza
       o componente FeedbackExperience em vez da vitrine. */
    const feedbackOrderId = useMemo(() => {
        try {
            return new URLSearchParams(window.location.search).get('feedback');
        } catch (_) {
            return null;
        }
    }, []);

    /* ── Valores derivados do modo de operação ──────────────────────
       - todayStr: data de hoje formatada (YYYY-MM-DD)
       - siteMode: 'livre' (dia a dia) ou 'evento' (campanha com prazo)
       - dayToDayOperationDays/Hours: horário exibido no rodapé e carrinho
       @update 2026-05-09 — Horário oficial do Dia a Dia atualizado para 14:30 às 20:00.
       - isDayToDayMode: true se modo livre (sem data/hora obrigatória)
       - effectiveDeliveryFee: taxa de entrega varia por modo */
    const todayStr = useMemo(() => normalizeDateOnlyValue(new Date()), []);
    const siteMode = siteSettings.siteMode || 'livre';
    const dayToDayOperationDays = 'Quarta a domingo';
    const dayToDayOperationHours = '14:30hrs às 20hrs';
    const isDayToDayMode = siteMode === 'livre';
    const effectiveDeliveryFee = isDayToDayMode ? DAY_TO_DAY_DELIVERY_FEE : DELIVERY_FEE;

    /* ── Hooks de carrinho e cálculos de preço ──────────────────────
       - useCart: gerencia itens, quantidades e subtotal
       - useSpecialClient: verifica se cliente é VIP (R$300+ no mês)
       - useOrderTotal: calcula desconto, frete e total final */
    const { cart, addToCart, updateQty, clearCart, subtotal } = useCart();
    const isVip = useSpecialClient(customerPhone, allOrders);
    const { discountValue, finalDelivery, total, specialApplied } = useOrderTotal(subtotal, deliveryMethod, appliedCoupon, isVip, effectiveDeliveryFee);

    /* ════════════════════════════════════════════════════════════════
       LÓGICA DE ESCASSEZ — Limite de vendas do modo Evento
       ════════════════════════════════════════════════════════════════
       No modo 'evento', o site mostra um banner de escassez com:
       - maxUnits: limite máximo de unidades vendidas (ex: 70)
       - orderDeadline: data/hora limite para pedidos
       - deadlinePassed: se o prazo já expirou (impede novos pedidos)
       - totalUnitsSold: total de unidades já vendidas na campanha ativa
       - remainingUnits: unidades restantes (maxUnits - totalUnitsSold)
       - progressPercent: % da barra de progresso (vendido/max)
       - enableScarcityBanner: flag para exibir/ocultar o banner */
    const isEventoMode = siteMode === 'evento';
    const enableScarcityBanner = isEventoMode && (siteSettings.enableScarcityBanner !== false);
    const maxUnits = Number(siteSettings.maxUnits) || 70;
    const orderDeadline = siteSettings.orderDeadline || '2026-03-31T19:00';
    const deadlinePassed = isEventoMode && new Date() > new Date(orderDeadline);
    const deadlineLabelBanner = (() => { try { const d = new Date(orderDeadline); return `Pedidos encerram ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}h`; } catch (_) { return 'Pedidos encerram 31/03 às 19h'; } })();
    const totalUnitsSold = useMemo(() => {
        let total = 0;
        allOrders.forEach(o => {
            if (normalizeCampaignId(o.campaignId, CAMPAIGN_LEGACY_ID) !== activeCampaign.id) return;
            const st = safeText(o.status).toLowerCase();
            // Soma todos os itens, desconsiderando eventuais pedidos cancelados futuramente
            if (st !== 'cancelado' && Array.isArray(o.items)) {
                o.items.forEach(item => total += Number(item?.qty || 1));
            }
        });
        return total;
    }, [allOrders, activeCampaign.id]);
    const remainingUnits = isEventoMode ? Math.max(0, maxUnits - totalUnitsSold) : Infinity;
    const progressPercent = isEventoMode ? Math.min(100, (totalUnitsSold / maxUnits) * 100) : 0;

    /* ── Chave PIX dinâmica e função de copiar ──────────────────────
       pixKey vem do siteSettings (Firebase). Se não definida, usa fallback.
       handleCopyPix: copia a chave para a área de transferência.
       Tenta navigator.clipboard primeiro; fallback para document.execCommand. */
    const pixKey = siteSettings.chavePix || '88996549074';
    const chatEnabled = siteSettingsLoaded && siteSettings.aiEnabled === true;

    /**
     * Carrega o script do chat sob demanda com proteção contra duplicidade.
     *
     * @returns {Promise<Function|null>} Componente do chat (window.HeloChatWidget) ou null
     * @update 2026-05-09 — Implementa lazy toggle via site_settings.aiEnabled.
     */
    const loadChatWidgetScriptOnce = useCallback(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return Promise.resolve(null);
        }
        if (typeof window.HeloChatWidget === 'function') {
            return Promise.resolve(window.HeloChatWidget);
        }
        if (chatScriptLoadRef.current) return chatScriptLoadRef.current;

        chatScriptLoadRef.current = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-helo-chat-widget="true"]');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(window.HeloChatWidget || null), { once: true });
                existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar script do chat.')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.defer = true;
            script.src = './js-build/components/chat-widget.component.js?v=20260509-050942';
            script.dataset.heloChatWidget = 'true';
            script.onload = () => resolve(window.HeloChatWidget || null);
            script.onerror = () => reject(new Error('Falha ao carregar script do chat.'));
            document.body.appendChild(script);
        }).catch((error) => {
            console.warn('[ChatWidget] Script lazy não pôde ser carregado:', error);
            chatScriptLoadRef.current = null;
            return null;
        });

        return chatScriptLoadRef.current;
    }, []);

    const handleCopyPix = useCallback(async () => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(pixKey);
            } else {
                const temp = document.createElement('input');
                temp.value = pixKey;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            setPixCopied(true);
            window.setTimeout(() => setPixCopied(false), 2500);
        } catch (_) {
            alert('Não foi possível copiar automaticamente. Chave PIX: ' + pixKey);
        }
    }, [pixKey]);
    /* ── Cálculos de parcelamento no cartão ──────────────────────────
       - installmentQty: número de parcelas (1, 2 ou 3)
       - installmentRate: taxa de juros da operadora por parcela
       - totalWithCardFee: total + juros do cartão
       - cardFeeValue: valor do juros (diferença)
       - installmentAmount: valor de cada parcela
       - payableTotal: total que o cliente paga (com ou sem juros)
       - thermalPrintSettings: configurações de impressão térmica normalizadas */
    const installmentQty = Math.max(1, Number(cardInstallments || 1));
    const installmentRate = paymentMethod === 'Cartão' ? (CARD_INSTALLMENT_RATES[installmentQty] ?? CARD_INSTALLMENT_RATES[1]) : 0;
    const totalWithCardFee = useMemo(() => total * (1 + installmentRate), [total, installmentRate]);
    const cardFeeValue = useMemo(() => totalWithCardFee - total, [totalWithCardFee, total]);
    const installmentAmount = useMemo(() => totalWithCardFee / installmentQty, [totalWithCardFee, installmentQty]);
    const payableTotal = paymentMethod === 'Cartão' ? totalWithCardFee : total;
    const thermalPrintSettings = useMemo(() => normalizeThermalPrintSettings(siteSettings), [siteSettings]);

    /* ── productCatalogNameById: Mapa productId → nome atual no catálogo ──
       Recebe: lista de produtos carregada no site.
       Retorna: Map (chave = productId lowercase, valor = nome do produto)
       Garante que o cálculo de "queridinho" funcione mesmo após renomear
       um produto no catálogo (usa productId como identidade estável). */
    const productCatalogNameById = useMemo(() => {
        const lookup = new Map();
        (Array.isArray(products) ? products : []).forEach((product) => {
            const productIdKey = safeText(product?.id).trim().toLowerCase();
            const productName = safeText(product?.name).trim();
            if (!productIdKey || !productName || lookup.has(productIdKey)) return;
            lookup.set(productIdKey, productName);
        });
        return lookup;
    }, [products]);

    /* ── bestSellerNames: Produtos mais recorrentes ("queridinhos") ──
       Recebe: allOrders + productCatalogNameById
       Retorna: Set com nomes dos produtos que aparecem no maior número
       de pedidos únicos. Resolve nomes via productId para evitar
       duplicação após renomear produto. Exibe badge na vitrine. */
    const bestSellerNames = useMemo(() => {
        if (!allOrders || allOrders.length === 0) return new Set();
        const countsByUniqueOrder = {};
        allOrders.forEach(o => {
            if (Array.isArray(o.items)) {
                const uniqueProductsInThisOrder = new Set(o.items.map((item) => {
                    const productIdKey = safeText(item?.productId || item?.id).trim().toLowerCase();
                    const catalogName = productIdKey && productCatalogNameById.has(productIdKey)
                        ? safeText(productCatalogNameById.get(productIdKey)).trim()
                        : '';
                    return catalogName || safeText(item?.name).trim();
                }));
                uniqueProductsInThisOrder.forEach(name => {
                    if (!name) return;
                    countsByUniqueOrder[name] = (countsByUniqueOrder[name] || 0) + 1;
                });
            }
        });
        let maxCount = 0;
        let topProducts = [];
        for (const [name, qty] of Object.entries(countsByUniqueOrder)) {
            if (qty > maxCount) {
                maxCount = qty;
                topProducts = [name];
            } else if (qty === maxCount && qty > 0) {
                topProducts.push(name);
            }
        }
        return maxCount > 0 ? new Set(topProducts) : new Set();
    }, [allOrders, productCatalogNameById]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Auth Listener — Monitora estado de autenticação
       ════════════════════════════════════════════════════════════════
       Quando o Firebase Auth muda de estado:
       - Se não há usuário (u === null): faz signInAnonymously()
       - Se há usuário: apenas seta o user (não verifica admin na vitrine)

       NOTA (Fase 2 — Otimização): a verificação de claim admin e o
       redirecionamento para o painel foram removidos da vitrine.
       O login admin agora é feito exclusivamente via admin.html,
       que carrega app-admin.js com sua própria lógica de autenticação.
       ════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        let unsub = () => {};
        try {
            unsub = auth.onAuthStateChanged(async (u) => {
                if (!u) {
                    setUser(null);
                    try { await auth.signInAnonymously(); } catch (_) {}
                    return;
                }
                setUser(u);
            });
        } catch (e) {
            console.error('[Auth] Erro ao iniciar listener:', e);
        }
        return () => { try { unsub(); } catch (_) {} };
    }, []);

    /* ── Efeito: Diagnóstico de Quirks Mode ─────────────────────────
       Verifica se o navegador entrou em Quirks Mode (compatibilidade
       quebrada). Emite console.warn com instruções para corrigir,
       geralmente causado por DOCTYPE ausente ou BOM duplicado no HTML. */
    useEffect(() => {
        if (document.compatMode !== 'BackCompat') return;

        const doctype = document.doctype;
        const hasHtmlDoctype = !!doctype &&
            String(doctype.name || '').toLowerCase() === 'html' &&
            !doctype.publicId &&
            !doctype.systemId;

        if (!hasHtmlDoctype) {
            console.warn(
                '[Compat] Documento em Quirks Mode (BackCompat): DOCTYPE ausente ou inválido. ' +
                'Publique o HTML com <!DOCTYPE html> no primeiro byte, sem conteúdo antes dele e sem BOM duplicado.'
            );
            return;
        }

        console.warn(
            '[Compat] BackCompat detectado apesar de DOCTYPE HTML válido. ' +
            'Isso geralmente indica que a página foi injetada por um wrapper/servidor que alterou o início do documento.'
        );
    }, []);

    /* ── Efeito: Garante id/name em campos de formulário ────────────
       Alguns campos são montados dinamicamente (ex: drawer do carrinho).
       Este efeito roda garantirIdsUnicosCamposFormulario e garantirAssociacaoLabelsCampos
       (via window.HeloAdminUtils) a cada mutação do DOM que adicione inputs/labels,
       usando MutationObserver com requestAnimationFrame para não travar. */
    const _garantirIds = window.HeloAdminUtils.garantirIdsUnicosCamposFormulario;
    const _garantirLabels = window.HeloAdminUtils.garantirAssociacaoLabelsCampos;
    useEffect(() => {
        _garantirIds(document);
        _garantirLabels(document);
        let queued = false;
        const observer = new MutationObserver((mutations) => {
            if (queued) return;
            const hasRelevantNode = mutations.some((mutation) =>
                Array.from(mutation.addedNodes || []).some((node) =>
                    node && node.nodeType === 1 &&
                    ((node.matches && node.matches('input, select, textarea, label')) ||
                        (node.querySelector && node.querySelector('input, select, textarea, label')))
                )
            );
            if (!hasRelevantNode) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                _garantirIds(document);
                _garantirLabels(document);
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    /* ════════════════════════════════════════════════════════════════
       Efeito: Rastreamento de visitas (avançado)
       ════════════════════════════════════════════════════════════════
       Registra cada visita na collection 'site_visits' com dados ricos:
       - UTM params (utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       - Origem do tráfego (Facebook, Instagram, Google, WhatsApp, Direto, etc.)
       - Tipo de dispositivo (mobile, desktop, tablet)
       - Navegador (Chrome, Safari, Firefox, Edge, Opera)
       - Página acessada e referrer
       - visitorId persistente (localStorage UUID) para contar visitantes únicos
       - dateOnly (YYYY-MM-DD) para consultas por período no admin

       Também mantém o contador legado no doc 'visits' (compatibilidade).

       Usa sessionStorage para evitar duplicatas na mesma sessão (refresh).
       Usa localStorage('helo_visited') para o contador legado (primeira visita).
       ════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        if (!user) return;

        const trackVisit = async () => {
            /* ── Evita registrar a mesma visita múltiplas vezes na mesma sessão ── */
            const sessionKey = 'helo_visit_tracked';
            if (sessionStorage.getItem(sessionKey)) return;

            /* ── Gera ou recupera ID persistente do visitante (localStorage) ──
               Este ID identifica o visitante entre sessões e dispositivos.
               Formato: v_{timestamp36}_{random6} — único e não-sequencial */
            let visitorId = localStorage.getItem('helo_visitor_id');
            if (!visitorId) {
                visitorId = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                localStorage.setItem('helo_visitor_id', visitorId);
            }

            /* ── Parse UTM params da URL ──
               Captura parâmetros de campanha para rastrear origem do tráfego.
               Se não houver utm_campaign na URL e houver uma campanha ativa
               (não a campanha geral "Dia a Dia"), atribui automaticamente
               o nome da campanha ativa como fallback. Assim, visitas sem
               UTM explícito ainda são atribuídas à campanha correta. */
            const urlParams = new URLSearchParams(window.location.search);
            const utmSource = urlParams.get('utm_source') || '';
            const utmMedium = urlParams.get('utm_medium') || '';
            let utmCampaign = urlParams.get('utm_campaign') || '';
            const utmContent = urlParams.get('utm_content') || '';
            const utmTerm = urlParams.get('utm_term') || '';

            /* ── Fallback: atribui campanha ativa automaticamente ──
               Só faz fallback se:
               1. Não há utm_campaign na URL (visitante não veio de link rastreado)
               2. A campanha ativa NÃO é a geral (Dia a Dia / livre)
               Isso garante que em modo evento, visitas diretas são
               atribuídas à campanha, mas em modo dia-a-dia ficam como
               "Direto" (não faz sentido atribuir à campanha geral). */
            if (!utmCampaign && activeCampaign && activeCampaign.id !== CAMPAIGN_GENERAL_ID) {
                utmCampaign = activeCampaign.nome || activeCampaign.id;
            }

            /* ── Detecta origem do tráfego ──
               Prioridade: UTM source > referrer > Direto */
            const detectSource = () => {
                if (utmSource) {
                    const s = utmSource.toLowerCase();
                    if (s.includes('facebook') || s.includes('fb')) return 'Facebook';
                    if (s.includes('instagram') || s.includes('ig')) return 'Instagram';
                    if (s.includes('google')) return 'Google';
                    if (s.includes('whatsapp') || s.includes('wa')) return 'WhatsApp';
                    if (s.includes('tiktok')) return 'TikTok';
                    return utmSource;
                }
                const ref = (document.referrer || '').toLowerCase();
                if (ref.includes('facebook.com') || ref.includes('fb.com')) return 'Facebook';
                if (ref.includes('instagram.com')) return 'Instagram';
                if (ref.includes('google.')) return 'Google';
                if (ref.includes('whatsapp.com') || ref.includes('wa.me')) return 'WhatsApp';
                if (ref.includes('tiktok.com')) return 'TikTok';
                if (ref) return 'Outros';
                return 'Direto';
            };

            /* ── Detecta tipo de dispositivo via User-Agent ── */
            const detectDevice = () => {
                const ua = navigator.userAgent || '';
                if (/tablet|ipad/i.test(ua)) return 'tablet';
                if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return 'mobile';
                return 'desktop';
            };

            /* ── Detecta navegador via User-Agent ── */
            const detectBrowser = () => {
                const ua = navigator.userAgent || '';
                if (ua.includes('Edg/')) return 'Edge';
                if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
                if (ua.includes('Firefox/')) return 'Firefox';
                if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
                if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera';
                return 'Outros';
            };

            const source = detectSource();
            const device = detectDevice();
            const browser = detectBrowser();
            const now = new Date();
            const dateOnly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            try {
                /* ── Registra visita detalhada na collection site_visits ──
                   Usa add() (create puro com ID automático) para compatibilidade
                   com regra Firestore create-only para visitantes. O sessionStorage
                   já previne duplicatas por refresh. Em caso de double-mount
                   (React StrictMode), a segunda chamada é bloqueada pelo
                   sessionStorage check antes desta linha. */
                await getCol('site_visits').add({
                    visitorId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    dateOnly,
                    page: window.location.pathname || '/',
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    utmContent,
                    utmTerm,
                    source,
                    device,
                    browser,
                    referrer: document.referrer || '',
                });

                /* ── Marca sessão como rastreada (evita duplicatas por refresh) ── */
                sessionStorage.setItem(sessionKey, '1');
            } catch (e) {
                console.error('Erro ao registrar visita detalhada:', e);
            }

            /* ── Mantém contador legado no doc 'visits' (compatibilidade) ──
               Incrementa apenas na primeira visita do visitante (localStorage flag) */
            if (!localStorage.getItem('helo_visited')) {
                try {
                    const visitsRef = getMetaDoc('visits');
                    const visitsDoc = await visitsRef.get();
                    if (visitsDoc.exists) {
                        await visitsRef.update({
                            count: firebase.firestore.FieldValue.increment(1),
                            lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } else {
                        await visitsRef.set({
                            count: 1,
                            lastVisit: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                    localStorage.setItem('helo_visited', 'true');
                } catch (e) { console.error('Erro ao contar visita (legado):', e); }
            }
        };
        trackVisit();
    }, [user]);

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Listeners Firestore — DADOS PÚBLICOS (sem autenticação)
       ════════════════════════════════════════════════════════════════
       Estes listeners NÃO dependem de `user`. São dados públicos que
       qualquer visitante (mesmo não autenticado) precisa ver:

       - products: catálogo de produtos (normaliza stockLimit, isVisible, campaignId)
       - campanhas: campanhas (normalizadas via normalizeCampaignDoc)
       - coupons: cupons de desconto
       - site_settings: configurações gerais (merge com estado anterior)
       - visits: contador de visitas

       ANTES estavam dentro do mesmo useEffect que dependia de `user`,
       o que significava que se signInAnonymously() falhasse no mobile,
       NENHUM dado público carregava — resultado: skeleton infinito.
       Agora o catálogo carrega independentemente da autenticação.

       Inclui fallback com get() se onSnapshot não disparar em 8s.
       Retorna função que chama todos os unsubscribes ao desmontar. */
    useEffect(() => {
        const unsubs = [];

        /* ── Helper: normaliza stockLimit (null se inválido) ─────── */
        const normalizeStockLimit = (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return null;
            return Math.max(0, Math.trunc(parsed));
        };

        /* ── Flag para fallback com get() ──────────────────────────
           Se onSnapshot não disparar em 8 segundos, fazemos uma
           leitura única (get()) como fallback. Isso cobre o caso
           onde o listener em tempo real falha silenciosamente mas
           uma leitura simples funciona. */
        let snapshotFired = false;

        /* ── Listener de produtos com error handler, try-catch e fallback ─
           onSnapshot recebe 2 callbacks: next (sucesso) e error (falha).
           O try-catch dentro do next garante que setCatalogLoaded(true)
           seja chamado MESMO se o mapeamento dos docs lançar erro.
           O error handler garante que falhas de rede/permissão não
           deixem o skeleton infinito na tela. */
        unsubs.push(getCol('products').onSnapshot(
            snap => {
                snapshotFired = true;
                try {
                    setProducts(snap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            stockLimit: normalizeStockLimit(data.stockLimit),
                            isVisible: data.isVisible !== false,
                            campaignId: normalizeCampaignId(data.campaignId, CAMPAIGN_LEGACY_ID),
                        };
                    }));
                } catch (mapErr) {
                    console.error('[Firestore] Erro ao mapear documentos de produtos:', mapErr);
                }
                setDbError(null);
                setLoadingHint('');
                setCatalogLoaded(true);
            },
            err => {
                const errMsg = (err?.message || '').toLowerCase();
                /* Silencia erros esperados durante transição de autenticação.
                   Quando admin desloga, o Firestore pode disparar erro de
                   permissão brevemente antes do signInAnonymously completar.
                   Isso NÃO é um problema real — o listener reconecta sozinho.
                   Silenciamos: permission/insufficient (transição auth),
                   offline/network/unavailable (rede instável). */
                if (errMsg.includes('permission') || errMsg.includes('insufficient')) {
                    /* Erro de permissão — esperado durante logout/login.
                       Não seta dbError pois o listener reconecta automaticamente
                       assim que o novo usuário autentica. */
                    setLoadingHint('Conexao lenta detectada. Tentando reconectar o catalogo...');
                    setCatalogLoaded(true);
                    return;
                }
                if (errMsg.includes('offline') || errMsg.includes('network') || errMsg.includes('unavailable')) {
                    setLoadingHint('Conexao instavel no momento. O catalogo pode levar mais tempo para aparecer.');
                    setCatalogLoaded(true);
                    return;
                }
                console.error('[Firestore] Erro no listener de produtos (onSnapshot):', err);
                /* Tenta fallback com get() antes de desistir */
                getCol('products').get().then(snap => {
                    snapshotFired = true;
                    try {
                        setProducts(snap.docs.map(d => {
                            const data = d.data();
                            return {
                                id: d.id,
                                ...data,
                                stockLimit: normalizeStockLimit(data.stockLimit),
                                isVisible: data.isVisible !== false,
                                campaignId: normalizeCampaignId(data.campaignId, CAMPAIGN_LEGACY_ID),
                            };
                        }));
                    } catch (mapErr2) {
                        console.error('[Firestore] Erro ao mapear produtos (fallback get):', mapErr2);
                    }
                    setDbError(null);
                    setLoadingHint('');
                    setCatalogLoaded(true);
                }).catch(getErr => {
                    const getErrMsg = (getErr?.message || '').toLowerCase();
                    /* Silencia erros de permissão e offline para visitantes */
                    if (getErrMsg.includes('permission') || getErrMsg.includes('insufficient')) {
                        setLoadingHint('Conexao lenta detectada. Tentando reconectar o catalogo...');
                        setCatalogLoaded(true);
                        return;
                    }
                    if (getErrMsg.includes('offline') || getErrMsg.includes('network') || getErrMsg.includes('unavailable')) {
                        setLoadingHint('Conexao instavel no momento. O catalogo pode levar mais tempo para aparecer.');
                        setCatalogLoaded(true);
                        return;
                    }
                    console.error('[Firestore] Fallback get() de produtos também falhou:', getErr);
                    setCatalogLoaded(true);
                    setDbError('Não foi possível carregar o catálogo. Verifique sua conexão e recarregue a página.');
                });
            }
        ));

        /* ── Fallback com get() se onSnapshot não dispara em 8s ────
           Em alguns dispositivos mobile, onSnapshot pode não disparar
           o callback de sucesso NEM o de erro (SDK fica "preso").
           Após 8 segundos sem resposta, fazemos uma leitura única. */
        const fallbackTimer = setTimeout(() => {
            if (snapshotFired) return;
            console.warn('[Firestore] onSnapshot de produtos não disparou em 12s. Tentando fallback get()...');
            getCol('products').get().then(snap => {
                if (snapshotFired) return; // onSnapshot chegou primeiro
                snapshotFired = true;
                try {
                    setProducts(snap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            stockLimit: normalizeStockLimit(data.stockLimit),
                            isVisible: data.isVisible !== false,
                            campaignId: normalizeCampaignId(data.campaignId, CAMPAIGN_LEGACY_ID),
                        };
                    }));
                } catch (mapErr) {
                    console.error('[Firestore] Erro ao mapear produtos (fallback timer get):', mapErr);
                }
                setCatalogLoaded(true);
            }).catch(getErr => {
                const fbMsg = (getErr?.message || '').toLowerCase();
                /* Silencia offline para visitantes */
                if (fbMsg.includes('offline') || fbMsg.includes('network') || fbMsg.includes('unavailable')) {
                    if (!snapshotFired) setCatalogLoaded(true);
                    return;
                }
                console.error('[Firestore] Fallback timer get() de produtos falhou:', getErr);
                if (!snapshotFired) {
                    setCatalogLoaded(true);
                    setDbError('Não foi possível carregar o catálogo. Verifique sua conexão e recarregue a página.');
                }
            });
        }, 8000);

        /* ── Listeners auxiliares públicos com error handlers ──────
           Cada listener recebe callback de erro para evitar que falhas
           de rede/permissão passem despercebidas e travem a UI.
           Erros de permissão são silenciados (visitantes anônimos podem
           não ter acesso a algumas coleções — isso é esperado e seguro).

           OTIMIZAÇÃO: Nem toda coleção precisa de onSnapshot (conexão
           persistente). Para visitantes, coupons e visits não precisam
           de atualizações em tempo real — usamos get() (1 requisição).
           Isso reduz canais persistentes de 5 para 3, diminuindo os
           404s do Listen/channel no console. */
        /* ── Helper: silencia erros esperados para visitantes ──────
           Para NÃO-admins: silencia permissão (esperado) e offline (evita poluir).
           Para ADMINs: silencia apenas permissão (nunca deve acontecer, mas
           se acontecer é ruído), mas NÃO silencia offline — o admin precisa
           saber se o Firestore está indisponível para debug. */
        const silenciarPermissao = (nome) => (err) => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('insufficient')) return; /* esperado para visitantes */
            if (msg.includes('offline') || msg.includes('network') || msg.includes('unavailable') || msg.includes('failed to get')) return; /* silencia offline para visitantes */
            console.error(`[Firestore] Erro no listener de ${nome}:`, err);
        };

        /* ── Campanhas: onSnapshot (precisa de real-time para UX) ── */
        unsubs.push(getCol('campanhas').onSnapshot(
            snap => setCampaigns(snap.docs.map(d => normalizeCampaignDoc({ id: d.id, ...d.data() }))),
            silenciarPermissao('campanhas')
        ));

        /* ── site_settings: onSnapshot (precisa de real-time para mudanças de modo) ── */
        unsubs.push(getMetaDoc('site_settings').onSnapshot(
            doc => {
                if (doc.exists) setSiteSettings(prev => ({ ...prev, ...doc.data() }));
                setSiteSettingsLoaded(true);
            },
            silenciarPermissao('site_settings')
        ));

        /* ── Coupons: get() (visitante não precisa de real-time) ──
           Carrega uma vez. Se admin estiver logado, o AdminPanel tem
           seu próprio listener onSnapshot para gerenciar cupons. */
        getCol('coupons').get().then(snap => {
            setAllCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(err => {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('permission') || msg.includes('offline') || msg.includes('network') || msg.includes('unavailable')) return;
            console.warn('[Firestore] Falha ao carregar cupons (get):', err.message || err);
        });

        /* ── visits: get() removido da vitrine (Fase 2 — Otimização).
           O contador de visitas agora é gerenciado exclusivamente
           pelo app-admin.js no painel administrativo. */

        return () => {
            clearTimeout(fallbackTimer);
            unsubs.forEach(unsub => typeof unsub === 'function' && unsub());
        };
    }, []); /* ← Sem dependências! Roda no mount, independente de auth */

    /* ════════════════════════════════════════════════════════════════
       EFEITO: Timeout de segurança para skeleton infinito (mobile)
       ════════════════════════════════════════════════════════════════
       Último recurso: se após 15 segundos o catálogo ainda não carregou
       (tudo falhou, inclusive o fallback get()), marcamos como carregado
       para remover o skeleton e exibir "Nenhum item disponível" em vez
       de loading infinito.

       Com a separação dos listeners públicos (sem depender de auth),
       este timeout só deve disparar em casos extremos de Firestore
       completamente indisponível.

       NOTA (Fase 2 — Otimização): o timeout de pedidos foi removido pois
       a vitrine pública não carrega mais a collection 'orders'. Pedidos
       são gerenciados exclusivamente pelo app-admin.js.
       ════════════════════════════════════════════════════════════════ */
    useEffect(() => {
        if (catalogLoaded) return;
        const slowHintTimer = setTimeout(() => {
            setLoadingHint('Conexao lenta detectada. Ainda estamos carregando o catalogo para voce.');
        }, 6000);
        const timer = setTimeout(() => {
            console.warn('[App] Timeout de segurança: catálogo não carregou em 15s. Removendo skeleton.');
            setDbError(prev => prev || 'Conexao instavel. Nao foi possivel carregar tudo no tempo esperado. Tente atualizar a pagina.');
            setCatalogLoaded(true);
        }, 15000);
        return () => {
            clearTimeout(slowHintTimer);
            clearTimeout(timer);
        };
    }, [catalogLoaded]);

    /**
     * Monta/desmonta o chat com base na flag aiEnabled já carregada.
     *
     * Enquanto site_settings não confirmar a flag, o chat fica desativado.
     */
    useEffect(() => {
        let isCancelled = false;

        if (!chatEnabled) {
            setChatWidgetComponent(null);
            return () => { isCancelled = true; };
        }

        loadChatWidgetScriptOnce().then((component) => {
            if (isCancelled) return;
            setChatWidgetComponent(() => (typeof component === 'function' ? component : null));
        });

        return () => { isCancelled = true; };
    }, [chatEnabled, loadChatWidgetScriptOnce]);

    /* ── handleAddToCart: Adiciona produto ao carrinho com validação ──
       Recebe: produto (p) com id, name, price, stockLimit
       Verifica estoque antes de adicionar. Se esgotado (stockLimit <= 0)
       ou se já atingiu o limite, exibe alerta e não adiciona.
       Após adicionar, abre o drawer do carrinho automaticamente. */
    const handleAddToCart = useCallback(p => {
        const stockLimit = Number.isFinite(Number(p.stockLimit)) ? Math.max(0, Math.trunc(Number(p.stockLimit))) : null;
        if (stockLimit !== null && stockLimit <= 0) {
            alert(`"${safeText(p.name)}" está esgotado no momento.`);
            return;
        }
        const currentQty = cart.find(i => i.id === p.id)?.qty || 0;
        if (stockLimit !== null && currentQty + 1 > stockLimit) {
            alert(`Limite de estoque atingido! S? h? ${stockLimit} unidade(s) disponível(is) de "${safeText(p.name)}".`);
            return;
        }
        addToCart(p);
        setIsCartOpen(true);
    }, [addToCart, cart]);

    /* ── handleCartUpdateQty: Altera quantidade no carrinho ───────────
       Recebe: id do item, delta (+1 ou -1)
       Se delta > 0, verifica estoque do produto antes de incrementar.
       Delegada para updateQty do hook useCart. */
    const handleCartUpdateQty = useCallback((id, delta) => {
        if (delta > 0) {
            const product = products.find(p => p.id === id);
            const stockLimit = Number.isFinite(Number(product?.stockLimit)) ? Math.max(0, Math.trunc(Number(product.stockLimit))) : null;
            if (product && stockLimit !== null) {
                const currentQty = cart.find(i => i.id === id)?.qty || 0;
                if (currentQty + delta > stockLimit) {
                    alert(`Limite de estoque atingido! S? h? ${stockLimit} unidade(s) disponível(is) de "${safeText(product.name)}".`);
                    return;
                }
            }
        }
        updateQty(id, delta);
    }, [updateQty, products, cart]);
    /* ── filteredProducts: Produtos filtrados para a vitrine ──────────
       Filtra por: 1) isVisible !== false, 2) campanha ativa ou GERAL,
       3) nome contém searchTerm (busca case-insensitive) */
    const filteredProducts = useMemo(() => products
        .filter(p => p.isVisible !== false)
        .filter(p => {
            const productCampaignId = normalizeCampaignId(p.campaignId, CAMPAIGN_LEGACY_ID);
            if (productCampaignId === CAMPAIGN_GENERAL_ID) return true;
            return productCampaignId === activeCampaign.id;
        })
        .filter(p => String(p.name || '').toLowerCase().includes(searchTerm.toLowerCase())), [products, searchTerm, activeCampaign.id]);

    /* ── applyCoupon: Valida e aplica cupom de desconto ──────────────
       Busca cupom pelo código (case-insensitive) em allCoupons.
       Se encontrado e ativo, seta appliedCoupon. Senão, alerta erro. */
    const applyCoupon = useCallback(() => {
        if (!couponInput) return;
        const found = allCoupons.find(c => String(c.code).toUpperCase() === couponInput.toUpperCase());
        if (found && found.active !== false) { setAppliedCoupon(found); alert('Cupom aplicado com sucesso!'); }
        else { setAppliedCoupon(null); alert('Cupom inválido ou expirado.'); }
    }, [couponInput, allCoupons]);

    /* ── resetForm: Limpa todos os campos do formulário de pedido ────
       Esvazia carrinho, dados do cliente, entrega, pagamento, cupom.
       Fecha o drawer do carrinho. */
    const resetForm = useCallback(() => {
        clearCart(); setCustomerName(''); setCustomerPhone(''); setOrderDate(''); setOrderTime('');
        setStreet(''); setNeighborhood(''); setReference(''); setPaymentMethod('');
        setCardInstallments('1');
        setCashChangeFor('');
        setPixCopied(false);
        setAppliedCoupon(null); setCouponInput(''); setDeliveryMethod('retirada'); setIsCartOpen(false);
        setOrderObservations('');
    }, [clearCart]);

    /* ════════════════════════════════════════════════════════════════
       saveAndSend: Função principal de finalização de pedido
       ════════════════════════════════════════════════════════════════
       Fluxo completo:
       1. Valida dados obrigatórios (telefone, nome, UID autenticado)
       2. Valida entrega disponível (segurança contra bypass)
       3. Valida data/hora (modo evento) e horário de funcionamento
       4. Valida pagamento e troco (se Dinheiro)
       5. Valida endereço (se entrega)
       6. Monta orderData com todos os campos do pedido
       7. Salva no Firebase (collection 'orders')
       8. Monta mensagem WhatsApp com resumo do pedido
       9. Abre WhatsApp em nova aba com a mensagem pré-preenchida
       10. Mostra modal de sucesso e reseta o formulário */
    const saveAndSend = useCallback(async () => {
        const num = safeText(customerPhone).replace(/\D/g, '');
        if (num.length < 8) return alert('Por favor, digite um número de WhatsApp válido (mínimo de 8 dígitos).');
        if (!customerName) return alert('Por favor, preencha o nome.');

        const requesterUid = safeText(auth.currentUser?.uid).trim();
        if (!requesterUid) return alert('Sessão ainda não autenticada. Aguarde e tente novamente.');

        // Validação de segurança global: verifica se entrega está disponível
        // Impede que pedidos com entrega passem caso a opção tenha sido desativada enquanto o cliente montava o carrinho
        const deliveryGloballyAvailable = siteSettings.isDeliveryAvailable !== undefined ? Boolean(siteSettings.isDeliveryAvailable) : true;
        if (deliveryMethod === 'entrega' && !deliveryGloballyAvailable) {
            return alert('A entrega está temporariamente indisponível. Por favor, escolha a opção de retirada no local.');
        }

        const now = new Date();
        const nowDate = normalizeDateOnlyValue(now, todayStr);
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const hasDateTime = !isDayToDayMode && Boolean(orderDate && orderTime);

        if (!isDayToDayMode && !hasDateTime) return alert('Por favor, preencha Nome, Data e Horário.');
        if (hasDateTime && orderDate < todayStr) return alert('A data não pode ser no passado.');
        if (hasDateTime) {
            const [h, m] = orderTime.split(':').map(Number);
            if (h < 9 || h > 23 || (h === 23 && m > 0)) return alert('Horário de funcionamento: 09:00 às 23:00.');
        }

        const effectiveOrderDate = hasDateTime ? orderDate : nowDate;
        const effectiveOrderTime = hasDateTime ? orderTime : nowTime;
        if (!paymentMethod) return alert('Por favor, escolha a forma de pagamento (PIX, Dinheiro ou Cartão).');

        const normalizedCashChangeFor = safeText(cashChangeFor).replace(',', '.').replace(/[^0-9.]/g, '');
        const cashChangeForValue = Number(normalizedCashChangeFor);
        const hasValidCashChangeFor = Number.isFinite(cashChangeForValue) && cashChangeForValue > 0;

        if (paymentMethod === 'Dinheiro' && !hasValidCashChangeFor) {
            return alert('Para pagamento em Dinheiro, informe o campo "Troco para quanto?".');
        }

        if (paymentMethod === 'Dinheiro' && cashChangeForValue < payableTotal) {
            return alert('O valor de "Troco para quanto?" precisa ser maior ou igual ao total do pedido.');
        }

        if (deliveryMethod === 'entrega' && (!street || !neighborhood)) return alert('Para entrega, preencha a Rua e o Bairro.');

        const waWindow = window.open('about:blank', '_blank');

        setIsSaving(true);
        const addr = deliveryMethod === 'entrega' ? `${street}, Bairro: ${neighborhood}. Ref: ${reference || 'Nenhuma'}` : 'Na Helô Confeitaria (Rua Anastácio Paulo de Sousa, 63)';
        const paymentLabel = paymentMethod === 'Cartão' ? `Cartão (${installmentQty}x de R$ ${fmtBRL(installmentAmount)})` : paymentMethod;

        const campaignId = normalizeCampaignId(activeCampaign.id, CAMPAIGN_GENERAL_ID);
        if (!campaignId) return alert('Não foi possível identificar a campanha ativa.');

        const orderData = {
            customerName, customerPhone, date: effectiveOrderDate, time: effectiveOrderTime, method: deliveryMethod,
            address: addr, paymentMethod: paymentLabel, cardInstallments: installmentQty,
            cashChangeFor: paymentMethod === 'Dinheiro' ? cashChangeForValue : 0,
            items: cart.map(i => ({ productId: safeText(i.id), name: i.name, qty: i.qty, price: i.price })),
            subtotal, discount: discountValue, couponCode: appliedCoupon ? appliedCoupon.code : (specialApplied ? 'CLIENTEVIPHELO' : null),
            deliveryFee: finalDelivery, baseTotal: total, cardFeeRate: paymentMethod === 'Cartão' ? installmentRate : 0,
            cardFeeValue: paymentMethod === 'Cartão' ? cardFeeValue : 0, total: payableTotal,
            campaignId,
            observations: orderObservations || '',
            createdByUid: requesterUid,
            status: 'Novo', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        let createdOrderId = '';
        try {
            const orderRef = await getCol('orders').add(orderData);
            createdOrderId = safeText(orderRef?.id);
        } catch (e) {
            console.error(e);
            if (waWindow && !waWindow.closed) waWindow.close();
            setIsSaving(false);
            alert('Não foi possível salvar o pedido agora. Verifique sua conexão e tente novamente.');
            return;
        }

        const formatCurrency = (value) => Number(value || 0).toFixed(2).replace('.', ',');
        const orderItemsText = cart
            .map((item) => `*${item.qty}x ${item.name}* - *R$ ${formatCurrency(item.price * item.qty)}*`)
            .join('\n');
        // Monta a mensagem incluindo somente as seções com dados preenchidos.
        // Mensagem 100% ASCII para evitar "?" em clientes sem suporte completo a emoji/fonte.
        const msgParts = [
            `*NOVO PEDIDO - HELO CONFEITARIA*`,
            ``,
            `Ola, *${safeText(customerName, 'Cliente')}*! Recebemos o seu pedido. Confira os detalhes abaixo:`,
            `WhatsApp: *${safeText(customerPhone, 'Nao informado')}*`,
            ``,
            `*ITENS DO PEDIDO:*`,
            orderItemsText || `*Nenhum item informado*`,
        ];

        if (hasDateTime) {
            msgParts.push(``, `*DATA E HORARIO:* ${effectiveOrderDate.split('-').reverse().join('/')} as ${effectiveOrderTime}h`);
        }

        msgParts.push(``);
        if (deliveryMethod === 'entrega') {
            msgParts.push(`*ENTREGA EM DOMICILIO:*`);
            if (safeText(street))        msgParts.push(`Rua: *${safeText(street)}*`);
            if (safeText(neighborhood)) msgParts.push(`Bairro: *${safeText(neighborhood)}*`);
            if (safeText(reference))    msgParts.push(`Referencia: *${safeText(reference)}*`);
        } else {
            msgParts.push(`*RETIRADA NO LOCAL:* Helo Confeitaria (Rua Anastacio Paulo de Sousa, 63)`);
        }

        msgParts.push(``, `*RESUMO FINANCEIRO:*`);
        msgParts.push(`Subtotal: *R$ ${formatCurrency(subtotal)}*`);
        if (discountValue > 0)                               msgParts.push(`Desconto: *-R$ ${formatCurrency(discountValue)}*`);
        if (deliveryMethod === 'entrega' && finalDelivery > 0) msgParts.push(`Taxa de Entrega: *R$ ${formatCurrency(finalDelivery)}*`);
        msgParts.push(`Total: *R$ ${formatCurrency(payableTotal)}*`);

        msgParts.push(``);
        if (paymentMethod === 'PIX') {
            msgParts.push(`*PAGAMENTO VIA PIX*`);
            msgParts.push(`Chave PIX: *${safeText(pixKey)}*`);
            /* Exibe Titular somente quando nomeTitularPix estiver preenchido (não nulo/vazio) */
            const titularPreenchido = safeText(siteSettings.nomeTitularPix).trim();
            if (titularPreenchido) msgParts.push(`Titular: *${titularPreenchido}*`);
            msgParts.push(`_Para agilizar, envie o comprovante respondendo a esta mensagem._`);
        } else if (paymentMethod === 'Dinheiro') {
            msgParts.push(`*PAGAMENTO:* Dinheiro`);
            if (hasValidCashChangeFor) {
                msgParts.push(`Troco para: *R$ ${formatCurrency(cashChangeForValue)}*`);
            }
        } else {
            msgParts.push(`*PAGAMENTO:* ${safeText(paymentLabel)}`);
        }

        if (safeText(orderObservations).trim()) {
            msgParts.push(``, `*OBSERVACOES:*`, safeText(orderObservations).trim());
        }

        const msg = msgParts.join('\n');

        const waUrl = `https://wa.me/5588981577625?text=${encodeURIComponent(msg)}`;

        if (waWindow && !waWindow.closed) { waWindow.location.href = waUrl; }
        setSuccessData(waUrl); resetForm(); setIsSaving(false);
    }, [customerPhone, customerName, orderDate, orderTime, deliveryMethod, street, neighborhood, paymentMethod, reference, cart, subtotal, discountValue, appliedCoupon, specialApplied, finalDelivery, total, todayStr, resetForm, installmentQty, installmentAmount, installmentRate, cardFeeValue, payableTotal, orderObservations, activeCampaign.id, isDayToDayMode, cashChangeFor, pixKey, products]);

    /* ── Estilos reutilizáveis para inputs e botões de método ────────
       inp: estilo base para campos de texto do formulário
       btnMethod: função que retorna estilo para botão BUSCAR/ENTREGA,
       recebendo booleano se está ativo (selecionado) */
    const inp = { width: '100%', padding: '1rem', borderRadius: '.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,.05)', outline: 'none', fontSize: '14px', fontWeight: '500', color: 'var(--primary)', background: '#fff', fontFamily: 'inherit' };
    const btnMethod = active => ({ flex: 1, padding: '1rem', borderRadius: '.75rem', border: `2px solid ${active ? 'var(--primary)' : '#f1f5f9'}`, background: active ? 'var(--primary)' : '#fff', color: active ? 'var(--cream)' : 'var(--s400)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all .15s' });

    /* ════════════════════════════════════════════════════════════════
       RENDERIZAÇÃO CONDICIONAL
       ════════════════════════════════════════════════════════════════
       1. Se ?feedback= na URL → FeedbackExperience (se disponível)
       2. Senão → Vitrine pública com carrinho, hero e rodapé

       NOTA (Fase 2 — Otimização): o painel administrativo foi removido
       da vitrine. Admin agora acessa exclusivamente via admin.html,
       que carrega app-admin.js como entrypoint isolado.
       ════════════════════════════════════════════════════════════════ */
    if (feedbackOrderId) {
        if (typeof window !== 'undefined' && typeof window.FeedbackExperience !== 'undefined') {
            const FExp = window.FeedbackExperience;
            return <FExp orderId={feedbackOrderId} onBack={() => window.location.href = window.location.href.split('?')[0].split('#')[0]} />;
        }
        return <div style={{ padding: '5rem', textAlign: 'center' }}>Carregando área de feedback...</div>;
    }

    /* ════════════════════════════════════════════════════════════════
       JSX — Vitrine pública (layout principal)
       ════════════════════════════════════════════════════════════════
       Estrutura:
       1. Container flex coluna (min-height: 100vh)
       2. Cabecalho: barra de navegação com ícone do carrinho
       3. Banner de erro DB (se dbError)
       4. Hero: logo + slogan da Helô
       5. VitrineProdutos: grid de produtos com filtros e escassez
       6. CarrinhoCompras: drawer lateral com formulário completo
       7. Modal de sucesso (após pedido salvo)
       8. RodapeSite: rodapé com horário e link para admin.html

       NOTA (Fase 2 — Otimização): ModalAcessoReservado removido.
       Login admin agora é feito diretamente em admin.html. */
    return (
        <>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} className="main-content">
                <Cabecalho cart={cart} onOpenCart={() => setIsCartOpen(true)} />

                {dbError && (
                    <div style={{ position: 'fixed', top: '5rem', left: 0, right: 0, zIndex: 40, background: '#fefce8', borderBottom: '1px solid #fef08a', color: '#854d0e', fontSize: '12px', textAlign: 'center', padding: '8px 16px', fontWeight: '500' }}>
                        <i className="ph-bold ph-warning" style={{ marginRight: '4px' }}></i>{dbError}
                    </div>
                )}

                {!dbError && loadingHint && (
                    <div style={{ position: 'fixed', top: '5rem', left: 0, right: 0, zIndex: 39, background: '#eff6ff', borderBottom: '1px solid #bfdbfe', color: '#1e3a8a', fontSize: '12px', textAlign: 'center', padding: '8px 16px', fontWeight: '500' }}>
                        <i className="ph-bold ph-clock-countdown" style={{ marginRight: '4px' }}></i>{loadingHint}
                    </div>
                )}

                <section className="hero-section hero-premium">
                    <div style={{ maxWidth: '112rem', margin: '0 auto', padding: '0 1.5rem', position: 'relative', zIndex: 1 }}>
                        <div className="logo-wrapper">
                            <div className="helo-logo" role="img" aria-label="Helô Confeitaria"></div>
                            <p className="slogan">Adoçando momentos especiais</p>
                        </div>
                    </div>
                </section>

                <VitrineProdutos
                    siteSettings={siteSettings}
                    safeText={safeText}
                    enableScarcityBanner={enableScarcityBanner}
                    deadlinePassed={deadlinePassed}
                    deadlineLabelBanner={deadlineLabelBanner}
                    catalogLoaded={catalogLoaded}
                    remainingUnits={remainingUnits}
                    progressPercent={progressPercent}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    filteredProducts={filteredProducts}
                    onAddToCart={handleAddToCart}
                    bestSellerNames={bestSellerNames}
                    buildMenuTabOptions={buildMenuTabOptions}
                    dedupeProductsByIdentity={dedupeProductsByIdentity}
                    normalizeProductForMenu={normalizeProductForMenu}
                    resolveProductMenuTab={resolveProductMenuTab}
                    getMenuTabLabel={getMenuTabLabel}
                    normalizeProductImages={normalizeProductImages}
                    installmentText={installmentText}
                    fmtBRL={fmtBRL}
                    ProductCard={ProductCard}
                    ProdutoModal={typeof ProdutoModal !== 'undefined' ? ProdutoModal : null}
                />

                <CarrinhoCompras
                    open={isCartOpen}
                    isSaving={isSaving}
                    onCloseDrawer={() => setIsCartOpen(false)}
                    cart={cart}
                    updateQty={handleCartUpdateQty}
                    inp={inp}
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    customerPhone={customerPhone}
                    setCustomerPhone={setCustomerPhone}
                    isVip={isVip}
                    todayStr={todayStr}
                    orderDate={orderDate}
                    setOrderDate={setOrderDate}
                    orderTime={orderTime}
                    setOrderTime={setOrderTime}
                    appliedCoupon={appliedCoupon}
                    couponInput={couponInput}
                    setCouponInput={setCouponInput}
                    setAppliedCoupon={setAppliedCoupon}
                    applyCoupon={applyCoupon}
                    btnMethod={btnMethod}
                    deliveryMethod={deliveryMethod}
                    setDeliveryMethod={setDeliveryMethod}
                    street={street}
                    setStreet={setStreet}
                    neighborhood={neighborhood}
                    setNeighborhood={setNeighborhood}
                    reference={reference}
                    setReference={setReference}
                    orderObservations={orderObservations}
                    setOrderObservations={setOrderObservations}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    cashChangeFor={cashChangeFor}
                    setCashChangeFor={setCashChangeFor}
                    cardInstallments={cardInstallments}
                    setCardInstallments={setCardInstallments}
                    total={total}
                    totalWithCardFee={totalWithCardFee}
                    installmentRate={installmentRate}
                    pixKey={pixKey}
                    nomeTitularPix={siteSettings.nomeTitularPix || ''}
                    handleCopyPix={handleCopyPix}
                    pixCopied={pixCopied}
                    subtotal={subtotal}
                    discountValue={discountValue}
                    specialApplied={specialApplied}
                    finalDelivery={finalDelivery}
                    cardFeeValue={cardFeeValue}
                    payableTotal={payableTotal}
                    installmentQty={installmentQty}
                    installmentAmount={installmentAmount}
                    saveAndSend={saveAndSend}
                    fmtBRL={fmtBRL}
                    installmentText={installmentText}
                    CARD_INSTALLMENT_RATES={CARD_INSTALLMENT_RATES}
                    DELIVERY_FEE={effectiveDeliveryFee}
                    isDayToDayMode={isDayToDayMode}
                    dayToDayOperationDays={dayToDayOperationDays}
                    dayToDayOperationHours={dayToDayOperationHours}
                    isDeliveryAvailable={siteSettings.isDeliveryAvailable !== undefined ? Boolean(siteSettings.isDeliveryAvailable) : true}
                />

                {successData && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} onClick={() => setSuccessData(null)}></div>
                        <div style={{ background: '#fff', borderRadius: '2rem', padding: '2.5rem 2rem', width: '100%', maxWidth: '400px', position: 'relative', zIndex: 10000, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,.5)' }} className="animate-fade-in">
                            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 15px -3px rgba(22,163,74,.2)', fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>OK</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>Pedido Registrado!</h2>
                            <p style={{ fontSize: '14px', color: 'var(--s500)', lineHeight: 1.5, marginBottom: '1.5rem' }}>Seu pedido foi salvo com sucesso e o carrinho foi esvaziado.</p>
                            <a href={successData} target="_blank" rel="noreferrer" onClick={() => setSuccessData(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#25D366', color: '#fff', padding: '1rem', borderRadius: '1rem', fontWeight: '700', textDecoration: 'none', marginBottom: '12px', transition: 'transform 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                WA Concluir no WhatsApp
                            </a>
                            <button onClick={() => setSuccessData(null)} style={{ background: 'none', border: 'none', color: 'var(--s400)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '8px', textDecoration: 'underline' }}>Fechar</button>
                        </div>
                    </div>
                )}

                <RodapeSite
                    onOpenLogin={() => { window.location.href = '/admin.html'; }}
                    operationDays={dayToDayOperationDays}
                    operationHours={dayToDayOperationHours}
                />
                {chatWidgetComponent ? React.createElement(chatWidgetComponent) : null}
            </div>
        </>
    );
};

/* ── Ponto de entrada: Renderiza o componente App no DOM ──────────
   Busca o elemento #root no index.html e renderiza a aplicação React.
   Usa ReactDOM.createRoot (React 18+) para renderização concorrente. */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
