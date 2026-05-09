/* ═══════════════════════════════════════════════════════════════════════
   cart-ui.js — COMPONENTE DE INTERFACE DO CARRINHO DE COMPRAS
   ═══════════════════════════════════════════════════════════════════════
   Este é o componente visual do carrinho lateral (drawer) que aparece
   quando o cliente clica no ícone de compras. É memoizado com
   React.memo para evitar re-renderizações desnecessárias.

   Props principais (recebidas de main-app.js):
   - open / onCloseDrawer → Controla abertura/fechamento do drawer
   - cart / updateQty → Itens no carrinho e função de alterar quantidade
   - customerName / customerPhone → Dados do cliente
   - isVip → Cliente especial (desconto 10% automático)
   - orderDate / orderTime → Data e hora da entrega (modo evento)
   - isDayToDayMode / dayToDayOperation* → Info de funcionamento
   - deliveryMethod → 'retirada' ou 'entrega'
   - isDeliveryAvailable → Controle admin de entrega ativa/desativa
   - street / neighborhood / reference → Endereço de entrega
   - orderObservations → Campo livre para personalizações
   - paymentMethod → 'PIX', 'Dinheiro' ou 'Cartão'
   - cashChangeFor → Troco para pagamento em dinheiro
   - cardInstallments → Parcelas do cartão (1, 2 ou 3)
   - appliedCoupon / couponInput / applyCoupon → Sistema de cupons
   - total / subtotal / discountValue / finalDelivery / cardFeeValue → Valores
   - pixKey / handleCopyPix / pixCopied → Pagamento PIX
   - saveAndSend → Função que envia o pedido para o Firebase
   - fmtBRL → Formata valor em reais
   - CARD_INSTALLMENT_RATES / DELIVERY_FEE → Constantes financeiras

   Estrutura JSX (resumo):
   1. Overlay escuro + Painel lateral (drawer) com animação
   2. Cabeçalho com título "Pedido" e botão fechar
   3. Se conteúdo: lista de itens (CartItem) + formulário de dados
   4. Se vazio: mensagem "O carrinho está vazio"
   5. Formulário dividido em seções:
      a) Dados principais (nome, WhatsApp, VIP badge)
      b) Data/hora (modo evento) ou info de funcionamento (dia a dia)
      c) Cupom de desconto
      d) Aviso de entrega indisponível (se admin desativou)
      e) Botões BUSCAR / ENTREGA
      f) Campos de entrega (rua, bairro, referência)
         OU card de retirada (endereço da loja + mapa)
      g) Observações do pedido (campo destaque laranja)
      h) Forma de pagamento (PIX / Dinheiro / Cartão)
         - PIX: chave + botão copiar + aviso de comprovante
         - Dinheiro: campo obrigatório de troco
         - Cartão: seletor de parcelas (1x, 2x, 3x)
   6. Painel de resumo (subtotal, desconto, frete, taxa cartão, total)
   7. Botão FINALIZAR PEDIDO (com loader se salvando)
   ═══════════════════════════════════════════════════════════════════════ */
const formatCartCurrency = (value, fmtBRL) => {
    const numericValue = Number(value) || 0;
    if (typeof fmtBRL === 'function') return fmtBRL(numericValue);
    return numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const CartItem = React.memo(({ item, onQty, fmtBRL, installmentText }) => {
    const itemTotal = Number(item.price) * Number(item.qty);
    const installmentInfo = typeof installmentText === 'function'
        ? installmentText(item.price, item.installment)
        : null;

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9' }}>
            <div style={{ flex: 1 }}>
                <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '14px', display: 'block' }}>{item.qty}x {item.name}</span>
                <div style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>R$ {formatCartCurrency(itemTotal, fmtBRL)}</div>
                {installmentInfo && (
                    <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#166534', background: '#ecfdf3', border: '1px solid #bbf7d0', display: 'inline-block', padding: '4px 8px', borderRadius: '9999px' }}>Ate 3x: {installmentInfo}</div>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <button onClick={() => onQty(item.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', lineHeight: 1 }}><i className="ph-bold ph-minus"></i></button>
                <span style={{ fontWeight: '700', fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => onQty(item.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', lineHeight: 1 }}><i className="ph-bold ph-plus"></i></button>
            </div>
        </div>
    );
});

const CarrinhoCompras = React.memo(({
    open,
    isSaving,
    onCloseDrawer,
    cart,
    updateQty,
    inp,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    isVip,
    todayStr,
    orderDate,
    setOrderDate,
    orderTime,
    setOrderTime,
    appliedCoupon,
    couponInput,
    setCouponInput,
    setAppliedCoupon,
    applyCoupon,
    btnMethod,
    deliveryMethod,
    setDeliveryMethod,
    street,
    setStreet,
    neighborhood,
    setNeighborhood,
    reference,
    setReference,
    orderObservations,
    setOrderObservations,
    paymentMethod,
    setPaymentMethod,
    cashChangeFor,
    setCashChangeFor,
    cardInstallments,
    setCardInstallments,
    total,
    totalWithCardFee,
    installmentRate,
    pixKey,
    handleCopyPix,
    pixCopied,
    subtotal,
    discountValue,
    specialApplied,
    finalDelivery,
    cardFeeValue,
    payableTotal,
    installmentQty,
    installmentAmount,
    saveAndSend,
    fmtBRL,
    installmentText,
    CARD_INSTALLMENT_RATES,
    DELIVERY_FEE,
    isDayToDayMode,
    dayToDayOperationDays,
    dayToDayOperationHours,
    isDeliveryAvailable = true,
    nomeTitularPix = '',
}) => {
    /* ── Efeito: força retirada se entrega estiver desativada pelo admin ──
       Quando isDeliveryAvailable muda para false e o cliente estava
       com "entrega" selecionado, automaticamente muda para "retirada". */
    React.useEffect(() => {
        if (!isDeliveryAvailable && deliveryMethod === 'entrega') {
            setDeliveryMethod('retirada');
        }
    }, [isDeliveryAvailable, deliveryMethod, setDeliveryMethod]);

    /* Se fechado, mantem os hooks estaveis e nao renderiza o drawer. */
    if (!open) return null;

    /* ════════════════════════════════════════════════════════════════
       ESTRUTURA JSX — Drawer lateral do carrinho
       ══════════════════════════════════════════════════════════════════
       1. Fundo escuro (overlay) — clicar fecha o drawer
       2. Painel lateral (max 28rem) com animação de slide
       3. Cabeçalho: ícone sacola + título "Pedido" + botão fechar
       4. Área scrollável com conteúdo:
          - Carrinho vazio → ícone + mensagem
          - Carrinho com itens → lista CartItem + seções do formulário
       5. Seções do formulário (quando há itens):
          a) Dados principais: nome, WhatsApp, badge VIP
          b) Modo evento: campos de data/hora da entrega
             Modo dia a dia: card de horário de funcionamento
          c) Campo de cupom de desconto
          d) Aviso de entrega indisponível (se admin desativou)
          e) Botões BUSCAR (retirada) / ENTREGA (com taxa)
          f) Se ENTREGA: campos de endereço + observações + pagamento
             Se RETIRADA: card com endereço da loja + observações + pagamento
          g) Pagamento: PIX (chave + copiar) / Dinheiro (troco) / Cartão (parcelas)
       6. Painel resumo fixo no fundo: subtotal, desconto, frete, taxa, total
       7. Botão FINALIZAR PEDIDO (com spinner se salvando)
       ══════════════════════════════════════════════════════════════════ */
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden', clipPath: 'inset(0)' }}>
            <div className="cart-overlay" onClick={() => !isSaving && onCloseDrawer()}></div>
            <div style={{ width: '100%', maxWidth: '28rem', height: '100%', position: 'relative', zIndex: 110, padding: 'clamp(1rem, 4vw, 2rem)', display: 'flex', flexDirection: 'column' }} className="animate-slide-right cart-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'uppercase', letterSpacing: '-.05em' }}>
                        <i className="ph-bold ph-shopping-bag" style={{ fontSize: '1.875rem', color: 'var(--gold)' }}></i> Pedido
                    </h2>
                    <button onClick={onCloseDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '9999px', lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <i className="ph-bold ph-x" style={{ fontSize: '24px', color: 'var(--s500)' }}></i>
                    </button>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="hide-scrollbar">
                    {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--s300)', display: 'flex', flexDirection: 'column', alignItems: 'center', fontStyle: 'italic' }}>
                            <i className="ph-fill ph-basket" style={{ fontSize: '4rem', marginBottom: '1rem', opacity: .3, color: 'var(--gold)' }}></i>
                            O carrinho está vazio...
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {cart.map(i => <CartItem key={i.id} item={i} onQty={updateQty} fmtBRL={fmtBRL} installmentText={installmentText} />)}
                            </div>

                            <div className="cart-section" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <h4 style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="ph-bold ph-user" style={{ color: 'var(--gold)' }}></i> Dados Principais
                                </h4>
                                <input id="customer-name" name="customerName" style={inp} type="text" placeholder="Nome Completo" value={customerName} onChange={e => setCustomerName(e.target.value)} autoComplete="name" />
                                <input id="customer-phone" name="customerPhone" style={inp} type="tel" placeholder="Nº de WhatsApp (Ex: 88981577625)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))} autoComplete="tel" />

                                {isVip && (
                                    <div style={{ background: '#dcfce7', padding: '12px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'flex-start', gap: '12px' }} className="animate-fade-in">
                                        <span style={{ fontSize: '20px' }}>🌟</span>
                                        <div>
                                            <p style={{ fontSize: '10px', fontWeight: '900', color: '#166534', textTransform: 'uppercase', letterSpacing: '.1em' }}>Cliente Especial Helô</p>
                                            <p style={{ fontSize: '12px', color: '#15803d', fontWeight: '500', lineHeight: 1.4, marginTop: '4px' }}>Você atingiu R$300 em compras concluídas este mês! Desconto VIP de 10% aplicado automaticamente.</p>
                                        </div>
                                    </div>
                                )}

                                {!isDayToDayMode ? (
                                    <>
                                        <div style={{ background: 'rgba(28,38,56,.04)', borderRadius: '12px', padding: '10px 12px', border: '1px dashed rgba(28,38,56,.15)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <i className="ph-fill ph-package" style={{ fontSize: '18px', color: 'var(--gold)', marginTop: '1px', flexShrink: 0 }}></i>
                                            <div>
                                                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', marginBottom: '2px' }}>Quando quer receber sua encomenda?</p>
                                                <p style={{ fontSize: '11px', color: 'var(--s500)', lineHeight: 1.35 }}>Escolha dia e horário. Atendemos das 09h às 23h.</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div className="dt-wrap">
                                                <label className="dt-label" htmlFor="field-date"><i className="ph-bold ph-calendar" style={{ fontSize: '12px' }}></i> Dia da entrega</label>
                                                <input id="field-date" type="date" min={todayStr} value={orderDate} onChange={e => setOrderDate(e.target.value)} className={`dt-input${orderDate ? ' has-value' : ''}`} />
                                            </div>
                                            <div className="dt-wrap">
                                                <label className="dt-label" htmlFor="field-time"><i className="ph-bold ph-clock" style={{ fontSize: '12px' }}></i> Horário preferido</label>
                                                <input id="field-time" type="time" min="09:00" max="23:00" value={orderTime} onChange={e => setOrderTime(e.target.value)} className={`dt-input${orderTime ? ' has-value' : ''}`} style={{ textAlign: 'center' }} />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ background: 'rgba(22,163,74,.08)', borderRadius: '12px', padding: '10px 12px', border: '1px solid rgba(22,163,74,.25)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <i className="ph-fill ph-clock" style={{ fontSize: '18px', color: '#15803d', marginTop: '1px', flexShrink: 0 }}></i>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: '700', color: '#166534', marginBottom: '2px' }}>Funcionamento do Dia a Dia</p>
                                            <p style={{ fontSize: '11px', color: '#166534', lineHeight: 1.35 }}>
                                                {dayToDayOperationDays || 'Quarta a domingo'}<br />
                                                {dayToDayOperationHours || '14:30hrs às 20hrs'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '1rem', display: 'flex', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,.06)' }}>
                                <i className="ph-bold ph-ticket" style={{ fontSize: '20px', color: 'var(--gold)', marginLeft: '8px' }}></i>
                                <input id="coupon-code" name="couponCode" type="text" placeholder="Código do Cupom" disabled={!!appliedCoupon}
                                    style={{ flex: 1, background: 'none', border: 'none', fontSize: '14px', padding: '0 12px', outline: 'none', textTransform: 'uppercase', fontWeight: '700', opacity: appliedCoupon ? 0.5 : 1, color: 'var(--primary)', fontFamily: 'inherit' }}
                                    value={appliedCoupon ? appliedCoupon.code : couponInput} onChange={e => setCouponInput(e.target.value)} autoComplete="off" />
                                {!appliedCoupon
                                    ? <button onClick={applyCoupon} style={{ background: 'var(--primary)', color: 'var(--cream)', fontSize: '12px', fontWeight: '700', padding: '8px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>Aplicar</button>
                                    : <button onClick={() => { setAppliedCoupon(null); setCouponInput(''); }} style={{ background: '#fef2f2', color: '#ef4444', fontSize: '12px', fontWeight: '700', padding: '8px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}><i className="ph-bold ph-x"></i></button>
                                }
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {!isDeliveryAvailable && (
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <i className="ph-bold ph-info" style={{ fontSize: '18px', color: '#dc2626', flexShrink: 0, marginTop: '1px' }}></i>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', marginBottom: '2px' }}>Aviso: Entrega indisponível</p>
                                            <p style={{ fontSize: '11px', color: '#991b1b', lineHeight: 1.4 }}>Hoje estamos operando apenas com retirada no balcão.</p>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={btnMethod(deliveryMethod === 'retirada')} onClick={() => setDeliveryMethod('retirada')}>
                                        <i className="ph-bold ph-storefront" style={{ fontSize: '24px', marginBottom: '4px' }}></i>
                                        <span style={{ fontSize: '10px', fontWeight: '700' }}>BUSCAR</span>
                                    </button>
                                    {isDeliveryAvailable && (
                                        <button style={btnMethod(deliveryMethod === 'entrega')} onClick={() => setDeliveryMethod('entrega')}>
                                            <i className="ph-bold ph-truck" style={{ fontSize: '24px', marginBottom: '4px' }}></i>
                                            <span style={{ fontSize: '10px', fontWeight: '700' }}>{`ENTREGA (+R$ ${fmtBRL(DELIVERY_FEE)})`}</span>
                                        </button>
                                    )}
                                </div>

                                {deliveryMethod === 'entrega' ? (
                                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                        <h4 style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--primary)', marginBottom: '4px' }}>Dados de Entrega</h4>
                                        <input id="delivery-street" name="street" style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #f1f5f9' }} type="text" placeholder="Rua / Avenida e Número" value={street} onChange={e => setStreet(e.target.value)} autoComplete="street-address" />
                                        <input id="delivery-neighborhood" name="neighborhood" style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #f1f5f9' }} type="text" placeholder="Bairro" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} autoComplete="address-level2" />
                                        <input id="delivery-reference" name="reference" style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #f1f5f9' }} type="text" placeholder="Ponto de Referência (Opcional)" value={reference} onChange={e => setReference(e.target.value)} autoComplete="off" />
                                        <div style={{ marginTop: '12px', background: '#fff7ed', border: '2px solid #fdba74', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 8px 16px rgba(249,115,22,.12)' }}>
                                            <label htmlFor="order-observations" style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '.06em', color: '#9a3412', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <i className="ph-bold ph-chat-circle-dots" style={{ fontSize: '14px' }}></i>
                                                Observações do Pedido
                                                <span style={{ fontSize: '9px', fontWeight: '800', color: '#c2410c', background: '#ffedd5', border: '1px solid #fdba74', borderRadius: '9999px', padding: '2px 8px', marginLeft: 'auto' }}>Opcional</span>
                                            </label>
                                            <textarea
                                                id="order-observations"
                                                name="orderObservations"
                                                style={{
                                                    ...inp,
                                                    background: '#fff',
                                                    boxShadow: 'none',
                                                    border: '1px solid #fdba74',
                                                    minHeight: '96px',
                                                    resize: 'vertical',
                                                }}
                                                placeholder="Algum detalhe especial para o seu pedido? Ex: Sem cobertura de chocolate, sem lactose..."
                                                value={orderObservations || ''}
                                                onChange={e => setOrderObservations(e.target.value)}
                                            />
                                            <p style={{ fontSize: '11px', color: '#9a3412', marginTop: '6px', fontWeight: '600' }}>Use este campo para personalizações e recados importantes.</p>
                                        </div>
                                        <div style={{ marginTop: '4px' }}>
                                            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)', marginBottom: '6px' }}>Forma de Pagamento</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { value: 'PIX', label: 'PIX', sub: 'Chave PIX exibida abaixo', icon: 'ph-qr-code' },
                                                    { value: 'Dinheiro', label: 'Dinheiro', sub: 'Informe o valor para troco', icon: 'ph-money' },
                                                    { value: 'Cartão', label: 'Cartão de crédito', sub: 'Com juros da operadora', icon: 'ph-credit-card' },
                                                ].map(opt => (
                                                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: `2px solid ${paymentMethod === opt.value ? 'var(--primary)' : '#e2e8f0'}`, background: paymentMethod === opt.value ? 'rgba(28,38,56,.04)' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
                                                        <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={e => { setPaymentMethod(e.target.value); if (e.target.value !== 'Cartão') setCardInstallments('1'); if (e.target.value !== 'Dinheiro') setCashChangeFor(''); }} style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', flexShrink: 0 }} />
                                                        <i className={`ph-bold ${opt.icon}`} style={{ fontSize: '18px', color: paymentMethod === opt.value ? 'var(--primary)' : 'var(--s400)', flexShrink: 0 }}></i>
                                                        <div><p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{opt.label}</p><p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '1px' }}>{opt.sub}</p></div>
                                                    </label>
                                                ))}
                                            </div>
                                            {paymentMethod === 'Dinheiro' && (
                                                <div style={{ marginTop: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <label htmlFor="cash-change-for-delivery" style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#92400e', marginBottom: '6px', display: 'block' }}>Troco para quanto?</label>
                                                    <input
                                                        id="cash-change-for-delivery"
                                                        name="cashChangeFor"
                                                        type="number"
                                                        min={payableTotal.toFixed(2)}
                                                        step="0.01"
                                                        required
                                                        style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #fcd34d' }}
                                                        placeholder={`Ex: ${fmtBRL(payableTotal)}`}
                                                        value={cashChangeFor}
                                                        onChange={e => setCashChangeFor(e.target.value)}
                                                    />
                                                    <p style={{ fontSize: '11px', color: '#92400e', marginTop: '6px' }}>Obrigatório para pagamento em dinheiro.</p>
                                                </div>
                                            )}
                                            {paymentMethod === 'PIX' && (
                                                <div style={{ marginTop: '10px', background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#166534', marginBottom: '6px' }}>Chave PIX</p>
                                                    <p style={{ fontSize: '18px', fontWeight: '900', color: '#15803d', letterSpacing: '.08em', wordBreak: 'break-all' }}>{pixKey}</p>
                                                    {nomeTitularPix && (
                                                        <p style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: '600' }}>Titular: {nomeTitularPix}</p>
                                                    )}
                                                    <button onClick={handleCopyPix} style={{ marginTop: '8px', width: '100%', background: pixCopied ? '#15803d' : 'var(--primary)', color: '#fff', padding: '10px 12px', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .15s' }}>
                                                        <i className={`ph-bold ${pixCopied ? 'ph-check-circle' : 'ph-copy'}`} style={{ fontSize: '18px' }}></i>
                                                        {pixCopied ? 'PIX copiado' : 'Copiar chave PIX'}
                                                    </button>
                                                    <div style={{ marginTop: '8px', background: pixCopied ? '#dcfce7' : 'rgba(255,255,255,.72)', border: `1px solid ${pixCopied ? '#86efac' : '#bbf7d0'}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                        <i className={`ph-bold ${pixCopied ? 'ph-check-circle' : 'ph-info'}`} style={{ fontSize: '16px', color: pixCopied ? '#166534' : '#15803d', flexShrink: 0, marginTop: '1px' }}></i>
                                                        <div>
                                                            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: pixCopied ? '#166534' : '#15803d' }}>{pixCopied ? 'Chave copiada' : 'Aviso importante'}</p>
                                                            <p style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>Apos o pagamento via Pix, por favor, envie o comprovante para agilizar a confirmacao do seu pedido.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {paymentMethod === 'Cartão' && (
                                                <div style={{ marginTop: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#1e3a8a', marginBottom: '6px' }}>Parcelamento no cartão</p>
                                                    <select value={cardInstallments} onChange={e => setCardInstallments(e.target.value)} style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #dbeafe', padding: '10px' }}>
                                                        <option value="1">1x de R$ {fmtBRL(total * (1 + CARD_INSTALLMENT_RATES[1]))}</option>
                                                        <option value="2">2x de R$ {fmtBRL((total * (1 + CARD_INSTALLMENT_RATES[2])) / 2)}</option>
                                                        <option value="3">3x de R$ {fmtBRL((total * (1 + CARD_INSTALLMENT_RATES[3])) / 3)}</option>
                                                    </select>
                                                    <p style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', marginTop: '6px' }}>Total no cartão: R$ {fmtBRL(totalWithCardFee)}</p>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', color: '#1e3a8a', marginTop: '2px' }}>Acréscimo aplicado: {(installmentRate * 100).toFixed(2).replace('.', ',')}%</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <i className="ph-fill ph-map-pin" style={{ fontSize: '24px', color: 'var(--primary)' }}></i>
                                            <p style={{ fontSize: '12px', color: 'var(--s600)', fontWeight: '500', lineHeight: 1.4 }}>Retirada<br /><strong style={{ color: 'var(--primary)', textTransform: 'uppercase', fontSize: '14px' }}>Na Helô Confeitaria</strong></p>
                                            <a href="https://maps.app.goo.gl/FrmNpC4iGrVxfw8u9" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: '700', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}><i className="ph-bold ph-arrow-square-out"></i> Abrir no Mapa</a>
                                        </div>
                                        <div style={{ marginTop: '12px', background: '#fff7ed', border: '2px solid #fdba74', borderRadius: '12px', padding: '10px 12px', boxShadow: '0 8px 16px rgba(249,115,22,.12)' }}>
                                            <label htmlFor="order-observations-pickup" style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '.06em', color: '#9a3412', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <i className="ph-bold ph-chat-circle-dots" style={{ fontSize: '14px' }}></i>
                                                Observações do Pedido
                                                <span style={{ fontSize: '9px', fontWeight: '800', color: '#c2410c', background: '#ffedd5', border: '1px solid #fdba74', borderRadius: '9999px', padding: '2px 8px', marginLeft: 'auto' }}>Opcional</span>
                                            </label>
                                            <textarea
                                                id="order-observations-pickup"
                                                name="orderObservations"
                                                style={{
                                                    ...inp,
                                                    background: '#fff',
                                                    boxShadow: 'none',
                                                    border: '1px solid #fdba74',
                                                    minHeight: '96px',
                                                    resize: 'vertical',
                                                }}
                                                placeholder="Algum detalhe especial para o seu pedido? Ex: Sem cobertura de chocolate, sem lactose..."
                                                value={orderObservations || ''}
                                                onChange={e => setOrderObservations(e.target.value)}
                                            />
                                            <p style={{ fontSize: '11px', color: '#9a3412', marginTop: '6px', fontWeight: '600' }}>Use este campo para personalizações e recados importantes.</p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--s400)', marginBottom: '6px' }}>Forma de Pagamento</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { value: 'PIX', label: 'PIX', sub: 'Chave PIX exibida abaixo', icon: 'ph-qr-code' },
                                                    { value: 'Dinheiro', label: 'Dinheiro', sub: 'Informe o valor para troco', icon: 'ph-money' },
                                                    { value: 'Cartão', label: 'Cartão de crédito', sub: 'Com juros da operadora', icon: 'ph-credit-card' },
                                                ].map(opt => (
                                                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: `2px solid ${paymentMethod === opt.value ? 'var(--primary)' : '#e2e8f0'}`, background: paymentMethod === opt.value ? 'rgba(28,38,56,.04)' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
                                                        <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={e => { setPaymentMethod(e.target.value); if (e.target.value !== 'Cartão') setCardInstallments('1'); if (e.target.value !== 'Dinheiro') setCashChangeFor(''); }} style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', flexShrink: 0 }} />
                                                        <i className={`ph-bold ${opt.icon}`} style={{ fontSize: '18px', color: paymentMethod === opt.value ? 'var(--primary)' : 'var(--s400)', flexShrink: 0 }}></i>
                                                        <div><p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{opt.label}</p><p style={{ fontSize: '11px', color: 'var(--s400)', marginTop: '1px' }}>{opt.sub}</p></div>
                                                    </label>
                                                ))}
                                            </div>
                                            {paymentMethod === 'Dinheiro' && (
                                                <div style={{ marginTop: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <label htmlFor="cash-change-for-pickup" style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#92400e', marginBottom: '6px', display: 'block' }}>Troco para quanto?</label>
                                                    <input
                                                        id="cash-change-for-pickup"
                                                        name="cashChangeFor"
                                                        type="number"
                                                        min={payableTotal.toFixed(2)}
                                                        step="0.01"
                                                        required
                                                        style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #fcd34d' }}
                                                        placeholder={`Ex: ${fmtBRL(payableTotal)}`}
                                                        value={cashChangeFor}
                                                        onChange={e => setCashChangeFor(e.target.value)}
                                                    />
                                                    <p style={{ fontSize: '11px', color: '#92400e', marginTop: '6px' }}>Obrigatório para pagamento em dinheiro.</p>
                                                </div>
                                            )}
                                            {paymentMethod === 'PIX' && (
                                                <div style={{ marginTop: '10px', background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#166534', marginBottom: '6px' }}>Chave PIX</p>
                                                    <p style={{ fontSize: '18px', fontWeight: '900', color: '#15803d', letterSpacing: '.08em', wordBreak: 'break-all' }}>{pixKey}</p>
                                                    {nomeTitularPix && (
                                                        <p style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: '600' }}>Titular: {nomeTitularPix}</p>
                                                    )}
                                                    <button onClick={handleCopyPix} style={{ marginTop: '8px', width: '100%', background: pixCopied ? '#15803d' : 'var(--primary)', color: '#fff', padding: '10px 12px', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .15s' }}>
                                                        <i className={`ph-bold ${pixCopied ? 'ph-check-circle' : 'ph-copy'}`} style={{ fontSize: '18px' }}></i>
                                                        {pixCopied ? 'PIX copiado' : 'Copiar chave PIX'}
                                                    </button>
                                                    <div style={{ marginTop: '8px', background: pixCopied ? '#dcfce7' : 'rgba(255,255,255,.72)', border: `1px solid ${pixCopied ? '#86efac' : '#bbf7d0'}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                        <i className={`ph-bold ${pixCopied ? 'ph-check-circle' : 'ph-info'}`} style={{ fontSize: '16px', color: pixCopied ? '#166534' : '#15803d', flexShrink: 0, marginTop: '1px' }}></i>
                                                        <div>
                                                            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: pixCopied ? '#166534' : '#15803d' }}>{pixCopied ? 'Chave copiada' : 'Aviso importante'}</p>
                                                            <p style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>Apos o pagamento via Pix, por favor, envie o comprovante para agilizar a confirmacao do seu pedido.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {paymentMethod === 'Cartão' && (
                                                <div style={{ marginTop: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px' }}>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: '#1e3a8a', marginBottom: '6px' }}>Parcelamento no cartão</p>
                                                    <select value={cardInstallments} onChange={e => setCardInstallments(e.target.value)} style={{ ...inp, background: '#fff', boxShadow: 'none', border: '1px solid #dbeafe', padding: '10px' }}>
                                                        <option value="1">1x de R$ {fmtBRL(total * (1 + CARD_INSTALLMENT_RATES[1]))}</option>
                                                        <option value="2">2x de R$ {fmtBRL((total * (1 + CARD_INSTALLMENT_RATES[2])) / 2)}</option>
                                                        <option value="3">3x de R$ {fmtBRL((total * (1 + CARD_INSTALLMENT_RATES[3])) / 3)}</option>
                                                    </select>
                                                    <p style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', marginTop: '6px' }}>Total no cartão: R$ {fmtBRL(totalWithCardFee)}</p>
                                                    <p style={{ fontSize: '10px', fontWeight: '700', color: '#1e3a8a', marginTop: '2px' }}>Acréscimo aplicado: {(installmentRate * 100).toFixed(2).replace('.', ',')}%</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="cart-summary-panel" style={{ paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--s500)', fontWeight: '500' }}><span>Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
                        {appliedCoupon && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#22c55e', fontWeight: '700' }}><span>Desconto ({appliedCoupon.code}):</span><span>- R$ {discountValue.toFixed(2)}</span></div>}
                        {!appliedCoupon && specialApplied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#16a34a', fontWeight: '700' }}><span>Desconto VIP (10%):</span><span>- R$ {discountValue.toFixed(2)}</span></div>}
                        {deliveryMethod === 'entrega' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--s500)', fontWeight: '500' }}><span>Taxa de Entrega:</span><span style={finalDelivery === 0 ? { color: '#22c55e', fontWeight: '700' } : {}}>{finalDelivery === 0 ? 'Grátis' : `+ R$ ${DELIVERY_FEE.toFixed(2)}`}</span></div>}
                        {paymentMethod === 'Cartão' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1d4ed8', fontWeight: '700' }}><span>Acréscimo Cartão ({(installmentRate * 100).toFixed(2).replace('.', ',')}%):</span><span>+ R$ {cardFeeValue.toFixed(2)}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)', letterSpacing: '-.05em', paddingTop: '8px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}><span>Total:</span><span style={{ color: 'var(--gold)' }}>R$ {payableTotal.toFixed(2)}</span></div>
                        {paymentMethod === 'Cartão' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#166534', background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '8px 10px' }}><span>Pagamento no cartão:</span><span>{installmentQty}x de R$ {fmtBRL(installmentAmount)}</span></div>}
                        <button disabled={isSaving} onClick={saveAndSend} className="cart-finish-btn" style={isSaving ? { background: '#94a3b8', borderColor: 'transparent', cursor: 'not-allowed', transform: 'none', filter: 'none' } : undefined}>
                            {isSaving ? <div className="loader" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }}></div> : <><i className="ph-bold ph-basket" style={{ fontSize: '22px' }}></i> FINALIZAR PEDIDO</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});
