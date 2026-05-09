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
  "use strict";

  const VitrineProdutos = React.memo(
    ({
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
      const safeTextFn =
        typeof safeText === "function"
          ? safeText
          : (val, fallback = "") => {
              if (val === null || val === undefined) return fallback;
              if (typeof val === "object") return fallback;
              return String(val);
            };
      /* ── Funções de normalização e montagem do menu ──────────────── */
      const buildMenuTabOptionsFn =
        typeof buildMenuTabOptions === "function"
          ? buildMenuTabOptions
          : () => [];
      const dedupeProductsByIdentityFn =
        typeof dedupeProductsByIdentity === "function"
          ? dedupeProductsByIdentity
          : (products) => (Array.isArray(products) ? products : []);
      const normalizeProductForMenuFn =
        typeof normalizeProductForMenu === "function"
          ? normalizeProductForMenu
          : (product) => product || {};
      const resolveProductMenuTabFn =
        typeof resolveProductMenuTab === "function"
          ? resolveProductMenuTab
          : (product, options = []) =>
              options[0]?.key ||
              safeTextFn(
                product?.category || product?.tipo || "all",
                "all",
              ).trim() ||
              "all";
      const getMenuTabLabelFn =
        typeof getMenuTabLabel === "function"
          ? getMenuTabLabel
          : (value) => safeTextFn(value, "Categoria");
      const normalizeProductImagesFn =
        typeof normalizeProductImages === "function"
          ? normalizeProductImages
          : (product) => {
              const images = [
                product?.image,
                product?.imageUrl,
                product?.photo,
                product?.photoUrl,
                product?.img,
              ].filter(Boolean);
              return images.length > 0 ? images.map(String) : [];
            };
      const fmtBRLFn =
        typeof fmtBRL === "function"
          ? fmtBRL
          : (value) =>
              (Number(value) || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
      const installmentTextFn =
        typeof installmentText === "function"
          ? installmentText
          : (price) => `3x de R$ ${fmtBRLFn((Number(price) || 0) / 3)}`;
      /* ── Componentes filhos (card e modal) ───────────────────────── */
      const ProductCardComponent =
        typeof ProductCard === "function" || typeof ProductCard === "object"
          ? ProductCard
          : () => null;
      const ProdutoModalComponent =
        typeof ProdutoModal === "function"
          ? ProdutoModal
          : null;
      /* ── Callbacks de ação ────────────────────────────────────────── */
      const onSearchTermChangeFn =
        typeof onSearchTermChange === "function"
          ? onSearchTermChange
          : () => {};
      const onAddToCartFn =
        typeof onAddToCart === "function" ? onAddToCart : () => {};

      /* ── Normalização dos dados de entrada ──────────────────────────
           Garante que filteredProducts é array e bestSellerNames é Set. */
      const normalizedProductsInput = Array.isArray(filteredProducts)
        ? filteredProducts
        : [];
      const bestSellerNamesSet =
        bestSellerNames instanceof Set ? bestSellerNames : new Set();

      /* ════════════════════════════════════════════════════════════════
           ESTADO DO COMPONENTE — Categoria selecionada e produto em detalhe
           ════════════════════════════════════════════════════════════════
           selectedCategory: qual aba de categoria está ativa ("all" = todas)
           selectedProduct: produto clicado para ver detalhes (null = fechado)
           ════════════════════════════════════════════════════════════════ */
      const [selectedCategory, setSelectedCategory] = React.useState("all");
      const [selectedProduct, setSelectedProduct] = React.useState(null);

      /* ── menuTabOptions: Lista de abas de categoria ─────────────────
           Gerada a partir das configurações do site e dos produtos.
           useMemo: só recalcula se settings ou produtos mudarem. */
      const menuTabOptions = React.useMemo(
        () =>
          buildMenuTabOptionsFn({
            siteSettings: settings,
            products: normalizedProductsInput,
          }),
        [settings, normalizedProductsInput, buildMenuTabOptionsFn],
      );

      /* ── normalizedFilteredProducts: Produtos sem duplicatas ────────
           Remove duplicatas (por identidade) e normaliza cada produto
           para o formato esperado pelo menu de categorias. */
      const normalizedFilteredProducts = React.useMemo(
        () =>
          dedupeProductsByIdentityFn(normalizedProductsInput).map((product) =>
            normalizeProductForMenuFn(product, menuTabOptions),
          ),
        [
          normalizedProductsInput,
          menuTabOptions,
          dedupeProductsByIdentityFn,
          normalizeProductForMenuFn,
        ],
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
        const orderedKeys = menuTabOptions
          .map((option) => option.key)
          .filter((key) => groupedKeys.includes(key));
        const unknownKeys = groupedKeys.filter(
          (key) => !orderedKeys.includes(key),
        );
        return ["all", ...orderedKeys, ...unknownKeys];
      }, [categoryGroups, menuTabOptions]);

      /* ── Efeito: reseta categoria se ela desaparecer ────────────────
           Se a categoria selecionada não existe mais na lista (ex: produto
           foi removido), volta para "all" automaticamente. */
      React.useEffect(() => {
        if (!categories.includes(selectedCategory)) setSelectedCategory("all");
      }, [categories, selectedCategory]);

      /* ── visibleProducts: Produtos visíveis na categoria atual ──────
           Se "all" → mostra todos. Se categoria específica → filtra. */
      const visibleProducts =
        selectedCategory === "all"
          ? normalizedFilteredProducts
          : categoryGroups[selectedCategory] || [];

      /* ── parseOptions: Converte string de opções em array ───────────
           Ex: "Chocolate|Morango|Baunilha" → ["Chocolate", "Morango", "Baunilha"]
           Suporta separadores: | (pipe), , (vírgula), / (barra).
           Usado para extrair opções de tamanho e sabor do produto. */
      const parseOptions = (value) => {
        const txt = safeTextFn(value).trim();
        if (!txt) return [];
        return txt
          .split(/\||,|\//)
          .map((part) => part.trim())
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
          {settings.enableAnnouncement &&
            safeTextFn(settings.announcementText) &&
            (() => {
              const annStyles = {
                info: {
                  bg: "#dbeafe",
                  color: "#1e40af",
                  border: "#bfdbfe",
                  icon: "ph-info",
                },
                success: {
                  bg: "#dcfce7",
                  color: "#166534",
                  border: "#bbf7d0",
                  icon: "ph-megaphone",
                },
                warning: {
                  bg: "#fef3c7",
                  color: "#92400e",
                  border: "#fde68a",
                  icon: "ph-warning",
                },
                gold: {
                  bg: "linear-gradient(135deg,#CFA860,#B58E45)",
                  color: "#fff",
                  border: "#B58E45",
                  icon: "ph-star",
                },
                dark: {
                  bg: "var(--primary)",
                  color: "var(--cream)",
                  border: "var(--primary)",
                  icon: "ph-megaphone",
                },
              };
              const s = annStyles[settings.announcementStyle] || annStyles.info;
              return (
                <div
                  className="premium-banner"
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <i
                    className={`ph-bold ${s.icon}`}
                    style={{ fontSize: "24px", color: s.color, flexShrink: 0 }}
                  ></i>
                  <p
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: s.color,
                      lineHeight: 1.5,
                      flex: 1,
                    }}
                  >
                    {settings.announcementText}
                  </p>
                </div>
              );
            })()}

          {enableScarcityBanner && (
            <div className="scarcity-banner">
              <div
                style={{
                  position: "absolute",
                  right: "-20px",
                  top: "-40px",
                  opacity: 0.1,
                  transform: "rotate(15deg)",
                  pointerEvents: "none",
                }}
              >
                <i className="ph-fill ph-egg" style={{ fontSize: "250px" }}></i>
              </div>
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    background: "var(--primary)",
                    color: "var(--cream)",
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    fontSize: "11px",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)",
                  }}
                >
                  <i
                    className="ph-bold ph-alarm"
                    style={{ fontSize: "16px" }}
                  ></i>{" "}
                  {deadlinePassed ? "Pedidos encerrados" : deadlineLabelBanner}
                </div>

                <h2
                  style={{
                    fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                    fontWeight: "900",
                    lineHeight: 1.1,
                    textShadow: "0 2px 4px rgba(255,255,255,.4)",
                    marginTop: "4px",
                    minHeight: "38px",
                  }}
                >
                  {!ordersLoaded
                    ? "A verificar disponibilidade..."
                    : remainingUnits > 0 && !deadlinePassed
                      ? `Corra! Restam apenas ${remainingUnits} unidades`
                      : "Vendas Encerradas!"}
                </h2>

                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    maxWidth: "580px",
                    opacity: 0.9,
                  }}
                >
                  {!ordersLoaded
                    ? "Por favor, aguarde um momento enquanto calculamos o stock em tempo real."
                    : remainingUnits > 0 && !deadlinePassed
                      ? "A nossa produção é estritamente limitada para garantir a qualidade premium em cada ovo. Garanta o seu antes que o lote esgote!"
                      : deadlinePassed
                        ? "O prazo de pedidos encerrou. Muito obrigado pela preferência e confiança!"
                        : "Atingimos a nossa capacidade máxima de produção. Muito obrigado pela confiança!"}
                </p>

                {ordersLoaded && (
                  <>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "400px",
                        background: "rgba(28,38,56,.15)",
                        borderRadius: "9999px",
                        height: "12px",
                        marginTop: "8px",
                        overflow: "hidden",
                        border: "1px solid rgba(28,38,56,.1)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          background: "var(--primary)",
                          width: `${progressPercent}%`,
                          borderRadius: "9999px",
                          transition: "width 1.5s ease-in-out",
                        }}
                      ></div>
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        marginTop: "4px",
                      }}
                    >
                      {deadlinePassed
                        ? "Prazo encerrado"
                        : `Restam ${remainingUnits} unidades disponíveis`}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bloco compacto de confiança: mostra os 3 argumentos de venda e deixa regras operacionais recolhidas no mobile. */}
          <div className="ribbon-knot policy-banner">
            <div className="policy-heading">
              <p className="policy-eyebrow">Como funciona seu pedido</p>
              <h2 className="policy-title">
                Compra simples, atendimento próximo e acabamento premium.
              </h2>
            </div>

            <div className="policy-highlights">
              {[
                {
                  icon: "ph-seal-check",
                  title: "Artesanal premium",
                  text: "Produtos feitos sob encomenda, com padrão de qualidade e cuidado em cada detalhe.",
                },
                {
                  icon: "ph-truck",
                  title: "Entrega ou retirada",
                  text: "Escolha receber com taxa fixa de R$ 2,00 ou retirar no local em horário combinado.",
                },
                {
                  icon: "ph-whatsapp-logo",
                  title: "Atendimento pelo WhatsApp",
                  text: "Dúvidas, ajustes e detalhes do pedido são combinados diretamente com a Helô.",
                },
              ].map(({ icon, title, text }, i) => (
                <div key={i} className="policy-highlight-item">
                  <span className="policy-icon">
                    <i className={`ph-bold ${icon}`}></i>
                  </span>
                  <div>
                    <p className="policy-item-title">{title}</p>
                    <p className="policy-item-text">{text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Políticas ficam sob demanda para informar sem atrasar a navegação até a vitrine. */}
            <details className="policy-details">
              <summary>Ver políticas do pedido</summary>
              <div className="policy-details-grid">
                {[
                  {
                    icon: "ph-calendar-check",
                    title: "Encomendas maiores",
                    text: "Bolos de festa e pedidos personalizados precisam ser combinados com antecedência.",
                  },
                  {
                    icon: "ph-map-pin",
                    title: "Retirada agendada",
                    text: "Retiradas são feitas no horário previamente combinado para manter organização e pontualidade.",
                  },
                  {
                    icon: "ph-list",
                    title: "Personalizações",
                    text: "Ajustes específicos para eventos devem ser confirmados no atendimento antes da finalização.",
                  },
                  {
                    icon: "ph-arrow-u-up-left",
                    title: "Cancelamentos",
                    text: "Desistências até 3 dias antes geram crédito válido por 2 meses. Após esse prazo, sem devolução.",
                  },
                ].map(({ icon, title, text }, i) => (
                  <div key={i} className="policy-detail-item">
                    <i className={`ph-bold ${icon}`}></i>
                    <div>
                      <p className="policy-item-title">{title}</p>
                      <p className="policy-item-text">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="search-shell">
            <i
              className="ph-bold ph-magnifying-glass"
              style={{ color: "var(--cream)", fontSize: "20px" }}
            ></i>
            <input
              type="text"
              placeholder="Procurar um sabor..."
              style={{
                background: "none",
                border: "none",
                color: "var(--cream)",
                outline: "none",
                width: "100%",
                padding: "0 8px",
                fontFamily: "inherit",
                fontSize: "14px",
              }}
              value={searchTerm}
              onChange={(e) => onSearchTermChangeFn(e.target.value)}
            />
          </div>

          <div
            style={{
              gridColumn: "1/-1",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "4px",
            }}
          >
            {categories.map((cat) => {
              const active = cat === selectedCategory;
              const label =
                cat === "all"
                  ? "Todas as categorias"
                  : getMenuTabLabelFn(cat, menuTabOptions);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-pill${active ? " active" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              gridColumn: "1/-1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <h3
              className="brand-copy catalog-premium-title"
              style={{
                fontSize: "1rem",
                fontWeight: "900",
                letterSpacing: ".02em",
              }}
            >
              {selectedCategory === "all"
                ? "Vitrine completa"
                : getMenuTabLabelFn(selectedCategory, menuTabOptions)}
            </h3>
            <span
              className="catalog-premium-meta"
              style={{ fontSize: "12px", fontWeight: "700" }}
            >
              {visibleProducts.length} item(ns)
            </span>
          </div>

          {/* ── Skeleton Loader: exibido enquanto catálogo não carregou ── */}
          {!catalogLoaded ? (
            <div
              className="catalog-skeleton-grid"
              style={{ gridColumn: "1/-1" }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img skeleton-shimmer"></div>
                  <div className="skeleton-body">
                    <div
                      className="skeleton-line skeleton-shimmer"
                      style={{ width: "70%" }}
                    ></div>
                    <div
                      className="skeleton-line skeleton-shimmer"
                      style={{ width: "45%", height: "12px", marginTop: "8px" }}
                    ></div>
                    <div
                      className="skeleton-line skeleton-shimmer"
                      style={{
                        width: "30%",
                        height: "14px",
                        marginTop: "10px",
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            visibleProducts.map((p) => (
              <ProductCardComponent
                key={p.id}
                product={p}
                onAdd={onAddToCartFn}
                onOpenDetails={setSelectedProduct}
                isBestSeller={bestSellerNamesSet.has(safeTextFn(p.name).trim())}
                normalizeProductImages={normalizeProductImagesFn}
                safeText={safeTextFn}
                installmentText={installmentTextFn}
                fmtBRL={fmtBRLFn}
              />
            ))
          ) : (
            // Vitrine vazia: exibe mascote Helo centralizada e mensagem amigável
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                padding: "40px 20px",
                background: "transparent",
              }}
            >
              <img
                src="./mascote-helo.png"
                alt="Vitrine vazia - Mascote Helo"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "clamp(250px, 60vw, 500px)",
                }}
              />
              <p
                style={{
                  marginTop: "20px",
                  color: "var(--cream)",
                  fontSize: "clamp(15px, 4.5vw, 18px)",
                  fontWeight: "800",
                  textShadow:
                    "0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(42,61,93,0.6)",
                  letterSpacing: "0.5px",
                  lineHeight: "1.6",
                }}
              >
                Nossas delícias estão saindo do forno. Volte em breve para
                conferir!
              </p>
            </div>
          )}

          {selectedProduct &&
            (() => {
              const sizeOptions = parseOptions(selectedProduct.size);
              const flavorOptions = parseOptions(
                selectedProduct.flavors ||
                  selectedProduct.sabores ||
                  selectedProduct.tag,
              );

              if (ProdutoModalComponent) {
                return (
                  <ProdutoModalComponent
                    product={selectedProduct}
                    sizeOptions={sizeOptions}
                    flavorOptions={flavorOptions}
                    onClose={() => setSelectedProduct(null)}
                    onAdd={(payload) => {
                      onAddToCartFn(payload);
                      setSelectedProduct(null);
                    }}
                  />
                );
              }

              const detailImages = normalizeProductImagesFn(selectedProduct);
              const detailImage = detailImages[0] || "./mascote-helo.png";

              return (
                <div style={{ position: "fixed", inset: 0, zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                  <div style={{ position: "absolute", inset: 0, background: "rgba(17,24,39,.65)", backdropFilter: "blur(3px)" }} onClick={() => setSelectedProduct(null)}></div>
                  <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "520px", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto", background: "#fff", borderRadius: "18px", border: "1px solid #dbe4f4", boxShadow: "0 30px 60px -24px rgba(42,61,93,.38)" }}>
                    <button aria-label="Fechar detalhes" onClick={() => setSelectedProduct(null)} style={{ position: "absolute", top: "12px", right: "12px", width: "34px", height: "34px", borderRadius: "50%", border: "none", background: "rgba(17,24,39,.75)", color: "#fff", cursor: "pointer", zIndex: 2 }}>
                      <i className="ph-bold ph-x" style={{ fontSize: "18px" }}></i>
                    </button>
                    <div style={{ height: "260px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
                      <img src={detailImage} alt={safeTextFn(selectedProduct.name)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
                    </div>
                    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <h3 className="brand-copy" style={{ color: "var(--primary)", fontSize: "1.45rem", fontWeight: 900, lineHeight: 1.2 }}>{safeTextFn(selectedProduct.name)}</h3>
                      <p style={{ color: "var(--s500)", fontSize: "14px", lineHeight: 1.55 }}>{safeTextFn(selectedProduct.desc, safeTextFn(selectedProduct.weight, "Doce artesanal da Helo Confeitaria."))}</p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {[...sizeOptions, ...flavorOptions].map((option) => (
                          <span key={option} style={{ fontSize: "11px", fontWeight: 800, color: "var(--primary)", background: "#eef3fb", border: "1px solid #d9e4f6", padding: "6px 10px", borderRadius: "9999px" }}>{option}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                        <div>
                          <p style={{ fontSize: "12px", color: "var(--s500)", fontWeight: 700 }}>Preco</p>
                          <p style={{ fontSize: "1.5rem", color: "var(--gold)", fontWeight: 900 }}>R$ {fmtBRLFn(selectedProduct.price)}</p>
                        </div>
                        <button onClick={() => { onAddToCartFn(selectedProduct); setSelectedProduct(null); }} className="cta-gold" style={{ padding: "12px 16px", borderRadius: "12px", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                          <i className="ph-bold ph-shopping-cart" style={{ fontSize: "18px" }}></i> Comprar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      );
    },
  );

  /* ── Registra o componente no namespace global ──────────────────── */
  globalScope.HeloComponents = {
    ...(globalScope.HeloComponents || {}),
    VitrineProdutos,
  };
})(window);
