/* ═══════════════════════════════════════════════════════════════════════
   cabecalho.component.js — COMPONENTE DO BOTÃO FLUTUANTE DO CARRINHO
   ═══════════════════════════════════════════════════════════════════════
   Renderiza o botão flutuante que fica fixo no canto da tela e mostra:
   - Ícone de carrinho de compras
   - Badge com a quantidade de itens (se houver itens no carrinho)

   Props:
   - cart       → Lista de itens no carrinho (array de objetos com qty)
   - onOpenCart → Função chamada ao clicar no botão (abre o carrinho)

   O badge com a quantidade só aparece se cartCount > 0, e tem uma
   animação de "bounce" (pulinho) para chamar atenção do cliente.
   ═══════════════════════════════════════════════════════════════════════ */
(function initCabecalhoComponent(globalScope) {
    'use strict';

    /* ── Cabecalho: Botão flutuante do carrinho ────────────────────────
       React.memo evita re-render se cart e onOpenCart não mudaram.

       cartCount: soma todas as quantidades dos itens do carrinho.
       Ex: [{qty:2}, {qty:1}] → cartCount = 3
       Number(item?.qty) || 0 trata itens sem qty ou com valor inválido.
       ──────────────────────────────────────────────────────────────── */
    const Cabecalho = React.memo(({ cart, onOpenCart }) => {
        const cartCount = cart.reduce((acc, item) => acc + (Number(item?.qty) || 0), 0);

        return (
            <button
                onClick={onOpenCart}
                className="floating-cart-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}
                aria-label="Abrir carrinho"
            >
                {/* Ícone do carrinho (Phosphor Icons) */}
                <i className="ph-bold ph-shopping-cart" style={{ fontSize: '22px' }}></i>
                {/* Badge com quantidade — só aparece se tem itens */}
                {cartCount > 0 && <span className="top-cart-badge animate-bounce">{cartCount}</span>}
            </button>
        );
    });

    /* ── Registra o componente no namespace global ──────────────────── */
    globalScope.HeloComponents = {
        ...(globalScope.HeloComponents || {}),
        Cabecalho,
    };
})(window);
