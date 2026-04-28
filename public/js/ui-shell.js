/* ═══════════════════════════════════════════════════════════════════════
   ui-shell.js — COMPONENTES DE "CASCA" DA INTERFACE
   ═══════════════════════════════════════════════════════════════════════
   Este arquivo contém componentes React que são "cascas" — ou seja,
   eles embrulham outros componentes mais complexos, adicionando
   a estrutura visual ao redor deles.

   1. ModalAcessoReservado → Tela de login do administrador
   2. AreaAdministrativa   → Container que carrega o painel admin inteiro

   Ambos usam React.memo() para evitar re-renderização desnecessária.
   React.memo é como um "cache de renderização": só re-renderiza se
   as propriedades (props) mudarem.
   ═══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   ModalAcessoReservado — TELA DE LOGIN DO ADMINISTRADOR
   ══════════════════════════════════════════════════════════════════
   Este componente mostra um modal (janela flutuante) com campos de
   e-mail e senha para o administrador fazer login.

   Props (propriedades que recebe de fora):
   - open               → Se o modal está visível (true/false)
   - loginEmail         → Texto digitado no campo de e-mail
   - loginPassword      → Texto digitado no campo de senha
   - loginLoading       → Se está carregando (mostra "Entrando...")
   - onLoginEmailChange → Função chamada quando o e-mail muda
   - onLoginPasswordChange → Função chamada quando a senha muda
   - onSubmit           → Função chamada ao clicar "Entrar"
   - onClose            → Função chamada ao fechar o modal

   Se open for false, retorna null (não renderiza nada na tela).
   ══════════════════════════════════════════════════════════════════ */
const ModalAcessoReservado = React.memo(({
    open,
    loginEmail,
    loginPassword,
    loginLoading,
    onLoginEmailChange,
    onLoginPasswordChange,
    onSubmit,
    onClose,
}) => {
    /* Se o modal não está aberto, não renderiza nada */
    if (!open) return null;

    /* ══════════════════════════════════════════════════════════════════
       ESTRUTURA DO JSX — Modal de login
       ══════════════════════════════════════════════════════════════════
       1. Fundo escuro (overlay) — ao clicar, fecha o modal
       2. Caixa branca — stopPropagation impede que clicar dentro feche
       3. Cabeçalho com ícone de cadeado e título
       4. Formulário com campos de e-mail e senha
          - e.preventDefault() impede recarregamento da página
       5. Botão "Entrar" — disabled enquanto carrega ou campos vazios
       6. Botão "Cancelar" — fecha o modal
       ══════════════════════════════════════════════════════════════════ */
    return (
        <div onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '360px', boxShadow: '0 25px 60px rgba(0,0,0,.25)', animation: 'fadeIn .2s ease' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '52px', height: '52px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .75rem' }}>
                        <i className="ph-fill ph-lock-key" style={{ fontSize: '24px', color: 'var(--cream)' }}></i>
                    </div>
                    <h3 style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>Acesso Reservado</h3>
                    <p style={{ fontSize: '12px', color: 'var(--s400)', marginTop: '4px' }}>Entre com seu e-mail e senha para acessar o CRM</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                    <input type="email" value={loginEmail} onChange={e => onLoginEmailChange(e.target.value)}
                        autoComplete="username"
                        placeholder="E-mail"
                        style={{ width: '100%', padding: '.85rem 1rem', borderRadius: '.75rem', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: '500', color: 'var(--primary)', marginBottom: '.75rem', fontFamily: 'inherit' }} />
                    <input type="password" value={loginPassword} onChange={e => onLoginPasswordChange(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Senha"
                        style={{ width: '100%', padding: '.85rem 1rem', borderRadius: '.75rem', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '14px', fontWeight: '500', color: 'var(--primary)', marginBottom: '.75rem', fontFamily: 'inherit' }} />
                    <button type="submit" disabled={loginLoading || !loginEmail || !loginPassword}
                        style={{ width: '100%', padding: '.85rem', borderRadius: '.75rem', border: 'none', background: 'var(--primary)', color: 'var(--cream)', cursor: 'pointer', fontWeight: '700', fontSize: '14px', opacity: (loginLoading || !loginPassword) ? 0.6 : 1 }}>
                        {loginLoading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <button onClick={onClose}
                    style={{ width: '100%', padding: '.6rem', marginTop: '.5rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
                    Cancelar
                </button>
            </div>
        </div>
    );
});

/* ══════════════════════════════════════════════════════════════════
   AreaAdministrativa — CONTAINER DO PAINEL ADMIN
   ══════════════════════════════════════════════════════════════════
   Este componente é um "passa-adiante" (wrapper): ele recebe todos os
   dados do sistema e repassa para o AdminPanel, que é o componente
   gigante que monta a tela de administração completa.

   Por que ter um wrapper? Porque assim o componente principal (App)
   fica mais limpo — ele só precisa saber que existe uma "área admin",
   sem se preocupar com quais dados ela precisa.

   Props recebidas e repassadas ao AdminPanel:
   - allOrders         → Todos os pedidos do sistema
   - allCoupons        → Todos os cupons de desconto
   - products          → Lista de produtos do cardápio
   - visitsData        → Dados de visitas ao site
   - ingredients       → Insumos do estoque
   - recipes           → Fichas técnicas (receitas)
   - feedbacks         → Feedbacks dos clientes
   - financialEntries → Entradas financeiras
   - campaigns        → Campanhas de venda
   - activeCampaignId → ID da campanha ativa
   - onExitAdmin       → Função para sair do painel admin
   - siteSettings      → Configurações gerais do site
   - onSaveSettings    → Função para salvar configurações
   ══════════════════════════════════════════════════════════════════ */
const AreaAdministrativa = React.memo(({
    allOrders,
    allCoupons,
    products,
    visitsData,
    ingredients,
    recipes,
    feedbacks,
    financialEntries,
    campaigns,
    activeCampaignId,
    onExitAdmin,
    siteSettings,
    onSaveSettings,
}) => (
    <AdminPanel
        allOrders={allOrders}
        allCoupons={allCoupons}
        products={products}
        visitsData={visitsData}
        ingredients={ingredients}
        recipes={recipes}
        feedbacks={feedbacks}
        financialEntries={financialEntries}
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onExit={onExitAdmin}
        siteSettings={siteSettings}
        onSaveSettings={onSaveSettings}
    />
));

/* ── App Principal ────────────────────────────────────────────────── */