/* ═══════════════════════════════════════════════════════════════════════
   catalog.js — CONSTANTES E FUNÇÕES DO CARDÁPIO (CATÁLOGO DE PRODUTOS)
   ═══════════════════════════════════════════════════════════════════════
   Este módulo contém constantes e funções puras relacionadas ao catálogo
   de produtos, abas de menu e deduplicação de produtos.

   Responsabilidades:
   1. CONSTANTES DE CATEGORIA — Categorias de ingredientes e tipos de receita
   2. CONSTANTES DE UNIDADES — Unidades de medida aceitas e conversíveis
   3. ABAS DO MENU — Opções padrão, normalização de chaves e labels
   4. RESOLUÇÃO DE ABA — Determina a aba de menu de um produto
   5. IDENTIDADE DE PRODUTO — Chave de identidade para deduplicação
   6. SCORE DE COMPLETUDE — Pontuação de preenchimento do produto
   7. DEDUPLICAÇÃO — Remove produtos duplicados mantendo o mais completo
   8. NORMALIZAÇÃO DE IMAGENS — Extrai e normaliza URLs de imagens do produto

   Disponibilizado globalmente como window.HeloCatalog.
   ═══════════════════════════════════════════════════════════════════════ */
window.HeloCatalog = (() => {

/* ── Importa utilitários base dos módulos centrais ──────────────────
   safeText: converte qualquer valor para string segura (evita null/undefined)
   CAMPAIGN_LEGACY_ID: ID da campanha legado para normalização
   normalizeCampaignId: normaliza ID de campanha tratando legado */
const { safeText, normalizeCampaignId, CAMPAIGN_LEGACY_ID } = window.HeloApp;

/* ── Importa normalizarTexto do HeloAdminUtils ─────────────────────
   Usado para normalizar partes de identidade de produto (nome, tamanho, etc.) */
const { normalizarTexto } = window.HeloAdminUtils;

/* ═══════════════════════════════════════════════════════════════════════
   1. CONSTANTES DE CATEGORIA (INGREDIENTES E RECEITAS)
   ═══════════════════════════════════════════════════════════════════════
   Usadas no painel de estoque para classificar ingredientes e receitas. */

/** Categorias de ingredientes para o módulo de estoque. */
const CATEGORIAS = [
    { k: 'a', l: 'Equipamentos' },
    { k: 'b', l: 'Mão de Obra' },
    { k: 'c', l: 'Matéria-prima' },
    { k: 'd', l: 'Bases e Recheios' },
    { k: 'e', l: 'Embalagens' },
    { k: 'f', l: 'Outros' },
];

/** Tipos de receita para o módulo de fichas técnicas. */
const RECIPE_TYPES = [
    { k: 'massa', l: 'Massa (Base)' },
    { k: 'recheio', l: 'Recheio' },
    { k: 'produto', l: 'Produto Final' },
];

/**
 * Retorna label da categoria de ingrediente a partir da chave.
 *
 * @param {string} k - Chave da categoria (ex: 'a', 'b', 'c')
 * @returns {string} Label legível (ex: 'Equipamentos', 'Matéria-prima')
 */
const rotuloCategoria = (k) => (CATEGORIAS.find(c => c.k === k) || { l: k || '?' }).l;

/**
 * Retorna label do tipo de receita a partir da chave.
 *
 * @param {string} k - Chave do tipo (ex: 'massa', 'recheio', 'produto')
 * @returns {string} Label legível (ex: 'Massa (Base)', 'Recheio', 'Produto Final')
 */
const rotuloTipoReceita = (k) => (RECIPE_TYPES.find(t => t.k === k) || { l: k || 'Produto Final' }).l;

/**
 * Retorna cor associada ao tipo de receita para exibição visual.
 *
 * @param {string} k - Chave do tipo ('massa', 'recheio' ou 'produto')
 * @returns {string} Cor hex (roxo para massa, âmbar para recheio, verde para produto)
 */
const corTipoReceita = (k) => k === 'massa' ? '#8b5cf6' : k === 'recheio' ? '#f59e0b' : '#10b981';

/* ═══════════════════════════════════════════════════════════════════════
   2. CONSTANTES DE UNIDADES DE MEDIDA
   ═══════════════════════════════════════════════════════════════════════
   Usadas nos selects de unidade do estoque e fichas técnicas. */

/** Unidades de medida aceitas no sistema (para selects de ingrediente). */
const UNITS = ['g', 'kg', 'mg', 'ml', 'L', 'un', 'h', 'min', 'seg', 'cm', 'mm'];

/** Unidades com suporte a conversão automática (built-in). */
const CONVERSION_UNITS = ['mg', 'g', 'kg', 'ml', 'L', 'min', 'h', 'seg', 'mm', 'cm', 'm', 'un'];

/* ═══════════════════════════════════════════════════════════════════════
   3. ABAS DO MENU (CARDÁPIO PÚBLICO)
   ═══════════════════════════════════════════════════════════════════════
   O cardápio público é organizado em abas (tabs). Cada aba tem:
   - key: identificador normalizado (ex: 'bolos-de-lanche')
   - label: texto exibido ao usuário (ex: 'Bolos de Lanche')
   - legacyLabels: nomes antigos que mapeiam para esta aba (migração) */

/** Abas padrão do cardápio quando não há customização no siteSettings. */
const OPCOES_ABAS_MENU_PADRAO = [
    { key: 'bolos-de-lanche', label: 'Bolos de Lanche', legacyLabels: ['unidade'] },
    { key: 'fatias-de-bolo', label: 'Fatias de Bolo', legacyLabels: [] },
    { key: 'nossos-doces', label: 'Nossos Doces', legacyLabels: [] },
];

/**
 * Converte chave de aba em label legível (ex: 'bolos-de-lanche' → 'Bolos De Lanche').
 *
 * @param {string} valor - Chave da aba com separadores - ou _
 * @returns {string} Label com iniciais maiúsculas, ou valor original se não tem separador
 */
const rotuloAbaMenu = (valor) => {
    const bruto = safeText(valor).trim();
    if (!bruto) return '';
    // Se contém separadores, capitaliza cada parte
    if (/[-_]/.test(bruto)) {
        return bruto
            .split(/[-_]+/)
            .map((parte) => parte ? `${parte.charAt(0).toUpperCase()}${parte.slice(1)}` : '')
            .join(' ')
            .trim();
    }
    return bruto;
};

/**
 * Converte valor livre em objeto de opção de aba de menu normalizado.
 *
 * @param {string|Object} valor - Chave, label ou objeto { key, label, legacyLabels }
 * @returns {Object|null} Opção normalizada { key, label, legacyLabels } ou null se inválido
 */
const opcaoAbaMenu = (valor) => {
    if (!valor) return null;
    const entrada = typeof valor === 'object' ? valor : { label: valor };
    const chave = normalizarChaveAbaMenu(entrada.key || entrada.label);
    if (!chave) return null;
    const rotuloBruto = safeText(entrada.label, rotuloAbaMenu(chave)).trim() || rotuloAbaMenu(chave);
    const rotulo = rotuloAbaMenu(rotuloBruto);
    return {
        key: chave,
        label: rotulo,
        legacyLabels: Array.isArray(entrada.legacyLabels)
            ? entrada.legacyLabels.map((item) => safeText(item).trim()).filter(Boolean)
            : [],
    };
};

/**
 * Mescla múltiplas fontes de opções de aba, deduplicando por chave.
 *
 * @param {...Array} fontes - Arrays de opções de aba para mesclar
 * @returns {Array} Lista deduplicada com legacyLabels consolidados
 */
const mesclarOpcoesAbaMenu = (...fontes) => {
    const mapa = new Map();
    fontes.flat().forEach((item) => {
        const opcao = opcaoAbaMenu(item);
        if (!opcao) return;
        const existente = mapa.get(opcao.key);
        if (!existente) {
            mapa.set(opcao.key, opcao);
            return;
        }
        // Consolida legacyLabels das duas fontes
        const legacyLabels = Array.from(new Set([...(existente.legacyLabels || []), ...(opcao.legacyLabels || [])]));
        mapa.set(opcao.key, {
            ...existente,
            label: existente.label || opcao.label,
            legacyLabels,
        });
    });
    return Array.from(mapa.values());
};

/**
 * Descobre abas de menu a partir dos campos dos produtos do catálogo.
 *
 * @param {Array} [produtos=[]] - Lista de produtos do catálogo
 * @returns {Array} Opções de aba descobertas a partir dos campos dos produtos
 *
 * Escaneia os campos menuTab, menuCategory, category, categoria,
 * collection, tipo, type de cada produto e converte em opções de aba.
 */
const descobrirAbasMenuDosProdutos = (produtos = []) => {
    const descobertas = [];
    (Array.isArray(produtos) ? produtos : []).forEach((produto) => {
        [
            produto?.menuTab,
            produto?.menuCategory,
            produto?.category,
            produto?.categoria,
            produto?.collection,
            produto?.tipo,
            produto?.type,
        ].forEach((candidato) => {
            const opcao = opcaoAbaMenu({ key: candidato, label: candidato });
            if (opcao) descobertas.push(opcao);
        });
    });
    return descobertas;
};

/**
 * Constrói lista final de abas de menu mesclando padrão + customização + produtos.
 *
 * @param {Object} [params={}] - Parâmetros { siteSettings, products }
 * @returns {Array} Lista mesclada e deduplicada de opções de aba
 *
 * Lógica:
 * - Se siteSettings.menuTabs tem customizações, usa como base + padrão como fallback
 * - Se não, usa padrão como base + abas descobertas dos produtos
 */
const construirOpcoesAbaMenu = ({ siteSettings = {}, products = [] } = {}) => {
    const abasCustomizadas = Array.isArray(siteSettings?.menuTabs) ? siteSettings.menuTabs : [];
    const temCustomizadas = abasCustomizadas.length > 0;
    return mesclarOpcoesAbaMenu(
        temCustomizadas ? abasCustomizadas : OPCOES_ABAS_MENU_PADRAO,
        temCustomizadas ? OPCOES_ABAS_MENU_PADRAO : [],
        descobrirAbasMenuDosProdutos(products),
    );
};

/**
 * Normaliza valor de aba de menu para chave canônica.
 *
 * @param {string} valor - Valor livre digitado ou armazenado
 * @param {Array} [opcoesAbaMenu=OPCOES_ABAS_MENU_PADRAO] - Lista de opções válidas
 * @returns {string} Chave normalizada (ex: 'bolos-de-lanche')
 *
 * Fluxo:
 * 1. Remove acentos, converte para minúsculas e trim
 * 2. Busca match entre key, label e legacyLabels das opções
 * 3. Se encontra, retorna a chave canônica da opção
 * 4. Se não encontra, gera chave slug (ex: 'Bolos Doces' → 'bolos-doces')
 */
const normalizarChaveAbaMenu = (valor, opcoesAbaMenu = OPCOES_ABAS_MENU_PADRAO) => {
    const opcoes = Array.isArray(opcoesAbaMenu) && opcoesAbaMenu.length > 0
        ? opcoesAbaMenu
        : OPCOES_ABAS_MENU_PADRAO;
    const normalizado = safeText(valor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    if (!normalizado) return '';

    // Busca match direto entre key, label e legacyLabels
    const correspondencia = opcoes.find((opcao) => {
        const candidatos = [opcao.key, opcao.label, ...(opcao.legacyLabels || [])]
            .map(item => safeText(item)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim());
        return candidatos.includes(normalizado);
    });

    return correspondencia ? correspondencia.key : normalizado.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

/**
 * Retorna label legível de uma aba de menu a partir de qualquer valor.
 *
 * @param {string} valor - Chave, label ou legacyLabel da aba
 * @param {Array} [opcoesAbaMenu=OPCOES_ABAS_MENU_PADRAO] - Lista de opções válidas
 * @returns {string} Label legível (ex: 'Bolos de Lanche')
 */
const obterRotuloAbaMenu = (valor, opcoesAbaMenu = OPCOES_ABAS_MENU_PADRAO) => {
    const opcoes = Array.isArray(opcoesAbaMenu) && opcoesAbaMenu.length > 0
        ? opcoesAbaMenu
        : OPCOES_ABAS_MENU_PADRAO;
    const chave = normalizarChaveAbaMenu(valor, opcoes);
    const rotuloFallback = rotuloAbaMenu(safeText(valor)) || opcoes[0]?.label || 'Bolos de Lanche';
    const rotuloBruto = (opcoes.find(opcao => opcao.key === chave) || {}).label || rotuloFallback;
    return rotuloAbaMenu(rotuloBruto);
};

/* ═══════════════════════════════════════════════════════════════════════
   4. RESOLUÇÃO DE ABA DE MENU DO PRODUTO
   ═══════════════════════════════════════════════════════════════════════
   Determina qual aba de menu um produto pertence, testando múltiplos
   campos em ordem de prioridade. */

/**
 * Resolve a aba de menu de um produto testando múltiplos campos.
 *
 * @param {Object} [produto={}] - Objeto produto
 * @param {Array} [opcoesAbaMenu=OPCOES_ABAS_MENU_PADRAO] - Lista de opções válidas
 * @returns {string} Chave da aba de menu (fallback: primeira aba padrão)
 *
 * Ordem de prioridade: menuTab > menuCategory > category > categoria > collection > tipo > type
 */
const resolverAbaMenuProduto = (produto = {}, opcoesAbaMenu = OPCOES_ABAS_MENU_PADRAO) => {
    const opcoes = Array.isArray(opcoesAbaMenu) && opcoesAbaMenu.length > 0
        ? opcoesAbaMenu
        : OPCOES_ABAS_MENU_PADRAO;
    const candidatos = [
        produto.menuTab,
        produto.menuCategory,
        produto.category,
        produto.categoria,
        produto.collection,
        produto.tipo,
        produto.type,
    ];
    for (const candidato of candidatos) {
        const chave = normalizarChaveAbaMenu(candidato, opcoes);
        if (chave) return chave;
    }
    // Fallback: primeira aba padrão
    return opcoes[0]?.key || OPCOES_ABAS_MENU_PADRAO[0].key;
};

/**
 * Normaliza produto para exibição no menu, garantindo campos menuTab e menuCategory.
 *
 * @param {Object} [produto={}] - Objeto produto original
 * @param {Array} [opcoesAbaMenu=OPCOES_ABAS_MENU_PADRAO] - Lista de opções válidas
 * @returns {Object} Produto com menuTab, menuCategory e category normalizados
 */
const normalizarProdutoParaMenu = (produto = {}, opcoesAbaMenu = OPCOES_ABAS_MENU_PADRAO) => {
    const abaMenu = resolverAbaMenuProduto(produto, opcoesAbaMenu);
    return {
        ...produto,
        menuTab: abaMenu,
        menuCategory: abaMenu,
        category: produto.category ?? abaMenu,
    };
};

/* ═══════════════════════════════════════════════════════════════════════
   5. IDENTIDADE DE PRODUTO (DEDUPLICAÇÃO)
   ═══════════════════════════════════════════════════════════════════════
   Chave de identidade composta por nome + aba + campanha + tamanho + peso.
   Usada para detectar produtos duplicados no catálogo. */

/**
 * Normaliza parte da identidade do produto (nome, tamanho, etc.).
 *
 * @param {*} valor - Qualquer valor (será normalizado para comparação)
 * @returns {string} Texto sem acentos, em minúsculas, espaços colapsados
 */
const normalizarParteIdentidadeProduto = (valor) => normalizarTexto(valor)
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Constrói chave de identidade para deduplicação de produtos.
 *
 * @param {Object} [produto={}] - Objeto produto
 * @param {Array} [opcoesAbaMenu=OPCOES_ABAS_MENU_PADRAO] - Lista de opções de aba
 * @returns {string} Chave composta (ex: "bolo de lanche::bolos-de-lanche::general::fatia::200g")
 *                   ou "code::SKU-123" se tem código explícito
 *
 * Prioridade: código (code/sku/productCode) > nome+aba+campanha+tamanho+peso
 */
const construirChaveIdentidadeProduto = (produto = {}, opcoesAbaMenu = OPCOES_ABAS_MENU_PADRAO) => {
    const codigoExplicito = normalizarParteIdentidadeProduto(produto.code || produto.sku || produto.productCode);
    if (codigoExplicito) return `code::${codigoExplicito}`;

    return [
        normalizarParteIdentidadeProduto(produto.name),
        normalizarChaveAbaMenu(resolverAbaMenuProduto(produto, opcoesAbaMenu), opcoesAbaMenu),
        normalizeCampaignId(produto.campaignId, CAMPAIGN_LEGACY_ID),
        normalizarParteIdentidadeProduto(produto.size),
        normalizarParteIdentidadeProduto(produto.weight),
    ].join('::');
};

/* ═══════════════════════════════════════════════════════════════════════
   6. SCORE DE COMPLETUDE E PREFERÊNCIA DE CANDIDATO
   ═══════════════════════════════════════════════════════════════════════
   Quando dois produtos têm a mesma chave de identidade, precisa decidir
   qual manter. O score de completude soma pontos por cada campo preenchido.
   Desempate por data de atualização mais recente. */

/**
 * Converte qualquer valor de data/timestamp para millis.
 *
 * @param {*} valor - Timestamp Firestore, Date, número ou string
 * @returns {number} Milissegundos desde epoch, ou 0 se inválido
 *
 * Versão local para o catálogo (não depende de getMillis do app.js).
 * Suporta: Date, Firestore Timestamp (.toDate ou .seconds+.nanoseconds),
 * número direto, string parseável.
 */
const obterTimestampMillis = (valor) => {
    if (!valor) return 0;
    if (valor instanceof Date) return valor.getTime();
    if (typeof valor?.toDate === 'function') return valor.toDate().getTime();
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
    if (typeof valor === 'string') {
        const parsed = Date.parse(valor);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    // Timestamp Firestore com campos seconds e nanoseconds
    if (typeof valor?.seconds === 'number') {
        const nanos = typeof valor.nanoseconds === 'number' ? valor.nanoseconds : 0;
        return (valor.seconds * 1000) + Math.floor(nanos / 1000000);
    }
    return 0;
};

/**
 * Calcula score de completude de um produto (quanto mais campos, maior).
 *
 * @param {Object} [produto={}] - Objeto produto
 * @returns {number} Score (imagens valem 50 pts cada, demais campos valem comprimento do texto)
 */
const calcularScoreCompletudeProduto = (produto = {}) => {
    const imagens = normalizarImagensProduto(produto);
    return (
        (imagens.length * 50) +
        safeText(produto.desc).trim().length +
        safeText(produto.tag).trim().length +
        safeText(produto.installment).trim().length +
        safeText(produto.size).trim().length +
        safeText(produto.weight).trim().length
    );
};

/**
 * Decide se o candidato deve ser preferido sobre o atual na deduplicação.
 *
 * @param {Object} [atual={}] - Produto atualmente selecionado
 * @param {Object} [candidato={}] - Produto candidato a substituir
 * @returns {boolean} true se candidato deve substituir atual
 *
 * Critérios (em ordem):
 * 1. updatedAt/createdAt mais recente
 * 2. Score de completude maior
 * 3. Empate: preferir candidato (dados mais novos tendem a ser mais completos)
 */
const devePreferirCandidatoProduto = (atual = {}, candidato = {}) => {
    const atualAtualizadoEm = obterTimestampMillis(atual.updatedAt) || obterTimestampMillis(atual.createdAt);
    const candidatoAtualizadoEm = obterTimestampMillis(candidato.updatedAt) || obterTimestampMillis(candidato.createdAt);
    // Primeiro critério: data de atualização mais recente
    if (candidatoAtualizadoEm !== atualAtualizadoEm) return candidatoAtualizadoEm > atualAtualizadoEm;

    // Segundo critério: score de completude
    const scoreAtual = calcularScoreCompletudeProduto(atual);
    const scoreCandidato = calcularScoreCompletudeProduto(candidato);
    if (scoreCandidato !== scoreAtual) return scoreCandidato > scoreAtual;

    // Empate: preferir candidato
    return true;
};

/* ═══════════════════════════════════════════════════════════════════════
   7. DEDUPLICAÇÃO DE PRODUTOS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Remove produtos duplicados do catálogo mantendo o mais completo/recente.
 *
 * @param {Array} [produtos=[]] - Lista de produtos (pode conter duplicatas)
 * @returns {Array} Lista deduplicada preservando ordem original
 *
 * Para cada grupo de produtos com a mesma chave de identidade,
 * mantém o que tem updatedAt mais recente ou score de completude maior.
 */
const deduplicarProdutosPorIdentidade = (produtos = []) => {
    const mapaDeduplicado = new Map();

    (Array.isArray(produtos) ? produtos : []).forEach((produto, indice) => {
        const chave = construirChaveIdentidadeProduto(produto);
        const existente = mapaDeduplicado.get(chave);
        if (!existente) {
            mapaDeduplicado.set(chave, { index: indice, product: produto });
            return;
        }
        // Se candidato é melhor, substitui mantendo índice original
        if (devePreferirCandidatoProduto(existente.product, produto)) {
            mapaDeduplicado.set(chave, { index: existente.index, product: produto });
        }
    });

    // Restaura ordem original pelo índice
    return Array.from(mapaDeduplicado.values())
        .sort((a, b) => a.index - b.index)
        .map((entrada) => entrada.product);
};

/* ═══════════════════════════════════════════════════════════════════════
   8. NORMALIZAÇÃO DE IMAGENS DO PRODUTO
   ═══════════════════════════════════════════════════════════════════════
   Produtos podem ter imagens em formatos variados (string, array, objeto,
   JSON embutido). Esta função normaliza tudo para um array de URLs. */

/**
 * Extrai e normaliza URLs de imagens de um produto.
 *
 * @param {Object} [produto={}] - Objeto produto com campos image e/ou images
 * @returns {Array<string>} Array de URLs de imagem únicas e válidas
 *
 * Formatos aceitos no campo images:
 * - String com URL única: "https://..."
 * - String com URLs separadas por \n, , ou ;: "url1\nurl2,url3"
 * - String com JSON: "[\"url1\",\"url2\"]"
 * - Array de strings: ["url1", "url2"]
 * - Array de objetos: [{ url: "..." }, { src: "..." }]
 * - Mistura dos acima (aninhamento)
 *
 * O campo image (singular) é sempre priorizado como primeira imagem.
 */
const normalizarImagensProduto = (produto = {}) => {
    const normalizadas = [];

    // Adiciona URL única se válida e não duplicada
    const adicionarImagem = (valor) => {
        const url = safeText(valor).trim();
        if (!url || normalizadas.includes(url)) return;
        normalizadas.push(url);
    };

    // Processa valor que pode ser string, array, objeto ou JSON embutido
    const adicionarColecao = (valor) => {
        if (!valor) return;
        // Array: processa recursivamente cada item
        if (Array.isArray(valor)) {
            valor.forEach(adicionarColecao);
            return;
        }
        // Objeto: extrai url, src ou image
        if (typeof valor === 'object') {
            adicionarImagem(valor.url || valor.src || valor.image);
            return;
        }
        const bruto = safeText(valor).trim();
        if (!bruto) return;
        // JSON embutido: tenta parsear
        if (bruto.startsWith('[') && bruto.endsWith(']')) {
            try {
                adicionarColecao(JSON.parse(bruto));
                return;
            } catch (_) {
                // Continua com o valor original se não for JSON válido
            }
        }
        // Múltiplas URLs separadas por \n, , ou ; (exceto data: URLs)
        if (/[\n,;]/.test(bruto) && !/^data:/i.test(bruto)) {
            bruto.split(/[\n,;]+/).forEach(adicionarImagem);
            return;
        }
        adicionarImagem(bruto);
    };

    // Prioriza campo image (singular) como primeira imagem
    adicionarImagem(produto.image);
    adicionarColecao(produto.images);
    return normalizadas;
};

/* ═══════════════════════════════════════════════════════════════════════
   EXPORTAÇÃO PÚBLICA
   ═══════════════════════════════════════════════════════════════════════ */
return {
    // Constantes de categoria
    CATEGORIAS,
    RECIPE_TYPES,
    rotuloCategoria,
    rotuloTipoReceita,
    corTipoReceita,

    // Constantes de unidades
    UNITS,
    CONVERSION_UNITS,

    // Abas do menu
    OPCOES_ABAS_MENU_PADRAO,
    rotuloAbaMenu,
    opcaoAbaMenu,
    mesclarOpcoesAbaMenu,
    descobrirAbasMenuDosProdutos,
    construirOpcoesAbaMenu,
    normalizarChaveAbaMenu,
    obterRotuloAbaMenu,

    // Resolução de aba do produto
    resolverAbaMenuProduto,
    normalizarProdutoParaMenu,

    // Identidade de produto
    normalizarParteIdentidadeProduto,
    construirChaveIdentidadeProduto,

    // Score e preferência
    obterTimestampMillis,
    calcularScoreCompletudeProduto,
    devePreferirCandidatoProduto,

    // Deduplicação
    deduplicarProdutosPorIdentidade,

    // Imagens
    normalizarImagensProduto,

    // Retrocompatibilidade: nomes antigos que outros módulos já usam
    catLabel: rotuloCategoria,
    typeLabel: rotuloTipoReceita,
    typeColor: corTipoReceita,
    DEFAULT_MENU_TAB_OPTIONS: OPCOES_ABAS_MENU_PADRAO,
    toMenuTabLabel: rotuloAbaMenu,
    toMenuTabOption: opcaoAbaMenu,
    mergeMenuTabOptions: mesclarOpcoesAbaMenu,
    collectMenuTabsFromProducts: descobrirAbasMenuDosProdutos,
    buildMenuTabOptions: construirOpcoesAbaMenu,
    normalizeMenuTabKey: normalizarChaveAbaMenu,
    getMenuTabLabel: obterRotuloAbaMenu,
    resolveProductMenuTab: resolverAbaMenuProduto,
    normalizeProductForMenu: normalizarProdutoParaMenu,
    normalizeProductIdentityPart: normalizarParteIdentidadeProduto,
    buildProductIdentityKey: construirChaveIdentidadeProduto,
    getTimestampMillis: obterTimestampMillis,
    getProductCompletenessScore: calcularScoreCompletudeProduto,
    shouldPreferProductCandidate: devePreferirCandidatoProduto,
    dedupeProductsByIdentity: deduplicarProdutosPorIdentidade,
    normalizeProductImages: normalizarImagensProduto,
};

})();
