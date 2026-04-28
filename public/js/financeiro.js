/* ═══════════════════════════════════════════════════════════════════════
   financeiro.js — MÓDULO FINANCEIRO (FLUXO DE CAIXA E INDICADORES)
   ═══════════════════════════════════════════════════════════════════════
   Este módulo gerencia toda a lógica financeira da confeitaria:

   1. FLUXO DE CAIXA — Entradas e saídas manuais (CRUD completo)
   2. INDICADORES FINANCEIROS — Bruto, recebido, pendente por período
   3. PEDIDOS PENDENTES — Lista de pedidos com saldo em aberto
   4. FECHAMENTO DIÁRIO — Consolidação automática de caixa por dia
   5. EXPORTAÇÃO CSV — Relatórios detalhados e mensais consolidados
   6. EDIÇÃO INLINE — Edição rápida de transações direto na tabela

   Cálculos de valor LÍQUIDO (sem frete e sem taxa de cartão):
   - netTotal = total - deliveryFee - cardFeeValue
   - settledNetAmount = valor líquido efetivamente recebido

   Disponibilizado globalmente como window.HeloFinance.
   Expõe o hook useFinanceDomain que centraliza todo o estado e lógica.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloFinance = (() => {
	const { useState, useEffect, useMemo, useCallback } = React;

	/* ── Importa utilitários dos módulos centrais ────────────────────── */
	const {
		getCol,
		safeText,
		normalizeCampaignId,
		normalizeDateOnlyValue,
		getLocalMonthStr,
		getDateOnlyParts,
		CAMPAIGN_GENERAL_ID,
		CAMPAIGN_LEGACY_ID,
	} = window.HeloApp;
	const { getTodayStr } = window.HeloCrm;

	/* ── safeMoney: Converte valor monetário para número seguro ────────
	   Recebe: value (qualquer tipo) — ex: "25,50", 100, null
	   Retorna: número (ex: 25.5) ou 0 se inválido
	   Converte vírgula brasileira para ponto decimal. */
	const safeMoney = (value) => {
		if (value === null || value === undefined || value === '') return 0;
		const n = Number(String(value).replace(',', '.'));
		return Number.isFinite(n) ? n : 0;
	};

	/* ══════════════════════════════════════════════════════════════════
	   CONSTANTES DO FLUXO DE CAIXA — Categorias, formas de pagamento e status
	   ══════════════════════════════════════════════════════════════════
	   Categorias são divididas em Entrada (dinheiro que entra) e Saída
	   (dinheiro que sai). Cada tipo tem categorias específicas.
	   ══════════════════════════════════════════════════════════════════ */
	const CASHFLOW_CATEGORIES = {
		Entrada: ['Vendas', 'Aporte de Sócios', 'Outros'],
		'Saída': [
			'Sangria de Caixa',
			'Serviços de Terceiros (TI/Desenvolvimento)',
			'Despesas Administrativas (Água, Luz, Internet)',
			'Pró-labore',
			'Outros',
		],
	};

	/* ── Formas de pagamento disponíveis no fluxo de caixa ───────────── */
	const CASHFLOW_PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto'];

	/* ── Status possíveis de uma transação financeira ────────────────── */
	const CASHFLOW_STATUS_OPTIONS = ['Pago', 'Pendente'];

	/* ══════════════════════════════════════════════════════════════════
	   useFinanceDomain — Hook principal do domínio financeiro
	   ══════════════════════════════════════════════════════════════════
	   Recebe:
	   - activeCampaignId: ID da campanha ativa no momento
	   - financialEntries: lista de transações do Firebase
	   - normalizedOrders: lista de pedidos já normalizados

	   Retorna: todo o estado e funções para gerenciar o financeiro.
	   ══════════════════════════════════════════════════════════════════ */
	function useFinanceDomain({ activeCampaignId, financialEntries, normalizedOrders }) {

		/* ════════════════════════════════════════════════════════════════
		   ESTADOS — Filtros, formulário e paginação
		   ════════════════════════════════════════════════════════════════ */

		/* ── Filtros de período (mês e dia) para indicadores financeiros ── */
		const [finMonth, setFinMonth] = useState((() => {
			const now = new Date();
			return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		})());
		const [finDay, setFinDay] = useState('');

		/* ── Filtro de campanha para o financeiro ──────────────────────── */
		const [financeCampaignFilter, setFinanceCampaignFilter] = useState(activeCampaignId || CAMPAIGN_GENERAL_ID);

		/* ── Formulário de nova transação no fluxo de caixa ──────────────
		   tipo: 'Entrada' ou 'Saída'
		   campaignId: campanha vinculada
		   categoria: subcategoria (ex: 'Vendas', 'Sangria de Caixa')
		   formaPagamento: PIX, Dinheiro, Cartão, etc.
		   status: 'Pago' ou 'Pendente'
		   dataTransacao: data da transação (YYYY-MM-DD)
		   valor: valor em reais
		   descricao: descrição livre */
		const [cashflowForm, setCashflowForm] = useState({
			id: null,
			tipo: 'Entrada',
			campaignId: activeCampaignId || CAMPAIGN_GENERAL_ID,
			categoria: '',
			formaPagamento: 'PIX',
			status: 'Pendente',
			dataTransacao: getTodayStr(),
			valor: '',
			descricao: '',
		});
		const [cashflowError, setCashflowError] = useState('');

		/* ── Filtros do fluxo de caixa ──────────────────────────────────── */
		const [cashflowStatusFilter, setCashflowStatusFilter] = useState('all');
		const [cashflowStartDate, setCashflowStartDate] = useState('');
		const [cashflowEndDate, setCashflowEndDate] = useState('');

		/* ── Fechamento diário de caixa ────────────────────────────────── */
		const [cashflowClosingDate, setCashflowClosingDate] = useState(getTodayStr());
		const [cashflowClosingIncludeOrders, setCashflowClosingIncludeOrders] = useState(true);

		/* ── Paginação da tabela de transações ──────────────────────────── */
		const [cashflowPage, setCashflowPage] = useState(1);
		const [cashflowPageSize, setCashflowPageSize] = useState(10);

		/* ── Edição inline (editar direto na tabela sem abrir formulário) ─ */
		const [cashflowInlineEditId, setCashflowInlineEditId] = useState('');
		const [cashflowInlineDraft, setCashflowInlineDraft] = useState(null);
		const [cashflowInlineSaving, setCashflowInlineSaving] = useState(false);

		/* ── Efeito: sincroniza filtro de campanha com a campanha ativa ────
		   Quando a campanha ativa muda, atualiza o filtro e o formulário. */
		useEffect(() => {
			const next = activeCampaignId || CAMPAIGN_GENERAL_ID;
			setFinanceCampaignFilter(next);
			setCashflowForm((prev) => ({ ...prev, campaignId: prev.campaignId || next }));
		}, [activeCampaignId]);

		/* ════════════════════════════════════════════════════════════════
		   NORMALIZAÇÃO E FILTRAGEM — Prepara os dados para exibição
		   ════════════════════════════════════════════════════════════════ */

		/* ── normalizedCashflowEntries: Transações normalizadas ──────────────
		   Limpa e padroniza cada transação (tipo, categoria, status, data).
		   Normaliza campaignId legado para o formato atual. */
		const normalizedCashflowEntries = useMemo(() => {
			const list = Array.isArray(financialEntries) ? financialEntries : [];
			return list.map((item) => ({
				...item,
				campaignId: normalizeCampaignId(item.campaignId, CAMPAIGN_LEGACY_ID),
				tipo: safeText(item.tipo, 'Entrada'),
				categoria: safeText(item.categoria, ''),
				formaPagamento: safeText(item.formaPagamento, ''),
				status: safeText(item.status, 'Pendente'),
				descricao: safeText(item.descricao, ''),
				dataTransacao: normalizeDateOnlyValue(item.dataTransacao, ''),
				valor: Number(item.valor || 0),
			}));
		}, [financialEntries]);

		/* ── filteredCashflowEntries: Transações filtradas e ordenadas ─────
		   Aplica filtros de campanha, status, data inicial e data final.
		   Ordena por data decrescente (mais recente primeiro). */
		const filteredCashflowEntries = useMemo(() => {
			const base = normalizedCashflowEntries.filter((item) => {
				if (financeCampaignFilter !== 'all' && normalizeCampaignId(item.campaignId, CAMPAIGN_LEGACY_ID) !== financeCampaignFilter) return false;
				if (cashflowStatusFilter !== 'all' && safeText(item.status) !== cashflowStatusFilter) return false;
				if (cashflowStartDate && safeText(item.dataTransacao) < cashflowStartDate) return false;
				if (cashflowEndDate && safeText(item.dataTransacao) > cashflowEndDate) return false;
				return true;
			});
			return [...base].sort((a, b) => {
				const byDate = safeText(b.dataTransacao).localeCompare(safeText(a.dataTransacao));
				if (byDate !== 0) return byDate;
				return safeText(b.id).localeCompare(safeText(a.id));
			});
		}, [normalizedCashflowEntries, financeCampaignFilter, cashflowStatusFilter, cashflowStartDate, cashflowEndDate]);

		/* ── Paginação — Calcula total de páginas e itens da página atual ── */
		const cashflowTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredCashflowEntries.length / cashflowPageSize)), [filteredCashflowEntries.length, cashflowPageSize]);

		const cashflowPaginatedEntries = useMemo(() => {
			const start = (cashflowPage - 1) * cashflowPageSize;
			return filteredCashflowEntries.slice(start, start + cashflowPageSize);
		}, [filteredCashflowEntries, cashflowPage, cashflowPageSize]);

		/* ── cashflowMonthlyConsolidated: Relatório mensal por categoria ────
		   Agrupa transações por mês|tipo|categoria e calcula:
		   - qtd: total de transações no grupo
		   - qtdPago: quantas estão com status "Pago"
		   - totalGeral: soma de todos os valores
		   - totalPago: soma dos valores pagos
		   Ordenado por mês → tipo → categoria. */
		const cashflowMonthlyConsolidated = useMemo(() => {
			const map = {};
			filteredCashflowEntries.forEach((item) => {
				const month = safeText(item.dataTransacao).slice(0, 7) || 'sem-mes';
				const tipo = safeText(item.tipo, 'Entrada');
				const categoria = safeText(item.categoria, 'Sem categoria');
				const key = `${month}|${tipo}|${categoria}`;
				if (!map[key]) {
					map[key] = { month, tipo, categoria, qtd: 0, qtdPago: 0, totalGeral: 0, totalPago: 0 };
				}
				const val = Number(item.valor || 0);
				map[key].qtd += 1;
				map[key].totalGeral += val;
				if (safeText(item.status) === 'Pago') {
					map[key].qtdPago += 1;
					map[key].totalPago += val;
				}
			});
			return Object.values(map).sort((a, b) => {
				const byMonth = a.month.localeCompare(b.month);
				if (byMonth !== 0) return byMonth;
				const byType = a.tipo.localeCompare(b.tipo);
				if (byType !== 0) return byType;
				return a.categoria.localeCompare(b.categoria);
			});
		}, [filteredCashflowEntries]);

		/* ── cashflowSummary: Resumo financeiro (só pagos) ──────────────────
		   Calcula totais das transações com status "Pago":
		   - entradas: soma de valores do tipo "Entrada"
		   - saidas: soma de valores do tipo "Saída"
		   - saldo: entradas - saídas */
		const cashflowSummary = useMemo(() => {
			const paid = filteredCashflowEntries.filter((item) => safeText(item.status) === 'Pago');
			const entradas = paid.filter((item) => safeText(item.tipo) === 'Entrada').reduce((acc, item) => acc + Number(item.valor || 0), 0);
			const saidas = paid.filter((item) => safeText(item.tipo) === 'Saída').reduce((acc, item) => acc + Number(item.valor || 0), 0);
			return { entradas, saidas, saldo: entradas - saidas };
		}, [filteredCashflowEntries]);

		/* ════════════════════════════════════════════════════════════════
		   FECHAMENTO DIÁRIO — Pré-visualização do caixa do dia
		   ════════════════════════════════════════════════════════════════
		   Mostra o que entrou e saiu num dia específico, incluindo
		   recebimentos de pedidos pagos naquele dia.

		   Cálculo de recebido de pedidos (VALOR LÍQUIDO):
		   - netTotal = total - deliveryFee - cardFeeValue
		   - Se o admin informou paidAmount manualmente, usa o menor
		     entre total e paidAmount como valor de liquidação
		   - settledNetAmount = liquidação - deliveryFee - cardFeeValue
		   - receivedNetAmount = mínimo entre netTotal e settledNetAmount
		   ════════════════════════════════════════════════════════════════ */
		const cashflowClosingPreview = useMemo(() => {
			if (!cashflowClosingDate) {
				return {
					entradas: 0,
					saidas: 0,
					saldo: 0,
					qtd: 0,
					recebidoPedidos: 0,
					qtdPedidosRecebidos: 0,
					saldoComPedidos: 0,
				};
			}
			const list = normalizedCashflowEntries.filter((item) => safeText(item.dataTransacao) === cashflowClosingDate && safeText(item.status) === 'Pago');
			const entradas = list.filter((item) => safeText(item.tipo) === 'Entrada').reduce((acc, item) => acc + Number(item.valor || 0), 0);
			const saidas = list.filter((item) => safeText(item.tipo) === 'Saída').reduce((acc, item) => acc + Number(item.valor || 0), 0);

			const paidStatuses = new Set(['Pago', 'Pronto', 'Concluído']);
			const campaignScopedOrders = normalizedOrders.filter((order) => {
				if (financeCampaignFilter === 'all') return true;
				return normalizeCampaignId(order.campaignId, CAMPAIGN_LEGACY_ID) === financeCampaignFilter;
			});

			const paidOrdersInDate = campaignScopedOrders.filter((order) => {
				const status = safeText(order.status, 'Novo');
				if (!paidStatuses.has(status)) return false;

				const source = order.paidAt || order.createdAt;
				let paidDate = null;
				try {
					if (source && typeof source.toDate === 'function') paidDate = source.toDate();
					else if (source && typeof source.seconds === 'number') paidDate = new Date(source.seconds * 1000);
				} catch {
					paidDate = null;
				}
				if (!paidDate) return false;
				const paidDateStr = normalizeDateOnlyValue(paidDate, '');
				return paidDateStr === cashflowClosingDate;
			});

			const recebidoPedidos = paidOrdersInDate.reduce((acc, order) => {
				const total = Number(order.total) || 0;
				const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
				const cardFeeValue = Math.max(0, Number(order.cardFeeValue || 0));
				const netTotal = Math.max(0, total - deliveryFee - cardFeeValue);
				const paidRaw = Number(order.paidAmount);
				const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
				const settledGrossAmount = hasManualPaid ? Math.min(total, paidRaw) : total;
				const settledNetAmount = Math.max(0, settledGrossAmount - deliveryFee - cardFeeValue);
				const receivedNetAmount = Math.min(netTotal, settledNetAmount);
				return acc + receivedNetAmount;
			}, 0);

			const saldo = entradas - saidas;
			return {
				entradas,
				saidas,
				saldo,
				qtd: list.length,
				recebidoPedidos,
				qtdPedidosRecebidos: paidOrdersInDate.length,
				saldoComPedidos: saldo + recebidoPedidos,
			};
		}, [normalizedCashflowEntries, cashflowClosingDate, normalizedOrders, financeCampaignFilter]);

		/* ════════════════════════════════════════════════════════════════
		   INDICADORES FINANCEIROS — Bruto, recebido e pendente por período
		   ════════════════════════════════════════════════════════════════
		   Calcula estatísticas dos pedidos filtrados por mês/dia:
		   - totalBruto: soma líquida dos pedidos criados no período
		   - totalRecebido: soma líquida dos pedidos pagos no período
		   - totalPendente: bruto - recebido (saldo em aberto)
		   - ordersCount: número de pedidos no período
		   - availableMonths/days: meses/dias com dados para o seletor

		   VALOR LÍQUIDO = total - frete - taxa de cartão
		   Isso representa o LUCRO REAL da confeitaria em cada pedido.
		   ════════════════════════════════════════════════════════════════ */
		const financialStats = useMemo(() => {
			const tsToDate = (ts) => {
				if (!ts) return null;
				try {
					return typeof ts.toDate === 'function' ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
				} catch {
					return null;
				}
			};
			const toMonthStr = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : null;
			const toDayStr = (date) => date ? String(date.getDate()).padStart(2, '0') : null;
			const paidStatuses = new Set(['Pago', 'Pronto', 'Concluído']);

			const campaignScopedOrders = normalizedOrders.filter((order) => {
				if (financeCampaignFilter === 'all') return true;
				return normalizeCampaignId(order.campaignId, CAMPAIGN_LEGACY_ID) === financeCampaignFilter;
			});

			const parsedOrders = campaignScopedOrders.map((order) => {
				const createdDate = tsToDate(order.createdAt);
				const effectivePaidDate = tsToDate(order.paidAt || order.createdAt);
				const total = Number(order.total) || 0;
				const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
				const cardFeeValue = Math.max(0, Number(order.cardFeeValue || 0));
				const netTotal = Math.max(0, total - deliveryFee - cardFeeValue);
				const status = safeText(order.status, 'Novo');
				const isPaidStatus = paidStatuses.has(status);
				const paidRaw = Number(order.paidAmount);
				const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
				const settledGrossAmount = isPaidStatus ? (hasManualPaid ? Math.min(total, paidRaw) : total) : 0;
				const settledNetAmount = Math.min(netTotal, Math.max(0, settledGrossAmount - deliveryFee - cardFeeValue));
				return { createdDate, effectivePaidDate, netTotal, settledNetAmount, isPaidStatus };
			});

			const availableMonths = Array.from(new Set(parsedOrders.flatMap((order) => {
				const months = [];
				const createdMonth = toMonthStr(order.createdDate);
				if (createdMonth) months.push(createdMonth);
				if (order.isPaidStatus) {
					const paidMonth = toMonthStr(order.effectivePaidDate);
					if (paidMonth) months.push(paidMonth);
				}
				return months;
			}))).sort().reverse();
			const currentMonth = getLocalMonthStr();
			if (!availableMonths.includes(currentMonth)) availableMonths.unshift(currentMonth);

			const isInPeriod = (date) => {
				if (!date) return false;
				if (finMonth !== 'all' && toMonthStr(date) !== finMonth) return false;
				if (finDay && toDayStr(date) !== finDay) return false;
				return true;
			};

			const availableDays = finMonth === 'all'
				? []
				: Array.from(new Set(parsedOrders.flatMap((order) => {
					const days = [];
					if (toMonthStr(order.createdDate) === finMonth) days.push(toDayStr(order.createdDate));
					if (order.isPaidStatus && toMonthStr(order.effectivePaidDate) === finMonth) days.push(toDayStr(order.effectivePaidDate));
					return days;
				}).filter(Boolean))).sort();

			const createdInPeriod = parsedOrders.filter((order) => isInPeriod(order.createdDate));
			let totalBruto = 0;
			let totalPendente = 0;
			let ordersCount = 0;
			createdInPeriod.forEach((order) => {
				ordersCount += 1;
				totalBruto += order.netTotal;
				totalPendente += Math.max(0, order.netTotal - order.settledNetAmount);
			});

			const totalRecebido = parsedOrders.reduce((acc, order) => {
				if (!order.isPaidStatus) return acc;
				if (!isInPeriod(order.effectivePaidDate)) return acc;
				return acc + order.settledNetAmount;
			}, 0);

			const periodLabel = finMonth === 'all' ? 'Todos os meses' : `${finMonth.split('-')[1]}/${finMonth.split('-')[0]}${finDay ? ` • Dia ${finDay}` : ''}`;
			return { totalRecebido, totalPendente, totalBruto, ordersCount, availableMonths, availableDays, periodLabel };
		}, [normalizedOrders, financeCampaignFilter, finMonth, finDay]);

		/* ── financePendingOrders: Pedidos com saldo pendente ──────────────
		   Filtra pedidos do período que ainda têm valor a receber.
		   Calcula para cada pedido:
		   - _netTotal: valor líquido (sem frete e taxa de cartão)
		   - _paid: valor líquido já recebido
		   - _pending: valor líquido pendente (netTotal - paid)
		   Só inclui pedidos com pendente > R$ 0,005 (meio centavo).
		   Ordenado do maior pendente para o menor. */
		const financePendingOrders = useMemo(() => {
			const scoped = normalizedOrders.filter((order) => {
				if (financeCampaignFilter !== 'all' && normalizeCampaignId(order.campaignId, CAMPAIGN_LEGACY_ID) !== financeCampaignFilter) return false;
				if (!order.createdAt) return false;
				const created = typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate() : (order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : null);
				if (!created) return false;
				const orderMonth = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
				if (finMonth !== 'all' && orderMonth !== finMonth) return false;
				if (finMonth !== 'all' && finDay && String(created.getDate()).padStart(2, '0') !== finDay) return false;
				return true;
			});

			return scoped.map((order) => {
				const total = Number(order.total) || 0;
				const deliveryFee = Math.max(0, Number(order.deliveryFee || 0));
				const cardFeeValue = Math.max(0, Number(order.cardFeeValue || 0));
				const netTotal = Math.max(0, total - deliveryFee - cardFeeValue);
				const status = safeText(order.status, 'Novo');
				const paidRaw = Number(order.paidAmount);
				const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
				const paidDefault = ['Pago', 'Pronto', 'Concluído'].includes(status) ? total : 0;
				const paidGross = hasManualPaid ? Math.min(total, paidRaw) : paidDefault;
				const paidNet = Math.min(netTotal, Math.max(0, paidGross - deliveryFee - cardFeeValue));
				const pending = Math.max(0, netTotal - paidNet);
				return { ...order, _paid: paidNet, _pending: pending, _netTotal: netTotal };
			}).filter((order) => order._pending > 0.005).sort((a, b) => b._pending - a._pending);
		}, [normalizedOrders, financeCampaignFilter, finMonth, finDay]);

		/* ════════════════════════════════════════════════════════════════
		   EFEITOS DE SINCRONIZAÇÃO — Reset automático ao mudar filtros
		   ════════════════════════════════════════════════════════════════ */

		/* ── Reseta paginação e edição inline ao mudar filtros ──────────── */
		useEffect(() => {
			setCashflowPage(1);
			setCashflowInlineEditId('');
			setCashflowInlineDraft(null);
		}, [cashflowStatusFilter, cashflowStartDate, cashflowEndDate, cashflowPageSize]);

		/* ── Corrige página se ultrapassar o total ──────────────────────── */
		useEffect(() => {
			if (cashflowPage > cashflowTotalPages) setCashflowPage(cashflowTotalPages);
		}, [cashflowPage, cashflowTotalPages]);

		/* ── Reseta dia se não existir no mês selecionado ────────────────── */
		useEffect(() => {
			if (finMonth === 'all') {
				if (finDay) setFinDay('');
				return;
			}
			if (finDay && !financialStats.availableDays.includes(finDay)) setFinDay('');
		}, [finMonth, finDay, financialStats.availableDays]);

		/* ════════════════════════════════════════════════════════════════
		   OPERAÇÕES DE FORMULÁRIO — CRUD de transações financeiras
		   ════════════════════════════════════════════════════════════════ */

		/* ── resetCashflowForm: Limpa formulário para nova transação ──────── */
		const resetCashflowForm = useCallback(() => {
			setCashflowForm({
				id: null,
				tipo: 'Entrada',
				campaignId: activeCampaignId || CAMPAIGN_GENERAL_ID,
				categoria: '',
				formaPagamento: 'PIX',
				status: 'Pendente',
				dataTransacao: getTodayStr(),
				valor: '',
				descricao: '',
			});
			setCashflowError('');
		}, [activeCampaignId]);

		/* ── validateCashflowPayload: Valida dados de uma transação ────────
		   Verifica tipo, campanha, categoria, forma de pagamento, status,
		   data, descrição (mínimo 3 chars) e valor (> 0).
		   Retorna string de erro ou null se válido. */
		const validateCashflowPayload = useCallback((payload) => {
			const tipo = safeText(payload.tipo);
			const campaignId = normalizeCampaignId(payload.campaignId, '');
			const categoria = safeText(payload.categoria);
			const status = safeText(payload.status);
			const forma = safeText(payload.formaPagamento);
			const data = normalizeDateOnlyValue(payload.dataTransacao, '');
			const desc = safeText(payload.descricao).trim();
			const valor = safeMoney(payload.valor);
			const validCategories = CASHFLOW_CATEGORIES[tipo] || [];

			if (!tipo || !['Entrada', 'Saída'].includes(tipo)) return 'Selecione um tipo válido.';
			if (!campaignId) return 'Selecione uma campanha válida.';
			if (!categoria || !validCategories.includes(categoria)) return 'Selecione uma categoria válida para o tipo escolhido.';
			if (!forma) return 'Selecione a forma de pagamento.';
			if (!status || !CASHFLOW_STATUS_OPTIONS.includes(status)) return 'Selecione o status da transação.';
			if (!data) return 'Informe uma data válida para a transação.';
			if (!desc || desc.length < 3) return 'Descrição deve ter pelo menos 3 caracteres.';
			if (!Number.isFinite(valor) || valor <= 0) return 'Informe um valor positivo maior que zero.';
			return null;
		}, []);

		/* ── validateCashflowForm: Valida formulário atual ─────────────────── */
		const validateCashflowForm = useCallback(() => validateCashflowPayload(cashflowForm), [cashflowForm, validateCashflowPayload]);

		/* ── saveCashflowEntry: Salva transação (criar ou atualizar) no Firebase
		   Se cashflowForm.id existe → atualiza (update)
		   Se não → cria novo documento (add)
		   Campos salvos: tipo, campaignId, categoria, formaPagamento,
		   status, dataTransacao, valor, descricao, updatedAt */
		const saveCashflowEntry = useCallback(async () => {
			const err = validateCashflowForm();
			if (err) {
				setCashflowError(err);
				return;
			}
			const dataTransacao = normalizeDateOnlyValue(cashflowForm.dataTransacao, '');
			const payload = {
				tipo: safeText(cashflowForm.tipo),
				campaignId: normalizeCampaignId(cashflowForm.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
				categoria: safeText(cashflowForm.categoria),
				formaPagamento: safeText(cashflowForm.formaPagamento),
				status: safeText(cashflowForm.status),
				dataTransacao,
				valor: safeMoney(cashflowForm.valor),
				descricao: safeText(cashflowForm.descricao).trim(),
				updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
			};
			try {
				if (cashflowForm.id) {
					await getCol('financeiro').doc(cashflowForm.id).update(payload);
					alert('Transação atualizada com sucesso!');
				} else {
					await getCol('financeiro').add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
					alert('Transação registrada com sucesso!');
				}
				resetCashflowForm();
			} catch (error) {
				console.error('Erro ao salvar transação:', error);
				setCashflowError('Não foi possível salvar a transação. Tente novamente.');
			}
		}, [cashflowForm, validateCashflowForm, activeCampaignId, resetCashflowForm]);

		/* ── editCashflowEntry: Carrega transação no formulário para edição ── */
		const editCashflowEntry = useCallback((entry) => {
			setCashflowForm({
				id: entry.id,
				tipo: safeText(entry.tipo, 'Entrada'),
				campaignId: normalizeCampaignId(entry.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
				categoria: safeText(entry.categoria, ''),
				formaPagamento: safeText(entry.formaPagamento, 'PIX'),
				status: safeText(entry.status, 'Pendente'),
				dataTransacao: normalizeDateOnlyValue(entry.dataTransacao, getTodayStr()),
				valor: Number(entry.valor || 0),
				descricao: safeText(entry.descricao, ''),
			});
			setCashflowError('');
		}, [activeCampaignId]);

		/* ── deleteCashflowEntry: Exclui transação do Firebase ──────────────
		   Pede confirmação antes de excluir. */
		const deleteCashflowEntry = useCallback(async (id) => {
			if (!id) return;
			if (!confirm('Deseja realmente excluir esta transação?')) return;
			try {
				await getCol('financeiro').doc(id).delete();
			} catch (error) {
				console.error('Erro ao excluir transação:', error);
				alert('Não foi possível excluir a transação.');
			}
		}, []);

		/* ════════════════════════════════════════════════════════════════
		   EDIÇÃO INLINE — Editar transação direto na tabela
		   ════════════════════════════════════════════════════════════════
		   Permite editar uma transação sem abrir o formulário completo.
		   O usuário clica na linha, os campos viram editáveis,
		   e ao salvar, atualiza direto no Firebase.
		   ════════════════════════════════════════════════════════════════ */

		/* ── startInlineCashflowEdit: Inicia edição inline de uma transação ── */
		const startInlineCashflowEdit = useCallback((entry) => {
			setCashflowInlineEditId(entry.id);
			setCashflowInlineDraft({
				id: entry.id,
				tipo: safeText(entry.tipo, 'Entrada'),
				campaignId: normalizeCampaignId(entry.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
				categoria: safeText(entry.categoria, ''),
				formaPagamento: safeText(entry.formaPagamento, 'PIX'),
				status: safeText(entry.status, 'Pendente'),
				dataTransacao: normalizeDateOnlyValue(entry.dataTransacao, getTodayStr()),
				valor: Number(entry.valor || 0),
				descricao: safeText(entry.descricao, ''),
			});
			setCashflowError('');
		}, [activeCampaignId]);

		/* ── cancelInlineCashflowEdit: Cancela edição inline ───────────────── */
		const cancelInlineCashflowEdit = useCallback(() => {
			setCashflowInlineEditId('');
			setCashflowInlineDraft(null);
			setCashflowError('');
		}, []);

		/* ── updateInlineCashflowDraft: Atualiza campo do rascunho inline ────
		   Se mudar o tipo (Entrada/Saída), reseta a categoria se ela
		   não pertencer ao novo tipo. */
		const updateInlineCashflowDraft = useCallback((field, value) => {
			setCashflowInlineDraft((prev) => {
				if (!prev) return prev;
				const next = { ...prev, [field]: value };
				if (field === 'tipo') {
					const allowed = CASHFLOW_CATEGORIES[value] || [];
					if (!allowed.includes(next.categoria)) next.categoria = '';
				}
				return next;
			});
		}, []);

		/* ── saveInlineCashflowEdit: Salva edição inline no Firebase ──────── */
		const saveInlineCashflowEdit = useCallback(async () => {
			if (!cashflowInlineDraft?.id) return;
			const err = validateCashflowPayload(cashflowInlineDraft);
			if (err) {
				setCashflowError(err);
				return;
			}
			setCashflowInlineSaving(true);
			try {
				const dataTransacao = normalizeDateOnlyValue(cashflowInlineDraft.dataTransacao, '');
				await getCol('financeiro').doc(cashflowInlineDraft.id).update({
					tipo: safeText(cashflowInlineDraft.tipo),
					campaignId: normalizeCampaignId(cashflowInlineDraft.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
					categoria: safeText(cashflowInlineDraft.categoria),
					formaPagamento: safeText(cashflowInlineDraft.formaPagamento),
					status: safeText(cashflowInlineDraft.status),
					dataTransacao,
					valor: safeMoney(cashflowInlineDraft.valor),
					descricao: safeText(cashflowInlineDraft.descricao).trim(),
					updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
				});
				cancelInlineCashflowEdit();
			} catch (error) {
				console.error('Erro ao salvar edição inline:', error);
				setCashflowError('Não foi possível salvar a edição inline.');
			} finally {
				setCashflowInlineSaving(false);
			}
		}, [cashflowInlineDraft, validateCashflowPayload, activeCampaignId, cancelInlineCashflowEdit]);

		/* ════════════════════════════════════════════════════════════════
		   EXPORTAÇÃO CSV — Gera arquivos para download
		   ════════════════════════════════════════════════════════════════
		   Gera arquivos CSV com separador ';' (padrão brasileiro/Excel).
		   BOM (\ufeff) no início para que o Excel reconheça UTF-8.
		   ════════════════════════════════════════════════════════════════ */

		/* ── exportCashflowCsv: Exporta transações filtradas para CSV ────────
		   Colunas: Data, Tipo, Descrição, Categoria, FormaPagamento, Status, Valor */
		const exportCashflowCsv = useCallback(() => {
			if (!filteredCashflowEntries.length) {
				alert('Não há transações para exportar neste filtro.');
				return;
			}
			const headers = ['Data', 'Tipo', 'Descricao', 'Categoria', 'FormaPagamento', 'Status', 'Valor'];
			const lines = filteredCashflowEntries.map((item) => {
				const cols = [
					safeText(item.dataTransacao),
					safeText(item.tipo),
					safeText(item.descricao).replaceAll('"', '""'),
					safeText(item.categoria).replaceAll('"', '""'),
					safeText(item.formaPagamento),
					safeText(item.status),
					Number(item.valor || 0).toFixed(2),
				];
				return cols.map((col) => `"${String(col)}"`).join(';');
			});
			const csv = [headers.join(';'), ...lines].join('\n');
			const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `financeiro_${getTodayStr()}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, [filteredCashflowEntries]);

		/* ── exportCashflowMonthlyConsolidatedCsv: Exporta consolidado mensal ──
		   Colunas: Mês, Tipo, Categoria, QtdTransações, QtdPagas, TotalPago, TotalGeral */
		const exportCashflowMonthlyConsolidatedCsv = useCallback(() => {
			if (!cashflowMonthlyConsolidated.length) {
				alert('Não há dados para gerar relatório mensal consolidado neste filtro.');
				return;
			}
			const headers = ['Mes', 'Tipo', 'Categoria', 'QtdTransacoes', 'QtdPagas', 'TotalPago', 'TotalGeral'];
			const lines = cashflowMonthlyConsolidated.map((row) => [
				row.month,
				row.tipo,
				String(row.categoria).replaceAll('"', '""'),
				String(row.qtd),
				String(row.qtdPago),
				Number(row.totalPago || 0).toFixed(2),
				Number(row.totalGeral || 0).toFixed(2),
			].map((col) => `"${String(col)}"`).join(';'));
			const csv = [headers.join(';'), ...lines].join('\n');
			const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `financeiro_consolidado_mes_categoria_${getTodayStr()}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, [cashflowMonthlyConsolidated]);

		/* ════════════════════════════════════════════════════════════════
		   FECHAMENTO DIÁRIO DE CAIXA
		   ════════════════════════════════════════════════════════════════
		   Consolida todas as entradas e saídas pagas de um dia específico,
		   mais os recebimentos de pedidos pagos naquele dia (se habilitado).

		   Salva na coleção "fechamentos_caixa" do Firebase com:
		   - data, campaignId, entradasOperacionais, recebidoPedidos
		   - entradas totais, saídas, saldo, quantidades
		   ════════════════════════════════════════════════════════════════ */
		const closeDailyCashflow = useCallback(async () => {
			if (!cashflowClosingDate) return alert('Selecione uma data para fechamento.');
			const base = normalizedCashflowEntries.filter((item) => safeText(item.dataTransacao) === cashflowClosingDate && safeText(item.status) === 'Pago');
			const entradasBase = base.filter((item) => safeText(item.tipo) === 'Entrada').reduce((acc, item) => acc + Number(item.valor || 0), 0);
			const saidas = base.filter((item) => safeText(item.tipo) === 'Saída').reduce((acc, item) => acc + Number(item.valor || 0), 0);
			const recebidoPedidos = cashflowClosingIncludeOrders ? Number(cashflowClosingPreview.recebidoPedidos || 0) : 0;
			const entradas = entradasBase + recebidoPedidos;
			const saldo = entradas - saidas;
			const receivedLabel = cashflowClosingIncludeOrders
				? `\nRecebido em pedidos (automático): R$ ${recebidoPedidos.toFixed(2)}`
				: '\nRecebido em pedidos (automático): NÃO INCLUÍDO';
			if (!confirm(`Gerar fechamento diário de ${cashflowClosingDate}?\nEntradas operacionais: R$ ${entradasBase.toFixed(2)}${receivedLabel}\nEntradas totais: R$ ${entradas.toFixed(2)}\nSaídas: R$ ${saidas.toFixed(2)}\nSaldo: R$ ${saldo.toFixed(2)}`)) return;
			try {
				await getCol('fechamentos_caixa').add({
					data: cashflowClosingDate,
					campaignId: financeCampaignFilter === 'all' ? 'all' : normalizeCampaignId(financeCampaignFilter, CAMPAIGN_LEGACY_ID),
					entradasOperacionais: entradasBase,
					recebidoPedidosAutomatico: recebidoPedidos,
					incluiuRecebidoPedidosAutomatico: cashflowClosingIncludeOrders === true,
					entradas,
					saidas,
					saldo,
					transacoesPagas: base.length,
					pedidosRecebidosQtd: cashflowClosingIncludeOrders ? Number(cashflowClosingPreview.qtdPedidosRecebidos || 0) : 0,
					createdAt: firebase.firestore.FieldValue.serverTimestamp(),
				});
				alert('Fechamento diário salvo com sucesso!');
			} catch (error) {
				console.error('Erro ao salvar fechamento diário:', error);
				alert('Não foi possível salvar o fechamento diário.');
			}
		}, [cashflowClosingDate, normalizedCashflowEntries, cashflowClosingIncludeOrders, cashflowClosingPreview, financeCampaignFilter]);

		/* ════════════════════════════════════════════════════════════════
		   EXPORTAÇÃO — Tudo que o hook retorna para a interface usar
		   ════════════════════════════════════════════════════════════════ */
		return {
			safeMoney,
			cashflowCategories: CASHFLOW_CATEGORIES,
			cashflowPaymentMethods: CASHFLOW_PAYMENT_METHODS,
			cashflowStatusOptions: CASHFLOW_STATUS_OPTIONS,
			finMonth,
			setFinMonth,
			finDay,
			setFinDay,
			financeCampaignFilter,
			setFinanceCampaignFilter,
			cashflowForm,
			setCashflowForm,
			cashflowError,
			setCashflowError,
			cashflowStatusFilter,
			setCashflowStatusFilter,
			cashflowStartDate,
			setCashflowStartDate,
			cashflowEndDate,
			setCashflowEndDate,
			cashflowClosingDate,
			setCashflowClosingDate,
			cashflowClosingIncludeOrders,
			setCashflowClosingIncludeOrders,
			cashflowPage,
			setCashflowPage,
			cashflowPageSize,
			setCashflowPageSize,
			cashflowInlineEditId,
			cashflowInlineDraft,
			cashflowInlineSaving,
			normalizedCashflowEntries,
			filteredCashflowEntries,
			cashflowTotalPages,
			cashflowPaginatedEntries,
			cashflowMonthlyConsolidated,
			cashflowSummary,
			cashflowClosingPreview,
			financialStats,
			financePendingOrders,
			resetCashflowForm,
			validateCashflowPayload,
			validateCashflowForm,
			saveCashflowEntry,
			editCashflowEntry,
			deleteCashflowEntry,
			startInlineCashflowEdit,
			cancelInlineCashflowEdit,
			updateInlineCashflowDraft,
			saveInlineCashflowEdit,
			exportCashflowCsv,
			exportCashflowMonthlyConsolidatedCsv,
			closeDailyCashflow,
		};
	}

	/* ── Exporta o hook e safeMoney no namespace global ──────────────── */
	return {
		safeMoney,
		useFinanceDomain,
	};
})();
