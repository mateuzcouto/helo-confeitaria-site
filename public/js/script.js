/* ═══════════════════════════════════════════════════════════════════════
   script.js — PAINEL ADMINISTRATIVO (AdminPanel) + componentes auxiliares
   ═══════════════════════════════════════════════════════════════════════
   Este arquivo contém toda a lógica do painel de administração da
   Helô Confeitaria, incluindo:

   1. IMPORTS — Desestruturação de hooks React e módulos globais
      (HeloApp, HeloCart, HeloCrm, HeloFinance, HeloInventory)
   2. CONSTANTES E UTILITÁRIOS — IDs de campos, normalização de texto,
      timestamps, escassez de pedidos, associação label↔input
   3. FeedbackExperience — Tela de pós-venda (pesquisa de satisfação)
   4. ImageManager — Upload e gerenciamento de imagens de produtos
   5. CONSTANTES DE CARDÁPIO — Categorias, tipos de receita, abas do menu
   6. ESC/POS — Construção de comandos para impressora térmica (Elgin i9)
   7. AdminPanel — Componente principal do painel admin com todas as abas:
      Pedidos, Agenda, Entregas, Cardápio, Produção & Estoque,
      Financeiro, Feedbacks, Campanhas, Configurações
   ═══════════════════════════════════════════════════════════════════════ */

/* As desestruturações de React, HeloApp, HeloCart, HeloCrm, HeloFinance,
   e HeloAdminUtils agora são carregadas globalmente via core-globals.js.
   Isso permite que main-app.js acesse essas variáveis sem carregar
   este arquivo (script.js) na vitrine pública. */

/* ════════════════════════════════════════════════════════════════
   FeedbackExperience — Tela de pesquisa de satisfação pós-venda
   ════════════════════════════════════════════════════════════════
   Acessada via URL com parâmetro ?feedback=ORDER_ID
   Props: orderId (ID do pedido), onBack (função para voltar ao site)
   Fluxo:
   1. Carrega dados do pedido e feedback existente (se já respondeu)
   2. Se já respondeu, mostra mensagem de agradecimento
   3. Se não, exibe formulário com 3 perguntas + nota + comentário
   4. Ao enviar, salva na collection 'feedbacks' com merge */
const FeedbackExperience = ({ orderId, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [order, setOrder] = useState(null);
    const [liked, setLiked] = useState('');
    const [buyAgain, setBuyAgain] = useState('');
    const [recommend, setRecommend] = useState('');
    const [rating, setRating] = useState('5');
    const [comment, setComment] = useState('');

    useEffect(() => {
        let active = true;
        getCol('orders').doc(orderId).get().then(doc => {
            if (!active) return;
            if (!doc.exists) {
                setOrder(null);
                setLoading(false);
                return;
            }
            setOrder({ id: doc.id, ...doc.data() });
            return getCol('feedbacks').doc(orderId).get();
        }).then(feedbackDoc => {
            if (!active || !feedbackDoc) return;
            if (feedbackDoc.exists) {
                const data = feedbackDoc.data() || {};
                if (data.answeredAt) setSubmitted(true);
                setLiked(safeText(data.liked));
                setBuyAgain(safeText(data.buyAgain));
                setRecommend(safeText(data.recommend));
                setRating(safeText(data.rating, '5'));
                setComment(safeText(data.comment));
            }
            setLoading(false);
        }).catch(() => setLoading(false));
        return () => { active = false; };
    }, [orderId]);

    const submitFeedback = useCallback(async () => {
        if (!liked || !buyAgain || !recommend) {
            alert('Por favor, responda às 3 perguntas principais antes de enviar.');
            return;
        }
        setSaving(true);
        try {
            await getCol('feedbacks').doc(orderId).set({
                orderId,
                customerName: safeText(order?.customerName),
                customerPhone: safeText(order?.customerPhone),
                liked,
                buyAgain,
                recommend,
                rating: Number(rating) || 5,
                comment: safeText(comment),
                answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'answered',
            }, { merge: true });
            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert('Não foi possível enviar seu feedback agora. Tente novamente.');
        } finally {
            setSaving(false);
        }
    }, [orderId, order, liked, buyAgain, recommend, rating, comment]);

    const optionButton = (value, current, setter, activeBg, activeColor) => (
        <button type="button" onClick={() => setter(value)} style={{
            padding: '12px 14px', borderRadius: '12px', border: `2px solid ${current === value ? activeBg : '#e2e8f0'}`,
            background: current === value ? activeBg : '#fff', color: current === value ? activeColor : 'var(--s600)',
            fontWeight: '800', cursor: 'pointer'
        }}>{value}</button>
    );

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}><div className="loader"></div></div>;
    }

    if (!order) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#f8fafc' }}>
                <div style={{ maxWidth: '480px', background: '#fff', borderRadius: '24px', padding: '2rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <h2 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Link de feedback inválido</h2>
                    <p style={{ color: 'var(--s500)', lineHeight: 1.6 }}>Esse pedido não foi encontrado. Se precisar, fale com a Helô Confeitaria pelo WhatsApp.</p>
                    <button onClick={onBack} style={{ marginTop: '1rem', background: 'var(--primary)', color: 'var(--cream)', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Voltar ao site</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#fff7e8 0%,#f8fafc 100%)', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                <div style={{ background: '#fff', borderRadius: '28px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px -20px rgba(28,38,56,.18)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <p className="font-brand" style={{ fontSize: '3rem', color: 'var(--primary)', lineHeight: 1 }}>Helô</p>
                        <h1 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginTop: '8px' }}>Queremos saber sua experiência</h1>
                        <p style={{ color: 'var(--s500)', marginTop: '8px', lineHeight: 1.6 }}>
                            {submitted ? 'Seu feedback já foi registrado. Muito obrigado pelo carinho!' : `Oi, ${safeText(order.customerName, 'cliente')}! Sua opinião ajuda a Helô Confeitaria a melhorar cada vez mais.`}
                        </p>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '1rem', marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '8px' }}>Seu pedido</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {(order.items || []).map((item, idx) => (
                                <span key={idx} style={{ fontSize: '12px', background: '#fff', border: '1px solid #e2e8f0', padding: '6px 10px', borderRadius: '999px', fontWeight: '700', color: 'var(--primary)' }}>
                                    {Number(item?.qty || 1)}x {safeText(item?.name, 'Produto')}
                                </span>
                            ))}
                        </div>
                    </div>

                    {submitted ? (
                        <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '18px', padding: '1.5rem', textAlign: 'center' }}>
                            <i className="ph-fill ph-heart" style={{ fontSize: '40px', color: '#15803d' }}></i>
                            <p style={{ fontSize: '1.1rem', fontWeight: '800', color: '#166534', marginTop: '10px' }}>Feedback enviado com sucesso!</p>
                            <p style={{ fontSize: '14px', color: '#166534', lineHeight: 1.6, marginTop: '8px' }}>Obrigada por compartilhar sua experiência com a Helô Confeitaria 💙</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <p style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '10px' }}>Você gostou do produto?</p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {optionButton('Sim', liked, setLiked, '#dcfce7', '#166534')}
                                    {optionButton('Mais ou menos', liked, setLiked, '#fef3c7', '#92400e')}
                                    {optionButton('Não', liked, setLiked, '#fee2e2', '#b91c1c')}
                                </div>
                            </div>
                            <div>
                                <p style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '10px' }}>Compraria de novo?</p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {optionButton('Com certeza', buyAgain, setBuyAgain, '#dbeafe', '#1d4ed8')}
                                    {optionButton('Talvez', buyAgain, setBuyAgain, '#fef3c7', '#92400e')}
                                    {optionButton('Não', buyAgain, setBuyAgain, '#fee2e2', '#b91c1c')}
                                </div>
                            </div>
                            <div>
                                <p style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '10px' }}>Você recomendaria para outra pessoa?</p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {optionButton('Sim', recommend, setRecommend, '#dcfce7', '#166534')}
                                    {optionButton('Talvez', recommend, setRecommend, '#fef3c7', '#92400e')}
                                    {optionButton('Não', recommend, setRecommend, '#fee2e2', '#b91c1c')}
                                </div>
                            </div>
                            <div>
                                <p style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '10px' }}>Qual nota você dá para sua experiência?</p>
                                <input type="range" min="0" max="10" value={rating} onChange={e => setRating(e.target.value)} style={{ width: '100%' }} />
                                <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--gold)', marginTop: '4px' }}>Nota: {rating}/10</p>
                            </div>
                            <div>
                                <p style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '10px' }}>Quer deixar um comentário curto sobre sua experiência?</p>
                                <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={280} placeholder="Conte em poucas palavras como foi sua experiência com nosso produto." style={{ width: '100%', minHeight: '120px', padding: '14px', borderRadius: '16px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                                <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '6px' }}>{comment.length}/280 caracteres</p>
                            </div>
                            <button onClick={submitFeedback} disabled={saving} style={{ background: 'var(--primary)', color: 'var(--cream)', border: 'none', padding: '14px 18px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', fontSize: '15px', opacity: saving ? 0.7 : 1 }}>
                                {saving ? 'Enviando...' : 'Enviar feedback'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
/* ════════════════════════════════════════════════════════════════
   UTILITÁRIOS DE IMAGEM E SUBCOMPONENTES
   ════════════════════════════════════════════════════════════════
   - compressImage: redimensiona e comprime imagem antes do upload
   - ImageManager: componente de gerenciamento de galeria de imagens */

/* ── compressImage: Redimensiona e comprime imagem para upload ──────
   Recebe: file (File), maxWidth (largura máxima, default 800px),
           quality (qualidade JPEG, default 0.75)
   Retorna: Promise<string> com data URL da imagem comprimida
   Usa canvas para redimensionar e toDataURL para comprimir em JPEG */
const compressImage = (file, maxWidth = 800, quality = 0.75) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const ratio = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

/* ════════════════════════════════════════════════════════════════
   ImageManager — Gerenciador de galeria de imagens de produto
   ════════════════════════════════════════════════════════════════
   Props: images (array de URLs), onChange (callback com novo array)
   Funcionalidades:
   - Adicionar imagem por URL digitada
   - Upload de arquivo local (com compressão automática)
   - Remover imagem individual
   - Reordenar imagens (mover para cima/baixo)
   - Limite de 5 imagens por produto */
const ImageManager = ({ images, onChange }) => {
    const [urlInput, setUrlInput] = React.useState('');
    const [uploading, setUploading] = React.useState(false);
    const fileRef = React.useRef();
    const addUrl = () => {
        const url = urlInput.trim();
        if (!url) return;
        onChange([...images, url]);
        setUrlInput('');
    };
    const handleFiles = async (files) => {
        setUploading(true);
        try {
            const newImgs = await Promise.all(Array.from(files).map(f => compressImage(f)));
            onChange([...images, ...newImgs]);
        } catch (err) {
            alert('Erro ao processar imagem. Tente novamente.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };
    const removeImg = (idx) => onChange(images.filter((_, i) => i !== idx));
    const moveImg = (from, to) => {
        const arr = [...images];
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        onChange(arr);
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ph-bold ph-images" style={{ fontSize: '14px' }}></i> Fotos do Produto
                {images.length > 0 && <span style={{ background: 'var(--gold)', color: '#fff', borderRadius: '9999px', padding: '1px 7px', fontSize: '10px', fontWeight: '700' }}>{images.length}</span>}
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
                <input
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '500', outline: 'none', background: '#fff' }}
                    placeholder="Cole o link da imagem (https://...)"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addUrl()}
                />
                <button type="button" onClick={addUrl} style={{ padding: '8px 14px', background: 'var(--primary)', color: 'var(--cream)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="ph-bold ph-link"></i> Link
                </button>
            </div>
            <div>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => e.target.files?.length && handleFiles(e.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    style={{ width: '100%', padding: '10px 14px', background: uploading ? '#e2e8f0' : '#ecfdf3', color: uploading ? 'var(--s400)' : '#166534', borderRadius: '10px', border: `2px dashed ${uploading ? '#cbd5e1' : '#86efac'}`, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .15s' }}>
                    <i className={`ph-bold ${uploading ? 'ph-circle-notch' : 'ph-upload-simple'}`} style={{ fontSize: '16px' }}></i>
                    {uploading ? 'Processando imagens...' : '📂 Subir foto(s) do computador'}
                </button>
            </div>
            {images.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(78px,1fr))', gap: '8px' }}>
                    {images.map((src, i) => (
                        <div key={i} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: i === 0 ? '2px solid var(--gold)' : '2px solid #e2e8f0', background: '#f1f5f9', aspectRatio: '1', boxShadow: '0 2px 6px rgba(0,0,0,.08)' }}>
                            <img src={src} alt={`foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.opacity = '.2'; }} />
                            {i === 0 && <div style={{ position: 'absolute', top: '3px', left: '3px', background: 'var(--gold)', color: '#fff', fontSize: '8px', fontWeight: '800', padding: '2px 5px', borderRadius: '4px', lineHeight: 1, letterSpacing: '.04em' }}>CAPA</div>}
                            <div style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,.55)', color: '#fff', borderRadius: '4px', padding: '2px 5px', fontSize: '9px', fontWeight: '700' }}>{i + 1}/{images.length}</div>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '2px', padding: '4px', background: 'rgba(0,0,0,.42)' }}>
                                {i > 0 && <button type="button" onClick={() => moveImg(i, i - 1)} title="Mover" style={{ flex: 1, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#fff', padding: '3px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ph-bold ph-arrow-left"></i></button>}
                                <button type="button" onClick={() => removeImg(i)} title="Remover" style={{ flex: 1, background: 'rgba(239,68,68,.75)', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#fff', padding: '3px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ph-bold ph-trash"></i></button>
                                {i < images.length - 1 && <button type="button" onClick={() => moveImg(i, i + 1)} title="Mover" style={{ flex: 1, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#fff', padding: '3px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ph-bold ph-arrow-right"></i></button>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--s400)', padding: '8px 0', fontStyle: 'italic' }}>Nenhuma foto adicionada ainda</p>
            )}
        </div>
    );
};

/* ── Sub-components ─────────────────────────────────────── */
var ProductCard = (window.HeloComponents && window.HeloComponents.ProductCard)
    ? window.HeloComponents.ProductCard
    : React.memo(({ product: p, onAdd, onOpenDetails, isBestSeller }) => {
    const allImages = React.useMemo(() => {
        const imgs = normalizeProductImages(p);
        return imgs.length > 0 ? imgs : ['https://images.unsplash.com/photo-1544923246-77307dd654ca?w=400'];
    }, [p.images, p.image]);
    const [imgIdx, setImgIdx] = React.useState(0);
    const [currentImageRatio, setCurrentImageRatio] = React.useState(1);
    const total = allImages.length;
    const prevImg = e => { e.stopPropagation(); setImgIdx(i => (i - 1 + total) % total); };
    const nextImg = e => { e.stopPropagation(); setImgIdx(i => (i + 1) % total); };
    const cardImageHeight = currentImageRatio <= 0.78 ? '16rem' : currentImageRatio >= 1.55 ? '12.8rem' : '14.4rem';
    const cardImagePadding = currentImageRatio <= 0.78 ? '8px' : '10px';
    const normalizedStockLimit = Number.isFinite(Number(p.stockLimit)) ? Math.max(0, Math.trunc(Number(p.stockLimit))) : null;
    const isOutOfStock = normalizedStockLimit !== null && normalizedStockLimit <= 0;
    const isLowStock = normalizedStockLimit !== null && normalizedStockLimit > 0 && normalizedStockLimit <= 5;
    const rawCategoryLabel = safeText(p.category || p.categoria || p.collection || p.tipo || p.type).trim();
    const categoryLabel = rawCategoryLabel.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Sempre feche corretamente blocos condicionais e JSX. Ao adicionar botões, use sempre um único elemento pai e feche todos os parênteses/colchetes.
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
                <img src={allImages[imgIdx]} alt={p.name} loading="lazy" onLoad={(event) => {
                    const naturalWidth = event.currentTarget.naturalWidth || 1;
                    const naturalHeight = event.currentTarget.naturalHeight || 1;
                    setCurrentImageRatio(naturalWidth / naturalHeight);
                }} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', transition: 'opacity .25s ease' }} />
                {/* Bloco condicional para categoria */}
                {categoryLabel && (
                    <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: 'rgba(42,61,93,.86)', color: 'var(--cream)', fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '9999px', zIndex: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {categoryLabel}
                    </div>
                )}
                {/* Bloco condicional para tamanho/peso */}
                {p.size ? (
                    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: 'var(--primary)', color: 'var(--cream)', fontSize: '11px', fontWeight: '900', padding: '4px 10px', borderRadius: '9999px', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
                        <span style={{ fontSize: '13px' }}>🥚</span> Tamanho {p.size} — {p.weight}
                    </div>
                ) : (
                    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(4px)', color: 'var(--primary)', fontSize: '10px', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', zIndex: 5 }}>
                        {p.weight}
                    </div>
                )}
                {/* Bloco condicional para múltiplas imagens */}
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
            <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: '1.4', marginBottom: '8px' }}>{p.desc ? p.desc : safeText(p.weight, 'Unidade')}</p>
            <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '8px 10px', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '800', color: '#166534', lineHeight: 1.4 }}>Ou até 3x: {installmentText(p.price, p.installment)}</p>
            </div>
            <div style={{ flex: 1 }}></div>
            {isLowStock && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px', fontSize: '11px', fontWeight: '700', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph-bold ph-warning" style={{ fontSize: '13px' }}></i> Últimas {normalizedStockLimit} unidade{normalizedStockLimit !== 1 ? 's' : ''}!
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', gap: '8px' }}>
                {Number(p.price) > 0 ? <span style={{ fontWeight: '900', color: isOutOfStock ? '#94a3b8' : 'var(--gold)', fontSize: '1.25rem' }}>R$ {fmtBRL(p.price)}</span> : <span style={{ fontSize: '11px', color: 'var(--s400)', fontWeight: '600' }}>Consultar preço</span>}
                {isOutOfStock ? (
                    <div style={{ background: '#f1f5f9', color: '#94a3b8', padding: '.9rem 1.1rem', borderRadius: '1rem', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'not-allowed', userSelect: 'none' }}>
                        <i className="ph-bold ph-x-circle" style={{ fontSize: '16px' }}></i> Esgotado
                    </div>
                ) : (
                    <>
                        <button onClick={() => onOpenDetails(p)} style={{ background: '#fff', color: 'var(--primary)', padding: '.9rem .85rem', borderRadius: '1rem', border: '1px solid #dbe4f5', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}>
                            <i className="ph-bold ph-eye" style={{ fontSize: '15px' }}></i> Detalhes
                        </button>
                        <button onClick={() => onAdd(p)} className="cta-gold" style={{ padding: '.9rem .95rem', borderRadius: '1rem', cursor: 'pointer', transition: 'all .15s', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800' }}>
                            <i className="ph-bold ph-plus" style={{ fontSize: '16px' }}></i> Comprar
                        </button>
                    </>
                )}
            </div>
        </article>
    );
});

const CartItem = React.memo(({ item, onQty }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9' }}>
        <div style={{ flex: 1 }}>
            <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px', display: 'block' }}>{item.qty}x {item.name}</span>
            <div style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>R$ {fmtBRL(Number(item.price) * Number(item.qty))}</div>
            <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#166534', background: '#ecfdf3', border: '1px solid #bbf7d0', display: 'inline-block', padding: '4px 8px', borderRadius: '9999px' }}>Até 3x: {installmentText(item.price, item.installment)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <button onClick={() => onQty(item.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', lineHeight: 1 }}><i className="ph-bold ph-minus"></i></button>
            <span style={{ fontWeight: '700', fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
            <button onClick={() => onQty(item.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', lineHeight: 1 }}><i className="ph-bold ph-plus"></i></button>
        </div>
    </div>
));

/* ── Imports do módulo HeloCatalog (core/catalog.js) ────────────────
   Constantes e funções do cardápio migradas do script.js (Passo 2 SRP). */
var {
    CATEGORIAS,
    UNITS,
    CONVERSION_UNITS,
    RECIPE_TYPES,
    DEFAULT_MENU_TAB_OPTIONS,
    catLabel,
    typeLabel,
    typeColor,
    toMenuTabLabel,
    toMenuTabOption,
    mergeMenuTabOptions,
    collectMenuTabsFromProducts,
    buildMenuTabOptions,
    normalizeMenuTabKey,
    getMenuTabLabel,
    resolveProductMenuTab,
    normalizeProductForMenu,
    normalizeProductIdentityPart,
    buildProductIdentityKey,
    getTimestampMillis,
    getProductCompletenessScore,
    shouldPreferProductCandidate,
    dedupeProductsByIdentity,
    normalizeProductImages,
} = window.HeloCatalog;

/* ════════════════════════════════════════════════════════════════
   ESC/POS — Comandos para impressora térmica Elgin i9
   ════════════════════════════════════════════════════════════════
   Constantes e funções para montar comandos ESC/POS em hexadecimal:
   - THERMAL_RECEIPT_WIDTH: largura do cupom em caracteres (42 colunas)
   - ELGIN_I9_ESC_POS_CUT_FULL/PARTIAL_HEX: comandos de corte
   - ELGIN_I9_FEED_LINES_BEFORE_CUT: linhas em branco antes do corte
   - normalizeEscPosCutMode: normaliza modo de corte (full/partial)
   - escPosHexToCommand: converte string hex para array de bytes
   - buildElginI9CutSequence: monta sequência completa de corte
   - Funções de construção de recibo: buildKitchenReceipt, buildCashierReceipt
   ════════════════════════════════════════════════════════════════ */
const THERMAL_RECEIPT_WIDTH = 42;
const ELGIN_I9_ESC_POS_CUT_FULL_HEX = '1D5600';
const ELGIN_I9_ESC_POS_CUT_PARTIAL_HEX = '1D5601';
const ELGIN_I9_FEED_LINES_BEFORE_CUT = 5;

const normalizeEscPosCutMode = (value) => safeText(value, 'full').toLowerCase().trim() === 'partial' ? 'partial' : 'full';
const escPosHexToCommand = (hex) => {
    const normalizedHex = safeText(hex).replace(/\s+/g, '').toUpperCase();
    if (!normalizedHex || normalizedHex.length % 2 !== 0 || !/^[0-9A-F]+$/.test(normalizedHex)) return '';
    let command = '';
    for (let i = 0; i < normalizedHex.length; i += 2) {
        command += String.fromCharCode(parseInt(normalizedHex.slice(i, i + 2), 16));
    }
    return command;
};
const buildElginI9CutSequence = ({ cutMode = 'full', feedLines = ELGIN_I9_FEED_LINES_BEFORE_CUT } = {}) => {
    const normalizedCutMode = normalizeEscPosCutMode(cutMode);
    const safeFeedLines = Math.max(0, Math.min(12, Number(feedLines) || 0));
    const sequence = [];
    if (safeFeedLines > 0) sequence.push(`\x1B\x64${String.fromCharCode(safeFeedLines)}`);
    sequence.push(escPosHexToCommand(normalizedCutMode === 'partial' ? ELGIN_I9_ESC_POS_CUT_PARTIAL_HEX : ELGIN_I9_ESC_POS_CUT_FULL_HEX));
    return sequence.filter(Boolean);
};



const toThermalSafe = (value) => safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '');

const moneyBR = (value) => `R$ ${Number(value || 0).toFixed(2)}`;
const leftRightLine = (left, right, width = THERMAL_RECEIPT_WIDTH) => {
    const l = toThermalSafe(left);
    const r = toThermalSafe(right);
    const spaces = width - l.length - r.length;
    if (spaces >= 1) return `${l}${' '.repeat(spaces)}${r}`;
    const maxLeft = Math.max(8, width - r.length - 1);
    return `${l.slice(0, maxLeft)} ${r}`;
};

const htmlSafe = (value) => safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getOrderPrintDateInfo = (order = {}) => {
    const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date();
    const createdAtLabel = `${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const scheduleLabel = order.orderDate && order.orderTime
        ? `${toThermalSafe(String(order.orderDate).split('-').reverse().join('/'))} ${toThermalSafe(order.orderTime)}`
        : '';
    return { createdAtLabel, scheduleLabel };
};

const getOrderItemsSummary = (order = {}) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const totalItems = items.reduce((sum, item) => sum + Math.max(0, Number(item?.qty || 0)), 0);
    return { items, totalItems };
};

const buildKitchenEscPosReceipt = (order = {}) => {
    const { createdAtLabel, scheduleLabel } = getOrderPrintDateInfo(order);
    const { items, totalItems } = getOrderItemsSummary(order);
    const lines = [
        '\x1B\x40',
        '\x1B\x61\x01',
        'HELO CONFEITARIA\n',
        'VIA COZINHA\n',
        '\x1B\x61\x00',
        `${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`,
        `Pedido: ${toThermalSafe(order.orderId || 'N/A')}\n`,
        `Emitido: ${toThermalSafe(createdAtLabel)}\n`,
        `Cliente: ${toThermalSafe(order.customerName)}\n`,
        `Entrega: ${toThermalSafe(order.methodLabel || '')}\n`,
    ];

    if (scheduleLabel) lines.push(`Agenda: ${scheduleLabel}\n`);
    if (order.observations) lines.push(`Obs: ${toThermalSafe(order.observations)}\n`);

    lines.push(`${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`);
    lines.push('ITENS (PREPARO)\n');

    items.forEach((item) => {
        const qty = Number(item?.qty || 0);
        lines.push(`${leftRightLine(`${qty}x`, item?.name || 'Item')}\n`);
    });

    lines.push(`${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`);
    lines.push(`Total de itens: ${totalItems}\n`);
    lines.push(...buildElginI9CutSequence({ cutMode: 'full' }));
    return lines;
};

const buildCashierEscPosReceipt = (order = {}) => {
    const { createdAtLabel, scheduleLabel } = getOrderPrintDateInfo(order);
    const { items } = getOrderItemsSummary(order);
    const lines = [
        '\x1B\x40',
        '\x1B\x61\x01',
        'HELO CONFEITARIA\n',
        'VIA CAIXA\n',
        '\x1B\x61\x00',
        `${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`,
        `Pedido: ${toThermalSafe(order.orderId || 'N/A')}\n`,
        `Emitido: ${toThermalSafe(createdAtLabel)}\n`,
        `Cliente: ${toThermalSafe(order.customerName)}\n`,
        `Contato: ${toThermalSafe(order.customerPhone)}\n`,
        `Entrega: ${toThermalSafe(order.methodLabel || '')}\n`,
        `Pagto: ${toThermalSafe(order.paymentLabel || '')}\n`,
    ];

    if (scheduleLabel) lines.push(`Agenda: ${scheduleLabel}\n`);
    if (order.address) lines.push(`End: ${toThermalSafe(order.address)}\n`);
    if (order.observations) lines.push(`Obs: ${toThermalSafe(order.observations)}\n`);

    lines.push(`${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`);
    lines.push('ITENS\n');

    items.forEach((item) => {
        const qty = Number(item?.qty || 0);
        const unitPrice = Number(item?.price || 0);
        const lineTotal = qty * unitPrice;
        lines.push(`${toThermalSafe(item?.name || 'Item')}\n`);
        lines.push(`${leftRightLine(`${qty} x ${moneyBR(unitPrice)}`, moneyBR(lineTotal))}\n`);
    });

    lines.push(`${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`);
    lines.push(`${leftRightLine('Subtotal', moneyBR(order.subtotal))}\n`);
    if (Number(order.discountValue || 0) > 0) lines.push(`${leftRightLine('Desconto', `- ${moneyBR(order.discountValue)}`)}\n`);
    if (Number(order.deliveryFee || 0) > 0) lines.push(`${leftRightLine('Entrega', moneyBR(order.deliveryFee))}\n`);
    if (Number(order.cardFeeValue || 0) > 0) lines.push(`${leftRightLine('Taxa cartao', moneyBR(order.cardFeeValue))}\n`);
    lines.push(`${leftRightLine('TOTAL', moneyBR(order.payableTotal))}\n`);
    lines.push(`${'-'.repeat(THERMAL_RECEIPT_WIDTH)}\n`);
    lines.push('\x1B\x61\x01');
    lines.push('Obrigada pela preferencia!\n');
    lines.push(...buildElginI9CutSequence({ cutMode: 'full' }));
    return lines;
};

const buildOrderPrintJobs = (order = {}, ticketMode = 'both') => {
    const normalizedMode = normalizeThermalPrintTicketMode(ticketMode);
    const orderId = safeText(order?.orderId, 'SEMID');
    const jobs = [
        { key: 'kitchen', title: 'VIA COZINHA', jobName: `HELO-COZINHA-${orderId}`, escpos: buildKitchenEscPosReceipt(order) },
        { key: 'cashier', title: 'VIA CAIXA', jobName: `HELO-CAIXA-${orderId}`, escpos: buildCashierEscPosReceipt(order) },
    ];
    if (normalizedMode === 'kitchen') return jobs.filter(job => job.key === 'kitchen');
    if (normalizedMode === 'cashier') return jobs.filter(job => job.key === 'cashier');
    return jobs;
};

const printOrderViaBrowser = (order, popupRef = null, thermalSettings = {}) => {
    const popup = popupRef && !popupRef.closed ? popupRef : window.open('', '_blank', 'width=420,height=760');
    if (!popup) throw new Error('Nao foi possivel abrir janela de impressao.');
    const normalizedThermalSettings = normalizeThermalPrintSettings(thermalSettings);
    const ticketMode = normalizedThermalSettings.thermalPrintTicketMode;
    const printKitchen = ticketMode === 'both' || ticketMode === 'kitchen';
    const printCashier = ticketMode === 'both' || ticketMode === 'cashier';

    const { createdAtLabel, scheduleLabel } = getOrderPrintDateInfo(order);
    const { items, totalItems } = getOrderItemsSummary(order);

    const kitchenRows = items.map((item) => {
        const qty = Number(item?.qty || 0);
        return `<tr><td style="width:58px;text-align:center;">${qty}x</td><td>${htmlSafe(item?.name || 'Item')}</td></tr>`;
    }).join('');

    const cashierRows = items.map((item) => {
        const qty = Number(item?.qty || 0);
        const total = qty * Number(item?.price || 0);
        return `<tr><td>${htmlSafe(item?.name || 'Item')}</td><td style="text-align:center;">${qty}</td><td style="text-align:right;">${moneyBR(total)}</td></tr>`;
    }).join('');

    const commonMeta = [
        `<p><strong>Pedido:</strong> ${htmlSafe(order.orderId || 'N/A')}</p>`,
        `<p><strong>Emitido:</strong> ${htmlSafe(createdAtLabel)}</p>`,
        `<p><strong>Cliente:</strong> ${htmlSafe(order.customerName)}</p>`,
        `<p><strong>Entrega:</strong> ${htmlSafe(order.methodLabel || '')}</p>`,
        scheduleLabel ? `<p><strong>Agenda:</strong> ${htmlSafe(scheduleLabel)}</p>` : '',
        order.observations ? `<p><strong>Obs:</strong> ${htmlSafe(order.observations)}</p>` : '',
    ].filter(Boolean).join('');

    const cashierMetaExtra = [
        `<p><strong>Contato:</strong> ${htmlSafe(order.customerPhone)}</p>`,
        `<p><strong>Pagamento:</strong> ${htmlSafe(order.paymentLabel || '')}</p>`,
        order.address ? `<p><strong>Endereco:</strong> ${htmlSafe(order.address)}</p>` : '',
    ].filter(Boolean).join('');

    const kitchenSection = `<section class="ticket"><h1>HELO CONFEITARIA</h1><div style="text-align:center;"><span class="badge">VIA COZINHA</span></div><div class="meta">${commonMeta}</div><table><thead><tr><th style="width:58px;text-align:center;">Qtd</th><th>Produto</th></tr></thead><tbody>${kitchenRows}</tbody></table><div class="print-note">Total de itens: ${totalItems}</div></section>`;
    const cashierSection = `<section class="ticket"><h1>HELO CONFEITARIA</h1><div style="text-align:center;"><span class="badge">VIA CAIXA</span></div><div class="meta">${commonMeta}${cashierMetaExtra}</div><table><thead><tr><th style="text-align:left;">Item</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Total</th></tr></thead><tbody>${cashierRows}</tbody></table><div class="totline"><span>Subtotal</span><span>${moneyBR(order.subtotal)}</span></div>${Number(order.discountValue || 0) > 0 ? `<div class="totline"><span>Desconto</span><span>- ${moneyBR(order.discountValue)}</span></div>` : ''}${Number(order.deliveryFee || 0) > 0 ? `<div class="totline"><span>Entrega</span><span>${moneyBR(order.deliveryFee)}</span></div>` : ''}${Number(order.cardFeeValue || 0) > 0 ? `<div class="totline"><span>Taxa cartao</span><span>${moneyBR(order.cardFeeValue)}</span></div>` : ''}<div class="totline"><strong>TOTAL</strong><strong>${moneyBR(order.payableTotal)}</strong></div></section>`;
    const sections = [
        printKitchen ? kitchenSection : '',
        printCashier ? cashierSection : '',
    ].filter(Boolean).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Cupom ${htmlSafe(order.orderId || '')}</title><style>@page{size:80mm auto;margin:6mm}body{font-family:'Courier New',monospace;color:#111;font-size:12px;line-height:1.35}.ticket{padding:0 2px 8px}.ticket + .ticket{border-top:2px dashed #000;padding-top:10px;margin-top:10px}.ticket h1{font-size:16px;margin:0 0 4px;text-align:center}.badge{display:inline-block;border:1px solid #111;padding:2px 7px;font-size:11px;font-weight:700;margin:2px auto 8px}.meta p{margin:0 0 3px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{padding:4px 0;border-bottom:1px dashed #bbb}th{text-align:left;font-size:11px}.totline{display:flex;justify-content:space-between;margin-top:4px}.totline strong{font-size:13px}.print-note{margin-top:8px;text-align:center;font-size:10px}@media print{body{margin:0}}</style></head><body>${sections}</body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
};

const printOrderViaQz = async (order, thermalSettings) => {
    const normalizedThermalSettings = normalizeThermalPrintSettings(thermalSettings);
    await ensureQzSecurityHooks();
    if (typeof window === 'undefined' || !window.qz) throw new Error('QZ Tray nao esta disponivel no navegador.');
    if (!window.qz.websocket.isActive()) await window.qz.websocket.connect();

    let printerName = normalizedThermalSettings.thermalPrinterName;
    if (printerName) printerName = await window.qz.printers.find(printerName);
    else printerName = await window.qz.printers.getDefault();
    if (!printerName) throw new Error('Nenhuma impressora local foi encontrada para impressao termica.');

    const jobs = buildOrderPrintJobs(order, normalizedThermalSettings.thermalPrintTicketMode);
    for (const job of jobs) {
        const config = window.qz.configs.create(printerName, {
            copies: normalizedThermalSettings.thermalPrintCopies,
            encoding: 'CP860',
            jobName: job.jobName,
        });
        await window.qz.print(config, job.escpos);
    }
};

const qzSecurityState = {
    configured: false,
    configuring: null,
    unavailableReason: '',
};

const extractQzSecurityPayload = (payload, keys = []) => {
    if (typeof payload === 'string') return payload.trim();
    if (!payload || typeof payload !== 'object') return '';
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const readResponseAsTextOrJson = async (response) => {
    const raw = await response.text();
    if (!raw) return '';
    try {
        return JSON.parse(raw);
    } catch (_) {
        return raw;
    }
};

const ensureQzSecurityHooks = async () => {
    if (qzSecurityState.configured) return;
    if (!QZ_SECURITY_ENABLED) return;
    if (qzSecurityState.unavailableReason) return;
    if (qzSecurityState.configuring) {
        await qzSecurityState.configuring;
        return;
    }

    qzSecurityState.configuring = (async () => {
        if (typeof window === 'undefined' || !window.qz) {
            throw new Error('QZ Tray nao esta disponivel no navegador.');
        }

        const certEndpoint = safeText(QZ_CERT_ENDPOINT).trim();
        const signEndpoint = safeText(QZ_SIGN_ENDPOINT).trim();
        if (!certEndpoint || !signEndpoint) {
            throw new Error('QZ security endpoints não configurados no frontend.');
        }

        // Se o backend não estiver publicado, desativa hooks de assinatura para não quebrar o fluxo local.
        const [certProbe, signProbe] = await Promise.all([
            fetch(certEndpoint, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8' } }),
            fetch(signEndpoint, { method: 'OPTIONS', credentials: 'include' }),
        ]);
        if (!certProbe.ok || !signProbe.ok) {
            qzSecurityState.unavailableReason = `QZ security indisponível (${!certProbe.ok ? `cert:${certProbe.status}` : ''} ${!signProbe.ok ? `sign:${signProbe.status}` : ''})`;
            console.warn(`[QZ] ${qzSecurityState.unavailableReason}. Continuando sem hooks de assinatura.`);
            return;
        }

        if (typeof window.qz.security?.setSignatureAlgorithm === 'function') {
            window.qz.security.setSignatureAlgorithm(safeText(QZ_SIGN_ALGORITHM, 'SHA512'));
        }

        // QZ Tray 2.2 espera funções "resolver" para new Promise(...), não funções async.
        window.qz.security.setCertificatePromise((resolve, reject) => {
            fetch(certEndpoint, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8',
                },
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`QZ certificate endpoint retornou ${response.status} (${certEndpoint}).`);
                    }
                    const payload = await readResponseAsTextOrJson(response);
                    const cert = extractQzSecurityPayload(payload, ['certificate', 'cert', 'publicKey', 'data']);
                    if (!cert) throw new Error('QZ certificate endpoint sem certificado válido.');
                    resolve(cert);
                })
                .catch((error) => reject(error));
        });

        window.qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
            fetch(signEndpoint, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8',
                },
                body: JSON.stringify({
                    request: toSign,
                    algorithm: safeText(QZ_SIGN_ALGORITHM, 'SHA512'),
                    timestamp: Date.now(),
                }),
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`QZ signature endpoint retornou ${response.status} (${signEndpoint}).`);
                    }
                    const payload = await readResponseAsTextOrJson(response);
                    const signature = extractQzSecurityPayload(payload, ['signature', 'signed', 'data']);
                    if (!signature) throw new Error('QZ signature endpoint sem assinatura válida.');
                    resolve(signature);
                })
                .catch((error) => reject(error));
        });

        qzSecurityState.configured = true;
    })();

    try {
        await qzSecurityState.configuring;
    } finally {
        qzSecurityState.configuring = null;
    }
};

const describeThermalPrintError = (error) => {
    const message = safeText(error?.message || error).toLowerCase();
    if (message.includes('certificate endpoint') || message.includes('signature endpoint') || message.includes('security endpoint')) {
        return 'QZ security não está pronto: configure os endpoints de certificado e assinatura no backend.';
    }
    if (message.includes('signature') || message.includes('required') || message.includes('validity') || message.includes('untrusted')) {
        return 'QZ Tray exigiu assinatura confiável da aplicação (certificado inválido/ausente).';
    }
    if (message.includes('unable to establish connection with qz')) {
        return 'QZ Tray não está conectado. Instale/inicie o QZ Tray e deixe-o aberto.';
    }
    if (message.includes('qz tray nao esta disponivel')) {
        return 'QZ Tray não foi carregado nesta página. Verifique sua conexão e recarregue.';
    }
    if (message.includes('not found') || message.includes('nenhuma impressora local')) {
        return 'Nenhuma impressora local foi encontrada. Instale/configure a impressora no Windows.';
    }
    return 'Falha na impressão térmica. Verifique QZ Tray, nome da impressora e permissões locais.';
};

/* ═══════════════════════════════════════════════════════════════════════
   AdminPanel — COMPONENTE PRINCIPAL DO PAINEL ADMINISTRATIVO
   ═══════════════════════════════════════════════════════════════════════
   Este é o componente que renderiza toda a interface de administração
   da Helô Confeitaria. Ele recebe TODOS os dados do Firebase via props
   do componente App (main-app.js) e gerencia:

   PROPS (dados do Firebase):
   - allOrders: todos os pedidos (collection 'orders')
   - allCoupons: cupons de desconto (collection 'coupons')
   - products: catálogo de produtos (collection 'products')
   - visitsData: contador de visitas (doc 'visits')
   - ingredients: ingredientes de estoque (collection 'ingredients')
   - recipes: receitas de produção (collection 'recipes')
   - feedbacks: pesquisas de satisfação (collection 'feedbacks')
   - financialEntries: lançamentos financeiros (collection 'financeiro')
   - campaigns: campanhas cadastradas (collection 'campanhas')
   - activeCampaignId: ID da campanha ativa no momento
   - onExit: callback para sair do modo admin (desloga)
   - siteSettings: configurações gerais (doc 'site_settings')
   - onSaveSettings: callback para salvar configurações

   ABAS DO PAINEL (estado 'tab'):
   - orders: Pedidos (gerenciamento de status, impressão térmica)
   - schedule: Agenda (agendamentos, CRM, notificações)
   - deliveries: Entregas (motoristas, fretes, rotas)
   - menu: Cardápio (produtos, abas do menu, categorias)
   - production: Produção & Estoque (receitas, ingredientes, fichas técnicas)
   - finance: Financeiro (fluxo de caixa, fechamento diário, exportação)
   - feedbacks: Feedbacks (pesquisas de satisfação dos clientes)
   - campaigns: Campanhas (criação, edição, ativação automática)
   - settings: Configurações (site mode, taxa de entrega, PIX, impressão)

   HOOKS DE DOMÍNIO (lógica de negócio separada):
   - useFinanceDomain: domínio financeiro (financeiro.js)
   - useInventoryDomain: domínio de estoque (estoque.js)

   FUNCIONALIDADES PRINCIPAIS:
   - CRUD de produtos, pedidos, campanhas, cupons, agendamentos
   - Impressão térmica via QZ Tray (Elgin i9)
   - Automação WhatsApp (confirmação de pedidos)
   - Ranking de vendas e detecção de duplicatas
   - Controle de escassez e modo evento
   - Gerenciamento de abas do cardápio público
   ═══════════════════════════════════════════════════════════════════════ */
const AdminPanel = ({
    allOrders,
    allCoupons,
    products,
    visitsData,
    ingredients,
    recipes,
    feedbacks,
    financialEntries,
    campaigns = [],
    activeCampaignId = CAMPAIGN_GENERAL_ID,
    onExit,
    siteSettings = {},
    onSaveSettings,
    onAdminTabChange,
    onLoadMoreOrders,
    ordersPageSize = 50,
    ordersHasMore = false,
    ordersLastSyncAt = 0,
    ordersRealtimeChannelStatus = 'idle',
    ordersRealtimeRecentFailures = 0,
}) => {
    /* ── Estados de navegação e filtros gerais ──────────────────────
       - tab: aba ativa do painel (orders, schedule, deliveries, etc.)
       - prodTab: sub-aba de Produção & Estoque (dash, ingredients, recipes)
       - feedbackFilter / feedbackStatusFilter: filtros da aba Feedbacks
       - search: busca global na aba Pedidos
       - prodSearch / menuSearch: busca na aba Cardápio
       - newMenuTabLabel: nome da nova aba do cardápio sendo criada
       - menuTabsSaving: flag de salvamento das abas do cardápio */
    const [tab, setTab] = useState('orders');
    const [prodTab, setProdTab] = useState('dash');
    const [feedbackFilter, setFeedbackFilter] = useState('all');
    const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('all');

    useEffect(() => {
        if (typeof onAdminTabChange === 'function') {
            onAdminTabChange(tab);
        }
    }, [tab, onAdminTabChange]);

    /* ── Estados de formulários de CRUD ──────────────────────────────
       - newProd: formulário de novo produto (nome, preço, tamanho, etc.)
       - editProd: produto sendo editado (null = nenhum)
       - editOrder: pedido sendo editado no modal (null = nenhum)
       - newCoup: formulário de novo cupom (código, tipo, valor)
       - storyPreview: preview de story do Instagram
       - feedbackBusyId: ID do feedback sendo processado */
    const [search, setSearch] = useState('');
    const [prodSearch, setProdSearch] = useState('');
    const [menuSearch, setMenuSearch] = useState('');
    const [newMenuTabLabel, setNewMenuTabLabel] = useState('');
    const [menuTabsSaving, setMenuTabsSaving] = useState(false);
    const [newProd, setNewProd] = useState({ name: '', price: '', size: '', weight: '', tag: '', desc: '', image: '', images: [], installment: '', isVisible: true, stockLimit: '', campaignId: activeCampaignId || CAMPAIGN_GENERAL_ID, menuTab: DEFAULT_MENU_TAB_OPTIONS[0].key });
    const [editProd, setEditProd] = useState(null);
    const [editOrder, setEditOrder] = useState(null);
    const [newCoup, setNewCoup] = useState({ code: '', type: 'percent', value: '' });
    const [storyPreview, setStoryPreview] = useState(null);
    const [feedbackBusyId, setFeedbackBusyId] = useState(null);

    /* ── Estados de configurações e campanhas ────────────────────────
       - localSettings: cópia local de siteSettings (editável antes de salvar)
         Inclui: maxUnits, orderDeadline, siteMode, campaignMode,
         isDeliveryAvailable, chavePix, menuTabs, config térmica
       - campaignDrafts: rascunhos de edição de campanhas (id → dados)
       - campaignForm: formulário de criação/edição de campanha
       - settingsSaving: flag de salvamento das configurações
       - thermalPrintTesting: flag de teste de impressão térmica
       - reprintBusyId: ID do pedido sendo reimpresso */
    const [localSettings, setLocalSettings] = useState({ maxUnits: 70, orderDeadline: '2026-03-31T19:00', siteMode: 'livre', enableAnnouncement: false, announcementText: '', announcementStyle: 'info', enableScarcityBanner: true, campaignMode: CAMPAIGN_MODE_MANUAL, activeCampaignOverrideId: '', isDeliveryAvailable: true, chavePix: '88996549074', nomeTitularPix: '', menuTabs: DEFAULT_MENU_TAB_OPTIONS.map(option => ({ ...option })), ...DEFAULT_THERMAL_PRINT_SETTINGS });
    const [campaignDrafts, setCampaignDrafts] = useState({});
    const [campaignForm, setCampaignForm] = useState({ id: '', nome: '', autoEnabled: false, startDate: '', endDate: '', priority: 0 });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [thermalPrintTesting, setThermalPrintTesting] = useState(false);
    const [reprintBusyId, setReprintBusyId] = useState('');
    /* ── Estado do diagnóstico de impressão térmica ──────────────────
       thermalDiag: resultado do diagnóstico da impressora
       - checking: diagnóstico em andamento
       - scriptLoaded: QZ Tray carregou no navegador
       - qzConnected: conexão com QZ Tray estabelecida
       - printerFound: impressora encontrada
       - printerName: nome da impressora detectada
       - message: mensagem de status do diagnóstico
       thermalDiagBusyRef: ref para evitar diagnóstico concorrente */
    const [thermalDiag, setThermalDiag] = useState({
        checking: false,
        lastCheckedAt: null,
        scriptLoaded: false,
        qzConnected: false,
        printerFound: false,
        printerName: '',
        message: 'Diagnóstico pendente.',
    });
    const thermalDiagBusyRef = useRef(false);

    /* ── Estados do painel de análise de tráfego ────────────────────
       - siteVisits: array de registros da collection site_visits (admin only)
       - trafegoPeriodo: filtro de período selecionado (hoje, ontem, 7d, 30d, este_mes, mes_anterior, personalizado)
       - trafegoDataInicio / trafegoDataFim: datas para período personalizado
       - trafegoFiltroCampanha: filtro por nome de campanha UTM
       - trafegoBusca: texto de busca na tabela de acessos
       - trafegoPagina: página atual da tabela de acessos */
    const [siteVisits, setSiteVisits] = useState([]);
    const [trafegoPeriodo, setTrafegoPeriodo] = useState('7d');
    const [trafegoDataInicio, setTrafegoDataInicio] = useState('');
    const [trafegoDataFim, setTrafegoDataFim] = useState('');
    const [trafegoFiltroCampanha, setTrafegoFiltroCampanha] = useState('');
    const [trafegoBusca, setTrafegoBusca] = useState('');
    const [trafegoPagina, setTrafegoPagina] = useState(0);

    /* ── Estados de filtros de entregas e pedidos ────────────────────
       deliveryFilter: filtro de método (all/entrega/retirada)
       deliveryStatusFilter: filtro de status (pending/confirmed, etc.)
       deliveryPaymentFilter: filtro de forma de pagamento
       deliveryCampaignFilter: filtro por campanha
       deliverySort: ordenação (priority/date)
       deliverySearch: texto de busca
       deliveryDriverFilter: filtro por motorista
       drivers: lista de motoristas cadastrados
       orderPaymentFilter / orderCampaignFilter / orderCategoryFilter:
         filtros da aba Pedidos */
    const [deliveryFilter, setDeliveryFilter] = useState('all');
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('pending');
    const [deliveryPaymentFilter, setDeliveryPaymentFilter] = useState('all');
    const [deliveryCampaignFilter, setDeliveryCampaignFilter] = useState(activeCampaignId || CAMPAIGN_GENERAL_ID);
    const [deliverySort, setDeliverySort] = useState('priority');
    const [deliverySearch, setDeliverySearch] = useState('');
    const [deliveryDriverFilter, setDeliveryDriverFilter] = useState('all');
    const [drivers, setDrivers] = useState([]);
    const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
    const [orderCampaignFilter, setOrderCampaignFilter] = useState(activeCampaignId || CAMPAIGN_GENERAL_ID);
    const [orderCategoryFilter, setOrderCategoryFilter] = useState('all');
    /* ── Estados da aba Operação (tempo real) ────────────────────────
       operationActiveOrders: pedidos com status ativo (Novo, Confirmado, etc.)
       operationRecentConcludedOrders: pedidos concluídos nos últimos 15 min
       operationNowMs: timestamp atual (atualizado periodicamente)
       insightsCampaignFilter: filtro de campanha nos insights */
    const [operationActiveOrders, setOperationActiveOrders] = useState([]);
    const [operationRecentConcludedOrders, setOperationRecentConcludedOrders] = useState([]);
    const [operationNowMs, setOperationNowMs] = useState(() => Date.now());
    const [insightsCampaignFilter, setInsightsCampaignFilter] = useState(activeCampaignId || CAMPAIGN_GENERAL_ID);
    /* ── Estados da aba Agenda (CRM) ──────────────────────────────────
       adminSchedules: lista de agendamentos do Firebase
       scheduleForm: formulário de criação/edição de agendamento
       scheduleSearch / scheduleFilter / scheduleCampaignFilter: filtros
       scheduleSaving: flag de salvamento
       scheduleBulkLoading / scheduleBulkStatus: operação em lote
       selectedScheduleIds: IDs selecionados para operação em lote
       scheduleAlerts: alertas de agendamentos próximos
       orderRealtimeToasts: toasts de novos pedidos em tempo real
       scheduleAlertSettings: configurações de alerta sonoro/visual */
    const [adminSchedules, setAdminSchedules] = useState([]);
    const [scheduleForm, setScheduleForm] = useState(() => createAdminScheduleForm(activeCampaignId || CAMPAIGN_GENERAL_ID));
    const [scheduleSearch, setScheduleSearch] = useState('');
    const [scheduleFilter, setScheduleFilter] = useState('all');
    const [scheduleCampaignFilter, setScheduleCampaignFilter] = useState(activeCampaignId || CAMPAIGN_GENERAL_ID);
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [scheduleBulkLoading, setScheduleBulkLoading] = useState(false);
    const [scheduleBulkStatus, setScheduleBulkStatus] = useState('Em produção');
    const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
    const [scheduleAlerts, setScheduleAlerts] = useState([]);
    const [orderRealtimeToasts, setOrderRealtimeToasts] = useState([]);
    const [orderFlowFeedbackToasts, setOrderFlowFeedbackToasts] = useState([]);
    const [lastAutoPrintStatus, setLastAutoPrintStatus] = useState({
        state: 'idle',
        label: 'Aguardando confirmação de pedido',
        orderId: '',
        updatedAt: 0,
    });
    const [scheduleAlertSettings, setScheduleAlertSettings] = useState(() => readAdminScheduleAlertSettings());
    /* ── Permissão de notificação e refs de áudio/tempo real ──────────
       notificationPermission: estado da permissão de Notification API
       scheduleAlertAudioCtxRef: contexto de áudio para alerta sonoro
       scheduleAlertSoundCooldownRef: cooldown para não repetir som
       orderRealtimeInitializedRef: flag para não reinicializar listener
       operationKnownOrderIdsRef: set de IDs já conhecidos (evita toast duplicado)
       orderNotificationAudioRef: elemento de áudio para notificação de pedido
       orderNotificationInteractionUnlockedRef: flag de interação do usuário
       orderNotificationSoundCooldownRef: cooldown do som de notificação
       orderToastTimersRef: timers dos toasts ativos (para limpeza)
       triggerRealtimeOrderAlertsRef: ref da função de alerta em tempo real */
    const [notificationPermission, setNotificationPermission] = useState(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
        return window.Notification.permission;
    });
    const scheduleAlertAudioCtxRef = useRef(null);
    const scheduleAlertSoundCooldownRef = useRef(0);
    const orderRealtimeInitializedRef = useRef(false);
    const operationKnownOrderIdsRef = useRef(new Set());
    const orderNotificationAudioRef = useRef(null);
    const orderNotificationInteractionUnlockedRef = useRef(false);
    const orderNotificationSoundCooldownRef = useRef(0);
    const orderToastTimersRef = useRef(new Map());
    const orderFlowToastTimersRef = useRef(new Map());
    const orderNotificationSeenKeysRef = useRef(new Set());
    const triggerRealtimeOrderAlertsRef = useRef(() => {});
    const autoPrintExecutionMapRef = useRef(new Map());
    const orderStatusUpdateInFlightRef = useRef(new Set());

    const toOrderCreatedMs = useCallback((orderLike = {}) => {
        const createdMs = getOrderCreatedAtMillis({ createdAt: orderLike?.createdAt });
        return Number.isFinite(createdMs) ? createdMs : 0;
    }, []);

    const buildOrderNotificationKey = useCallback((orderLike = {}) => {
        const orderId = safeText(orderLike?.id).trim();
        if (!orderId) return '';
        return `${orderId}::${toOrderCreatedMs(orderLike)}`;
    }, [toOrderCreatedMs]);

    const ordersRealtimeHealth = useMemo(() => {
        if (ordersRealtimeChannelStatus === 'online') {
            return { label: 'Canal realtime: online', color: '#166534', bg: '#dcfce7', dot: '#16a34a' };
        }
        if (ordersRealtimeChannelStatus === 'reconnecting') {
            return { label: 'Canal realtime: reconectando', color: '#9a3412', bg: '#ffedd5', dot: '#ea580c' };
        }
        if (ordersRealtimeChannelStatus === 'error') {
            return { label: 'Canal realtime: falha', color: '#991b1b', bg: '#fee2e2', dot: '#dc2626' };
        }
        if (ordersRealtimeChannelStatus === 'connecting') {
            return { label: 'Canal realtime: conectando', color: '#1e3a8a', bg: '#dbeafe', dot: '#2563eb' };
        }
        return { label: 'Canal realtime: aguardando', color: '#334155', bg: '#e2e8f0', dot: '#64748b' };
    }, [ordersRealtimeChannelStatus]);

    /* ── Estilo base para campos de input do painel admin ─────────── */
    const inp = { padding: '.75rem', background: '#fff', color: 'var(--primary)', borderRadius: '.75rem', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', width: '100%' };

    /* ── campaignOptions: Campanhas normalizadas para selects ──────────
       Recebe: campaigns (bruto do Firebase)
       Retorna: array normalizado com fallback GERAL + LEGADO */
    const campaignOptions = useMemo(() => {
        const normalized = (Array.isArray(campaigns) ? campaigns : []).map(normalizeCampaignDoc);
        if (normalized.length === 0) {
            return [
                { id: CAMPAIGN_GENERAL_ID, nome: CAMPAIGN_GENERAL_NAME, status: 'ativo', autoEnabled: false, startDate: '', endDate: '', priority: 0 },
                { id: CAMPAIGN_LEGACY_ID, nome: CAMPAIGN_DEFAULT_NAME, status: 'inativo', autoEnabled: false, startDate: '', endDate: '', priority: -1 },
            ];
        }
        return normalized;
    }, [campaigns]);

    /* ── campaignMap: Mapa id → campanha para lookup rápido ─────────── */
    const campaignMap = useMemo(() => {
        const map = {};
        campaignOptions.forEach((item) => {
            map[item.id] = item;
        });
        return map;
    }, [campaignOptions]);

    /* ── menuTabOptions: Abas do cardápio calculadas dinamicamente ────
       Combina abas customizadas (localSettings.menuTabs) com as
       abas padrão e as abas descobertas nos produtos existentes. */
    const menuTabOptions = useMemo(() => {
        return buildMenuTabOptions({ siteSettings: localSettings, products });
    }, [localSettings, products]);

    /* ── defaultMenuTabKey: chave da primeira aba (fallback) ──────── */
    const defaultMenuTabKey = menuTabOptions[0]?.key || DEFAULT_MENU_TAB_OPTIONS[0].key;

    /* ── Efeito: Inicializa rascunhos de campanhas a partir do Firebase ──
       Quando campaignOptions muda, cria rascunhos (campaignDrafts)
       para cada campanha que ainda não tem rascunho. Isso permite
       editar campanhas sem alterar o original até salvar. */
    useEffect(() => {
        setCampaignDrafts(prev => {
            const next = { ...prev };
            campaignOptions.forEach((item) => {
                if (next[item.id]) return;
                next[item.id] = {
                    nome: safeText(item.nome),
                    autoEnabled: item.autoEnabled === true,
                    startDate: normalizeDateOnlyOrEmpty(item.startDate),
                    endDate: normalizeDateOnlyOrEmpty(item.endDate),
                    priority: normalizeCampaignPriority(item.priority),
                };
            });
            return next;
        });
    }, [campaignOptions]);

    /* ── mergedCampaignSchedules: Campanhas com rascunhos aplicados ──
       Combina campaignOptions com campaignDrafts (edições pendentes).
       Usado para detectar conflitos de horário entre campanhas. */
    const mergedCampaignSchedules = useMemo(() => {
        return campaignOptions.map((item) => normalizeCampaignDoc({
            ...item,
            ...(campaignDrafts[item.id] || {}),
        }));
    }, [campaignOptions, campaignDrafts]);

    /* ── campaignScheduleConflicts: Conflitos de horário entre campanhas ──
       Detecta sobreposições de datas entre campanhas com autoEnabled.
       Retorna array de conflitos com ids das campanhas envolvidas. */
    const campaignScheduleConflicts = useMemo(() => {
        return buildCampaignScheduleConflicts(mergedCampaignSchedules);
    }, [mergedCampaignSchedules]);

    /* ── campaignConflictById: Mapa id → conflito para lookup rápido ─── */
    const campaignConflictById = useMemo(() => {
        const map = {};
        campaignScheduleConflicts.forEach((conflict) => {
            conflict.ids.forEach((id) => {
                if (!map[id]) map[id] = [];
                map[id].push(conflict);
            });
        });
        return map;
    }, [campaignScheduleConflicts]);

    const createCampaignPreviewConflicts = useMemo(() => {
        const previewId = slugifyCampaignId(campaignForm.id || campaignForm.nome);
        if (!previewId) return [];
        const previewCampaign = normalizeCampaignDoc({
            id: previewId,
            nome: safeText(campaignForm.nome).trim() || previewId,
            autoEnabled: campaignForm.autoEnabled === true,
            startDate: campaignForm.startDate,
            endDate: campaignForm.endDate,
            priority: campaignForm.priority,
        });
        const nextList = mergedCampaignSchedules.filter((item) => item.id !== previewId).concat(previewCampaign);
        return buildCampaignScheduleConflicts(nextList).filter((item) => item.ids.includes(previewId));
    }, [campaignForm, mergedCampaignSchedules]);

    const getCampaignName = useCallback((campaignId) => {
        const normalizedId = normalizeCampaignId(campaignId, CAMPAIGN_LEGACY_ID);
        return campaignMap[normalizedId]?.nome || CAMPAIGN_DEFAULT_NAME;
    }, [campaignMap]);

    useEffect(() => {
        const next = activeCampaignId || CAMPAIGN_GENERAL_ID;
        setOrderCampaignFilter(next);
        setInsightsCampaignFilter(next);
        setDeliveryCampaignFilter(next);
        setScheduleCampaignFilter(next);
        setNewProd(prev => ({ ...prev, campaignId: prev.campaignId || next, menuTab: prev.menuTab || defaultMenuTabKey }));
        setScheduleForm(prev => ({ ...prev, campaignId: prev.campaignId || next }));
    }, [activeCampaignId, defaultMenuTabKey]);

    const dupSet = useMemo(() => {
        if (tab !== 'orders') return new Set();
        return buildDuplicateSet(allOrders);
    }, [allOrders, tab]);

    const filteredMenuProducts = useMemo(() => {
        const normalizedSearch = normalizeText(menuSearch).toLowerCase();
        if (!normalizedSearch) return products;

        return (Array.isArray(products) ? products : []).filter((product) => {
            const searchableValues = [
                product.name,
                product.tag,
                product.desc,
                product.size,
                product.weight,
                getMenuTabLabel(product.menuTab || product.menuCategory || product.category, menuTabOptions),
                getCampaignName(product.campaignId),
            ];
            return searchableValues.some((value) => normalizeText(value).toLowerCase().includes(normalizedSearch));
        });
    }, [products, menuSearch, getCampaignName, menuTabOptions]);

    const normalizedOrders = useMemo(() => {
        return (Array.isArray(allOrders) ? allOrders : []).map((order) => ({
            ...order,
            campaignId: normalizeCampaignId(order.campaignId, CAMPAIGN_LEGACY_ID),
        }));
    }, [allOrders, activeCampaignId]);

    useEffect(() => {
        if (tab !== 'orders') return undefined;
        setOperationNowMs(Date.now());
        const timerId = window.setInterval(() => setOperationNowMs(Date.now()), 60 * 1000);
        return () => window.clearInterval(timerId);
    }, [tab]);

    useEffect(() => {
        if (!db || tab !== 'orders') return undefined;
        let unsub = () => {};

        orderRealtimeInitializedRef.current = false;
        operationKnownOrderIdsRef.current = new Set();

        const processSnapshot = (snap) => {
            const list = snap.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    campaignId: normalizeCampaignId(data?.campaignId, CAMPAIGN_LEGACY_ID),
                };
            });

            list.sort((a, b) => {
                const createdDiff = getOrderCreatedAtMillis(b) - getOrderCreatedAtMillis(a);
                if (createdDiff !== 0) return createdDiff;
                return safeText(b.id).localeCompare(safeText(a.id));
            });

            setOperationActiveOrders(list);

            if (!orderRealtimeInitializedRef.current) {
                snap.docs.forEach((docSnap) => operationKnownOrderIdsRef.current.add(docSnap.id));
                orderRealtimeInitializedRef.current = true;
                return;
            }

            const addedOrders = [];
            snap.docChanges().forEach((change) => {
                if (change.type !== 'added') return;
                const orderId = change.doc.id;
                if (operationKnownOrderIdsRef.current.has(orderId)) return;

                operationKnownOrderIdsRef.current.add(orderId);
                const data = change.doc.data() || {};
                addedOrders.push({
                    id: orderId,
                    ...data,
                    campaignId: normalizeCampaignId(data?.campaignId, CAMPAIGN_LEGACY_ID),
                });
            });

            if (addedOrders.length > 0) {
                addedOrders.forEach((order) => triggerRealtimeOrderAlertsRef.current(order));
            }
        };

        const handleActiveListenerError = (err) => {
            console.warn('orders active snapshot error:', err.message);
            setOperationActiveOrders([]);
        };

        try {
            // Query 1: pedidos operacionais ativos (não concluídos).
            // Evita índice composto exigido por where(status in ...) + orderBy(createdAt).
            unsub = getCol('orders')
                .where('status', 'in', OPERATION_ACTIVE_STATUSES)
                .onSnapshot(processSnapshot, handleActiveListenerError);
        } catch (error) {
            console.warn('orders active init error:', error.message);
            setOperationActiveOrders([]);
        }
        return () => unsub();
    }, [db, tab]);

    useEffect(() => {
        if (!db || tab !== 'orders') return undefined;
        const cutoffTs = firebase.firestore.Timestamp.fromMillis(Math.max(0, operationNowMs - OPERATION_CONCLUDED_VISIBILITY_MS));
        let unsub = () => {};
        try {
            // Query 2: somente concluídos recentes, usando concluidoEm como corte temporal.
            unsub = getCol('orders')
                .where('concluidoEm', '>=', cutoffTs)
                .orderBy('concluidoEm', 'desc')
                .onSnapshot((snap) => {
                    const list = snap.docs
                        .map((docSnap) => {
                            const data = docSnap.data();
                            return {
                                id: docSnap.id,
                                ...data,
                                campaignId: normalizeCampaignId(data?.campaignId, CAMPAIGN_LEGACY_ID),
                            };
                        })
                        .filter((order) => isConcludedStatusValue(order.status));
                    setOperationRecentConcludedOrders(list);
                }, (err) => {
                    console.warn('orders recent concluded snapshot error:', err.message);
                    setOperationRecentConcludedOrders([]);
                });
        } catch (error) {
            console.warn('orders recent concluded init error:', error.message);
            setOperationRecentConcludedOrders([]);
        }
        return () => unsub();
    }, [db, tab, operationNowMs]);

    const operationOrders = useMemo(() => {
        const cutoffMs = Math.max(0, operationNowMs - OPERATION_CONCLUDED_VISIBILITY_MS);
        const mergedById = new Map();

        operationActiveOrders.forEach((order) => {
            if (!order?.id) return;
            mergedById.set(order.id, order);
        });

        operationRecentConcludedOrders.forEach((order) => {
            if (!order?.id) return;
            mergedById.set(order.id, order);
        });

        return Array.from(mergedById.values()).filter((order) => {
            if (!isConcludedStatusValue(order.status)) return true;
            const concludedAtMillis = toTimestampMillis(order.concluidoEm || order.completedAt);
            return concludedAtMillis >= cutoffMs;
        });
    }, [operationActiveOrders, operationRecentConcludedOrders, operationNowMs]);

    // Firestore listener para entregadores
    useEffect(() => {
        if (!db || !['orders', 'deliveries', 'drivers'].includes(tab)) return undefined;
        let unsub = () => {};
        try {
            unsub = getCol('drivers')
                .orderBy('name')
                .onSnapshot(snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setDrivers(list);
                }, err => console.warn('drivers snapshot error:', err.message));
        } catch (e) {
            console.warn('drivers init error:', e.message);
        }
        return () => unsub();
    }, [db, tab]);

    const activeDrivers = useMemo(() => drivers.filter(d => d.active !== false), [drivers]);

    /* ── Listener Firestore: site_visits (registros detalhados de acesso) ──
       Carrega todos os documentos da collection site_visits para o painel
       de análise de tráfego. Cada documento contém: visitorId, timestamp,
       dateOnly, page, utmSource, utmMedium, utmCampaign, source, device, browser.
       Ordena por timestamp descendente para que os mais recentes apareçam primeiro. */
    useEffect(() => {
        if (!db || tab !== 'visits') return undefined;
        let unsub = () => {};
        try {
            unsub = getCol('site_visits')
                .orderBy('timestamp', 'desc')
                .onSnapshot(snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setSiteVisits(list);
                }, err => console.warn('site_visits snapshot error:', err.message));
        } catch (e) {
            console.warn('site_visits init error:', e.message);
        }
        return () => unsub();
    }, [db, tab]);

    /* ════════════════════════════════════════════════════════════════
       PAINEL DE ANÁLISE DE TRÁFEGO — Dados computados (useMemo)
       ════════════════════════════════════════════════════════════════
       Calcula datas do período selecionado, filtra visitas, e deriva
       todas as métricas e agrupamentos necessários para o painel. */

    /* ── Calcula intervalo de datas do período selecionado ──
       Retorna { inicio: Date, fim: Date } ou null se período personalizado
       sem datas preenchidas. */
    const trafegoIntervaloDatas = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);

        const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        fimMesAnterior.setHours(23, 59, 59, 999);

        switch (trafegoPeriodo) {
            case 'hoje': return { inicio: hoje, fim: amanha };
            case 'ontem': {
                const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
                return { inicio: ontem, fim: hoje };
            }
            case '7d': {
                const sete = new Date(hoje); sete.setDate(sete.getDate() - 7);
                return { inicio: sete, fim: amanha };
            }
            case '30d': {
                const trinta = new Date(hoje); trinta.setDate(trinta.getDate() - 30);
                return { inicio: trinta, fim: amanha };
            }
            case 'este_mes': return { inicio: inicioMesAtual, fim: amanha };
            case 'mes_anterior': return { inicio: inicioMesAnterior, fim: new Date(fimMesAnterior.getTime() + 1) };
            case 'personalizado': {
                if (!trafegoDataInicio || !trafegoDataFim) return null;
                const di = new Date(trafegoDataInicio + 'T00:00:00');
                const df = new Date(trafegoDataFim + 'T23:59:59.999');
                return { inicio: di, fim: new Date(df.getTime() + 1) };
            }
            default: return { inicio: new Date(hoje.getTime() - 7 * 86400000), fim: amanha };
        }
    }, [trafegoPeriodo, trafegoDataInicio, trafegoDataFim]);

    /* ── Filtra visitas pelo período e campanha selecionados ──
       Usa timestamp do Firestore (converte para millis se necessário).
       Filtra também por campanha UTM se filtro ativo. */
    const trafegoVisitasFiltradas = useMemo(() => {
        if (!trafegoIntervaloDatas) return [];
        const { inicio, fim } = trafegoIntervaloDatas;
        const inicioMs = inicio.getTime();
        const fimMs = fim.getTime();

        return siteVisits.filter(v => {
            /* Converte timestamp Firestore para millis */
            const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() :
                       (v.timestamp?.seconds ? v.timestamp.seconds * 1000 :
                       (v.timestamp instanceof Date ? v.timestamp.getTime() : 0));
            if (ts < inicioMs || ts >= fimMs) return false;

            /* Filtro de campanha UTM */
            if (trafegoFiltroCampanha && trafegoFiltroCampanha !== 'direto') {
                if (safeText(v.utmCampaign) !== trafegoFiltroCampanha) return false;
            }
            if (trafegoFiltroCampanha === 'direto' && safeText(v.utmCampaign)) return false;

            return true;
        });
    }, [siteVisits, trafegoIntervaloDatas, trafegoFiltroCampanha]);

    /* ── Métricas principais do período ──
       Visitantes únicos (por visitorId), total de visitas,
       primeira/última visita, média diária, campanha com mais acessos. */
    const trafegoMetricas = useMemo(() => {
        if (!trafegoVisitasFiltradas.length) {
            return { visitantesUnicos: 0, totalVisitas: 0, primeiraVisita: null, ultimaVisita: null, mediaDiaria: 0, campanhaTop: null };
        }
        const visitorIds = new Set();
        const campanhaCount = {};
        let primeiraTs = Infinity;
        let ultimaTs = -Infinity;
        const diasComVisita = new Set();

        trafegoVisitasFiltradas.forEach(v => {
            visitorIds.add(v.visitorId);
            const camp = safeText(v.utmCampaign);
            if (camp) campanhaCount[camp] = (campanhaCount[camp] || 0) + 1;
            const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() :
                       (v.timestamp?.seconds ? v.timestamp.seconds * 1000 : 0);
            if (ts && ts < primeiraTs) primeiraTs = ts;
            if (ts && ts > ultimaTs) ultimaTs = ts;
            if (v.dateOnly) diasComVisita.add(v.dateOnly);
        });

        let campanhaTop = null;
        let maxCount = 0;
        Object.entries(campanhaCount).forEach(([nome, count]) => {
            if (count > maxCount) { maxCount = count; campanhaTop = nome; }
        });

        const numDias = diasComVisita.size || 1;
        return {
            visitantesUnicos: visitorIds.size,
            totalVisitas: trafegoVisitasFiltradas.length,
            primeiraVisita: primeiraTs !== Infinity ? new Date(primeiraTs) : null,
            ultimaVisita: ultimaTs !== -Infinity ? new Date(ultimaTs) : null,
            mediaDiaria: (trafegoVisitasFiltradas.length / numDias).toFixed(1),
            campanhaTop,
        };
    }, [trafegoVisitasFiltradas]);

    /* ── Visitas agrupadas por dia (para gráfico de barras) ──
       Retorna array ordenado: [{ data: 'YYYY-MM-DD', visitas: N, unicos: N }] */
    const trafegoPorDia = useMemo(() => {
        const mapa = {};
        trafegoVisitasFiltradas.forEach(v => {
            const dia = v.dateOnly || '???';
            if (!mapa[dia]) mapa[dia] = { data: dia, visitas: 0, unicos: new Set() };
            mapa[dia].visitas += 1;
            mapa[dia].unicos.add(v.visitorId);
        });
        return Object.values(mapa)
            .map(d => ({ ...d, unicos: d.unicos.size }))
            .sort((a, b) => a.data.localeCompare(b.data));
    }, [trafegoVisitasFiltradas]);

    /* ── Visitas agrupadas por mês (para gráfico) ──
       Retorna array: [{ mes: 'YYYY-MM', visitas: N, unicos: N }] */
    const trafegoPorMes = useMemo(() => {
        const mapa = {};
        trafegoVisitasFiltradas.forEach(v => {
            const mes = (v.dateOnly || '').slice(0, 7);
            if (!mes || mes.length < 7) return;
            if (!mapa[mes]) mapa[mes] = { mes, visitas: 0, unicos: new Set() };
            mapa[mes].visitas += 1;
            mapa[mes].unicos.add(v.visitorId);
        });
        return Object.values(mapa)
            .map(d => ({ ...d, unicos: d.unicos.size }))
            .sort((a, b) => a.mes.localeCompare(b.mes));
    }, [trafegoVisitasFiltradas]);

    /* ── Visitas agrupadas por campanha UTM ──
       Retorna array ordenado por visitas desc:
       [{ campanha, source, medium, visitas, unicos, primeiraVisita, ultimaVisita }] */
    const trafegoPorCampanha = useMemo(() => {
        const mapa = {};
        trafegoVisitasFiltradas.forEach(v => {
            const camp = safeText(v.utmCampaign) || '(Direto)';
            if (!mapa[camp]) mapa[camp] = { campanha: camp, source: safeText(v.utmSource) || '-', medium: safeText(v.utmMedium) || '-', visitas: 0, unicos: new Set(), primeiraTs: Infinity, ultimaTs: -Infinity };
            mapa[camp].visitas += 1;
            mapa[camp].unicos.add(v.visitorId);
            const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() : (v.timestamp?.seconds ? v.timestamp.seconds * 1000 : 0);
            if (ts && ts < mapa[camp].primeiraTs) mapa[camp].primeiraTs = ts;
            if (ts && ts > mapa[camp].ultimaTs) mapa[camp].ultimaTs = ts;
        });
        return Object.values(mapa)
            .map(d => ({ ...d, unicos: d.unicos.size, primeiraVisita: d.primeiraTs !== Infinity ? new Date(d.primeiraTs) : null, ultimaVisita: d.ultimaTs !== -Infinity ? new Date(d.ultimaTs) : null }))
            .sort((a, b) => b.visitas - a.visitas);
    }, [trafegoVisitasFiltradas]);

    /* ── Visitas agrupadas por origem (source) ──
       Retorna array ordenado por visitas desc:
       [{ source, visitas, unicos }] */
    const trafegoPorSource = useMemo(() => {
        const mapa = {};
        trafegoVisitasFiltradas.forEach(v => {
            const src = safeText(v.source) || 'Direto';
            if (!mapa[src]) mapa[src] = { source: src, visitas: 0, unicos: new Set() };
            mapa[src].visitas += 1;
            mapa[src].unicos.add(v.visitorId);
        });
        return Object.values(mapa)
            .map(d => ({ ...d, unicos: d.unicos.size }))
            .sort((a, b) => b.visitas - a.visitas);
    }, [trafegoVisitasFiltradas]);

    /* ── Lista de campanhas UTM únicas (para filtro select) ──
       Extrai nomes de campanha distintos dos registros de visita. */
    const trafegoOpcoesCampanha = useMemo(() => {
        const set = new Set();
        siteVisits.forEach(v => { const c = safeText(v.utmCampaign); if (c) set.add(c); });
        return Array.from(set).sort();
    }, [siteVisits]);

    /* ── Tabela de acessos com busca e paginação ──
       Filtra por texto de busca e pagina com 20 itens por página. */
    const ACESSOS_POR_PAGINA = 20;
    const trafegoTabelaFiltrada = useMemo(() => {
        if (!trafegoBusca) return trafegoVisitasFiltradas;
        const termo = trafegoBusca.toLowerCase();
        return trafegoVisitasFiltradas.filter(v => {
            const texto = [v.visitorId, v.source, v.utmCampaign, v.utmSource, v.utmMedium, v.page, v.device, v.browser, v.dateOnly]
                .filter(Boolean).join(' ').toLowerCase();
            return texto.includes(termo);
        });
    }, [trafegoVisitasFiltradas, trafegoBusca]);

    const trafegoTotalPaginas = Math.max(1, Math.ceil(trafegoTabelaFiltrada.length / ACESSOS_POR_PAGINA));
    const trafegoTabelaPaginada = trafegoTabelaFiltrada.slice(trafegoPagina * ACESSOS_POR_PAGINA, (trafegoPagina + 1) * ACESSOS_POR_PAGINA);

    const assignDriver = useCallback(async (orderId, driverId) => {
        if (!orderId) return;
        const driver = drivers.find(d => d.id === driverId);
        const data = { driverId: driverId || firebase.firestore.FieldValue.delete(), driverName: driver ? driver.name : firebase.firestore.FieldValue.delete() };
        try {
            await getCol('orders').doc(orderId).update(data);
        } catch (err) {
            console.error('assignDriver error:', err);
            alert('Erro ao atribuir entregador: ' + err.message);
        }
    }, [drivers]);

    const {
        cashflowCategories,
        cashflowPaymentMethods,
        cashflowStatusOptions,
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
    /* ── useFinanceDomain: Hook de domínio financeiro ──────────────────
       Importado de financeiro.js. Fornece toda a lógica de:
       - Filtros e paginação de transações
       - Formulário de nova entrada/saída
       - CRUD de lançamentos (criar, editar, excluir)
       - Edição inline na tabela
       - Exportação CSV (transações e consolidado mensal)
       - Fechamento diário de caixa */
    } = window.HeloFinance.useFinanceDomain({ activeCampaignId, financialEntries, normalizedOrders });

    /* ── useInventoryDomain: Hook de domínio de estoque ────────────────
       Importado de estoque.js. Fornece toda a lógica de:
       - Estados de formulário de ingrediente e receita
       - Seleção de ingrediente/quantidade/unidade/desperdício
       - CRUD de ingredientes e receitas (criar, editar, atualizar)
       - Adicionar/remover ingredientes de receitas
       - Produção em lote (dar baixa no estoque)
       - Cálculo de custo de receita
       - Conversão de unidades (built-in + customizadas)
       - Alertas de estoque baixo */
    const {
        newIng,
        setNewIng,
        setNewIngError,
        newRecipe,
        setNewRecipe,
        recipeIngredients,
        setRecipeIngredients,
        ingSelect,
        setIngSelect,
        ingQtySelect,
        setIngQtySelect,
        ingUnitSelect,
        setIngUnitSelect,
        ingWasteSelect,
        setIngWasteSelect,
        editIng,
        setEditIng,
        editRecipe,
        setEditRecipe,
        editRecipeIngSelect,
        setEditRecipeIngSelect,
        editRecipeIngQty,
        setEditRecipeIngQty,
        editRecipeIngUnit,
        setEditRecipeIngUnit,
        editRecipeIngWaste,
        setEditRecipeIngWaste,
        prodInputs,
        setProdInputs,
        inputsSaving,
        conversions,
        newConversion,
        setNewConversion,
        convCalc,
        setConvCalc,
        calcRecipeCosts,
        convertWithBuiltins,
        convertUnits,
        conversionResult,
        apiCreateIngredient,
        handleAddIngredientToRecipe,
        handleRemoveIngredientFromRecipe,
        handleAddIngToEditRecipe,
        handleRemoveIngFromEditRecipe,
        apiCreateRecipe,
        apiProduceBatch,
        lowStockAlerts,
        updateIngredient,
        updateRecipe,
        saveProductionInputs,
        addConversion,
    } = window.HeloInventory.useInventoryDomain({ ingredients });

    /* ── orderProductCategoryLookup: Mapas de categoria por produto ────
       Monta índices de categoria por produto para resolver categoria
       de itens em pedidos antigos que não tinham o campo category.
       Recebe: catálogo atual e abas de menu ativas.
       Retorna: { byId: Map<productId, categoryLabel>,
                   byName: Map<productName, categoryLabel> } */
    const orderProductCategoryLookup = useMemo(() => {
        const byId = new Map();
        const byName = new Map();
        (Array.isArray(products) ? products : []).forEach((product) => {
            const menuTabKey = resolveProductMenuTab(product, menuTabOptions);
            const categoryLabel = safeText(getMenuTabLabel(menuTabKey, menuTabOptions)).trim();
            if (!categoryLabel) return;

            const productIdKey = safeText(product?.id).trim().toLowerCase();
            if (productIdKey && !byId.has(productIdKey)) byId.set(productIdKey, categoryLabel);

            const productNameKey = normalizeSearchTerm(product?.name);
            if (productNameKey && !byName.has(productNameKey)) byName.set(productNameKey, categoryLabel);
        });
        return { byId, byName };
    }, [products, menuTabOptions]);

    // Resolve a categoria exibida para um item de pedido na aba Pedidos.
    // Recebe: item do pedido (com ou sem categoria persistida).
    // Retorna: label amigável da categoria para etiqueta e filtros.
    const getOrderItemCategoryLabel = useCallback((item = {}) => {
        const directCategoryKey = normalizeMenuTabKey(
            item?.menuTab || item?.menuCategory || item?.category || item?.categoria || item?.collection || item?.tipo || item?.type,
            menuTabOptions,
        );
        if (directCategoryKey) return getMenuTabLabel(directCategoryKey, menuTabOptions);

        const productIdKey = safeText(item?.productId || item?.id).trim().toLowerCase();
        if (productIdKey && orderProductCategoryLookup.byId.has(productIdKey)) {
            return orderProductCategoryLookup.byId.get(productIdKey);
        }

        const itemNameKey = normalizeSearchTerm(item?.name);
        if (itemNameKey && orderProductCategoryLookup.byName.has(itemNameKey)) {
            return orderProductCategoryLookup.byName.get(itemNameKey);
        }

        return '';
    }, [menuTabOptions, orderProductCategoryLookup]);

    // Extrai categorias únicas presentes em um pedido para filtros e exibição rápida.
    // Recebe: pedido completo da operação.
    // Retorna: array único com labels de categoria dos itens do pedido.
    const getOrderCategoryLabels = useCallback((order = {}) => {
        const labels = new Set();
        const items = Array.isArray(order?.items) ? order.items : [];
        items.forEach((item) => {
            const categoryLabel = safeText(getOrderItemCategoryLabel(item)).trim();
            if (categoryLabel) labels.add(categoryLabel);
        });
        return Array.from(labels);
    }, [getOrderItemCategoryLabel]);

    const orderCampaignScopedOrders = useMemo(() => {
        if (orderCampaignFilter === 'all') return operationOrders;
        return operationOrders.filter((order) => normalizeCampaignId(order.campaignId, CAMPAIGN_LEGACY_ID) === orderCampaignFilter);
    }, [operationOrders, orderCampaignFilter]);

    // Gera opções de filtro de categoria com base no recorte atual da campanha.
    // Recebe: pedidos já filtrados por campanha e resolvedor de categoria por pedido.
    // Retorna: lista normalizada para select de categoria na aba Pedidos.
    const orderCategoryOptions = useMemo(() => {
        const uniqueMap = new Map();
        orderCampaignScopedOrders.forEach((order) => {
            getOrderCategoryLabels(order).forEach((label) => {
                const value = normalizeSearchTerm(label);
                if (!value || uniqueMap.has(value)) return;
                uniqueMap.set(value, label);
            });
        });
        return Array.from(uniqueMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => safeText(a.label).localeCompare(safeText(b.label), 'pt-BR'));
    }, [orderCampaignScopedOrders, getOrderCategoryLabels]);

    useEffect(() => {
        if (orderCategoryFilter === 'all') return;
        const stillAvailable = orderCategoryOptions.some((option) => option.value === orderCategoryFilter);
        if (!stillAvailable) setOrderCategoryFilter('all');
    }, [orderCategoryFilter, orderCategoryOptions]);

    // Constrói o texto pesquisável da aba Pedidos com todos os dados visíveis ao operador.
    // Recebe: pedido individual já normalizado.
    // Retorna: string consolidada para busca ampla e profissional.
    const buildOrderSearchText = useCallback((order = {}) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        const itemSearchBlocks = items.map((item) => buildSearchableText([
            item?.name,
            item?.productId,
            item?.qty,
            item?.price,
            getOrderItemCategoryLabel(item),
        ]));
        return buildSearchableText([
            order.id,
            order.customerName,
            order.customerPhone,
            order.status,
            order.method,
            order.address,
            order.observations,
            order.paymentMethod,
            order.driverName,
            order.date,
            order.time,
            getCampaignName(order.campaignId),
            Number(order.total || 0).toFixed(2),
            Number(order.paidAmount || 0).toFixed(2),
            Number(order.deliveryFee || 0).toFixed(2),
            getOrderCategoryLabels(order),
            itemSearchBlocks,
        ]);
    }, [getCampaignName, getOrderCategoryLabels, getOrderItemCategoryLabel]);

    const filtered = useMemo(() => {
        let list = orderCampaignScopedOrders;
        if (orderCategoryFilter !== 'all') {
            list = list.filter((order) => {
                const categoryLabels = getOrderCategoryLabels(order);
                return categoryLabels.some((categoryLabel) => normalizeSearchTerm(categoryLabel) === orderCategoryFilter);
            });
        }
        if (orderPaymentFilter !== 'all') {
            list = list.filter(o => {
                const total = Number(o.total || 0);
                const status = safeText(o.status, 'Novo');
                const isPaid = ['Pago', 'Pronto', 'Concluído'].includes(status);
                const paidRaw = Number(o.paidAmount);
                const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
                const paid = isPaid ? (hasManualPaid ? Math.min(total, paidRaw) : total) : 0;
                const pending = Math.max(0, total - paid);
                if (orderPaymentFilter === 'paid') return isPaid && pending <= 0.005;
                if (orderPaymentFilter === 'partial') return isPaid && pending > 0.005;
                if (orderPaymentFilter === 'unpaid') return !isPaid;
                return true;
            });
        }
        const term = normalizeSearchTerm(search);
        if (term) {
            list = list.filter((order) => buildOrderSearchText(order).includes(term));
        }

        const sorted = [...list].sort((a, b) => {
            // 1) Agrupa por status (ativos primeiro, concluídos por último).
            const groupA = isConcludedStatusValue(a.status) ? 1 : 0;
            const groupB = isConcludedStatusValue(b.status) ? 1 : 0;
            if (groupA !== groupB) return groupA - groupB;

            // 2) Dentro de cada grupo, ordena por criação (mais recente → mais antigo).
            const createdDiff = getOrderCreatedAtMillis(b) - getOrderCreatedAtMillis(a);
            if (createdDiff !== 0) return createdDiff;

            return safeText(b.id).localeCompare(safeText(a.id));
        });

        return sorted;
    }, [orderCampaignScopedOrders, orderCategoryFilter, orderPaymentFilter, search, getOrderCategoryLabels, buildOrderSearchText]);

    const insightsOrders = useMemo(() => {
        if (insightsCampaignFilter === 'all') return normalizedOrders;
        return normalizedOrders.filter(o => normalizeCampaignId(o.campaignId, CAMPAIGN_LEGACY_ID) === insightsCampaignFilter);
    }, [normalizedOrders, insightsCampaignFilter]);

    // Cria um mapa de nome atual do catálogo por productId.
    // Recebe: lista de produtos já carregada no admin.
    // Retorna: Map<productIdNormalizado, nomeAtualDoProduto> para manter rankings alinhados após renomear produto.
    const productCatalogNameById = useMemo(() => {
        const lookup = new Map();
        (Array.isArray(products) ? products : []).forEach((product) => {
            const productIdKey = safeText(product?.id).trim().toLowerCase();
            const productName = safeText(product?.name).trim();
            if (!productIdKey || !productName || lookup.has(productIdKey)) return;
            lookup.set(productIdKey, productName);
        });
        return lookup;
    }, [products]);

    const topCustomers = useMemo(() => {
        const stats = {};
        insightsOrders.forEach(o => {
            const ph = safeText(o.customerPhone, 'Desconhecido');
            if (!stats[ph]) stats[ph] = { phone: ph, names: new Set(), spent: 0, count: 0, unitsCount: 0 };
            stats[ph].spent += Number(o.total || 0);
            stats[ph].count++;
            let unitsInOrder = 0;
            if (Array.isArray(o.items)) o.items.forEach(item => { unitsInOrder += Number(item?.qty || 1); });
            stats[ph].unitsCount += unitsInOrder;
            if (o.customerName) stats[ph].names.add(safeText(o.customerName));
        });
        return Object.values(stats).map(c => ({ ...c, name: Array.from(c.names).join(' / ') || 'Cliente' })).sort((a, b) => b.spent - a.spent);
    }, [insightsOrders]);

    // Consolida o ranking de vendas por produto para a aba Clientes > Desempenho de Produtos.
    // Recebe: pedidos filtrados por campanha (insightsOrders) e catálogo atual (productCatalogNameById).
    // Retorna: lista ordenada com { key, name, qty, revenue } + totais de unidades/receita, evitando duplicidade após renomear produto.
    const productSalesStats = useMemo(() => {
        const stats = {};
        let totalQty = 0, totalRev = 0;
        insightsOrders.forEach(o => {
            if (Array.isArray(o.items)) {
                o.items.forEach(item => {
                    const rawItemName = safeText(item?.name, 'Produto').trim() || 'Produto';
                    const productIdKey = safeText(item?.productId || item?.id).trim().toLowerCase();
                    const catalogName = productIdKey && productCatalogNameById.has(productIdKey)
                        ? safeText(productCatalogNameById.get(productIdKey)).trim()
                        : '';
                    const resolvedItemName = catalogName || rawItemName;
                    const normalizedNameKey = normalizeSearchTerm(resolvedItemName) || 'produto';
                    const statsKey = productIdKey ? `id::${productIdKey}` : `name::${normalizedNameKey}`;

                    if (!stats[statsKey]) {
                        stats[statsKey] = {
                            key: statsKey,
                            name: resolvedItemName,
                            qty: 0,
                            revenue: 0,
                        };
                    }

                    const qtyRaw = Number(item?.qty);
                    const q = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
                    const priceRaw = Number(item?.price);
                    const unitPrice = Number.isFinite(priceRaw) ? priceRaw : 0;
                    const r = unitPrice * q;

                    stats[statsKey].qty += q;
                    stats[statsKey].revenue += r;
                    if (catalogName) stats[statsKey].name = catalogName;
                    totalQty += q; totalRev += r;
                });
            }
        });
        return {
            list: Object.values(stats).sort((a, b) => {
                const qtyDiff = b.qty - a.qty;
                if (qtyDiff !== 0) return qtyDiff;
                const revDiff = b.revenue - a.revenue;
                if (revDiff !== 0) return revDiff;
                return safeText(a.name).localeCompare(safeText(b.name), 'pt-BR');
            }),
            totalQty,
            totalRev,
        };
    }, [insightsOrders, productCatalogNameById]);
    const filteredProdSales = useMemo(() => {
        const term = normalizeSearchTerm(prodSearch);
        if (!term) return productSalesStats.list;
        return productSalesStats.list.filter((productStat) => {
            const searchableText = buildSearchableText([
                productStat.name,
                `quantidade ${productStat.qty}`,
                `receita ${Number(productStat.revenue || 0).toFixed(2)}`,
            ]);
            return searchableText.includes(term);
        });
    }, [productSalesStats.list, prodSearch]);
    const feedbackMap = useMemo(() => {
        if (tab !== 'feedback') return {};
        return Object.fromEntries((feedbacks || []).map(f => [f.orderId || f.id, f]));
    }, [feedbacks, tab]);
    const concludedOrders = useMemo(() => (
        (tab === 'feedback' ? (allOrders || []) : [])
            .filter(o => safeText(o.status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === 'concluido' && safeText(o.customerPhone))
            .map(o => ({ ...o, feedback: feedbackMap[o.id] || null }))
    ), [allOrders, feedbackMap, tab]);

    const filteredFeedbackOrders = useMemo(() => {
        return concludedOrders.filter(order => {
            let pass = true;
            if (feedbackFilter !== 'all') {
                const rating = Number(order.feedback?.rating);
                if (!order.feedback?.answeredAt || isNaN(rating)) pass = false;
                if (feedbackFilter === 'good' && !(rating >= 8 && rating <= 10)) pass = false;
                if (feedbackFilter === 'neutral' && !(rating >= 6 && rating <= 7)) pass = false;
                if (feedbackFilter === 'bad' && !(rating >= 1 && rating <= 5)) pass = false;
            }
            if (pass && feedbackStatusFilter && feedbackStatusFilter !== 'all') {
                const feedback = order.feedback;
                const status = feedback?.answeredAt ? 'respondido' : feedback?.invitedAt ? 'enviado' : 'pendente';
                if (feedbackStatusFilter !== status) pass = false;
            }
            return pass;
        });
    }, [concludedOrders, feedbackFilter, feedbackStatusFilter]);

    useEffect(() => {
        if (tab !== 'agenda') return undefined;
        const unsub = getCol('agendamentos').onSnapshot(
            snap => setAdminSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            err => {
                const msg = (err?.message || '').toLowerCase();
                if (!msg.includes('permission') && !msg.includes('offline') && !msg.includes('network') && !msg.includes('unavailable')) {
                    console.warn('agendamentos snapshot error:', err.message);
                }
            }
        );
        return unsub;
    }, [tab]);

    useEffect(() => {
        setLocalSettings({
            maxUnits: siteSettings.maxUnits ?? 70,
            orderDeadline: siteSettings.orderDeadline || '2026-03-31T19:00',
            siteMode: siteSettings.siteMode || 'livre',
            enableAnnouncement: siteSettings.enableAnnouncement ?? false,
            announcementText: siteSettings.announcementText || '',
            announcementStyle: siteSettings.announcementStyle || 'info',
            enableScarcityBanner: siteSettings.enableScarcityBanner ?? true,
            campaignMode: normalizeCampaignMode(siteSettings.campaignMode),
            activeCampaignOverrideId: safeText(siteSettings.activeCampaignOverrideId),
            isDeliveryAvailable: siteSettings.isDeliveryAvailable !== undefined ? Boolean(siteSettings.isDeliveryAvailable) : true,
            chavePix: siteSettings.chavePix || '88996549074',
            nomeTitularPix: siteSettings.nomeTitularPix || '',
            menuTabs: buildMenuTabOptions({ siteSettings }).map(option => ({ ...option })),
            ...normalizeThermalPrintSettings({
                thermalPrintEnabled: siteSettings.thermalPrintEnabled,
                thermalPrintAutoOnOrder: siteSettings.thermalPrintAutoOnOrder,
                thermalPrinterName: siteSettings.thermalPrinterName,
                thermalPrintCopies: siteSettings.thermalPrintCopies,
                thermalPrintMode: siteSettings.thermalPrintMode,
                thermalPrintTicketMode: siteSettings.thermalPrintTicketMode,
                thermalPrintBrowserFallback: siteSettings.thermalPrintBrowserFallback,
            }),
        });
    }, [siteSettings]);

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        const syncPermission = () => setNotificationPermission(window.Notification.permission);
        syncPermission();
        window.addEventListener('focus', syncPermission);
        return () => window.removeEventListener('focus', syncPermission);
    }, []);

    const ensureOrderNotificationAudioElement = useCallback(() => {
        if (typeof window === 'undefined') return null;
        if (orderNotificationAudioRef.current) return orderNotificationAudioRef.current;

        try {
            const audio = new window.Audio(buildStaticAssetUrl('./audio/new-order-notification.wav'));
            audio.preload = 'auto';
            audio.volume = 0.9;
            orderNotificationAudioRef.current = audio;
            return audio;
        } catch (error) {
            console.warn('Não foi possível inicializar áudio de novo pedido:', error);
            return null;
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const unlockAudio = () => {
            orderNotificationInteractionUnlockedRef.current = true;
            ensureOrderNotificationAudioElement();
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true });
        window.addEventListener('keydown', unlockAudio, { once: true });

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, [ensureOrderNotificationAudioElement]);

    useEffect(() => {
        return () => {
            orderToastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            orderToastTimersRef.current.clear();
            orderFlowToastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            orderFlowToastTimersRef.current.clear();
            autoPrintExecutionMapRef.current.clear();
            const audio = orderNotificationAudioRef.current;
            if (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (_) {
                    // ignore cleanup errors
                }
            }
        };
    }, []);

    const normalizedAdminSchedules = useMemo(() => {
        const list = Array.isArray(adminSchedules) ? adminSchedules : [];
        return list.map(item => {
            const date = normalizeDateOnlyValue(item.date, '');
            const time = normalizeTimeValue(item.time);
            const scheduledAt = combineDateTime(date, time);
            const status = safeText(item.status, 'Agendado');
            return {
                ...item,
                title: safeText(item.title, ''),
                customerName: safeText(item.customerName, ''),
                customerPhone: safeText(item.customerPhone, ''),
                campaignId: normalizeCampaignId(item.campaignId, CAMPAIGN_LEGACY_ID),
                category: safeText(item.category, 'pedido_manual'),
                date,
                time,
                method: safeText(item.method, 'retirada'),
                paymentMethod: safeText(item.paymentMethod, 'A combinar'),
                address: safeText(item.address, ''),
                total: Number(item.total || 0),
                details: safeText(item.details, ''),
                status,
                notificationEnabled: item.notificationEnabled !== false,
                linkedOrderId: safeText(item.linkedOrderId, ''),
                scheduledAt,
                daysUntil: getDaysUntilDateOnlyValue(date),
                isClosed: ['Concluído', 'Cancelado'].includes(status),
            };
        }).sort((a, b) => {
            const diff = (a.scheduledAt?.getTime() || Number.MAX_SAFE_INTEGER) - (b.scheduledAt?.getTime() || Number.MAX_SAFE_INTEGER);
            if (diff !== 0) return diff;
            return safeText(a.title).localeCompare(safeText(b.title));
        });
    }, [adminSchedules]);

    const campaignScopedSchedules = useMemo(() => {
        if (scheduleCampaignFilter === 'all') return normalizedAdminSchedules;
        return normalizedAdminSchedules.filter(item => normalizeCampaignId(item.campaignId, CAMPAIGN_LEGACY_ID) === scheduleCampaignFilter);
    }, [normalizedAdminSchedules, scheduleCampaignFilter]);

    const filteredAdminSchedules = useMemo(() => {
        const term = normalizeSearchTerm(scheduleSearch);
        return campaignScopedSchedules.filter(item => {
            if (scheduleFilter === 'today' && item.daysUntil !== 0) return false;
            if (scheduleFilter === 'upcoming' && (item.daysUntil === null || item.daysUntil < 0 || item.isClosed)) return false;
            if (scheduleFilter === 'late' && (item.daysUntil === null || item.daysUntil >= 0 || item.isClosed)) return false;
            if (scheduleFilter === 'open' && item.isClosed) return false;
            if (scheduleFilter === 'done' && !item.isClosed) return false;
            if (scheduleFilter === 'unlinked' && safeText(item.linkedOrderId)) return false;
            if (!term) return true;
            const haystack = buildSearchableText([
                item.title,
                item.customerName,
                item.customerPhone,
                item.details,
                adminScheduleCategoryLabel(item.category),
                item.status,
                item.method,
                item.date,
                item.time,
                item.linkedOrderId,
                getCampaignName(item.campaignId),
            ]);
            return haystack.includes(term);
        });
    }, [campaignScopedSchedules, scheduleFilter, scheduleSearch, getCampaignName]);

    const adminScheduleStats = useMemo(() => {
        return campaignScopedSchedules.reduce((acc, item) => {
            if (item.daysUntil === 0 && !item.isClosed) acc.today += 1;
            if (item.daysUntil !== null && item.daysUntil < 0 && !item.isClosed) acc.late += 1;
            if (item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 7 && !item.isClosed) acc.next7 += 1;
            if (item.isClosed) acc.done += 1;
            if (!safeText(item.linkedOrderId) && !item.isClosed) acc.unlinked += 1;
            return acc;
        }, { today: 0, late: 0, next7: 0, done: 0, unlinked: 0 });
    }, [campaignScopedSchedules]);

    const bulkCreatableSchedules = useMemo(() => {
        return filteredAdminSchedules.filter(item => !item.isClosed && !safeText(item.linkedOrderId));
    }, [filteredAdminSchedules]);

    const filteredScheduleIds = useMemo(() => {
        return filteredAdminSchedules.map(item => safeText(item.id)).filter(Boolean);
    }, [filteredAdminSchedules]);

    const selectedScheduleSet = useMemo(() => new Set(selectedScheduleIds), [selectedScheduleIds]);

    const selectedSchedules = useMemo(() => {
        return filteredAdminSchedules.filter(item => selectedScheduleSet.has(item.id));
    }, [filteredAdminSchedules, selectedScheduleSet]);

    const hasSelectedSchedules = selectedSchedules.length > 0;
    const bulkTargetSchedules = hasSelectedSchedules ? selectedSchedules : filteredAdminSchedules;
    const bulkTargetLabel = hasSelectedSchedules
        ? `${selectedSchedules.length} selecionado(s)`
        : `${filteredAdminSchedules.length} filtrado(s)`;

    const allVisibleSelected = filteredScheduleIds.length > 0
        && filteredScheduleIds.every(id => selectedScheduleSet.has(id));

    const bulkWhatsappReadyCount = useMemo(() => {
        return bulkTargetSchedules.filter(item => !!formatPhoneForWhatsApp(item.customerPhone)).length;
    }, [bulkTargetSchedules]);

    const bulkCreatableCount = useMemo(() => {
        return bulkTargetSchedules.filter(item => !item.isClosed && !safeText(item.linkedOrderId)).length;
    }, [bulkTargetSchedules]);

    useEffect(() => {
        const availableIds = new Set(normalizedAdminSchedules.map(item => safeText(item.id)).filter(Boolean));
        setSelectedScheduleIds(prev => prev.filter(id => availableIds.has(id)));
    }, [normalizedAdminSchedules]);

    const toggleScheduleSelection = useCallback((id) => {
        if (!id) return;
        setSelectedScheduleIds(prev => prev.includes(id)
            ? prev.filter(itemId => itemId !== id)
            : [...prev, id]);
    }, []);

    const toggleSelectAllVisibleSchedules = useCallback(() => {
        if (filteredScheduleIds.length === 0) return;
        setSelectedScheduleIds(prev => {
            const prevSet = new Set(prev);
            const everySelected = filteredScheduleIds.every(id => prevSet.has(id));
            if (everySelected) {
                return prev.filter(id => !filteredScheduleIds.includes(id));
            }
            filteredScheduleIds.forEach(id => prevSet.add(id));
            return Array.from(prevSet);
        });
    }, [filteredScheduleIds]);

    const clearSelectedSchedules = useCallback(() => {
        setSelectedScheduleIds([]);
    }, []);

    const resetScheduleForm = useCallback(() => {
        setScheduleForm(createAdminScheduleForm(activeCampaignId || CAMPAIGN_GENERAL_ID));
    }, [activeCampaignId]);

    const requestScheduleNotificationPermission = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            alert('Este navegador não suporta notificações do sistema.');
            return;
        }
        try {
            const permission = await window.Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                alert('Notificações ativadas com sucesso para os agendamentos.');
            } else {
                alert('Permissão não concedida. O painel continuará exibindo alertas locais quando estiver aberto.');
            }
        } catch (error) {
            console.error('Erro ao solicitar permissão de notificação:', error);
            alert('Não foi possível solicitar a permissão de notificação.');
        }
    }, []);

    const saveAdminSchedule = useCallback(async () => {
        const title = safeText(scheduleForm.title).trim();
        const customerName = safeText(scheduleForm.customerName).trim();
        const date = normalizeDateOnlyValue(scheduleForm.date, '');
        const time = normalizeTimeValue(scheduleForm.time);
        const details = safeText(scheduleForm.details).trim();

        if (!title) return alert('Informe o título do agendamento.');
        if (!date) return alert('Selecione uma data válida para o agendamento.');
        if (!time) return alert('Selecione um horário válido para o agendamento.');
        if (!customerName && !details) return alert('Preencha pelo menos o cliente ou os detalhes do pedido manual.');

        const payload = {
            title,
            customerName,
            customerPhone: safeText(scheduleForm.customerPhone).trim(),
            campaignId: normalizeCampaignId(scheduleForm.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
            category: safeText(scheduleForm.category, 'pedido_manual'),
            date,
            time,
            method: safeText(scheduleForm.method, 'retirada'),
            paymentMethod: safeText(scheduleForm.paymentMethod, 'A combinar'),
            address: safeText(scheduleForm.address).trim(),
            total: safeMoney(scheduleForm.total),
            details,
            status: safeText(scheduleForm.status, 'Agendado'),
            notificationEnabled: scheduleForm.notificationEnabled !== false,
            linkedOrderId: safeText(scheduleForm.linkedOrderId),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        setScheduleSaving(true);
        try {
            if (scheduleForm.id) {
                await getCol('agendamentos').doc(scheduleForm.id).update(payload);
                alert('Agendamento atualizado com sucesso!');
            } else {
                await getCol('agendamentos').add({
                    ...payload,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                alert('Agendamento criado com sucesso!');
            }
            resetScheduleForm();
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            alert('Não foi possível salvar o agendamento.');
        } finally {
            setScheduleSaving(false);
        }
    }, [scheduleForm, safeMoney, resetScheduleForm, activeCampaignId]);

    const editAdminSchedule = useCallback((item) => {
        setScheduleForm({
            id: item.id,
            campaignId: normalizeCampaignId(item.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
            title: safeText(item.title),
            customerName: safeText(item.customerName),
            customerPhone: safeText(item.customerPhone),
            category: safeText(item.category, 'pedido_manual'),
            date: normalizeDateOnlyValue(item.date, getTodayStr()),
            time: normalizeTimeValue(item.time),
            method: safeText(item.method, 'retirada'),
            paymentMethod: safeText(item.paymentMethod, 'A combinar'),
            address: safeText(item.address),
            total: safeText(item.total),
            details: safeText(item.details),
            status: safeText(item.status, 'Agendado'),
            notificationEnabled: item.notificationEnabled !== false,
            linkedOrderId: safeText(item.linkedOrderId),
        });
        setTab('agenda');
    }, [activeCampaignId]);

    const updateAdminScheduleStatus = useCallback(async (item, nextStatus) => {
        if (!item?.id) return;
        try {
            await getCol('agendamentos').doc(item.id).update({
                status: nextStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error('Erro ao atualizar status do agendamento:', error);
            alert('Não foi possível atualizar o status do agendamento.');
        }
    }, []);

    const deleteAdminSchedule = useCallback(async (id) => {
        if (!confirm('Deseja realmente apagar este agendamento?')) return;
        try {
            await getCol('agendamentos').doc(id).delete();
        } catch (error) {
            console.error('Erro ao apagar agendamento:', error);
            alert('Não foi possível apagar o agendamento.');
        }
    }, []);

    const dismissScheduleAlert = useCallback((id) => {
        setScheduleAlerts(prev => prev.filter(item => item.id !== id));
    }, []);

    const dismissOrderRealtimeToast = useCallback((id) => {
        const timerId = orderToastTimersRef.current.get(id);
        if (timerId) {
            window.clearTimeout(timerId);
            orderToastTimersRef.current.delete(id);
        }
        setOrderRealtimeToasts(prev => prev.filter(item => item.id !== id));
    }, []);

    /**
     * Remove um toast operacional de fluxo de pedido e limpa timer.
     * @param {string} id - Identificador único do toast.
     * @returns {void}
     */
    const dismissOrderFlowFeedbackToast = useCallback((id) => {
        const timerId = orderFlowToastTimersRef.current.get(id);
        if (timerId) {
            window.clearTimeout(timerId);
            orderFlowToastTimersRef.current.delete(id);
        }
        setOrderFlowFeedbackToasts(prev => prev.filter(item => item.id !== id));
    }, []);

    const dismissAllScheduleAlerts = useCallback(() => {
        setScheduleAlerts([]);
    }, []);

    const pushOrderRealtimeToast = useCallback((order) => {
        const toastId = `order-${safeText(order?.id)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const customerLabel = safeText(order?.customerName, 'Cliente').trim() || 'Cliente';
        const createdLabel = formatDate(order?.createdAt);

        setOrderRealtimeToasts(prev => [
            {
                id: toastId,
                title: 'Novo pedido recebido!',
                body: `${customerLabel} • ${createdLabel}`,
            },
            ...prev,
        ].slice(0, 4));

        const timerId = window.setTimeout(() => {
            setOrderRealtimeToasts(prev => prev.filter(item => item.id !== toastId));
            orderToastTimersRef.current.delete(toastId);
        }, 7000);

        orderToastTimersRef.current.set(toastId, timerId);
    }, []);

    /**
     * Exibe toast operacional sem bloquear o atendimento do operador.
     * @param {Object} payload - Dados visuais do toast.
     * @param {string} payload.title - Título principal do toast.
     * @param {string} payload.body - Texto complementar.
     * @param {string} [payload.tone='info'] - Tom visual: info/success/warning/error.
     * @param {number} [payload.durationMs=9000] - Tempo de exibição em ms.
     * @returns {void}
     */
    const pushOrderFlowFeedbackToast = useCallback(({
        title,
        body,
        tone = 'info',
        durationMs = 9000,
    }) => {
        const toastId = `order-flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setOrderFlowFeedbackToasts(prev => [
            {
                id: toastId,
                title: safeText(title, 'Atualização de pedido'),
                body: safeText(body),
                tone: ['success', 'warning', 'error'].includes(tone) ? tone : 'info',
            },
            ...prev,
        ].slice(0, 5));

        const timerId = window.setTimeout(() => {
            setOrderFlowFeedbackToasts(prev => prev.filter(item => item.id !== toastId));
            orderFlowToastTimersRef.current.delete(toastId);
        }, Math.max(3000, Number(durationMs) || 9000));

        orderFlowToastTimersRef.current.set(toastId, timerId);
    }, []);

    const playNewOrderNotificationSound = useCallback(() => {
        if (typeof window === 'undefined') return;
        if (!orderNotificationInteractionUnlockedRef.current) return;

        const now = Date.now();
        if (now < orderNotificationSoundCooldownRef.current) return;
        orderNotificationSoundCooldownRef.current = now + 1200;

        const audio = ensureOrderNotificationAudioElement();
        if (!audio) return;

        try {
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((error) => {
                    console.warn('Som de novo pedido bloqueado pelo navegador:', error);
                });
            }
        } catch (error) {
            console.warn('Falha ao reproduzir som de novo pedido:', error);
        }
    }, [ensureOrderNotificationAudioElement]);

    const notifyDesktopNewOrder = useCallback(async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        let permission = window.Notification.permission;
        if (permission === 'default') {
            try {
                permission = await window.Notification.requestPermission();
                setNotificationPermission(permission);
            } catch (error) {
                console.warn('Não foi possível solicitar permissão de notificação para pedidos:', error);
                return;
            }
        }

        if (permission !== 'granted') return;

        try {
            new window.Notification('Novo Pedido', {
                body: 'Um novo pedido acabou de chegar!',
                tag: `helo-order-${Date.now()}`,
            });
        } catch (error) {
            console.warn('Falha ao enviar notificação desktop de novo pedido:', error);
        }
    }, []);

    const triggerRealtimeOrderAlerts = useCallback((order) => {
        const notificationKey = buildOrderNotificationKey(order);
        if (notificationKey && orderNotificationSeenKeysRef.current.has(notificationKey)) return;
        if (notificationKey) orderNotificationSeenKeysRef.current.add(notificationKey);
        if (orderNotificationSeenKeysRef.current.size > 1500) {
            /* Evita crescimento ilimitado em sessões longas no painel. */
            orderNotificationSeenKeysRef.current = new Set(Array.from(orderNotificationSeenKeysRef.current).slice(-1000));
        }
        pushOrderRealtimeToast(order);
        playNewOrderNotificationSound();
        notifyDesktopNewOrder();
    }, [buildOrderNotificationKey, notifyDesktopNewOrder, playNewOrderNotificationSound, pushOrderRealtimeToast]);

    useEffect(() => {
        triggerRealtimeOrderAlertsRef.current = triggerRealtimeOrderAlerts;
    }, [triggerRealtimeOrderAlerts]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const handleOrderCreatedEvent = (event) => {
            const order = event?.detail?.order;
            if (!order?.id) return;
            triggerRealtimeOrderAlerts(order);
        };
        window.addEventListener('helo:order-created', handleOrderCreatedEvent);
        return () => window.removeEventListener('helo:order-created', handleOrderCreatedEvent);
    }, [triggerRealtimeOrderAlerts]);

    const playScheduleAlertSound = useCallback((level = 1) => {
        if (scheduleAlertSettings.soundEnabled === false) return;
        if (typeof window === 'undefined') return;

        const now = Date.now();
        if (now < scheduleAlertSoundCooldownRef.current) return;
        scheduleAlertSoundCooldownRef.current = now + 3500;

        const audioApi = window.AudioContext || window.webkitAudioContext;
        if (!audioApi) return;

        try {
            const ctx = scheduleAlertAudioCtxRef.current || new audioApi();
            scheduleAlertAudioCtxRef.current = ctx;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => null);
            }

            const baseTime = ctx.currentTime + 0.03;
            const pulseCount = Math.max(1, Math.min(3, Number(level) || 1));
            const baseGain = Math.min(1, Math.max(0.08, Number(scheduleAlertSettings.volume) || DEFAULT_ADMIN_SCHEDULE_ALERT_SETTINGS.volume));

            for (let i = 0; i < pulseCount; i += 1) {
                const startAt = baseTime + (i * 0.36);
                const envelope = ctx.createGain();
                envelope.gain.setValueAtTime(0.0001, startAt);
                envelope.gain.exponentialRampToValueAtTime(baseGain, startAt + 0.02);
                envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);
                envelope.connect(ctx.destination);

                const oscA = ctx.createOscillator();
                oscA.type = 'sine';
                oscA.frequency.setValueAtTime(880, startAt);
                oscA.frequency.exponentialRampToValueAtTime(1174.66, startAt + 0.14);
                oscA.connect(envelope);
                oscA.start(startAt);
                oscA.stop(startAt + 0.24);

                const oscB = ctx.createOscillator();
                oscB.type = 'triangle';
                oscB.frequency.setValueAtTime(659.25, startAt);
                oscB.frequency.exponentialRampToValueAtTime(783.99, startAt + 0.14);
                oscB.connect(envelope);
                oscB.start(startAt);
                oscB.stop(startAt + 0.18);
            }
        } catch (error) {
            console.error('Erro ao tocar alerta sonoro de agendamento:', error);
        }
    }, [scheduleAlertSettings.soundEnabled, scheduleAlertSettings.volume]);

    const testScheduleAlertSound = useCallback(() => {
        playScheduleAlertSound(2);
    }, [playScheduleAlertSound]);

    useEffect(() => {
        writeAdminScheduleAlertSettings(scheduleAlertSettings);
    }, [scheduleAlertSettings]);

    const createManualOrderFromSchedule = useCallback(async (item, options = {}) => {
        if (!item?.id) return;
        const { silent = false } = options;

        const linkedOrder = item.linkedOrderId
            ? allOrders.find(order => order.id === item.linkedOrderId)
            : null;

        if (linkedOrder) {
            if (silent) return { type: 'existing', orderId: linkedOrder.id };
            setTab('orders');
            setEditOrder({ ...linkedOrder, _returnTab: 'agenda' });
            return { type: 'opened', orderId: linkedOrder.id };
        }

        if (item.linkedOrderId && !linkedOrder) {
            try {
                await getCol('agendamentos').doc(item.id).update({ linkedOrderId: '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            } catch (error) {
                console.error('Erro ao limpar vínculo órfão do agendamento:', error);
            }
        }

        const total = Number(item.total || 0);
        const title = safeText(item.title, 'Pedido Manual');
        const details = safeText(item.details).trim();
        const method = safeText(item.method, 'retirada');
        const address = safeText(item.address).trim() || (method === 'entrega' ? 'Endereço a combinar' : 'Retirada no local');
        const paymentMethod = normalizeSchedulePaymentToOrder(item.paymentMethod);
        const orderStatus = normalizeScheduleStatusToOrder(item.status);
        const paidAmount = ['Pago', 'Pronto', 'Concluído'].includes(orderStatus) ? total : 0;
        const isConcludedOrder = orderStatus === 'Concluído';
        const isPaidOrder = ['Pago', 'Pronto', 'Concluído'].includes(orderStatus);
        const requesterUid = safeText(auth.currentUser?.uid).trim();
        if (!requesterUid) {
            if (!silent) alert('Sessão sem autenticação ativa. Aguarde e tente novamente.');
            return { type: 'error' };
        }

        const payload = {
            customerName: safeText(item.customerName, 'Cliente Manual'),
            customerPhone: safeText(item.customerPhone),
            campaignId: normalizeCampaignId(item.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
            date: normalizeDateOnlyValue(item.date, getTodayStr()),
            time: normalizeTimeValue(item.time),
            method,
            address,
            paymentMethod,
            cardInstallments: '1',
            items: [{ name: title, qty: 1, price: total }],
            subtotal: total,
            discount: 0,
            couponCode: null,
            deliveryFee: 0,
            baseTotal: total,
            cardFeeRate: 0,
            cardFeeValue: 0,
            total,
            observations: details,
            createdByUid: requesterUid,
            status: orderStatus,
            paidAmount,
            ...(isPaidOrder ? { paidAt: firebase.firestore.FieldValue.serverTimestamp() } : {}),
            ...(isConcludedOrder ? {
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                concluidoEm: firebase.firestore.FieldValue.serverTimestamp(),
            } : {}),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdFromSchedule: true,
            scheduleId: item.id,
        };

        try {
            const docRef = await getCol('orders').add(payload);
            await getCol('agendamentos').doc(item.id).update({
                linkedOrderId: docRef.id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            if (!silent) alert('Pedido manual enviado para o fluxo de pedidos!');
            return { type: 'created', orderId: docRef.id };
        } catch (error) {
            console.error('Erro ao criar pedido manual a partir do agendamento:', error);
            if (!silent) alert('Não foi possível gerar o pedido manual.');
            return { type: 'error' };
        }
    }, [allOrders]);

    const createManualOrdersInBulk = useCallback(async () => {
        const targetSchedules = bulkTargetSchedules.filter(item => !item.isClosed && !safeText(item.linkedOrderId));
        if (targetSchedules.length === 0) {
            alert('Não há agendamentos em aberto sem pedido para gerar no alvo atual.');
            return;
        }

        if (!confirm(`Gerar pedidos para ${targetSchedules.length} agendamento(s) de ${bulkTargetLabel}?`)) return;

        setScheduleBulkLoading(true);
        let created = 0;
        let existing = 0;
        let failed = 0;

        const results = await runAsyncInBatches(targetSchedules, 8, async (item) => {
            return createManualOrderFromSchedule(item, { silent: true });
        });

        results.forEach((entry) => {
            if (entry.status !== 'fulfilled') {
                failed += 1;
                return;
            }
            const result = entry.value;
            if (result?.type === 'created') created += 1;
            else if (result?.type === 'existing' || result?.type === 'opened') existing += 1;
            else failed += 1;
        });

        setScheduleBulkLoading(false);
        alert(`Processo concluído.\nCriados: ${created}\nJá existentes: ${existing}\nFalhas: ${failed}`);
    }, [bulkTargetSchedules, bulkTargetLabel, createManualOrderFromSchedule]);

    const updateSchedulesStatusInBulk = useCallback(async () => {
        const targetSchedules = bulkTargetSchedules.filter(item => safeText(item.id));
        if (targetSchedules.length === 0) {
            alert('Não há agendamentos no alvo atual para atualizar.');
            return;
        }

        if (!confirm(`Atualizar status para "${scheduleBulkStatus}" em ${targetSchedules.length} agendamento(s) de ${bulkTargetLabel}?`)) return;

        setScheduleBulkLoading(true);
        let success = 0;
        let failed = 0;

        const results = await runAsyncInBatches(targetSchedules, 16, async (item) => {
            await getCol('agendamentos').doc(item.id).update({
                status: scheduleBulkStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            return true;
        });

        results.forEach((entry) => {
            if (entry.status === 'fulfilled') success += 1;
            else {
                failed += 1;
                console.error('Erro ao atualizar status em lote:', entry.reason);
            }
        });

        setScheduleBulkLoading(false);
        alert(`Atualização em lote concluída.\nSucesso: ${success}\nFalhas: ${failed}`);
    }, [bulkTargetSchedules, scheduleBulkStatus, bulkTargetLabel]);

    const exportFilteredSchedulesCsv = useCallback(() => {
        if (bulkTargetSchedules.length === 0) {
            alert('Não há agendamentos no alvo atual para exportar.');
            return;
        }

        const headers = ['Titulo', 'Cliente', 'WhatsApp', 'Categoria', 'Data', 'Hora', 'Metodo', 'Pagamento', 'Valor', 'Status', 'TemPedido', 'Endereco', 'Detalhes'];
        const lines = bulkTargetSchedules.map(item => {
            const cols = [
                safeText(item.title).replaceAll('"', '""'),
                safeText(item.customerName).replaceAll('"', '""'),
                safeText(item.customerPhone),
                adminScheduleCategoryLabel(item.category),
                formatDateOnlyForDisplay(item.date),
                safeText(item.time),
                item.method === 'entrega' ? 'Entrega' : 'Retirada',
                safeText(item.paymentMethod),
                Number(item.total || 0).toFixed(2),
                safeText(item.status),
                safeText(item.linkedOrderId) ? 'Sim' : 'Nao',
                safeText(item.address).replaceAll('"', '""'),
                safeText(item.details).replaceAll('"', '""'),
            ];
            return cols.map(col => `"${String(col)}"`).join(';');
        });

        const csv = [headers.join(';'), ...lines].join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agendamentos_filtrados_${getTodayStr()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [bulkTargetSchedules]);

    const copyBulkScheduleWhatsappMessages = useCallback(async () => {
        const readyList = bulkTargetSchedules
            .map(item => ({ item, phone: formatPhoneForWhatsApp(item.customerPhone) }))
            .filter(entry => entry.phone);

        if (readyList.length === 0) {
            alert('Nenhum agendamento com WhatsApp válido no alvo atual.');
            return;
        }

        const payload = readyList.map(({ item, phone }) => {
            const msg = [
                `Oi, ${safeText(item.customerName, 'tudo bem?')}!`,
                `Lembrete do agendamento: ${safeText(item.title, 'Pedido')}.`,
                `Data: ${formatDateOnlyForDisplay(item.date)} às ${safeText(item.time, '09:00')}.`,
                safeText(item.details) ? `Detalhes: ${safeText(item.details)}` : '',
            ].filter(Boolean).join('\n');
            return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
        }).join('\n\n');

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(payload);
            } else {
                const temp = document.createElement('textarea');
                temp.value = payload;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            alert(`Links de WhatsApp copiados: ${readyList.length}.`);
        } catch (error) {
            console.error('Erro ao copiar links de WhatsApp em lote:', error);
            alert('Não foi possível copiar os links de WhatsApp.');
        }
    }, [bulkTargetSchedules]);

    useEffect(() => {
        const updates = normalizedAdminSchedules
            .filter(item => safeText(item.linkedOrderId))
            .map(item => {
                if (safeText(item.status) === 'Cancelado') return null;
                const linkedOrder = allOrders.find(order => order.id === item.linkedOrderId);
                if (!linkedOrder) return null;
                const nextScheduleStatus = normalizeOrderStatusToSchedule(linkedOrder.status);
                if (safeText(item.status) === nextScheduleStatus) return null;
                return getCol('agendamentos').doc(item.id).update({
                    status: nextScheduleStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }).catch(error => {
                    console.error('Erro ao sincronizar status do agendamento com pedido:', error);
                });
            })
            .filter(Boolean);

        if (updates.length > 0) {
            Promise.all(updates).catch(() => null);
        }
    }, [normalizedAdminSchedules, allOrders]);

    useEffect(() => {
        const triggerScheduleNotifications = () => {
            const now = Date.now();
            const storedNotifications = readAdminScheduleNotifications();
            let changed = false;
            let triggeredCount = 0;

            normalizedAdminSchedules.forEach(item => {
                if (!item.id || item.isClosed || item.notificationEnabled === false || !item.scheduledAt) return;

                const scheduleKey = `${item.date}T${item.time}`;
                const alreadyNotified = storedNotifications[item.id] === scheduleKey;
                const start = item.scheduledAt.getTime();
                const end = start + (12 * 60 * 60 * 1000);
                if (alreadyNotified || now < start || now > end) return;

                const alertItem = {
                    id: item.id,
                    title: item.title || 'Agendamento',
                    body: `${formatDateOnlyForDisplay(item.date)} às ${item.time} • ${item.customerName || item.details || 'Sem detalhes adicionais'}`,
                };

                setScheduleAlerts(prev => prev.some(existing => existing.id === item.id)
                    ? prev
                    : [alertItem, ...prev].slice(0, 5));
                triggeredCount += 1;

                if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
                    try {
                        new window.Notification(`Agendamento: ${alertItem.title}`, {
                            body: alertItem.body,
                            tag: `helo-agendamento-${item.id}`,
                        });
                    } catch (error) {
                        console.error('Erro ao disparar notificação local:', error);
                    }
                }

                storedNotifications[item.id] = scheduleKey;
                changed = true;
            });

            if (changed) writeAdminScheduleNotifications(storedNotifications);
            if (triggeredCount > 0) playScheduleAlertSound(triggeredCount);
        };

        triggerScheduleNotifications();
        const intervalId = window.setInterval(triggerScheduleNotifications, 60000);
        return () => window.clearInterval(intervalId);
    }, [normalizedAdminSchedules, playScheduleAlertSound]);

    /* ── handleSaveSettings: Salva configurações gerais do site ──────
       Salva localSettings no Firebase via onSaveSettings callback.
       Inclui menuTabs, configurações térmicas, modo de operação, etc.
       Marca settingsSaving durante a operação. */
    const handleSaveSettings = useCallback(async () => {
        setSettingsSaving(true);
        try {
            if (typeof onSaveSettings === 'function') {
                const menuTabsToPersist = buildMenuTabOptions({ siteSettings: localSettings }).map(({ key, label, legacyLabels = [] }) => ({ key, label, legacyLabels }));
                await onSaveSettings({
                    maxUnits: Number(localSettings.maxUnits) || 70,
                    orderDeadline: localSettings.orderDeadline,
                    siteMode: localSettings.siteMode || 'livre',
                    enableAnnouncement: Boolean(localSettings.enableAnnouncement),
                    announcementText: String(localSettings.announcementText || ''),
                    announcementStyle: localSettings.announcementStyle || 'info',
                    enableScarcityBanner: Boolean(localSettings.enableScarcityBanner),
                    campaignMode: normalizeCampaignMode(localSettings.campaignMode),
                    activeCampaignOverrideId: safeText(localSettings.activeCampaignOverrideId),
                    isDeliveryAvailable: Boolean(localSettings.isDeliveryAvailable),
                    chavePix: safeText(localSettings.chavePix).trim(),
                    nomeTitularPix: safeText(localSettings.nomeTitularPix).trim(),
                    menuTabs: menuTabsToPersist,
                    thermalPrintEnabled: Boolean(localSettings.thermalPrintEnabled),
                    thermalPrintAutoOnOrder: Boolean(localSettings.thermalPrintAutoOnOrder),
                    thermalPrinterName: safeText(localSettings.thermalPrinterName).trim(),
                    thermalPrintCopies: Math.max(1, Math.min(5, Number(localSettings.thermalPrintCopies) || 1)),
                    thermalPrintMode: normalizeThermalPrintMode(localSettings.thermalPrintMode),
                    thermalPrintTicketMode: normalizeThermalPrintTicketMode(localSettings.thermalPrintTicketMode),
                    thermalPrintBrowserFallback: Boolean(localSettings.thermalPrintBrowserFallback),
                });
            }
            alert('Configurações salvas com sucesso!');
        } catch (err) {
            alert('Erro ao salvar configurações.');
        } finally {
            setSettingsSaving(false);
        }
    }, [localSettings, onSaveSettings]);

    const handleAddMenuTab = useCallback(() => {
        const label = safeText(newMenuTabLabel).trim();
        if (!label) {
            alert('Digite o nome da nova aba.');
            return;
        }
        const key = normalizeMenuTabKey(label, menuTabOptions);
        if (!key) {
            alert('Não foi possível criar uma chave válida para essa aba.');
            return;
        }
        if (menuTabOptions.some(option => option.key === key)) {
            alert('Essa aba já existe no catálogo.');
            return;
        }
        setLocalSettings(prev => ({
            ...prev,
            menuTabs: [...buildMenuTabOptions({ siteSettings: prev }), { key, label, legacyLabels: [] }],
        }));
        setNewMenuTabLabel('');
        setNewProd(prev => ({ ...prev, menuTab: key, menuCategory: key, category: key }));
    }, [newMenuTabLabel, menuTabOptions]);

    const handleRemoveMenuTab = useCallback((tabKey) => {
        if (menuTabOptions.length <= 1) {
            alert('O catálogo precisa ter pelo menos uma aba.');
            return;
        }
        const option = menuTabOptions.find(item => item.key === tabKey);
        const inUseCount = (Array.isArray(products) ? products : []).filter((product) => resolveProductMenuTab(product, menuTabOptions) === tabKey).length;
        if (inUseCount > 0) {
            const confirmed = window.confirm(`A aba "${option?.label || tabKey}" está em ${inUseCount} produto(s). Remover agora apenas tira a aba da lista, sem alterar os produtos. Deseja continuar?`);
            if (!confirmed) return;
        }
        const nextOptions = menuTabOptions.filter(item => item.key !== tabKey);
        const fallbackKey = nextOptions[0]?.key || DEFAULT_MENU_TAB_OPTIONS[0].key;
        setLocalSettings(prev => ({
            ...prev,
            menuTabs: nextOptions,
        }));
        setNewProd(prev => {
            if (resolveProductMenuTab(prev, menuTabOptions) !== tabKey) return prev;
            return { ...prev, menuTab: fallbackKey, menuCategory: fallbackKey, category: fallbackKey };
        });
        setEditProd(prev => {
            if (!prev || resolveProductMenuTab(prev, menuTabOptions) !== tabKey) return prev;
            return { ...prev, menuTab: fallbackKey, menuCategory: fallbackKey, category: fallbackKey };
        });
    }, [menuTabOptions, products]);

    const handleMoveMenuTab = useCallback((tabKey, direction) => {
        const currentIndex = menuTabOptions.findIndex(item => item.key === tabKey);
        if (currentIndex < 0) return;
        const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= menuTabOptions.length) return;

        const nextOptions = [...menuTabOptions];
        const [moved] = nextOptions.splice(currentIndex, 1);
        nextOptions.splice(targetIndex, 0, moved);

        setLocalSettings(prev => ({
            ...prev,
            menuTabs: nextOptions.map(({ key, label, legacyLabels = [] }) => ({ key, label, legacyLabels })),
        }));
    }, [menuTabOptions]);

    const handleSaveMenuTabs = useCallback(async () => {
        if (typeof onSaveSettings !== 'function') return;
        setMenuTabsSaving(true);
        try {
            await onSaveSettings({
                menuTabs: menuTabOptions.map(({ key, label, legacyLabels = [] }) => ({ key, label, legacyLabels })),
            });
            alert('Abas do catálogo salvas com sucesso!');
        } catch (error) {
            alert('Erro ao salvar abas do catálogo.');
        } finally {
            setMenuTabsSaving(false);
        }
    }, [menuTabOptions, onSaveSettings]);

    const handleThermalPrintTest = useCallback(async (forcedTicketMode = '') => {
        const baseSettings = normalizeThermalPrintSettings(localSettings);
        const settings = {
            ...baseSettings,
            thermalPrintTicketMode: forcedTicketMode
                ? normalizeThermalPrintTicketMode(forcedTicketMode)
                : baseSettings.thermalPrintTicketMode,
        };
        const modeLabel = settings.thermalPrintTicketMode === 'kitchen'
            ? 'cozinha'
            : settings.thermalPrintTicketMode === 'cashier'
                ? 'caixa'
                : 'cozinha + caixa';
        if (!settings.thermalPrintEnabled) {
            alert('Ative a impressão térmica antes de testar.');
            return;
        }
        if (settings.thermalPrintMode !== 'browser' && (typeof window === 'undefined' || !window.qz)) {
            alert('QZ Tray não detectado no navegador. Instale/inicie o QZ Tray ou troque o modo para Navegador.');
            return;
        }
        setThermalPrintTesting(true);
        const sampleOrder = {
            orderId: 'TESTE-LOCAL',
            createdAt: new Date(),
            customerName: 'Cliente Teste',
            customerPhone: '88999999999',
            methodLabel: 'Retirada no local',
            paymentLabel: 'PIX',
            orderDate: getTodayStr(),
            orderTime: new Date().toTimeString().slice(0, 5),
            address: 'Helô Confeitaria',
            observations: 'Cupom de teste gerado no painel.',
            items: [
                { name: 'Produto de Teste A', qty: 1, price: 10.0 },
                { name: 'Produto de Teste B', qty: 2, price: 7.5 },
            ],
            subtotal: 25,
            discountValue: 0,
            deliveryFee: 0,
            cardFeeValue: 0,
            payableTotal: 25,
        };
        try {
            if (settings.thermalPrintMode === 'browser') {
                printOrderViaBrowser(sampleOrder, null, settings);
            } else {
                await printOrderViaQz(sampleOrder, settings);
            }
            alert(`Teste de impressão (${modeLabel}) enviado com sucesso.`);
        } catch (error) {
            const friendlyError = describeThermalPrintError(error);
            console.warn('Falha no teste de impressão térmica:', friendlyError);
            if (settings.thermalPrintBrowserFallback) {
                try {
                    printOrderViaBrowser(sampleOrder, null, settings);
                    alert(`QZ falhou, mas o fallback do navegador foi aberto para teste (${modeLabel}).`);
                    return;
                } catch (fallbackError) {
                    console.warn('Falha no fallback do teste de impressão:', safeText(fallbackError?.message || fallbackError));
                }
            }
            alert(friendlyError);
        } finally {
            setThermalPrintTesting(false);
        }
    }, [localSettings]);

    const updateCampaignDraft = useCallback((campaignId, patch) => {
        setCampaignDrafts(prev => ({
            ...prev,
            [campaignId]: {
                ...(prev[campaignId] || {}),
                ...patch,
            },
        }));
    }, []);

    /* ── saveCampaignDraft: Salva rascunho de campanha no Firebase ──
       Recebe: campaignId (string)
       Valida nome obrigatório. Salva rascunho (campaignDrafts[id])
       na collection 'campanhas' com merge. Remove o rascunho local
       após salvar com sucesso. */
    const saveCampaignDraft = useCallback(async (campaignId) => {
        const current = campaignDrafts[campaignId];
        if (!current) return;
        if (!safeText(current.nome).trim()) return alert('Informe o nome da campanha.');
        const startDate = normalizeDateOnlyOrEmpty(current.startDate);
        const endDate = normalizeDateOnlyOrEmpty(current.endDate);
        if (startDate && endDate && startDate > endDate) return alert('A data inicial não pode ser maior que a data final.');
        const nextList = campaignOptions.map((item) => normalizeCampaignDoc({
            ...item,
            ...(campaignDrafts[item.id] || {}),
            ...(item.id === campaignId ? current : {}),
        }));
        const conflicts = buildCampaignScheduleConflicts(nextList).filter((item) => item.ids.includes(campaignId));
        if (conflicts.length > 0) {
            return alert('Conflito detectado: existe outra campanha com a mesma prioridade e janela sobreposta. Ajuste prioridade ou datas antes de salvar.');
        }
        try {
            await getCol('campanhas').doc(campaignId).set({
                nome: safeText(current.nome).trim(),
                autoEnabled: current.autoEnabled === true,
                startDate,
                endDate,
                priority: normalizeCampaignPriority(current.priority),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            alert('Campanha atualizada com sucesso.');
        } catch (error) {
            console.error('Erro ao salvar campanha:', error);
            alert('Não foi possível salvar a campanha.');
        }
    }, [campaignDrafts, campaignOptions]);

    const activateCampaignManually = useCallback(async (campaignId) => {
        if (!campaignId) return;
        try {
            const batch = db.batch();
            campaignOptions.forEach(item => {
                batch.set(getCol('campanhas').doc(item.id), {
                    status: item.id === campaignId ? 'ativo' : 'inativo',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
            await batch.commit();
            setLocalSettings(prev => ({ ...prev, activeCampaignOverrideId: '' }));
            alert('Campanha manual ativada com sucesso.');
        } catch (error) {
            console.error('Erro ao ativar campanha manual:', error);
            alert('Não foi possível ativar a campanha manualmente.');
        }
    }, [campaignOptions]);

    const clearManualCampaigns = useCallback(async () => {
        try {
            const batch = db.batch();
            campaignOptions.forEach(item => {
                batch.set(getCol('campanhas').doc(item.id), {
                    status: 'inativo',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
            await batch.commit();
            alert('Campanhas manuais desativadas. O modo automático/híbrido poderá assumir.');
        } catch (error) {
            console.error('Erro ao limpar campanhas manuais:', error);
            alert('Não foi possível desativar campanhas manuais.');
        }
    }, [campaignOptions]);

    const createCampaign = useCallback(async () => {
        const id = slugifyCampaignId(campaignForm.id || campaignForm.nome);
        const nome = safeText(campaignForm.nome).trim();
        if (!id) return alert('Informe um identificador válido para a campanha.');
        if (!nome) return alert('Informe o nome da campanha.');
        if ([CAMPAIGN_GENERAL_ID, CAMPAIGN_LEGACY_ID].includes(id)) {
            return alert('Este identificador é reservado pelo sistema.');
        }
        const startDate = normalizeDateOnlyOrEmpty(campaignForm.startDate);
        const endDate = normalizeDateOnlyOrEmpty(campaignForm.endDate);
        if (startDate && endDate && startDate > endDate) return alert('A data inicial não pode ser maior que a data final.');
        const candidate = normalizeCampaignDoc({
            id,
            nome,
            autoEnabled: campaignForm.autoEnabled === true,
            startDate,
            endDate,
            priority: campaignForm.priority,
        });
        const conflicts = buildCampaignScheduleConflicts(
            mergedCampaignSchedules.filter((item) => item.id !== id).concat(candidate)
        ).filter((item) => item.ids.includes(id));
        if (conflicts.length > 0) {
            return alert('Conflito detectado: existe outra campanha com a mesma prioridade e janela sobreposta. Ajuste prioridade ou datas antes de criar.');
        }
        try {
            const existing = await getCol('campanhas').doc(id).get();
            if (existing.exists) return alert('Já existe uma campanha com este identificador.');

            await getCol('campanhas').doc(id).set({
                nome,
                status: 'inativo',
                autoEnabled: campaignForm.autoEnabled === true,
                startDate,
                endDate,
                priority: normalizeCampaignPriority(campaignForm.priority),
                data_criacao: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            setCampaignForm({ id: '', nome: '', autoEnabled: false, startDate: '', endDate: '', priority: 0 });
            alert('Campanha criada com sucesso.');
        } catch (error) {
            console.error('Erro ao criar campanha:', error);
            if (isFirestorePermissionDenied(error)) {
                alert('Sem permissão para criar campanha. Faça login com um e-mail admin autorizado e confirme que as regras do Firestore foram publicadas.');
            } else {
                alert('Não foi possível criar a campanha.');
            }
        }
    }, [campaignForm, mergedCampaignSchedules]);

    /* ════════════════════════════════════════════════════════════════
       FUNÇÕES DE CRUD (Create, Read, Update, Delete)
       ════════════════════════════════════════════════════════════════
       Operações diretas no Firebase Firestore para:
       - deleteOrder: exclui pedido e restaura estoque dos produtos
       - addProduct: cria novo produto com detecção de duplicata
       - addCoupon: cria novo cupom de desconto
       - toggleCoupon: ativa/desativa cupom existente
       - updateOrder: atualiza pedido editado (status, pagamento, etc.) */
    const deleteOrder = useCallback(async id => {
        if (!id) return alert('ID do pedido inválido.');
        if (!confirm('Apagar este pedido? O estoque dos produtos será restaurado automaticamente (se ainda não foi).')) return;
        try {
            const orderSnap = await getCol('orders').doc(id).get();
            if (!orderSnap.exists) {
                await getCol('orders').doc(id).delete();
                alert('Pedido apagado (não encontrado no banco).');
                return;
            }
            const orderData = orderSnap.data() || {};
            const reservation = orderData.stockReservation || {};
            const decremented = Array.isArray(reservation.decremented) ? reservation.decremented : [];

            /* ── Verifica se o estoque já foi restaurado pelo cancelamento ──
               Se a Cloud Function restoreStockOnCancel já restaurou o estoque
               (stockRestoredAt existe), não restauramos de novo — evita
               duplicação de unidades no estoque. */
            const alreadyRestored = Boolean(reservation.stockRestoredAt);

            if (!alreadyRestored && decremented.length > 0) {
                const batch = db.batch();
                for (const entry of decremented) {
                    const productId = String(entry.productId || '').trim();
                    const qty = Number(entry.qty);
                    if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
                    const productRef = getCol('products').doc(productId);
                    batch.update(productRef, {
                        stockLimit: firebase.firestore.FieldValue.increment(qty),
                    });
                }
                await batch.commit();
            } else if (!alreadyRestored) {
                const items = Array.isArray(orderData.items) ? orderData.items : [];
                const qtyMap = new Map();
                items.forEach(item => {
                    const pid = String(item.productId || item.id || '').trim();
                    const q = Math.max(0, Math.trunc(Number(item.qty) || 0));
                    if (pid && q > 0) qtyMap.set(pid, (qtyMap.get(pid) || 0) + q);
                });
                if (qtyMap.size > 0) {
                    const batch = db.batch();
                    for (const [pid, qty] of qtyMap.entries()) {
                        const prod = products.find(p => p.id === pid);
                        if (prod && Number.isFinite(Number(prod.stockLimit))) {
                            const productRef = getCol('products').doc(pid);
                            batch.update(productRef, {
                                stockLimit: firebase.firestore.FieldValue.increment(qty),
                            });
                        }
                    }
                    await batch.commit();
                }
            }

            await getCol('orders').doc(id).delete();
            alert('Pedido apagado e estoque restaurado com sucesso!');
        } catch (e) {
            console.error('Erro ao apagar pedido:', e);
            alert('Erro ao apagar pedido. Verifique sua conexão ou permissões.');
        }
    }, [products]);

    const handleManualReprint = useCallback(async (order) => {
        if (!order?.id) return;
        const settings = normalizeThermalPrintSettings(localSettings);
        if (!settings.thermalPrintEnabled) {
            alert('Ative a impressão térmica nas configurações para reimprimir cupons.');
            setTab('settings');
            return;
        }

        const orderForPrint = {
            orderId: safeText(order.id, 'SEMID'),
            createdAt: typeof order.createdAt?.toDate === 'function' ? order.createdAt.toDate() : new Date(),
            customerName: safeText(order.customerName),
            customerPhone: safeText(order.customerPhone),
            methodLabel: safeText(order.method).toLowerCase() === 'entrega' ? 'Entrega em domicílio' : 'Retirada no local',
            paymentLabel: safeText(order.paymentMethod, 'N/A'),
            orderDate: safeText(order.date),
            orderTime: safeText(order.time),
            address: safeText(order.address),
            observations: safeText(order.observations),
            items: Array.isArray(order.items) ? order.items : [],
            subtotal: Number(order.subtotal || 0),
            discountValue: Number(order.discount || 0),
            deliveryFee: Number(order.deliveryFee || 0),
            cardFeeValue: Number(order.cardFeeValue || 0),
            payableTotal: Number(order.total || 0),
        };

        setReprintBusyId(order.id);
        try {
            if (settings.thermalPrintMode === 'browser') {
                printOrderViaBrowser(orderForPrint, null, settings);
            } else {
                await printOrderViaQz(orderForPrint, settings);
            }
            alert(`Cupom do pedido ${orderForPrint.orderId} enviado para impressão.`);
        } catch (error) {
            const friendlyError = describeThermalPrintError(error);
            if (settings.thermalPrintBrowserFallback) {
                try {
                    printOrderViaBrowser(orderForPrint, null, settings);
                    alert(`QZ falhou (${friendlyError}), mas o fallback no navegador foi aberto.`);
                    return;
                } catch (fallbackError) {
                    console.warn('Falha no fallback de reimpressão:', safeText(fallbackError?.message || fallbackError));
                }
            }
            alert(`Não foi possível reimprimir este pedido: ${friendlyError}`);
        } finally {
            setReprintBusyId('');
        }
    }, [localSettings]);

    const normalizeOrderStatusKey = useCallback((value) => safeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim(), []);

    const buildOrderPrintPayloadFromOrder = useCallback((order) => ({
        orderId: safeText(order?.id, 'SEMID'),
        createdAt: typeof order?.createdAt?.toDate === 'function' ? order.createdAt.toDate() : new Date(),
        customerName: safeText(order?.customerName),
        customerPhone: safeText(order?.customerPhone),
        methodLabel: safeText(order?.method).toLowerCase() === 'entrega' ? 'Entrega em domicílio' : 'Retirada no local',
        paymentLabel: safeText(order?.paymentMethod, 'N/A'),
        orderDate: safeText(order?.date),
        orderTime: safeText(order?.time),
        address: safeText(order?.address),
        observations: safeText(order?.observations),
        items: Array.isArray(order?.items) ? order.items : [],
        subtotal: Number(order?.subtotal || 0),
        discountValue: Number(order?.discount || 0),
        deliveryFee: Number(order?.deliveryFee || 0),
        cardFeeValue: Number(order?.cardFeeValue || 0),
        payableTotal: Number(order?.total || 0),
    }), []);

    const resolveCatalogItemName = useCallback((rawItem = {}) => {
        const rawName = safeText(rawItem?.name).trim();
        const normalizedName = normalizeText(rawName).toLowerCase();
        const rawCode = safeText(rawItem?.code || rawItem?.productCode || rawItem?.sku || rawItem?.productId).trim();
        const normalizedCode = normalizeText(rawCode).toLowerCase();

        const findByMatcher = (matcher) => (Array.isArray(products) ? products.find(matcher) : null);

        const byId = findByMatcher((product) => {
            const productId = safeText(product?.id).trim().toLowerCase();
            return (normalizedCode && productId === normalizedCode) || (normalizedName && productId === normalizedName);
        });
        if (byId?.name) return safeText(byId.name);

        const byCode = findByMatcher((product) => {
            const productCode = normalizeText(safeText(product?.code || product?.sku || product?.productCode)).toLowerCase();
            if (!productCode) return false;
            return (normalizedCode && productCode === normalizedCode) || (normalizedName && productCode === normalizedName);
        });
        if (byCode?.name) return safeText(byCode.name);

        const byName = findByMatcher((product) => normalizeText(safeText(product?.name)).toLowerCase() === normalizedName);
        if (byName?.name) return safeText(byName.name);

        return rawName || safeText(rawItem?.title, 'Item');
    }, [products]);

    const buildConfirmedOrderItemsText = useCallback((order) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        if (items.length === 0) return '';

        const lines = items.map((item) => {
            const qty = Math.max(1, Number(item?.qty || 1));
            const itemName = resolveCatalogItemName(item);
            return `- ${qty}x ${itemName}`;
        });
        return lines.join('\n');
    }, [resolveCatalogItemName]);

    /**
     * Monta e abre a mensagem de WhatsApp para confirmação de pedido.
     * @param {Object} order - Pedido confirmado.
     * @param {Window|null} popupRef - Janela já aberta pelo gesto do usuário.
     * @param {{silentUi?: boolean}} options - Controle para evitar alert bloqueante.
     * @returns {{ok: boolean, status: string, message: string}} Resultado da tentativa.
     */
    const openConfirmedOrderWhatsApp = useCallback((order, popupRef = null, options = {}) => {
        const silentUi = options?.silentUi === true;
        const waPhone = formatPhoneForWhatsApp(order?.customerPhone);
        if (!waPhone) {
            if (popupRef && !popupRef.closed) popupRef.close();
            if (!silentUi) {
                alert('Pedido confirmado, mas o cliente não possui WhatsApp válido para contato automático.');
            }
            return { ok: false, status: 'missing_phone', message: 'Cliente sem WhatsApp válido cadastrado.' };
        }

        const formatCurrency = (value) => Number(value || 0).toFixed(2).replace('.', ',');
        const itemsSummary = buildConfirmedOrderItemsText(order)
            .split('\n')
            .filter(Boolean)
            .map((line) => {
                const cleanLine = safeText(line).replace(/^-\s*/, '');
                return `*${cleanLine}*`;
            })
            .join('\n');
        const fullAddress = safeText(order?.address);
        const orderReference = safeText(order?.reference);
        const paymentLabel = safeText(order?.paymentMethod);
        const normalizedPayment = normalizeText(paymentLabel).toLowerCase();
        const isPixPayment = normalizedPayment.includes('pix');
        const isCashPayment = normalizedPayment.includes('dinheiro');
        const normalizedMethod = normalizeText(order?.method).toLowerCase();
        const isDelivery = normalizedMethod === 'entrega';
        // Chave PIX dinâmica: busca do siteSettings (Firebase), fallback para valor padrão
        const pixCnpj = siteSettings.chavePix || '88996549074';
        const normalizedCashChangeFor = safeText(order?.cashChangeFor).replace(',', '.').replace(/[^0-9.]/g, '');
        const cashChangeForValue = Number(normalizedCashChangeFor);
        const hasCashChangeFor = Number.isFinite(cashChangeForValue) && cashChangeForValue > 0;

        const msgParts = [
            `*CONFIRMA\u00C7\u00C3O DE PEDIDO - HEL\u00D4 CONFEITARIA*`,
            ``,
            `Ol\u00E1, *${safeText(order?.customerName, 'Cliente')}*! Seu pedido foi confirmado. Confira os detalhes abaixo:`,
            `WhatsApp: *${safeText(order?.customerPhone, 'Nao informado')}*`,
            ``,
            `*ITENS DO PEDIDO:*`,
            itemsSummary || `*Nenhum item informado*`,
        ];

        if (safeText(order?.date) || safeText(order?.time)) {
            const dateText = safeText(order?.date) ? formatDateOnlyForDisplay(order?.date) : '';
            const timeText = safeText(order?.time) ? `${safeText(order?.time)}h` : '';
            const whenText = [dateText, timeText].filter(Boolean).join(' as ');
            if (whenText) msgParts.push(``, `*DATA E HORARIO:* ${whenText}`);
        }

        msgParts.push(``);
        if (isDelivery) {
            msgParts.push(`*ENTREGA EM DOMICILIO:*`);
            if (fullAddress) msgParts.push(`Endereco: *${fullAddress}*`);
            if (orderReference) msgParts.push(`Referencia: *${orderReference}*`);
        } else {
            msgParts.push(`*RETIRADA NO LOCAL:* Helo Confeitaria (Rua Anastacio Paulo de Sousa, 63)`);
        }

        msgParts.push(``, `*RESUMO FINANCEIRO:*`);
        if (Number(order?.subtotal) > 0) msgParts.push(`Subtotal: *R$ ${formatCurrency(order?.subtotal)}*`);
        if (Number(order?.deliveryFee) > 0) msgParts.push(`Taxa de Entrega: *R$ ${formatCurrency(order?.deliveryFee)}*`);
        msgParts.push(`Total: *R$ ${formatCurrency(order?.total)}*`);

        msgParts.push(``);
        if (isPixPayment) {
            msgParts.push(`*PAGAMENTO VIA PIX*`);
            msgParts.push(`Chave PIX: *${pixCnpj}*`);
            /* Exibe Titular somente quando nomeTitularPix estiver preenchido (não nulo/vazio) */
            const titularPreenchido = safeText(siteSettings.nomeTitularPix).trim();
            if (titularPreenchido) msgParts.push(`Titular: *${titularPreenchido}*`);
            msgParts.push(`_Para agilizar, envie o comprovante respondendo a esta mensagem._`);
        } else if (isCashPayment) {
            msgParts.push(`*PAGAMENTO:* Dinheiro`);
            if (hasCashChangeFor) {
                msgParts.push(`Troco para: *R$ ${formatCurrency(cashChangeForValue)}*`);
            }
        } else if (paymentLabel) {
            msgParts.push(`*PAGAMENTO:* ${paymentLabel}`);
        }

        if (safeText(order?.observations).trim()) {
            msgParts.push(``, `*OBSERVACOES:*`, safeText(order?.observations).trim());
        }

        const message = msgParts.join('\n');

        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
        if (popupRef && !popupRef.closed) {
            try {
                popupRef.location.replace(waUrl);
                return { ok: true, status: 'sent', message: 'Mensagem de confirmação enviada no WhatsApp.' };
            } catch (error) {
                console.warn('Falha ao redirecionar popup do WhatsApp:', safeText(error?.message || error));
            }
        }
        const waTab = window.open(waUrl, '_blank');
        if (!waTab) {
            if (!silentUi) {
                alert('Pedido confirmado, mas o navegador bloqueou a abertura do WhatsApp. Permita pop-ups para este site.');
            }
            return { ok: false, status: 'blocked_popup', message: 'Navegador bloqueou o popup do WhatsApp.' };
        }
        return { ok: true, status: 'sent', message: 'Mensagem de confirmação enviada no WhatsApp.' };
    }, [buildConfirmedOrderItemsText]);

    /**
     * Executa fluxo premium de confirmação: WhatsApp + impressão automática.
     * @param {Object} order - Pedido na transição Novo -> Confirmado.
     * @param {Window|null} popupRef - Janela já aberta para WhatsApp.
     * @returns {Promise<{whatsappStatus:string, printStatus:string, printMessage:string, duplicate:boolean}>}
     */
    const runConfirmedOrderAutomation = useCallback(async (order, popupRef = null) => {
        const nowMs = Date.now();
        if (autoPrintExecutionMapRef.current.size > 600) {
            const minAllowedMs = nowMs - (1000 * 60 * 60 * 2);
            Array.from(autoPrintExecutionMapRef.current.entries()).forEach(([key, value]) => {
                if ((Number(value?.updatedAt) || 0) < minAllowedMs) autoPrintExecutionMapRef.current.delete(key);
            });
        }
        const automationKey = buildOrderNotificationKey(order) || `order-${safeText(order?.id)}`;
        const currentExecution = autoPrintExecutionMapRef.current.get(automationKey);
        if (currentExecution && ['pending', 'printing', 'printed', 'fallback'].includes(currentExecution.state)) {
            return {
                whatsappStatus: 'duplicate_guard',
                printStatus: currentExecution.state,
                printMessage: 'Fluxo premium já executado para este evento de confirmação.',
                duplicate: true,
            };
        }

        autoPrintExecutionMapRef.current.set(automationKey, { state: 'pending', updatedAt: Date.now() });
        setLastAutoPrintStatus({
            state: 'pending',
            label: 'Fluxo de impressão em fila (pending)',
            orderId: safeText(order?.id),
            updatedAt: Date.now(),
        });

        const settings = normalizeThermalPrintSettings(localSettings);
        const whatsappResult = openConfirmedOrderWhatsApp(order, popupRef, { silentUi: true });
        let printStatus = 'pending';
        let printMessage = 'Aguardando impressão automática.';

        if (!settings.thermalPrintEnabled || !settings.thermalPrintAutoOnOrder) {
            printStatus = 'skipped';
            printMessage = 'Impressão automática desativada nas configurações.';
            autoPrintExecutionMapRef.current.set(automationKey, { state: printStatus, updatedAt: Date.now() });
            setLastAutoPrintStatus({
                state: printStatus,
                label: printMessage,
                orderId: safeText(order?.id),
                updatedAt: Date.now(),
            });
            return { whatsappStatus: whatsappResult.status, printStatus, printMessage, duplicate: false };
        }

        const orderForPrint = buildOrderPrintPayloadFromOrder(order);
        try {
            printStatus = 'printing';
            printMessage = 'Impressão automática em andamento...';
            autoPrintExecutionMapRef.current.set(automationKey, { state: printStatus, updatedAt: Date.now() });
            setLastAutoPrintStatus({
                state: printStatus,
                label: printMessage,
                orderId: safeText(order?.id),
                updatedAt: Date.now(),
            });

            if (settings.thermalPrintMode === 'browser') {
                printOrderViaBrowser(orderForPrint, null, settings);
            } else {
                await printOrderViaQz(orderForPrint, settings);
            }
            printStatus = 'printed';
            printMessage = 'Impressão automática concluída.';
        } catch (error) {
            const friendlyError = describeThermalPrintError(error);
            if (settings.thermalPrintBrowserFallback) {
                try {
                    printOrderViaBrowser(orderForPrint, null, settings);
                    printStatus = 'fallback';
                    printMessage = `QZ indisponível, fallback de navegador executado (${friendlyError}).`;
                } catch (fallbackError) {
                    console.warn('Falha no fallback da impressão automática de confirmação:', safeText(fallbackError?.message || fallbackError));
                    printStatus = 'failed';
                    printMessage = `Impressão automática falhou: ${friendlyError}`;
                }
            } else {
                printStatus = 'failed';
                printMessage = `Impressão automática falhou: ${friendlyError}`;
            }
        }

        autoPrintExecutionMapRef.current.set(automationKey, { state: printStatus, updatedAt: Date.now() });
        setLastAutoPrintStatus({
            state: printStatus,
            label: printMessage,
            orderId: safeText(order?.id),
            updatedAt: Date.now(),
        });

        return { whatsappStatus: whatsappResult.status, printStatus, printMessage, duplicate: false };
    }, [localSettings, buildOrderNotificationKey, buildOrderPrintPayloadFromOrder, openConfirmedOrderWhatsApp]);

    const runThermalDiagnostic = useCallback(async ({ connectIfNeeded = false } = {}) => {
        if (thermalDiagBusyRef.current) return;
        thermalDiagBusyRef.current = true;

        const startedAt = new Date();
        setThermalDiag(prev => ({ ...prev, checking: true }));

        try {
            if (typeof window === 'undefined') {
                setThermalDiag({
                    checking: false,
                    lastCheckedAt: startedAt,
                    scriptLoaded: false,
                    qzConnected: false,
                    printerFound: false,
                    printerName: '',
                    message: 'Ambiente sem acesso ao objeto window.',
                });
                return;
            }

            if (!window.qz) {
                setThermalDiag({
                    checking: false,
                    lastCheckedAt: startedAt,
                    scriptLoaded: false,
                    qzConnected: false,
                    printerFound: false,
                    printerName: '',
                    message: 'QZ script não detectado na página.',
                });
                return;
            }

            let qzConnected = window.qz.websocket.isActive();
            if (!qzConnected && connectIfNeeded) {
                await ensureQzSecurityHooks();
                await window.qz.websocket.connect();
                qzConnected = window.qz.websocket.isActive();
            }

            if (!qzConnected) {
                setThermalDiag({
                    checking: false,
                    lastCheckedAt: startedAt,
                    scriptLoaded: true,
                    qzConnected: false,
                    printerFound: false,
                    printerName: '',
                    message: 'QZ detectado, mas sem conexão ativa.',
                });
                return;
            }

            const settings = normalizeThermalPrintSettings(localSettings);
            const printerName = settings.thermalPrinterName
                ? await window.qz.printers.find(settings.thermalPrinterName)
                : await window.qz.printers.getDefault();

            setThermalDiag({
                checking: false,
                lastCheckedAt: startedAt,
                scriptLoaded: true,
                qzConnected: true,
                printerFound: Boolean(printerName),
                printerName: safeText(printerName),
                message: printerName
                    ? `Ambiente pronto para impressão (${safeText(printerName)}).`
                    : 'QZ conectado, mas impressora não encontrada.',
            });
        } catch (error) {
            setThermalDiag({
                checking: false,
                lastCheckedAt: startedAt,
                scriptLoaded: Boolean(typeof window !== 'undefined' && window.qz),
                qzConnected: false,
                printerFound: false,
                printerName: '',
                message: describeThermalPrintError(error),
            });
        } finally {
            thermalDiagBusyRef.current = false;
        }
    }, [localSettings]);

    useEffect(() => {
        if (tab !== 'settings') return;
        // Passive check avoids triggering repeated permission prompts while opening settings.
        runThermalDiagnostic({ connectIfNeeded: false });
    }, [tab, runThermalDiagnostic]);

    /**
     * Traduz resultado de impressão premium para tom visual de toast.
     * @param {string} printStatus - Estado da impressão automática.
     * @returns {'success'|'warning'|'error'|'info'} Tom visual do feedback.
     */
    const getPrintToastTone = useCallback((printStatus) => {
        if (printStatus === 'printed') return 'success';
        if (printStatus === 'fallback') return 'warning';
        if (printStatus === 'failed') return 'error';
        return 'info';
    }, []);

    const updateStatus = useCallback(async (order, nextStatus) => {
        const inFlightKey = `${safeText(order?.id)}::${safeText(nextStatus)}`;
        if (orderStatusUpdateInFlightRef.current.has(inFlightKey)) return;
        orderStatusUpdateInFlightRef.current.add(inFlightKey);

        const orderRef = getCol('orders').doc(order.id);
        const total = Number(order.total) || 0;
        const currentStatusKey = normalizeOrderStatusKey(order?.status);
        const nextStatusKey = normalizeOrderStatusKey(nextStatus);
        const isNewToConfirmedTransition = currentStatusKey === 'novo' && nextStatusKey === 'confirmado';
        const isCurrentStatusConcluded = currentStatusKey === ORDER_STATUS_CONCLUDED_KEY;
        const concludedFieldResetPayload = isCurrentStatusConcluded && nextStatusKey !== ORDER_STATUS_CONCLUDED_KEY
            ? {
                concluidoEm: firebase.firestore.FieldValue.delete(),
                completedAt: firebase.firestore.FieldValue.delete(),
            }
            : {};
        const hasValidWhatsapp = Boolean(formatPhoneForWhatsApp(order?.customerPhone));
        const whatsappPopup = isNewToConfirmedTransition
            && hasValidWhatsapp
            ? window.open('', '_blank')
            : null;

        if (whatsappPopup && whatsappPopup.document) {
            whatsappPopup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>WhatsApp</title></head><body style="font-family:Arial,sans-serif;padding:16px;color:#334155;">Preparando mensagem do WhatsApp...</body></html>');
            whatsappPopup.document.close();
        }

        try {
            if (nextStatus === 'Pago') {
                const useFull = confirm(
                    `Marcar como "Pago" com valor cheio?\n\n` +
                    `Total do pedido: R$ ${total.toFixed(2)}\n\n` +
                    `OK = valor cheio\nCancelar = informar valor manual`
                );

                if (useFull) {
                    await orderRef.update({
                        status: nextStatus,
                        paidAmount: total,
                        paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                        ...concludedFieldResetPayload,
                    });
                    return;
                }

                const suggested = Number(order.paidAmount);
                const manualStr = prompt(
                    `Digite o valor recebido (entre 0 e R$ ${total.toFixed(2)}):`,
                    Number.isFinite(suggested) ? suggested.toFixed(2) : total.toFixed(2)
                );
                if (manualStr === null) return;

                const manual = Number(String(manualStr).replace(',', '.'));
                if (!Number.isFinite(manual) || manual < 0 || manual > total) {
                    alert('Valor inválido. Informe um número entre 0 e o total do pedido.');
                    return;
                }

                await orderRef.update({
                    status: nextStatus,
                    paidAmount: manual,
                    paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                    ...concludedFieldResetPayload,
                });
                return;
            }

            if (['Novo', 'Confirmado'].includes(nextStatus)) {
                await orderRef.update({ status: nextStatus, ...concludedFieldResetPayload });
                if (isNewToConfirmedTransition) {
                    const automationResult = await runConfirmedOrderAutomation({ ...order, status: nextStatus }, whatsappPopup);
                    const customerLabel = safeText(order?.customerName, 'Cliente').trim() || 'Cliente';
                    const whatsappLabel = automationResult.whatsappStatus === 'sent'
                        ? 'WhatsApp enviado'
                        : automationResult.whatsappStatus === 'missing_phone'
                            ? 'WhatsApp pendente (contato inválido)'
                            : automationResult.whatsappStatus === 'blocked_popup'
                                ? 'WhatsApp pendente (popup bloqueado)'
                                : automationResult.whatsappStatus === 'duplicate_guard'
                                    ? 'WhatsApp já processado'
                                    : 'WhatsApp em verificação';

                    const printLabel = automationResult.printStatus === 'printed'
                        ? 'Impressão automática concluída'
                        : automationResult.printStatus === 'fallback'
                            ? 'Impressão via fallback do navegador'
                            : automationResult.printStatus === 'failed'
                                ? 'Impressão com falha'
                                : automationResult.printStatus === 'skipped'
                                    ? 'Impressão automática desativada'
                                    : automationResult.printStatus === 'printing'
                                        ? 'Impressão em andamento'
                                        : 'Impressão em fila';

                    pushOrderFlowFeedbackToast({
                        title: `Pedido confirmado - ${customerLabel}`,
                        body: `${whatsappLabel} • ${printLabel}`,
                        tone: getPrintToastTone(automationResult.printStatus),
                        durationMs: automationResult.printStatus === 'failed' ? 14000 : 9000,
                    });
                }
                return;
            }

            if (nextStatusKey === ORDER_STATUS_CONCLUDED_KEY) {
                const reservationStatus = safeText(order?.stockReservation?.status).trim();
                const concludableReservationStatuses = ['applied', 'no_limited_products', 'skipped_no_product_ids'];
                if (!concludableReservationStatuses.includes(reservationStatus)) {
                    const reason = safeText(order?.stockReservation?.reason).trim();
                    const reasonLine = reason ? `\n\nMotivo técnico: ${reason}` : '';
                    alert(
                        'Não é possível concluir este pedido enquanto a baixa de estoque não estiver válida.\n' +
                        'Ajuste o estoque e/ou valide a reserva antes de concluir.' +
                        reasonLine
                    );
                    return;
                }
            }

            if (['Pronto', 'Concluído'].includes(nextStatus)) {
                const currentPaid = Number(order.paidAmount);
                const paidAmount = Number.isFinite(currentPaid) && currentPaid > 0
                    ? Math.min(currentPaid, total)
                    : total;
                const payload = { status: nextStatus, paidAmount, ...concludedFieldResetPayload };
                if (nextStatusKey === ORDER_STATUS_CONCLUDED_KEY) {
                    // Ao concluir, grava timestamps de servidor para auditoria e janela de ocultação.
                    payload.completedAt = firebase.firestore.FieldValue.serverTimestamp();
                    payload.concluidoEm = firebase.firestore.FieldValue.serverTimestamp();
                }
                if (!order.paidAt) payload.paidAt = firebase.firestore.FieldValue.serverTimestamp();
                await orderRef.update(payload);
                return;
            }

            await orderRef.update({ status: nextStatus, ...concludedFieldResetPayload });
        } catch (error) {
            if (whatsappPopup && !whatsappPopup.closed) whatsappPopup.close();
            console.error('Erro ao atualizar status do pedido:', error);
            alert('Não foi possível atualizar o status do pedido.');
        } finally {
            orderStatusUpdateInFlightRef.current.delete(inFlightKey);
        }
    }, [getPrintToastTone, normalizeOrderStatusKey, pushOrderFlowFeedbackToast, runConfirmedOrderAutomation]);
    const deleteDoc = useCallback(async (col, id) => { if (confirm('Deseja realmente apagar?')) await getCol(col).doc(id).delete(); }, []);

    // Funções auxiliares para entregas
    const getDaysUntilDelivery = useCallback((deliveryDate) => {
        if (!deliveryDate) return null;
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const delivery = toLocalDateFromDateOnly(deliveryDate);
            if (!delivery) return null;
            const diffTime = delivery - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch (error) {
            return null;
        }
    }, []);

    const getDeliveryPriority = useCallback((order) => {
        const daysUntil = getDaysUntilDelivery(order.date);
        const status = safeText(order.status, 'Novo').toLowerCase();
        const isUrgent = daysUntil !== null && daysUntil <= 1;
        const isHighValue = Number(order.total || 0) > 200;
        const isOverdue = daysUntil !== null && daysUntil < 0 && status !== 'concluído';

        if (isOverdue) return { label: 'ATRASADO', color: '#dc2626', priority: 1 };
        if (isUrgent && status !== 'concluído') return { label: 'URGENTE', color: '#f59e0b', priority: 2 };
        if (isHighValue && status !== 'concluído') return { label: 'ALTO VALOR', color: '#8b5cf6', priority: 3 };
        if (daysUntil !== null && daysUntil <= 3 && status !== 'concluído') return { label: 'PRÓXIMO', color: '#3b82f6', priority: 4 };
        return { label: 'NORMAL', color: '#6b7280', priority: 5 };
    }, [getDaysUntilDelivery]);

    const isOrderOverdue = useCallback((order) => {
        const daysUntil = getDaysUntilDelivery(order.date);
        const status = safeText(order.status, 'Novo').toLowerCase();
        return daysUntil !== null && daysUntil < 0 && status !== 'concluído';
    }, [getDaysUntilDelivery]);

    const deliveryBaseOrders = useMemo(() => {
        if (deliveryCampaignFilter === 'all') return normalizedOrders;
        return normalizedOrders.filter(o => normalizeCampaignId(o.campaignId, CAMPAIGN_LEGACY_ID) === deliveryCampaignFilter);
    }, [normalizedOrders, deliveryCampaignFilter]);

    const filteredDeliveries = useMemo(() => {
        let filtered = [...deliveryBaseOrders];

        // Filtro de status
        if (deliveryStatusFilter === 'pending') {
            filtered = filtered.filter(o => safeText(o.status).toLowerCase() !== 'concluído');
        } else if (deliveryStatusFilter === 'completed') {
            filtered = filtered.filter(o => safeText(o.status).toLowerCase() === 'concluído');
        }

        // Filtro de período

        if (deliveryFilter === 'today') {
            filtered = filtered.filter(o => {
                const daysUntil = getDaysUntilDelivery(o.date);
                return daysUntil === 0;
            });
        } else if (deliveryFilter === 'tomorrow') {
            filtered = filtered.filter(o => {
                const daysUntil = getDaysUntilDelivery(o.date);
                return daysUntil === 1;
            });
        } else if (deliveryFilter === 'next3days') {
            filtered = filtered.filter(o => {
                const daysUntil = getDaysUntilDelivery(o.date);
                return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
            });
        } else if (deliveryFilter === 'nextweek') {
            filtered = filtered.filter(o => {
                const daysUntil = getDaysUntilDelivery(o.date);
                return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
            });
        } else if (deliveryFilter === 'overdue') {
            filtered = filtered.filter(o => isOrderOverdue(o));
        }

        // Filtro de busca
        if (deliverySearch) {
            const term = normalizeSearchTerm(deliverySearch);
            filtered = filtered.filter(o => {
                const itemDetails = Array.isArray(o.items)
                    ? o.items.map((item) => `${Number(item?.qty || 1)}x ${safeText(item?.name, 'Produto')} ${safeText(item?.productId)}`)
                    : [];
                const searchableText = buildSearchableText([
                    o.id,
                    o.customerName,
                    o.customerPhone,
                    o.address,
                    o.status,
                    o.method,
                    o.paymentMethod,
                    o.driverName,
                    o.date,
                    o.time,
                    o.observations,
                    getCampaignName(o.campaignId),
                    itemDetails,
                ]);
                return searchableText.includes(term);
            });
        }

        // Filtro de pagamento
        if (deliveryPaymentFilter !== 'all') {
            filtered = filtered.filter(o => {
                const total = Number(o.total || 0);
                const status = safeText(o.status, 'Novo');
                const isPaid = ['Pago', 'Pronto', 'Concluído'].includes(status);
                const paidRaw = Number(o.paidAmount);
                const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
                const paid = isPaid ? (hasManualPaid ? Math.min(total, paidRaw) : total) : 0;
                const pending = Math.max(0, total - paid);
                if (deliveryPaymentFilter === 'paid') return isPaid && pending <= 0.005;
                if (deliveryPaymentFilter === 'partial') return isPaid && pending > 0.005;
                if (deliveryPaymentFilter === 'unpaid') return !isPaid;
                return true;
            });
        }

        // Filtro de entregador
        if (deliveryDriverFilter !== 'all') {
            if (deliveryDriverFilter === 'unassigned') {
                filtered = filtered.filter(o => !o.driverId);
            } else {
                filtered = filtered.filter(o => o.driverId === deliveryDriverFilter);
            }
        }

        // Ordenação
        filtered.sort((a, b) => {
            if (deliverySort === 'priority') {
                const priorityA = getDeliveryPriority(a).priority;
                const priorityB = getDeliveryPriority(b).priority;
                return priorityA - priorityB;
            } else if (deliverySort === 'date') {
                const dateA = toLocalDateFromDateOnly(a.date) || new Date(9999, 11, 31);
                const dateB = toLocalDateFromDateOnly(b.date) || new Date(9999, 11, 31);
                return dateA - dateB;
            } else if (deliverySort === 'customer') {
                const nameA = safeText(a.customerName, '').toLowerCase();
                const nameB = safeText(b.customerName, '').toLowerCase();
                return nameA.localeCompare(nameB);
            } else if (deliverySort === 'value') {
                const valueA = Number(a.total || 0);
                const valueB = Number(b.total || 0);
                return valueB - valueA;
            }
            return 0;
        });

        return filtered;
    }, [deliveryBaseOrders, deliveryStatusFilter, deliveryFilter, deliverySearch, deliverySort, deliveryPaymentFilter, deliveryDriverFilter, getDaysUntilDelivery, getDeliveryPriority, isOrderOverdue, getCampaignName]);

    // Cálculos para os cards de resumo
    const overdueDeliveries = useMemo(() => {
        return deliveryBaseOrders.filter(o => isOrderOverdue(o));
    }, [deliveryBaseOrders, isOrderOverdue]);

    const todayDeliveries = useMemo(() => {
        return deliveryBaseOrders.filter(o => {
            const daysUntil = getDaysUntilDelivery(o.date);
            return daysUntil === 0 && safeText(o.status).toLowerCase() !== 'concluído';
        });
    }, [deliveryBaseOrders, getDaysUntilDelivery]);

    const weekDeliveries = useMemo(() => {
        return deliveryBaseOrders.filter(o => {
            const daysUntil = getDaysUntilDelivery(o.date);
            return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && safeText(o.status).toLowerCase() !== 'concluído';
        });
    }, [deliveryBaseOrders, getDaysUntilDelivery]);

    const completedDeliveries = useMemo(() => {
        const currentMonth = getLocalMonthStr();
        return deliveryBaseOrders.filter(o => {
            const status = safeText(o.status).toLowerCase() === 'concluído';
            if (!status || !o.completedAt) return false;
            try {
                const completedDate = typeof o.completedAt.toDate === 'function'
                    ? o.completedAt.toDate()
                    : new Date(o.completedAt.seconds * 1000);
                return getLocalMonthStr(completedDate) === currentMonth;
            } catch {
                return false;
            }
        });
    }, [deliveryBaseOrders]);

    const unpaidDeliveries = useMemo(() => {
        return deliveryBaseOrders.filter(o => {
            const total = Number(o.total || 0);
            const status = safeText(o.status, 'Novo');
            const isPaid = ['Pago', 'Pronto', 'Concluído'].includes(status);
            const paidRaw = Number(o.paidAmount);
            const hasManualPaid = Number.isFinite(paidRaw) && paidRaw > 0;
            const paid = isPaid ? (hasManualPaid ? Math.min(total, paidRaw) : total) : 0;
            return Math.max(0, total - paid) > 0.005;
        });
    }, [deliveryBaseOrders]);

    const isOverdueCardActive = deliveryFilter === 'overdue' && deliveryStatusFilter === 'pending';
    const isTodayCardActive = deliveryFilter === 'today' && deliveryStatusFilter === 'pending';
    const isWeekCardActive = deliveryFilter === 'nextweek' && deliveryStatusFilter === 'pending';
    const isCompletedCardActive = deliveryStatusFilter === 'completed';
    const isUnpaidCardActive = deliveryPaymentFilter === 'unpaid';

    // Produtos do Site
    const findEquivalentProduct = useCallback((draftProduct, excludedId = '') => {
        const draftKey = buildProductIdentityKey(draftProduct, menuTabOptions);
        if (!draftKey) return null;
        return (Array.isArray(products) ? products : []).find((product) => (
            safeText(product?.id) !== safeText(excludedId) &&
            buildProductIdentityKey(product, menuTabOptions) === draftKey
        )) || null;
    }, [products, menuTabOptions]);

    /* ── addProduct: Cria novo produto no catálogo ────────────────────
       Valida nome e preço obrigatórios. Detecta produto equivalente
       (mesmo nome normalizado) e pergunta se deve atualizar.
       Normaliza imagens e menuTab antes de salvar no Firebase. */
    /* @update 2026-04-27 — Adicionado try-catch no addProduct para evitar
       travamento quando a escrita falha (permissão, rede, token expirado). */
    const addProduct = useCallback(async () => {
        if (!newProd.name || !newProd.price) return alert('Preencha o nome e preço.');
        const equivalentProduct = findEquivalentProduct(newProd);
        if (equivalentProduct) {
            setEditProd({ ...equivalentProduct });
            return alert('Já existe um item equivalente no cardápio. Edite o produto existente em vez de criar outro.');
        }
        const imgs = Array.isArray(newProd.images) && newProd.images.length > 0 ? newProd.images : (newProd.image ? [newProd.image] : []);
        const primaryImg = imgs[0] || 'https://res.cloudinary.com/djj7r3ljl/image/upload/v1775978775/Mini_Studio_Helo%CC%82_Conf_page-0001_zb5wap.jpg';
        const menuTab = resolveProductMenuTab(newProd, menuTabOptions);
        try {
        await getCol('products').add({
            name: String(newProd.name), price: parseFloat(newProd.price), size: String(newProd.size || ''),
            weight: String(newProd.weight || 'Unidade'), tag: String(newProd.tag || ''), desc: String(newProd.desc || ''),
            installment: String(newProd.installment || installmentText(newProd.price, '')),
            image: primaryImg, images: imgs,
            isVisible: newProd.isVisible !== false,
            stockLimit: (newProd.stockLimit !== '' && newProd.stockLimit !== null && !isNaN(Number(newProd.stockLimit))) ? Math.max(0, parseInt(newProd.stockLimit, 10)) : null,
            campaignId: normalizeCampaignId(newProd.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
            menuTab,
            menuCategory: menuTab,
            category: menuTab,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        setNewProd({ name: '', price: '', size: '', weight: '', tag: '', desc: '', image: '', images: [], installment: '', isVisible: true, stockLimit: '', campaignId: activeCampaignId || CAMPAIGN_GENERAL_ID, menuTab: defaultMenuTabKey }); alert('Produto adicionado com sucesso!');
        } catch (err) {
            console.error('[Admin] Erro ao adicionar produto:', err);
            alert('Não foi possível adicionar o produto. Verifique sua conexão e tente novamente.');
        }
    }, [newProd, activeCampaignId, findEquivalentProduct, menuTabOptions, defaultMenuTabKey]);

    /* @update 2026-04-27 — Adicionado try-catch no updateProduct para evitar
       travamento quando a escrita falha (permissão, rede, token expirado). */
    const updateProduct = useCallback(async () => {
        if (!editProd || !editProd.name || !editProd.price) return alert('Preencha o nome e preço.');
        const imgs = Array.isArray(editProd.images) && editProd.images.length > 0 ? editProd.images : (editProd.image ? [editProd.image] : []);
        const primaryImg = imgs[0] || 'https://res.cloudinary.com/djj7r3ljl/image/upload/v1775978775/Mini_Studio_Helo%CC%82_Conf_page-0001_zb5wap.jpg';
        const menuTab = resolveProductMenuTab(editProd, menuTabOptions);
        try {
        await getCol('products').doc(editProd.id).update({
            name: String(editProd.name), price: parseFloat(editProd.price), size: String(editProd.size || ''),
            weight: String(editProd.weight || 'Unidade'), tag: String(editProd.tag || ''), desc: String(editProd.desc || ''),
            installment: String(editProd.installment || installmentText(editProd.price, '')),
            image: primaryImg, images: imgs,
            isVisible: editProd.isVisible !== false,
            stockLimit: (editProd.stockLimit !== '' && editProd.stockLimit !== null && !isNaN(Number(editProd.stockLimit))) ? Math.max(0, parseInt(editProd.stockLimit, 10)) : null,
            campaignId: normalizeCampaignId(editProd.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID),
            menuTab,
            menuCategory: menuTab,
            category: menuTab,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        setEditProd(null); alert('Produto atualizado!');
        } catch (err) {
            console.error('[Admin] Erro ao atualizar produto:', err);
            alert('Não foi possível atualizar o produto. Verifique sua conexão e tente novamente.');
        }
    }, [editProd, activeCampaignId, menuTabOptions]);

    /* ── toggleProductVisibility: Alterna visibilidade do produto ──────
       Recebe: id do produto, valor atual de isVisible
       Atualiza Firestore invertendo o valor booleano.
       @update 2026-04-27 — Adicionado try-catch para evitar travamento
       da UI quando a escrita falha (permissão, rede, token expirado).
       Antes, um erro não tratado fazia o botão parecer "congelado". */
    const toggleProductVisibility = useCallback(async (id, cur) => {
        try {
            await getCol('products').doc(id).update({ isVisible: cur === false });
        } catch (err) {
            console.error('[Admin] Erro ao alternar visibilidade do produto:', err);
            alert('Não foi possível alterar a visibilidade. Verifique sua conexão e tente novamente.');
        }
    }, []);

    /* ── setProductStock: Define limite de estoque do produto ────────────
       Recebe: id do produto, valor do estoque (string/number/null)
       Converte para inteiro ou null (estoque ilimitado) e salva no Firestore.
       @update 2026-04-20 Extraído de dentro de toggleProductVisibility
       para corrigir violação das Rules of Hooks (useCallback aninhado).
       @update 2026-04-27 — Adicionado try-catch para evitar travamento. */
    const setProductStock = useCallback(async (id, value) => {
        const parsed = (value === '' || value === null || value === undefined) ? null : parseInt(value, 10);
        try {
            await getCol('products').doc(id).update({ stockLimit: isNaN(parsed) ? null : Math.max(0, parsed) });
        } catch (err) {
            console.error('[Admin] Erro ao definir estoque do produto:', err);
            alert('Não foi possível alterar o estoque. Verifique sua conexão e tente novamente.');
        }
    }, []);

    /* ── addCoupon: Cria novo cupom de desconto ────────────────────────
       Valida código e valor. Salva na collection 'coupons' com
       código em maiúsculas e ativo por padrão. */
    const addCoupon = useCallback(async () => {
        if (!newCoup.code || (newCoup.type !== 'free_shipping' && !newCoup.value)) return alert('Preencha o código e o valor.');
        await getCol('coupons').add({ code: String(newCoup.code).toUpperCase(), type: newCoup.type, value: newCoup.type === 'free_shipping' ? 0 : parseFloat(newCoup.value), active: true });
        setNewCoup({ code: '', type: 'percent', value: '' }); alert('Cupom ativado!');
    }, [newCoup]);
    /* ── toggleCoupon: Ativa/desativa cupom existente ────────────────── */
    const toggleCoupon = useCallback(async (id, cur) => { await getCol('coupons').doc(id).update({ active: !cur }); }, []);

    /* ── updateOrder: Atualiza pedido editado no Firebase ──────────────
       Recebe dados de editOrder. Normaliza pagamento, calcula taxa de
       cartão se necessário. Atualiza o documento na collection 'orders'.
       Fecha modal de edição após salvar. */
    const updateOrder = useCallback(async () => {
        if (!editOrder) return;
        const returnTab = editOrder._returnTab;
        const normalizedEditPayment = normalizeText(editOrder.paymentMethod).toLowerCase();
        const isCashPayment = normalizedEditPayment.includes('dinheiro');
        const normalizedCashChangeFor = safeText(editOrder.cashChangeFor).replace(',', '.').replace(/[^0-9.]/g, '');
        const cashChangeForValue = Number(normalizedCashChangeFor);
        const hasValidCashChangeFor = Number.isFinite(cashChangeForValue) && cashChangeForValue > 0;

        if (isCashPayment && !hasValidCashChangeFor) {
            alert('Para pagamento em Dinheiro, informe o campo "Troco para quanto?".');
            return;
        }

        await getCol('orders').doc(editOrder.id).update({
            customerName: String(editOrder.customerName || ''), customerPhone: String(editOrder.customerPhone || ''),
            date: String(editOrder.date || ''), time: String(editOrder.time || ''), method: String(editOrder.method || ''),
            address: String(editOrder.address || ''), total: parseFloat(editOrder.total || 0),
            observations: String(editOrder.observations || ''),
            paymentMethod: String(editOrder.paymentMethod || ''),
            cashChangeFor: isCashPayment && hasValidCashChangeFor ? cashChangeForValue : firebase.firestore.FieldValue.delete(),
            cardInstallments: String(editOrder.cardInstallments || '1'),
            cardFeeRate: parseFloat(editOrder.cardFeeRate || 0),
            cardFeeValue: parseFloat(editOrder.cardFeeValue || 0),
            driverId: editOrder.driverId || firebase.firestore.FieldValue.delete(),
            driverName: editOrder.driverId ? String(editOrder.driverName || '') : firebase.firestore.FieldValue.delete(),
        });
        setEditOrder(null);
        alert('Pedido atualizado com sucesso!');
        if (returnTab) setTab(returnTab);
    }, [editOrder]);

    // ─────────────────────────────────────────────────────────────────────────────
    // Stories Generation
    // ─────────────────────────────────────────────────────────────────────────────

    const gerarStoryClientes = useCallback(() => {
        const top3 = topCustomers.slice(0, 3);
        if (top3.length === 0) return alert('Nenhum cliente no ranking ainda.');

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1C2638';
        ctx.fillRect(0, 0, 1080, 1920);

        const gradient = ctx.createRadialGradient(540, 0, 100, 540, 0, 1200);
        gradient.addColorStop(0, 'rgba(207, 168, 96, 0.3)');
        gradient.addColorStop(1, 'rgba(28, 38, 56, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);

        ctx.textAlign = 'center';
        ctx.font = '80px sans-serif';
        ctx.fillText('👑', 540, 250);

        ctx.fillStyle = '#CFA860';
        ctx.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('HELÔ CONFEITARIA', 540, 330);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 110px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('TOP CLIENTES', 540, 480);

        ctx.fillStyle = '#CFA860';
        ctx.font = 'italic 60px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('DESTAQUES DO MÊS', 540, 560);

        top3.forEach((c, index) => {
            const y = 750 + (index * 280);

            const primeiroNome = safeText(c.name).trim().split(' ')[0].toUpperCase();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(140, y, 800, 200, 40);
                ctx.fill();
            } else {
                ctx.fillRect(140, y, 800, 200);
            }

            ctx.strokeStyle = 'rgba(207, 168, 96, 0.3)';
            ctx.lineWidth = 4;
            if (ctx.roundRect) ctx.stroke(); else ctx.strokeRect(140, y, 800, 200);

            ctx.fillStyle = index === 0 ? '#CFA860' : index === 1 ? '#e2e8f0' : '#b45309';
            ctx.font = 'bold 100px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}º`, 280, y + 135);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(primeiroNome, 420, y + 100, 480);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '45px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(`${c.unitsCount} ${c.unitsCount > 1 ? 'unidades' : 'unidade'}`, 420, y + 160);
        });

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '40px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Muito obrigado pela preferência e carinho! 💛', 540, 1780);

        const dataUrl = canvas.toDataURL('image/png');
        setStoryPreview(dataUrl);
    }, [topCustomers]);

    const gerarStoryProdutos = useCallback(() => {
        const top3 = productSalesStats.list.slice(0, 3);
        if (top3.length === 0) return alert('Nenhum produto vendido ainda.');

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1C2638';
        ctx.fillRect(0, 0, 1080, 1920);

        const gradient = ctx.createRadialGradient(540, 0, 100, 540, 0, 1200);
        gradient.addColorStop(0, 'rgba(207, 168, 96, 0.3)');
        gradient.addColorStop(1, 'rgba(28, 38, 56, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1920);

        ctx.textAlign = 'center';
        ctx.font = '80px sans-serif';
        ctx.fillText('🍫', 540, 250);

        ctx.fillStyle = '#CFA860';
        ctx.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('HELÔ CONFEITARIA', 540, 330);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 100px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('TOP PRODUTOS', 540, 480);

        ctx.fillStyle = '#CFA860';
        ctx.font = 'italic 55px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('OS MAIS DESEJADOS', 540, 560);

        top3.forEach((p, index) => {
            const y = 750 + (index * 280);

            let nomeProd = safeText(p.name).trim().toUpperCase();
            if (nomeProd.length > 28) nomeProd = nomeProd.substring(0, 26) + '...';

            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(140, y, 800, 200, 40);
                ctx.fill();
            } else {
                ctx.fillRect(140, y, 800, 200);
            }

            ctx.strokeStyle = 'rgba(207, 168, 96, 0.3)';
            ctx.lineWidth = 4;
            if (ctx.roundRect) ctx.stroke(); else ctx.strokeRect(140, y, 800, 200);

            ctx.fillStyle = index === 0 ? '#CFA860' : index === 1 ? '#e2e8f0' : '#b45309';
            ctx.font = 'bold 100px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}º`, 280, y + 135);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(nomeProd, 420, y + 100, 480);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '45px "Plus Jakarta Sans", sans-serif';
            ctx.fillText(`${p.qty} unidades`, 420, y + 160);
        });

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '40px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Já pediu o seu favorito hoje? 😍', 540, 1780);

        const dataUrl = canvas.toDataURL('image/png');
        setStoryPreview(dataUrl);
    }, [productSalesStats]);

    const compartilharImagemStory = async () => {
        if (!storyPreview) return;
        try {
            const blob = await (await fetch(storyPreview)).blob();
            const file = new File([blob], 'story-helo.png', { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Story Helô Confeitaria',
                });
            } else {
                const link = document.createElement('a');
                link.href = storyPreview;
                link.download = 'story-helo.png';
                link.click();
                alert('Imagem baixada com sucesso! Agora você pode postar.');
            }
        } catch (err) {
            console.error('Compartilhamento falhou/cancelado:', err);
        }
    };

    const NAV_GROUPS = [
        { k: 'operation', l: 'Operação', icon: 'ph-clipboard-text', tabs: [
            { k: 'orders', l: 'Pedidos' },
            { k: 'agenda', l: 'Agendamentos' },
            { k: 'deliveries', l: 'Próximas Entregas' },
            { k: 'finance', l: 'Financeiro' },
            { k: 'feedback', l: 'Feedback' },
            // Aba Entregadores destacada e padronizada
            { k: 'drivers', l: 'Entregadores', icon: 'ph-motorcycle' }
        ] },
        { k: 'catalog', l: 'Catálogo', icon: 'ph-storefront', tabs: [{ k: 'menu', l: 'Cardápio' }, { k: 'coupons', l: 'Cupões' }] },
        { k: 'clients', l: 'Clientes', icon: 'ph-users-three', tabs: [{ k: 'customers', l: 'Top Clientes' }, { k: 'top-pedidos', l: 'Top Pedidos' }, { k: 'visits', l: 'Acessos' }] },
        { k: 'production', l: 'Produção', icon: 'ph-package', tabs: [{ k: 'production', l: 'Estoque & Produção' }] },
        { k: 'system', l: 'Sistema', icon: 'ph-gear-six', tabs: [{ k: 'settings', l: 'Configurações' }, { k: 'payments', l: 'Pagamentos' }] },
    ];
    const activeGroup = NAV_GROUPS.find(group => group.tabs.some(item => item.k === tab)) || NAV_GROUPS[0];

    const handleCopyFeedbackMessage = useCallback(async (order) => {
        if (!order?.id) return;
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        const feedbackUrl = `${baseUrl}?feedback=${order.id}`;
        const message =
            `Oi, ${safeText(order.customerName, 'tudo bem?')}! Aqui é da Helô Confeitaria 💙

Seu pedido foi finalizado e eu queria muito saber como foi a sua experiência.

Se puder, responde rapidinho nosso feedback:
${feedbackUrl}`;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(message);
            } else {
                const temp = document.createElement('textarea');
                temp.value = message;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
            }
            alert('Mensagem de feedback copiada com sucesso!');
            setFeedbackBusyId(order.id);
            try {
                await getCol('feedbacks').doc(order.id).set({
                    orderId: order.id,
                    customerName: safeText(order.customerName),
                    customerPhone: safeText(order.customerPhone),
                    feedbackUrl,
                    invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                }, { merge: true });
            } catch (err) {
                console.warn('Falha ao registrar status do feedback, mas a mensagem foi copiada.', err);
            }
        } catch (err) {
            console.error(err);
            alert('Não foi possível copiar a mensagem de feedback.');
        } finally {
            setFeedbackBusyId(null);
        }
    }, []);

    return (
        <div className="admin-shell" style={{ minHeight: '100vh', background: '#f8fafc', padding: '1rem' }}>
            <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
                {/* Header Admin */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', marginBottom: '2rem', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <img src="./favicon.svg" alt="Painel Helô" style={{ width: '2.25rem', height: '2.25rem', display: 'block' }} />
                            <div>
                                <h1 className="font-brand" style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>Painel Helô</h1>
                                <p style={{ fontSize: '11px', color: 'var(--s400)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Gestão Completa ERP</p>
                            </div>
                        </div>
                        <button onClick={onExit} style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #fecaca', cursor: 'pointer', background: '#fff5f5', color: '#ef4444', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                            Sair
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {NAV_GROUPS.map(group => {
                            const isActive = activeGroup.k === group.k;
                            return (
                                <button key={group.k} onClick={() => setTab(group.tabs[0].k)}
                                    style={{
                                        padding: '10px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: '800', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                        background: isActive ? 'var(--primary)' : '#f8fafc', color: isActive ? 'var(--cream)' : 'var(--s600)', display: 'flex', alignItems: 'center', gap: '8px',
                                        boxShadow: isActive ? '0 10px 20px -12px rgba(28,38,56,.45)' : 'none'
                                    }}>
                                    <i className={`ph-bold ${group.icon}`} style={{ fontSize: '16px' }}></i>
                                    {group.l}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px', borderTop: '1px solid #f8fafc' }}>
                        {activeGroup.tabs.map(item => {
                            const isActive = tab === item.k;
                            const isPrimary = item.k === 'orders';
                            // Ícone customizado para Entregadores
                            const icon = item.icon ? <i className={`ph-bold ${item.icon}`} style={{ fontSize: '14px' }}></i> : null;
                            return (
                                <button key={item.k} onClick={() => setTab(item.k)}
                                    style={{
                                        padding: '8px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', border: isActive ? 'none' : '1px solid #e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap',
                                        background: isActive ? (isPrimary ? 'var(--gold)' : 'var(--primary)') : '#fff',
                                        color: isActive ? (isPrimary ? '#fff' : 'var(--cream)') : 'var(--s500)',
                                        display: 'flex', alignItems: 'center', gap: '7px'
                                    }}>
                                    {icon}
                                    {item.l}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {orderRealtimeToasts.length > 0 && (
                    <div style={{
                        position: 'fixed',
                        top: '16px',
                        right: '16px',
                        width: 'min(360px, calc(100vw - 32px))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        zIndex: 260,
                    }}>
                        {orderRealtimeToasts.map((toast) => (
                            <div key={toast.id} style={{
                                background: 'linear-gradient(145deg, #ecfdf3 0%, #dcfce7 100%)',
                                border: '1px solid #86efac',
                                borderLeft: '6px solid #16a34a',
                                borderRadius: '12px',
                                padding: '12px 14px',
                                boxShadow: '0 12px 28px -16px rgba(21,128,61,.55)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '10px',
                                alignItems: 'flex-start',
                            }}>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '.08em', textTransform: 'uppercase', color: '#166534', marginBottom: '4px' }}>
                                        Novo pedido recebido!
                                    </p>
                                    <p style={{ fontSize: '13px', color: '#166534', lineHeight: 1.35 }}>{toast.body}</p>
                                </div>
                                <button
                                    onClick={() => dismissOrderRealtimeToast(toast.id)}
                                    style={{
                                        border: 'none',
                                        background: '#fff',
                                        color: '#166534',
                                        padding: '6px 10px',
                                        borderRadius: '9999px',
                                        cursor: 'pointer',
                                        fontWeight: '800',
                                        fontSize: '11px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Fechar
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {orderFlowFeedbackToasts.length > 0 && (
                    <div style={{
                        position: 'fixed',
                        top: orderRealtimeToasts.length > 0 ? '176px' : '16px',
                        right: '16px',
                        width: 'min(400px, calc(100vw - 32px))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        zIndex: 255,
                    }}>
                        {orderFlowFeedbackToasts.map((toast) => {
                            const toneStyles = toast.tone === 'success'
                                ? { bg: 'linear-gradient(145deg, #ecfdf3 0%, #dcfce7 100%)', border: '#86efac', accent: '#16a34a', text: '#166534' }
                                : toast.tone === 'warning'
                                    ? { bg: 'linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)', border: '#fdba74', accent: '#ea580c', text: '#9a3412' }
                                    : toast.tone === 'error'
                                        ? { bg: 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%)', border: '#fca5a5', accent: '#dc2626', text: '#991b1b' }
                                        : { bg: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)', border: '#93c5fd', accent: '#2563eb', text: '#1e3a8a' };
                            return (
                                <div key={toast.id} style={{
                                    background: toneStyles.bg,
                                    border: `1px solid ${toneStyles.border}`,
                                    borderLeft: `6px solid ${toneStyles.accent}`,
                                    borderRadius: '12px',
                                    padding: '12px 14px',
                                    boxShadow: '0 12px 28px -16px rgba(30,41,59,.35)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    alignItems: 'flex-start',
                                }}>
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '.08em', textTransform: 'uppercase', color: toneStyles.text, marginBottom: '4px' }}>
                                            Fluxo de confirmação
                                        </p>
                                        <p style={{ fontSize: '13px', color: toneStyles.text, fontWeight: '700', lineHeight: 1.3 }}>{toast.title}</p>
                                        <p style={{ fontSize: '12px', color: toneStyles.text, lineHeight: 1.35, marginTop: '2px' }}>{toast.body}</p>
                                    </div>
                                    <button
                                        onClick={() => dismissOrderFlowFeedbackToast(toast.id)}
                                        style={{
                                            border: 'none',
                                            background: '#fff',
                                            color: toneStyles.text,
                                            padding: '6px 10px',
                                            borderRadius: '9999px',
                                            cursor: 'pointer',
                                            fontWeight: '800',
                                            fontSize: '11px',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        Fechar
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {scheduleAlerts.length > 0 && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{
                            borderRadius: '16px',
                            border: '1px solid #fed7aa',
                            background: 'linear-gradient(125deg, #fff7ed 0%, #ffedd5 100%)',
                            padding: '12px 14px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '9999px', background: '#ea580c', boxShadow: '0 0 0 5px rgba(234,88,12,.17)' }}></span>
                                <p style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '.08em', textTransform: 'uppercase', color: '#9a3412' }}>
                                    Alerta de agendamento ativo ({scheduleAlerts.length})
                                </p>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <button onClick={() => setScheduleAlertSettings(prev => ({ ...prev, soundEnabled: !(prev.soundEnabled !== false) }))}
                                    style={{ border: '1px solid #fdba74', background: scheduleAlertSettings.soundEnabled !== false ? '#fff' : '#fff7ed', color: '#9a3412', padding: '7px 11px', borderRadius: '9999px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}>
                                    {scheduleAlertSettings.soundEnabled !== false ? 'Som ligado' : 'Som desligado'}
                                </button>
                                <button onClick={testScheduleAlertSound}
                                    style={{ border: '1px solid #fdba74', background: '#fff', color: '#9a3412', padding: '7px 11px', borderRadius: '9999px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}>
                                    Testar som
                                </button>
                                <button onClick={dismissAllScheduleAlerts}
                                    style={{ border: '1px solid #fed7aa', background: '#fff', color: '#c2410c', padding: '7px 11px', borderRadius: '9999px', cursor: 'pointer', fontWeight: '800', fontSize: '12px' }}>
                                    Dispensar todos
                                </button>
                            </div>
                        </div>
                        {scheduleAlerts.map(alertItem => (
                            <div key={alertItem.id} style={{ background: 'linear-gradient(150deg, #fffbeb 0%, #fff7ed 100%)', border: '1px solid #fdba74', borderLeft: '6px solid #f59e0b', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', boxShadow: '0 14px 30px -22px rgba(194,65,12,.65)' }}>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '.08em', textTransform: 'uppercase', color: '#9a3412', marginBottom: '4px' }}>Agendamento no horário</p>
                                    <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#7c2d12', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <i className="ph-fill ph-bell-ringing" style={{ color: '#ea580c' }}></i>
                                        {alertItem.title}
                                    </h3>
                                    <p style={{ fontSize: '13px', color: '#9a3412', lineHeight: 1.45 }}>{alertItem.body}</p>
                                </div>
                                <button onClick={() => dismissScheduleAlert(alertItem.id)} style={{ border: 'none', background: '#fff', color: '#c2410c', padding: '8px 12px', borderRadius: '9999px', cursor: 'pointer', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                    Dispensar
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Editar Pedido - Global (funciona em qualquer aba) */}
                {editOrder && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={() => {
                            const returnTab = editOrder._returnTab;
                            setEditOrder(null);
                            if (returnTab) setTab(returnTab);
                        }}></div>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '580px', position: 'relative', zIndex: 201, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-pencil-simple" style={{ color: 'var(--gold)' }}></i> Editar Pedido
                                </h3>
                                <button onClick={() => {
                                    const returnTab = editOrder._returnTab;
                                    setEditOrder(null);
                                    if (returnTab) setTab(returnTab);
                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
                                    <i className="ph-bold ph-x" style={{ fontSize: '20px', color: 'var(--s400)' }}></i>
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Nome do Cliente</label>
                                        <input style={inp} value={editOrder.customerName} onChange={e => setEditOrder({ ...editOrder, customerName: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Telefone</label>
                                        <input style={inp} value={editOrder.customerPhone} onChange={e => setEditOrder({ ...editOrder, customerPhone: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Data da Entrega</label>
                                        <input type="date" style={inp} value={editOrder.date} onChange={e => setEditOrder({ ...editOrder, date: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Hora preferida</label>
                                        <input type="time" style={inp} value={editOrder.time} onChange={e => setEditOrder({ ...editOrder, time: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Método</label>
                                        <select style={inp} value={editOrder.method} onChange={e => setEditOrder({ ...editOrder, method: e.target.value })}>
                                            <option value="retirada">Retirada</option>
                                            <option value="entrega">Entrega</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Total a Pagar (R$)</label>
                                        <input type="number" style={inp} value={editOrder.total} onChange={e => setEditOrder({ ...editOrder, total: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Forma de Pagamento</label>
                                        <select style={inp} value={editOrder.paymentMethod?.includes('Cartão') ? 'Cartão' : (editOrder.paymentMethod?.includes('PIX') ? 'PIX' : (normalizeText(editOrder.paymentMethod).toLowerCase().includes('dinheiro') ? 'Dinheiro' : editOrder.paymentMethod || ''))} onChange={e => {
                                            const newPaymentMethod = e.target.value;
                                            const currentInstallments = editOrder.cardInstallments || '1';
                                            const paymentLabel = newPaymentMethod === 'Cartão' ? `Cartão (${currentInstallments}x de R$ ${((editOrder.total || 0) / (1 + (CARD_INSTALLMENT_RATES[currentInstallments] || CARD_INSTALLMENT_RATES[1])) / Number(currentInstallments)).toFixed(2)})` : newPaymentMethod;
                                            setEditOrder({
                                                ...editOrder,
                                                paymentMethod: paymentLabel,
                                                cardInstallments: newPaymentMethod === 'Cartão' ? currentInstallments : '1',
                                                cashChangeFor: newPaymentMethod === 'Dinheiro' ? (editOrder.cashChangeFor || '') : ''
                                            });
                                        }}>
                                            <option value="">Selecione...</option>
                                            <option value="PIX">PIX</option>
                                            <option value="Dinheiro">Dinheiro</option>
                                            <option value="Cartão">Cartão de Crédito</option>
                                        </select>
                                    </div>
                                    {normalizeText(editOrder.paymentMethod).toLowerCase().includes('dinheiro') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Troco para quanto? (R$)</label>
                                            <input
                                                type="number"
                                                min={editOrder.total || 0}
                                                step="0.01"
                                                style={inp}
                                                value={editOrder.cashChangeFor || ''}
                                                onChange={e => setEditOrder({ ...editOrder, cashChangeFor: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    {editOrder.paymentMethod?.includes('Cartão') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Parcelas</label>
                                            <select style={inp} value={editOrder.cardInstallments || '1'} onChange={e => {
                                                const newInstallments = e.target.value;
                                                const baseTotal = editOrder.baseTotal || editOrder.total || 0;
                                                const installmentRate = CARD_INSTALLMENT_RATES[newInstallments] || CARD_INSTALLMENT_RATES[1];
                                                const totalWithCardFee = baseTotal * (1 + installmentRate);
                                                const installmentAmount = totalWithCardFee / Number(newInstallments);
                                                const paymentLabel = `Cartão (${newInstallments}x de R$ ${fmtBRL(installmentAmount)})`;
                                                setEditOrder({
                                                    ...editOrder,
                                                    cardInstallments: newInstallments,
                                                    paymentMethod: paymentLabel,
                                                    total: totalWithCardFee,
                                                    cardFeeRate: installmentRate,
                                                    cardFeeValue: totalWithCardFee - baseTotal
                                                });
                                            }}>
                                                <option value="1">1x (sem juros)</option>
                                                <option value="2">2x</option>
                                                <option value="3">3x</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Endereço</label>
                                    <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={editOrder.address} onChange={e => setEditOrder({ ...editOrder, address: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Observações do Pedido</label>
                                    <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} placeholder="Detalhes adicionais do pedido..." value={editOrder.observations || ''} onChange={e => setEditOrder({ ...editOrder, observations: e.target.value })} />
                                </div>
                                {editOrder.method === 'entrega' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Entregador</label>
                                        <select style={inp} value={editOrder.driverId || ''} onChange={e => {
                                            const d = activeDrivers.find(d => d.id === e.target.value);
                                            setEditOrder({ ...editOrder, driverId: e.target.value || null, driverName: d ? d.name : '' });
                                        }}>
                                            <option value="">Sem entregador designado</option>
                                            {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                                <button onClick={updateOrder} style={{ flex: 1, background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <i className="ph-bold ph-floppy-disk"></i> Salvar Pedido
                                </button>
                                <button onClick={() => {
                                    const returnTab = editOrder._returnTab;
                                    setEditOrder(null);
                                    if (returnTab) setTab(returnTab);
                                }} style={{ padding: '12px 20px', background: '#f1f5f9', color: 'var(--s500)', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 1: Fluxo de Pedidos */}
                {tab === 'orders' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-receipt" style={{ color: 'var(--gold)' }}></i> Fluxo de Pedidos ({filtered.length})
                                </h3>
                                <div style={{ fontSize: '11px', color: 'var(--s500)', fontWeight: '700' }}>
                                    Última atualização: {ordersLastSyncAt ? new Date(ordersLastSyncAt).toLocaleTimeString('pt-BR') : 'aguardando...'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '8px' }}>
                                    <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--s400)' }}></i>
                                    <input type="text" placeholder="Pesquisar cliente, telefone, item, categoria, status..." value={search} onChange={e => setSearch(e.target.value)}
                                        style={{ background: 'none', border: 'none', outline: 'none', fontSize: '14px', width: '260px' }} />
                                </div>
                            </div>
                            <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fcfcfd', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', padding: '7px 12px', background: ordersRealtimeHealth.bg, color: ordersRealtimeHealth.color, fontSize: '11px', fontWeight: '800' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '9999px', background: ordersRealtimeHealth.dot }}></span>
                                    {ordersRealtimeHealth.label}
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', padding: '7px 12px', background: '#eef2ff', color: '#3730a3', fontSize: '11px', fontWeight: '800' }}>
                                    Última impressão: {safeText(lastAutoPrintStatus.label)}
                                </div>
                                {ordersRealtimeRecentFailures > 0 && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '9999px', padding: '7px 12px', background: '#fff7ed', color: '#9a3412', fontSize: '11px', fontWeight: '800' }}>
                                        Falhas recentes no canal: {ordersRealtimeRecentFailures}
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', background: '#fafafa' }}>
                                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--s500)', letterSpacing: '.06em' }}>Pagamento:</span>
                                {[['all', 'Todos', 'var(--s600)', '#f1f5f9', '#cbd5e1'], ['paid', '✅ Pago Completo', '#166534', '#dcfce7', '#bbf7d0'], ['partial', '⚠️ Parcial', '#92400e', '#fef3c7', '#fde68a'], ['unpaid', '❌ Sem Pagamento', '#991b1b', '#fef2f2', '#fecaca']].map(([val, label, color, bg, border]) => (
                                    <button key={val} onClick={() => setOrderPaymentFilter(val)} style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', border: `1px solid ${orderPaymentFilter === val ? border : '#e2e8f0'}`, background: orderPaymentFilter === val ? bg : '#fff', color: orderPaymentFilter === val ? color : 'var(--s400)', cursor: 'pointer' }}>{label}</button>
                                ))}
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--s500)', letterSpacing: '.06em' }}>Categoria:</span>
                                    <select value={orderCategoryFilter} onChange={e => setOrderCategoryFilter(e.target.value)} style={{ ...inp, width: '210px', padding: '6px 10px', fontSize: '12px', borderRadius: '9999px' }}>
                                        <option value="all">Todas as categorias</option>
                                        {orderCategoryOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--s500)', letterSpacing: '.06em' }}>Campanha:</span>
                                    <select value={orderCampaignFilter} onChange={e => setOrderCampaignFilter(e.target.value)} style={{ ...inp, width: '200px', padding: '6px 10px', fontSize: '12px', borderRadius: '9999px' }}>
                                        <option value="all">Todas as campanhas</option>
                                        {campaignOptions.map(c => (
                                            <option key={c.id} value={c.id}>{c.nome}</option>
                                        ))}
                                    </select>
                                    {orderCampaignFilter === 'all' && typeof onLoadMoreOrders === 'function' && (
                                        <button
                                            onClick={onLoadMoreOrders}
                                            disabled={!ordersHasMore}
                                            style={{
                                                ...btn,
                                                padding: '6px 12px',
                                                fontSize: '11px',
                                                borderRadius: '9999px',
                                                background: ordersHasMore ? '#eef2ff' : '#e2e8f0',
                                                color: ordersHasMore ? '#3730a3' : '#64748b',
                                                cursor: ordersHasMore ? 'pointer' : 'not-allowed',
                                                opacity: ordersHasMore ? 1 : 0.7
                                            }}
                                            title={ordersHasMore ? 'Carregar mais pedidos históricos' : 'Todos os pedidos disponíveis já foram carregados para o recorte atual'}
                                        >
                                            Carregar +50 (atual: {ordersPageSize})
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
                                <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
                                    <thead style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                        <tr>
                                            {['Efetuado a', 'Cliente / Contato', 'Pedido (Itens)', 'Financeiro', 'Gestão', 'Ações'].map((h, i) => (
                                                <th key={i} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', textAlign: i >= 4 ? 'center' : 'left' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((o, idx) => {
                                            const isDup = dupSet.has(allOrders.findIndex(x => x.id === o.id));
                                            const _rowTotal = Number(o.total || 0);
                                            const _rowPaidRaw = Number(o.paidAmount);
                                            const _rowStatus = safeText(o.status, 'Novo');
                                            const _rowDefaultPaid = ['Pago', 'Pronto', 'Concluído'].includes(_rowStatus) ? _rowTotal : 0;
                                            const _rowPaid = Math.max(0, Math.min(_rowTotal, Number.isFinite(_rowPaidRaw) && _rowPaidRaw > 0 ? _rowPaidRaw : _rowDefaultPaid));
                                            const _rowPending = Math.max(0, _rowTotal - _rowPaid);
                                            const isPartiallyPaid = _rowPending > 0.005 && ['Pago', 'Pronto', 'Concluído'].includes(_rowStatus);
                                            const orderCategoryLabels = getOrderCategoryLabels(o);
                                            return (
                                                <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{formatDate(o.createdAt)}</span>
                                                        <span style={{ fontSize: '10px', color: 'var(--s400)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                            <i className="ph-fill ph-calendar-check" style={{ color: 'var(--gold)' }}></i> Agend.: {fmtAgendamento(o.date)} ({safeText(o.time, 'N/A')})
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem', position: 'relative' }}>
                                                        {isDup && <span style={{ position: 'absolute', left: '-4px', top: '1rem', width: '6px', height: '2rem', background: '#ef4444', borderRadius: '9999px' }}></span>}
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {safeText(o.customerName, 'Sem Nome')}
                                                            {isDup && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', fontWeight: '900' }}>Duplicado?</span>}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                            <i className="ph-bold ph-whatsapp-logo"></i> {safeText(o.customerPhone, 'N/A')}
                                                        </span>
                                                        <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--s500)', maxWidth: '200px', whiteSpace: 'normal' }}>
                                                            <span style={{
                                                                fontWeight: '700', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px',
                                                                background: o.method === 'entrega' ? '#ffedd5' : '#dbeafe',
                                                                color: o.method === 'entrega' ? '#c2410c' : '#1d4ed8'
                                                            }}>
                                                                {safeText(o.method, 'Retirada')}
                                                            </span>
                                                            {o.method === 'entrega' && (
                                                                o.driverId ? (
                                                                    <span style={{ fontWeight: '700', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px', marginLeft: '4px', background: '#ecfdf3', color: '#166534', border: '1px solid #bbf7d0' }}>
                                                                        🏍️ {safeText(o.driverName, 'Entregador')}
                                                                    </span>
                                                                ) : (
                                                                    <select value="" onChange={e => { if (e.target.value) assignDriver(o.id, e.target.value); }}
                                                                        style={{ fontSize: '9px', fontWeight: '700', padding: '2px 4px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--s500)', marginLeft: '4px', cursor: 'pointer', outline: 'none' }}>
                                                                        <option value="">+ Entregador</option>
                                                                        {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                                    </select>
                                                                )
                                                            )}
                                                            <br />
                                                            {safeText(o.address, 'Sem endereço')}
                                                            {o.observations && (
                                                                <div style={{ marginTop: '8px', padding: '4px 6px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                                                    <span style={{ fontWeight: '700', color: '#92400e', fontSize: '9px', display: 'block', marginBottom: '2px' }}>📝 OBS:</span>
                                                                    <span style={{ color: '#78350f', fontSize: '9px', lineHeight: '1.3' }}>{safeText(o.observations)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {(() => {
                                                            const badge = campaignBadgeStyle(normalizeCampaignId(o.campaignId, CAMPAIGN_LEGACY_ID));
                                                            return (
                                                                <span style={{ ...badge, fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '9999px', display: 'inline-block', marginBottom: '8px' }}>
                                                                    {getCampaignName(o.campaignId)}
                                                                </span>
                                                            );
                                                        })()}
                                                        {orderCategoryLabels.length > 0 && (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                                                                {orderCategoryLabels.map((categoryLabel) => (
                                                                    <span key={`${o.id}-cat-${categoryLabel}`} style={{ fontSize: '9px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '9999px', border: '1px solid #fde68a', fontWeight: '700' }}>
                                                                        [{categoryLabel}]
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '6rem', overflowY: 'auto' }} className="hide-scrollbar">
                                                            {Array.isArray(o.items) ? o.items.map((item, ii) => {
                                                                const itemCategoryLabel = getOrderItemCategoryLabel(item);
                                                                return (
                                                                    <span key={ii} style={{ fontSize: '10px', background: '#f1f5f9', color: 'var(--s600)', padding: '4px 8px', borderRadius: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <span>{Number(item?.qty || 1)}x {safeText(item?.name, 'Produto')}</span>
                                                                        {itemCategoryLabel && (
                                                                            <span style={{ fontSize: '9px', background: '#fff7ed', color: '#9a3412', padding: '1px 6px', borderRadius: '9999px', border: '1px solid #fed7aa', fontWeight: '700' }}>[{itemCategoryLabel}]</span>
                                                                        )}
                                                                    </span>
                                                                );
                                                            }) : <span style={{ fontSize: '10px', color: 'var(--s400)' }}>Sem itens</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '18px', display: 'block' }}>R$ {Number(o.total || 0).toFixed(2)}</span>
                                                        {(() => {
                                                            const total = Number(o.total || 0);
                                                            const paidRaw = Number(o.paidAmount);
                                                            const status = safeText(o.status, 'Novo');
                                                            const defaultPaid = ['Pago', 'Pronto', 'Concluído'].includes(status) ? total : 0;
                                                            const paid = Math.max(0, Math.min(total, Number.isFinite(paidRaw) && paidRaw > 0 ? paidRaw : defaultPaid));
                                                            const pending = Math.max(0, total - paid);
                                                            return (
                                                                <>
                                                                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: '700', display: 'block', marginTop: '2px' }}>
                                                                        Recebido: R$ {paid.toFixed(2)}
                                                                    </span>
                                                                    {pending > 0 && (
                                                                        <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700', display: 'block' }}>
                                                                            Pendente: R$ {pending.toFixed(2)}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                        <span style={{ fontSize: '9px', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: '700', display: 'block', marginTop: '4px' }}>
                                                            <i className="ph-bold ph-credit-card"></i> {safeText(o.paymentMethod, 'N/A')}
                                                        </span>
                                                        {normalizeText(o.paymentMethod).toLowerCase().includes('dinheiro') && Number(o.cashChangeFor) > 0 && (
                                                            <span style={{ fontSize: '9px', color: '#92400e', fontWeight: '700', display: 'block', marginTop: '3px' }}>
                                                                Troco para: R$ {Number(o.cashChangeFor).toFixed(2).replace('.', ',')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <select className="status-select" value={safeText(o.status, 'Novo')} onChange={e => updateStatus(o, e.target.value)}
                                                            style={{
                                                                fontSize: '11px', fontWeight: '700', padding: '6px 16px', borderRadius: '9999px', border: '1px solid', outline: 'none',
                                                                ...(isPartiallyPaid
                                                                    ? { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }
                                                                    : Object.fromEntries(statusColor(o.status || 'Novo').split(';').filter(Boolean).map(s => s.split(':').map(x => x.trim())))
                                                                )
                                                            }}>
                                                            <option value="Novo">🚨 NOVO</option>
                                                            <option value="Confirmado">💬 CONFIRMADO</option>
                                                            <option value="Pago">💰 PAGO</option>
                                                            <option value="Pronto">📦 PRONTO</option>
                                                            <option value="Concluído">✅ CONCLUÍDO</option>
                                                        </select>
                                                        {isPartiallyPaid && (
                                                            <span style={{ display: 'block', marginTop: '5px', fontSize: '9px', fontWeight: '800', color: '#c2410c', background: '#ffedd5', padding: '3px 8px', borderRadius: '9999px', border: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>
                                                                ⚠️ Pago Parcialmente
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <button onClick={() => handleManualReprint(o)} disabled={reprintBusyId === o.id}
                                                            style={{ background: 'none', border: 'none', cursor: reprintBusyId === o.id ? 'not-allowed' : 'pointer', color: reprintBusyId === o.id ? '#94a3b8' : '#16a34a', padding: '8px', borderRadius: '8px', lineHeight: 1, opacity: reprintBusyId === o.id ? 0.7 : 1 }}
                                                            title="Reimprimir Cupom">
                                                            <i className="ph-bold ph-printer" style={{ fontSize: '20px' }}></i>
                                                        </button>
                                                        <button onClick={() => setEditOrder({ ...o })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '8px', borderRadius: '8px', lineHeight: 1 }} title="Editar Pedido">
                                                            <i className="ph-bold ph-pencil-simple" style={{ fontSize: '20px' }}></i>
                                                        </button>
                                                        <button onClick={() => deleteOrder(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--s300)', padding: '8px', borderRadius: '8px', lineHeight: 1 }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--s300)'} title="Apagar Pedido">
                                                            <i className="ph-bold ph-trash" style={{ fontSize: '20px' }}></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filtered.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--s400)' }}>
                                        <i className="ph-fill ph-receipt" style={{ fontSize: '2.4rem', marginBottom: '10px', opacity: .35 }}></i>
                                        <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '6px' }}>Nenhum pedido encontrado.</p>
                                        <p style={{ fontSize: '12px', lineHeight: 1.6 }}>
                                            {orderCampaignFilter === 'all'
                                                ? 'Não há pedidos no recorte atual. Revise os filtros de pagamento e busca para localizar registros.'
                                                : `Não há pedidos para a campanha ${getCampaignName(orderCampaignFilter)} com os filtros atuais.`}
                                        </p>
                                        {(orderPaymentFilter !== 'all' || orderCategoryFilter !== 'all' || safeText(search).trim() || orderCampaignFilter !== 'all') && (
                                            <button
                                                onClick={() => {
                                                    setOrderPaymentFilter('all');
                                                    setOrderCategoryFilter('all');
                                                    setSearch('');
                                                    setOrderCampaignFilter('all');
                                                }}
                                                style={{ marginTop: '12px', border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                                Limpar filtros de pedidos
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'agenda' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                <div>
                                    <h3 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <i className="ph-bold ph-calendar-plus" style={{ color: 'var(--gold)' }}></i> Cadastro Manual
                                    </h3>
                                    <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.5 }}>
                                        Crie pedidos, lembretes e agendamentos internos com data, horário, detalhes e aviso local no navegador.
                                    </p>
                                </div>
                                <button onClick={requestScheduleNotificationPermission} style={{ border: '1px solid #cbd5e1', background: notificationPermission === 'granted' ? '#dcfce7' : '#fff', color: notificationPermission === 'granted' ? '#166534' : 'var(--s600)', padding: '10px 14px', borderRadius: '9999px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {notificationPermission === 'granted' ? 'Notificações ativas' : 'Ativar avisos'}
                                </button>
                            </div>

                            <div style={{ padding: '12px 14px', borderRadius: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s500)', marginBottom: '4px' }}>Como funciona</p>
                                <p style={{ fontSize: '12px', color: 'var(--s600)', lineHeight: 1.5 }}>
                                    O aviso dispara quando chega a data e o horário marcados, desde que o painel admin esteja aberto neste navegador. Se a permissão do sistema estiver ativa, o aviso sai como notificação do navegador.
                                </p>
                                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    <button onClick={() => setScheduleAlertSettings(prev => ({ ...prev, soundEnabled: !(prev.soundEnabled !== false) }))}
                                        style={{ border: '1px solid #e2e8f0', background: scheduleAlertSettings.soundEnabled !== false ? '#ecfdf5' : '#fff', color: scheduleAlertSettings.soundEnabled !== false ? '#166534' : 'var(--s600)', padding: '8px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                                        {scheduleAlertSettings.soundEnabled !== false ? 'Som de alerta ativo' : 'Ativar som de alerta'}
                                    </button>
                                    <button onClick={testScheduleAlertSound}
                                        style={{ border: '1px solid #e2e8f0', background: '#fff', color: 'var(--s600)', padding: '8px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                                        Testar som agora
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Campanha</label>
                                    <select style={inp} value={scheduleForm.campaignId} onChange={e => setScheduleForm(prev => ({ ...prev, campaignId: e.target.value }))}>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Título</label>
                                    <input style={inp} value={scheduleForm.title} placeholder="Ex.: Pedido brownie da Ana" onChange={e => setScheduleForm(prev => ({ ...prev, title: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Categoria</label>
                                    <select style={inp} value={scheduleForm.category} onChange={e => setScheduleForm(prev => ({ ...prev, category: e.target.value }))}>
                                        {ADMIN_SCHEDULE_CATEGORIES.map(option => <option key={option.k} value={option.k}>{option.l}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Cliente</label>
                                    <input style={inp} value={scheduleForm.customerName} placeholder="Nome do cliente" onChange={e => setScheduleForm(prev => ({ ...prev, customerName: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>WhatsApp</label>
                                    <input style={inp} value={scheduleForm.customerPhone} placeholder="(88) 99999-9999" onChange={e => setScheduleForm(prev => ({ ...prev, customerPhone: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Data</label>
                                    <input type="date" style={inp} value={scheduleForm.date} onChange={e => setScheduleForm(prev => ({ ...prev, date: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Horário</label>
                                    <input type="time" style={inp} value={scheduleForm.time} onChange={e => setScheduleForm(prev => ({ ...prev, time: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Entrega / Retirada</label>
                                    <select style={inp} value={scheduleForm.method} onChange={e => setScheduleForm(prev => ({ ...prev, method: e.target.value }))}>
                                        <option value="retirada">Retirada</option>
                                        <option value="entrega">Entrega</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Pagamento</label>
                                    <input style={inp} value={scheduleForm.paymentMethod} placeholder="Ex.: PIX, Cartão, A combinar" onChange={e => setScheduleForm(prev => ({ ...prev, paymentMethod: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Valor (opcional)</label>
                                    <input type="number" min="0" step="0.01" style={inp} value={scheduleForm.total} placeholder="0,00" onChange={e => setScheduleForm(prev => ({ ...prev, total: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Status</label>
                                    <select style={inp} value={scheduleForm.status} onChange={e => setScheduleForm(prev => ({ ...prev, status: e.target.value }))}>
                                        {ADMIN_SCHEDULE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Endereço / Referência</label>
                                <textarea style={{ ...inp, minHeight: '72px', resize: 'vertical' }} value={scheduleForm.address} placeholder="Rua, bairro, ponto de referência ou observação de retirada" onChange={e => setScheduleForm(prev => ({ ...prev, address: e.target.value }))} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Detalhes</label>
                                <textarea style={{ ...inp, minHeight: '120px', resize: 'vertical' }} value={scheduleForm.details} placeholder="Itens, observações, endereço, referência, combinação com o cliente..." onChange={e => setScheduleForm(prev => ({ ...prev, details: e.target.value }))} />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '1rem', background: '#fffbeb', border: '1px solid #fde68a', cursor: 'pointer' }}>
                                <input type="checkbox" checked={scheduleForm.notificationEnabled !== false} onChange={e => setScheduleForm(prev => ({ ...prev, notificationEnabled: e.target.checked }))} />
                                <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '700' }}>Receber aviso local neste navegador ao chegar o horário marcado</span>
                            </label>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button onClick={saveAdminSchedule} disabled={scheduleSaving} style={{ flex: 1, minWidth: '180px', border: 'none', background: 'var(--primary)', color: 'var(--cream)', padding: '14px 18px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', opacity: scheduleSaving ? .7 : 1 }}>
                                    {scheduleSaving ? 'Salvando...' : (scheduleForm.id ? 'Atualizar agendamento' : 'Criar agendamento')}
                                </button>
                                <button onClick={resetScheduleForm} style={{ minWidth: '140px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--s600)', padding: '14px 18px', borderRadius: '14px', fontWeight: '800', cursor: 'pointer' }}>
                                    Limpar
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: '#166534', marginBottom: '6px' }}>Hoje</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: '#16a34a' }}>{adminScheduleStats.today}</p>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: '#b91c1c', marginBottom: '6px' }}>Atrasados</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: '#dc2626' }}>{adminScheduleStats.late}</p>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: '6px' }}>Próximos 7 dias</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: '#2563eb' }}>{adminScheduleStats.next7}</p>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>Fechados</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: '#64748b' }}>{adminScheduleStats.done}</p>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '.08em', textTransform: 'uppercase', color: '#4338ca', marginBottom: '6px' }}>Sem Pedido</p>
                                    <p style={{ fontSize: '2rem', fontWeight: '900', color: '#4f46e5' }}>{adminScheduleStats.unlinked}</p>
                                </div>
                            </div>

                            <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <i className="ph-bold ph-calendar-check" style={{ color: 'var(--gold)' }}></i> Agenda Manual ({filteredAdminSchedules.length})
                                        </h3>
                                        <p style={{ fontSize: '12px', color: 'var(--s500)' }}>Pedidos manuais, retornos e compromissos internos agendados.</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '12px', fontWeight: '700', color: 'var(--s600)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisibleSchedules} />
                                            Selecionar visíveis
                                        </label>
                                        <button onClick={clearSelectedSchedules} disabled={!hasSelectedSchedules}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--s600)', fontWeight: '800', cursor: hasSelectedSchedules ? 'pointer' : 'not-allowed', opacity: hasSelectedSchedules ? 1 : .65 }}>
                                            Limpar seleção
                                        </button>
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '8px' }}>
                                            <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--s400)' }}></i>
                                            <input type="text" placeholder="Buscar título, cliente, status, campanha..." value={scheduleSearch} onChange={e => setScheduleSearch(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', fontSize: '14px', width: '220px' }} />
                                        </div>
                                        <select value={scheduleFilter} onChange={e => setScheduleFilter(e.target.value)} style={{ ...inp, width: '200px' }}>
                                            <option value="all">Todos</option>
                                            <option value="open">Em aberto</option>
                                            <option value="unlinked">Sem pedido gerado</option>
                                            <option value="today">Hoje</option>
                                            <option value="upcoming">Próximos</option>
                                            <option value="late">Atrasados</option>
                                            <option value="done">Concluídos / Cancelados</option>
                                        </select>
                                        <select value={scheduleCampaignFilter} onChange={e => setScheduleCampaignFilter(e.target.value)} style={{ ...inp, width: '220px' }}>
                                            <option value="all">Todas as campanhas</option>
                                            {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                        </select>
                                        <button onClick={createManualOrdersInBulk} disabled={scheduleBulkLoading || bulkCreatableCount === 0}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #bfdbfe', background: scheduleBulkLoading ? '#dbeafe' : '#eff6ff', color: '#1d4ed8', fontWeight: '800', cursor: (scheduleBulkLoading || bulkCreatableCount === 0) ? 'not-allowed' : 'pointer', opacity: (scheduleBulkLoading || bulkCreatableCount === 0) ? .65 : 1 }}>
                                            {scheduleBulkLoading ? 'Gerando...' : `Gerar em lote (${bulkCreatableCount})`}
                                        </button>
                                        <select value={scheduleBulkStatus} onChange={e => setScheduleBulkStatus(e.target.value)} style={{ ...inp, width: '190px' }}>
                                            {ADMIN_SCHEDULE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                                        </select>
                                        <button onClick={updateSchedulesStatusInBulk} disabled={scheduleBulkLoading || filteredAdminSchedules.length === 0}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #ddd6fe', background: scheduleBulkLoading ? '#ede9fe' : '#f5f3ff', color: '#5b21b6', fontWeight: '800', cursor: (scheduleBulkLoading || filteredAdminSchedules.length === 0) ? 'not-allowed' : 'pointer', opacity: (scheduleBulkLoading || filteredAdminSchedules.length === 0) ? .65 : 1 }}>
                                            Status em lote
                                        </button>
                                        <button onClick={exportFilteredSchedulesCsv} disabled={filteredAdminSchedules.length === 0}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #bae6fd', background: '#ecfeff', color: '#0e7490', fontWeight: '800', cursor: filteredAdminSchedules.length === 0 ? 'not-allowed' : 'pointer', opacity: filteredAdminSchedules.length === 0 ? .65 : 1 }}>
                                            Exportar CSV
                                        </button>
                                        <button onClick={copyBulkScheduleWhatsappMessages} disabled={bulkWhatsappReadyCount === 0}
                                            style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#166534', fontWeight: '800', cursor: bulkWhatsappReadyCount === 0 ? 'not-allowed' : 'pointer', opacity: bulkWhatsappReadyCount === 0 ? .65 : 1 }}>
                                            WhatsApp em lote ({bulkWhatsappReadyCount})
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filteredAdminSchedules.map(item => {
                                        const badgeStyle = adminScheduleStatusColor(item.status);
                                        const waPhone = formatPhoneForWhatsApp(item.customerPhone);
                                        const isSelected = selectedScheduleSet.has(item.id);
                                        return (
                                            <div key={item.id} style={{ border: isSelected ? '2px solid #93c5fd' : '1px solid #e2e8f0', borderLeft: `6px solid ${badgeStyle.borderColor}`, borderRadius: '1rem', padding: '1rem 1.1rem', background: item.daysUntil !== null && item.daysUntil < 0 && !item.isClosed ? '#fff7f7' : '#fff' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '9999px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e40af', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isSelected} onChange={() => toggleScheduleSelection(item.id)} />
                                                                Selecionar
                                                            </label>
                                                            <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>{item.title || 'Agendamento sem título'}</h4>
                                                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', border: `1px solid ${badgeStyle.borderColor}`, background: badgeStyle.background, color: badgeStyle.color }}>{item.status}</span>
                                                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: '#f8fafc', color: 'var(--s500)', border: '1px solid #e2e8f0' }}>{adminScheduleCategoryLabel(item.category)}</span>
                                                            {(() => {
                                                                const badge = campaignBadgeStyle(normalizeCampaignId(item.campaignId, CAMPAIGN_LEGACY_ID));
                                                                return <span style={{ ...badge, fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px' }}>{getCampaignName(item.campaignId)}</span>;
                                                            })()}
                                                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: item.method === 'entrega' ? '#ffedd5' : '#dbeafe', color: item.method === 'entrega' ? '#c2410c' : '#1d4ed8', border: '1px solid #e2e8f0' }}>{item.method === 'entrega' ? 'Entrega' : 'Retirada'}</span>
                                                            {item.notificationEnabled !== false && (
                                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: '#ecfeff', color: '#155e75', border: '1px solid #a5f3fc' }}>Aviso ativo</span>
                                                            )}
                                                            {item.linkedOrderId && (
                                                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>No fluxo de pedidos</span>
                                                            )}
                                                        </div>
                                                        <p style={{ fontSize: '13px', color: 'var(--s600)', lineHeight: 1.5 }}>
                                                            {formatDateOnlyForDisplay(item.date)} às {item.time}
                                                            {item.daysUntil === 0
                                                                ? ' • hoje'
                                                                : item.daysUntil === 1
                                                                    ? ' • amanhã'
                                                                    : item.daysUntil !== null && item.daysUntil > 1
                                                                        ? ` • em ${item.daysUntil} dia(s)`
                                                                        : ''}
                                                            {item.daysUntil !== null && item.daysUntil < 0 && !item.isClosed ? ` • atrasado há ${Math.abs(item.daysUntil)} dia(s)` : ''}
                                                        </p>
                                                    </div>
                                                    {item.total > 0 && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <p style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '4px' }}>Valor</p>
                                                            <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--gold)' }}>R$ {fmtBRL(item.total)}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '10px' }}>
                                                    <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '4px' }}>Cliente</p>
                                                        <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)' }}>{item.customerName || 'Não informado'}</p>
                                                        <p style={{ fontSize: '12px', color: 'var(--s500)', marginTop: '2px' }}>{item.customerPhone || 'Sem WhatsApp'}</p>
                                                    </div>
                                                    <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '4px' }}>Detalhes</p>
                                                        <p style={{ fontSize: '13px', color: 'var(--s600)', lineHeight: 1.5 }}>{item.details || 'Sem detalhes adicionais.'}</p>
                                                    </div>
                                                    <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <p style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '4px' }}>Operação</p>
                                                        <p style={{ fontSize: '13px', color: 'var(--s600)', lineHeight: 1.5 }}>{item.address || 'Sem endereço / referência'}</p>
                                                        <p style={{ fontSize: '12px', color: 'var(--s500)', marginTop: '6px' }}>Pagamento: {item.paymentMethod || 'A combinar'}</p>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <select value={item.status} onChange={e => updateAdminScheduleStatus(item, e.target.value)} style={{ ...inp, width: '190px' }}>
                                                            {ADMIN_SCHEDULE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                                                        </select>
                                                        <button onClick={() => createManualOrderFromSchedule(item)} style={{ padding: '12px 14px', borderRadius: '12px', background: item.linkedOrderId ? '#eef2ff' : '#eff6ff', color: item.linkedOrderId ? '#4338ca' : '#1d4ed8', border: item.linkedOrderId ? '1px solid #c7d2fe' : '1px solid #bfdbfe', fontWeight: '800', cursor: 'pointer' }}>
                                                            {item.linkedOrderId ? 'Abrir pedido' : 'Gerar pedido'}
                                                        </button>
                                                        {waPhone && (
                                                            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" style={{ padding: '12px 14px', borderRadius: '12px', background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0', fontWeight: '800' }}>
                                                                WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <button onClick={() => editAdminSchedule(item)} style={{ padding: '12px 14px', borderRadius: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: '800', cursor: 'pointer' }}>Editar</button>
                                                        <button onClick={() => deleteAdminSchedule(item.id)} style={{ padding: '12px 14px', borderRadius: '12px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: '800', cursor: 'pointer' }}>Excluir</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredAdminSchedules.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--s400)' }}>
                                            Nenhum agendamento encontrado para o filtro atual.
                                        </div>
                                    )}

                                    {filteredAdminSchedules.length > 0 && (
                                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--s500)', fontWeight: '700' }}>
                                            Ações em lote estão a atuar em: {bulkTargetLabel}.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 2: PRÓXIMAS ENTREGAS */}
                {tab === 'deliveries' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Filtros de Tempo e Status */}
                            <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-truck" style={{ color: 'var(--gold)' }}></i> Filtros de Entrega
                            </h3>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Campanha</label>
                                    <select value={deliveryCampaignFilter} onChange={e => setDeliveryCampaignFilter(e.target.value)} style={{ ...inp, width: '220px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todas as campanhas</option>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Período</label>
                                    <select value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todos os pedidos</option>
                                        <option value="today">Hoje</option>
                                        <option value="tomorrow">Amanhã</option>
                                        <option value="next3days">Próximos 3 dias</option>
                                        <option value="nextweek">Próxima semana</option>
                                        <option value="overdue">Atrasados</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Status</label>
                                    <select value={deliveryStatusFilter} onChange={e => setDeliveryStatusFilter(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="pending">Pendentes</option>
                                        <option value="completed">Concluídos</option>
                                        <option value="all">Todos</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Ordenar por</label>
                                    <select value={deliverySort} onChange={e => setDeliverySort(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="priority">Prioridade</option>
                                        <option value="date">Data/Hora</option>
                                        <option value="customer">Cliente</option>
                                        <option value="value">Valor</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Pagamento</label>
                                    <select value={deliveryPaymentFilter} onChange={e => setDeliveryPaymentFilter(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todos</option>
                                        <option value="paid">✅ Pago Completo</option>
                                        <option value="partial">⚠️ Pago Parcial</option>
                                        <option value="unpaid">❌ Sem Pagamento</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Entregador</label>
                                    <select value={deliveryDriverFilter} onChange={e => setDeliveryDriverFilter(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todos</option>
                                        <option value="unassigned">Sem entregador</option>
                                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Buscar</label>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '6px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', gap: '6px', width: '220px' }}>
                                        <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--s400)', fontSize: '14px' }}></i>
                                        <input type="text" placeholder="Cliente, item, status, endereço, campanha..." value={deliverySearch} onChange={e => setDeliverySearch(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', width: '100%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resumo Rápido */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem' }}>
                            <div style={{ background: '#fef2f2', border: `1px solid ${isOverdueCardActive ? '#ef4444' : '#fecaca'}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(239,68,68,.05)', cursor: 'pointer' }} onClick={() => {
                                if (isOverdueCardActive) {
                                    setDeliveryFilter('all');
                                    setDeliveryStatusFilter('pending');
                                    return;
                                }
                                setDeliveryStatusFilter('pending');
                                setDeliveryFilter('overdue');
                            }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#991b1b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph-bold ph-warning-circle" style={{ fontSize: '16px' }}></i> Atrasados
                                </p>
                                <p style={{ fontSize: '2rem', fontWeight: '900', color: '#dc2626', lineHeight: 1 }}>{overdueDeliveries.length}</p>
                                <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '8px', opacity: .8 }}>{isOverdueCardActive ? 'Clique para limpar filtro' : 'Clique para filtrar'}</p>
                            </div>
                            <div style={{ background: '#f0fdf4', border: `1px solid ${isTodayCardActive ? '#16a34a' : '#bbf7d0'}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(34,197,94,.05)', cursor: 'pointer' }} onClick={() => {
                                if (isTodayCardActive) {
                                    setDeliveryFilter('all');
                                    setDeliveryStatusFilter('pending');
                                    return;
                                }
                                setDeliveryStatusFilter('pending');
                                setDeliveryFilter('today');
                            }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#166534', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph-bold ph-clock" style={{ fontSize: '16px' }}></i> Hoje
                                </p>
                                <p style={{ fontSize: '2rem', fontWeight: '900', color: '#16a34a', lineHeight: 1 }}>{todayDeliveries.length}</p>
                                <p style={{ fontSize: '11px', color: '#166534', marginTop: '8px', opacity: .8 }}>{isTodayCardActive ? 'Clique para limpar filtro' : 'Clique para filtrar'}</p>
                            </div>
                            <div style={{ background: '#eff6ff', border: `1px solid ${isWeekCardActive ? '#2563eb' : '#bfdbfe'}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(59,130,246,.05)', cursor: 'pointer' }} onClick={() => {
                                if (isWeekCardActive) {
                                    setDeliveryFilter('all');
                                    setDeliveryStatusFilter('pending');
                                    return;
                                }
                                setDeliveryStatusFilter('pending');
                                setDeliveryFilter('nextweek');
                            }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph-bold ph-calendar-check" style={{ fontSize: '16px' }}></i> Próximos 7 dias
                                </p>
                                <p style={{ fontSize: '2rem', fontWeight: '900', color: '#2563eb', lineHeight: 1 }}>{weekDeliveries.length}</p>
                                <p style={{ fontSize: '11px', color: '#1e40af', marginTop: '8px', opacity: .8 }}>{isWeekCardActive ? 'Clique para limpar filtro' : 'Clique para filtrar'}</p>
                            </div>
                            <div style={{ background: '#f9fafb', border: `1px solid ${isCompletedCardActive ? '#6b7280' : '#e5e7eb'}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(107,114,128,.05)', cursor: 'pointer' }} onClick={() => {
                                if (isCompletedCardActive) {
                                    setDeliveryStatusFilter('pending');
                                    setDeliveryFilter('all');
                                    return;
                                }
                                setDeliveryStatusFilter('completed');
                                setDeliveryFilter('all');
                            }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#374151', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph-bold ph-check-circle" style={{ fontSize: '16px' }}></i> Concluídos
                                </p>
                                <p style={{ fontSize: '2rem', fontWeight: '900', color: '#6b7280', lineHeight: 1 }}>{completedDeliveries.length}</p>
                                <p style={{ fontSize: '11px', color: '#374151', marginTop: '8px', opacity: .8 }}>{isCompletedCardActive ? 'Clique para limpar filtro' : 'Clique para filtrar'}</p>
                            </div>
                            <div style={{ background: '#fdf4ff', border: `1px solid ${isUnpaidCardActive ? '#7c3aed' : '#e9d5ff'}`, borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(168,85,247,.05)', cursor: 'pointer' }} onClick={() => setDeliveryPaymentFilter(isUnpaidCardActive ? 'all' : 'unpaid')}>
                                <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#6b21a8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="ph-bold ph-money" style={{ fontSize: '16px' }}></i> Aguardando Pgto.
                                </p>
                                <p style={{ fontSize: '2rem', fontWeight: '900', color: unpaidDeliveries.length > 0 ? '#7c3aed' : '#6b7280', lineHeight: 1 }}>{unpaidDeliveries.length}</p>
                                <p style={{ fontSize: '11px', color: '#6b21a8', marginTop: '8px', opacity: .8 }}>Clique para {isUnpaidCardActive ? 'limpar filtro' : 'filtrar'}</p>
                            </div>
                        </div>

                        {/* Lista de Entregas */}
                    <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-truck" style={{ color: 'var(--gold)' }}></i> Entregas ({filteredDeliveries.length})
                            </h3>
                            {(deliveryFilter !== 'all' || deliveryStatusFilter !== 'pending' || deliveryPaymentFilter !== 'all' || deliveryCampaignFilter !== (activeCampaignId || CAMPAIGN_GENERAL_ID) || deliverySearch || deliveryDriverFilter !== 'all') && (
                                <button onClick={() => { setDeliveryFilter('all'); setDeliveryStatusFilter('pending'); setDeliveryPaymentFilter('all'); setDeliveryCampaignFilter(activeCampaignId || CAMPAIGN_GENERAL_ID); setDeliverySearch(''); setDeliveryDriverFilter('all'); }}
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '6px 12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}>
                                    Limpar filtros
                                </button>
                            )}
                        </div>
                        <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
                            <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap', borderCollapse: 'collapse' }}>
                                <thead style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                    <tr>
                                        {['Entrega / Prioridade', 'Cliente / Contato', 'Pedido (Itens)', 'Financeiro', 'Status', 'Ações'].map((h, i) => (
                                            <th key={i} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', textAlign: i >= 4 ? 'center' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDeliveries.map((o) => {
                                        const priority = getDeliveryPriority(o);
                                        const _rowTotal = Number(o.total || 0);
                                        const _rowPaidRaw = Number(o.paidAmount);
                                        const _rowStatus = safeText(o.status, 'Novo');
                                        const _rowDefaultPaid = ['Pago', 'Pronto', 'Concluído'].includes(_rowStatus) ? _rowTotal : 0;
                                        const _rowPaid = Math.max(0, Math.min(_rowTotal, Number.isFinite(_rowPaidRaw) && _rowPaidRaw > 0 ? _rowPaidRaw : _rowDefaultPaid));
                                        const _rowPending = Math.max(0, _rowTotal - _rowPaid);
                                        const isPartiallyPaid = _rowPending > 0.005 && ['Pago', 'Pronto', 'Concluído'].includes(_rowStatus);
                                        return (
                                            <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{fmtAgendamento(o.date)}</span>
                                                    <span style={{ fontSize: '10px', color: 'var(--s400)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                        <i className="ph-bold ph-clock" style={{ fontSize: '12px' }}></i> {safeText(o.time, 'N/A')}h
                                                    </span>
                                                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '9px', fontWeight: '800', padding: '3px 8px', borderRadius: '9999px', background: `${priority.color}15`, color: priority.color, border: `1px solid ${priority.color}40` }}>
                                                        {priority.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{safeText(o.customerName, 'Sem Nome')}</span>
                                                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                        <i className="ph-bold ph-whatsapp-logo"></i> {safeText(o.customerPhone, 'N/A')}
                                                    </span>
                                                    <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--s500)', maxWidth: '200px', whiteSpace: 'normal' }}>
                                                        <span style={{
                                                            fontWeight: '700', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px',
                                                            background: o.method === 'entrega' ? '#ffedd5' : '#dbeafe',
                                                            color: o.method === 'entrega' ? '#c2410c' : '#1d4ed8'
                                                        }}>
                                                            {safeText(o.method, 'Retirada')}
                                                        </span>
                                                        {o.method === 'entrega' && (
                                                            o.driverId ? (
                                                                <span style={{ fontWeight: '700', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px', marginLeft: '4px', background: '#ecfdf3', color: '#166534', border: '1px solid #bbf7d0' }}>
                                                                    🏍️ {safeText(o.driverName, 'Entregador')}
                                                                </span>
                                                            ) : (
                                                                <select value="" onChange={e => { if (e.target.value) assignDriver(o.id, e.target.value); }}
                                                                    style={{ fontSize: '9px', fontWeight: '700', padding: '2px 4px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--s500)', marginLeft: '4px', cursor: 'pointer', outline: 'none' }}>
                                                                    <option value="">+ Entregador</option>
                                                                    {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                                </select>
                                                            )
                                                        )}
                                                        <br />
                                                        {safeText(o.address, 'Sem endereço')}
                                                        {o.observations && (
                                                            <div style={{ marginTop: '6px', padding: '4px 6px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                                                <span style={{ fontWeight: '700', color: '#92400e', fontSize: '9px', display: 'block', marginBottom: '2px' }}>OBS:</span>
                                                                <span style={{ color: '#78350f', fontSize: '9px', lineHeight: '1.3' }}>{safeText(o.observations)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {(() => {
                                                        const badge = campaignBadgeStyle(normalizeCampaignId(o.campaignId, CAMPAIGN_LEGACY_ID));
                                                        return (
                                                            <span style={{ ...badge, fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '9999px', display: 'inline-block', marginBottom: '8px' }}>
                                                                {getCampaignName(o.campaignId)}
                                                            </span>
                                                        );
                                                    })()}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '6rem', overflowY: 'auto' }} className="hide-scrollbar">
                                                        {Array.isArray(o.items) ? o.items.map((item, ii) => (
                                                            <span key={ii} style={{ fontSize: '10px', background: '#f1f5f9', color: 'var(--s600)', padding: '4px 8px', borderRadius: '6px', fontWeight: '500' }}>
                                                                {Number(item?.qty || 1)}x {safeText(item?.name, 'Produto')}
                                                            </span>
                                                        )) : <span style={{ fontSize: '10px', color: 'var(--s400)' }}>Sem itens</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ color: 'var(--gold)', fontWeight: '700', fontSize: '18px', display: 'block' }}>R$ {_rowTotal.toFixed(2)}</span>
                                                    <span style={{ fontSize: '10px', color: '#059669', fontWeight: '700', display: 'block', marginTop: '2px' }}>
                                                        Recebido: R$ {_rowPaid.toFixed(2)}
                                                    </span>
                                                    {_rowPending > 0 && (
                                                        <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700', display: 'block' }}>
                                                            Pendente: R$ {_rowPending.toFixed(2)}
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: '9px', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: '700', display: 'block', marginTop: '4px' }}>
                                                        <i className="ph-bold ph-credit-card"></i> {safeText(o.paymentMethod, 'N/A')}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <select className="status-select" value={safeText(o.status, 'Novo')} onChange={e => updateStatus(o, e.target.value)}
                                                        style={{
                                                            fontSize: '11px', fontWeight: '700', padding: '6px 16px', borderRadius: '9999px', border: '1px solid', outline: 'none',
                                                            ...(isPartiallyPaid
                                                                ? { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }
                                                                : Object.fromEntries(statusColor(o.status || 'Novo').split(';').filter(Boolean).map(s => s.split(':').map(x => x.trim())))
                                                            )
                                                        }}>
                                                        <option value="Novo">NOVO</option>
                                                        <option value="Confirmado">CONFIRMADO</option>
                                                        <option value="Pago">PAGO</option>
                                                        <option value="Pronto">PRONTO</option>
                                                        <option value="Concluído">CONCLUÍDO</option>
                                                    </select>
                                                    {isPartiallyPaid && (
                                                        <span style={{ display: 'block', marginTop: '5px', fontSize: '9px', fontWeight: '800', color: '#c2410c', background: '#ffedd5', padding: '3px 8px', borderRadius: '9999px', border: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>
                                                            Pago Parcialmente
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button onClick={() => handleManualReprint(o)} disabled={reprintBusyId === o.id}
                                                        style={{ background: 'none', border: 'none', cursor: reprintBusyId === o.id ? 'not-allowed' : 'pointer', color: reprintBusyId === o.id ? '#94a3b8' : '#16a34a', padding: '8px', borderRadius: '8px', lineHeight: 1, opacity: reprintBusyId === o.id ? 0.7 : 1 }}
                                                        title="Reimprimir Cupom">
                                                        <i className="ph-bold ph-printer" style={{ fontSize: '20px' }}></i>
                                                    </button>
                                                    <button onClick={() => setEditOrder({ ...o })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '8px', borderRadius: '8px', lineHeight: 1 }} title="Editar Pedido">
                                                        <i className="ph-bold ph-pencil-simple" style={{ fontSize: '20px' }}></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredDeliveries.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--s400)' }}>
                                    <i className="ph-fill ph-truck" style={{ fontSize: '2.4rem', marginBottom: '10px', opacity: .35 }}></i>
                                    <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '6px' }}>Nenhuma entrega encontrada.</p>
                                    <p style={{ fontSize: '12px', lineHeight: 1.6 }}>
                                        Revise os filtros de campanha, período, status e pagamento para localizar registros.
                                    </p>
                                    <button
                                        onClick={() => { setDeliveryFilter('all'); setDeliveryStatusFilter('pending'); setDeliveryPaymentFilter('all'); setDeliveryCampaignFilter('all'); setDeliverySearch(''); setDeliveryDriverFilter('all'); }}
                                        style={{ marginTop: '12px', border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                        Limpar todos os filtros
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                )}

                {/* ABA ENTREGADORES */}
                {tab === 'drivers' && <DriversTab allOrders={normalizedOrders} campaigns={campaignOptions} />}

                {/* ABA FINANCEIRO */}
                {tab === 'finance' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Filtros de Período e Campanha */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-funnel" style={{ color: 'var(--gold)' }}></i> Filtros
                            </h3>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Campanha</label>
                                    <select value={financeCampaignFilter} onChange={e => setFinanceCampaignFilter(e.target.value)} style={{ ...inp, width: '220px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todas as campanhas</option>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Mês</label>
                                    <select value={finMonth} onChange={e => setFinMonth(e.target.value)} style={{ ...inp, width: '180px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="all">Todos os meses</option>
                                        {(financialStats.availableMonths || []).map(m => <option key={m} value={m}>{m.split('-')[1]}/{m.split('-')[0]}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Dia</label>
                                    <select value={finDay} onChange={e => setFinDay(e.target.value)} style={{ ...inp, width: '100px', background: '#fff', border: '1px solid #cbd5e1' }}>
                                        <option value="">Todos</option>
                                        {(financialStats.availableDays || []).map(d => <option key={d} value={d}>Dia {d}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginLeft: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', color: 'var(--s600)' }}>
                                    {financialStats.periodLabel}
                                </div>
                            </div>
                        </div>

                        {/* Cards de Resumo de Pedidos */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '10px' }}>
                            <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#14532d', fontWeight: '700' }}>Recebido Real (sem frete/juros)</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: '#15803d' }}>R$ {(financialStats.totalRecebido || 0).toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9a3412', fontWeight: '700' }}>Pendente Real</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: '#c2410c' }}>R$ {(financialStats.totalPendente || 0).toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#1e40af', fontWeight: '700' }}>Bruto Real (sem frete/juros)</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: '#1d4ed8' }}>R$ {(financialStats.totalBruto || 0).toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '700' }}>Qtd Pedidos</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--primary)' }}>{financialStats.ordersCount || 0}</p>
                            </div>
                        </div>

                        {/* Pedidos Pendentes de Pagamento */}
                        {financePendingOrders.length > 0 && (
                            <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                <h3 style={{ fontWeight: '700', color: '#c2410c', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px', background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                                    <i className="ph-bold ph-clock-countdown" style={{ color: '#ea580c' }}></i> Pedidos Pendentes ({financePendingOrders.length})
                                </h3>
                                <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '700px' }}>
                                        <thead style={{ background: '#f8fafc' }}>
                                            <tr>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Cliente</th>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Data</th>
                                                <th style={{ padding: '8px', textAlign: 'right' }}>Pendente Real</th>
                                                <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {financePendingOrders.slice(0, 10).map(order => (
                                                <tr key={order.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{order.customerName || '-'}</td>
                                                    <td style={{ padding: '8px' }}>{formatDateStr(order.deliveryDate || order.createdAt)}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900' }}>R$ {(Number(order._pending) || 0).toFixed(2).replace('.', ',')}</td>
                                                    <td style={{ padding: '8px', textAlign: 'center' }}><span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: '#fff7ed', color: '#9a3412' }}>{safeText(order.status)}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ph-bold ph-chart-line-up" style={{ color: 'var(--gold)', fontSize: '20px' }}></i> Fluxo de Caixa Operacional (sem CVM)
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '10px', marginBottom: '1rem' }}>
                            <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#14532d', fontWeight: '700' }}>Total Entradas (Pago)</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: '#15803d' }}>R$ {cashflowSummary.entradas.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#9f1239', fontWeight: '700' }}>Total Saídas (Pago)</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: '#be123c' }}>R$ {cashflowSummary.saidas.toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '700' }}>Saldo Atual (Pago)</p>
                                <p style={{ fontSize: '1.35rem', fontWeight: '900', color: cashflowSummary.saldo >= 0 ? '#15803d' : '#be123c' }}>R$ {cashflowSummary.saldo.toFixed(2).replace('.', ',')}</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1rem', alignItems: 'start' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s600)', marginBottom: '10px' }}>Registrar Transação</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '8px' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Tipo</label>
                                        <select style={inp} value={cashflowForm.tipo} onChange={e => setCashflowForm(prev => ({ ...prev, tipo: e.target.value, categoria: '' }))}>
                                            <option value="Entrada">Entrada</option>
                                            <option value="Saída">Saída</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Campanha</label>
                                        <select style={inp} value={normalizeCampaignId(cashflowForm.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID)} onChange={e => setCashflowForm(prev => ({ ...prev, campaignId: e.target.value }))}>
                                            {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Categoria</label>
                                        <select style={inp} value={cashflowForm.categoria} onChange={e => setCashflowForm(prev => ({ ...prev, categoria: e.target.value }))}>
                                            <option value="">Selecione</option>
                                            {(cashflowCategories[cashflowForm.tipo] || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Forma de Pagamento</label>
                                        <select style={inp} value={cashflowForm.formaPagamento} onChange={e => setCashflowForm(prev => ({ ...prev, formaPagamento: e.target.value }))}>
                                            {cashflowPaymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Status</label>
                                        <select style={inp} value={cashflowForm.status} onChange={e => setCashflowForm(prev => ({ ...prev, status: e.target.value }))}>
                                            {cashflowStatusOptions.map(st => <option key={st} value={st}>{st}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Data da Transação</label>
                                        <input type="date" style={inp} value={cashflowForm.dataTransacao} onChange={e => setCashflowForm(prev => ({ ...prev, dataTransacao: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Valor (R$)</label>
                                        <input type="number" min="0.01" step="0.01" style={inp} value={cashflowForm.valor} onChange={e => setCashflowForm(prev => ({ ...prev, valor: e.target.value }))} />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s600)', textTransform: 'uppercase' }}>Descrição</label>
                                        <input style={inp} placeholder="Ex: Pagamento do desenvolvedor" value={cashflowForm.descricao} onChange={e => setCashflowForm(prev => ({ ...prev, descricao: e.target.value }))} />
                                    </div>
                                </div>
                                {cashflowError && <p style={{ marginTop: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: '700' }}>{cashflowError}</p>}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <button onClick={saveCashflowEntry} style={{ flex: 1, background: 'var(--primary)', color: 'var(--cream)', padding: '10px 12px', borderRadius: '10px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
                                        {cashflowForm.id ? 'Atualizar Transação' : 'Salvar Transação'}
                                    </button>
                                    {cashflowForm.id && (
                                        <button onClick={resetCashflowForm} style={{ background: '#fff', color: 'var(--s600)', border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s600)' }}>Histórico de Transações</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '6px', width: '100%' }}>
                                        <select style={{ ...inp, minWidth: '120px', background: '#fff' }} value={cashflowStatusFilter} onChange={e => setCashflowStatusFilter(e.target.value)}>
                                            <option value="all">Status: Todos</option>
                                            <option value="Pago">Pago</option>
                                            <option value="Pendente">Pendente</option>
                                        </select>
                                        <input type="date" style={{ ...inp, minWidth: '135px', background: '#fff' }} value={cashflowStartDate} onChange={e => setCashflowStartDate(e.target.value)} />
                                        <input type="date" style={{ ...inp, minWidth: '135px', background: '#fff' }} value={cashflowEndDate} onChange={e => setCashflowEndDate(e.target.value)} />
                                        <button onClick={exportCashflowCsv} style={{ background: '#0f766e', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'normal', lineHeight: 1.2 }}>
                                            Exportar CSV
                                        </button>
                                        <button onClick={exportCashflowMonthlyConsolidatedCsv} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'normal', lineHeight: 1.2 }}>
                                            Relatório Mensal CSV
                                        </button>
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto', maxHeight: '360px' }} className="hide-scrollbar">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '940px' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                                            <tr>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Data</th>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Descrição</th>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Tipo</th>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Categoria</th>
                                                <th style={{ padding: '8px', textAlign: 'left' }}>Forma</th>
                                                <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                                                <th style={{ padding: '8px', textAlign: 'right' }}>Valor</th>
                                                <th style={{ padding: '8px', textAlign: 'center' }}>Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cashflowPaginatedEntries.map(item => {
                                                const isIn = safeText(item.tipo) === 'Entrada';
                                                const isEditing = cashflowInlineEditId === item.id && !!cashflowInlineDraft;
                                                return (
                                                    <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '8px' }}>
                                                            {isEditing
                                                                ? <input type="date" style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.dataTransacao} onChange={e => updateInlineCashflowDraft('dataTransacao', e.target.value)} />
                                                                : formatDateStr(item.dataTransacao)}
                                                        </td>
                                                        <td style={{ padding: '8px', color: 'var(--primary)', fontWeight: '700' }}>
                                                            {isEditing
                                                                ? <input style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.descricao} onChange={e => updateInlineCashflowDraft('descricao', e.target.value)} />
                                                                : safeText(item.descricao, '-')}
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            {isEditing
                                                                ? <select style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.tipo} onChange={e => updateInlineCashflowDraft('tipo', e.target.value)}><option value="Entrada">Entrada</option><option value="Saída">Saída</option></select>
                                                                : <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: isIn ? '#dcfce7' : '#fee2e2', color: isIn ? '#14532d' : '#7f1d1d' }}>{safeText(item.tipo)}</span>}
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            {isEditing
                                                                ? <select style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.categoria} onChange={e => updateInlineCashflowDraft('categoria', e.target.value)}><option value="">Selecione</option>{(cashflowCategories[cashflowInlineDraft.tipo] || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                                                                : safeText(item.categoria, '-')}
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            {isEditing
                                                                ? <select style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.formaPagamento} onChange={e => updateInlineCashflowDraft('formaPagamento', e.target.value)}>{cashflowPaymentMethods.map(method => <option key={method} value={method}>{method}</option>)}</select>
                                                                : safeText(item.formaPagamento, '-')}
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            {isEditing
                                                                ? <select style={{ ...inp, padding: '6px 8px', background: '#fff' }} value={cashflowInlineDraft.status} onChange={e => updateInlineCashflowDraft('status', e.target.value)}>{cashflowStatusOptions.map(st => <option key={st} value={st}>{st}</option>)}</select>
                                                                : <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: safeText(item.status) === 'Pago' ? '#dcfce7' : '#fff7ed', color: safeText(item.status) === 'Pago' ? '#14532d' : '#9a3412' }}>{safeText(item.status)}</span>}
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900', color: isIn ? '#15803d' : '#be123c' }}>
                                                            {isEditing
                                                                ? <input type="number" min="0.01" step="0.01" style={{ ...inp, padding: '6px 8px', background: '#fff', textAlign: 'right' }} value={cashflowInlineDraft.valor} onChange={e => updateInlineCashflowDraft('valor', e.target.value)} />
                                                                : `${isIn ? '+' : '-'} R$ ${Number(item.valor || 0).toFixed(2).replace('.', ',')}`}
                                                        </td>
                                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                                            {isEditing ? (
                                                                <>
                                                                    <button onClick={saveInlineCashflowEdit} disabled={cashflowInlineSaving} style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', marginRight: '8px', opacity: cashflowInlineSaving ? 0.7 : 1 }} title="Salvar"><i className="ph-bold ph-check"></i></button>
                                                                    <button onClick={cancelInlineCashflowEdit} disabled={cashflowInlineSaving} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer' }} title="Cancelar"><i className="ph-bold ph-x"></i></button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => startInlineCashflowEdit(item)} style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', marginRight: '8px' }} title="Editar Inline"><i className="ph-bold ph-pencil-simple-line"></i></button>
                                                                    <button onClick={() => editCashflowEntry(item)} style={{ background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', marginRight: '8px' }} title="Editar no formulário"><i className="ph-bold ph-note-pencil"></i></button>
                                                                    <button onClick={() => deleteCashflowEntry(item.id)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }} title="Excluir"><i className="ph-bold ph-trash"></i></button>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredCashflowEntries.length === 0 && (
                                                <tr>
                                                    <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--s600)' }}>Nenhuma transação encontrada para os filtros aplicados.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                    <p style={{ fontSize: '12px', color: 'var(--s600)' }}>
                                        Exibindo {filteredCashflowEntries.length === 0 ? 0 : ((cashflowPage - 1) * cashflowPageSize) + 1} até {Math.min(cashflowPage * cashflowPageSize, filteredCashflowEntries.length)} de {filteredCashflowEntries.length} registro(s)
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <select style={{ ...inp, width: '110px', background: '#fff' }} value={cashflowPageSize} onChange={e => setCashflowPageSize(Number(e.target.value))}>
                                            <option value={10}>10 / página</option>
                                            <option value={20}>20 / página</option>
                                            <option value={50}>50 / página</option>
                                        </select>
                                        <button onClick={() => setCashflowPage(prev => Math.max(1, prev - 1))} disabled={cashflowPage <= 1} style={{ background: cashflowPage <= 1 ? '#f8fafc' : '#fff', color: 'var(--s600)', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', cursor: cashflowPage <= 1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--s600)' }}>Página {cashflowPage} de {cashflowTotalPages}</span>
                                        <button onClick={() => setCashflowPage(prev => Math.min(cashflowTotalPages, prev + 1))} disabled={cashflowPage >= cashflowTotalPages} style={{ background: cashflowPage >= cashflowTotalPages ? '#f8fafc' : '#fff', color: 'var(--s600)', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', cursor: cashflowPage >= cashflowTotalPages ? 'not-allowed' : 'pointer' }}>Próxima</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--s500)' }}>Fechamento Diário</label>
                                <input type="date" style={{ ...inp, background: '#fff', width: '180px' }} value={cashflowClosingDate} onChange={e => setCashflowClosingDate(e.target.value)} />
                            </div>
                            <div style={{ paddingBottom: '4px' }}>
                                <p style={{ fontSize: '12px', color: 'var(--s600)' }}>Pago no dia: {cashflowClosingPreview.qtd} transação(ões)</p>
                                <p style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>Entradas: R$ {cashflowClosingPreview.entradas.toFixed(2).replace('.', ',')} | Saídas: R$ {cashflowClosingPreview.saidas.toFixed(2).replace('.', ',')}</p>
                                <p style={{ fontSize: '12px', color: cashflowClosingIncludeOrders ? '#065f46' : 'var(--s500)', fontWeight: '700' }}>
                                    Lucro Recebido automático (pedidos): R$ {Number(cashflowClosingPreview.recebidoPedidos || 0).toFixed(2).replace('.', ',')} ({Number(cashflowClosingPreview.qtdPedidosRecebidos || 0)} pedido(s))
                                </p>
                                <p style={{ fontSize: '12px', color: cashflowClosingPreview.saldo >= 0 ? '#15803d' : '#be123c', fontWeight: '900' }}>Saldo do dia: R$ {cashflowClosingPreview.saldo.toFixed(2).replace('.', ',')}</p>
                                <p style={{ fontSize: '12px', color: Number(cashflowClosingPreview.saldoComPedidos || 0) >= 0 ? '#15803d' : '#be123c', fontWeight: '900' }}>
                                    Saldo com recebido de pedidos: R$ {Number(cashflowClosingPreview.saldoComPedidos || cashflowClosingPreview.saldo || 0).toFixed(2).replace('.', ',')}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 10px', marginLeft: 'auto' }}>
                                <input
                                    id="cashflow-closing-include-orders"
                                    type="checkbox"
                                    checked={cashflowClosingIncludeOrders === true}
                                    onChange={e => setCashflowClosingIncludeOrders(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                <label htmlFor="cashflow-closing-include-orders" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--s700)', cursor: 'pointer' }}>
                                    Incluir Lucro Recebido automático no fechamento
                                </label>
                            </div>
                            <button onClick={closeDailyCashflow} style={{ marginLeft: 'auto', background: 'var(--primary)', color: 'var(--cream)', padding: '10px 14px', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'normal', lineHeight: 1.2 }}>
                                Salvar Fechamento Diário
                            </button>
                        </div>
                    </div>
                )}

                {/* ABA 3: PRODUÇÃO E ESTOQUE DE INSUMOS */}
                {tab === 'production' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Modais de Edição de Produção */}
                        {editIng && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setEditIng(null)}></div>
                                <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '540px', position: 'relative', zIndex: 201, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontWeight: '700', color: 'var(--primary)' }}>Editar Insumo</h3>
                                        <button onClick={() => setEditIng(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><i className="ph-bold ph-x" style={{ fontSize: '20px', color: 'var(--s400)' }}></i></button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome</label><input style={inp} value={editIng.name} onChange={e => setEditIng({ ...editIng, name: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Categoria</label>
                                            <select style={inp} value={editIng.category || 'c'} onChange={e => setEditIng({ ...editIng, category: e.target.value })}>
                                                {CATEGORIAS.map(c => <option key={c.k} value={c.k}>{c.k}. {c.l}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Estoque Comprado (Total)</label><input type="number" style={inp} value={editIng.purchaseQty} onChange={e => setEditIng({ ...editIng, purchaseQty: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Estoque Atual Restante</label><input type="number" style={inp} value={editIng.currentStockQty} onChange={e => setEditIng({ ...editIng, currentStockQty: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Preço Total Pago (R$)</label><input type="number" style={inp} value={editIng.purchasePrice} onChange={e => setEditIng({ ...editIng, purchasePrice: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Unidade</label>
                                                <select style={inp} value={editIng.unit} onChange={e => setEditIng({ ...editIng, unit: e.target.value })}>
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Fator de Perda (%)</label><input type="number" min="0" max="100" style={inp} value={editIng.wasteFactor || 0} onChange={e => setEditIng({ ...editIng, wasteFactor: e.target.value })} /></div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                                        <button onClick={updateIngredient} style={{ flex: 1, background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Salvar</button>
                                        <button onClick={() => setEditIng(null)} style={{ padding: '12px 20px', background: '#f1f5f9', color: 'var(--s500)', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editRecipe && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setEditRecipe(null)}></div>
                                <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '620px', position: 'relative', zIndex: 201, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)', maxHeight: '90vh', overflowY: 'auto' }} className="hide-scrollbar">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontWeight: '700', color: 'var(--primary)' }}>Editar Receita</h3>
                                        <button onClick={() => setEditRecipe(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}><i className="ph-bold ph-x" style={{ fontSize: '20px', color: 'var(--s400)' }}></i></button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome do Produto</label><input style={inp} value={editRecipe.name} onChange={e => setEditRecipe({ ...editRecipe, name: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Tipo</label>
                                                <select style={inp} value={editRecipe.type || 'produto'} onChange={e => setEditRecipe({ ...editRecipe, type: e.target.value })}>
                                                    {RECIPE_TYPES.map(t => <option key={t.k} value={t.k}>{t.l}</option>)}
                                                </select>
                                            </div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Rendimento</label><input type="number" min="1" style={inp} value={editRecipe.yield || 1} onChange={e => setEditRecipe({ ...editRecipe, yield: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Horas de Produção</label><input type="number" min="0.1" step="0.1" style={inp} value={editRecipe.productionHours || 1} onChange={e => setEditRecipe({ ...editRecipe, productionHours: e.target.value })} /></div>
                                            <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Preço Venda (R$)</label><input type="number" style={inp} value={editRecipe.sellingPrice} onChange={e => setEditRecipe({ ...editRecipe, sellingPrice: e.target.value })} /></div>
                                        </div>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={!!editRecipe.includeLabor} onChange={e => setEditRecipe({ ...editRecipe, includeLabor: e.target.checked })} style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }} />
                                            Incluir +{Number.isInteger(Number(prodInputs.laborPercent || 20)) ? Number(prodInputs.laborPercent || 20) : Number(prodInputs.laborPercent || 20).toFixed(1)}% de Mão de Obra sobre os insumos
                                        </label>

                                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                                            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', marginBottom: '10px' }}>Insumos da Receita</h4>
                                            {editRecipe.ingredientsList.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    {editRecipe.ingredientsList.map((item, idx) => (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '6px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span>{item.inputQty ? `${item.inputQty}${item.inputUnit} de ${item.name}` : `${item.qty}${item.unit} de ${item.name}`}</span>
                                                                {item.inputQty && item.inputUnit !== item.unit && <span style={{ fontSize: '11px', background: '#eef2ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>base: {item.qty.toFixed(3)}{item.unit}</span>}
                                                                {(item.wasteFactor > 0) && <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>+{item.wasteFactor}% perda</span>}
                                                                <button onClick={() => handleRemoveIngFromEditRecipe(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', lineHeight: 1 }} title="Remover"><i className="ph-bold ph-trash"></i></button>
                                                            </div>
                                                            <span style={{ color: 'var(--s500)', fontWeight: '600' }}>R$ {item.cost.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                    {(() => {
                                                        const costs = calcRecipeCosts(editRecipe.ingredientsList, editRecipe.includeLabor, editRecipe.yield, editRecipe.productionHours);
                                                        return (
                                                            <div style={{ textAlign: 'right', fontWeight: '800', color: 'var(--primary)', marginTop: '10px' }}>
                                                                Custo Insumos: R$ {costs.ingredientsCost.toFixed(2)}<br />
                                                                {editRecipe.includeLabor && <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Mão de Obra ({Number(prodInputs.laborPercent || 20).toFixed(1)}%): R$ {costs.laborCost.toFixed(2)}<br /></span>}
                                                                <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Energia: R$ {costs.energyCost.toFixed(2)} | + Gás: R$ {costs.gasCost.toFixed(2)}<br /></span>
                                                                <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Impostos: R$ {costs.taxCost.toFixed(2)} | + Fixos: R$ {costs.fixedCost.toFixed(2)}<br /></span>
                                                                Custo Total: <span style={{ color: 'var(--gold)' }}>R$ {costs.totalCost.toFixed(2)}</span>
                                                                {costs.yieldQty > 1 && <><br /><span style={{ fontSize: '12px', color: '#7c3aed' }}>Custo por unidade: R$ {costs.costPerUnit.toFixed(2)} (rend. {costs.yieldQty})</span></>}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px auto', gap: '8px', alignItems: 'center' }}>
                                                <select style={inp} value={editRecipeIngSelect} onChange={e => { const selectedId = e.target.value; setEditRecipeIngSelect(selectedId); const selectedIng = ingredients.find(i => i.id === selectedId); setEditRecipeIngUnit(selectedIng?.unit || 'g'); }}>
                                                    <option value="">Adicionar novo insumo...</option>
                                                    {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} (R$ {(ing.costPerUnit || 0).toFixed(3)}/{ing.unit})</option>)}
                                                </select>
                                                <input style={inp} type="number" placeholder="Qtd" value={editRecipeIngQty} onChange={e => setEditRecipeIngQty(e.target.value)} />
                                                <select style={inp} value={editRecipeIngUnit} onChange={e => setEditRecipeIngUnit(e.target.value)}>
                                                    {CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                                <input style={inp} type="number" min="0" max="100" placeholder="Perda%" value={editRecipeIngWaste} onChange={e => setEditRecipeIngWaste(e.target.value)} title="Fator de Perda (%)" />
                                                <button onClick={handleAddIngToEditRecipe} style={{ background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}><i className="ph-bold ph-plus"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                                        <button onClick={updateRecipe} style={{ flex: 1, background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Salvar Alterações</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sub-Navegação do Módulo */}
                        <div style={{ display: 'flex', gap: '10px', background: '#fff', padding: '10px', borderRadius: '1rem', border: '1px solid #e2e8f0', width: 'max-content' }}>
                            <button onClick={() => setProdTab('dash')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: prodTab === 'dash' ? '#e0e7ff' : 'transparent', color: prodTab === 'dash' ? '#4f46e5' : 'var(--s500)' }}><i className="ph-bold ph-chart-line-up"></i> Visão Geral</button>
                            <button onClick={() => setProdTab('inputs')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: prodTab === 'inputs' ? '#e0e7ff' : 'transparent', color: prodTab === 'inputs' ? '#4f46e5' : 'var(--s500)' }}><i className="ph-bold ph-sliders"></i> Inputs de Custos</button>
                            <button onClick={() => setProdTab('insumos')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: prodTab === 'insumos' ? '#e0e7ff' : 'transparent', color: prodTab === 'insumos' ? '#4f46e5' : 'var(--s500)' }}><i className="ph-bold ph-package"></i> Cadastro de Insumos</button>
                            <button onClick={() => setProdTab('receitas')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: prodTab === 'receitas' ? '#e0e7ff' : 'transparent', color: prodTab === 'receitas' ? '#4f46e5' : 'var(--s500)' }}><i className="ph-bold ph-list-numbers"></i> Fichas Técnicas & Produção</button>
                            <button onClick={() => setProdTab('conversions')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: prodTab === 'conversions' ? '#e0e7ff' : 'transparent', color: prodTab === 'conversions' ? '#4f46e5' : 'var(--s500)' }}><i className="ph-bold ph-arrows-left-right"></i> Conversões</button>
                        </div>

                        {/* SUB-TAB: Dashboard de Produção */}
                        {prodTab === 'dash' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.5rem' }}>
                                {/* Alertas de Estoque */}
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                        <i className="ph-bold ph-warning-circle" style={{ color: '#ef4444' }}></i> Alertas de Estoque Baixo
                                    </h3>
                                    {lowStockAlerts.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#10b981', fontWeight: '700', background: '#ecfdf5', borderRadius: '1rem' }}>Estoque saudável! Nenhum insumo acabando.</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {lowStockAlerts.map(ing => (
                                                <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#fef2f2', padding: '12px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                                    <strong style={{ color: '#991b1b' }}>{ing.name}</strong>
                                                    <span style={{ color: '#dc2626', fontWeight: '700' }}>{(ing.currentStockQty || 0).toFixed(1)} {ing.unit} restantes</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Produtos Mais Lucrativos */}
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                        <i className="ph-bold ph-trend-up" style={{ color: '#10b981' }}></i> Top Margem de Lucro
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {recipes.length > 0 ? [...recipes].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0)).slice(0, 3).map((r, i) => (
                                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <div>
                                                    <span style={{ fontWeight: '800', color: 'var(--primary)', display: 'block' }}>{i + 1}º {r.name} {r.type && r.type !== 'produto' && <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#4f46e5', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>{typeLabel(r.type)}</span>}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--s500)' }}>
                                                        {(r.yield > 1) ? <>Custo/un: R$ {(r.costPerUnit || r.totalCost || 0).toFixed(2)} | Rend: {r.yield}</> : <>Custo: R$ {(r.totalCost || 0).toFixed(2)}</>} | Venda: R$ {(r.sellingPrice || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <span style={{ background: '#ecfdf5', color: '#059669', padding: '6px 10px', borderRadius: '8px', fontWeight: '800' }}>
                                                    {(r.profitMargin || 0).toFixed(1)}%
                                                </span>
                                            </div>
                                        )) : (
                                            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--s500)', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                                <i className="ph-bold ph-list-numbers" style={{ fontSize: '22px', opacity: .4, marginBottom: '6px' }}></i>
                                                <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '4px' }}>Nenhuma receita cadastrada ainda.</p>
                                                <p style={{ fontSize: '12px' }}>Cadastre sua primeira ficha técnica para acompanhar margens e desempenho de produção.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Info Box Técnica */}
                                <div style={{ gridColumn: '1/-1', background: '#eff6ff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #bfdbfe' }}>
                                    <h4 style={{ color: '#1e40af', fontWeight: '800', marginBottom: '8px' }}>Como o Banco de Dados Firebase funciona aqui?</h4>
                                    <p style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>O Firebase Firestore atua como backend serverless. Temos duas "tabelas" (coleções): <strong>ingredients</strong> e <strong>recipes</strong>. Quando você clica em "Produzir", fazemos uma requisição segura (Batch Write) direto no Firestore que percorre a receita e subtrai a proporção do estoque em tempo real.</p>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: Inputs de Custos */}
                        {prodTab === 'inputs' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.5rem' }}>
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Custos Operacionais (INPUTS)</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Energia (R$/kWh)</label><input type="number" step="0.01" style={inp} value={prodInputs.electricityKwhPrice} onChange={e => setProdInputs({ ...prodInputs, electricityKwhPrice: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Gás (R$/kg)</label><input type="number" step="0.01" style={inp} value={prodInputs.gasKgPrice} onChange={e => setProdInputs({ ...prodInputs, gasKgPrice: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Potência Média (kW)</label><input type="number" step="0.01" style={inp} value={prodInputs.avgPowerKw} onChange={e => setProdInputs({ ...prodInputs, avgPowerKw: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Consumo Gás (kg/h)</label><input type="number" step="0.01" style={inp} value={prodInputs.gasKgPerHour} onChange={e => setProdInputs({ ...prodInputs, gasKgPerHour: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Mão de Obra (%)</label><input type="number" step="0.1" style={inp} value={prodInputs.laborPercent} onChange={e => setProdInputs({ ...prodInputs, laborPercent: e.target.value })} /></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Impostos (%)</label><input type="number" step="0.1" style={inp} value={prodInputs.taxPercent} onChange={e => setProdInputs({ ...prodInputs, taxPercent: e.target.value })} /></div>
                                        <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Custos Fixos/Indiretos (%)</label><input type="number" step="0.1" style={inp} value={prodInputs.fixedPercent} onChange={e => setProdInputs({ ...prodInputs, fixedPercent: e.target.value })} /></div>
                                        <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Observações</label><textarea style={{ ...inp, minHeight: '70px' }} value={prodInputs.notes || ''} onChange={e => setProdInputs({ ...prodInputs, notes: e.target.value })} /></div>
                                    </div>
                                    <button onClick={saveProductionInputs} disabled={inputsSaving} style={{ marginTop: '1rem', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', opacity: inputsSaving ? 0.7 : 1 }}>
                                        {inputsSaving ? 'Salvando...' : 'Salvar Inputs'}
                                    </button>
                                </div>

                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Como isso entra no custo?</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--s600)' }}>
                                        <p><strong>Subtotal operacional</strong> = Insumos + Mão de Obra + Energia + Gás</p>
                                        <p><strong>Impostos</strong> = Subtotal × imposto%</p>
                                        <p><strong>Custos Fixos</strong> = Subtotal × fixo%</p>
                                        <p><strong>Custo total da receita</strong> = Subtotal + Impostos + Custos Fixos</p>
                                        <p><strong>Custo por unidade</strong> = Custo total ÷ rendimento</p>
                                    </div>
                                    <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', borderRadius: '10px', fontSize: '12px', color: '#1e40af' }}>
                                        Esses parâmetros já são aplicados automaticamente ao salvar/editar receitas.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: Conversões de Medidas */}
                        {prodTab === 'conversions' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.5rem' }}>
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Cadastrar Conversão</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>De</label><select style={inp} value={newConversion.fromUnit} onChange={e => setNewConversion({ ...newConversion, fromUnit: e.target.value })}>{CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                                        <div><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Para</label><select style={inp} value={newConversion.toUnit} onChange={e => setNewConversion({ ...newConversion, toUnit: e.target.value })}>{CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                                        <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Fator</label><input type="number" step="0.000001" style={inp} value={newConversion.factor} onChange={e => setNewConversion({ ...newConversion, factor: e.target.value })} /></div>
                                        <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Obs (opcional)</label><input style={inp} value={newConversion.note} onChange={e => setNewConversion({ ...newConversion, note: e.target.value })} /></div>
                                    </div>
                                    <button onClick={addConversion} style={{ marginTop: '12px', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Salvar Conversão</button>
                                </div>

                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Calculadora Rápida</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                        <input style={inp} type="number" placeholder="Valor" value={convCalc.amount} onChange={e => setConvCalc({ ...convCalc, amount: e.target.value })} />
                                        <select style={inp} value={convCalc.fromUnit} onChange={e => setConvCalc({ ...convCalc, fromUnit: e.target.value })}>{CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                        <select style={inp} value={convCalc.toUnit} onChange={e => setConvCalc({ ...convCalc, toUnit: e.target.value })}>{CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                    </div>
                                    <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px', fontWeight: '700', color: 'var(--primary)' }}>
                                        {conversionResult === null
                                            ? 'Informe um valor válido para converter.'
                                            : `${Number(convCalc.amount)} ${convCalc.fromUnit} = ${conversionResult.toFixed(6)} ${convCalc.toUnit}`}
                                    </div>

                                    <h4 style={{ marginTop: '14px', fontSize: '12px', fontWeight: '800', color: 'var(--s500)', textTransform: 'uppercase' }}>Tabela de Conversões Cadastradas</h4>
                                    <div style={{ marginTop: '8px', maxHeight: '240px', overflowY: 'auto' }} className="hide-scrollbar">
                                        {(conversions || []).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--s500)', textAlign: 'center', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '4px' }}>Nenhuma conversão personalizada cadastrada.</p>
                                                <p>Cadastre conversões para padronizar receitas com unidades diferentes.</p>
                                            </div>
                                        ) : (
                                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                <thead><tr style={{ background: '#f8fafc', color: 'var(--s500)', textTransform: 'uppercase', fontSize: '10px' }}><th style={{ padding: '6px' }}>Origem</th><th style={{ padding: '6px' }}>Destino</th><th style={{ padding: '6px' }}>Fator</th><th style={{ padding: '6px' }}></th></tr></thead>
                                                <tbody>
                                                    {conversions.map(c => (
                                                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '6px', textAlign: 'center' }}>{c.fromUnit}</td>
                                                            <td style={{ padding: '6px', textAlign: 'center' }}>{c.toUnit}</td>
                                                            <td style={{ padding: '6px', textAlign: 'center' }}>{Number(c.factor || 0).toFixed(6)}</td>
                                                            <td style={{ padding: '6px', textAlign: 'center' }}><button onClick={() => deleteDoc('conversions', c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="ph-bold ph-trash"></i></button></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: Cadastro de Insumos */}
                        {prodTab === 'insumos' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Adicionar Novo Insumo Base</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px' }}>
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome do Ingrediente</label>
                                            <input style={inp} placeholder="Ex: Chocolate Sicao Ao Leite" value={newIng.name} onChange={e => setNewIng({ ...newIng, name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Categoria</label>
                                            <select style={inp} value={newIng.category} onChange={e => setNewIng({ ...newIng, category: e.target.value })}>
                                                {CATEGORIAS.map(c => <option key={c.k} value={c.k}>{c.k}. {c.l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Preço Total Pago (R$)</label>
                                            <input style={inp} type="number" placeholder="Ex: 85.00" value={newIng.totalPrice} onChange={e => setNewIng({ ...newIng, totalPrice: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Quantidade / Volume Total</label>
                                            <input style={inp} type="number" placeholder="Ex: 1000" value={newIng.totalWeight} onChange={e => setNewIng({ ...newIng, totalWeight: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Unidade de Medida</label>
                                            <select style={inp} value={newIng.unit} onChange={e => setNewIng({ ...newIng, unit: e.target.value })}>
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Fator de Perda (%)</label>
                                            <input style={inp} type="number" placeholder="Ex: 5" min="0" max="100" value={newIng.wasteFactor} onChange={e => setNewIng({ ...newIng, wasteFactor: e.target.value })} />
                                        </div>
                                    </div>
                                    {newIng.totalWeight && newIng.totalPrice && (
                                        <div style={{ marginTop: '10px', padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>
                                            Custo unitário: <strong>R$ {(parseFloat(newIng.totalPrice) / parseFloat(newIng.totalWeight)).toFixed(5)}</strong> / {newIng.unit}
                                        </div>
                                    )}
                                    <button onClick={apiCreateIngredient} style={{ marginTop: '1.5rem', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                                        Salvar Insumo no Banco de Dados
                                    </button>
                                </div>

                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflowX: 'auto' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem' }}>Estoque Atual de Insumos</h3>
                                    <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', color: 'var(--s500)', textTransform: 'uppercase', fontSize: '10px' }}>
                                                <th style={{ padding: '12px' }}>Insumo</th>
                                                <th style={{ padding: '12px' }}>Categoria</th>
                                                <th style={{ padding: '12px' }}>Estoque Atual</th>
                                                <th style={{ padding: '12px' }}>Custo / Unid.</th>
                                                <th style={{ padding: '12px' }}>Perda %</th>
                                                <th style={{ padding: '12px' }}>Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ingredients.map(ing => (
                                                <tr key={ing.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px', fontWeight: '700', color: 'var(--primary)' }}>{ing.name}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span style={{ fontSize: '11px', background: '#f1f5f9', color: 'var(--s500)', padding: '3px 8px', borderRadius: '6px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                            {catLabel(ing.category || 'c')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', fontWeight: '800', color: (ing.currentStockQty || 0) < ((ing.purchaseQty || 0) * 0.2) ? '#ef4444' : '#10b981' }}>
                                                        {ing.currentStockQty || 0} {ing.unit}
                                                    </td>
                                                    <td style={{ padding: '12px' }}>R$ {(ing.costPerUnit || 0).toFixed(5)}</td>
                                                    <td style={{ padding: '12px' }}>{ing.wasteFactor || 0}%</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <button onClick={() => setEditIng(ing)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginRight: '8px' }} title="Editar"><i className="ph-bold ph-pencil-simple"></i></button>
                                                        <button onClick={() => deleteDoc('ingredients', ing.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Apagar"><i className="ph-bold ph-trash"></i></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB: Fichas Técnicas & Produção */}
                        {prodTab === 'receitas' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <i className="ph-bold ph-list-numbers" style={{ color: 'var(--gold)' }}></i> Cadastrar Nova Ficha Técnica
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px' }}>
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome da Receita</label>
                                            <input style={inp} placeholder="Ex: Bolo de Chocolate 2 andares" value={newRecipe.name} onChange={e => setNewRecipe({ ...newRecipe, name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Tipo</label>
                                            <select style={inp} value={newRecipe.type} onChange={e => setNewRecipe({ ...newRecipe, type: e.target.value })}>
                                                {RECIPE_TYPES.map(t => <option key={t.k} value={t.k}>{t.l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Preço de Venda (R$)</label>
                                            <input style={inp} type="number" placeholder="Ex: 120.00" value={newRecipe.sellingPrice} onChange={e => setNewRecipe({ ...newRecipe, sellingPrice: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Rendimento (unid.)</label>
                                            <input style={inp} type="number" min="1" placeholder="1" value={newRecipe.yield} onChange={e => setNewRecipe({ ...newRecipe, yield: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Incluir Mão de Obra</label>
                                            <select style={inp} value={newRecipe.includeLabor ? 'sim' : 'nao'} onChange={e => setNewRecipe({ ...newRecipe, includeLabor: e.target.value === 'sim' })}>
                                                <option value="sim">Sim</option>
                                                <option value="nao">Não</option>
                                            </select>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s400)', textTransform: 'uppercase', marginTop: '1rem', marginBottom: '6px' }}>Ingredientes da Receita:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px auto', gap: '8px', alignItems: 'center' }}>
                                        <select style={inp} value={ingSelect} onChange={e => { const selectedId = e.target.value; setIngSelect(selectedId); const selectedIng = ingredients.find(i => i.id === selectedId); setIngUnitSelect(selectedIng?.unit || 'g'); }}>
                                            <option value="">Adicionar insumo...</option>
                                            {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} (R$ {(ing.costPerUnit || 0).toFixed(3)}/{ing.unit})</option>)}
                                        </select>
                                        <input style={inp} type="number" placeholder="Qtd" value={ingQtySelect} onChange={e => setIngQtySelect(e.target.value)} />
                                        <select style={inp} value={ingUnitSelect} onChange={e => setIngUnitSelect(e.target.value)}>
                                            {CONVERSION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <input style={inp} type="number" min="0" max="100" placeholder="Perda%" value={ingWasteSelect} onChange={e => setIngWasteSelect(e.target.value)} title="Fator de Perda (%)" />
                                        <button onClick={handleAddIngredientToRecipe} style={{ background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}><i className="ph-bold ph-plus"></i></button>
                                    </div>
                                    {recipeIngredients.length > 0 && (
                                        <div style={{ marginTop: '8px' }}>
                                            {recipeIngredients.map((ing, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                                                    <span>{ing.qty} {ing.unit} de {ing.name}{ing.wasteFactor > 0 ? <span style={{ color: '#f59e0b', fontSize: '10px' }}> (+{ing.wasteFactor}% perda)</span> : ''}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>R$ {(ing.cost || 0).toFixed(2)}</span>
                                                        <button onClick={() => handleRemoveIngredientFromRecipe(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><i className="ph-bold ph-x"></i></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(() => {
                                                const costs = calcRecipeCosts(recipeIngredients, newRecipe.includeLabor, newRecipe.yield, newRecipe.productionHours || 1);
                                                return (
                                                    <div style={{ textAlign: 'right', fontWeight: '800', color: 'var(--primary)', marginTop: '10px' }}>
                                                        Custo Insumos: R$ {costs.ingredientsCost.toFixed(2)}<br />
                                                        {newRecipe.includeLabor && <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Mão de Obra ({Number(prodInputs.laborPercent || 20).toFixed(1)}%): R$ {costs.laborCost.toFixed(2)}<br /></span>}
                                                        <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Energia: R$ {costs.energyCost.toFixed(2)} | + Gás: R$ {costs.gasCost.toFixed(2)}<br /></span>
                                                        <span style={{ fontSize: '12px', color: 'var(--s500)' }}>+ Impostos: R$ {costs.taxCost.toFixed(2)} | + Fixos: R$ {costs.fixedCost.toFixed(2)}<br /></span>
                                                        Custo Total: <span style={{ color: 'var(--gold)' }}>R$ {costs.totalCost.toFixed(2)}</span>
                                                        {costs.yieldQty > 1 && <><br /><span style={{ fontSize: '12px', color: '#7c3aed' }}>Custo por unidade: R$ {costs.costPerUnit.toFixed(2)} (rend. {costs.yieldQty})</span></>}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    <button onClick={apiCreateRecipe} style={{ marginTop: '1rem', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                                        Cadastrar Ficha Técnica
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: '1.5rem' }}>
                                    {recipes.map(recipe => (
                                        <div key={recipe.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <h3 style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '16px' }}>{recipe.name}</h3>
                                                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '10px', background: typeColor(recipe.type), color: '#fff', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>{typeLabel(recipe.type)}</span>
                                                        {recipe.yield > 1 && <span style={{ fontSize: '10px', background: '#f1f5f9', color: 'var(--s500)', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600' }}>Rend: {recipe.yield} unid.</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => setEditRecipe({ ...recipe, includeLabor: recipe.includeLabor !== false, type: recipe.type || 'produto', yield: recipe.yield || 1, productionHours: recipe.productionHours || 1 })} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }} title="Editar"><i className="ph-bold ph-pencil-simple" style={{ fontSize: '18px' }}></i></button>
                                                    <button onClick={() => deleteDoc('recipes', recipe.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Apagar"><i className="ph-bold ph-trash" style={{ fontSize: '18px' }}></i></button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '1rem' }}>
                                                <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <span style={{ display: 'block', fontSize: '9px', color: '#991b1b', textTransform: 'uppercase', fontWeight: '700' }}>Custo Total</span>
                                                    <strong style={{ color: '#b91c1c', fontSize: '13px' }}>R$ {(recipe.totalCost || 0).toFixed(2)}</strong>
                                                </div>
                                                <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <span style={{ display: 'block', fontSize: '9px', color: '#065f46', textTransform: 'uppercase', fontWeight: '700' }}>
                                                        {recipe.yield > 1 ? 'Custo/Unid' : 'Margem'}
                                                    </span>
                                                    <strong style={{ color: '#059669', fontSize: '13px' }}>
                                                        {recipe.yield > 1 ? `R$ ${(recipe.costPerUnit || recipe.totalCost || 0).toFixed(2)}` : `${(recipe.profitMargin || 0).toFixed(1)}%`}
                                                    </strong>
                                                </div>
                                                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                                    <span style={{ display: 'block', fontSize: '9px', color: '#1e40af', textTransform: 'uppercase', fontWeight: '700' }}>Margem</span>
                                                    <strong style={{ color: '#2563eb', fontSize: '13px' }}>{(recipe.profitMargin || 0).toFixed(1)}%</strong>
                                                </div>
                                            </div>

                                            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s400)', textTransform: 'uppercase', marginBottom: '6px' }}>Ingredientes:</p>
                                            <ul style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.6, paddingLeft: '16px', marginBottom: '1.5rem', flex: 1 }}>
                                                {(recipe.ingredientsList || []).map((ing, i) => (
                                                    <li key={i}>{ing.qty} {ing.unit} de {ing.name}{ing.wasteFactor > 0 ? <span style={{ color: '#f59e0b', fontSize: '10px' }}> (+{ing.wasteFactor}% perda)</span> : ''}</li>
                                                ))}
                                            </ul>

                                            <button onClick={() => apiProduceBatch(recipe)} style={{ width: '100%', background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <i className="ph-bold ph-package"></i> Produzir Lote e Dar Baixa
                                            </button>
                                        </div>
                                    ))}
                                    {recipes.length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '1.25rem', padding: '2rem', textAlign: 'center', color: 'var(--s500)' }}>
                                            <i className="ph-bold ph-clipboard-text" style={{ fontSize: '28px', opacity: .35, marginBottom: '10px' }}></i>
                                            <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '6px' }}>Nenhuma ficha técnica cadastrada.</p>
                                            <p style={{ fontSize: '12px' }}>Crie sua primeira ficha técnica acima para começar a produção com custo e margem calculados automaticamente.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ABA 4: Cardápio do Site */}
                {tab === 'menu' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Modal de Editar Produto */}
                        {editProd && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setEditProd(null)}></div>
                                <div style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '580px', position: 'relative', zIndex: 201, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)', maxHeight: '90vh', overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="ph-bold ph-pencil-simple" style={{ color: 'var(--gold)' }}></i> Editar — {editProd.name}
                                        </h3>
                                        <button onClick={() => setEditProd(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>
                                            <i className="ph-bold ph-x" style={{ fontSize: '20px', color: 'var(--s400)' }}></i>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Nome do produto</label>
                                                <input style={inp} value={editProd.name} onChange={e => setEditProd({ ...editProd, name: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Preço (R$)</label>
                                                <input style={inp} type="number" value={editProd.price} onChange={e => setEditProd({ ...editProd, price: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Tamanho</label>
                                                <input style={inp} placeholder="G ou M" value={editProd.size || ''} onChange={e => setEditProd({ ...editProd, size: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Peso</label>
                                                <input style={inp} placeholder="Ex: 400g" value={editProd.weight || ''} onChange={e => setEditProd({ ...editProd, weight: e.target.value })} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Aba do catálogo</label>
                                                <select style={inp} value={resolveProductMenuTab(editProd, menuTabOptions)} onChange={e => setEditProd({ ...editProd, menuTab: e.target.value, menuCategory: e.target.value, category: e.target.value })}>
                                                    {menuTabOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Campanha</label>
                                                <select style={inp} value={normalizeCampaignId(editProd.campaignId, CAMPAIGN_GENERAL_ID)} onChange={e => setEditProd({ ...editProd, campaignId: e.target.value })}>
                                                    {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Limite de Estoque</label>
                                                <input style={inp} type="number" min="0" placeholder="Deixe em branco para ilimitado" value={editProd.stockLimit ?? ''} onChange={e => setEditProd({ ...editProd, stockLimit: e.target.value })} />
                                                <span style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '2px' }}>Quando chegar a 0 o item fica <strong>Esgotado</strong>. Em branco = sem limite.</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Slogan / Tag</label>
                                            <input style={inp} placeholder="Ex: O clássico irresistível!" value={editProd.tag || ''} onChange={e => setEditProd({ ...editProd, tag: e.target.value })} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Parcelamento até 3x</label>
                                            <input style={inp} placeholder="3x de R$ 28,05 no cartão" value={editProd.installment || ''} onChange={e => setEditProd({ ...editProd, installment: e.target.value })} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Descrição dos ingredientes</label>
                                            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={editProd.desc || ''} onChange={e => setEditProd({ ...editProd, desc: e.target.value })} />
                                        </div>

                                        <ImageManager
                                            images={Array.isArray(editProd.images) && editProd.images.length > 0 ? editProd.images : (editProd.image ? [editProd.image] : [])}
                                            onChange={imgs => setEditProd({ ...editProd, images: imgs, image: imgs[0] || '' })}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem' }}>
                                        <button onClick={updateProduct} style={{ flex: 1, background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <i className="ph-bold ph-floppy-disk"></i> Salvar alterações
                                        </button>
                                        <button onClick={() => setEditProd(null)} style={{ padding: '12px 20px', background: '#f1f5f9', color: 'var(--s500)', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <div style={{ marginBottom: '1.2rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1rem' }}>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--s600)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>Gerenciar abas do cardápio</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                                    <input
                                        style={{ ...inp, flex: '1 1 240px' }}
                                        placeholder="Nova aba (ex: Refrigerantes)"
                                        value={newMenuTabLabel}
                                        onChange={e => setNewMenuTabLabel(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddMenuTab();
                                            }
                                        }}
                                    />
                                    <button onClick={handleAddMenuTab} style={{ border: 'none', background: 'var(--primary)', color: 'var(--cream)', padding: '0 14px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>
                                        Criar aba
                                    </button>
                                    <button onClick={handleSaveMenuTabs} disabled={menuTabsSaving} style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s700)', padding: '0 14px', borderRadius: '10px', fontWeight: '800', cursor: menuTabsSaving ? 'not-allowed' : 'pointer', opacity: menuTabsSaving ? 0.6 : 1 }}>
                                        {menuTabsSaving ? 'Salvando...' : 'Salvar abas'}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    {menuTabOptions.map((option, index) => (
                                        <span key={option.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: 'var(--s700)' }}>
                                            {option.label}
                                            <button onClick={() => handleMoveMenuTab(option.key, 'left')} disabled={index === 0} title={`Mover ${option.label} para a esquerda`} style={{ border: 'none', background: 'none', color: index === 0 ? '#94a3b8' : 'var(--s500)', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: 0, lineHeight: 1 }}>
                                                <i className="ph-bold ph-caret-left" style={{ fontSize: '14px' }}></i>
                                            </button>
                                            <button onClick={() => handleMoveMenuTab(option.key, 'right')} disabled={index === menuTabOptions.length - 1} title={`Mover ${option.label} para a direita`} style={{ border: 'none', background: 'none', color: index === menuTabOptions.length - 1 ? '#94a3b8' : 'var(--s500)', cursor: index === menuTabOptions.length - 1 ? 'not-allowed' : 'pointer', padding: 0, lineHeight: 1 }}>
                                                <i className="ph-bold ph-caret-right" style={{ fontSize: '14px' }}></i>
                                            </button>
                                            <button onClick={() => handleRemoveMenuTab(option.key)} title={`Remover aba ${option.label}`} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                                                <i className="ph-bold ph-x-circle" style={{ fontSize: '14px' }}></i>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '8px' }}>Use as setas para reordenar as abas sem apagar. Depois clique em <strong>Salvar abas</strong> para refletir em todo o site.</p>
                            </div>

                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-plus-circle" style={{ color: 'var(--gold)' }}></i> Adicionar ao Cardápio Público
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px', marginBottom: '10px' }}>
                                <input style={inp} placeholder="Nome do produto" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} />
                                <input style={inp} placeholder="Preço (ex: 85.00)" type="number" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} />
                                <input style={inp} placeholder="Tamanho (G ou M)" value={newProd.size || ''} onChange={e => setNewProd({ ...newProd, size: e.target.value })} />
                                <input style={inp} placeholder="Peso (ex: 400g)" value={newProd.weight} onChange={e => setNewProd({ ...newProd, weight: e.target.value })} />
                                <input style={inp} placeholder="Slogan (opcional)" value={newProd.tag || ''} onChange={e => setNewProd({ ...newProd, tag: e.target.value })} />
                                <input style={inp} placeholder="Parcelamento até 3x" value={newProd.installment || ''} onChange={e => setNewProd({ ...newProd, installment: e.target.value })} />
                                <input style={inp} type="number" min="0" placeholder="Estoque limite (em branco = ilimitado)" value={newProd.stockLimit || ''} onChange={e => setNewProd({ ...newProd, stockLimit: e.target.value })} />
                                <select style={inp} value={resolveProductMenuTab(newProd, menuTabOptions)} onChange={e => setNewProd({ ...newProd, menuTab: e.target.value, menuCategory: e.target.value, category: e.target.value })}>
                                    {menuTabOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                                </select>
                                <select style={inp} value={normalizeCampaignId(newProd.campaignId, activeCampaignId || CAMPAIGN_GENERAL_ID)} onChange={e => setNewProd({ ...newProd, campaignId: e.target.value })}>
                                    {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <ImageManager
                                        images={Array.isArray(newProd.images) && newProd.images.length > 0 ? newProd.images : (newProd.image ? [newProd.image] : [])}
                                        onChange={imgs => setNewProd({ ...newProd, images: imgs, image: imgs[0] || '' })}
                                    />
                                </div>
                            </div>
                            <textarea style={{ ...inp, width: '100%', minHeight: '70px', resize: 'vertical' }} placeholder="Descrição dos ingredientes..." value={newProd.desc || ''} onChange={e => setNewProd({ ...newProd, desc: e.target.value })} />
                            <button onClick={addProduct} style={{ marginTop: '1rem', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="ph-bold ph-plus"></i> Guardar Produto</button>
                        </div>

                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <h3 style={{ fontWeight: '700', color: 'var(--primary)' }}>Cardápio Atual do Site ({filteredMenuProducts.length}{menuSearch.trim() ? ` de ${products.length}` : ''})</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--s400)', marginTop: '4px' }}>Pesquise por nome, slogan, descrição, campanha ou aba para editar mais rápido.</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '8px', minWidth: 'min(100%, 360px)', flex: '1 1 320px', maxWidth: '420px' }}>
                                    <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--s400)' }}></i>
                                    <input
                                        type="text"
                                        placeholder="Buscar produto no catálogo do admin..."
                                        value={menuSearch}
                                        onChange={e => setMenuSearch(e.target.value)}
                                        style={{ background: 'none', border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: 'var(--primary)' }}
                                    />
                                    {menuSearch.trim() && (
                                        <button onClick={() => setMenuSearch('')} style={{ background: 'none', border: 'none', color: 'var(--s400)', cursor: 'pointer', padding: '2px', lineHeight: 1 }} title="Limpar busca">
                                            <i className="ph-bold ph-x-circle" style={{ fontSize: '18px' }}></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', minWidth: '600px' }}>
                                    <thead style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                        <tr><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Produto</th><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Descrição</th><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Preço</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Estoque</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Ações</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredMenuProducts.map(p => {
                                            const isVisible = p.isVisible !== false;
                                            return (
                                                <tr key={p.id} style={{ borderTop: '1px solid #f8fafc', opacity: isVisible ? 1 : 0.55, background: isVisible ? '#fff' : '#f8fafc' }}>
                                                    <td style={{ padding: '.75rem 1.5rem', minWidth: '150px' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{safeText(p.name, 'Sem nome')}</span>
                                                        <div style={{ display: 'flex', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                            {(() => {
                                                                const badge = campaignBadgeStyle(normalizeCampaignId(p.campaignId, CAMPAIGN_LEGACY_ID));
                                                                return <span style={{ ...badge, fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>{getCampaignName(p.campaignId)}</span>;
                                                            })()}
                                                            <span style={{ fontSize: '10px', background: '#fff7ed', color: '#9a3412', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #fed7aa' }}>{getMenuTabLabel(p.menuTab || p.menuCategory || p.category, menuTabOptions)}</span>
                                                            {!isVisible && <span style={{ fontSize: '10px', background: '#334155', color: '#fff', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>Oculto</span>}
                                                            {p.size && <span style={{ fontSize: '10px', background: 'var(--primary)', color: 'var(--cream)', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>Tam. {p.size}</span>}
                                                            {p.weight && <span style={{ fontSize: '10px', background: '#f1f5f9', color: 'var(--s500)', padding: '2px 8px', borderRadius: '9999px' }}>{p.weight}</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '.75rem 1.5rem', maxWidth: '280px' }}>
                                                        {p.tag && <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gold)', marginBottom: '2px', fontStyle: 'italic' }}>{safeText(p.tag)}</p>}
                                                        <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.4, whiteSpace: 'normal' }}>{safeText(p.desc, '—')}</p>
                                                    </td>
                                                    <td style={{ padding: '.75rem 1.5rem', fontWeight: '700', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                                                        {Number(p.price) > 0 ? `R$ ${Number(p.price).toFixed(2)}` : <span style={{ color: 'var(--s300)', fontSize: '12px' }}>Sem preço</span>}
                                                    </td>
                                                    <td style={{ padding: '.75rem 1.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        {(() => {
                                                            const sl = p.stockLimit;
                                                            if (sl === null || sl === undefined) return <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#166534', padding: '3px 10px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #bbf7d0' }}>Ilimitado</span>;
                                                            if (sl <= 0) return <span style={{ fontSize: '11px', background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #fecaca' }}>Esgotado</span>;
                                                            if (sl <= 5) return <span style={{ fontSize: '11px', background: '#fff7ed', color: '#c2410c', padding: '3px 10px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #fed7aa' }}>{sl} un. ⚠️</span>;
                                                            return <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: '9999px', fontWeight: '700', border: '1px solid #bfdbfe' }}>{sl} un.</span>;
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '.75rem 1.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <button onClick={() => toggleProductVisibility(p.id, p.isVisible)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isVisible ? '#0f766e' : '#64748b', padding: '6px', lineHeight: 1 }} title={isVisible ? 'Ocultar produto' : 'Exibir produto'}>
                                                            <i className={`ph-bold ${isVisible ? 'ph-eye' : 'ph-eye-slash'}`} style={{ fontSize: '18px' }}></i>
                                                        </button>
                                                        <button onClick={() => setEditProd({ ...p })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '6px', lineHeight: 1 }} title="Editar">
                                                            <i className="ph-bold ph-pencil-simple" style={{ fontSize: '18px' }}></i>
                                                        </button>
                                                        <button onClick={() => { const v = window.prompt(`Estoque de "${p.name}"\nAtual: ${p.stockLimit ?? 'Ilimitado'}\n\nNova quantidade (em branco = ilimitado):`); if (v !== null) setProductStock(p.id, v.trim()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: '6px', lineHeight: 1 }} title="Ajustar estoque">
                                                            <i className="ph-bold ph-stack" style={{ fontSize: '18px' }}></i>
                                                        </button>
                                                        <button onClick={() => deleteDoc('products', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '6px', lineHeight: 1 }} title="Apagar">
                                                            <i className="ph-bold ph-trash" style={{ fontSize: '18px' }}></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {filteredMenuProducts.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--s500)' }}>
                                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <i className="ph-bold ph-magnifying-glass" style={{ fontSize: '28px', opacity: 0.35 }}></i>
                                                        <strong style={{ color: 'var(--s600)' }}>Nenhum produto encontrado para esta busca</strong>
                                                        <span style={{ fontSize: '12px' }}>Tente outro termo ou limpe o filtro para ver todo o cardápio.</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ABA 5a: Clientes > Top Clientes ──
                     Renderiza apenas o ranking de clientes fiéis (CRM).
                     Os hooks (topCustomers, insightsCampaignFilter, etc.) permanecem no topo do componente. */}
                {tab === 'customers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-crown" style={{ color: 'var(--gold)' }}></i> Ranking de Clientes Fiéis (CRM)
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <select value={insightsCampaignFilter} onChange={e => setInsightsCampaignFilter(e.target.value)} style={{ ...inp, width: '240px' }}>
                                        <option value="all">Todas as campanhas</option>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                    <button onClick={gerarStoryClientes} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: 'var(--cream)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        <i className="ph-bold ph-instagram-logo" style={{ fontSize: '20px' }}></i> Criar Story (Instagram)
                                    </button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                    <thead style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                        <tr><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Posição</th><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Cliente</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Pedidos</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Unidades</th><th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Gasto Total</th></tr>
                                    </thead>
                                    <tbody>
                                        {topCustomers.map((c, i) => (
                                            <tr key={c.phone} style={{ borderTop: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '1rem 1.5rem', fontWeight: '900', color: 'var(--s400)' }}>
                                                    {i === 0 && (
                                                        <span style={{ background: 'rgb(254, 249, 195)', color: 'rgb(133, 77, 14)', padding: '6px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '11px', display: 'inline-block', whiteSpace: 'nowrap' }}>🥇 1º Lugar</span>
                                                    )}
                                                    {i === 1 && (
                                                        <span style={{ background: 'rgb(241, 245, 249)', color: 'rgb(71, 85, 105)', padding: '6px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '11px', display: 'inline-block', whiteSpace: 'nowrap' }}>🥈 2º Lugar</span>
                                                    )}
                                                    {i === 2 && (
                                                        <span style={{ background: 'rgb(255, 237, 213)', color: 'rgb(154, 52, 18)', padding: '6px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '11px', display: 'inline-block', whiteSpace: 'nowrap' }}>🥉 3º Lugar</span>
                                                    )}
                                                    {i > 2 && `${i + 1}º`}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{c.name}</span><span style={{ fontSize: '12px', color: 'var(--s500)' }}>{c.phone}</span></td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: '700' }}>{c.count}</td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: '700', color: 'var(--gold)' }}>{c.unitsCount}</td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '900', color: 'var(--gold)' }}>R$ {Number(c.spent || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {topCustomers.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2.2rem 1.5rem', textAlign: 'center', color: 'var(--s500)' }}>
                                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <i className="ph-bold ph-users-three" style={{ fontSize: '26px', opacity: .45 }}></i>
                                                        <strong style={{ color: 'var(--s600)' }}>Sem ranking de clientes no recorte atual</strong>
                                                        <span style={{ fontSize: '12px' }}>
                                                            {insightsCampaignFilter === 'all'
                                                                ? 'Ainda não há pedidos para gerar ranking de clientes.'
                                                                : `Ainda não há pedidos para a campanha ${getCampaignName(insightsCampaignFilter)}.`}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ABA 5b: Clientes > Top Pedidos ──
                     Renderiza apenas o ranking de produtos/pedidos (desempenho de vendas).
                     Separado da sub-aba Top Clientes para melhor usabilidade e performance visual.
                     Os hooks (productSalesStats, filteredProdSales, prodSearch, etc.) permanecem no topo do componente. */}
                {tab === 'top-pedidos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-trend-up" style={{ color: 'var(--gold)' }}></i> Desempenho de Produtos
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                    {/* Filtro de campanha replicado aqui para independência da sub-aba */}
                                    <select value={insightsCampaignFilter} onChange={e => setInsightsCampaignFilter(e.target.value)} style={{ ...inp, width: '240px' }}>
                                        <option value="all">Todas as campanhas</option>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                    <button onClick={gerarStoryProdutos} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: 'var(--cream)', padding: '10px 18px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        <i className="ph-bold ph-instagram-logo" style={{ fontSize: '20px' }}></i> Criar Story (Produtos)
                                    </button>
                                    <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                                        <span style={{ background: '#faf5ff', color: '#7e22ce', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-receipt"></i> {insightsOrders.length} pedidos</span>
                                        <span style={{ background: '#ecfdf3', color: '#166534', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-package"></i> {productSalesStats.totalQty} un.</span>
                                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-currency-circle-dollar"></i> R$ {productSalesStats.totalRev.toFixed(2)}</span>
                                        <span style={{ background: '#fff7ed', color: '#9a3412', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-flag-banner"></i> {insightsCampaignFilter === 'all' ? 'Todas campanhas' : getCampaignName(insightsCampaignFilter)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '8px' }}>
                                        <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--s400)' }}></i>
                                        <input type="text" placeholder="Nome, quantidade ou receita..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', fontSize: '14px', width: '180px' }} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: '500px' }} className="hide-scrollbar">
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                    <thead style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <tr><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Ranking Geral</th><th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Produto</th><th style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>Unidades Vendidas</th><th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Receita Gerada</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredProdSales.map((p) => {
                                            const rowIdentity = p.key || p.name;
                                            const realIndex = productSalesStats.list.findIndex((orig) => (orig.key || orig.name) === rowIdentity);
                                            const isTop3 = realIndex >= 0 && realIndex < 3;
                                            const colors = [{ bg: '#fef9c3', text: '#854d0e', badge: '🥇 1º Lugar' }, { bg: '#f1f5f9', text: '#475569', badge: '🥈 2º Lugar' }, { bg: '#ffedd5', text: '#9a3412', badge: '🥉 3º Lugar' }];
                                            const style = isTop3 ? colors[realIndex] : { bg: 'transparent', text: 'var(--s500)', badge: `${realIndex >= 0 ? realIndex + 1 : '-'}º` };

                                            return (
                                                <tr key={rowIdentity} style={{ borderTop: '1px solid #f8fafc', background: isTop3 ? 'rgba(255,237,213,.1)' : '' }}>
                                                    <td style={{ padding: '1rem 1.5rem', width: '140px' }}><span style={{ background: isTop3 ? style.bg : '#f8fafc', color: isTop3 ? style.text : 'var(--s500)', padding: '6px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', display: 'inline-block', whiteSpace: 'nowrap' }}>{style.badge}</span></td>
                                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: 'var(--primary)' }}>{p.name}</td>
                                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontWeight: '900', color: isTop3 ? style.text : 'var(--primary)', fontSize: isTop3 ? '16px' : '14px' }}>{p.qty} un</td>
                                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--gold)' }}>R$ {p.revenue.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredProdSales.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '2.2rem 1.5rem', textAlign: 'center', color: 'var(--s500)' }}>
                                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                        <i className="ph-bold ph-trend-up" style={{ fontSize: '26px', opacity: .45 }}></i>
                                                        <strong style={{ color: 'var(--s600)' }}>Sem dados de produtos no recorte atual</strong>
                                                        <span style={{ fontSize: '12px' }}>
                                                            {prodSearch
                                                                ? 'Nenhum produto encontrado para o termo pesquisado. Ajuste o filtro de nome.'
                                                                : insightsCampaignFilter === 'all'
                                                                    ? 'Ainda não há vendas registradas para compor o ranking de produtos.'
                                                                    : `Ainda não há vendas para a campanha ${getCampaignName(insightsCampaignFilter)}.`}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 6: Cupons */}
                {tab === 'coupons' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-ticket" style={{ color: 'var(--gold)' }}></i> Criar Cupom de Desconto
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem' }}>
                                <input style={{ ...inp, textTransform: 'uppercase' }} placeholder="Código (Ex: VIP10)" value={newCoup.code} onChange={e => setNewCoup({ ...newCoup, code: e.target.value.toUpperCase() })} />
                                <select style={inp} value={newCoup.type} onChange={e => setNewCoup({ ...newCoup, type: e.target.value })}>
                                    <option value="percent">Desconto em %</option>
                                    <option value="fixed">Desconto Fixo (R$)</option>
                                    <option value="free_shipping">Frete Grátis</option>
                                </select>
                                <input style={{ ...inp, opacity: newCoup.type === 'free_shipping' ? .5 : 1 }} type="number" placeholder="Valor (Ex: 10)" disabled={newCoup.type === 'free_shipping'} value={newCoup.value} onChange={e => setNewCoup({ ...newCoup, value: e.target.value })} />
                            </div>
                            <button onClick={addCoupon} style={{ marginTop: '1rem', background: 'var(--primary)', color: 'var(--cream)', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                                Ativar Cupom
                            </button>
                        </div>
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}><h3 style={{ fontWeight: '700', color: 'var(--primary)' }}>Cupons Ativos ({allCoupons.length})</h3></div>
                            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                                <thead style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                    <tr>{['Código', 'Benefício', 'Status', 'Apagar'].map((h, i) => (<th key={i} style={{ padding: '1rem 1.5rem', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</th>))}</tr>
                                </thead>
                                <tbody>
                                    {allCoupons.map(c => (
                                        <tr key={c.id} style={{ borderTop: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '.75rem 1.5rem', fontWeight: '900', letterSpacing: '.1em', color: 'var(--primary)' }}>{safeText(c.code)}</td>
                                            <td style={{ padding: '.75rem 1.5rem', fontWeight: '700', color: 'var(--gold)' }}>{c.type === 'percent' ? `${c.value}% OFF` : c.type === 'fixed' ? `R$ ${Number(c.value || 0).toFixed(2)} OFF` : 'Frete Grátis'}</td>
                                            <td style={{ padding: '.75rem 1.5rem', textAlign: 'center' }}>
                                                <button onClick={() => toggleCoupon(c.id, c.active)} style={{ fontSize: '10px', fontWeight: '700', padding: '4px 12px', borderRadius: '9999px', border: 'none', cursor: 'pointer', background: c.active ? '#dcfce7' : '#f1f5f9', color: c.active ? '#15803d' : 'var(--s500)' }}>{c.active ? 'ATIVO' : 'DESATIVADO'}</button>
                                            </td>
                                            <td style={{ padding: '.75rem 1.5rem', textAlign: 'center' }}>
                                                <button onClick={() => deleteDoc('coupons', c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '8px', lineHeight: 1 }}><i className="ph-bold ph-trash" style={{ fontSize: '18px' }}></i></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ABA 7: Feedback */}
                {tab === 'feedback' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #bfdbfe' }}>
                            <h4 style={{ color: '#1e40af', fontWeight: '800', marginBottom: '8px' }}>Fluxo manual de feedback</h4>
                            <p style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.6 }}>
                                Esta área lista pedidos concluídos. Copie a mensagem, envie manualmente no WhatsApp e acompanhe quem já respondeu.
                            </p>
                        </div>

                        {/* Filtro de notas e status do feedback */}
                        <div style={{ marginBottom: '0', display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>Filtrar por nota:</span>
                                <button onClick={() => setFeedbackFilter('all')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackFilter === 'all' ? '#e0e7ff' : '#f8fafc', color: feedbackFilter === 'all' ? '#4f46e5' : 'var(--s500)' }}>Todas</button>
                                <button onClick={() => setFeedbackFilter('good')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackFilter === 'good' ? '#dcfce7' : '#f8fafc', color: feedbackFilter === 'good' ? '#166534' : 'var(--s500)' }}>Boas (8-10)</button>
                                <button onClick={() => setFeedbackFilter('neutral')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackFilter === 'neutral' ? '#fef9c3' : '#f8fafc', color: feedbackFilter === 'neutral' ? '#a16207' : 'var(--s500)' }}>Neutras (6-7)</button>
                                <button onClick={() => setFeedbackFilter('bad')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackFilter === 'bad' ? '#fee2e2' : '#f8fafc', color: feedbackFilter === 'bad' ? '#b91c1c' : 'var(--s500)' }}>Baixas (1-5)</button>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>Status:</span>
                                <button onClick={() => setFeedbackStatusFilter('all')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackStatusFilter === 'all' ? '#e0e7ff' : '#f8fafc', color: feedbackStatusFilter === 'all' ? '#4f46e5' : 'var(--s500)' }}>Todos</button>
                                <button onClick={() => setFeedbackStatusFilter('respondido')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackStatusFilter === 'respondido' ? '#dcfce7' : '#f8fafc', color: feedbackStatusFilter === 'respondido' ? '#166534' : 'var(--s500)' }}>Respondido</button>
                                <button onClick={() => setFeedbackStatusFilter('enviado')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackStatusFilter === 'enviado' ? '#dbeafe' : '#f8fafc', color: feedbackStatusFilter === 'enviado' ? '#1d4ed8' : 'var(--s500)' }}>Enviado</button>
                                <button onClick={() => setFeedbackStatusFilter('pendente')} style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', background: feedbackStatusFilter === 'pendente' ? '#fef9c3' : '#f8fafc', color: feedbackStatusFilter === 'pendente' ? '#a16207' : 'var(--s500)' }}>Pendente</button>
                            </div>
                        </div>

                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-chat-circle-text" style={{ color: 'var(--gold)' }}></i> Solicitação de Feedback ({filteredFeedbackOrders.length})
                                </h3>
                            </div>
                            <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '880px' }}>
                                    <thead style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--s400)', fontWeight: '700', background: '#f8fafc' }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left' }}>Cliente</th>
                                            <th style={{ padding: '1rem', textAlign: 'left' }}>Pedido</th>
                                            <th style={{ padding: '1rem', textAlign: 'left' }}>Concluído em</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                            <th style={{ padding: '1rem', textAlign: 'left' }}>Última interação</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Nota/Comentário</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFeedbackOrders.map(order => {
                                            const feedback = order.feedback;
                                            const status = feedback?.answeredAt ? 'Respondido' : feedback?.invitedAt ? 'Enviado' : 'Pendente';
                                            const waPhone = formatPhoneForWhatsApp(order.customerPhone);
                                            const feedbackUrl = feedback?.feedbackUrl || `${window.location.href.split('?')[0].split('#')[0]}?feedback=${order.id}`;
                                            const waMessage = encodeURIComponent(
                                                `Oi, ${safeText(order.customerName, 'tudo bem?')}! Aqui é da Helô Confeitaria 💙

Seu pedido foi finalizado e eu queria muito saber como foi a sua experiência.

Se puder, responde rapidinho nosso feedback:
${feedbackUrl}`
                                            );
                                            return (
                                                <tr key={order.id} style={{ borderTop: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'block' }}>{safeText(order.customerName, 'Cliente')}</span>
                                                        <span style={{ fontSize: '12px', color: 'var(--s500)' }}>{safeText(order.customerPhone, 'Sem telefone')}</span>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {(order.items || []).map((item, idx) => (
                                                                <span key={idx} style={{ fontSize: '11px', background: '#f8fafc', padding: '4px 8px', borderRadius: '9999px', display: 'inline-block' }}>{Number(item?.qty || 1)}x {safeText(item?.name, 'Produto')}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', color: 'var(--s600)', fontWeight: '600' }}>{formatDate(order.completedAt || order.createdAt)}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '11px', fontWeight: '800', padding: '6px 10px', borderRadius: '9999px', display: 'inline-block',
                                                            background: status === 'Respondido' ? '#dcfce7' : status === 'Enviado' ? '#dbeafe' : '#fef9c3',
                                                            color: status === 'Respondido' ? '#166534' : status === 'Enviado' ? '#1d4ed8' : '#a16207'
                                                        }}>
                                                            {status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem', color: 'var(--s500)', fontSize: '12px' }}>
                                                        {feedback?.answeredAt ? `Resposta em ${formatDate(feedback.answeredAt)}` : feedback?.invitedAt ? `Mensagem copiada em ${formatDate(feedback.invitedAt)}` : 'Nenhum envio ainda'}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'center', fontSize: '12px', maxWidth: '220px', wordBreak: 'break-word' }}>
                                                        {feedback?.answeredAt ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ fontWeight: '700', color: '#f59e42', fontSize: '15px' }}>
                                                                    {typeof feedback.rating === 'number' || (typeof feedback.rating === 'string' && feedback.rating !== '')
                                                                        ? `Nota: ${Math.max(0, Math.min(10, Number(feedback.rating)))} / 10`
                                                                        : 'Sem nota'}
                                                                </span>
                                                                {feedback.comment && (
                                                                    <span style={{
                                                                        color: '#334155',
                                                                        fontSize: '12px',
                                                                        background: '#f8fafc',
                                                                        padding: '6px 10px',
                                                                        borderRadius: '8px',
                                                                        display: 'block',
                                                                        marginTop: '2px',
                                                                        maxWidth: '180px',
                                                                        maxHeight: '3.6em',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'pre-line',
                                                                        lineHeight: '1.2em',
                                                                    }} title={feedback.comment}>
                                                                        {feedback.comment.length > 90 ? feedback.comment.slice(0, 87) + '...' : feedback.comment}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#cbd5e1' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <button onClick={() => handleCopyFeedbackMessage(order)} disabled={feedbackBusyId === order.id} style={{ background: 'var(--primary)', color: 'var(--cream)', border: 'none', borderRadius: '10px', padding: '9px 12px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', opacity: feedbackBusyId === order.id ? 0.7 : 1 }}>
                                                                {feedbackBusyId === order.id ? 'Copiando...' : 'Copiar mensagem'}
                                                            </button>
                                                            <a href={waPhone ? `https://wa.me/${waPhone}?text=${waMessage}` : '#'} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', borderRadius: '10px', padding: '9px 12px', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: waPhone ? 1 : 0.5, pointerEvents: waPhone ? 'auto' : 'none' }}>
                                                                <i className="ph-bold ph-whatsapp-logo"></i> Abrir WhatsApp
                                                            </a>
                                                            {feedback?.answeredAt && (
                                                                <a href={feedbackUrl} target="_blank" rel="noreferrer" style={{ background: '#f1f5f9', color: 'var(--s600)', borderRadius: '10px', padding: '9px 12px', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                    <i className="ph-bold ph-eye"></i> Ver link
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {concludedOrders.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--s400)' }}>
                                        <i className="ph-bold ph-chat-circle-dots" style={{ fontSize: '2rem', opacity: .35, marginBottom: '8px' }}></i>
                                        <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '4px' }}>Nenhum pedido concluído disponível para feedback.</p>
                                        <p style={{ fontSize: '12px' }}>Assim que pedidos forem concluídos, eles aparecerão aqui para envio e acompanhamento.</p>
                                    </div>
                                )}
                                {concludedOrders.length > 0 && filteredFeedbackOrders.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--s400)' }}>
                                        <i className="ph-bold ph-funnel" style={{ fontSize: '2rem', opacity: .35, marginBottom: '8px' }}></i>
                                        <p style={{ fontWeight: '800', color: 'var(--s600)', marginBottom: '4px' }}>Nenhum feedback encontrado para os filtros atuais.</p>
                                        <p style={{ fontSize: '12px' }}>Ajuste os filtros de nota e status para visualizar outras interações.</p>
                                        <button onClick={() => { setFeedbackFilter('all'); setFeedbackStatusFilter('all'); }} style={{ marginTop: '10px', border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                                            Limpar filtros de feedback
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ABA 8: Análise de Tráfego */}
                {tab === 'visits' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ── VISÃO GERAL LEGADA (contador total) ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="ph-bold ph-users" style={{ color: 'var(--gold)', fontSize: '28px' }}></i>
                                <h3 style={{ fontWeight: '700', color: 'var(--primary)', margin: 0 }}>Tráfego do Site</h3>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: '#f8fafc', padding: '0.75rem 1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <p style={{ fontSize: '10px', color: 'var(--s500)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.08em', margin: 0 }}>Total Geral Únicos</p>
                                    <p style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--primary)', margin: 0, lineHeight: 1.2 }}>{visitsData?.count || 0}</p>
                                </div>
                                <p style={{ fontSize: '11px', color: 'var(--s400)', margin: 0 }}>
                                    {visitsData?.lastVisit ? `Última: ${formatDate(visitsData.lastVisit)}` : 'Aguardando...'}
                                </p>
                            </div>
                        </div>

                        {/* ── FILTROS DE PERÍODO E CAMPANHA ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>Período</label>
                                <select value={trafegoPeriodo} onChange={e => { setTrafegoPeriodo(e.target.value); setTrafegoPagina(0); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', background: '#f8fafc', cursor: 'pointer' }}>
                                    <option value="hoje">Hoje</option>
                                    <option value="ontem">Ontem</option>
                                    <option value="7d">Últimos 7 dias</option>
                                    <option value="30d">Últimos 30 dias</option>
                                    <option value="este_mes">Este mês</option>
                                    <option value="mes_anterior">Mês anterior</option>
                                    <option value="personalizado">Personalizado</option>
                                </select>
                            </div>
                            {trafegoPeriodo === 'personalizado' && (
                                <>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>Data início</label>
                                        <input type="date" value={trafegoDataInicio} onChange={e => { setTrafegoDataInicio(e.target.value); setTrafegoPagina(0); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>Data fim</label>
                                        <input type="date" value={trafegoDataFim} onChange={e => { setTrafegoDataFim(e.target.value); setTrafegoPagina(0); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '13px', background: '#f8fafc' }} />
                                    </div>
                                </>
                            )}
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '4px' }}>Campanha UTM</label>
                                <select value={trafegoFiltroCampanha} onChange={e => { setTrafegoFiltroCampanha(e.target.value); setTrafegoPagina(0); }} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '600', background: '#f8fafc', cursor: 'pointer' }}>
                                    <option value="">Todas</option>
                                    <option value="direto">Tráfego Direto</option>
                                    {trafegoOpcoesCampanha.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* ── MÉTRICAS DO PERÍODO ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                            {[
                                { label: 'Visitantes Únicos', valor: trafegoMetricas.visitantesUnicos, icon: 'ph-user-check', cor: 'var(--primary)' },
                                { label: 'Total de Visitas', valor: trafegoMetricas.totalVisitas, icon: 'ph-eye', cor: '#7c3aed' },
                                { label: 'Média Diária', valor: trafegoMetricas.mediaDiaria, icon: 'ph-chart-line-up', cor: '#0891b2' },
                                { label: 'Campanha Top', valor: trafegoMetricas.campanhaTop || '-', icon: 'ph-trophy', cor: 'var(--gold)' },
                            ].map((m, i) => (
                                <div key={i} style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #f1f5f9', padding: '1.25rem', textAlign: 'center' }}>
                                    <i className={`ph-bold ${m.icon}`} style={{ fontSize: '22px', color: m.cor }}></i>
                                    <p style={{ fontSize: '10px', color: 'var(--s500)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.08em', margin: '6px 0 2px' }}>{m.label}</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: '900', color: m.cor, margin: 0, lineHeight: 1.2 }}>{m.valor}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Primeira / Última visita do período ── */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px', background: '#fff', borderRadius: '1.25rem', border: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <i className="ph-bold ph-clock-countdown" style={{ fontSize: '20px', color: '#059669' }}></i>
                                <div>
                                    <p style={{ fontSize: '10px', color: 'var(--s500)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.08em', margin: 0 }}>Primeira Visita</p>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#059669', margin: 0 }}>{trafegoMetricas.primeiraVisita ? formatDate(trafegoMetricas.primeiraVisita) : '-'}</p>
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: '200px', background: '#fff', borderRadius: '1.25rem', border: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <i className="ph-bold ph-clock" style={{ fontSize: '20px', color: '#dc2626' }}></i>
                                <div>
                                    <p style={{ fontSize: '10px', color: 'var(--s500)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '.08em', margin: 0 }}>Última Visita</p>
                                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', margin: 0 }}>{trafegoMetricas.ultimaVisita ? formatDate(trafegoMetricas.ultimaVisita) : '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* ── GRÁFICOS: Visitas por Dia ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: '700', color: 'var(--primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="ph-bold ph-chart-bar" style={{ color: 'var(--gold)' }}></i> Visitas por Dia
                            </h4>
                            {trafegoPorDia.length === 0 ? (
                                <p style={{ color: 'var(--s400)', fontSize: '13px', textAlign: 'center', padding: '2rem 0' }}>Nenhum dado no período selecionado.</p>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '160px', overflowX: 'auto', paddingBottom: '4px' }}>
                                    {(() => {
                                        const maxVisitas = Math.max(...trafegoPorDia.map(d => d.visitas), 1);
                                        return trafegoPorDia.map(d => {
                                            const h = Math.max(4, (d.visitas / maxVisitas) * 140);
                                            const diaCurto = d.data.slice(5);
                                            return (
                                                <div key={d.data} title={`${d.data}: ${d.visitas} visitas, ${d.unicos} únicos`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px', flex: '1 1 28px' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--primary)', lineHeight: 1 }}>{d.visitas}</span>
                                                    <div style={{ width: '100%', maxWidth: '24px', height: `${h}px`, background: 'linear-gradient(180deg, var(--primary) 0%, #a78bfa 100%)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }}></div>
                                                    <span style={{ fontSize: '8px', color: 'var(--s400)', marginTop: '2px', writingMode: 'vertical-lr', transform: 'rotate(180deg)', lineHeight: 1 }}>{diaCurto}</span>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* ── GRÁFICOS: Visitas por Mês ── */}
                        {trafegoPorMes.length > 0 && (
                            <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem' }}>
                                <h4 style={{ fontWeight: '700', color: 'var(--primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="ph-bold ph-chart-pie-slice" style={{ color: '#7c3aed' }}></i> Visitas por Mês
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', overflowX: 'auto' }}>
                                    {(() => {
                                        const maxVisitas = Math.max(...trafegoPorMes.map(d => d.visitas), 1);
                                        return trafegoPorMes.map(d => {
                                            const h = Math.max(4, (d.visitas / maxVisitas) * 120);
                                            return (
                                                <div key={d.mes} title={`${d.mes}: ${d.visitas} visitas, ${d.unicos} únicos`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '48px', flex: '1 1 48px' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#7c3aed', lineHeight: 1 }}>{d.visitas}</span>
                                                    <div style={{ width: '100%', maxWidth: '36px', height: `${h}px`, background: 'linear-gradient(180deg, #7c3aed 0%, #c084fc 100%)', borderRadius: '6px 6px 0 0' }}></div>
                                                    <span style={{ fontSize: '9px', color: 'var(--s400)', marginTop: '3px' }}>{d.mes}</span>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* ── TOP CAMPAHAS ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: '700', color: 'var(--primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="ph-bold ph-trophy" style={{ color: 'var(--gold)' }}></i> Campanhas
                            </h4>
                            {trafegoPorCampanha.length === 0 ? (
                                <p style={{ color: 'var(--s400)', fontSize: '13px', textAlign: 'center', padding: '1rem 0' }}>Nenhum dado de campanha no período.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Campanha</th>
                                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Origem</th>
                                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Meio</th>
                                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Visitas</th>
                                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Únicos</th>
                                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Primeira</th>
                                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--s500)', fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Última</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trafegoPorCampanha.map((c, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '8px 6px', fontWeight: '700', color: 'var(--primary)' }}>{c.campanha}</td>
                                                    <td style={{ padding: '8px 6px' }}>{c.source}</td>
                                                    <td style={{ padding: '8px 6px' }}>{c.medium}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: '700' }}>{c.visitas}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{c.unicos}</td>
                                                    <td style={{ padding: '8px 6px', fontSize: '11px' }}>{c.primeiraVisita ? formatDate(c.primeiraVisita) : '-'}</td>
                                                    <td style={{ padding: '8px 6px', fontSize: '11px' }}>{c.ultimaVisita ? formatDate(c.ultimaVisita) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* ── ORIGEM DOS ACESSOS ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: '700', color: 'var(--primary)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="ph-bold ph-globe" style={{ color: '#0891b2' }}></i> Origem dos Acessos
                            </h4>
                            {trafegoPorSource.length === 0 ? (
                                <p style={{ color: 'var(--s400)', fontSize: '13px', textAlign: 'center', padding: '1rem 0' }}>Nenhum dado no período.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {trafegoPorSource.map((s, i) => {
                                        const totalVisitas = trafegoMetricas.totalVisitas || 1;
                                        const pct = ((s.visitas / totalVisitas) * 100).toFixed(1);
                                        const cores = ['#7c3aed', '#0891b2', 'var(--gold)', '#059669', '#dc2626', '#ea580c', '#4f46e5'];
                                        const cor = cores[i % cores.length];
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: cor, minWidth: '90px' }}>{s.source}</span>
                                                <div style={{ flex: 1, height: '20px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: '10px', transition: 'width 0.3s', minWidth: '4px' }}></div>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', minWidth: '60px', textAlign: 'right' }}>{s.visitas} ({pct}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── TABELA DETALHADA DE ACESSOS ── */}
                        <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f1f5f9', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <h4 style={{ fontWeight: '700', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="ph-bold ph-list-bullets" style={{ color: '#ea580c' }}></i> Registro de Acessos
                                </h4>
                                <span style={{ fontSize: '11px', color: 'var(--s400)', fontWeight: '600' }}>{trafegoTabelaFiltrada.length} registros</span>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input type="text" placeholder="Buscar..." value={trafegoBusca} onChange={e => { setTrafegoBusca(e.target.value); setTrafegoPagina(0); }} style={{ padding: '0.4rem 0.75rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px', width: '160px' }} />
                                </div>
                            </div>
                            {trafegoTabelaFiltrada.length === 0 ? (
                                <p style={{ color: 'var(--s400)', fontSize: '13px', textAlign: 'center', padding: '2rem 0' }}>Nenhum acesso registrado no período.</p>
                            ) : (
                                <>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Data/Hora</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Visitante</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Origem</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Campanha</th>
                                                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Página</th>
                                                    <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Dispositivo</th>
                                                    <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--s500)', fontWeight: '700', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Navegador</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trafegoTabelaPaginada.map(v => {
                                                    const ts = v.timestamp?.toMillis ? v.timestamp.toMillis() : (v.timestamp?.seconds ? v.timestamp.seconds * 1000 : null);
                                                    /* ── Formata data inline ──
                                                       formatDate() espera Firestore Timestamp (com .toDate/.seconds),
                                                       mas aqui ts já é millis. Formatar direto evita "Data N/A". */
                                                    const dataFormatada = ts
                                                        ? `${new Date(ts).toLocaleDateString('pt-BR')} às ${new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                                        : (v.dateOnly || '-');
                                                    return (
                                                        <tr key={v.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                            <td style={{ padding: '5px 4px', whiteSpace: 'nowrap' }}>{dataFormatada}</td>
                                                            <td style={{ padding: '5px 4px', fontFamily: 'monospace', fontSize: '10px', color: 'var(--s500)' }}>{v.visitorId || '-'}</td>
                                                            <td style={{ padding: '5px 4px' }}>{v.source || 'Direto'}</td>
                                                            <td style={{ padding: '5px 4px', fontWeight: v.utmCampaign ? '700' : '400', color: v.utmCampaign ? 'var(--primary)' : 'var(--s400)' }}>{v.utmCampaign || '-'}</td>
                                                            <td style={{ padding: '5px 4px', color: 'var(--s500)' }}>{v.page || '/'}</td>
                                                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>{v.device || '-'}</td>
                                                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>{v.browser || '-'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Paginação */}
                                    {trafegoTotalPaginas > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                                            <button onClick={() => setTrafegoPagina(p => Math.max(0, p - 1))} disabled={trafegoPagina === 0} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: trafegoPagina === 0 ? '#f1f5f9' : '#fff', cursor: trafegoPagina === 0 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600' }}>← Anterior</button>
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--s500)' }}>{trafegoPagina + 1} / {trafegoTotalPaginas}</span>
                                            <button onClick={() => setTrafegoPagina(p => Math.min(trafegoTotalPaginas - 1, p + 1))} disabled={trafegoPagina >= trafegoTotalPaginas - 1} style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: trafegoPagina >= trafegoTotalPaginas - 1 ? '#f1f5f9' : '#fff', cursor: trafegoPagina >= trafegoTotalPaginas - 1 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600' }}>Próximo →</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                    </div>
                )}

                {/* ABA 9: Configurações */}
                {/* ABA PAGAMENTOS: configuração dinâmica da chave PIX e titular */}
                {tab === 'payments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ── CONFIGURAÇÃO PIX ── */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-qr-code" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Chave PIX para Recebimento
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Configure a chave PIX que será exibida aos clientes no checkout para pagamento. Alterações são refletidas em tempo real na loja.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Chave PIX</label>
                                    <input type="text" style={inp} value={localSettings.chavePix || ''} placeholder="Ex: 88996549074 (CPF, CNPJ, e-mail, telefone ou chave aleatória)" onChange={e => setLocalSettings(prev => ({ ...prev, chavePix: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>Pode ser CPF, CNPJ, e-mail, celular ou chave aleatória. Esta é a chave que o cliente copia no checkout.</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nome do Titular da Conta</label>
                                    <input type="text" style={inp} value={localSettings.nomeTitularPix || ''} placeholder="Ex: Helo Confeitaria LTDA" onChange={e => setLocalSettings(prev => ({ ...prev, nomeTitularPix: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>Nome que aparece ao cliente para conferir se o PIX está correto. Deixe em branco para não exibir.</p>
                                </div>
                            </div>

                            {/* Prévia em tempo real da exibição no checkout */}
                            <div style={{ marginTop: '1.25rem', background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px' }}>
                                <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#166534', marginBottom: '6px' }}>Prévia do Checkout</p>
                                <p style={{ fontSize: '18px', fontWeight: '900', color: '#15803d', letterSpacing: '.08em', wordBreak: 'break-all' }}>{localSettings.chavePix || '88996549074'}</p>
                                {localSettings.nomeTitularPix && (
                                    <p style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: '600' }}>Titular: {localSettings.nomeTitularPix}</p>
                                )}
                                <div style={{ marginTop: '8px', background: 'var(--primary)', color: '#fff', padding: '10px 12px', borderRadius: '10px', fontWeight: '800', textAlign: 'center', fontSize: '13px' }}>
                                    Copiar chave PIX
                                </div>
                            </div>
                        </div>

                        {/* ── INFORMAÇÕES ── */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.8 }}>
                                <strong>Chave PIX atual:</strong> {siteSettings.chavePix || '88996549074 (padrão)'}<br />
                                <strong>Titular:</strong> {siteSettings.nomeTitularPix || 'não definido'}
                            </p>
                        </div>

                        <button onClick={handleSaveSettings} disabled={settingsSaving} style={{ background: 'var(--primary)', color: 'var(--cream)', padding: '14px 28px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', opacity: settingsSaving ? 0.7 : 1, fontSize: '14px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ph-bold ph-floppy-disk"></i> {settingsSaving ? 'Salvando...' : 'Salvar Configurações de Pagamento'}
                        </button>
                    </div>
                )}

                {tab === 'settings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ── MODO DO SITE ── */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-toggle-right" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Modo do Site
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Escolha como o site se apresenta aos clientes.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { k: 'evento', icon: 'ph-egg', label: 'Modo Evento', desc: 'Banner de escassez, contagem de unidades e prazo visíveis. Ideal para lançamentos e eventos sazonais.' },
                                    { k: 'livre', icon: 'ph-storefront', label: 'Modo Livre', desc: 'Sem limitadores. Loja aberta normalmente, sem prazo nem contagem. Ideal para o dia a dia.' },
                                ].map(({ k, icon, label, desc }) => {
                                    const active = localSettings.siteMode === k;
                                    return (
                                        <div key={k} onClick={() => setLocalSettings(prev => ({ ...prev, siteMode: k }))} style={{ padding: '1.25rem', borderRadius: '1rem', border: `2px solid ${active ? 'var(--primary)' : '#e2e8f0'}`, background: active ? '#f0f4ff' : '#f8fafc', cursor: 'pointer', transition: 'all .2s' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <i className={`ph-bold ${icon}`} style={{ fontSize: '22px', color: active ? 'var(--primary)' : 'var(--s400)' }}></i>
                                                <span style={{ fontWeight: '800', color: active ? 'var(--primary)' : 'var(--s600)', fontSize: '14px' }}>{label}</span>
                                                {active && <span style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '9999px' }}>ATIVO</span>}
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.5 }}>{desc}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── CONTROLES DE ENTREGA (global, independente de campanha) ── */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-truck" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Controles de Entrega
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Controle global de disponibilidade de entrega. Quando desativado, clientes só podem escolher retirada no local.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Disponibilizar opção de entrega no site</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, isDeliveryAvailable: !prev.isDeliveryAvailable }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.isDeliveryAvailable ? 'var(--primary)' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.isDeliveryAvailable ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>
                            <p style={{ fontSize: '11px', color: localSettings.isDeliveryAvailable ? '#15803d' : '#b91c1c', marginTop: '4px', fontWeight: '600' }}>
                                {localSettings.isDeliveryAvailable ? '✅ Entrega ATIVA - clientes podem escolher entrega ou retirada' : '❌ Entrega DESATIVADA - apenas retirada no local disponível'}
                            </p>
                        </div>

                        {/* ── CONTROLES DE EVENTO (só relevantes no modo evento, mas editáveis sempre) ── */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: `1px solid ${localSettings.siteMode === 'evento' ? '#bfdbfe' : '#f1f5f9'}`, opacity: localSettings.siteMode === 'evento' ? 1 : 0.55 }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-alarm" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Controles de Evento
                                {localSettings.siteMode !== 'evento' && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#f1f5f9', color: 'var(--s400)', padding: '2px 8px', borderRadius: '9999px', fontWeight: '700' }}>inativo no Modo Livre</span>}
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Configurações do banner de escassez e prazo de pedidos.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Mostrar banner de escassez no site</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, enableScarcityBanner: !prev.enableScarcityBanner }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.enableScarcityBanner ? 'var(--primary)' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.enableScarcityBanner ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Limite Máx. de Unidades</label>
                                    <input type="number" min="1" style={inp} value={localSettings.maxUnits} onChange={e => setLocalSettings(prev => ({ ...prev, maxUnits: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>Controla a barra de progresso e o texto "Restam X unidades".</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Data e Hora Limite de Pedidos</label>
                                    <input type="datetime-local" style={inp} value={localSettings.orderDeadline} onChange={e => setLocalSettings(prev => ({ ...prev, orderDeadline: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>Após este prazo, o site exibe "Vendas Encerradas!" (só no Modo Evento).</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-flag-banner" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Campanhas e Eventos
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)' }}>Configure ativação manual, programação automática por datas e modo híbrido para troca segura de eventos.</p>
                            {campaignScheduleConflicts.length > 0 && (
                                <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', lineHeight: 1.5 }}>
                                    <strong style={{ display: 'block', marginBottom: '4px' }}>Conflitos de programação detectados</strong>
                                    {campaignScheduleConflicts.map((conflict) => (
                                        <div key={conflict.key}>
                                            {conflict.names[0]} ({formatCampaignWindowLabel(conflict.windows[0].startDate, conflict.windows[0].endDate)}) x {conflict.names[1]} ({formatCampaignWindowLabel(conflict.windows[1].startDate, conflict.windows[1].endDate)}) com prioridade {conflict.priority}.
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '12px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Modo de ativação</label>
                                    <select style={inp} value={normalizeCampaignMode(localSettings.campaignMode)} onChange={e => setLocalSettings(prev => ({ ...prev, campaignMode: e.target.value }))}>
                                        <option value={CAMPAIGN_MODE_MANUAL}>Manual (status ativo)</option>
                                        <option value={CAMPAIGN_MODE_AUTO}>Automático (janela de datas)</option>
                                        <option value={CAMPAIGN_MODE_HYBRID}>Híbrido (manual com fallback automático)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Override temporário</label>
                                    <select style={inp} value={safeText(localSettings.activeCampaignOverrideId)} onChange={e => setLocalSettings(prev => ({ ...prev, activeCampaignOverrideId: e.target.value }))}>
                                        <option value="">Sem override</option>
                                        {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <button onClick={clearManualCampaigns} style={{ width: '100%', border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '12px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                                        Limpar ativações manuais
                                    </button>
                                </div>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>ID campanha</label>
                                    <input style={inp} value={campaignForm.id} placeholder="dia_das_maes_2026" onChange={e => setCampaignForm(prev => ({ ...prev, id: slugifyCampaignId(e.target.value) }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome</label>
                                    <input style={inp} value={campaignForm.nome} placeholder="Dia das Mães 2026" onChange={e => setCampaignForm(prev => ({ ...prev, nome: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Início</label>
                                    <input type="date" style={inp} value={campaignForm.startDate} onChange={e => setCampaignForm(prev => ({ ...prev, startDate: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Fim</label>
                                    <input type="date" style={inp} value={campaignForm.endDate} onChange={e => setCampaignForm(prev => ({ ...prev, endDate: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Prioridade</label>
                                    <input type="number" style={inp} value={campaignForm.priority} onChange={e => setCampaignForm(prev => ({ ...prev, priority: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px' }}>
                                    <input type="checkbox" checked={campaignForm.autoEnabled === true} onChange={e => setCampaignForm(prev => ({ ...prev, autoEnabled: e.target.checked }))} />
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--s600)' }}>Ativar programação automática</span>
                                </div>
                                <div style={{ alignSelf: 'end' }}>
                                    <button disabled={createCampaignPreviewConflicts.length > 0} onClick={createCampaign} style={{ width: '100%', border: 'none', background: 'var(--primary)', color: 'var(--cream)', padding: '12px', borderRadius: '12px', fontWeight: '800', cursor: createCampaignPreviewConflicts.length > 0 ? 'not-allowed' : 'pointer', opacity: createCampaignPreviewConflicts.length > 0 ? 0.6 : 1 }}>
                                        Criar campanha
                                    </button>
                                </div>
                            </div>
                            {createCampaignPreviewConflicts.length > 0 && (
                                <div style={{ marginTop: '-4px', fontSize: '12px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '8px 10px' }}>
                                    Ajuste datas ou prioridade para evitar sobreposição com mesma prioridade antes de criar a campanha.
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                {campaignOptions.map(campaign => {
                                    const draft = campaignDrafts[campaign.id] || {
                                        nome: campaign.nome,
                                        autoEnabled: campaign.autoEnabled === true,
                                        startDate: normalizeDateOnlyOrEmpty(campaign.startDate),
                                        endDate: normalizeDateOnlyOrEmpty(campaign.endDate),
                                        priority: normalizeCampaignPriority(campaign.priority),
                                    };
                                    const manualActive = normalizeCampaignStatus(campaign.status) === 'ativo';
                                    const autoActiveNow = isCampaignAutoActiveNow({ ...campaign, ...draft });
                                    const draftConflicts = campaignConflictById[campaign.id] || [];
                                    return (
                                        <div key={campaign.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                                <div>
                                                    <strong style={{ color: 'var(--primary)' }}>{campaign.nome}</strong>
                                                    <p style={{ fontSize: '11px', color: 'var(--s500)' }}>ID: {campaign.id}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: manualActive ? '#dcfce7' : '#f1f5f9', color: manualActive ? '#166534' : '#475569' }}>
                                                        {manualActive ? 'Manual ativo' : 'Manual inativo'}
                                                    </span>
                                                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: autoActiveNow ? '#dbeafe' : '#f8fafc', color: autoActiveNow ? '#1d4ed8' : '#64748b' }}>
                                                        {autoActiveNow ? 'Auto em vigor' : 'Auto fora da janela'}
                                                    </span>
                                                </div>
                                            </div>

                                            {draftConflicts.length > 0 && (
                                                <div style={{ marginBottom: '10px', border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', lineHeight: 1.5 }}>
                                                    {draftConflicts.map((conflict) => {
                                                        const otherIndex = conflict.ids[0] === campaign.id ? 1 : 0;
                                                        return (
                                                            <div key={`${campaign.id}-${conflict.key}`}>
                                                                Conflita com {conflict.names[otherIndex]} na prioridade {conflict.priority}. Janela atual: {formatCampaignWindowLabel(conflict.windows[conflict.ids[0] === campaign.id ? 0 : 1].startDate, conflict.windows[conflict.ids[0] === campaign.id ? 0 : 1].endDate)}.
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px', alignItems: 'end' }}>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Nome</label>
                                                    <input style={inp} value={safeText(draft.nome)} onChange={e => updateCampaignDraft(campaign.id, { nome: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Início</label>
                                                    <input type="date" style={inp} value={safeText(draft.startDate)} onChange={e => updateCampaignDraft(campaign.id, { startDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Fim</label>
                                                    <input type="date" style={inp} value={safeText(draft.endDate)} onChange={e => updateCampaignDraft(campaign.id, { endDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '10px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase' }}>Prioridade</label>
                                                    <input type="number" style={inp} value={safeText(draft.priority)} onChange={e => updateCampaignDraft(campaign.id, { priority: e.target.value })} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '22px' }}>
                                                    <input type="checkbox" checked={draft.autoEnabled === true} onChange={e => updateCampaignDraft(campaign.id, { autoEnabled: e.target.checked })} />
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--s600)' }}>Auto</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                                <button onClick={() => activateCampaignManually(campaign.id)} style={{ border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#166534', padding: '8px 10px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>
                                                    Ativar manualmente
                                                </button>
                                                <button disabled={draftConflicts.length > 0} onClick={() => saveCampaignDraft(campaign.id)} style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', padding: '8px 10px', borderRadius: '10px', fontWeight: '800', cursor: draftConflicts.length > 0 ? 'not-allowed' : 'pointer', opacity: draftConflicts.length > 0 ? 0.6 : 1 }}>
                                                    Salvar programação
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── AVISO / PROPAGANDA PARA CLIENTES ── */}
                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-megaphone" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Aviso / Banner para Clientes
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Exiba um recado personalizado no topo da loja. Use para promoções, avisos de novidade ou qualquer comunicado rápido.</p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Ativar aviso no site</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, enableAnnouncement: !prev.enableAnnouncement }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.enableAnnouncement ? '#16a34a' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.enableAnnouncement ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: localSettings.enableAnnouncement ? 1 : 0.5, pointerEvents: localSettings.enableAnnouncement ? 'auto' : 'none' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Texto do Aviso</label>
                                    <textarea rows={3} maxLength={300} style={{ ...inp, resize: 'vertical', minHeight: '80px' }}
                                        placeholder="Ex: 🎉 Novidade! Agora aceitamos encomendas para datas especiais. Entre em contato pelo WhatsApp!"
                                        value={localSettings.announcementText}
                                        onChange={e => setLocalSettings(prev => ({ ...prev, announcementText: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>{(localSettings.announcementText || '').length}/300 caracteres</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Estilo Visual</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {[
                                            { k: 'info', label: 'Azul (Info)', bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
                                            { k: 'success', label: 'Verde (Promo)', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                                            { k: 'warning', label: 'Âmbar (Atenção)', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
                                            { k: 'gold', label: 'Dourado (Destaque)', bg: 'linear-gradient(135deg,#CFA860,#B58E45)', color: '#fff', border: '#B58E45' },
                                            { k: 'dark', label: 'Escuro (Elegante)', bg: 'var(--primary)', color: 'var(--cream)', border: 'var(--primary)' },
                                        ].map(({ k, label, bg, color, border }) => (
                                            <div key={k} onClick={() => setLocalSettings(prev => ({ ...prev, announcementStyle: k }))}
                                                style={{ padding: '8px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: bg, color, border: `2px solid ${localSettings.announcementStyle === k ? border : 'transparent'}`, outline: localSettings.announcementStyle === k ? '2px solid var(--primary)' : 'none', outlineOffset: '2px', transition: 'outline .15s' }}>
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {localSettings.announcementText && (
                                    <div>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s400)', textTransform: 'uppercase', marginBottom: '6px' }}>Prévia</p>
                                        {(() => {
                                            const styles = {
                                                info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
                                                success: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                                                warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
                                                gold: { bg: 'linear-gradient(135deg,#CFA860,#B58E45)', color: '#fff', border: '#B58E45' },
                                                dark: { bg: 'var(--primary)', color: 'var(--cream)', border: 'var(--primary)' },
                                            };
                                            const s = styles[localSettings.announcementStyle] || styles.info;
                                            return (
                                                <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '12px', padding: '12px 16px', color: s.color, fontSize: '13px', fontWeight: '600', lineHeight: 1.5 }}>
                                                    {localSettings.announcementText}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-printer" style={{ color: 'var(--gold)', fontSize: '22px' }}></i> Impressão Térmica Local
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', marginBottom: '1.25rem' }}>Envia automaticamente o cupom para a impressora local via cabo no fechamento da venda.</p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Ativar impressão automática de pedidos</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, thermalPrintEnabled: !prev.thermalPrintEnabled }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.thermalPrintEnabled ? '#16a34a' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.thermalPrintEnabled ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '12px', opacity: localSettings.thermalPrintEnabled ? 1 : 0.55, pointerEvents: localSettings.thermalPrintEnabled ? 'auto' : 'none' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Nome da impressora (opcional)</label>
                                    <input style={inp} value={safeText(localSettings.thermalPrinterName)} placeholder="Ex.: EPSON TM-T20X" onChange={e => setLocalSettings(prev => ({ ...prev, thermalPrinterName: e.target.value }))} />
                                    <p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '4px' }}>Em branco: usa a impressora padrão do Windows.</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cópias por pedido</label>
                                    <input type="number" min="1" max="5" style={inp} value={localSettings.thermalPrintCopies} onChange={e => setLocalSettings(prev => ({ ...prev, thermalPrintCopies: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Modo de impressão</label>
                                    <select style={inp} value={normalizeThermalPrintMode(localSettings.thermalPrintMode)} onChange={e => setLocalSettings(prev => ({ ...prev, thermalPrintMode: e.target.value }))}>
                                        <option value="escpos">QZ Tray (ESC/POS - recomendado)</option>
                                        <option value="browser">Navegador (janela de impressão)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--s500)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Tipo de via</label>
                                    <select style={inp} value={normalizeThermalPrintTicketMode(localSettings.thermalPrintTicketMode)} onChange={e => setLocalSettings(prev => ({ ...prev, thermalPrintTicketMode: e.target.value }))}>
                                        <option value="kitchen">Imprimir só cozinha</option>
                                        <option value="cashier">Imprimir só caixa</option>
                                        <option value="both">Imprimir ambas (padrão)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', opacity: localSettings.thermalPrintEnabled ? 1 : 0.55, pointerEvents: localSettings.thermalPrintEnabled ? 'auto' : 'none' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Imprimir automaticamente ao finalizar pedido</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, thermalPrintAutoOnOrder: !prev.thermalPrintAutoOnOrder }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.thermalPrintAutoOnOrder ? '#16a34a' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.thermalPrintAutoOnOrder ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', opacity: localSettings.thermalPrintEnabled ? 1 : 0.55, pointerEvents: localSettings.thermalPrintEnabled ? 'auto' : 'none' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--s600)', flex: 1 }}>Tentar impressão no navegador se o QZ falhar</span>
                                <div onClick={() => setLocalSettings(prev => ({ ...prev, thermalPrintBrowserFallback: !prev.thermalPrintBrowserFallback }))}
                                    style={{ width: '44px', height: '24px', borderRadius: '9999px', background: localSettings.thermalPrintBrowserFallback ? '#16a34a' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '3px', left: localSettings.thermalPrintBrowserFallback ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '9999px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}></div>
                                </div>
                            </div>

                            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '8px', opacity: localSettings.thermalPrintEnabled ? 1 : 0.55, pointerEvents: localSettings.thermalPrintEnabled ? 'auto' : 'none' }}>
                                <button onClick={() => handleThermalPrintTest('kitchen')} disabled={!localSettings.thermalPrintEnabled || thermalPrintTesting}
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s700)', padding: '10px 12px', borderRadius: '10px', fontWeight: '700', cursor: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 'not-allowed' : 'pointer', opacity: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 0.6 : 1 }}>
                                    {thermalPrintTesting ? 'Enviando teste...' : 'Testar Cozinha'}
                                </button>
                                <button onClick={() => handleThermalPrintTest('cashier')} disabled={!localSettings.thermalPrintEnabled || thermalPrintTesting}
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s700)', padding: '10px 12px', borderRadius: '10px', fontWeight: '700', cursor: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 'not-allowed' : 'pointer', opacity: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 0.6 : 1 }}>
                                    {thermalPrintTesting ? 'Enviando teste...' : 'Testar Caixa'}
                                </button>
                                <button onClick={() => handleThermalPrintTest('both')} disabled={!localSettings.thermalPrintEnabled || thermalPrintTesting}
                                    style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s700)', padding: '10px 12px', borderRadius: '10px', fontWeight: '700', cursor: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 'not-allowed' : 'pointer', opacity: !localSettings.thermalPrintEnabled || thermalPrintTesting ? 0.6 : 1 }}>
                                    {thermalPrintTesting ? 'Enviando teste...' : 'Testar Ambas'}
                                </button>
                            </div>

                            <div style={{ marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s500)' }}>
                                        Diagnóstico de Ambiente
                                    </p>
                                    <button onClick={() => runThermalDiagnostic({ connectIfNeeded: true })} disabled={thermalDiag.checking}
                                        style={{ border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', padding: '6px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', cursor: thermalDiag.checking ? 'not-allowed' : 'pointer', opacity: thermalDiag.checking ? 0.7 : 1 }}>
                                        {thermalDiag.checking ? 'Verificando...' : 'Atualizar agora'}
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: thermalDiag.scriptLoaded ? '#dcfce7' : '#fee2e2', color: thermalDiag.scriptLoaded ? '#166534' : '#991b1b', border: `1px solid ${thermalDiag.scriptLoaded ? '#86efac' : '#fecaca'}` }}>
                                        QZ detectado: {thermalDiag.scriptLoaded ? 'sim' : 'não'}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: thermalDiag.qzConnected ? '#dcfce7' : '#fee2e2', color: thermalDiag.qzConnected ? '#166534' : '#991b1b', border: `1px solid ${thermalDiag.qzConnected ? '#86efac' : '#fecaca'}` }}>
                                        QZ conectado: {thermalDiag.qzConnected ? 'sim' : 'não'}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '9999px', background: thermalDiag.printerFound ? '#dcfce7' : '#fee2e2', color: thermalDiag.printerFound ? '#166534' : '#991b1b', border: `1px solid ${thermalDiag.printerFound ? '#86efac' : '#fecaca'}` }}>
                                        Impressora: {thermalDiag.printerFound ? 'encontrada' : 'não encontrada'}
                                    </span>
                                </div>

                                <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{thermalDiag.message}</p>
                                {thermalDiag.printerName && (
                                    <p style={{ fontSize: '11px', color: '#166534', fontWeight: '700', marginTop: '4px' }}>Impressora ativa: {thermalDiag.printerName}</p>
                                )}
                                {thermalDiag.lastCheckedAt && (
                                    <p style={{ fontSize: '10px', color: 'var(--s400)', marginTop: '4px' }}>Última verificação: {thermalDiag.lastCheckedAt.toLocaleTimeString('pt-BR')}</p>
                                )}
                            </div>

                            <p style={{ fontSize: '11px', color: '#475569', marginTop: '10px', lineHeight: 1.5 }}>
                                Requisito: instalar e manter o QZ Tray aberto no computador local para impressão térmica direta via USB/cabo.
                            </p>
                        </div>

                        {/* ── STATUS ATUAL ── */}
                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
                            <p style={{ fontSize: '12px', color: 'var(--s500)', lineHeight: 1.8 }}>
                                <strong>Modo ativo:</strong> {siteSettings.siteMode === 'livre' ? '🛒 Livre (loja aberta)' : '🥚 Evento'}<br />
                                {/* Linha de Unidades e Prazo só aparece em Modo Evento ou se o limitador global estiver ativado */}
                                {(siteSettings.siteMode === 'evento' || siteSettings.enableScarcityBanner === true) && (
                                    <>
                                        <strong>Unidades:</strong> {Number(siteSettings.maxUnits) || 70} · <strong>Prazo:</strong> {siteSettings.orderDeadline ? new Date(siteSettings.orderDeadline).toLocaleString('pt-BR') : 'não definido'}<br />
                                    </>
                                )}
                                <strong>Campanhas:</strong> {normalizeCampaignMode(localSettings.campaignMode) === CAMPAIGN_MODE_AUTO ? 'Automático' : normalizeCampaignMode(localSettings.campaignMode) === CAMPAIGN_MODE_HYBRID ? 'Híbrido' : 'Manual'} · <strong>Evento em foco:</strong> {safeText(localSettings.activeCampaignOverrideId) ? `${getCampaignName(localSettings.activeCampaignOverrideId)} (override)` : getCampaignName(activeCampaignId)}<br />
                                <strong>Entrega:</strong> {siteSettings.isDeliveryAvailable !== undefined ? (Boolean(siteSettings.isDeliveryAvailable) ? '✅ Ativa' : '❌ Apenas Retirada') : '✅ Ativa'}<br />
                                <strong>Aviso ativo:</strong> {siteSettings.enableAnnouncement ? '✅ Sim' : '❌ Não'} {siteSettings.announcementText ? `— "${String(siteSettings.announcementText).slice(0, 60)}${siteSettings.announcementText.length > 60 ? '...' : ''}"` : ''}<br />
                                <strong>Impressão local:</strong> {siteSettings.thermalPrintEnabled ? `✅ ${normalizeThermalPrintMode(siteSettings.thermalPrintMode) === 'browser' ? 'Navegador' : 'QZ Tray/ESC-POS'} · ${normalizeThermalPrintTicketMode(siteSettings.thermalPrintTicketMode) === 'kitchen' ? 'somente cozinha' : normalizeThermalPrintTicketMode(siteSettings.thermalPrintTicketMode) === 'cashier' ? 'somente caixa' : 'cozinha + caixa'} · ${Number(siteSettings.thermalPrintCopies) || 1} cópia(s) · ${siteSettings.thermalPrintAutoOnOrder !== false ? 'auto ativo' : 'auto inativo (não imprime ao confirmar)'}` : '❌ Desativada'}
                            </p>
                        </div>

                        <button onClick={handleSaveSettings} disabled={settingsSaving} style={{ background: 'var(--primary)', color: 'var(--cream)', padding: '14px 28px', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', opacity: settingsSaving ? 0.7 : 1, fontSize: '14px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="ph-bold ph-floppy-disk"></i> {settingsSaving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                )}

            </div>

            {/* Modal de Preview do Story (Renderizado Global no Admin) */}
            {storyPreview && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)' }} onClick={() => setStoryPreview(null)}></div>
                    <div style={{ position: 'relative', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', maxWidth: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '340px', color: '#fff', marginBottom: '-6px' }}>
                            <h3 style={{ fontWeight: '700', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-image"></i> Preview do Post
                            </h3>
                            <button onClick={() => setStoryPreview(null)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', borderRadius: '99px', lineHeight: 1 }}>
                                <i className="ph-bold ph-x" style={{ fontSize: '18px' }}></i>
                            </button>
                        </div>
                        <img src={storyPreview} alt="Story Preview" style={{ width: '100%', maxWidth: '340px', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,.5)', border: '2px solid rgba(207, 168, 96, 0.4)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '340px', marginTop: '4px' }}>
                            <button onClick={compartilharImagemStory} style={{ background: 'var(--cream)', color: 'var(--primary)', padding: '16px', borderRadius: '12px', fontWeight: '800', fontSize: '15px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-share-network" style={{ fontSize: '22px' }}></i> COMPARTILHAR / BAIXAR
                            </button>
                            <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,.6)', textAlign: 'center', lineHeight: 1.4 }}>
                                No celular, ao clicar acima abrirão as opções do Instagram/WhatsApp. No computador, a imagem será baixada automaticamente.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente funcional da aba Entregadores com CRUD no Firestore
function DriversTab({ allOrders = [], campaigns = [] }) {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editDriver, setEditDriver] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', vehicle: '', plate: '', active: true });
    const [driverFilterId, setDriverFilterId] = useState('all');
    const [campaignFilterId, setCampaignFilterId] = useState('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');

    useEffect(() => {
        if (!db) return;
        let unsub = () => {};
        try {
            unsub = getCol('drivers')
                .orderBy('name')
                .onSnapshot(snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setDrivers(list);
                    setLoading(false);
                }, err => {
                    console.warn('DriversTab snapshot error:', err.message);
                    setLoading(false);
                });
        } catch (e) {
            console.warn('DriversTab init error:', e.message);
            setLoading(false);
        }
        return () => unsub();
    }, []);

    const resetForm = () => {
        setForm({ name: '', phone: '', vehicle: '', plate: '', active: true });
        setEditDriver(null);
        setShowForm(false);
    };

    const handleSave = async () => {
        const name = safeText(form.name).trim();
        const phone = safeText(form.phone).trim();
        if (!name) return alert('Informe o nome do entregador.');
        if (!phone) return alert('Informe o telefone do entregador.');
        setSaving(true);
        try {
            const data = {
                name,
                phone,
                vehicle: safeText(form.vehicle).trim(),
                plate: safeText(form.plate).trim().toUpperCase(),
                active: form.active !== false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            if (editDriver?.id) {
                await getCol('drivers').doc(editDriver.id).update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await getCol('drivers').add(data);
            }
            resetForm();
        } catch (err) {
            console.error('DriversTab save error:', err);
            alert('Erro ao salvar entregador: ' + err.message);
        }
        setSaving(false);
    };

    const handleDelete = async (driver) => {
        if (!confirm(`Remover entregador "${driver.name}"?`)) return;
        try {
            await getCol('drivers').doc(driver.id).delete();
        } catch (err) {
            alert('Erro ao remover: ' + err.message);
        }
    };

    const startEdit = (driver) => {
        setForm({ name: driver.name || '', phone: driver.phone || '', vehicle: driver.vehicle || '', plate: driver.plate || '', active: driver.active !== false });
        setEditDriver(driver);
        setShowForm(true);
    };

    // Constrói opções de campanha para filtros da aba Entregadores.
    // Recebe: lista de campanhas normalizadas do AdminPanel.
    // Retorna: array sem duplicidade com { id, nome } para uso em select.
    const driverCampaignOptions = useMemo(() => {
        const uniqueById = {};
        (Array.isArray(campaigns) ? campaigns : []).forEach((campaign) => {
            const id = normalizeCampaignId(campaign?.id, CAMPAIGN_LEGACY_ID);
            if (!id || uniqueById[id]) return;
            uniqueById[id] = {
                id,
                nome: safeText(campaign?.nome, CAMPAIGN_DEFAULT_NAME),
            };
        });
        return Object.values(uniqueById);
    }, [campaigns]);

    // Mapeia o nome da campanha por ID para exibir no consolidado diário.
    // Recebe: opções de campanha do filtro.
    // Retorna: objeto { [campaignId]: nomeCampanha }.
    const driverCampaignNameMap = useMemo(() => {
        const map = {};
        driverCampaignOptions.forEach((campaign) => {
            map[campaign.id] = campaign.nome;
        });
        return map;
    }, [driverCampaignOptions]);

    // Resolve a data de referência da entrega para filtros e consolidados.
    // Recebe: objeto do pedido.
    // Retorna: string YYYY-MM-DD (data do pedido ou createdAt) ou vazio.
    const getDeliveryDateKeyFromOrder = useCallback((order) => {
        const directDate = normalizeDateOnlyValue(order?.date, '');
        if (directDate) return directDate;
        const createdAt = order?.createdAt;
        try {
            if (createdAt && typeof createdAt.toDate === 'function') {
                return normalizeDateOnlyValue(createdAt.toDate(), '');
            }
            if (createdAt && typeof createdAt.seconds === 'number') {
                return normalizeDateOnlyValue(new Date(createdAt.seconds * 1000), '');
            }
        } catch {
            return '';
        }
        return '';
    }, []);

    // Aplica filtros por entregador, campanha e faixa de datas em pedidos de entrega.
    // Recebe: lista completa de pedidos do sistema.
    // Retorna: somente pedidos com entregador atribuído e método de entrega válidos para o filtro atual.
    const filteredDeliveryOrders = useMemo(() => {
        const normalizedStartDate = normalizeDateOnlyValue(startDateFilter, '');
        const normalizedEndDate = normalizeDateOnlyValue(endDateFilter, '');

        return (Array.isArray(allOrders) ? allOrders : []).filter((order) => {
            if (!order?.driverId) return false;
            const normalizedMethod = normalizeText(order?.method).toLowerCase();
            if (!normalizedMethod.includes('entrega')) return false;

            if (driverFilterId !== 'all' && order.driverId !== driverFilterId) return false;

            const normalizedCampaignId = normalizeCampaignId(order?.campaignId, CAMPAIGN_LEGACY_ID);
            if (campaignFilterId !== 'all' && normalizedCampaignId !== campaignFilterId) return false;

            const orderDateKey = getDeliveryDateKeyFromOrder(order);
            if (normalizedStartDate && (!orderDateKey || orderDateKey < normalizedStartDate)) return false;
            if (normalizedEndDate && (!orderDateKey || orderDateKey > normalizedEndDate)) return false;

            return true;
        });
    }, [allOrders, driverFilterId, campaignFilterId, startDateFilter, endDateFilter, getDeliveryDateKeyFromOrder]);

    // Consolida métricas globais da aba com base no filtro aplicado.
    // Recebe: pedidos filtrados por entrega.
    // Retorna: totais de entregas, dias, frete acumulado e quantidade com frete cobrado.
    const deliverySummary = useMemo(() => {
        const daySet = new Set();
        let deliveriesCount = 0;
        let paidDeliveriesCount = 0;
        let totalDeliveryFee = 0;

        filteredDeliveryOrders.forEach((order) => {
            deliveriesCount += 1;
            const currentDeliveryFee = Math.max(0, Number(order.deliveryFee || 0));
            totalDeliveryFee += currentDeliveryFee;
            if (currentDeliveryFee > 0) paidDeliveriesCount += 1;
            const orderDateKey = getDeliveryDateKeyFromOrder(order);
            if (orderDateKey) daySet.add(orderDateKey);
        });

        return {
            deliveriesCount,
            paidDeliveriesCount,
            totalDeliveryFee,
            activeDaysCount: daySet.size,
        };
    }, [filteredDeliveryOrders, getDeliveryDateKeyFromOrder]);

    // Agrupa pedidos filtrados por dia e campanha para auditoria diária de entregas.
    // Recebe: lista filtrada de pedidos com entrega.
    // Retorna: array ordenado com data, campanha, total de entregas e soma de frete por dia.
    const dailyCampaignSummary = useMemo(() => {
        const grouped = {};

        filteredDeliveryOrders.forEach((order) => {
            const orderDateKey = getDeliveryDateKeyFromOrder(order) || 'sem-data';
            const orderCampaignId = normalizeCampaignId(order?.campaignId, CAMPAIGN_LEGACY_ID);
            const groupKey = `${orderDateKey}|${orderCampaignId}`;
            if (!grouped[groupKey]) {
                grouped[groupKey] = {
                    orderDateKey,
                    campaignId: orderCampaignId,
                    campaignName: driverCampaignNameMap[orderCampaignId] || CAMPAIGN_DEFAULT_NAME,
                    deliveriesCount: 0,
                    paidDeliveriesCount: 0,
                    totalDeliveryFee: 0,
                };
            }
            const currentDeliveryFee = Math.max(0, Number(order.deliveryFee || 0));
            grouped[groupKey].deliveriesCount += 1;
            grouped[groupKey].totalDeliveryFee += currentDeliveryFee;
            if (currentDeliveryFee > 0) grouped[groupKey].paidDeliveriesCount += 1;
        });

        return Object.values(grouped).sort((a, b) => {
            if (a.orderDateKey === b.orderDateKey) return safeText(a.campaignName).localeCompare(safeText(b.campaignName));
            return safeText(b.orderDateKey).localeCompare(safeText(a.orderDateKey));
        });
    }, [filteredDeliveryOrders, getDeliveryDateKeyFromOrder, driverCampaignNameMap]);

    const visibleDrivers = useMemo(() => {
        if (driverFilterId === 'all') return drivers;
        return drivers.filter((driver) => driver.id === driverFilterId);
    }, [drivers, driverFilterId]);

    // Estatísticas de entregas por entregador
    const driverStats = useMemo(() => {
        const now = new Date();
        const todayStr = normalizeDateOnlyValue(now, getTodayStr());
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const stats = {};
        drivers.forEach(d => { stats[d.id] = { today: 0, week: 0, total: 0, pending: 0, totalDeliveryFee: 0 }; });

        filteredDeliveryOrders.forEach(o => {
            if (!o.driverId || !stats[o.driverId]) return;
            const s = stats[o.driverId];
            s.total++;
            s.totalDeliveryFee += Math.max(0, Number(o.deliveryFee || 0));
            if (normalizeText(o.status).toLowerCase() !== 'concluido') s.pending++;
            const deliveryDateKey = getDeliveryDateKeyFromOrder(o);
            if (deliveryDateKey === todayStr) s.today++;
            const oDate = deliveryDateKey ? new Date(deliveryDateKey + 'T00:00:00') : null;
            if (oDate && oDate >= weekAgo) s.week++;
        });
        return stats;
    }, [drivers, filteredDeliveryOrders, getDeliveryDateKeyFromOrder]);

    const clearDeliveryFilters = useCallback(() => {
        setDriverFilterId('all');
        setCampaignFilterId('all');
        setStartDateFilter('');
        setEndDateFilter('');
    }, []);

    const inp = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: '500', outline: 'none', background: '#fff', color: 'var(--primary)', fontFamily: 'inherit' };

    if (loading) return (
        <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', textAlign: 'center' }}>
            <i className="ph-bold ph-spinner" style={{ fontSize: '24px', color: 'var(--primary)', animation: 'spin 1s linear infinite' }}></i>
            <p style={{ color: 'var(--s500)', marginTop: '12px' }}>Carregando entregadores...</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '1.5rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ph-bold ph-motorcycle" style={{ fontSize: '22px', color: 'var(--gold)' }}></i>
                        Cadastro de Entregadores
                    </h2>
                    <p style={{ color: 'var(--s500)', fontSize: '13px', marginTop: '4px' }}>{drivers.length} entregador{drivers.length !== 1 ? 'es' : ''} cadastrado{drivers.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'var(--cream)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph-bold ph-plus" style={{ fontSize: '16px' }}></i> Novo Entregador
                </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '1.25rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph-bold ph-funnel" style={{ color: 'var(--gold)' }}></i>
                    Filtro Profissional de Entregas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px' }}>
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s500)' }}>Entregador</label>
                        <select style={inp} value={driverFilterId} onChange={e => setDriverFilterId(e.target.value)}>
                            <option value="all">Todos os entregadores</option>
                            {drivers.map(driver => (
                                <option key={driver.id} value={driver.id}>{safeText(driver.name, 'Sem nome')}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s500)' }}>Campanha</label>
                        <select style={inp} value={campaignFilterId} onChange={e => setCampaignFilterId(e.target.value)}>
                            <option value="all">Todas as campanhas</option>
                            {driverCampaignOptions.map(campaign => (
                                <option key={campaign.id} value={campaign.id}>{safeText(campaign.nome, CAMPAIGN_DEFAULT_NAME)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s500)' }}>Data Inicial</label>
                        <input type="date" style={inp} value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s500)' }}>Data Final</label>
                        <input type="date" style={inp} value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} />
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--s600)', fontWeight: '600' }}>
                        {deliverySummary.deliveriesCount} entrega(s) • {deliverySummary.paidDeliveriesCount} com frete cobrado • {deliverySummary.activeDaysCount} dia(s) • R$ {deliverySummary.totalDeliveryFee.toFixed(2).replace('.', ',')} em fretes
                    </span>
                    <button onClick={clearDeliveryFilters} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: 'var(--s600)', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                        Limpar filtros
                    </button>
                </div>
            </div>

            {/* Resumo geral */}
            {drivers.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem' }}>
                    <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#166534', marginBottom: '6px' }}>Entregas Hoje</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: '#16a34a', lineHeight: 1 }}>{drivers.reduce((s, d) => s + (driverStats[d.id]?.today || 0), 0)}</p>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: '6px' }}>Semana (7d)</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: '#2563eb', lineHeight: 1 }}>{drivers.reduce((s, d) => s + (driverStats[d.id]?.week || 0), 0)}</p>
                    </div>
                    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#92400e', marginBottom: '6px' }}>Pendentes</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: '#d97706', lineHeight: 1 }}>{drivers.reduce((s, d) => s + (driverStats[d.id]?.pending || 0), 0)}</p>
                    </div>
                    <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#7c3aed', marginBottom: '6px' }}>Total Geral</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: '#7c3aed', lineHeight: 1 }}>{drivers.reduce((s, d) => s + (driverStats[d.id]?.total || 0), 0)}</p>
                    </div>
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#9a3412', marginBottom: '6px' }}>Frete Total (Filtro)</p>
                        <p style={{ fontSize: '1.7rem', fontWeight: '900', color: '#c2410c', lineHeight: 1 }}>R$ {deliverySummary.totalDeliveryFee.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            )}

            {dailyCampaignSummary.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '1rem 1.25rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ph-bold ph-calendar-check" style={{ color: 'var(--gold)' }}></i>
                        Consolidado por Dia e Campanha
                    </h3>
                    <div style={{ overflowX: 'auto' }} className="hide-scrollbar">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px', fontSize: '12px' }}>
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Dia</th>
                                    <th style={{ padding: '8px', textAlign: 'left' }}>Campanha</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Entregas</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>Entregas c/ Frete</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>Frete Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyCampaignSummary.map((item) => {
                                    return (
                                        <tr key={`${item.orderDateKey}-${item.campaignId}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '8px', fontWeight: '700', color: 'var(--primary)' }}>{item.orderDateKey === 'sem-data' ? 'Sem data' : formatDateStr(item.orderDateKey)}</td>
                                            <td style={{ padding: '8px', color: 'var(--s600)' }}>{safeText(item.campaignName, CAMPAIGN_DEFAULT_NAME)}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', color: '#1d4ed8' }}>{item.deliveriesCount}</td>
                                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', color: '#0369a1' }}>{item.paidDeliveriesCount}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900', color: '#c2410c' }}>R$ {item.totalDeliveryFee.toFixed(2).replace('.', ',')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Formulário */}
            {showForm && (
                <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '1.5rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', border: '2px solid var(--gold)' }}>
                    <h3 style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ph-bold ph-user-plus" style={{ color: 'var(--gold)' }}></i>
                        {editDriver ? 'Editar Entregador' : 'Novo Entregador'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Nome *</label>
                            <input id="driver-name" name="driverName" style={inp} placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>WhatsApp *</label>
                            <input id="driver-phone" name="driverPhone" style={inp} type="tel" placeholder="Ex: 88981577625" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} autoComplete="tel" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Veículo</label>
                            <input id="driver-vehicle" name="driverVehicle" style={inp} placeholder="Ex: Moto, Bicicleta, Carro" value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} autoComplete="off" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)' }}>Placa</label>
                            <input id="driver-plate" name="driverPlate" style={{ ...inp, textTransform: 'uppercase' }} placeholder="Ex: ABC-1234" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} autoComplete="off" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>
                            <input type="checkbox" checked={form.active !== false} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }} />
                            Ativo
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'var(--cream)', fontWeight: '700', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                            {saving ? 'Salvando...' : editDriver ? 'Salvar Alterações' : 'Cadastrar'}
                        </button>
                        <button onClick={resetForm} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: 'var(--s500)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista */}
            {drivers.length === 0 && !showForm ? (
                <div style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', boxShadow: '0 8px 32px rgba(28,38,56,.08)', textAlign: 'center' }}>
                    <i className="ph-bold ph-motorcycle" style={{ fontSize: '48px', color: '#e2e8f0' }}></i>
                    <p style={{ color: 'var(--s500)', fontSize: '14px', marginTop: '12px' }}>Nenhum entregador cadastrado ainda.</p>
                    <p style={{ color: 'var(--s400)', fontSize: '12px', marginTop: '4px' }}>Clique em "Novo Entregador" para começar.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {visibleDrivers.map(d => {
                        const st = driverStats[d.id] || { today: 0, week: 0, total: 0, pending: 0, totalDeliveryFee: 0 };
                        return (
                            <div key={d.id} style={{ background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all .15s' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '9999px', background: d.active !== false ? '#ecfdf3' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="ph-bold ph-motorcycle" style={{ fontSize: '18px', color: d.active !== false ? '#16a34a' : '#94a3b8' }}></i>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px' }}>{safeText(d.name)}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '9999px', background: d.active !== false ? '#ecfdf3' : '#f1f5f9', color: d.active !== false ? '#166534' : '#64748b', border: `1px solid ${d.active !== false ? '#bbf7d0' : '#e2e8f0'}` }}>{d.active !== false ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                        {d.phone && <span style={{ fontSize: '12px', color: 'var(--s500)', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-phone" style={{ fontSize: '12px' }}></i>{d.phone}</span>}
                                        {d.vehicle && <span style={{ fontSize: '12px', color: 'var(--s500)', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ph-bold ph-car" style={{ fontSize: '12px' }}></i>{d.vehicle}</span>}
                                        {d.plate && <span style={{ fontSize: '12px', color: 'var(--s500)', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}><i className="ph-bold ph-identification-card" style={{ fontSize: '12px' }}></i>{d.plate}</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#ecfdf3', color: '#166534', border: '1px solid #bbf7d0' }}>Hoje: {st.today}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>7d: {st.week}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#fefce8', color: '#92400e', border: '1px solid #fde68a' }}>Pend.: {st.pending}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#fdf4ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>Total: {st.total}</span>
                                        {st.totalDeliveryFee > 0 && <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>Frete: R$ {st.totalDeliveryFee.toFixed(2)}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => startEdit(d)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="ph-bold ph-pencil-simple" style={{ fontSize: '14px' }}></i>
                                    </button>
                                    <button onClick={() => handleDelete(d)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #fecdd3', background: '#fff', cursor: 'pointer', color: '#ef4444', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <i className="ph-bold ph-trash" style={{ fontSize: '14px' }}></i>
                                    </button>
                                    {d.phone && (
                                        <a href={`https://wa.me/${formatPhoneForWhatsApp(d.phone)}`} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#ecfdf3', cursor: 'pointer', color: '#166534', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                            <i className="ph-bold ph-whatsapp-logo" style={{ fontSize: '14px' }}></i>
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {visibleDrivers.length === 0 && (
                        <div style={{ background: '#fff', borderRadius: '1rem', border: '1px dashed #cbd5e1', padding: '1.25rem', textAlign: 'center' }}>
                            <p style={{ color: 'var(--s600)', fontSize: '13px', fontWeight: '600' }}>Nenhum entregador encontrado para os filtros aplicados.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

var BrandLogo = (window.HeloComponents && window.HeloComponents.BrandLogo)
    ? window.HeloComponents.BrandLogo
    : React.memo(({ scale = 1, offsetY = 0 }) => (
        <div className="brand-mark-wrap" style={{ transform: `translateY(${offsetY}px) scale(${scale})`, transformOrigin: 'center center' }}>
            <div
                className="brand-logo-image"
                role="img"
                aria-label="Helô Confeitaria"
            />
        </div>
    ));

var Cabecalho = (window.HeloComponents && window.HeloComponents.Cabecalho)
    ? window.HeloComponents.Cabecalho
    : React.memo(({ cart, onOpenCart }) => {
        const cartCount = cart.reduce((acc, item) => acc + (Number(item?.qty) || 0), 0);

        return (
            <button
                onClick={onOpenCart}
                className="floating-cart-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}
                aria-label="Abrir carrinho"
            >
                <i className="ph-bold ph-shopping-cart" style={{ fontSize: '22px' }}></i>
                {cartCount > 0 && <span className="top-cart-badge animate-bounce">{cartCount}</span>}
            </button>
        );
    });

var RodapeSite = (window.HeloComponents && window.HeloComponents.RodapeSite)
    ? window.HeloComponents.RodapeSite
    : React.memo(({ onOpenLogin, operationDays = 'Quarta a domingo', operationHours = '14:30hrs às 20hrs' }) => (
        <footer style={{ marginTop: 'auto', background: 'var(--primary)', paddingTop: '2.4rem', paddingBottom: '1.4rem', borderTop: '6px solid var(--cream)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '2.5rem', opacity: .05, transform: 'rotate(12deg)', pointerEvents: 'none' }}>
                <i className="ph-fill ph-crown" style={{ fontSize: '200px', color: 'var(--cream)' }}></i>
            </div>
            <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.4rem' }}>
                    {[
                        { href: 'https://instagram.com/heloconfeitaria10', icon: 'ph-instagram-logo' },
                        { href: 'https://tiktok.com/@heloconfeitaria10', icon: 'ph-tiktok-logo' },
                        { href: 'https://wa.me/5588981577625', icon: 'ph-whatsapp-logo' },
                    ].map(({ href, icon }) => (
                        <a key={icon} href={href} target="_blank" rel="noreferrer"
                            style={{ width: '48px', height: '48px', background: 'var(--cream)', color: 'var(--primary)', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', boxShadow: '0 10px 15px -3px rgba(0,0,0,.1)', position: 'relative', zIndex: 3, pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation' }}
                            onClick={e => {
                                e.preventDefault();
                                const opened = window.open(href, '_blank', 'noopener,noreferrer');
                                if (!opened) window.location.href = href;
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--cream)'; e.currentTarget.style.transform = ''; }}>
                            <i className={`ph-bold ${icon}`} style={{ fontSize: '24px' }}></i>
                        </a>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: 'rgba(243,212,148,.8)', fontSize: '14px', marginBottom: '1.1rem', fontWeight: '500' }}>
                    <a href="https://maps.app.goo.gl/FrmNpC4iGrVxfw8u9" target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(243,212,148,.8)'}>
                        <i className="ph-fill ph-map-pin" style={{ fontSize: '20px', color: 'var(--cream)' }}></i>
                        Rua Anastácio Paulo de Sousa, 63 - Nova Aldeota
                    </a>
                    <a href="https://wa.me/5588981577625" target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'color .15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(243,212,148,.8)'}>
                        <i className="ph-fill ph-whatsapp-logo" style={{ fontSize: '20px', color: 'var(--cream)' }}></i>
                        (88) 98157-7625
                    </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.8rem', background: 'rgba(243,212,148,.08)', border: '1px solid rgba(243,212,148,.2)', borderRadius: '16px', padding: '10px 20px' }}>
                    <i className="ph-bold ph-clock" style={{ fontSize: '16px', color: 'var(--cream)' }}></i>
                    <span style={{ fontSize: '13px', color: 'rgba(243,212,148,.9)', fontWeight: '600', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
                        <strong style={{ color: 'var(--cream)' }}>{operationDays}</strong>
                        <span>{operationHours}</span>
                    </span>
                </div>
                <button onClick={onOpenLogin}
                    style={{ fontSize: '9px', color: 'rgba(243,212,148,.4)', textTransform: 'uppercase', letterSpacing: '.3em', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', transition: 'color .15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(243,212,148,.4)'}>
                    Acesso Reservado
                </button>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,.18)', marginTop: '1rem', letterSpacing: '.04em' }}>
                    Feito por <span className="animate-neon-pulse" style={{ fontWeight: '800' }}>Couto</span>
                </p>
            </div>
        </footer>
    ));

var VitrineProdutos = (window.HeloComponents && window.HeloComponents.VitrineProdutos)
    ? ((props) => {
        const ExternalVitrineProdutos = window.HeloComponents.VitrineProdutos;
        return (
            <ExternalVitrineProdutos
                {...props}
                buildMenuTabOptions={buildMenuTabOptions}
                dedupeProductsByIdentity={dedupeProductsByIdentity}
                normalizeProductForMenu={normalizeProductForMenu}
                resolveProductMenuTab={resolveProductMenuTab}
                getMenuTabLabel={getMenuTabLabel}
                normalizeProductImages={normalizeProductImages}
                installmentText={installmentText}
                fmtBRL={fmtBRL}
                ProductCard={ProductCard}
                ProdutoModal={ProdutoModal}
            />
        );
    })
    : React.memo(({
    siteSettings,
    safeText,
    enableScarcityBanner,
    deadlinePassed,
    deadlineLabelBanner,
    ordersLoaded,
    remainingUnits,
    progressPercent,
    searchTerm,
    onSearchTermChange,
    filteredProducts,
    onAddToCart,
    bestSellerNames,
}) => {
    const [selectedCategory, setSelectedCategory] = React.useState('all');
    const [selectedProduct, setSelectedProduct] = React.useState(null);

    const menuTabOptions = React.useMemo(
        () => buildMenuTabOptions({ siteSettings, products: filteredProducts }),
        [siteSettings, filteredProducts],
    );

    const normalizedFilteredProducts = React.useMemo(
        () => dedupeProductsByIdentity(filteredProducts).map(product => normalizeProductForMenu(product, menuTabOptions)),
        [filteredProducts, menuTabOptions],
    );

    const categoryGroups = React.useMemo(() => {
        const groups = {};
        normalizedFilteredProducts.forEach((p) => {
            const key = resolveProductMenuTab(p, menuTabOptions);
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [normalizedFilteredProducts, menuTabOptions]);

    const categories = React.useMemo(() => {
        const groupedKeys = Object.keys(categoryGroups);
        const orderedKeys = menuTabOptions.map(option => option.key).filter((key) => groupedKeys.includes(key));
        const unknownKeys = groupedKeys.filter((key) => !orderedKeys.includes(key));
        return ['all', ...orderedKeys, ...unknownKeys];
    }, [categoryGroups, menuTabOptions]);

    React.useEffect(() => {
        if (!categories.includes(selectedCategory)) setSelectedCategory('all');
    }, [categories, selectedCategory]);

    const visibleProducts = selectedCategory === 'all'
        ? normalizedFilteredProducts
        : (categoryGroups[selectedCategory] || []);

    const parseOptions = (value) => {
        const txt = safeText(value).trim();
        if (!txt) return [];
        return txt
            .split(/\||,|\//)
            .map(part => part.trim())
            .filter(Boolean);
    };

    return (
    <div className="catalog-shell">

        {/* Banner de Aviso / Propaganda (Modo Livre ou qualquer modo com aviso ativo) */}
        {siteSettings.enableAnnouncement && safeText(siteSettings.announcementText) && (() => {
            const annStyles = {
                info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', icon: 'ph-info' },
                success: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0', icon: 'ph-megaphone' },
                warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: 'ph-warning' },
                gold: { bg: 'linear-gradient(135deg,#CFA860,#B58E45)', color: '#fff', border: '#B58E45', icon: 'ph-star' },
                dark: { bg: 'var(--primary)', color: 'var(--cream)', border: 'var(--primary)', icon: 'ph-megaphone' },
            };
            const s = annStyles[siteSettings.announcementStyle] || annStyles.info;
            return (
                <div className="premium-banner" style={{ background: s.bg, border: `1px solid ${s.border}`, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <i className={`ph-bold ${s.icon}`} style={{ fontSize: '24px', color: s.color, flexShrink: 0 }}></i>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: s.color, lineHeight: 1.5, flex: 1 }}>{siteSettings.announcementText}</p>
                </div>
            );
        })()}

        {/* Banner de Escassez e Urgência (só no Modo Evento com banner ativo) */}
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

                    {/* Barra de Progresso visual */}
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

        {/* Banner de Regras e Políticas */}
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

        {/* Search Bar */}
        <div className="search-shell">
            <i className="ph-bold ph-magnifying-glass" style={{ color: 'var(--cream)', fontSize: '20px' }}></i>
            <input type="text" placeholder="Procurar um sabor..."
                style={{ background: 'none', border: 'none', color: 'var(--cream)', outline: 'none', width: '100%', padding: '0 8px', fontFamily: 'inherit', fontSize: '14px' }}
                value={searchTerm} onChange={e => onSearchTermChange(e.target.value)} />
        </div>

        <div style={{ gridColumn: '1/-1', display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            {categories.map((cat) => {
                const active = cat === selectedCategory;
                const label = cat === 'all' ? 'Todas as categorias' : getMenuTabLabel(cat, menuTabOptions);
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
                {selectedCategory === 'all' ? 'Vitrine completa' : getMenuTabLabel(selectedCategory, menuTabOptions)}
            </h3>
            <span className="catalog-premium-meta" style={{ fontSize: '12px', fontWeight: '700' }}>{visibleProducts.length} item(ns)</span>
        </div>

        {visibleProducts.length > 0 ? visibleProducts.map(p => <ProductCard key={p.id} product={p} onAdd={onAddToCart} onOpenDetails={setSelectedProduct} isBestSeller={bestSellerNames.has(safeText(p.name).trim())} normalizeProductImages={normalizeProductImages} safeText={safeText} installmentText={installmentText} fmtBRL={fmtBRL} />) : (
            <div style={{ gridColumn: '1/-1', border: '1px dashed #d6deeb', background: '#f8fafc', color: 'var(--s500)', borderRadius: '18px', padding: '20px', textAlign: 'center' }}>
                Nenhum item disponível em {selectedCategory === 'all' ? 'todas as categorias' : getMenuTabLabel(selectedCategory, menuTabOptions)} no momento.
            </div>
        )}

        {selectedProduct && (
            <ProdutoModal
                product={selectedProduct}
                sizeOptions={parseOptions(selectedProduct.size)}
                flavorOptions={parseOptions(selectedProduct.flavors || selectedProduct.sabores || selectedProduct.tag)}
                onClose={() => setSelectedProduct(null)}
                onAdd={(payload) => {
                    onAddToCart(payload);
                    setSelectedProduct(null);
                }}
            />
        )}
    </div>
);
});

const ProdutoModal = React.memo(({ product, sizeOptions, flavorOptions, onClose, onAdd }) => {
    const allImages = React.useMemo(() => {
        const imgs = normalizeProductImages(product);
        return imgs.length > 0 ? imgs : ['https://res.cloudinary.com/djj7r3ljl/image/upload/v1775978775/Mini_Studio_Helo%CC%82_Conf_page-0001_zb5wap.jpg'];
    }, [product]);

    const [imgIdx, setImgIdx] = React.useState(0);
    const [selectedSize, setSelectedSize] = React.useState(sizeOptions[0] || safeText(product.size).trim());
    const [selectedFlavor, setSelectedFlavor] = React.useState(flavorOptions[0] || '');
    const hasSizes = sizeOptions.length > 1;
    const hasFlavors = flavorOptions.length > 1;
    const hasGallery = allImages.length > 1;

    React.useEffect(() => {
        setImgIdx(0);
    }, [product?.id, allImages.length]);

    React.useEffect(() => {
        if (!hasGallery) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowLeft') setImgIdx((current) => (current - 1 + allImages.length) % allImages.length);
            if (event.key === 'ArrowRight') setImgIdx((current) => (current + 1) % allImages.length);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [allImages.length, hasGallery]);

    const showPrevImage = () => setImgIdx((current) => (current - 1 + allImages.length) % allImages.length);
    const showNextImage = () => setImgIdx((current) => (current + 1) % allImages.length);

    const productToCart = React.useMemo(() => ({
        ...product,
        selectedSize,
        selectedFlavor,
    }), [product, selectedSize, selectedFlavor]);

    // Bloco duplicado removido: painel admin já está implementado acima
    // Nota: Ao remover blocos condicionais JSX, certifique-se de fechar corretamente com )}

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 220,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: 'calc(env(safe-area-inset-top, 0px) + 6.6rem) 1rem 1rem',
        }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,.65)', backdropFilter: 'blur(3px)' }} onClick={onClose}></div>
            <div className="section-enter" style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                maxWidth: '860px',
                maxHeight: 'calc(100dvh - 8rem)',
                marginBottom: '1rem',
                background: '#fff',
                borderRadius: '1.2rem',
                overflowY: 'auto',
                overflowX: 'hidden',
                border: '1px solid #dbe4f4',
                boxShadow: '0 30px 60px -24px rgba(42,61,93,.38)',
            }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(17,24,39,.75)', color: '#fff', cursor: 'pointer', zIndex: 2 }}>
                    <i className="ph-bold ph-x" style={{ fontSize: '18px' }}></i>
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '1rem' }}>
                    <div style={{ position: 'relative', height: 'clamp(220px,40vw,340px)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                        <img src={allImages[imgIdx]} alt={safeText(product.name)} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
                        {hasGallery && (
                            <>
                                <button onClick={showPrevImage} aria-label="Ver foto anterior" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '9999px', border: 'none', background: 'rgba(255,255,255,.94)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,.18)' }}>
                                    <i className="ph-bold ph-caret-left" style={{ fontSize: '18px' }}></i>
                                </button>
                                <button onClick={showNextImage} aria-label="Ver proxima foto" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '9999px', border: 'none', background: 'rgba(255,255,255,.94)', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px rgba(15,23,42,.18)' }}>
                                    <i className="ph-bold ph-caret-right" style={{ fontSize: '18px' }}></i>
                                </button>
                                <div style={{ position: 'absolute', top: '12px', left: '12px', padding: '5px 9px', borderRadius: '9999px', background: 'rgba(17,24,39,.72)', color: '#fff', fontSize: '11px', fontWeight: '800', letterSpacing: '.04em' }}>
                                    {imgIdx + 1} / {allImages.length}
                                </div>
                            </>
                        )}
                        {hasGallery && (
                            <div style={{ position: 'absolute', left: '50%', bottom: '10px', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                                {allImages.map((_, i) => (
                                    <button key={i} onClick={() => setImgIdx(i)} style={{ width: i === imgIdx ? '18px' : '8px', height: '8px', borderRadius: '9999px', border: 'none', background: i === imgIdx ? 'var(--gold)' : 'rgba(255,255,255,.8)', cursor: 'pointer' }}></button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '0 1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {hasGallery && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: '8px' }}>
                                {allImages.map((src, index) => (
                                    <button key={`${safeText(product.id, safeText(product.name, 'produto'))}-thumb-${index}`} onClick={() => setImgIdx(index)} aria-label={`Ver foto ${index + 1}`} style={{ border: index === imgIdx ? '2px solid var(--gold)' : '1px solid #dbe4f5', borderRadius: '12px', overflow: 'hidden', padding: 0, background: '#fff', cursor: 'pointer', aspectRatio: '1', boxShadow: index === imgIdx ? '0 10px 24px rgba(135,95,0,.18)' : 'none' }}>
                                        <img src={src} alt={`${safeText(product.name)} miniatura ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    </button>
                                ))}
                            </div>
                        )}
                        <h3 className="brand-copy" style={{ color: 'var(--primary)', fontSize: '1.45rem', fontWeight: '900', lineHeight: 1.2 }}>{safeText(product.name)}</h3>
                        <p style={{ color: 'var(--s500)', fontSize: '14px', lineHeight: 1.55 }}>{safeText(product.desc, safeText(product.weight, 'Doce artesanal da Helô Confeitaria.'))}</p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {selectedSize && <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', background: '#eef3fb', border: '1px solid #d9e4f6', padding: '6px 10px', borderRadius: '9999px' }}>Tamanho: {selectedSize}</span>}
                            {selectedFlavor && <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', background: '#eef3fb', border: '1px solid #d9e4f6', padding: '6px 10px', borderRadius: '9999px' }}>Sabor: {selectedFlavor}</span>}
                        </div>

                        {hasSizes && (
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>Escolha o tamanho</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {sizeOptions.map((size) => (
                                        <button key={size} onClick={() => setSelectedSize(size)} style={{ border: selectedSize === size ? '1px solid var(--gold)' : '1px solid #d9e4f6', background: selectedSize === size ? 'rgba(135,95,0,.1)' : '#fff', color: selectedSize === size ? 'var(--gold)' : 'var(--primary)', borderRadius: '9999px', padding: '7px 12px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>{size}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hasFlavors && (
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>Escolha o sabor</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {flavorOptions.map((flavor) => (
                                        <button key={flavor} onClick={() => setSelectedFlavor(flavor)} style={{ border: selectedFlavor === flavor ? '1px solid var(--gold)' : '1px solid #d9e4f6', background: selectedFlavor === flavor ? 'rgba(135,95,0,.1)' : '#fff', color: selectedFlavor === flavor ? 'var(--gold)' : 'var(--primary)', borderRadius: '9999px', padding: '7px 12px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>{flavor}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div>
                                <p style={{ fontSize: '12px', color: 'var(--s500)', fontWeight: '700' }}>Preço</p>
                                <p style={{ fontSize: '1.5rem', color: 'var(--gold)', fontWeight: '900' }}>R$ {fmtBRL(product.price)}</p>
                            </div>
                            <button onClick={() => onAdd(productToCart)} className="cta-gold" style={{ padding: '12px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph-bold ph-shopping-cart" style={{ fontSize: '18px' }}></i> Adicionar ao carrinho
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

if (typeof window !== 'undefined') {
    window.FeedbackExperience = FeedbackExperience;
    window.AdminPanel = AdminPanel;
}
