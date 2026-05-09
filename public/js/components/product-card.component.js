/* ═══════════════════════════════════════════════════════════════════════
   product-card.component.js — COMPONENTE DO CARD DE PRODUTO
   ═══════════════════════════════════════════════════════════════════════
   Renderiza um card (cartão) individual de produto na vitrine.
   É o componente mais rico visualmente — inclui:

   1. Galeria de imagens com navegação (setas + indicadores)
   2. Badge "O queridinho do momento" para best-sellers
   3. Badge de categoria (ex: "BOLOS", "SALGADOS")
   4. Badge de tamanho/peso
   5. Indicador de estoque baixo ("Últimas X unidades!")
   6. Overlay de "ESGOTADO" quando estoque = 0
   7. Preço e parcelamento
   8. Botões "Detalhes" e "Comprar"

   Props:
   - product              → Objeto do produto (id, name, price, images, etc.)
   - onAdd                → Função para adicionar ao carrinho
   - onOpenDetails        → Função para abrir modal de detalhes
   - isBestSeller         → Se é o mais vendido (mostra badge dourado)
   - normalizeProductImages → Função que normaliza lista de imagens
   - safeText             → Função de texto seguro (fallback se null)
   - installmentText      → Função que gera texto de parcelamento
   - fmtBRL               → Função que formata número como moeda BR
   ═══════════════════════════════════════════════════════════════════════ */
(function initProductCardComponent(globalScope) {
    'use strict';

    const ProductCard = React.memo(({
        product: p,
        onAdd,
        onOpenDetails,
        isBestSeller,
        normalizeProductImages,
        safeText,
        installmentText,
        fmtBRL,
    }) => {

        /* ════════════════════════════════════════════════════════════════
           FALLBACKS DE FUNÇÕES — Segurança caso as props não sejam passadas
           ════════════════════════════════════════════════════════════════
           Cada função recebida via prop é verificada com typeof. Se não
           foi passada (ou não é função), usamos uma versão simples local.
           Isso evita erros do tipo "undefined is not a function".
           ════════════════════════════════════════════════════════════════ */
        const normalizeImages = typeof normalizeProductImages === 'function'
            ? normalizeProductImages
            : (() => []);
        const safeTextFn = typeof safeText === 'function'
            ? safeText
            : ((val, fallback = '') => {
                if (val === null || val === undefined) return fallback;
                if (typeof val === 'object') return fallback;
                return String(val);
            });
        const installmentTextFn = typeof installmentText === 'function'
            ? installmentText
            : ((price) => `${price || 0}`);
        const fmtBRLFn = typeof fmtBRL === 'function'
            ? fmtBRL
            : ((n) => Number(n || 0).toFixed(2).replace('.', ','));
        const buildResponsiveSourcesFn = typeof window?.HeloCatalog?.buildResponsiveProductImageSources === 'function'
            ? window.HeloCatalog.buildResponsiveProductImageSources
            : ((imageUrl) => ({ src: imageUrl, srcSet: '', sizes: '' }));

        /* ════════════════════════════════════════════════════════════════
           GALERIA DE IMAGENS — Lista de fotos do produto
           ════════════════════════════════════════════════════════════════
           normalizeImages(p) retorna a lista de URLs de imagem do produto.
           Se o produto não tem imagens, usa uma imagem padrão do Unsplash.
           useMemo: só recalcula se as imagens do produto mudarem.
           ════════════════════════════════════════════════════════════════ */
        const allImages = React.useMemo(() => {
            const imgs = normalizeImages(p);
            return imgs.length > 0 ? imgs : ['https://images.unsplash.com/photo-1544923246-77307dd654ca?w=400'];
        }, [p.images, p.image, normalizeImages]);

        /* ── Estado da galeria: qual imagem está sendo exibida ──────── */
        const [imgIdx, setImgIdx] = React.useState(0);

        /* ── Proporção da imagem (largura/altura) para ajustar o card ──
           Calculado quando a imagem carrega (onLoad). Usado para decidir
           a altura do container da imagem — imagens horizontais ficam
           mais baixas, imagens verticais ficam mais altas. */
        const [currentImageRatio, setCurrentImageRatio] = React.useState(1);

        const total = allImages.length; /* Total de imagens na galeria */
        const currentImageSources = React.useMemo(() => {
            const activeImage = allImages[imgIdx] || '';
            return buildResponsiveSourcesFn(activeImage);
        }, [allImages, imgIdx, buildResponsiveSourcesFn]);

        /* ── Navegação da galeria: anterior e próxima ──────────────────
           % total garante que volta ao início/fim (carousel circular).
           e.stopPropagation() impede que o clique abra os detalhes. */
        const prevImg = (e) => { e.stopPropagation(); setImgIdx(i => (i - 1 + total) % total); };
        const nextImg = (e) => { e.stopPropagation(); setImgIdx(i => (i + 1) % total); };

        /* ── Altura e padding do card baseados na proporção da imagem ──
           Imagem "deitada" (ratio ≤ 0.78) → card mais alto (16rem)
           Imagem "em pé" (ratio ≥ 1.55) → card mais baixo (12.8rem)
           Imagem quadrada → altura média (14.4rem) */
        const cardImageHeight = currentImageRatio <= 0.78 ? '16rem' : currentImageRatio >= 1.55 ? '12.8rem' : '14.4rem';
        const cardImagePadding = currentImageRatio <= 0.78 ? '8px' : '10px';

        /* ════════════════════════════════════════════════════════════════
           CONTROLE DE ESTOQUE — Badges de esgotado e estoque baixo
           ════════════════════════════════════════════════════════════════
           normalizedStockLimit: converte o limite para inteiro positivo.
           Se stockLimit não existe (null), o produto não tem controle
           de estoque (nunca mostra badge de esgotado).
           ════════════════════════════════════════════════════════════════ */
        const normalizedStockLimit = Number.isFinite(Number(p.stockLimit)) ? Math.max(0, Math.trunc(Number(p.stockLimit))) : null;
        const isOutOfStock = normalizedStockLimit !== null && normalizedStockLimit <= 0;   /* Esgotado */
        const isLowStock = normalizedStockLimit !== null && normalizedStockLimit > 0 && normalizedStockLimit <= 5; /* Poucas unidades */

        /* ── Rótulo de categoria do produto ─────────────────────────────
           Tenta vários campos possíveis (category, categoria, collection,
           tipo, type) e limpa o texto (remove traços e underscores). */
        const rawCategoryLabel = safeTextFn(p.category || p.categoria || p.collection || p.tipo || p.type).trim();
        const categoryLabel = rawCategoryLabel.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

        /* ══════════════════════════════════════════════════════════════════
           ESTRUTURA DO JSX — Seções do card de produto
           ══════════════════════════════════════════════════════════════════
           O JSX abaixo renderiza o card na seguinte ordem:
           1. Badge de best-seller (se isBestSeller) — flutuante acima do card
           2. Área da imagem com galeria, badges e overlay de esgotado
              - Imagem com lazy loading e cálculo de proporção
              - Badge de categoria (canto superior direito)
              - Badge de tamanho/peso (canto superior esquerdo)
              - Contador de imagens, setas e bolinhas (se mais de 1 imagem)
              - Overlay "ESGOTADO" (se estoque = 0)
           3. Nome do produto
           4. Tag promocional (se existir)
           5. Descrição ou peso (fallback)
           6. Card de parcelamento (fundo verde)
           7. Espaçador flexível
           8. Alerta de estoque baixo (se restam poucas unidades)
           9. Rodapé: preço + botões "Detalhes" e "Comprar"
              - Se esgotado: botão desabilitado em cinza
              - Se disponível: botão "Detalhes" (branco) + "Comprar" (dourado)
           ══════════════════════════════════════════════════════════════════ */
        return (
            <article style={{ padding: '1rem', display: 'flex', flexDirection: 'column', position: 'relative' }}
                className="card-shadow animate-fade-in card-neon-hover product-card-premium"
                tabIndex="0">
                {isBestSeller && (
                    <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'var(--primary)', color: 'var(--cream)', fontSize: '11px', fontWeight: '800', padding: '6px 14px', borderRadius: '9999px', letterSpacing: '.02em', boxShadow: '0 8px 15px -3px rgba(28, 38, 56, 0.25)', border: '2px solid var(--cream)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px' }} className="animate-float-badge">
                        <i className="ph-fill ph-star" style={{ color: 'var(--cream)', fontSize: '14px' }}></i> O queridinho do momento!! 😍
                    </div>
                )}
                <div className="thumb" style={{ height: cardImageHeight, borderRadius: '1.2rem', overflow: 'hidden', marginBottom: '0.9rem', position: 'relative', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: cardImagePadding }}>
                    <img src={currentImageSources.src || allImages[imgIdx]} srcSet={currentImageSources.srcSet || undefined} sizes={currentImageSources.sizes || undefined} alt={p.name} loading="lazy" decoding="async" fetchpriority="low" onLoad={(event) => {
                        const naturalWidth = event.currentTarget.naturalWidth || 1;
                        const naturalHeight = event.currentTarget.naturalHeight || 1;
                        setCurrentImageRatio(naturalWidth / naturalHeight);
                    }} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transition: 'opacity .25s ease' }} />
                    {categoryLabel && (
                        <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'rgba(42,61,93,.86)', color: 'var(--cream)', fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '9999px', zIndex: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            {categoryLabel}
                        </div>
                    )}
                    {p.size ? (
                        <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: 'var(--primary)', color: 'var(--cream)', fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '9999px', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
                            <span style={{ fontSize: '13px' }}>🥚</span> Tamanho {p.size} — {p.weight}
                        </div>
                    ) : (
                        <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(4px)', color: 'var(--primary)', fontSize: '10px', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', zIndex: 5 }}>
                            {p.weight}
                        </div>
                    )}
                    {total > 1 && (
                        <div style={{ position: 'absolute', bottom: '0.6rem', right: '0.65rem', background: 'rgba(28,38,56,.72)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '3px 9px', borderRadius: '9999px', zIndex: 6, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ph-bold ph-images" style={{ fontSize: '12px' }}></i> {imgIdx + 1}/{total}
                        </div>
                    )}
                    {total > 1 && (
                        <>
                            <button onClick={prevImg} style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.92)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6, boxShadow: '0 2px 8px rgba(0,0,0,.18)', padding: 0 }}>
                                <i className="ph-bold ph-caret-left" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                            </button>
                            <button onClick={nextImg} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.92)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6, boxShadow: '0 2px 8px rgba(0,0,0,.18)', padding: 0 }}>
                                <i className="ph-bold ph-caret-right" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                            </button>
                        </>
                    )}
                    {total > 1 && (
                        <div style={{ position: 'absolute', bottom: '0.55rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', zIndex: 6 }}>
                            {allImages.map((_, i) => (
                                <button key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                                    style={{ width: i === imgIdx ? '18px' : '6px', height: '6px', borderRadius: '3px', background: i === imgIdx ? 'var(--gold)' : 'rgba(255,255,255,.75)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all .2s ease', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                            ))}
                        </div>
                    )}
                    {isOutOfStock && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(100,116,139,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <span style={{ background: '#ef4444', color: '#fff', fontWeight: '900', fontSize: '14px', padding: '8px 20px', borderRadius: '9999px', letterSpacing: '.06em', boxShadow: '0 4px 12px rgba(239,68,68,.4)' }}>ESGOTADO</span>
                        </div>
                    )}
                </div>
                <h3 className="brand-copy product-card-name">{p.name}</h3>
                {p.tag && <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gold)', marginBottom: '4px', fontStyle: 'italic' }}>✨ {p.tag}</p>}
                <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: '1.4', marginBottom: '8px' }}>{p.desc ? p.desc : safeTextFn(p.weight, 'Unidade')}</p>
                <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '8px 10px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '800', color: '#166534', lineHeight: 1.4 }}>Ou até 3x: {installmentTextFn(p.price, p.installment)}</p>
                </div>
                <div style={{ flex: 1 }}></div>
                {isLowStock && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px', fontSize: '11px', fontWeight: '700', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="ph-bold ph-warning" style={{ fontSize: '13px' }}></i> Últimas {normalizedStockLimit} unidade{normalizedStockLimit !== 1 ? 's' : ''}!
                    </div>
                )}
                {/* Rodapé responsivo do card: preserva o CTA Comprar e compacta Detalhes para evitar overflow em mobile. */}
                <div className="product-card-actions">
                    {Number(p.price) > 0 ? <span className={`product-card-price${isOutOfStock ? ' is-muted' : ''}`}>R$ {fmtBRLFn(p.price)}</span> : <span className="product-card-price is-consult">Consultar preço</span>}
                    {isOutOfStock ? (
                        <div style={{ background: '#f1f5f9', color: '#94a3b8', padding: '.9rem 1.1rem', borderRadius: '1rem', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'not-allowed', userSelect: 'none' }}>
                            <i className="ph-bold ph-x-circle" style={{ fontSize: '16px' }}></i> Esgotado
                        </div>
                    ) : (
                        <>
                            <button onClick={() => onOpenDetails(p)} className="product-card-details-btn">
                                <i className="ph-bold ph-eye" style={{ fontSize: '15px' }}></i>
                                <span className="product-card-details-label">Detalhes</span>
                            </button>
                            <button onClick={() => onAdd(p)} className="cta-gold product-card-buy-btn">
                                <i className="ph-bold ph-plus" style={{ fontSize: '16px' }}></i> Comprar
                            </button>
                        </>
                    )}
                </div>
            </article>
        );
    });

    /* ── Registra o componente no namespace global ──────────────────── */
    globalScope.HeloComponents = {
        ...(globalScope.HeloComponents || {}),
        ProductCard,
    };
})(window);
