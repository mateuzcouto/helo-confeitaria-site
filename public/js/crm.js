/* ═══════════════════════════════════════════════════════════════════════
   crm.js — MÓDULO DE CRM (RELACIONAMENTO COM CLIENTE) E AGENDA
   ═══════════════════════════════════════════════════════════════════════
   Este módulo contém funções utilitárias para o painel administrativo,
   focando em:

   1. Formatação de telefone para WhatsApp
   2. Normalização de data e hora (para agendamentos)
   3. Categorias e status de agendamentos (agenda do admin)
   4. Conversão entre status de pedido e status de agendamento
   5. Cores visuais para cada status (badges no painel)
   6. Formulário padrão de novo agendamento
   7. Notificações e alertas sonoros (salvos no localStorage)
   8. Processamento em lotes (batch) para operações assíncronas
   9. Detecção de pedidos duplicados (mesmo telefone em janela curta)

   Disponibilizado globalmente como window.HeloCrm.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloCrm = (() => {

	/* ── Importa utilitários do módulo central (app.js) ────────────────
	   safeText, getMillis, pad2, etc. já foram explicados em app.js. */
	const {
		safeText,
		getMillis,
		pad2,
		VISUAL_DUP_WINDOW,
		CAMPAIGN_GENERAL_ID,
		normalizeCampaignId,
		normalizeDateOnlyValue,
		getDateOnlyParts,
		toLocalDateFromDateOnly,
	} = window.HeloApp;

	/* ══════════════════════════════════════════════════════════════════
	   UTILITÁRIOS DE TELEFONE E DATA — Funções auxiliares simples
	   ══════════════════════════════════════════════════════════════════ */

	/* ── formatPhoneForWhatsApp: Formata telefone para link do WhatsApp
	   Recebe: phone (string) — número em qualquer formato
	   Retorna: string com código do país (ex: "5588981577625")
	   Remove tudo que não é dígito e adiciona "55" se necessário. */
	const formatPhoneForWhatsApp = (phone) => {
		const digits = safeText(phone).replace(/\D/g, '');
		if (!digits) return '';
		return digits.startsWith('55') ? digits : `55${digits}`;
	};

	/* ── getTodayStr: Retorna a data de hoje no formato "YYYY-MM-DD" ── */
	const getTodayStr = () => normalizeDateOnlyValue(new Date());

	/* ── normalizeTimeValue: Garante horário válido no formato "HH:MM"
	   Recebe: value (string) — horário como "9:30" ou "14:00"
	   Retorna: "09:30" ou "14:00" (sempre 2 dígitos)
	   Fallback: "09:00" se o valor for inválido. */
	const normalizeTimeValue = (value, fallback = '09:00') => {
		const raw = safeText(value, fallback).trim();
		const match = raw.match(/^(\d{1,2}):(\d{2})$/);
		if (!match) return fallback;
		const hours = Number(match[1]);
		const minutes = Number(match[2]);
		if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
			return fallback;
		}
		return `${pad2(hours)}:${pad2(minutes)}`;
	};

	/* ── combineDateTime: Junta data + hora em um objeto Date ──────────
	   Recebe: dateValue (string "YYYY-MM-DD") + timeValue (string "HH:MM")
	   Retorna: Date com a data e hora combinadas, ou null se inválido.
	   Usado para criar timestamps de agendamento. */
	const combineDateTime = (dateValue, timeValue = '09:00') => {
		const parts = getDateOnlyParts(dateValue);
		if (!parts) return null;
		const [hours, minutes] = normalizeTimeValue(timeValue).split(':').map(Number);
		return new Date(parts.year, parts.month - 1, parts.day, hours, minutes, 0, 0);
	};

	/* ── getDaysUntilDateOnlyValue: Dias até uma data ──────────────────
	   Recebe: dateValue (string "YYYY-MM-DD")
	   Retorna: número de dias até aquela data (negativo = já passou)
	   ou null se a data for inválida. */
	const getDaysUntilDateOnlyValue = (dateValue) => {
		const target = toLocalDateFromDateOnly(dateValue);
		if (!target) return null;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return Math.round((target - today) / (1000 * 60 * 60 * 24));
	};

	/* ══════════════════════════════════════════════════════════════════
	   CATEGORIAS E STATUS DE AGENDAMENTO — Definições do sistema
	   ══════════════════════════════════════════════════════════════════
	   A agenda do admin tem categorias (tipo de compromisso) e status
	   (andamento do compromisso). Esses são fixos no sistema.
	   ══════════════════════════════════════════════════════════════════ */

	/* ── ADMIN_SCHEDULE_CATEGORIES: Tipos de compromisso na agenda ─────
	   k = chave (salva no banco), l = rótulo (mostrado na tela) */
	const ADMIN_SCHEDULE_CATEGORIES = [
		{ k: 'pedido_manual', l: 'Pedido Manual' },
		{ k: 'producao', l: 'Produção' },
		{ k: 'entrega', l: 'Entrega' },
		{ k: 'cobranca', l: 'Cobrança' },
		{ k: 'outro', l: 'Outro' },
	];

	/* ── ADMIN_SCHEDULE_STATUSES: Status possíveis de um agendamento ── */
	const ADMIN_SCHEDULE_STATUSES = ['Agendado', 'Em produção', 'Aguardando retorno', 'Concluído', 'Cancelado'];

	/* ── adminScheduleCategoryLabel: Converte chave em rótulo legível ──
	   Ex: "producao" → "Produção". Se não encontrar, retorna "Outro". */
	const adminScheduleCategoryLabel = (key) => (ADMIN_SCHEDULE_CATEGORIES.find((item) => item.k === key) || { l: 'Outro' }).l;

	/* ══════════════════════════════════════════════════════════════════
	   CONVERSÃO ENTRE STATUS DE PEDIDO E AGENDAMENTO
	   ══════════════════════════════════════════════════════════════════
	   O sistema tem DUAS listas de status:
	   - Pedidos: Novo, Confirmado, Pago, Pronto, Concluído
	   - Agendamentos: Agendado, Em produção, Aguardando retorno, Concluído, Cancelado

	   As funções abaixo convertem entre elas, para quando um agendamento
	   vira pedido (ou vice-versa). Remove acentos para comparação.
	   ══════════════════════════════════════════════════════════════════ */

	/* ── normalizeSchedulePaymentToOrder: Converte pagamento para formato de pedido
	   Ex: "Pagamento via Pix" → "PIX", "Cartão de crédito" → "Cartão" */
	const normalizeSchedulePaymentToOrder = (value) => {
		const raw = safeText(value, 'A combinar').trim();
		const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
		if (normalized.includes('pix')) return 'PIX';
		if (normalized.includes('cartao') || normalized.includes('credito')) return 'Cartão';
		if (normalized.includes('dinheiro')) return 'Dinheiro';
		return raw || 'A combinar';
	};

	/* ── normalizeScheduleStatusToOrder: Status agendamento → status pedido ── */
	const normalizeScheduleStatusToOrder = (status) => {
		const normalized = safeText(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
		if (normalized === 'concluido') return 'Concluído';
		if (normalized === 'cancelado') return 'Novo';
		if (normalized === 'em producao') return 'Pronto';
		if (normalized === 'aguardando retorno') return 'Confirmado';
		return 'Confirmado';
	};

	/* ── normalizeOrderStatusToSchedule: Status pedido → status agendamento ── */
	const normalizeOrderStatusToSchedule = (status) => {
		const normalized = safeText(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
		if (normalized === 'concluido') return 'Concluído';
		if (normalized === 'pronto') return 'Em produção';
		if (normalized === 'pago' || normalized === 'confirmado') return 'Aguardando retorno';
		return 'Agendado';
	};

	/* ── adminScheduleStatusColor: Cor visual para cada status de agendamento
	   Retorna objeto com { background, color, borderColor } para estilizar
	   os badges no painel admin. Cada status tem uma cor diferente. */
	const adminScheduleStatusColor = (status) => ({
		'Agendado': { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' },
		'Em produção': { background: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' },
		'Aguardando retorno': { background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe' },
		'Concluído': { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' },
		'Cancelado': { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
	}[safeText(status, 'Agendado')] || { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' });

	/* ══════════════════════════════════════════════════════════════════
	   FORMULÁRIO PADRÃO DE AGENDAMENTO
	   ══════════════════════════════════════════════════════════════════
	   Cria um objeto "vazio" com todos os campos necessários para um novo
	   agendamento. Usado quando o admin clica em "Novo Agendamento".
	   Valores padrão: data de hoje, hora 09:00, status "Agendado".
	   ══════════════════════════════════════════════════════════════════ */
	const createAdminScheduleForm = (campaignId = CAMPAIGN_GENERAL_ID) => ({
		id: null,
		campaignId: normalizeCampaignId(campaignId, CAMPAIGN_GENERAL_ID),
		title: '',
		customerName: '',
		customerPhone: '',
		category: 'pedido_manual',
		date: getTodayStr(),
		time: '09:00',
		method: 'retirada',
		paymentMethod: 'A combinar',
		address: '',
		total: '',
		details: '',
		status: 'Agendado',
		notificationEnabled: true,
		linkedOrderId: '',
	});

	/* ══════════════════════════════════════════════════════════════════
	   NOTIFICAÇÕES E ALERTAS SONOROS — Salvos no localStorage
	   ══════════════════════════════════════════════════════════════════
	   O admin pode configurar alertas sonoros para quando chegam novos
	   pedidos. Essas configurações ficam salvas no navegador (localStorage),
	   não no Firebase. Assim cada dispositivo tem suas próprias configs.
	   ══════════════════════════════════════════════════════════════════ */

	/* ── Chaves do localStorage ──────────────────────────────────────── */
	const ADMIN_SCHEDULE_NOTIFICATION_KEY = 'helo_admin_schedule_notifications_v1';
	const ADMIN_SCHEDULE_ALERT_SETTINGS_KEY = 'helo_admin_schedule_alert_settings_v1';

	/* ── Configurações padrão de alerta ──────────────────────────────── */
	const DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS = { soundEnabled: true, volume: 0.75 };

	/* ── readAdminScheduleNotifications: Lê notificações do localStorage
	   Retorna: objeto com notificações, ou {} se não houver. */
	const readAdminScheduleNotifications = () => {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return {};
			const raw = window.localStorage.getItem(ADMIN_SCHEDULE_NOTIFICATION_KEY);
			if (!raw) return {};
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	};

	/* ── writeAdminScheduleNotifications: Salva notificações no localStorage */
	const writeAdminScheduleNotifications = (payload) => {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return;
			window.localStorage.setItem(ADMIN_SCHEDULE_NOTIFICATION_KEY, JSON.stringify(payload || {}));
		} catch {
			return;
		}
	};

	/* ── readAdminScheduleAlertSettings: Lê configurações de alerta sonoro
	   Retorna: { soundEnabled: boolean, volume: number (0.1 a 1.0) } */
	const readAdminScheduleAlertSettings = () => {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return { ...DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS };
			const raw = window.localStorage.getItem(ADMIN_SCHEDULE_ALERT_SETTINGS_KEY);
			if (!raw) return { ...DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS };
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS };
			return {
				soundEnabled: parsed.soundEnabled !== false,
				volume: Math.min(1, Math.max(0.1, Number(parsed.volume) || DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS.volume)),
			};
		} catch {
			return { ...DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS };
		}
	};

	/* ── writeAdminScheduleAlertSettings: Salva configurações de alerta
	   Garante que volume fica entre 0.1 e 1.0 e soundEnabled é boolean. */
	const writeAdminScheduleAlertSettings = (payload) => {
		try {
			if (typeof window === 'undefined' || !window.localStorage) return;
			window.localStorage.setItem(ADMIN_SCHEDULE_ALERT_SETTINGS_KEY, JSON.stringify({
				soundEnabled: payload?.soundEnabled !== false,
				volume: Math.min(1, Math.max(0.1, Number(payload?.volume) || DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS.volume)),
			}));
		} catch {
			return;
		}
	};

	/* ══════════════════════════════════════════════════════════════════
	   PROCESSAMENTO EM LOTES (BATCH) — Para operações assíncronas
	   ══════════════════════════════════════════════════════════════════
	   Quando precisamos fazer muitas operações assíncronas (ex: enviar
	   notificação para 50 clientes), não fazemos todas de uma vez — isso
	   pode sobrecarregar o servidor. Em vez disso, processamos em "lotes"
	   (batches) de N itens por vez.

	   Promise.allSettled: espera todas as promessas do lote terminarem
	   (seja com sucesso ou erro) antes de passar ao próximo lote.
	   ══════════════════════════════════════════════════════════════════ */
	const runAsyncInBatches = async (items, batchSize, worker) => {
		const list = Array.isArray(items) ? items : [];
		const size = Math.max(1, Number(batchSize) || 1);
		const results = [];
		for (let i = 0; i < list.length; i += size) {
			const chunk = list.slice(i, i + size);
			const chunkResults = await Promise.allSettled(chunk.map(worker));
			results.push(...chunkResults);
		}
		return results;
	};

	/* ══════════════════════════════════════════════════════════════════
	   CORES DE STATUS DE PEDIDO — Badges visuais no painel
	   ══════════════════════════════════════════════════════════════════
	   Cada status de pedido tem uma cor diferente para facilitar a
	   visualização rápida no painel admin:
	   - Novo       → Amarelo (pendente)
	   - Confirmado → Azul (confirmado)
	   - Pago       → Verde (pagamento ok)
	   - Pronto     → Roxo (pronto para entrega)
	   - Concluído  → Cinza (finalizado)
	   ══════════════════════════════════════════════════════════════════ */
	const statusColor = (status) => ({
		'Novo': 'background:#fef9c3;color:#a16207;border-color:#fef08a',
		'Confirmado': 'background:#dbeafe;color:#1d4ed8;border-color:#bfdbfe',
		'Pago': 'background:#dcfce7;color:#15803d;border-color:#bbf7d0',
		'Pronto': 'background:#f3e8ff;color:#7e22ce;border-color:#e9d5ff',
		'Concluído': 'background:#f1f5f9;color:#64748b;border-color:#e2e8f0',
	}[status] || 'background:#fef9c3;color:#a16207;border-color:#fef08a');

	/* ══════════════════════════════════════════════════════════════════
	   DETECÇÃO DE PEDIDOS DUPLICADOS
	   ══════════════════════════════════════════════════════════════════
	   Detecta pedidos do mesmo telefone criados em janela curta de tempo
	   (VISUAL_DUP_WINDOW = 10 minutos). Isso acontece quando o cliente
	   acidentalmente envia o pedido duas vezes.

	   Algoritmo:
	   1. Agrupa pedidos por telefone
	   2. Para cada grupo, compara todos os pares
	   3. Se a diferença de tempo < VISUAL_DUP_WINDOW → marca como dup
	   4. Retorna Set com os índices dos pedidos duplicados
	   ══════════════════════════════════════════════════════════════════ */
	function buildDuplicateSet(orders) {
		const byPhone = {};
		orders.forEach((order, index) => {
			const phone = safeText(order.customerPhone);
			if (!phone) return;
			(byPhone[phone] = byPhone[phone] || []).push({ i: index, ms: getMillis(order.createdAt) });
		});
		const set = new Set();
		Object.values(byPhone).forEach((arr) => {
			for (let a = 0; a < arr.length; a += 1) {
				for (let b = a + 1; b < arr.length; b += 1) {
					if (Math.abs(arr[a].ms - arr[b].ms) < VISUAL_DUP_WINDOW) {
						set.add(arr[a].i);
						set.add(arr[b].i);
					}
				}
			}
		});
		return set;
	}

	/* ══════════════════════════════════════════════════════════════════
	   EXPORTAÇÃO — Tudo que fica disponível via window.HeloCrm
	   ══════════════════════════════════════════════════════════════════ */
	return {
		formatPhoneForWhatsApp,
		getTodayStr,
		normalizeTimeValue,
		combineDateTime,
		getDaysUntilDateOnlyValue,
		ADMIN_SCHEDULE_CATEGORIES,
		ADMIN_SCHEDULE_STATUSES,
		adminScheduleCategoryLabel,
		normalizeSchedulePaymentToOrder,
		normalizeScheduleStatusToOrder,
		normalizeOrderStatusToSchedule,
		adminScheduleStatusColor,
		createAdminScheduleForm,
		ADMIN_SCHEDULE_NOTIFICATION_KEY,
		ADMIN_SCHEDULE_ALERT_SETTINGS_KEY,
		DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS,
		readAdminScheduleNotifications,
		writeAdminScheduleNotifications,
		readAdminScheduleAlertSettings,
		writeAdminScheduleAlertSettings,
		runAsyncInBatches,
		statusColor,
		buildDuplicateSet,
	};
})();
