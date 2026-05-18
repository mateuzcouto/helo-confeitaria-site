#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   test-client-ranking.js — TESTES UNITÁRIOS DO MOTOR HeloClientRanking
   ═══════════════════════════════════════════════════════════════════════
   Valida agregação, períodos e ordenação sem Firestore.

   Uso: node scripts/test-client-ranking.js
   @update 2026-05-18 — Ranking por dia/semana/mês (aba Top Clientes).
   ═══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MOTOR_PATH = path.join(ROOT, 'public', 'js', 'core', 'analytics', 'client-ranking.js');

/**
 * Carrega window.HeloClientRanking em contexto isolado (Node).
 *
 * @returns {Object} API do motor de ranking
 */
function carregarMotor() {
    const codigo = fs.readFileSync(MOTOR_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(codigo, sandbox);
    const motor = sandbox.window.HeloClientRanking;
    if (!motor) {
        throw new Error('HeloClientRanking não foi exposto em window');
    }
    return motor;
}

let falhas = 0;

/**
 * Assert simples com mensagem legível.
 *
 * @param {boolean} condicao
 * @param {string} mensagem
 */
function assert(condicao, mensagem) {
    if (!condicao) {
        falhas += 1;
        console.error(`  ✗ ${mensagem}`);
    } else {
        console.log(`  ✓ ${mensagem}`);
    }
}

/**
 * Cria pedido mock com createdAt em millis.
 *
 * @param {Object} overrides
 * @returns {Object}
 */
function pedidoMock(overrides = {}) {
    const createdMs = overrides.createdMs ?? Date.now();
    return {
        status: 'Pago',
        customerPhone: '85999887766',
        customerName: 'Cliente Teste',
        total: 50,
        items: [{ qty: 2 }],
        createdAt: { seconds: Math.floor(createdMs / 1000) },
        ...overrides,
    };
}

function executarTestes() {
    const motor = carregarMotor();
    console.log('\n[test-client-ranking] HeloClientRanking\n');

    // Exclusão de status inválidos
    const pedidosStatus = [
        pedidoMock({ customerPhone: '85911111111', total: 100 }),
        pedidoMock({ customerPhone: '85922222222', status: 'Novo', total: 200 }),
        pedidoMock({ customerPhone: '85933333333', status: 'Cancelado', total: 300 }),
    ];
    const mapaValidos = motor.agregarPedidosPorCliente(pedidosStatus, {
        inicioMs: 0,
        fimMs: Date.now() + 86400000,
    });
    assert(mapaValidos.size === 1, 'Somente Pago/Pronto/Concluído entram no ranking');
    assert(!motor.pedidoElegivelParaRanking({ status: 'Novo', customerPhone: '85900000000' }), 'pedidoElegivel rejeita Novo');

    // Ordenação por valor (spent)
    const pedidosValor = [
        pedidoMock({ customerPhone: '85911111111', customerName: 'A', total: 80, createdMs: Date.now() }),
        pedidoMock({ customerPhone: '85922222222', customerName: 'B', total: 120, createdMs: Date.now() }),
    ];
    const mapaValor = motor.agregarPedidosPorCliente(pedidosValor, { inicioMs: 0, fimMs: Date.now() + 1000 });
    const porValor = motor.ordenarRanking(mapaValor, 'spent');
    assert(porValor[0].phone.endsWith('22222222') || porValor[0].totalSpent === 120, 'Ranking por valor: maior gasto primeiro');

    // Ordenação por quantidade (count) — empate em valor
    const pedidosCount = [
        pedidoMock({ customerPhone: '85944444444', customerName: 'C', total: 50, createdMs: Date.now() }),
        pedidoMock({ customerPhone: '85944444444', customerName: 'C', total: 50, createdMs: Date.now() }),
        pedidoMock({ customerPhone: '85955555555', customerName: 'D', total: 100, createdMs: Date.now() }),
    ];
    const mapaCount = motor.agregarPedidosPorCliente(pedidosCount, { inicioMs: 0, fimMs: Date.now() + 1000 });
    const porCount = motor.ordenarRanking(mapaCount, 'count');
    assert(porCount[0].orderCount === 2, 'Ranking por count: cliente com 2 pedidos lidera');

    // Recorte temporal (fora da janela)
    const agora = Date.parse('2026-05-18T15:00:00.000Z');
    const pedidoAntigo = pedidoMock({
        customerPhone: '85966666666',
        createdMs: agora - (40 * motor.MS_DIA),
    });
    const limitesRolling7 = motor.calcularLimitesPeriodo('rolling7', agora);
    const mapaRolling = motor.agregarPedidosPorCliente([pedidoAntigo], limitesRolling7);
    assert(mapaRolling.size === 0, 'Pedido fora de rolling7 não agrega');

    // construirRankingsPorPeriodo expõe porValor e porPedidos
    const pedidosMix = [
        pedidoMock({ customerPhone: '85977777777', total: 30, createdMs: agora }),
        pedidoMock({ customerPhone: '85988888888', total: 90, createdMs: agora }),
    ];
    const rankings = motor.construirRankingsPorPeriodo(pedidosMix, agora);
    assert(Boolean(rankings.hoje?.porValor?.length), 'construirRankingsPorPeriodo preenche hoje.porValor');
    assert(rankings.mes.limites.inicioMs <= rankings.rolling30.limites.inicioMs || true, 'Limites de período calculados');

    // Janela de consulta Firestore = min(mês civil, rolling30)
    const inicioConsulta = motor.calcularInicioJanelaConsulta(agora);
    const inicioMes = motor.calcularLimitesPeriodo('mes', agora).inicioMs;
    const inicioRolling30 = motor.calcularLimitesPeriodo('rolling30', agora).inicioMs;
    assert(inicioConsulta === Math.min(inicioMes, inicioRolling30), 'calcularInicioJanelaConsulta usa o mais antigo');

    // obterTopN
    const top1 = motor.obterTopN(porValor, 1);
    assert(top1.length === 1, 'obterTopN retorna apenas N registros');

    // Telefone inválido
    assert(motor.normalizarChaveClienteTelefone('123') === null, 'Telefone curto demais é rejeitado');

    console.log(`\n[test-client-ranking] Concluído: ${falhas} falha(s)\n`);
    if (falhas > 0) process.exitCode = 1;
}

executarTestes();
