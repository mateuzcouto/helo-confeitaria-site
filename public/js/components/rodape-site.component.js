/* ═══════════════════════════════════════════════════════════════════════
   rodape-site.component.js — COMPONENTE DO RODAPÉ DO SITE
   ═══════════════════════════════════════════════════════════════════════
   Renderiza o rodapé (footer) que aparece na parte inferior de todas
   as páginas do site. Contém:

   1. Links para redes sociais (Instagram, TikTok, WhatsApp)
   2. Endereço da loja (link para Google Maps)
   3. Telefone de contato (link para WhatsApp)
   4. Horário de funcionamento (dinâmico via props)
   5. Botão discreto "Acesso Reservado" (abre login do admin)
   6. Créditos do desenvolvedor

   Props:
   - onOpenLogin    → Função para abrir o modal de login do admin
   - operationDays  → Dias de funcionamento (ex: "Quarta a domingo")
   - operationHours → Horário de funcionamento (ex: "14:30hrs às 20hrs")
   ═══════════════════════════════════════════════════════════════════════ */
(function initRodapeSiteComponent(globalScope) {
    'use strict';

    const RodapeSite = React.memo(({ onOpenLogin, operationDays = 'Quarta a domingo', operationHours = '14:30hrs às 20hrs' }) => {

        /* ══════════════════════════════════════════════════════════════════
           ESTRUTURA DO JSX — Seções do rodapé
           ══════════════════════════════════════════════════════════════════
           O JSX abaixo renderiza o rodapé na seguinte ordem:
           1. Container <footer> com marginTop:auto (sempre no fim da página)
           2. Coroa decorativa (marca d'água com opacidade 5%)
           3. SEÇÃO 1: Links de redes sociais (Instagram, TikTok, WhatsApp)
              - Botões circulares com ícones Phosphor
              - e.preventDefault() + window.open() para compatibilidade
           4. SEÇÃO 2: Endereço (link Google Maps) e telefone (link WhatsApp)
              - Efeito hover: texto fica branco
           5. SEÇÃO 3: Horário de funcionamento (card com ícone de relógio)
              - Valores dinâmicos via props (operationDays, operationHours)
           6. SEÇÃO 4: Botão "Acesso Reservado" (discreto, só o admin sabe)
              + Créditos do desenvolvedor (quase invisível)
           ══════════════════════════════════════════════════════════════════ */
        return (
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
        );
    });

    /* ── Registra o componente no namespace global ──────────────────── */
    globalScope.HeloComponents = {
        ...(globalScope.HeloComponents || {}),
        RodapeSite,
    };
})(window);
