/* ═══════════════════════════════════════════════════════════════════════
   admin-utils.js — UTILITÁRIOS E CONSTANTES DO PAINEL ADMINISTRATIVO
   ═══════════════════════════════════════════════════════════════════════
   Este módulo contém funções puras e constantes compartilhadas entre
   os módulos do painel administrativo (AdminPanel, Catálogo, Impressora, etc.).

   Responsabilidades:
   1. GERAÇÃO DE IDs — Semente e contador para IDs únicos de campos de formulário
   2. CACHE-BUST DE ASSETS — Versão estática e construtor de URL com ?v=
   3. NORMALIZAÇÃO DE TEXTO — Remoção de acentos e trim para buscas
   4. CONSTANTES DE OPERAÇÃO — Status de pedido, visibilidade de concluídos
   5. CONVERSÃO DE TIMESTAMP — Firestore/Date/número/string → millis
   6. CLASSIFICAÇÃO DE STATUS — Verificação de pedido concluído e extração de data
   7. ACESSIBILIDADE DE FORMULÁRIOS — Garantia de IDs/names únicos e associação label↔campo
   8. BUSCA NORMALIZADA — Termo de busca e texto pesquisável para filtros

   Disponibilizado globalmente como window.HeloAdminUtils.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloAdminUtils = (() => {

/* ── Importa utilitários base do módulo central (app.js) ────────────
   safeText: converte qualquer valor para string segura (evita null/undefined)
   getMillis: extrai millis de timestamps Firestore (Timestamp, Date, número) */
const { safeText, getMillis } = window.HeloApp;

/* ═══════════════════════════════════════════════════════════════════════
   1. GERAÇÃO DE IDs ÚNICOS PARA CAMPOS DE FORMULÁRIO
   ═══════════════════════════════════════════════════════════════════════
   Cada carregamento da página gera uma semente única (FORM_FIELD_UID_SEED)
   baseada em timestamp + aleatoriedade. O contador (formFieldUidCounter)
   garante que cada chamada a gerarIdCampoFormulario() produza um ID diferente.
   Necessário para autofill do navegador e acessibilidade (leitores de tela). */

/** Semente única gerada no carregamento da página para IDs de campos de formulário.
 *  Composta por timestamp em base36 + trecho aleatório em base36. */
const FORM_FIELD_UID_SEED = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Contador incremental que garante unicidade dentro da mesma semente. */
let formFieldUidCounter = 0;

/**
 * Gera um ID único para campo de formulário.
 *
 * @returns {string} ID no formato "SEED_COUNTER" (ex: "m1a2b3c_x4y5z_1")
 *
 * Combina a semente da página com um contador incremental codificado em base36,
 * garantindo que cada campo de formulário tenha um identificador globalmente único.
 */
const gerarIdCampoFormulario = () => `${FORM_FIELD_UID_SEED}_${(++formFieldUidCounter).toString(36)}`;

/* ═══════════════════════════════════════════════════════════════════════
   2. CACHE-BUST DE ASSETS ESTÁTICOS
   ═══════════════════════════════════════════════════════════════════════
   Evita que o navegador sirva assets desatualizados (CSS, áudio, imagens)
   após um deploy. A versão é atualizada manualmente a cada release. */

/** Versão atual dos assets estáticos para cache-bust (atualizar a cada deploy). */
const VERSAO_ASSETS_ESTATICOS = '20260518-222624';

/**
 * Constrói URL de asset com parâmetro de cache-bust.
 *
 * @param {string} caminhoAsset - Caminho relativo do asset (ex: './css/style.css')
 * @returns {string} URL com sufixo ?v=VERSAO (ex: './css/style.css?v=20260415-2235')
 *
 * Garante que o navegador baixe a versão mais recente do asset após cada deploy,
 * evitando problemas de cache em navegadores de clientes.
 */
const construirUrlAssetComVersao = (caminhoAsset) => `${caminhoAsset}?v=${VERSAO_ASSETS_ESTATICOS}`;

/* ═══════════════════════════════════════════════════════════════════════
   3. NORMALIZAÇÃO DE TEXTO
   ═══════════════════════════════════════════════════════════════════════
   Remove acentos e espaços extras para permitir comparações e buscas
   insensíveis a diacríticos (ex: "Açúcar" → "Acucar"). */

/**
 * Normaliza texto removendo acentos e espaços extras.
 *
 * @param {*} valor - Qualquer valor (será convertido para string por safeText)
 * @returns {string} Texto sem acentos (NFD + remoção de diacríticos) e com trim
 *
 * Exemplos:
 *   normalizarTexto("Açúcar") → "Acucar"
 *   normalizarTexto("  Olá Mundo  ") → "Ola Mundo"
 */
const normalizarTexto = (valor) => safeText(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/* ═══════════════════════════════════════════════════════════════════════
   4. CONSTANTES DE OPERAÇÃO (PEDIDOS)
   ═══════════════════════════════════════════════════════════════════════
   Definem o comportamento da aba Operação do AdminPanel:
   - CHAVE_STATUS_CONCLUIDO: valor normalizado do status "Concluído"
   - MINUTOS_VISIBILIDADE_CONCLUIDOS: tempo que pedidos concluídos
     permanecem visíveis antes de saírem da lista ativa
   - STATUS_ATIVOS_OPERACAO: lista de status que indicam pedido em andamento */

/** Chave normalizada do status "Concluído" (usada em comparações). */
const CHAVE_STATUS_CONCLUIDO = 'concluido';

/** Minutos que pedidos concluídos permanecem visíveis na aba Operação. */
const MINUTOS_VISIBILIDADE_CONCLUIDOS = 15;

/** Milissegundos equivalentes aos minutos de visibilidade (para cálculos com Date). */
const MS_VISIBILIDADE_CONCLUIDOS = MINUTOS_VISIBILIDADE_CONCLUIDOS * 60 * 1000;

/** Status que indicam pedido ativo (ainda não concluído nem cancelado).
 *
 * @update 2026-05-14 — Inclui AguardandoPagamento (PIX InfinitePay antes do webhook).
 */
const STATUS_ATIVOS_OPERACAO = ['Novo', 'AguardandoPagamento', 'Confirmado', 'Pago', 'Pronto'];

/* ═══════════════════════════════════════════════════════════════════════
   5. CONVERSÃO DE TIMESTAMP PARA MILLIS
   ═══════════════════════════════════════════════════════════════════════
   O Firebase armazena datas em formatos variados (Timestamp, Date, número, string).
   Esta função unifica a extração de millis para ordenação e comparação. */

/**
 * Converte qualquer valor de data/timestamp para millis.
 *
 * @param {*} valor - Timestamp Firestore, Date, número ou string
 * @returns {number} Milissegundos desde epoch, ou 0 se inválido
 *
 * Ordem de tentativa:
 * 1. getMillis (utilitário do app.js que trata Timestamp Firestore)
 * 2. Date.getTime() (objeto Date nativo)
 * 3. Number (valor numérico direto)
 * Se nenhuma tentativa produz valor válido, retorna 0.
 */
const converterParaMillis = (valor) => {
    // Primeira tentativa: utilitário central que trata Timestamp Firestore
    const millis = getMillis(valor);
    if (Number.isFinite(millis) && millis > 0) return millis;

    // Segunda tentativa: objeto Date nativo do JavaScript
    if (valor instanceof Date) {
        const dateMillis = valor.getTime();
        return Number.isFinite(dateMillis) ? dateMillis : 0;
    }

    // Terceira tentativa: valor numérico direto (ex: 1713456000000)
    const numeric = Number(valor);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    // Nenhuma tentativa funcionou — valor inválido
    return 0;
};

/* ═══════════════════════════════════════════════════════════════════════
   6. CLASSIFICAÇÃO DE STATUS E EXTRAÇÃO DE DATA DE PEDIDO
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Verifica se o valor de status representa "Concluído".
 *
 * @param {*} valor - Valor de status (string ou qualquer tipo)
 * @returns {boolean} true se o valor normalizado for "concluido"
 *
 * Usa normalizarTexto para remover acentos e comparar em minúsculas,
 * garantindo que "Concluído", "concluido", "CONCLUÍDO" todos sejam reconhecidos.
 */
const ehStatusConcluido = (valor) => normalizarTexto(valor).toLowerCase() === CHAVE_STATUS_CONCLUIDO;

/**
 * Extrai millis de criação do pedido para ordenação.
 *
 * @param {Object} pedido - Objeto pedido com campo createdAt
 * @returns {number} Millis de createdAt ou Number.MAX_SAFE_INTEGER se inválido
 *
 * Pedidos sem data válida recebem MAX_SAFE_INTEGER para ficarem por último
 * na ordenação crescente (mais antigos primeiro, sem data no final).
 */
const extrairMillisCriacaoPedido = (pedido) => {
    const createdAtMillis = converterParaMillis(pedido?.createdAt);
    // Se não tem data válida, empurra para o final da lista ordenada
    return createdAtMillis > 0 ? createdAtMillis : Number.MAX_SAFE_INTEGER;
};

/* ═══════════════════════════════════════════════════════════════════════
   7. ACESSIBILIDADE DE FORMULÁRIOS
   ═══════════════════════════════════════════════════════════════════════
   O React renderiza formulários dinamicamente, o que pode gerar:
   - Campos sem id ou name (quebra autofill e acessibilidade)
   - IDs duplicados (quebra associação label↔campo)
   - Labels sem htmlFor (leitores de tela não associam label ao campo)

   Estas funções corrigem esses problemas após cada renderização. */

/**
 * Garante que todos os campos de formulário tenham id e name únicos.
 *
 * @param {Element} [raiz=document] - Elemento DOM raiz para escanear campos
 * @returns {void}
 *
 * Fluxo:
 * 1. Escaneia todos os input/select/textarea dentro de raiz
 * 2. Conta ocorrências de cada id para detectar duplicidade
 * 3. Para cada campo:
 *    a. Se o id é único, mantém
 *    b. Se é duplicado ou inexistente, gera novo id via gerarIdCampoFormulario()
 * 4. Para campos sem name, gera name baseado em atributos visíveis
 *    (autocomplete, placeholder, aria-label, type, tagName)
 *
 * Necessário para: autofill do navegador, acessibilidade (leitores de tela),
 * e envio correto de dados em formulários HTML nativos.
 */
const garantirIdsUnicosCamposFormulario = (raiz = document) => {
    if (!raiz || !raiz.querySelectorAll) return;
    const campos = Array.from(raiz.querySelectorAll('input, select, textarea'));
    if (campos.length === 0) return;

    // Conta quantas vezes cada id aparece para detectar duplicidade
    const contagemIds = {};
    campos.forEach((campo) => {
        const id = safeText(campo.id).trim();
        if (!id) return;
        contagemIds[id] = (contagemIds[id] || 0) + 1;
    });

    const idsUsados = new Set();
    const namesUsados = new Set();

    campos.forEach((campo) => {
        const idAtual = safeText(campo.id).trim();
        const nameAtual = safeText(campo.name).trim();

        // Base para gerar nomes descritivos: prioriza name > id > autocomplete > placeholder > aria-label > type > tagName
        const baseBruta = safeText(
            nameAtual ||
            idAtual ||
            campo.getAttribute('autocomplete') ||
            campo.getAttribute('placeholder') ||
            campo.getAttribute('aria-label') ||
            campo.type ||
            campo.tagName,
            'field'
        );

        // Normaliza base para formato snake_case (ex: "Nome do Cliente" → "nome_do_cliente")
        const base = baseBruta
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'field';

        // Mantém id existente apenas se for único no scan atual e ainda não usado nesta passagem
        const manterIdAtual = idAtual && contagemIds[idAtual] === 1 && !idsUsados.has(idAtual);
        if (manterIdAtual) {
            idsUsados.add(idAtual);
        } else {
            // Gera novo id único usando a semente + contador
            let idCandidato = '';
            do {
                idCandidato = `f_${base}_${gerarIdCampoFormulario()}`;
            } while (idsUsados.has(idCandidato));
            campo.id = idCandidato;
            idsUsados.add(idCandidato);
        }

        // Garante name único: mantém existente se disponível, ou gera novo
        if (nameAtual && !namesUsados.has(nameAtual)) {
            namesUsados.add(nameAtual);
        } else if (!nameAtual) {
            let nameCandidato = '';
            do {
                nameCandidato = `${base}_${gerarIdCampoFormulario()}`;
            } while (namesUsados.has(nameCandidato));
            campo.name = nameCandidato;
            namesUsados.add(nameCandidato);
        }
    });
};

/**
 * Associa labels aos campos de formulário mais próximos.
 *
 * @param {Element} [raiz=document] - Elemento DOM raiz para escanear labels
 * @returns {void}
 *
 * Fluxo:
 * 1. Busca todos os <label> dentro de raiz
 * 2. Para cada label sem htmlFor válido:
 *    a. Tenta encontrar campo no nextElementSibling (irmão seguinte)
 *    b. Tenta encontrar campo dentro do parentElement (mesmo container)
 * 3. Se encontrou campo, garante que ele tem id (via garantirIdsUnicosCamposFormulario)
 * 4. Associa o htmlFor do label ao id do campo
 *
 * Garante acessibilidade: leitores de tela leem o label ao focar no campo,
 * e clicar no label foca o campo associado.
 */
const garantirAssociacaoLabelsCampos = (raiz = document) => {
    if (!raiz || !raiz.querySelectorAll) return;
    const labels = Array.from(raiz.querySelectorAll('label'));
    if (labels.length === 0) return;

    labels.forEach((label) => {
        // Se o label já tem htmlFor válido apontando para um campo existente, não faz nada
        const idVinculado = safeText(label.htmlFor).trim();
        if (idVinculado && document.getElementById(idVinculado)) return;

        // Se o label já contém um campo dentro dele, não precisa associar
        if (label.querySelector('input, select, textarea')) return;

        let campo = null;

        // Primeira tentativa: campo no irmão seguinte (layout comum: <label><input>)
        const irmaoSeguinte = label.nextElementSibling;
        if (irmaoSeguinte) {
            if (irmaoSeguinte.matches && irmaoSeguinte.matches('input, select, textarea')) {
                campo = irmaoSeguinte;
            } else if (irmaoSeguinte.querySelector) {
                campo = irmaoSeguinte.querySelector('input, select, textarea');
            }
        }

        // Segunda tentativa: campo dentro do mesmo container pai
        if (!campo && label.parentElement && label.parentElement.querySelector) {
            campo = label.parentElement.querySelector('input, select, textarea');
        }

        // Se não encontrou campo, não há o que associar
        if (!campo) return;

        // Garante que o campo e seus irmãos tenham ids únicos antes de associar
        garantirIdsUnicosCamposFormulario(campo.parentElement || document);

        // Associa o htmlFor do label ao id do campo encontrado
        const idCampo = safeText(campo.id).trim();
        if (idCampo) label.htmlFor = idCampo;
    });
};

/* ═══════════════════════════════════════════════════════════════════════
   8. BUSCA NORMALIZADA (FILTROS DO ADMIN)
   ═══════════════════════════════════════════════════════════════════════
   Funções para construir textos pesquisáveis a partir de múltiplos campos,
   usados nos filtros de busca das abas Pedidos, Agenda, Entregas e Ranking. */

/**
 * Normaliza termo de busca para comparação consistente.
 *
 * @param {*} valor - Texto livre digitado pelo usuário
 * @returns {string} Texto sem acentos, em minúsculas e sem espaços extras
 *
 * Exemplo:
 *   normalizarTermoBusca("Açúcar Mas") → "acucar mas"
 *
 * Usado para comparar o que o usuário digitou com os dados exibidos na tela,
 * permitindo busca insensível a acentos e maiúsculas/minúsculas.
 */
const normalizarTermoBusca = (valor) => normalizarTexto(valor).toLowerCase().trim();

/**
 * Constrói um bloco único pesquisável a partir de múltiplos valores.
 *
 * @param {Array} [valores=[]] - Array com textos, números ou sub-arrays relacionados ao registro
 * @returns {string} String normalizada para buscas amplas no contexto da aba
 *
 * Achata arrays aninhados, converte tudo para texto via safeText,
 * junta com espaços e normaliza para comparação por includes().
 *
 * Exemplo de uso (filtro de pedidos):
 *   construirTextoPesquisavel([
 *       pedido.id,
 *       pedido.customerName,
 *       pedido.customerPhone,
 *       pedido.status,
 *       ...pedido.items.map(item => item.name)
 *   ])
 *   // → "abc123 joao silva 11999887766 Novo Bolo de Lanche Fatia ..."
 *
 * Depois, compara com: construirTextoPesquisavel(pedido).includes(normalizarTermoBusca(busca))
 */
const construirTextoPesquisavel = (valores = []) => {
    const listaOrigem = Array.isArray(valores) ? valores : [valores];
    const achatados = [];
    listaOrigem.forEach((valor) => {
        // Se o valor é um array, achata seus itens no nível superior
        if (Array.isArray(valor)) {
            valor.forEach((valorAninhado) => achatados.push(valorAninhado));
            return;
        }
        achatados.push(valor);
    });
    // Converte cada item para texto seguro, junta com espaços e normaliza
    return normalizarTermoBusca(achatados.map((item) => safeText(item)).join(' '));
};

/* ═══════════════════════════════════════════════════════════════════════
   EXPORTAÇÃO PÚBLICA
   ═══════════════════════════════════════════════════════════════════════
   Todos os consumidores (script.js, main-app.js, catalog.js, printer-service.js)
   acessam estas funções via desestruturação de window.HeloAdminUtils. */
return {
    // Geração de IDs
    gerarIdCampoFormulario,

    // Cache-bust de assets
    VERSAO_ASSETS_ESTATICOS,
    construirUrlAssetComVersao,

    // Normalização de texto
    normalizarTexto,

    // Constantes de operação
    CHAVE_STATUS_CONCLUIDO,
    MINUTOS_VISIBILIDADE_CONCLUIDOS,
    MS_VISIBILIDADE_CONCLUIDOS,
    STATUS_ATIVOS_OPERACAO,

    // Conversão de timestamp
    converterParaMillis,

    // Classificação de status
    ehStatusConcluido,
    extrairMillisCriacaoPedido,

    // Acessibilidade de formulários
    garantirIdsUnicosCamposFormulario,
    garantirAssociacaoLabelsCampos,

    // Busca normalizada
    normalizarTermoBusca,
    construirTextoPesquisavel,

    // Retrocompatibilidade: nomes antigos que outros módulos já usam
    // Manter até que todos os consumidores sejam atualizados para os novos nomes
    nextFormFieldUid: gerarIdCampoFormulario,
    STATIC_ASSET_VERSION: VERSAO_ASSETS_ESTATICOS,
    buildStaticAssetUrl: construirUrlAssetComVersao,
    normalizeText: normalizarTexto,
    ORDER_STATUS_CONCLUDED_KEY: CHAVE_STATUS_CONCLUIDO,
    OPERATION_CONCLUDED_VISIBILITY_MINUTES: MINUTOS_VISIBILIDADE_CONCLUIDOS,
    OPERATION_CONCLUDED_VISIBILITY_MS: MS_VISIBILIDADE_CONCLUIDOS,
    OPERATION_ACTIVE_STATUSES: STATUS_ATIVOS_OPERACAO,
    toTimestampMillis: converterParaMillis,
    isConcludedStatusValue: ehStatusConcluido,
    getOrderCreatedAtMillis: extrairMillisCriacaoPedido,
    ensureFormFieldIdentifiers: garantirIdsUnicosCamposFormulario,
    ensureLabelAssociations: garantirAssociacaoLabelsCampos,
    normalizeSearchTerm: normalizarTermoBusca,
    buildSearchableText: construirTextoPesquisavel,
};

})();
