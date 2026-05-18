/* ═══════════════════════════════════════════════════════════════════════
   client-ranking.js — RANKING DE MELHOR CLIENTE POR PERÍODO
   ═══════════════════════════════════════════════════════════════════════
   Motor puro (sem Firestore) para agregar pedidos por telefone e ranquear
   por valor total (R$) ou quantidade de pedidos.

   Períodos: hoje | semana (civil) | mes (civil) | rolling7 | rolling30
   Fuso de referência: America/Fortaleza (sem horário de verão).

   Disponível globalmente como window.HeloClientRanking.
   @update 2026-05-18 — Ranking por dia/semana/mês para aba Top Clientes.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloClientRanking = (() => {
    const FUSO_PADRAO = 'America/Fortaleza';
    const MS_DIA = 86400000;
    const LIMITE_PEDIDOS_RANKING = 3000;

    const STATUS_ELEGIVEIS_RANKING = new Set(['Pago', 'Pronto', 'Concluído']);

    const TIPOS_PERIODO = ['hoje', 'semana', 'mes', 'rolling7', 'rolling30'];

    /**
     * Extrai partes de data/hora no fuso informado.
     *
     * @param {number} millis - Instantâneo UTC em milissegundos
     * @param {string} [timeZone=FUSO_PADRAO] - IANA time zone
     * @returns {{ year: number, month: number, day: number, weekday: number }}
     *   weekday: 0=domingo … 6=sábado (convenção JS)
     */
    const obterPartesNoFuso = (millis, timeZone = FUSO_PADRAO) => {
        const formatador = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
        });
        const mapa = {};
        formatador.formatToParts(new Date(millis)).forEach((parte) => {
            if (parte.type !== 'literal') mapa[parte.type] = parte.value;
        });
        const mapaDiaSemana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        return {
            year: Number(mapa.year),
            month: Number(mapa.month),
            day: Number(mapa.day),
            weekday: mapaDiaSemana[mapa.weekday] ?? 0,
        };
    };

    /**
     * Converte meia-noite civil (y-m-d) em Fortaleza para millis UTC.
     * Fortaleza opera em UTC−3 fixo (sem DST desde 2013).
     *
     * @param {number} ano
     * @param {number} mes - 1..12
     * @param {number} dia - 1..31
     * @returns {number} millis UTC do início do dia em Fortaleza
     */
    const meiaNoiteFortalezaParaUtcMs = (ano, mes, dia) => (
        Date.UTC(ano, mes - 1, dia, 3, 0, 0, 0)
    );

    /**
     * Formata intervalo para rótulo na UI (dd/mm/aaaa).
     *
     * @param {number} millis
     * @param {string} [timeZone]
     * @returns {string}
     */
    const formatarDataRotulo = (millis, timeZone = FUSO_PADRAO) => {
        return new Intl.DateTimeFormat('pt-BR', {
            timeZone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(new Date(millis));
    };

    /**
     * Calcula início/fim e rótulo legível de um período de ranking.
     *
     * @param {'hoje'|'semana'|'mes'|'rolling7'|'rolling30'} tipo
     * @param {number} [dataRefMs=Date.now()] - Referência “agora”
     * @param {string} [timeZone=FUSO_PADRAO]
     * @returns {{ inicioMs: number, fimMs: number, rotulo: string, tipo: string }}
     */
    const calcularLimitesPeriodo = (tipo, dataRefMs = Date.now(), timeZone = FUSO_PADRAO) => {
        const fimMs = dataRefMs;
        const partes = obterPartesNoFuso(dataRefMs, timeZone);

        if (tipo === 'rolling7') {
            const inicioMs = fimMs - (7 * MS_DIA);
            return {
                tipo,
                inicioMs,
                fimMs,
                rotulo: `Últimos 7 dias (até ${formatarDataRotulo(fimMs, timeZone)})`,
            };
        }

        if (tipo === 'rolling30') {
            const inicioMs = fimMs - (30 * MS_DIA);
            return {
                tipo,
                inicioMs,
                fimMs,
                rotulo: `Últimos 30 dias (até ${formatarDataRotulo(fimMs, timeZone)})`,
            };
        }

        if (tipo === 'hoje') {
            const inicioMs = meiaNoiteFortalezaParaUtcMs(partes.year, partes.month, partes.day);
            return {
                tipo,
                inicioMs,
                fimMs,
                rotulo: `Hoje — ${formatarDataRotulo(inicioMs, timeZone)} (Fortaleza)`,
            };
        }

        if (tipo === 'semana') {
            const diasDesdeSegunda = partes.weekday === 0 ? 6 : partes.weekday - 1;
            const inicioDiaSemanaMs = meiaNoiteFortalezaParaUtcMs(partes.year, partes.month, partes.day)
                - (diasDesdeSegunda * MS_DIA);
            const partesInicio = obterPartesNoFuso(inicioDiaSemanaMs, timeZone);
            const inicioMs = meiaNoiteFortalezaParaUtcMs(
                partesInicio.year,
                partesInicio.month,
                partesInicio.day
            );
            return {
                tipo,
                inicioMs,
                fimMs,
                rotulo: `Semana ${formatarDataRotulo(inicioMs, timeZone)} – ${formatarDataRotulo(fimMs, timeZone)} (Fortaleza)`,
            };
        }

        if (tipo === 'mes') {
            const inicioMs = meiaNoiteFortalezaParaUtcMs(partes.year, partes.month, 1);
            const rotuloMes = new Intl.DateTimeFormat('pt-BR', {
                timeZone,
                month: 'long',
                year: 'numeric',
            }).format(new Date(inicioMs));
            return {
                tipo,
                inicioMs,
                fimMs,
                rotulo: `${rotuloMes.charAt(0).toUpperCase()}${rotuloMes.slice(1)} (Fortaleza)`,
            };
        }

        return {
            tipo: 'rolling30',
            inicioMs: fimMs - (30 * MS_DIA),
            fimMs,
            rotulo: `Últimos 30 dias (até ${formatarDataRotulo(fimMs, timeZone)})`,
        };
    };

    /**
     * Início da janela única de consulta Firestore (mais antiga entre mês civil e rolling 30).
     *
     * @param {number} [dataRefMs=Date.now()]
     * @param {string} [timeZone]
     * @returns {number} millis UTC para `createdAt >=`
     */
    const calcularInicioJanelaConsulta = (dataRefMs = Date.now(), timeZone = FUSO_PADRAO) => {
        const mes = calcularLimitesPeriodo('mes', dataRefMs, timeZone);
        const rolling30 = calcularLimitesPeriodo('rolling30', dataRefMs, timeZone);
        return Math.min(mes.inicioMs, rolling30.inicioMs);
    };

    /**
     * Normaliza telefone para chave de agrupamento (últimos 8 dígitos).
     *
     * @param {*} telefone
     * @returns {{ chave: string, telefoneCompleto: string }|null}
     */
    const normalizarChaveClienteTelefone = (telefone) => {
        const apenasDigitos = String(telefone || '').replace(/\D/g, '');
        if (apenasDigitos.length < 8) return null;
        return {
            chave: apenasDigitos.slice(-8),
            telefoneCompleto: apenasDigitos,
        };
    };

    /**
     * Extrai millis de createdAt (Timestamp Firestore ou objeto .seconds).
     *
     * @param {*} pedido
     * @returns {number}
     */
    const extrairMillisPedido = (pedido) => {
        const createdAt = pedido?.createdAt;
        if (typeof createdAt?.toDate === 'function') {
            return createdAt.toDate().getTime();
        }
        if (createdAt && typeof createdAt.seconds === 'number') {
            return createdAt.seconds * 1000;
        }
        return 0;
    };

    /**
     * Verifica se o pedido entra no ranking (status pago + telefone válido).
     *
     * @param {Object} pedido
     * @param {function} [safeTextFn] - normalizador de texto (opcional)
     * @returns {boolean}
     */
    const pedidoElegivelParaRanking = (pedido, safeTextFn = (v) => String(v ?? '').trim()) => {
        const status = safeTextFn(pedido?.status);
        if (!STATUS_ELEGIVEIS_RANKING.has(status)) return false;
        return Boolean(normalizarChaveClienteTelefone(pedido?.customerPhone));
    };

    /**
     * Agrega pedidos elegíveis dentro de [inicioMs, fimMs] por cliente.
     *
     * @param {Object[]} pedidos
     * @param {{ inicioMs: number, fimMs: number }} limites
     * @param {function} [safeTextFn]
     * @returns {Map<string, { phone: string, names: Set<string>, totalSpent: number, orderCount: number, unitsCount: number }>}
     */
    const agregarPedidosPorCliente = (pedidos, limites, safeTextFn = (v) => String(v ?? '').trim()) => {
        const mapa = new Map();
        const lista = Array.isArray(pedidos) ? pedidos : [];
        const { inicioMs, fimMs } = limites || {};

        lista.forEach((pedido) => {
            if (!pedidoElegivelParaRanking(pedido, safeTextFn)) return;

            const createdMs = extrairMillisPedido(pedido);
            if (!createdMs || createdMs < inicioMs || createdMs > fimMs) return;

            const telefone = normalizarChaveClienteTelefone(pedido.customerPhone);
            if (!telefone) return;

            if (!mapa.has(telefone.chave)) {
                mapa.set(telefone.chave, {
                    phone: telefone.telefoneCompleto,
                    names: new Set(),
                    totalSpent: 0,
                    orderCount: 0,
                    unitsCount: 0,
                });
            }

            const bucket = mapa.get(telefone.chave);
            bucket.totalSpent += Number(pedido.total) || 0;
            bucket.orderCount += 1;

            if (Array.isArray(pedido.items)) {
                pedido.items.forEach((item) => {
                    const qtyRaw = Number(item?.qty);
                    bucket.unitsCount += Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
                });
            }

            const nome = safeTextFn(pedido.customerName);
            if (nome) bucket.names.add(nome);
        });

        return mapa;
    };

    /**
     * Converte mapa de agregação em lista ordenada.
     *
     * @param {Map} mapaAgregado
     * @param {'spent'|'count'} metrica
     * @returns {Array<{ phone: string, name: string, totalSpent: number, orderCount: number, unitsCount: number, spent: number, count: number }>}
     */
    const ordenarRanking = (mapaAgregado, metrica = 'spent') => {
        const lista = Array.from(mapaAgregado.values()).map((entrada) => {
            const nomes = Array.from(entrada.names || []);
            return {
                phone: entrada.phone,
                name: nomes.join(' / ') || 'Cliente',
                totalSpent: entrada.totalSpent,
                orderCount: entrada.orderCount,
                unitsCount: entrada.unitsCount,
                spent: entrada.totalSpent,
                count: entrada.orderCount,
            };
        });

        return lista.sort((a, b) => {
            if (metrica === 'count') {
                const diffCount = b.orderCount - a.orderCount;
                if (diffCount !== 0) return diffCount;
                const diffSpent = b.totalSpent - a.totalSpent;
                if (diffSpent !== 0) return diffSpent;
            } else {
                const diffSpent = b.totalSpent - a.totalSpent;
                if (diffSpent !== 0) return diffSpent;
                const diffCount = b.orderCount - a.orderCount;
                if (diffCount !== 0) return diffCount;
            }
            return String(a.name).localeCompare(String(b.name), 'pt-BR');
        });
    };

    /**
     * Retorna os N primeiros do ranking já ordenado.
     *
     * @param {Object[]} rankingOrdenado
     * @param {number} [n=50]
     * @returns {Object[]}
     */
    const obterTopN = (rankingOrdenado, n = 50) => (
        Array.isArray(rankingOrdenado) ? rankingOrdenado.slice(0, Math.max(0, n)) : []
    );

    /**
     * Monta rankings para todos os períodos a partir de uma lista de pedidos.
     *
     * @param {Object[]} pedidos - Pedidos já filtrados por campanha (se aplicável)
     * @param {number} [dataRefMs]
     * @param {function} [safeTextFn]
     * @returns {Record<string, { limites: Object, porValor: Object[], porPedidos: Object[] }>}
     */
    const construirRankingsPorPeriodo = (pedidos, dataRefMs = Date.now(), safeTextFn) => {
        const resultado = {};
        TIPOS_PERIODO.forEach((tipo) => {
            const limites = calcularLimitesPeriodo(tipo, dataRefMs);
            const mapa = agregarPedidosPorCliente(pedidos, limites, safeTextFn);
            resultado[tipo] = {
                limites,
                porValor: ordenarRanking(mapa, 'spent'),
                porPedidos: ordenarRanking(mapa, 'count'),
            };
        });
        return resultado;
    };

    return {
        FUSO_PADRAO,
        MS_DIA,
        LIMITE_PEDIDOS_RANKING,
        STATUS_ELEGIVEIS_RANKING,
        TIPOS_PERIODO,
        calcularLimitesPeriodo,
        calcularInicioJanelaConsulta,
        normalizarChaveClienteTelefone,
        extrairMillisPedido,
        pedidoElegivelParaRanking,
        agregarPedidosPorCliente,
        ordenarRanking,
        obterTopN,
        construirRankingsPorPeriodo,
        formatarDataRotulo,
    };
})();
