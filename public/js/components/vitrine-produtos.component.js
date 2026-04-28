/* ═══════════════════════════════════════════════════════════════════════
   vitrine-produtos.component.js — COMPONENTE DA VITRINE DE PRODUTOS
   ═══════════════════════════════════════════════════════════════════════
   Este é o componente principal da área de vendas do site. Ele monta a
   vitrine completa com:

   1. Banner de anúncio (configurável pelo admin — info/success/warning/gold/dark)
   2. Banner de escassez ("Restam apenas X unidades!" com barra de progresso)
   3. Política de pedidos (informações importantes em grid)
   4. Campo de busca por sabor
   5. Abas de categoria (filtro por tipo de produto)
   6. Grid de cards de produto (usando ProductCard)
   7. Modal de detalhes do produto (usando ProdutoModal)

   Props principais:
   - siteSettings         → Configurações do site (anúncio, etc.)
   - enableScarcityBanner → Mostra banner de escassez?
   - deadlinePassed       → Prazo de pedidos encerrou?
   - remainingUnits       → Unidades restantes
   - searchTerm           → Texto da busca
   - filteredProducts     → Lista de produtos já filtrados
   - onAddToCart          → Função para adicionar ao carrinho
   - bestSellerNames      → Set com nomes dos mais vendidos
   - buildMenuTabOptions  → Função que cria as abas de categoria
   - ProductCard          → Componente de card de produto
   - ProdutoModal         → Componente de modal de detalhes
   ═══════════════════════════════════════════════════════════════════════ */
(function initVitrineProdutosComponent(globalScope) {
    'use strict';

    const VitrineProdutos = React.memo(({
        siteSettings,
        safeText,
        enableScarcityBanner,
        deadlinePassed,
        deadlineLabelBanner,
        ordersLoaded,
        catalogLoaded,
        remainingUnits,
        progressPercent,
        searchTerm,
        onSearchTermChange,
        filteredProducts,
        onAddToCart,
        bestSellerNames,
        buildMenuTabOptions,
        dedupeProductsByIdentity,
        normalizeProductForMenu,
        resolveProductMenuTab,
        getMenuTabLabel,
        normalizeProductImages,
        installmentText,
        fmtBRL,
        ProductCard,
        ProdutoModal,
    }) => {

        /* ════════════════════════════════════════════════════════════════
           FALLBACKS DE FUNÇÕES E COMPONENTES
           ════════════════════════════════════════════════════════════════
           Cada prop recebida é verificada com typeof. Se não foi passada,
           usamos uma versão simples local. Isso garante que o componente
           nunca quebre por falta de uma dependência.
           ════════════════════════════════════════════════════════════════ */
        const settings = siteSettings || {};
        const safeTextFn = typeof safeText === 'function'
            ? safeText
            : ((val, fallback = '') => {
                if (val === null || val === undefined) return fallback;
                if (typeof val === 'object') return fallback;
                return String(val);
            });
        /* ── Funções de normalização e montagem do menu ──────────────── */
        const buildMenuTabOptionsFn = typeof buildMenuTabOptions === 'function'
            ? buildMenuTabOptions
            : (() => []);
        const dedupeProductsByIdentityFn = typeof dedupeProductsByIdentity === 'function'
            ? dedupeProductsByIdentity
            : ((products) => Array.isArray(products) ? products : []);
        const normalizeProductForMenuFn = typeof normalizeProductForMenu === 'function'
            ? normalizeProductForMenu
            : ((product) => product || {});
        const resolveProductMenuTabFn = typeof resolveProductMenuTab === 'function'
            ? resolveProductMenuTab
            : ((product, options = []) => options[0]?.key || safeTextFn(product?.category || product?.tipo || 'all', 'all').trim() || 'all');
        const getMenuTabLabelFn = typeof getMenuTabLabel === 'function'
            ? getMenuTabLabel
            : ((value) => safeTextFn(value, 'Categoria'));
        /* ── Componentes filhos (card e modal) ───────────────────────── */
        const ProductCardComponent = (typeof ProductCard === 'function' || typeof ProductCard === 'object')
            ? ProductCard
            : (() => null);
        const ProdutoModalComponent = (typeof ProdutoModal === 'function' || typeof ProdutoModal === 'object')
            ? ProdutoModal
            : (() => null);
        /* ── Callbacks de ação ────────────────────────────────────────── */
        const onSearchTermChangeFn = typeof onSearchTermChange === 'function'
            ? onSearchTermChange
            : (() => {});
        const onAddToCartFn = typeof onAddToCart === 'function'
            ? onAddToCart
            : (() => {});

        /* ── Normalização dos dados de entrada ──────────────────────────
           Garante que filteredProducts é array e bestSellerNames é Set. */
        const normalizedProductsInput = Array.isArray(filteredProducts) ? filteredProducts : [];
        const bestSellerNamesSet = bestSellerNames instanceof Set ? bestSellerNames : new Set();

        /* ════════════════════════════════════════════════════════════════
           ESTADO DO COMPONENTE — Categoria selecionada e produto em detalhe
           ════════════════════════════════════════════════════════════════
           selectedCategory: qual aba de categoria está ativa ("all" = todas)
           selectedProduct: produto clicado para ver detalhes (null = fechado)
           ════════════════════════════════════════════════════════════════ */
        const [selectedCategory, setSelectedCategory] = React.useState('all');
        const [selectedProduct, setSelectedProduct] = React.useState(null);

        /* ── menuTabOptions: Lista de abas de categoria ─────────────────
           Gerada a partir das configurações do site e dos produtos.
           useMemo: só recalcula se settings ou produtos mudarem. */
        const menuTabOptions = React.useMemo(
            () => buildMenuTabOptionsFn({ siteSettings: settings, products: normalizedProductsInput }),
            [settings, normalizedProductsInput, buildMenuTabOptionsFn],
        );

        /* ── normalizedFilteredProducts: Produtos sem duplicatas ────────
           Remove duplicatas (por identidade) e normaliza cada produto
           para o formato esperado pelo menu de categorias. */
        const normalizedFilteredProducts = React.useMemo(
            () => dedupeProductsByIdentityFn(normalizedProductsInput).map(product => normalizeProductForMenuFn(product, menuTabOptions)),
            [normalizedProductsInput, menuTabOptions, dedupeProductsByIdentityFn, normalizeProductForMenuFn],
        );

        /* ── categoryGroups: Produtos agrupados por categoria ───────────
           Ex: { "bolos": [produto1, produto2], "salgados": [produto3] }
           Usado para filtrar os produtos quando o usuário clica numa aba. */
        const categoryGroups = React.useMemo(() => {
            const groups = {};
            normalizedFilteredProducts.forEach((p) => {
                const key = resolveProductMenuTabFn(p, menuTabOptions);
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
            });
            return groups;
        }, [normalizedFilteredProducts, menuTabOptions, resolveProductMenuTabFn]);

        /* ── categories: Lista ordenada de categorias ──────────────────
           Ordem: "all" primeiro, depois as categorias definidas no menu,
           depois categorias desconhecidas (que não estão no menu). */
        const categories = React.useMemo(() => {
            const groupedKeys = Object.keys(categoryGroups);
            const orderedKeys = menuTabOptions.map(option => option.key).filter((key) => groupedKeys.includes(key));
            const unknownKeys = groupedKeys.filter((key) => !orderedKeys.includes(key));
            return ['all', ...orderedKeys, ...unknownKeys];
        }, [categoryGroups, menuTabOptions]);

        /* ── Efeito: reseta categoria se ela desaparecer ────────────────
           Se a categoria selecionada não existe mais na lista (ex: produto
           foi removido), volta para "all" automaticamente. */
        React.useEffect(() => {
            if (!categories.includes(selectedCategory)) setSelectedCategory('all');
        }, [categories, selectedCategory]);

        /* ── visibleProducts: Produtos visíveis na categoria atual ──────
           Se "all" → mostra todos. Se categoria específica → filtra. */
        const visibleProducts = selectedCategory === 'all'
            ? normalizedFilteredProducts
            : (categoryGroups[selectedCategory] || []);

        /* ── parseOptions: Converte string de opções em array ───────────
           Ex: "Chocolate|Morango|Baunilha" → ["Chocolate", "Morango", "Baunilha"]
           Suporta separadores: | (pipe), , (vírgula), / (barra).
           Usado para extrair opções de tamanho e sabor do produto. */
        const parseOptions = (value) => {
            const txt = safeTextFn(value).trim();
            if (!txt) return [];
            return txt
                .split(/\||,|\//)
                .map(part => part.trim())
                .filter(Boolean);
        };

        /* ════════════════════════════════════════════════════════════════
           ESTRUTURA DO JSX — Seções da vitrine
           ══════════════════════════════════════════════════════════════════
           1. Banner de anúncio (se habilitado nas configurações)
              - Estilos: info (azul), success (verde), warning (amarelo),
                gold (dourado), dark (cores da marca)
           2. Banner de escassez (se habilitado)
              - Badge de prazo, título dinâmico, barra de progresso
              - Mostra unidades restantes e se prazo encerrou
           3. Política de pedidos (grid com 8 informações importantes)
           4. Campo de busca por sabor
           5. Abas de categoria (pills clicáveis)
           6. Título da seção + contagem de itens
           7. Grid de cards de produto (ou mensagem "nenhum item")
           8. Modal de detalhes (se produto selecionado)
           ══════════════════════════════════════════════════════════════════ */
        return (
            <div className="catalog-shell">
                {settings.enableAnnouncement && safeTextFn(settings.announcementText) && (() => {
                    const annStyles = {
                        info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', icon: 'ph-info' },
                        success: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: 'ph-megaphone' },
                        warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: 'ph-warning' },
                        gold: { bg: 'linear-gradient(135deg,#CFA860,#B58E45)', color: '#fff', border: '#B58E45', icon: 'ph-star' },
                        dark: { bg: 'var(--primary)', color: 'var(--cream)', border: 'var(--primary)', icon: 'ph-megaphone' },
                    };
                    const s = annStyles[settings.announcementStyle] || annStyles.info;
                    return (
                        <div className="premium-banner" style={{ background: s.bg, border: `1px solid ${s.border}`, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <i className={`ph-bold ${s.icon}`} style={{ fontSize: '24px', color: s.color, flexShrink: 0 }}></i>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: s.color, lineHeight: 1.5, flex: 1 }}>{settings.announcementText}</p>
                        </div>
                    );
                })()}

                {enableScarcityBanner && (
                    <div className="scarcity-banner">
                        <div style={{ position: 'absolute', right: '-20px', top: '-40px', opacity: 0.1, transform: 'rotate(15deg)', pointerEvents: 'none' }}>
                            <i className="ph-fill ph-egg" style={{ fontSize: '250px' }}></i>
                        </div>
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--cream)', padding: '6px 16px', borderRadius: '9999px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.1em', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}>
                                <i className="ph-bold ph-alarm" style={{ fontSize: '16px' }}></i> {deadlinePassed ? 'Pedidos encerrados' : deadlineLabelBanner}
                            </div>

                            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: '900', lineHeight: 1.1, textShadow: '0 2px 4px rgba(255,255,255,.4)', marginTop: '4px', minHeight: '38px' }}>
                                {!ordersLoaded ? 'A verificar disponibilidade...' : (remainingUnits > 0 && !deadlinePassed) ? `Corra! Restam apenas ${remainingUnits} unidades` : 'Vendas Encerradas!'}
                            </h2>

                            <p style={{ fontSize: '14px', fontWeight: '600', maxWidth: '580px', opacity: 0.9 }}>
                                {!ordersLoaded
                                    ? 'Por favor, aguarde um momento enquanto calculamos o stock em tempo real.'
                                    : (remainingUnits > 0 && !deadlinePassed)
                                        ? 'A nossa produção é estritamente limitada para garantir a qualidade premium em cada ovo. Garanta o seu antes que o lote esgote!'
                                        : deadlinePassed
                                            ? 'O prazo de pedidos encerrou. Muito obrigado pela preferência e confiança!'
                                            : 'Atingimos a nossa capacidade máxima de produção. Muito obrigado pela confiança!'}
                            </p>

                            {ordersLoaded && (
                                <>
                                    <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(28,38,56,.15)', borderRadius: '9999px', height: '12px', marginTop: '8px', overflow: 'hidden', border: '1px solid rgba(28,38,56,.1)' }}>
                                        <div style={{ height: '100%', background: 'var(--primary)', width: `${progressPercent}%`, borderRadius: '9999px', transition: 'width 1.5s ease-in-out' }}></div>
                                    </div>
                                    <p style={{ fontSize: '12px', fontWeight: '800', marginTop: '4px' }}>
                                        {deadlinePassed ? 'Prazo encerrado' : `Restam ${remainingUnits} unidades disponíveis`}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="ribbon-knot policy-banner">
                    <p style={{ fontSize: '11px', color: 'var(--cream)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: '800', marginBottom: '1rem' }}>📋 Informações importantes</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
                        {[
                            { icon: 'ph-calendar-check', title: 'Pedidos', text: 'Recebemos pedidos todos os dias! Para bolos de festa ou encomendas maiores, pedimos que nos avise com um pouco de antecedência.' },
                            { icon: 'ph-seal-check', title: 'Qualidade Premium', text: 'Tudo aqui é feito com muito carinho, de forma artesanal e sempre com ingredientes de primeira.' },
                            { icon: 'ph-snowflake', title: 'Conservação', text: 'Recomendamos guardar os doces na geladeira para manter o frescor. Qualquer dúvida sobre a validade, é só chamar a gente!' },
                            { icon: 'ph-arrow-u-up-left', title: 'Cancelamentos', text: 'Desistências até 3 dias antes geram crédito válido por 2 meses. Após esse prazo, sem devolução.' },
                            { icon: 'ph-truck', title: 'Taxa de entrega', text: 'Entregas com taxa fixa de R$ 2,00, feitas pelo nosso motorista de confiança.' },
                            { icon: 'ph-map-pin', title: 'Retiradas no local', text: 'As retiradas devem ser feitas no horário previamente agendado. Seu pedido será entregue com segurança em nossas embalagens.' },
                            { icon: 'ph-list', title: 'Cardápio', text: 'Trabalhamos com um cardápio padrão. Personalizações específicas para eventos devem ser combinadas no momento da encomenda.' },
                            { icon: 'ph-chat-circle-dots', title: 'Dúvidas?', text: 'Tem alguma dúvida? Envie uma mensagem para a gente! Estamos aqui para ajudar.' },
                        ].map(({ icon, title, text }, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <i className={`ph-bold ${icon}`} style={{ fontSize: '18px', color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }}></i>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--cream)', marginBottom: '2px' }}>{title}</p>
                                    <p style={{ fontSize: '11px', color: 'rgba(243, 212, 148, 0.9)', lineHeight: 1.5 }}>{text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="search-shell">
                    <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--cream)', fontSize: '20px' }}></i>
                    <input type="text" placeholder="Procurar um sabor..."
                        style={{ background: 'none', border: 'none', color: 'var(--cream)', outline: 'none', width: '100%', padding: '0 8px', fontFamily: 'inherit', fontSize: '14px' }}
                        value={searchTerm} onChange={e => onSearchTermChangeFn(e.target.value)} />
                </div>

                <div style={{ gridColumn: '1/-1', display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {categories.map((cat) => {
                        const active = cat === selectedCategory;
                        const label = cat === 'all' ? 'Todas as categorias' : getMenuTabLabelFn(cat, menuTabOptions);
                        return (
                            <button key={cat} onClick={() => setSelectedCategory(cat)}
                                className={`category-pill${active ? ' active' : ''}`}>
                                {label}
                            </button>
                        );
                    })}
                </div>

                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 className="brand-copy catalog-premium-title" style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '.02em' }}>
                        {selectedCategory === 'all' ? 'Vitrine completa' : getMenuTabLabelFn(selectedCategory, menuTabOptions)}
                    </h3>
                    <span className="catalog-premium-meta" style={{ fontSize: '12px', fontWeight: '700' }}>{visibleProducts.length} item(ns)</span>
                </div>

                {/* ── Skeleton Loader: exibido enquanto catálogo não carregou ── */}
                {!catalogLoaded ? (
                    <div className="catalog-skeleton-grid" style={{ gridColumn: '1/-1' }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="skeleton-card">
                                <div className="skeleton-img skeleton-shimmer"></div>
                                <div className="skeleton-body">
                                    <div className="skeleton-line skeleton-shimmer" style={{ width: '70%' }}></div>
                                    <div className="skeleton-line skeleton-shimmer" style={{ width: '45%', height: '12px', marginTop: '8px' }}></div>
                                    <div className="skeleton-line skeleton-shimmer" style={{ width: '30%', height: '14px', marginTop: '10px' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : visibleProducts.length > 0 ? visibleProducts.map(p => <ProductCardComponent key={p.id} product={p} onAdd={onAddToCartFn} onOpenDetails={setSelectedProduct} isBestSeller={bestSellerNamesSet.has(safeTextFn(p.name).trim())} normalizeProductImages={normalizeProductImages} safeText={safeTextFn} installmentText={installmentText} fmtBRL={fmtBRL} />) : (
                    <div style={{ gridColumn: '1/-1', border: '1px dashed #d6deeb', background: '#f8fafc', color: 'var(--s500)', borderRadius: '18px', padding: '20px', textAlign: 'center' }}>
                        Nenhum item disponível em {selectedCategory === 'all' ? 'todas as categorias' : getMenuTabLabelFn(selectedCategory, menuTabOptions)} no momento.
                    </div>
                )}

                {selectedProduct && (
                    <ProdutoModalComponent
                        product={selectedProduct}
                        sizeOptions={parseOptions(selectedProduct.size)}
                        flavorOptions={parseOptions(selectedProduct.flavors || selectedProduct.sabores || selectedProduct.tag)}
                        onClose={() => setSelectedProduct(null)}
                        onAdd={(payload) => {
                            onAddToCartFn(payload);
                            setSelectedProduct(null);
                        }}
                    />
                )}
            </div>
        );
    });

    /* ── Registra o componente no namespace global ──────────────────── */
    globalScope.HeloComponents = {
        ...(globalScope.HeloComponents || {}),
        VitrineProdutos,
    };
})(window);
