/* ═══════════════════════════════════════════════════════════════════════
   app.js — CONFIGURAÇÃO CENTRAL E UTILITÁRIOS DO SISTEMA
   ═══════════════════════════════════════════════════════════════════════
   Este é o "coração" do sistema. Ele faz 3 coisas principais:

   1. CONECTA AO FIREBASE  → Inicializa o banco de dados e a autenticação
   2. DEFINE CONSTANTES    → Taxas de entrega, limites VIP, configurações
   3. FORNECE UTILITÁRIOS  → Funções auxiliares usadas por todo o sistema
      (formatação de datas, moeda, normalização de textos, etc.)

   Tudo é exposto via window.HeloApp para que os outros arquivos possam
   acessar essas funções e constantes de qualquer lugar do código.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── IIFE (Immediately Invoked Function Expression) ────────────────────
   A função é executada assim que o arquivo carrega. O que fica dentro
   é "privado" — só o "return" final é público. Isso organiza o código
   e evita conflitos de nomes entre arquivos.
   ──────────────────────────────────────────────────────────────────── */
window.HeloApp = (() => {

	/* ── Configuração centralizada (com fallback local) ────────────────
	   O sistema tenta carregar configurações de um módulo externo
	   (window.HeloAppConfig). Se esse módulo não carregou (por cache,
	   ordem de carregamento, etc.), usamos valores locais como fallback.
	   Isso garante que o sistema NUNCA para de funcionar por falta de
	   configuração — uma estratégia chamada "graceful degradation".
	   ──────────────────────────────────────────────────────────────── */
	const coreConfig = window.HeloAppConfig || {};

	/* ══════════════════════════════════════════════════════════════════
	   FIREBASE — Conexão com o banco de dados na nuvem
	   ══════════════════════════════════════════════════════════════════
	   O Firebase é o "banco de dados na nuvem" do Google. Ele guarda:
	   - Produtos do cardápio
	   - Pedidos dos clientes
	   - Dados de campanhas e cupons
	   - Configurações do site

	   Estas credenciais identificam QUAL projeto Firebase nos conectamos.
	   Elas são PÚBLICAS (ficam no front-end) — a segurança vem das regras
	   do Firebase no servidor, não dessas chaves.
	   ══════════════════════════════════════════════════════════════════ */
	const firebaseConfig = coreConfig.firebaseConfig || {
		apiKey: "AIzaSyBERGy8sSDS_dNz2k6eZM-wPAy8pMVoVNE",
		authDomain: "helo-confeitaria.firebaseapp.com",
		projectId: "helo-confeitaria",
		storageBucket: "helo-confeitaria.firebasestorage.app",
		messagingSenderId: "716540729627",
		appId: "1:716540729627:web:67c7c9591ae1ff362bdbbe"
	};

	/* ── Inicializa o Firebase (só uma vez) ───────────────────────────
	   firebase.apps.length verifica se já foi inicializado.
	   Se já foi, não inicializa de novo (evita erro do Firebase).
	   ──────────────────────────────────────────────────────────────── */
	if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

	/* ── Serviços do Firebase que usamos ───────────────────────────────
	   - auth → Autenticação (login de administradores com e-mail/senha)
	   - db   → Firestore (banco de dados de documentos, tipo "pastas")
	   ──────────────────────────────────────────────────────────────── */
	const auth = firebase.auth();
	const db = firebase.firestore();

	/* ── Configurações do Firestore — DEVE vir antes de enablePersistence ───
	   db.settings() só pode ser chamado ANTES de qualquer outra operação
	   no objeto db (incluindo enablePersistence). Chamar depois lança:
	   "Firestore has already been started and its settings can no longer be changed"
	   cacheSizeBytes: CACHE_SIZE_UNLIMITED → nunca descarta o cache local.
	   experimentalForceLongPolling / experimentalAutoDetectLongPolling:
	   o Firebase NÃO permite os dois ao mesmo tempo. Para evitar regressão
	   em cache antigo de config, montamos o objeto dinamicamente e enviamos
	   apenas uma flag por vez. */
	const forceLongPolling = coreConfig.experimentalForceLongPolling === true;
	const autoDetectLongPolling = forceLongPolling
		? false
		: coreConfig.experimentalAutoDetectLongPolling !== false;
	const firestoreSettings = {
		cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
		/* Sempre define as duas chaves explicitamente para não herdar
		   valor de chamada anterior quando houver merge/cache antigo. */
		experimentalForceLongPolling: forceLongPolling,
		experimentalAutoDetectLongPolling: forceLongPolling ? false : autoDetectLongPolling,
		merge: true
	};

	try {
		db.settings(firestoreSettings);
	} catch (error) {
		/* Não derruba o bootstrap inteiro do app por erro de configuração.
		   Se settings falhar (ordem/cache/SDK), o site segue com defaults. */
		console.warn('Firestore settings: aplicacao parcial por compatibilidade.', error);
	}

	/* ── Persistência Offline (IndexedDB) ────────────────────────────────
	   @update 2026-05-09: no SDK compat atual, enablePersistence() gera
	   warning de depreciação (enableIndexedDbPersistence). Para manter
	   console limpo no ambiente operacional e evitar ruído para o time,
	   deixamos OFF por padrão e habilitamos só via config explícita.
	   Isso preserva a operação de pedidos em tempo real sem regressão. */
	const enableOfflinePersistence = coreConfig.enableOfflinePersistence === true;
	const useMultiTabPersistence = coreConfig.useMultiTabPersistence === true;
	if (enableOfflinePersistence) {
		const persistenceConfig = useMultiTabPersistence ? { synchronizeTabs: true } : undefined;
		db.enablePersistence(persistenceConfig).catch((err) => {
			if (err.code === 'failed-precondition') {
				console.warn('Firestore Persistence: Múltiplas abas abertas — apenas uma usa o cache offline.');
			} else if (err.code === 'unimplemented') {
				console.warn('Firestore Persistence: Navegador não suportado (Safari < 15 ou modo privado).');
			}
		});
	}

	/* ══════════════════════════════════════════════════════════════════
	   HELPERS DE ACESSO AO BANCO — getCol() e getMetaDoc()
	   ══════════════════════════════════════════════════════════════════
	   O Firestore organiza dados em "coleções" (como pastas) e
	   "documentos" (como arquivos dentro das pastas).

	   A estrutura do banco é:
	   artifacts/helo-confeitaria/public/data/<coleção>

	   - getCol('orders')    → Acessa a coleção de pedidos
	   - getCol('products')  → Acessa a coleção de produtos
	   - getMetaDoc('site_settings') → Acessa um documento de configuração

	   Essa estrutura com "artifacts" é um padrão do Firebase que separa
	   os dados do app dos dados internos do Firebase, melhorando a
	   segurança e organização.
	   ══════════════════════════════════════════════════════════════════ */
	const getCol = (name) =>
		db.collection('artifacts').doc('helo-confeitaria')
			.collection('public').doc('data').collection(name);
	const getMetaDoc = (name) =>
		db.collection('artifacts').doc('helo-confeitaria')
			.collection('public').doc('data').collection('meta').doc(name);

	/* ── Chave de reivindicação de admin ───────────────────────────────
	   No Firebase, "custom claims" são marcadores especiais que dizem
	   "este usuário é administrador". A chave padrão é 'admin'.
	   ──────────────────────────────────────────────────────────────── */
	const ADMIN_CLAIM_KEY = coreConfig.ADMIN_CLAIM_KEY || 'admin';

	/* ══════════════════════════════════════════════════════════════════
	   CATÁLOGO PADRÃO — Produtos iniciais do cardápio
	   ══════════════════════════════════════════════════════════════════
	   Se o Firebase não tiver produtos cadastrados ainda (ou se o
	   FORCE_DEFAULT_CATALOG estiver ativo), este catálogo é usado como
	   "fallback" — uma lista de produtos prontos para exibir na loja.

	   Cada produto tem:
	   - id          → Identificador único (p1, p2, ...)
	   - name        → Nome do produto (ex: "Snickers")
	   - weight      → Peso/tamanho (ex: "250g")
	   - price       → Preço em reais (ex: 78.99)
	   - installment → Texto de parcelamento (ex: "3x de R$ 28,05 no cartão")
	   - image       → URL da foto do produto (Unsplash = banco de imagens)
	   ══════════════════════════════════════════════════════════════════ */
	const DEFAULT_PRODUCTS = coreConfig.DEFAULT_PRODUCTS || [
		{ id: 'p1', name: 'Snickers', weight: '250g', price: 78.99, installment: '3x de R$ 28,05 no cartão', image: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400' },
		{ id: 'p2', name: 'Ninho C/Nutella', weight: '250g', price: 86.99, installment: '3x de R$ 30,89 no cartão', image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400' },
		{ id: 'p3', name: 'Ferrero Rocher', weight: '250g', price: 94.99, installment: '3x de R$ 33,73 no cartão', image: 'https://images.unsplash.com/photo-1607703703520-bb638e84caf2?w=400' },
		{ id: 'p4', name: 'Brownie C/Caramelo Salgado', weight: '250g', price: 82.99, installment: '3x de R$ 29,47 no cartão', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400' },
		{ id: 'p5', name: 'Brownie C/Ninho e Nutella', weight: '250g', price: 87.99, installment: '3x de R$ 31,24 no cartão', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400' },
		{ id: 'p6', name: 'Chocolatudo', weight: '250g', price: 78.99, installment: '3x de R$ 28,05 no cartão', image: 'https://images.unsplash.com/photo-1606312618440-0f5b1c0f2fd1?w=400' },
		{ id: 'p7', name: 'Red Velvet', weight: '250g', price: 89.99, installment: '3x de R$ 31,95 no cartão', image: 'https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=400' },
		{ id: 'p8', name: 'Duo C/ Brigadeiro e Ninho', weight: '250g', price: 78.99, installment: '3x de R$ 28,05 no cartão', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400' },
		{ id: 'p9', name: 'Oreo C/Nutella', weight: '250g', price: 83.50, installment: '3x de R$ 29,65 no cartão', image: 'https://images.unsplash.com/photo-1607703703520-bb638e84caf2?w=400' },
		{ id: 'p10', name: 'Kinder C/Nutella e Ninho', weight: '250g', price: 94.99, installment: '3x de R$ 33,73 no cartão', image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400' },
	];

	/* ══════════════════════════════════════════════════════════════════
	   CONSTANTES DE NEGÓCIO — Regras da loja
	   ══════════════════════════════════════════════════════════════════
	   Estas constantes definem as regras de funcionamento da loja.
	   O operador "??" (nullish coalescing) significa: "use o valor do
	   coreConfig, mas se for null ou undefined, use o valor padrão".
	   Diferente do "||", o "??" preserva 0 e false como valores válidos.
	   ══════════════════════════════════════════════════════════════════ */

	/* Taxa de entrega para modo Evento (Páscoa, Natal, etc.) — R$ 3,00 */
	const DELIVERY_FEE = coreConfig.DELIVERY_FEE ?? 3.00;

	/* Taxa de entrega para modo Dia a Dia (operação normal) — R$ 2,00 */
	const DAY_TO_DAY_DELIVERY_FEE = coreConfig.DAY_TO_DAY_DELIVERY_FEE ?? 2.00;

	/* Quanto o cliente precisa gastar no mês para ser VIP — R$ 300 */
	const VIP_THRESHOLD = coreConfig.VIP_THRESHOLD ?? 300;

	/* Desconto VIP: 10% = 0.10 (multiplicador, não percentual) */
	const VIP_DISCOUNT = coreConfig.VIP_DISCOUNT ?? 0.10;

	/* ── Taxas de parcelamento no cartão de crédito ────────────────────
	   Cada número de parcelas tem uma taxa percentual cobrada pela
	   operadora de cartão. Ex: 1x = 4.2%, 2x = 6.09%, 3x = 6.53%.
	   Essas taxas são adicionadas ao preço para o cliente pagar parcelado.
	   ──────────────────────────────────────────────────────────────── */
	const CARD_INSTALLMENT_RATES = coreConfig.CARD_INSTALLMENT_RATES || { 1: 0.042, 2: 0.0609, 3: 0.0653 };

	/* ── Controle de migração do catálogo ──────────────────────────────
	   FORCE_DEFAULT_CATALOG → Se true, sempre usa o catálogo padrão
	   APPLY_CATALOG_FIX_ONCE → Aplica correção de catálogo apenas 1 vez
	   CATALOG_FIX_DOC_ID → ID do documento que marca se a correção já foi feita
	   ──────────────────────────────────────────────────────────────── */
	const FORCE_DEFAULT_CATALOG = coreConfig.FORCE_DEFAULT_CATALOG ?? false;
	const APPLY_CATALOG_FIX_ONCE = coreConfig.APPLY_CATALOG_FIX_ONCE ?? true;
	const CATALOG_FIX_DOC_ID = coreConfig.CATALOG_FIX_DOC_ID || 'catalog_fix_v2_10_items';

	/* ── Janelas de detecção de pedidos duplicados ─────────────────────
	   DUPLICATE_WINDOW_MS → 5 minutos: tempo para considerar um pedido
	   como duplicata real (mesmo cliente, mesmo conteúdo, pouco tempo).
	   VISUAL_DUP_WINDOW → 10 minutos: tempo para marcar visualmente
	   pedidos como "possível duplicata" na tela do admin.
	   Ambos em milissegundos (5 min = 300.000 ms).
	   ──────────────────────────────────────────────────────────────── */
	const DUPLICATE_WINDOW_MS = coreConfig.DUPLICATE_WINDOW_MS ?? (5 * 60 * 1000);
	const VISUAL_DUP_WINDOW = coreConfig.VISUAL_DUP_WINDOW ?? (10 * 60 * 1000);

	/* ══════════════════════════════════════════════════════════════════
	   CONSTANTES DE CAMPANHAS — Organização de eventos e períodos
	   ══════════════════════════════════════════════════════════════════
	   O sistema trabalha com "campanhas" — períodos de venda especiais.
	   Ex: Páscoa, Natal, Dia das Mães são campanhas de evento.
	   O dia a dia normal também é uma campanha ("geral").

	   - CAMPAIGN_LEGACY_ID    → ID da campanha de evento anterior
	   - CAMPAIGN_GENERAL_ID   → ID da campanha de dia a dia
	   - CAMPAIGN_DEFAULT_NAME → Nome padrão de campanha de evento
	   - CAMPAIGN_GENERAL_NAME → Nome da campanha de dia a dia
	   ══════════════════════════════════════════════════════════════════ */
	const CAMPAIGN_LEGACY_ID = coreConfig.CAMPAIGN_LEGACY_ID || 'evento_anterior';
	const CAMPAIGN_GENERAL_ID = coreConfig.CAMPAIGN_GENERAL_ID || 'dia_a_dia';
	const CAMPAIGN_DEFAULT_NAME = coreConfig.CAMPAIGN_DEFAULT_NAME || 'Evento Anterior';
	const CAMPAIGN_GENERAL_NAME = coreConfig.CAMPAIGN_GENERAL_NAME || 'Dia a Dia';

	/* ── Modos de campanha ─────────────────────────────────────────────
	   - manual → O admin ativa/desativa manualmente
	   - auto   → Ativa/desativa automaticamente por datas
	   - hybrid → Combina manual e automático
	   ──────────────────────────────────────────────────────────────── */
	const CAMPAIGN_MODE_MANUAL = coreConfig.CAMPAIGN_MODE_MANUAL || 'manual';
	const CAMPAIGN_MODE_AUTO = coreConfig.CAMPAIGN_MODE_AUTO || 'auto';
	const CAMPAIGN_MODE_HYBRID = coreConfig.CAMPAIGN_MODE_HYBRID || 'hybrid';

	/* ══════════════════════════════════════════════════════════════════
	   QZ TRAY — Configuração da impressora térmica
	   ══════════════════════════════════════════════════════════════════
	   O QZ Tray é um programa que permite imprimir em impressoras
	   térmicas (aquelas de cupom fiscal) diretamente do navegador.
	   Para segurança, as requisições de impressão precisam ser assinadas
	   digitalmente — por isso temos endpoints de certificado e assinatura.

	   - QZ_SECURITY_ENABLED → Se a segurança de assinatura está ativa
	   - QZ_CERT_ENDPOINT    → URL para buscar o certificado digital
	   - QZ_SIGN_ENDPOINT    → URL para assinar a requisição de impressão
	   - QZ_SIGN_ALGORITHM   → Algoritmo de hash (SHA512 = muito seguro)
	   ══════════════════════════════════════════════════════════════════ */
	const QZ_SECURITY_ENABLED = coreConfig.QZ_SECURITY_ENABLED ?? true;
	const QZ_CERT_ENDPOINT = coreConfig.QZ_CERT_ENDPOINT || '/api/qz/certificate';
	const QZ_SIGN_ENDPOINT = coreConfig.QZ_SIGN_ENDPOINT || '/api/qz/sign';
	const QZ_SIGN_ALGORITHM = coreConfig.QZ_SIGN_ALGORITHM || 'SHA512';

	/* ══════════════════════════════════════════════════════════════════
	   IMPRESSÃO TÉRMICA — Configurações padrão e normalização
	   ══════════════════════════════════════════════════════════════════ */
	const DEFAULT_THERMAL_PRINT_SETTINGS = coreConfig.DEFAULT_THERMAL_PRINT_SETTINGS || {
		thermalPrintEnabled: false,
		thermalPrintAutoOnOrder: false,
		thermalPrinterName: '',
		thermalPrintCopies: 1,
		thermalPrintMode: 'escpos',
		thermalPrintTicketMode: 'both',
		thermalPrintBrowserFallback: true
	};

	/* ══════════════════════════════════════════════════════════════════
	   UTILITÁRIOS — Funções auxiliares usadas em todo o sistema
	   ══════════════════════════════════════════════════════════════════
	   Estas funções são como "ferramentas" que outros arquivos usam.
	   Cada uma tem um fallback local (caso o módulo externo não carregue).

	   A estratégia é: tentar carregar de window.HeloCoreUtils (módulo
	   externo). Se não existir, usa a versão local definida aqui.
	   Isso garante compatibilidade total mesmo com cache antigo.
	   ══════════════════════════════════════════════════════════════════ */
	const coreUtils = window.HeloCoreUtils || {};

	/* ── safeText: Converte qualquer valor para texto seguro ────────────
	   Recebe um valor qualquer e um texto de fallback (padrão: '').
	   - Se o valor é null ou undefined → retorna o fallback
	   - Se o valor é um objeto (ex: array, função) → retorna o fallback
	   - Se não → converte para String e retorna

	   Por que isso é necessário? Porque no JavaScript, tentar usar
	   null.toString() causa um erro que quebra a aplicação inteira.
	   O safeText previne isso sempre retornando um texto válido.
	   ──────────────────────────────────────────────────────────────── */
	const safeText = coreUtils.safeText || ((val, fallback = '') => {
		if (val === null || val === undefined) return fallback;
		if (typeof val === 'object') return fallback;
		return String(val);
	});

	const normalizeThermalPrintMode = coreUtils.normalizeThermalPrintMode || ((value) => safeText(value, 'escpos').toLowerCase().trim() === 'browser' ? 'browser' : 'escpos');
	const normalizeThermalPrintTicketMode = coreUtils.normalizeThermalPrintTicketMode || ((value) => {
		const mode = safeText(value, 'both').toLowerCase().trim();
		if (mode === 'kitchen' || mode === 'cashier' || mode === 'both') return mode;
		return 'both';
	});
	const normalizeThermalPrintSettings = coreUtils.normalizeThermalPrintSettings || ((settings = {}) => ({
		thermalPrintEnabled: settings.thermalPrintEnabled === true,
		thermalPrintAutoOnOrder: settings.thermalPrintAutoOnOrder !== false,
		thermalPrinterName: safeText(settings.thermalPrinterName).trim(),
		thermalPrintCopies: Math.max(1, Math.min(5, Number(settings.thermalPrintCopies) || 1)),
		thermalPrintMode: normalizeThermalPrintMode(settings.thermalPrintMode),
		thermalPrintTicketMode: normalizeThermalPrintTicketMode(settings.thermalPrintTicketMode),
		thermalPrintBrowserFallback: settings.thermalPrintBrowserFallback !== false,
	}));

	/* ── pad2: Completa número com zero à esquerda ─────────────────────
	   Ex: pad2(5) → "05", pad2(12) → "12"
	   Útil para formatar datas: "2024-01-05" em vez de "2024-1-5"
	   ──────────────────────────────────────────────────────────────── */
	const pad2 = coreUtils.pad2 || ((value) => String(value).padStart(2, '0'));

	/* ══════════════════════════════════════════════════════════════════
	   FUNÇÕES DE DATA — Conversão e extração de partes de datas
	   ══════════════════════════════════════════════════════════════════
	   O sistema lida com datas vindas de várias fontes:
	   - Objetos Date do JavaScript
	   - Timestamps do Firebase (com .toDate() ou .seconds)
	   - Strings de data ("2024-04-15" ou "2024-04-15T10:30:00")

	   Essas funções normalizam tudo para um formato padrão:
	   { year: 2024, month: 4, day: 15 }
	   ══════════════════════════════════════════════════════════════════ */

	/* ── getDateOnlyPartsFromDate: Extrai ano/mês/dia de um Date ───────
	   Recebe um objeto Date válido e retorna { year, month, day }.
	   Se a data for inválida, retorna null.
	   Nota: getMonth() retorna 0-11, por isso +1.
	   ──────────────────────────────────────────────────────────────── */
	const getDateOnlyPartsFromDate = coreUtils.getDateOnlyPartsFromDate || ((date) => {
		if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
		return {
			year: date.getFullYear(),
			month: date.getMonth() + 1,
			day: date.getDate(),
		};
	});

	/* ── getDateOnlyParts: Extrai ano/mês/dia de QUALQUER formato ──────
	   Esta é a função "universal" — ela aceita:
	   - Objeto Date → delega para getDateOnlyPartsFromDate
	   - Timestamp Firebase (.toDate()) → converte e delega
	   - Timestamp serializado (.seconds) → converte e delega
	   - String ("2024-04-15" ou "2024-04-15T10:30") → parseia e delega
	   Retorna { year, month, day } ou null se não conseguir converter.
	   ──────────────────────────────────────────────────────────────── */
	const getDateOnlyParts = coreUtils.getDateOnlyParts || ((value) => {
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
		/* Tenta extrair formato ISO: "2024-04-15" ou "2024-04-15T..." */
		const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
		if (dateOnlyMatch) {
			return {
				year: Number(dateOnlyMatch[1]),
				month: Number(dateOnlyMatch[2]),
				day: Number(dateOnlyMatch[3]),
			};
		}
		return getDateOnlyPartsFromDate(new Date(raw));
	});

	/* ── normalizeDateOnlyValue: Converte data para formato "YYYY-MM-DD" ──
	   Ex: Timestamp Firebase → "2024-04-15"
	   Usado para comparar datas e armazenar no banco de forma consistente.
	   ──────────────────────────────────────────────────────────────── */
	const normalizeDateOnlyValue = coreUtils.normalizeDateOnlyValue || ((value, fallback = '') => {
		const parts = getDateOnlyParts(value);
		if (!parts) return fallback;
		return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
	});

	/* ── formatDateOnlyForDisplay: Converte data para formato brasileiro ──
	   Ex: "2024-04-15" → "15/04/2024"
	   Usado para mostrar datas na tela para o usuário.
	   ──────────────────────────────────────────────────────────────── */
	const formatDateOnlyForDisplay = coreUtils.formatDateOnlyForDisplay || ((value, fallback = 'Data Invalida') => {
		const parts = getDateOnlyParts(value);
		if (!parts) return fallback;
		return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
	});

	/* ── toLocalDateFromDateOnly: Converte string de data para Date local ──
	   Ex: "2024-04-15" → new Date(2024, 3, 15) (mês é 0-indexado!)
	   Usado para cálculos de comparação de datas (antes/depois).
	   ──────────────────────────────────────────────────────────────── */
	const toLocalDateFromDateOnly = coreUtils.toLocalDateFromDateOnly || ((value) => {
		const parts = getDateOnlyParts(value);
		if (!parts) return null;
		return new Date(parts.year, parts.month - 1, parts.day);
	});

	/* ── getLocalMonthStr: Retorna string "YYYY-MM" do mês atual ──────
	   Ex: new Date() (abril 2024) → "2024-04"
	   Usado para agrupar dados por mês (relatórios financeiros, etc.).
	   ──────────────────────────────────────────────────────────────── */
	const getLocalMonthStr = coreUtils.getLocalMonthStr || ((value = new Date()) => {
		const parts = getDateOnlyParts(value);
		if (!parts) return '';
		return `${parts.year}-${pad2(parts.month)}`;
	});

	/* ══════════════════════════════════════════════════════════════════
	   FUNÇÕES DE FORMATAÇÃO — Moeda, parcelas e datas completas
	   ══════════════════════════════════════════════════════════════════ */

	/* ── fmtBRL: Formata número como moeda brasileira ──────────────────
	   Ex: fmtBRL(78.9) → "78,90" (sem o "R$", só o número formatado)
	   O JavaScript usa ponto como separador decimal, mas no Brasil
	   usamos vírgula. Esta função faz a troca.
	   ──────────────────────────────────────────────────────────────── */
	const fmtBRL = coreUtils.fmtBRL || ((n) => Number(n || 0).toFixed(2).replace('.', ','));

	/* ── cardTotalWithRate: Calcula preço com taxa de cartão ───────────
	   Quando o cliente paga no cartão, a operadora cobra uma taxa.
	   Esta função adiciona essa taxa ao valor original.

	   Fórmula: valor × (1 + taxa)
	   Ex: R$ 100 em 3x → 100 × (1 + 0.0653) = R$ 106,53
	   ──────────────────────────────────────────────────────────────── */
	const baseCardTotalWithRate = coreUtils.cardTotalWithRate || ((amount, installments = 1, installmentRates = {}) =>
		Number(amount || 0) * (1 + (installmentRates[installments] ?? 0))
	);
	const cardTotalWithRate = (amount, installments = 1) =>
		baseCardTotalWithRate(amount, installments, CARD_INSTALLMENT_RATES);

	/* ── installmentText: Gera texto de parcelamento ───────────────────
	   Ex: "3x de R$ 35,51 no cartão"
	   Calcula o valor total com taxa, divide por 3 e formata.
	   ──────────────────────────────────────────────────────────────── */
	const baseInstallmentText = coreUtils.installmentText || ((price, installmentRates = {}) =>
		`3x de R$ ${fmtBRL(baseCardTotalWithRate(price, 3, installmentRates) / 3)} no cartão`
	);
	const installmentText = (price) => baseInstallmentText(price, CARD_INSTALLMENT_RATES);

	/* ── getMillis: Converte timestamp Firebase para milissegundos ────
	   O Firebase guarda timestamps de formas diferentes.
	   Esta função normaliza para milissegundos (número simples),
	   que é o formato que o JavaScript usa para comparar datas.
	   ──────────────────────────────────────────────────────────────── */
	const getMillis = coreUtils.getMillis || ((ts) => {
		if (!ts) return 0;
		if (typeof ts.toMillis === 'function') return ts.toMillis();
		if (ts.seconds) return ts.seconds * 1000;
		return 0;
	});

	/* ── formatDate: Formata timestamp completo para exibição ──────────
	   Ex: Timestamp → "15/04/2024 às 10:30"
	   Converte o timestamp do Firebase para uma data legível em
	   português, com data e hora.
	   ──────────────────────────────────────────────────────────────── */
	const formatDate = coreUtils.formatDate || ((ts) => {
		if (!ts) return 'Data N/A';
		const d = typeof ts.toDate === 'function' ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
		if (!d) return 'Data N/A';
		return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
	});

	/* ── formatDateStr: Formata string de data para exibição ──────────
	   Ex: "2024-04-15" → "15/04/2024"
	   Atalho que combina getDateOnlyParts + formatDateOnlyForDisplay.
	   ──────────────────────────────────────────────────────────────── */
	const formatDateStr = coreUtils.formatDateStr || ((dateStr) => {
		if (!dateStr) return 'Data N/A';
		return formatDateOnlyForDisplay(dateStr);
	});

	/* ── fmtAgendamento: Formata data de agendamento ──────────────────
	   Converte "2024-04-15" → "15/04/2024" (inverte a ordem).
	   Se a data já não tem traço, retorna como está.
	   Usado na exibição de datas de agendamento de pedidos.
	   ──────────────────────────────────────────────────────────────── */
	const fmtAgendamento = coreUtils.fmtAgendamento || ((s) => {
		if (!s) return 'N/A';
		const v = String(s);
		return v.includes('-') ? v.split('-').reverse().join('/') : v;
	});
	/* ══════════════════════════════════════════════════════════════════
	   UTILITÁRIOS DE CAMPANHA — Funções para gerenciar campanhas/eventos
	   ══════════════════════════════════════════════════════════════════
	   Campanhas são períodos de venda (ex: Páscoa, Dia das Mães).
	   Estas funções normalizam dados de campanha, verificam se estão
	   ativas, detectam conflitos de datas e geram estilos visuais.

	   Seguem a mesma estratégia de fallback: tentam carregar do módulo
	   externo (window.HeloCampaignUtils), senão usam a versão local.
	   ══════════════════════════════════════════════════════════════════ */
	const campaignUtils = window.HeloCampaignUtils || {};

	/* ── Opções base para normalização de campanhas ────────────────────
	   Agrupa os IDs e nomes padrão para passar às funções de normalização.
	   ──────────────────────────────────────────────────────────────── */
	const campaignOptions = {
		generalId: CAMPAIGN_GENERAL_ID,
		generalName: CAMPAIGN_GENERAL_NAME,
		defaultName: CAMPAIGN_DEFAULT_NAME,
		legacyId: CAMPAIGN_LEGACY_ID,
	};

	/* ── normalizeCampaignStatus: Garante status válido ────────────────
	   Recebe qualquer valor e retorna "ativo" ou "inativo".
	   Remove acentos e compara: só "ativo" é aceito, todo resto vira "inativo".
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignStatus = campaignUtils.normalizeCampaignStatus || ((value) => {
		const normalized = safeText(value, 'inativo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
		return normalized === 'ativo' ? 'ativo' : 'inativo';
	});

	/* ── normalizeCampaignId: Garante ID válido ────────────────────────
	   Se o valor for vazio, usa o fallback (padrão: ID da campanha legada).
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignId = campaignUtils.normalizeCampaignId || ((value, fallback = CAMPAIGN_LEGACY_ID) => {
		const id = safeText(value).trim();
		return id || fallback;
	});

	/* ── normalizeCampaignName: Garante nome válido ────────────────────
	   Se o valor for vazio, usa o fallback (padrão: nome da campanha de evento).
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignName = campaignUtils.normalizeCampaignName || ((value, fallback = CAMPAIGN_DEFAULT_NAME) => {
		const name = safeText(value).trim();
		return name || fallback;
	});

	/* ── normalizeCampaignMode: Garante modo válido ────────────────────
	   Aceita: "manual", "auto" ou "hybrid". Qualquer outro valor vira "manual".
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignMode = campaignUtils.normalizeCampaignMode
		? (value) => campaignUtils.normalizeCampaignMode(value, [CAMPAIGN_MODE_MANUAL, CAMPAIGN_MODE_AUTO, CAMPAIGN_MODE_HYBRID], CAMPAIGN_MODE_MANUAL)
		: ((value) => {
			const mode = safeText(value, CAMPAIGN_MODE_MANUAL).toLowerCase().trim();
			if ([CAMPAIGN_MODE_MANUAL, CAMPAIGN_MODE_AUTO, CAMPAIGN_MODE_HYBRID].includes(mode)) return mode;
			return CAMPAIGN_MODE_MANUAL;
		});

	/* ── normalizeDateOnlyOrEmpty: Normaliza data ou retorna vazio ──────
	   Diferente de normalizeDateOnlyValue (que tem fallback), esta
	   retorna string vazia se não conseguir converter. Usada em campos
	   opcionais de campanha (datas de início/fim são opcionais).
	   ──────────────────────────────────────────────────────────────── */
	const normalizeDateOnlyOrEmpty = campaignUtils.normalizeDateOnlyOrEmpty || ((value) => {
		const normalized = normalizeDateOnlyValue(value, '');
		return normalized || '';
	});

	/* ── normalizeCampaignPriority: Garante prioridade numérica válida ──
	   A prioridade define qual campanha prevalece quando há conflito.
	   Valor entre -999 e 999, sempre inteiro. Padrão: 0.
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignPriority = campaignUtils.normalizeCampaignPriority || ((value) => {
		const n = Number(value);
		if (!Number.isFinite(n)) return 0;
		return Math.max(-999, Math.min(999, Math.trunc(n)));
	});

	/* ══════════════════════════════════════════════════════════════════
	   FUNÇÕES DE JANELA DE CAMPANHA — Início e fim do dia
	   ══════════════════════════════════════════════════════════════════
	   Para comparar se uma campanha está ativa AGORA, precisamos saber
	   o início do dia (00:00:00) e o fim do dia (23:59:59.999).
	   Isso porque uma campanha com data "2024-04-15" deve estar ativa
	   durante TODO aquele dia, não apenas à meia-noite.
	   ══════════════════════════════════════════════════════════════════ */

	/* ── toLocalDayStart: Converte data para início do dia (00:00:00) ── */
	const toLocalDayStart = campaignUtils.toLocalDayStart || ((dateOnlyValue) => {
		const parts = getDateOnlyParts(dateOnlyValue);
		if (!parts) return null;
		return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
	});

	/* ── toLocalDayEnd: Converte data para fim do dia (23:59:59.999) ── */
	const toLocalDayEnd = campaignUtils.toLocalDayEnd || ((dateOnlyValue) => {
		const start = toLocalDayStart(dateOnlyValue);
		if (!start) return null;
		const end = new Date(start);
		end.setHours(23, 59, 59, 999);
		return end;
	});

	/* ── isCampaignAutoActiveNow: A campanha está ativa agora? ──────────
	   Verifica se a campanha com modo automático está dentro do período
	   de início e fim. Se não tiver datas, retorna false.
	   Usado para ativar/desativar campanhas automaticamente.
	   ──────────────────────────────────────────────────────────────── */
	const isCampaignAutoActiveNow = campaignUtils.isCampaignAutoActiveNow || ((campaign, now = new Date()) => {
		if (!campaign || campaign.autoEnabled !== true) return false;
		const start = toLocalDayStart(campaign.startDate);
		const end = toLocalDayEnd(campaign.endDate);
		if (!start && !end) return false;
		if (start && now < start) return false;
		if (end && now > end) return false;
		return true;
	});

	/* ── getCampaignScheduleRange: Retorna a janela de datas em ms ─────
	   Converte as datas de início/fim da campanha para milissegundos,
	   facilitando comparações matemáticas. Se não houver data de início,
	   usa -Infinity (sempre antes); se não houver fim, usa +Infinity.
	   ──────────────────────────────────────────────────────────────── */
	const getCampaignScheduleRange = campaignUtils.getCampaignScheduleRange || ((campaign) => {
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
	});

	/* ── normalizeCampaignDoc: Normaliza um documento de campanha ──────
	   Recebe um objeto "cru" do Firebase e retorna um objeto limpo com
	   todos os campos normalizados (id, nome, status, datas, prioridade).
	   Garante que nenhum campo fique undefined ou com formato errado.
	   ──────────────────────────────────────────────────────────────── */
	const normalizeCampaignDoc = campaignUtils.normalizeCampaignDoc
		? (docLike = {}) => campaignUtils.normalizeCampaignDoc(docLike, campaignOptions)
		: ((docLike = {}) => ({
			id: normalizeCampaignId(docLike.id),
			nome: normalizeCampaignName(docLike.nome, docLike.id === CAMPAIGN_GENERAL_ID ? CAMPAIGN_GENERAL_NAME : CAMPAIGN_DEFAULT_NAME),
			status: normalizeCampaignStatus(docLike.status),
			autoEnabled: docLike.autoEnabled === true,
			startDate: normalizeDateOnlyOrEmpty(docLike.startDate),
			endDate: normalizeDateOnlyOrEmpty(docLike.endDate),
			priority: normalizeCampaignPriority(docLike.priority),
			data_criacao: docLike.data_criacao || docLike.createdAt || null,
		}));

	/* ── buildCampaignScheduleConflicts: Detecta campanhas em conflito ──
	   Quando duas campanhas com a MESMA prioridade têm janelas de datas
	   que se sobrepõem, isso é um conflito (qual prevalece?).

	   Algoritmo: para cada par de campanhas, verifica se as janelas
	   de datas se sobrepõem (A.start <= B.end E B.start <= A.end).
	   Se sim e a prioridade é igual → registra o conflito.

	   Retorna lista de conflitos com: IDs, nomes, prioridade e janelas.
	   ──────────────────────────────────────────────────────────────── */
	const buildCampaignScheduleConflicts = campaignUtils.buildCampaignScheduleConflicts
		? (campaignList = []) => campaignUtils.buildCampaignScheduleConflicts(campaignList, campaignOptions)
		: ((campaignList = []) => {
			const list = (Array.isArray(campaignList) ? campaignList : [])
				.map(normalizeCampaignDoc)
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
		});

	/* ── formatCampaignWindowLabel: Texto legível da janela de datas ───
	   Ex: "15/04/2024 a 20/04/2024" ou "a partir de 15/04/2024"
	   ou "até 20/04/2024" ou "sem janela" (se não tem datas).
	   ──────────────────────────────────────────────────────────────── */
	const formatCampaignWindowLabel = campaignUtils.formatCampaignWindowLabel || ((startDate, endDate) => {
		if (startDate && endDate) return `${formatDateOnlyForDisplay(startDate)} a ${formatDateOnlyForDisplay(endDate)}`;
		if (startDate) return `a partir de ${formatDateOnlyForDisplay(startDate)}`;
		if (endDate) return `ate ${formatDateOnlyForDisplay(endDate)}`;
		return 'sem janela';
	});

	/* ── isFirestorePermissionDenied: Erro de permissão do Firebase? ────
	   Verifica se um erro do Firebase é do tipo "permission-denied".
	   Isso acontece quando o usuário tenta acessar dados sem permissão.
	   Usado para mostrar mensagens de erro adequadas ao admin.
	   ──────────────────────────────────────────────────────────────── */
	const isFirestorePermissionDenied = campaignUtils.isFirestorePermissionDenied || ((error) => {
		const code = safeText(error?.code).toLowerCase();
		const message = safeText(error?.message).toLowerCase();
		return code.includes('permission-denied') || message.includes('insufficient permissions');
	});

	/* ── slugifyCampaignId: Converte nome em ID seguro para URL ────────
	   Ex: "Páscoa 2024" → "pascoa_2024"
	   Remove acentos, converte para minúsculo, troca caracteres especiais
	   por underscore. Usado para criar IDs de campanha a partir do nome.
	   ──────────────────────────────────────────────────────────────── */
	const slugifyCampaignId = campaignUtils.slugifyCampaignId || ((value) => {
		const normalized = safeText(value)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		return normalized || '';
	});

	/* ── campaignBadgeStyle: Estilo visual do badge de campanha ─────────
	   Cada tipo de campanha tem uma cor diferente no painel admin:
	   - Dia a Dia  → Azul claro (fundo #ecfeff)
	   - Legada     → Laranja claro (fundo #fff7ed)
	   - Personalizada → Roxo claro (fundo #eef2ff)
	   ──────────────────────────────────────────────────────────────── */
	const campaignBadgeStyle = campaignUtils.campaignBadgeStyle
		? (campaignId) => campaignUtils.campaignBadgeStyle(campaignId, campaignOptions)
		: ((campaignId) => {
			if (campaignId === CAMPAIGN_GENERAL_ID) {
				return { background: '#ecfeff', color: '#155e75', border: '1px solid #a5f3fc' };
			}
			if (campaignId === CAMPAIGN_LEGACY_ID) {
				return { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' };
			}
			return { background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' };
		});

	/* ══════════════════════════════════════════════════════════════════
	   EXPORTAÇÃO — Tudo que fica disponível via window.HeloApp
	   ══════════════════════════════════════════════════════════════════
	   Este "return" é o que efetivamente fica público. Tudo que não
	   está aqui é privado e só existe dentro desta IIFE.

	   Organização das exportações:
	   1. Serviços Firebase (auth, db, getCol, getMetaDoc)
	   2. Constantes de negócio (taxas, limites, modos)
	   3. Utilitários de texto e data (safeText, formatDate, fmtBRL...)
	   4. Utilitários de campanha (normalizeCampaign*, buildConflicts...)
	   ══════════════════════════════════════════════════════════════════ */
	return {
		/* ── 1. Serviços Firebase ─────────────────────────────────────── */
		auth,               /* Autenticação (login/logout de admin) */
		db,                 /* Referência ao banco de dados Firestore */
		getCol,             /* Função para acessar coleções de dados */
		getMetaDoc,         /* Função para acessar documentos de configuração */

		/* ── 2. Constantes de negócio ─────────────────────────────────── */
		ADMIN_CLAIM_KEY,    /* Chave que identifica um usuário como admin */
		DEFAULT_PRODUCTS,   /* Lista de produtos padrão (fallback) */
		DELIVERY_FEE,       /* Taxa de entrega modo Evento (R$ 3,00) */
		DAY_TO_DAY_DELIVERY_FEE, /* Taxa de entrega modo Dia a Dia (R$ 2,00) */
		VIP_THRESHOLD,      /* Limite de gasto para ser VIP (R$ 300) */
		VIP_DISCOUNT,       /* Desconto VIP (10% = 0.10) */
		CARD_INSTALLMENT_RATES, /* Taxas de parcelamento por número de parcelas */
		FORCE_DEFAULT_CATALOG,  /* Forçar uso do catálogo padrão? */
		APPLY_CATALOG_FIX_ONCE, /* Aplicar correção de catálogo só uma vez? */
		CATALOG_FIX_DOC_ID,     /* ID do documento de controle de correção */
		DUPLICATE_WINDOW_MS,    /* Janela de 5min para detectar pedidos duplicados */
		VISUAL_DUP_WINDOW,      /* Janela de 10min para marcar duplicatas visuais */
		CAMPAIGN_LEGACY_ID,     /* ID da campanha de evento anterior */
		CAMPAIGN_GENERAL_ID,    /* ID da campanha de dia a dia */
		CAMPAIGN_DEFAULT_NAME,  /* Nome padrão de campanha de evento */
		CAMPAIGN_GENERAL_NAME,  /* Nome da campanha de dia a dia */
		CAMPAIGN_MODE_MANUAL,   /* Modo manual de campanha */
		CAMPAIGN_MODE_AUTO,     /* Modo automático de campanha */
		CAMPAIGN_MODE_HYBRID,   /* Modo híbrido de campanha */
		QZ_SECURITY_ENABLED,    /* Segurança de impressora térmica ativa? */
		QZ_CERT_ENDPOINT,       /* URL do certificado digital QZ */
		QZ_SIGN_ENDPOINT,       /* URL de assinatura digital QZ */
		QZ_SIGN_ALGORITHM,      /* Algoritmo de hash (SHA512) */
		DEFAULT_THERMAL_PRINT_SETTINGS, /* Configurações padrão de impressão térmica */

		/* ── 3. Utilitários de texto e data ───────────────────────────── */
		safeText,                       /* Converte valor para texto seguro */
		pad2,                           /* Completa com zero: 5 → "05" */
		getDateOnlyPartsFromDate,        /* Extrai ano/mês/dia de um Date */
		getDateOnlyParts,                /* Extrai ano/mês/dia de qualquer formato */
		normalizeDateOnlyValue,          /* Converte data para "YYYY-MM-DD" */
		formatDateOnlyForDisplay,        /* Converte data para "DD/MM/YYYY" */
		toLocalDateFromDateOnly,         /* Converte string de data para Date local */
		getLocalMonthStr,                /* Retorna "YYYY-MM" do mês */
		fmtBRL,                         /* Formata número: 78.9 → "78,90" */
		cardTotalWithRate,               /* Calcula preço com taxa de cartão */
		installmentText,                 /* Gera texto "3x de R$ XX no cartão" */
		getMillis,                      /* Converte timestamp Firebase para ms */
		formatDate,                     /* Formata timestamp para "DD/MM/YYYY às HH:MM" */
		formatDateStr,                  /* Formata string de data para exibição */
		fmtAgendamento,                 /* Formata data de agendamento */

		/* ── 4. Utilitários de campanha ────────────────────────────────── */
		normalizeCampaignStatus,         /* Normaliza status: "ativo" ou "inativo" */
		normalizeCampaignId,             /* Garante ID de campanha válido */
		normalizeCampaignName,           /* Garante nome de campanha válido */
		normalizeCampaignMode,           /* Garante modo válido (manual/auto/hybrid) */
		normalizeDateOnlyOrEmpty,        /* Normaliza data ou retorna vazio */
		normalizeCampaignPriority,       /* Garante prioridade numérica (-999 a 999) */
		toLocalDayStart,                 /* Converte data para 00:00:00 */
		toLocalDayEnd,                   /* Converte data para 23:59:59.999 */
		isCampaignAutoActiveNow,         /* Campanha automática está ativa? */
		getCampaignScheduleRange,         /* Retorna janela de datas em ms */
		buildCampaignScheduleConflicts,   /* Detecta campanhas com datas conflitantes */
		formatCampaignWindowLabel,        /* Texto legível da janela de datas */
		isFirestorePermissionDenied,      /* Verifica erro de permissão Firebase */
		slugifyCampaignId,               /* Converte nome em ID seguro (slug) */
		normalizeCampaignDoc,            /* Normaliza documento de campanha completo */
		campaignBadgeStyle,              /* Estilo visual do badge de campanha */
		normalizeThermalPrintMode,       /* Normaliza modo de impressão térmica */
		normalizeThermalPrintTicketMode, /* Normaliza modo de vias do cupom */
		normalizeThermalPrintSettings,   /* Normaliza todas as conf. de impressão térmica */
	};
})();
