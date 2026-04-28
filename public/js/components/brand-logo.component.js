/* ═══════════════════════════════════════════════════════════════════════
   brand-logo.component.js — COMPONENTE DA LOGO DA MARCA
   ═══════════════════════════════════════════════════════════════════════
   Renderiza a logo da Helô Confeitaria com possibilidade de ajustar
   a escala (tamanho) e o deslocamento vertical (offsetY).

   Props:
   - scale   → Fator de escala (1 = tamanho normal, 0.5 = metade). Padrão: 1
   - offsetY → Deslocamento vertical em pixels. Padrão: 0

   A logo em si é estilizada via CSS (.brand-logo-image), este componente
   apenas cria o container com transformações dinâmicas.
   ═══════════════════════════════════════════════════════════════════════ */
(function initBrandLogoComponent(globalScope) {
    'use strict';

    /* ── BrandLogo: Logo da marca com escala e posição ajustáveis ──────
       React.memo evita re-render se scale e offsetY não mudaram.
       A imagem real da logo é definida no CSS pela classe "brand-logo-image".
       role="img" e aria-label garantem acessibilidade para leitores de tela.
       ──────────────────────────────────────────────────────────────── */
    const BrandLogo = React.memo(({ scale = 1, offsetY = 0 }) => (
        <div
            className="brand-mark-wrap"
            style={{ transform: `translateY(${offsetY}px) scale(${scale})`, transformOrigin: 'center center' }}
        >
            <div
                className="brand-logo-image"
                role="img"
                aria-label="Helô Confeitaria"
            />
        </div>
    ));

    /* ── Registra o componente no namespace global ────────────────────
       window.HeloComponents.BrandLogo fica disponível para qualquer
       arquivo que precise renderizar a logo.
       ──────────────────────────────────────────────────────────────── */
    globalScope.HeloComponents = {
        ...(globalScope.HeloComponents || {}),
        BrandLogo,
    };
})(window);
