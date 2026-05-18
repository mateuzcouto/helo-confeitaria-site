# Helô Confeitaria — Sistema de Pedidos e Gestão

Sistema web completo para confeitaria artesanal, integrando vitrine de produtos com pedidos online, painel administrativo em tempo real, gestão de estoque e produção, fluxo de caixa, impressão térmica e automação via WhatsApp.

---

## Fonte de Verdade Documental

- `README.md` (este arquivo): operação e visão técnica geral.
- `PDR.md` (dentro do projeto): decisões técnicas e padrões de manutenção.
- `ARCHITECTURE.md`: estrutura e arquitetura de execução.
- `QUICK_START.md`: onboarding rápido para desenvolvimento local.
- `functions/README.md`: contrato de APIs backend, variáveis e deploy de functions.

### Deploy em produção e documentação contínua

**Regra de equipe:** toda entrega que vai para produção deve incluir documentação alinhada ao código — não apenas o deploy.

1. **Código:** comentários no ponto da regra alterada; funções novas ou alteradas com JSDoc (propósito, parâmetros, retorno), como já é feito em `public/js/core/` e módulos principais.
2. **`README.md`:** registrar o que mudou para operação e produto (features, validações, URLs relevantes).
3. **`PDR.md`:** registrar decisões técnicas, histórico §10 e atualizar checklist §11 quando fizer sentido.

**Comando de deploy (Hosting apenas — vitrine + admin estáticos):**

```bash
cd site-helo-final/site-helo-final
firebase deploy --only hosting
```

O Firebase executa automaticamente **predeploy** (`npm run prepare:hosting`), nesta ordem:

1. `npm run build:public` — transpila JSX de `public/js/` → `public/js-build/` (esbuild).
2. `node scripts/test-client-ranking.js` — testes do motor `HeloClientRanking` (ranking Top Clientes).
3. `node scripts/validate-html-pages.js` — garante que `index.html`, `admin.html` e `confirmacao.html` só referenciam scripts existentes e respeitam o contrato dual-HTML.
4. `node scripts/stamp-version.js` — gera `public/deploy-version.json` e alinha `?v=` nos HTML + `VERSAO_ASSETS_ESTATICOS`.
5. `node scripts/strip-bom.js public` — remove BOM de arquivos de texto.

Projeto padrão: `helo-confeitaria`; site: **heloconfeitarianr** — produção: <https://heloconfeitarianr.web.app/>.

Comandos úteis:

| Comando | Uso |
| --- | --- |
| `npm run build:public` | Só transpilar (desenvolvimento rápido) |
| `npm run validate:html` | Validar referências de scripts nos HTML |
| `npm run test:ranking` | Rodar só os testes de ranking |
| `npm run prepare:hosting` | Pipeline completo pré-deploy |
| `npm run deploy:hosting` | Deploy Hosting (roda `prepare:hosting` no predeploy do Firebase) |

**Dica de manutenção:** em arquivos `.js`, comentários de bloco `/* … */` não podem conter a sequência `*/` no meio do texto (ex.: ao documentar uma regex como `…]*/g…`). Isso encerra o comentário cedo e pode quebrar o script — já ocorreu em `scripts/stamp-version.js` (corrigido).

---

## Visão Geral

Plataforma **mobile-first** construída com React 18 (via CDN, sem bundler de app), Firebase Firestore em tempo real e Firebase Cloud Functions. O sistema opera em dois modos:

- **Modo Evento** — Campanhas sazonais (Páscoa, Natal etc.) com limite de unidades, prazo de pedidos e escassez controlada.
- **Modo Dia a Dia** — Operação contínua com cardápio aberto, sem limitadores de unidades.

Clientes navegam pelo catálogo, montam pedidos no carrinho e finalizam via WhatsApp com pagamento PIX, dinheiro ou cartão. Administradores gerenciam toda a operação por um painel integrado com atualizações em tempo real.

### Atualizações recentes (changelog resumido)

Detalhes no histórico do [`PDR.md`](PDR.md) (§10 e subseções §10.1–§10.5).

- **Ranking Top Clientes (admin):** aba **Clientes → Top Clientes** com períodos **Hoje / Semana / Mês / 7 dias / 30 dias** (fuso `America/Fortaleza`), toggle **Valor (R$)** ou **Qtd. pedidos**, card do melhor cliente e tabela (top 50). Só entram pedidos **Pago**, **Pronto** ou **Concluído**; uma query Firestore por visita à aba alimenta todos os recortes em memória. Motor: [`public/js/core/analytics/client-ranking.js`](public/js/core/analytics/client-ranking.js) (`window.HeloClientRanking`); hook `useRankingClientesPeriodo` em `public/js/script.js`. Deploy hosting **20260518-225751** (ver `public/deploy-version.json`).
- **Contatos públicos (fonte única):** WhatsApp, Instagram, TikTok, mapa e telefone visível vivem em [`public/js/core/constants/contatos-loja-publica.js`](public/js/core/constants/contatos-loja-publica.js) (`window.HeloPublicContact` + `montarHrefWhatsAppLojaPublica`). Rodapé, ecrã "loja fechada" e mensagens de pedido leem daqui.
- **Marketing / UTF-8:** `HeloCoreUtils.corrigirMoibakeComumMarketing` + `sanitizarMarketingSiteSettingsRecebidas` em [`public/js/core/utils/text-date-utils.js`](public/js/core/utils/text-date-utils.js) corrigem apenas padrões latin1/UTF-8 conhecidos no `announcementText` ao receber `site_settings`; textos no Firestore devem ser guardados em UTF-8.
- **Firestore `site_settings` com cache offline:** `onSnapshot({ includeMetadataChanges: true })` + `get({ source: 'server' })` ao `online` / `pageshow` / voltar de background em [`public/js/main-app.js`](public/js/main-app.js) e [`public/js/app-admin.js`](public/js/app-admin.js).
- **Admin:** componentes `AdminTogglePill` e `AdminSettingsCard` em `public/js/components/admin/`, CSS em [`public/css/admin-settings.css`](public/css/admin-settings.css); **Sistema → Configurações** inclui **Pré-visualização pública** (rascunho loja fechada + botão **Abrir vitrine** em nova aba).
- **Clientes inativos:** aba **Clientes → Inativos** no admin — lista só quem está **>30 dias** sem novo pedido (aprox. um mês), com WhatsApp e export HTML.
- **PIX InfinitePay (interruptor):** em **Sistema → Pagamentos** o admin liga ou desliga o checkout InfinitePay (`site_settings.infinityPayEnabled`). **Desligado (padrão recomendado até GO-live completo):** PIX continua no modo atual — chave no carrinho e pedido finalizado pelo WhatsApp, sem impacto nos clientes durante testes. **Ligado:** PIX usa checkout hospedado + `confirmacao.html` e status `AguardandoPagamento` até o webhook confirmar. Código: `public/js/script.js`, `public/js/main-app.js`, `public/js/app-admin.js`.
- **WhatsApp via n8n (interruptor):** em **Sistema → Configurações** o bloco **Mensagens WhatsApp automáticas (n8n)** grava `site_settings.n8nWhatsAppAutomationsEnabled` no Firestore **somente após salvar** — use **Salvar automação n8n no Firebase** ou **Salvar Configurações** no fim da página (o interruptor sozinho não persiste). O resumo na mesma aba indica se a flag está **ligada no Firebase**. **Desligado:** nenhum `POST` Firebase → VPS. **Ligado + env preenchido:** `dispatchN8nWebhookOnOrderCreated/Updated` e cron de feedback (ver `functions/README.md`). **Eventos:** `novo_pedido` (criação de documento em `orders`); `pedido_confirmado_cliente` / `pedido_pronto_cliente` (transição de status **Confirmado** / **Pronto**); idempotência em `integrations.n8n.*` (não repete após sucesso HTTP 2xx). **Variáveis:** `N8N_ORDER_EVENTS_URL` = URL **Production** do nó Webhook no n8n (ex.: `…/webhook/<path>`), `N8N_WEBHOOK_SECRET` = mesmo valor validado no fluxo (`Authorization: Bearer`). **Validar sem adivinhar:** no Google Cloud Logs, filtre a function `dispatchN8nWebhookOnOrderCreated` (ou `…Updated`) por texto `[n8n]` — a linha `Enviando webhook` confirma tentativa real de `fetch`; mensagens anteriores explicam se a flag estava off, env incompleto ou idempotência. **Workflow n8n:** precisa estar **Active**; se o Webhook usa **Respond to nó 'Respond to Webhook'**, o fluxo deve incluir esse nó para responder 2xx e evitar timeout no caller. Export de referência: [`docs/n8n-workflow-helo-firebase.json`](docs/n8n-workflow-helo-firebase.json).
- **Modal “pedido registrado” (WhatsApp):** após gravar o pedido no fluxo que abre o WhatsApp, o cliente vê um diálogo alinhado à identidade (xadrez creme, borda dourada, logo via `BrandLogo`, texto acolhedor). Área da logo dimensionada com `.helo-modal-sucesso-logo-wrap` em `public/css/style.css`; markup em `public/js/main-app.js`.
- **Carrinho:** sugestão discreta de Coca-Cola Zero (produtos reais da aba Bebidas, estoque respeitado) quando o pedido ainda não inclui bebida — ver `public/js/core/catalog.js`, `cart-ui.js`, `main-app.js`.
- **Entrega:** **ponto de referência obrigatório** com rua e bairro; labels com asterisco no drawer — validação em `saveAndSend`.
- **Cloud Functions — supply chain:** removido o `overrides` de **`asynckit`** em [`functions/package.json`](functions/package.json). O pacote **não** figurava na árvore instalada (`npm ls asynckit` vazio), e o pin explícito à última versão publicada era sinalizado por scanners (ex.: Meterian, CWE-1104) sem ganho prático. Mantêm-se overrides apenas para **`uuid`**, **`retry-request`** e **`yargs`** onde ainda são necessários. Se no futuro alguma dependência transitiva voltar a puxar `asynckit`, tratar na **origem** (atualizar o pacote pai) em vez de fixar `asynckit` no manifest, salvo orientação contrária de segurança.

---

## Funcionalidades Principais

### Vitrine Pública (Cliente)

- Catálogo de produtos com abas de menu dinâmicas (deduzidas dos produtos cadastrados)
- Badge de **Mais Vendido** calculado por `productId` com deduplicação
- **Assistente de IA** — Chatbot treinado com base de conhecimento da confeitaria para responder dúvidas sobre produtos, pedidos, pagamentos, entrega e políticas
- Carrinho lateral (drawer) com formulário completo:
  - Dados do cliente (nome, WhatsApp)
  - Escolha de retirada ou entrega (controle admin de ativação/desativação)
  - Campos de endereço condicionais na **entrega**: rua, bairro e **ponto de referência** são obrigatórios (validação em `saveAndSend` em `public/js/main-app.js`; labels no drawer em `public/js/cart-ui.js`)
  - Observações do pedido com destaque visual
  - Pagamento:
    - **PIX — dois modos (campo `site_settings.infinityPayEnabled`):**
      - **InfinitePay desligado (padrão recomendado até GO-live completo):** chave PIX no carrinho, pedido segue para WhatsApp (fluxo legado).
      - **InfinitePay ligado:** checkout hospedado; pedido em `AguardandoPagamento` até `confirmarPagamentoPix` (Make/InfinitePay); retorno em [`public/confirmacao.html`](public/confirmacao.html).
    - **Dinheiro** e **Cartão:** continuam sempre com fluxo WhatsApp.
    - Interruptor admin: **Sistema → Pagamentos** (`public/js/script.js`).
  - Cupom de desconto com validação
  - Detecção automática de cliente **VIP** (desconto 10% acima de threshold mensal)
- **PIX InfinitePay + Make.com (quando ativado no admin)** — Com **Sistema → Pagamentos → Checkout PIX InfinitePay** ligado, pedidos em PIX são gravados com status `AguardandoPagamento`, abrem o checkout InfinitePay (Tag InfinitePay + URL do webhook Make nas Cloud Functions; conferência opcional com `HELO_PIX_CONFIRM_SECRET`) e, após pagamento, o cliente volta a [`public/confirmacao.html`](public/confirmacao.html) (`?nsu=<id do pedido>`). O webhook InfinitePay → Make.com deve chamar `POST /api/pix/confirm` (function `confirmarPagamentoPix`) para marcar `Pago` no Firestore; o segundo módulo HTTP no Make pode enviar WhatsApp (ex.: CallMeBot). Variáveis: `functions/.env.example`. **Não há sandbox:** teste de ponta a ponta exige transação real (valor mínimo). Central de ajuda: [como usar o checkout](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-da-infinitepay). Rewrites: [`firebase.json`](firebase.json). Com o interruptor **desligado**, o PIX permanece no modo chave + WhatsApp — ver §10.1 no [`PDR.md`](PDR.md).
- **Sugestão de bebida no carrinho (upsell discreto)** — Com o carrinho aberto, se ainda não houver nenhum item da aba de menu **Bebidas**, o drawer pode exibir um bloco compacto “Que tal completar seu pedido?” com até duas opções reais de **Coca-Cola Zero** (nome + estoque + preço iguais ao cadastro no Firestore). O cliente adiciona com **+ Adicionar** usando a mesma função da vitrine (`handleAddToCart`), sem modal e sem item fictício. A detecção da aba **Bebidas** e do texto “coca” + “zero” está em `public/js/core/catalog.js` (`selecionarProdutosSugestaoCocaColaZero`, `produtoPertenceAbaBebidas`); a UI fica em `public/js/cart-ui.js`.
- Resumo com subtotal, desconto VIP, frete, taxa de cartão e total
- Finalização: **PIX** conforme `infinityPayEnabled` (WhatsApp ou checkout); **Dinheiro** e **Cartão** abrem WhatsApp com mensagem pré-formatada; modal de sucesso com identidade Helô quando o fluxo usa WhatsApp
- Tela de pós-venda (pesquisa de satisfação)

#### Melhorias mobile e conversão da vitrine pública

Alterações aplicadas para deixar a experiência do cliente mais rápida no celular, mantendo o visual premium:

-   **Skeleton Screen:** Estrutura visual carregada instantaneamente no HTML para eliminar o flash de tela branca.
-   **Critical Path Enxuto:** preload focado em CSS crítico; scripts externos não essenciais foram retirados do preload para reduzir disputa de banda no primeiro paint.
-   **Offline Persistence (IndexedDB):** Catálogo e configurações cacheados localmente — carregamento instantâneo em visitas recorrentes, mesmo sem internet.
-   **Cache Ilimitado:** `cacheSizeBytes: CACHE_SIZE_UNLIMITED` para nunca expulsar dados do cache do Firestore.
-   **Transporte Inteligente:** Firebase usa WebSockets/gRPC (mais eficientes em 3G/4G) em vez de long-polling forçado.
-   **Timeouts e Feedback Progressivo para 3G:** fallback do catálogo em **8s**, aviso de conexão lenta em **6s** e timeout de segurança em **15s** com mensagem orientando recarregar.
-   **Lazy Loading de Imagens:** `loading="lazy"` — imagens dos produtos só baixam quando entram na tela.
-   **Decodificação Assíncrona:** `decoding="async"` — imagens decodificadas em background, sem travar o scroll.
-   **Fetch Priority na Logo:** `fetchpriority="high"` garante que o visual de marca apareça primeiro.
-   **Preconnect a CDNs:** Handshakes SSL antecipados para Firebase, Google Fonts e Firebase Storage.
-   **Content-Visibility:** `content-visibility: auto` nos cards — o navegador economiza CPU/bateria ignorando o que está fora da tela.
-   **Font Display Swap:** Texto exibido com fonte do sistema enquanto as fontes premium carregam (sem FOIT).
-   **LCP < 1.2s / FCP < 200ms:** Resultado esperado dessas otimizações em redes 4G/3G.

> ⚠️ **Importante — Catálogo Dinâmico:** Nenhuma dessas otimizações afeta a atualização do cardápio. O Firebase Firestore mantém um listener de tempo real ativo; qualquer alteração feita no painel admin (novo produto, mudança de preço, item removido) reflete automaticamente em todos os clientes abertos em segundos, independente do cache.

#### Atualização após deploy (Instagram / WebView)

O navegador embutido do Instagram costuma **cachear o HTML** mesmo com `Cache-Control: no-cache`. Para o cliente ver JS/CSS novos sem “puxar para atualizar”:

- **`public/deploy-version.json`** — versão atual do deploy (`no-cache` no Hosting); gerado por [`scripts/stamp-version.js`](scripts/stamp-version.js) junto com o `?v=` nos HTML.
- **Bootstrap no `<head>`** de `index.html` e `confirmacao.html` — compara `meta[name="deploy-version"]` com o JSON; se divergir, faz `location.replace` com `?_helo=<versão>` (quebra cache do WebView) antes do React carregar; repete em `pageshow` quando a página volta do bfcache.
- **`VERSAO_ASSETS_ESTATICOS`** em `admin-utils.js` — sincronizado no mesmo stamp para URLs dinâmicas de assets.

Após `firebase deploy --only hosting`, teste abrindo o link da bio no app Instagram (fechar e reabrir a aba).

- **Logo mobile reduzida** — `.helo-logo` usa `height: clamp(220px, 64vw, 280px)` no breakpoint mobile para liberar espaço acima da dobra e aproximar o cliente da vitrine.
- **Bloco "Como funciona seu pedido"** — substitui a lista longa de informações por 3 pontos comerciais visíveis: `Artesanal premium`, `Entrega ou retirada` e `Atendimento pelo WhatsApp`.
- **Políticas sob demanda** — regras de encomendas maiores, retirada, personalizações e cancelamentos ficam em `<details class="policy-details">`, evitando atrito antes da compra.
- **CTA do produto mais seguro no mobile** — o rodapé do card usa `.product-card-actions` com `flex-wrap` para impedir overflow; `Comprar` permanece como ação principal e `Detalhes` vira apenas ícone no mobile.

Arquivos principais:

- `public/js/components/vitrine-produtos.component.js` — conteúdo do bloco de confiança e políticas.
- `public/js/components/product-card.component.js` — estrutura do rodapé de ações do card.
- `public/css/style.css` — responsividade, hierarquia visual e proteção contra overflow.

### Atualização recente da vitrine vazia

- A vitrine sem produtos agora exibe o **mascote Helo** (`public/mascote-helo.png`) em vez do bloco de aviso padrão.
- A mensagem exibida é: **"Nossas delícias estão saindo do forno. Volte em breve para conferir!"**
- O layout foi ajustado para manter a imagem centralizada e o texto legível em **mobile e desktop**.

Após editar esses arquivos, rode `npm run build:public` para atualizar `public/js-build/`.

### Painel Administrativo (Admin)

- **Pedidos** — Lista em tempo real com status (Novo → Confirmado → Pago → Pronto → Concluído), filtros por categoria, busca ampliada (cliente, status, pagamento, campanha, itens, categorias), badges de categoria por item, edição inline, detecção de duplicatas
- **Clientes** (navbar **Clientes**) — **Top Clientes**, **Top Pedidos**, **Inativos**, **Acessos**.
  - **Top Clientes:** ranking por período (**Hoje**, **Semana**, **Mês**, **7 dias**, **30 dias**) no fuso **America/Fortaleza**; alternância **Valor (R$)** × **Qtd. pedidos**; card do melhor cliente do recorte; filtro de campanha e botão **Criar Story** (top 3). Entram só pedidos com status **Pago**, **Pronto** ou **Concluído**, agrupados por telefone (últimos 8 dígitos). Uma consulta Firestore (`createdAt >=` início do mês civil ou rolling 30d, o que for mais antigo, até 3000 pedidos) alimenta todos os recortes em memória — motor `public/js/core/analytics/client-ranking.js` (`window.HeloClientRanking`) + hook `useRankingClientesPeriodo` em `public/js/script.js` (tab `customers`). Testes: `node scripts/test-client-ranking.js`.
  - **Inativos:** só clientes com **último pedido há mais de 30 dias corridos** (~1 mês), ordenados por inatividade, com destaque por faixa (ex.: 30–59 dias), data da última compra e atalho **Chamar no WhatsApp**; quando há registros, é possível **baixar um relatório HTML** do quadro. Lógica: `useClientesInativos` + `ClientesInativosAlerta` (tab `inativos`).
- **Agenda** — Agendamentos com categorias, status e busca normalizada
- **Entregas** — Filtros por motorista, campanha e período; KPIs de rentabilidade; tabela diária consolidada
- **Cardápio** — CRUD de produtos com upload de imagens, categorias, abas de menu, score de completude e deduplicação por identidade
- **Produção & Estoque** — Cadastro de insumos, fichas técnicas (receitas), produção em bateladas com baixa automática de estoque, conversões de unidade (g↔kg, ml↔L, customizadas), alertas de estoque baixo, custos de produção (energia, gás, mão de obra, impostos, fixos)
- **Financeiro** — Fluxo de caixa (CRUD de entradas/saídas), indicadores líquidos (sem frete/juros), pedidos pendentes, fechamento diário, exportação CSV, edição inline de transações
- **Feedbacks** — Visualização de pesquisas de satisfação
- **Campanhas** — CRUD com status (ativo/inativo), modo de ativação (manual/automático/híbrido), conflitos de janela, prioridade
- **Configurações** — Modo do site (evento/livre), controle de entrega on/off, limitador de unidades, prazo de pedidos, configuração de impressora térmica; **Pré-visualização pública** da vitrine em rascunho (loja fechada) com atalho para abrir a vitrine “ao vivo” numa nova aba; contatos/redes alimentados por `HeloPublicContact` (fonte única com a vitrine)
- **Pagamentos** (aba em **Sistema**) — Chave PIX, titular, toggle **Checkout PIX InfinitePay** (`site_settings.infinityPayEnabled`): desligado = PIX legado (WhatsApp); ligado = InfinitePay + confirmação automática quando backend/Make estão prontos

#### Convenção obrigatória de navegação (navbar + tabs)

Para evitar regressões no painel admin, considere esta regra como contrato de UI:

- **Navbar primária (topo)**: apenas módulos de alto nível (`Operação`, `Catálogo`, `Clientes`, `Produção`, `Sistema`).
- **Tabs secundárias (abaixo da navbar)**: seções internas do módulo ativo.
- As tabs secundárias **não são botões de ação avulsos**; elas determinam a seção renderizada pelo estado `tab` no `AdminPanel`.
- Novas configurações globais devem entrar em **`Sistema > Configurações`** (tab `settings`), sem criar rota isolada ou componente não vinculado à navegação — **exceto** opções estritamente de pagamento/PIX, que ficam em **`Sistema > Pagamentos`** (tab `payments`), persistindo em `site_settings` com merge.
- O controle **`IA no catálogo`** segue esse padrão e deve permanecer em `Sistema > Configurações`, persistindo em `site_settings.aiEnabled`.

Referências de implementação:

- Estrutura dos grupos e tabs: `public/js/script.js` (`NAV_GROUPS`).
- Renderização das seções por tab ativa: `public/js/script.js` (condições `tab === ...`).
- Gate do chat público por configuração: `public/js/main-app.js` (`siteSettingsLoaded && siteSettings.aiEnabled === true`) com carregamento lazy do script.
- Gate PIX InfinitePay: `public/js/main-app.js` — só usa checkout quando `siteSettingsLoaded && siteSettings.infinityPayEnabled === true`; salvamento do toggle em `public/js/script.js` (aba **Pagamentos**).

### Back-end (Cloud Functions)

- **Notificação por e-mail** — Disparo automático via EmailJS ao criar pedido
- **Reserva de estoque** — Transação atômica ao criar pedido (decrementa `stockLimit` dos produtos limitados)
- **Restauração de estoque** — Ao deletar ou cancelar pedido, estoque é revertido em transação
- **Proteção de conclusão** — Impede concluir pedido sem reserva de estoque válida
- **Admin Claim API** — Endpoint seguro para atribuir custom claim `admin` a e-mails autorizados
- **QZ Tray API** — Endpoints de assinatura digital e certificado para impressão térmica segura (chaves privadas no servidor, nunca expostas ao front-end)
- **Assistente de IA (groqChat)** — Proxy seguro para API Groq com base de conhecimento dinâmica, rate limiting (10 req/min por IP), CORS configurado e gate de custo por `site_settings.aiEnabled`.
- **WhatsApp via n8n (opcional)** — Triggers Firestore + `POST` JSON com Bearer para webhook único (`event` no corpo); idempotência em `orders.integrations.n8n`. Ver `functions/README.md`, `functions/n8nWhatsAppIntegration.js` e §10.4 no `PDR.md`.

### Horário oficial do Dia a Dia

- Exibição padrão operacional atual: **Quarta a domingo — 14:30hrs às 20hrs**.
- Referências de renderização: `public/js/main-app.js`, `public/js/cart-ui.js` e fallback legado no `public/js/script.js`.

### Impressão Térmica

- Comandos **ESC/POS** para impressora Elgin i9 via QZ Tray
- Recibos separados: cozinha e caixa
- Sequência de corte dedicada (full/partial cut)
- Configuração de largura e linhas de alimentação no painel admin

---

## Tecnologias

| Camada             | Tecnologia                                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| **Front-end**      | React 18 (CDN), HTML5, CSS3 puro, JSX via esbuild                             |
| **Back-end**       | Firebase Cloud Functions (Node.js 22)                                         |
| **Banco de Dados** | Firebase Firestore (tempo real via `onSnapshot`)                              |
| **Autenticação**   | Firebase Auth (anônimo para clientes, e-mail/senha para admin, custom claims) |
| **Armazenamento**  | Firebase Storage (imagens de produtos)                                        |
| **Hospedagem**     | Firebase Hosting com cache-control otimizado                                  |
| **Impressão**      | QZ Tray 2.2.5 + ESC/POS (Elgin i9)                                            |
| **Notificação**    | EmailJS (server-side via Cloud Functions)                                     |
| **Build**          | esbuild (transpilação JSX → JS), scripts Node.js customizados                 |
| **Ícones**         | Phosphor Icons                                                                |

---

## Identidade Visual: Logo e Fundo

### Logo do topo

A logo grande exibida no topo da vitrine pública usa o arquivo:

```text
public/LOGO HELÔ.png
```

Ela é aplicada pelo CSS em `public/css/style.css`, na classe `.helo-logo`:

```css
background-image: url("../LOGO HELÔ.png?v=20260414-1");
```

Forma mais simples de trocar: substituir `public/LOGO HELÔ.png` por outro PNG mantendo exatamente o mesmo nome. Assim não é necessário alterar o código.

Se preferir usar outro nome de arquivo, coloque a nova imagem dentro de `public/` e altere a URL no CSS. Exemplo:

```css
background-image: url("../minha-nova-logo.png?v=20260501-1");
```

O `?v=...` serve para ajudar o navegador a buscar a versão nova quando houver cache. Ao trocar a imagem ou o nome, atualize esse valor.

### Fundo azul do site

O fundo azul principal da área pública é definido em `public/css/style.css` nestes pontos:

- `body { background-color: #2A3D5D; }`
- `.main-content { background-color: #2A3D5D; }`
- `:root { --primary: #2A3D5D; }`

Para trocar apenas o fundo, altere `background-color` no `body` e no `.main-content`.

Para trocar o azul da identidade visual em várias partes do site, altere também a variável `--primary`. Essa variável afeta textos, bordas, estados de foco e outros elementos.

### Imagem de fundo

Existe uma variável preparada para imagem de fundo da marca:

```css
--brand-backdrop-image: none;
```

Hoje ela está desativada. Para ativar uma imagem dentro de `public/`, troque para algo como:

```css
--brand-backdrop-image: url("../fundo-e-laterais-helo.png");
```

Depois confira visualmente a vitrine pública em desktop e celular, porque imagem de fundo pode afetar contraste e leitura.

---

## Estrutura de Pastas

```
site-helo-final/
├── public/                          # Diretório público servido pelo Firebase Hosting
│   ├── index.html                   # Vitrine — carrega apenas bundles públicos (dual-HTML)
│   ├── admin.html                   # Painel admin — entry `app-admin.js` + CSS extra abaixo
│   ├── css/
│   │   ├── style.css                # Estilos globais (mobile-first)
│   │   └── admin-settings.css       # Cartões / toggles da aba Configurações + pré-visualização
│   ├── js/                          # Código-fonte JSX (editar AQUI)
│   │   ├── app.js                   # Configuração central, Firebase, constantes, utilitários
│   │   ├── carrinho.js              # Hooks do carrinho (useCart, useSpecialClient, useOrderTotal)
│   │   ├── cart-ui.js               # Interface visual do carrinho (drawer lateral)
│   │   ├── crm.js                   # CRM: telefone, agenda, notificações, duplicatas
│   │   ├── financeiro.js            # Fluxo de caixa, indicadores, fechamento, CSV
│   │   ├── estoque.js               # Insumos, fichas técnicas, produção, alertas
│   │   ├── main-app.js              # React root da vitrine pública (index.html)
│   │   ├── app-admin.js             # React root do painel admin (admin.html)
│   │   ├── script.js                # AdminPanel + ESC/POS + FeedbackExperience + ImageManager
│   │   ├── ui-shell.js              # Modal de login legado (não carregado nos HTMLs atuais)
│   │   ├── components/              # Componentes React extraídos (modularização)
│   │   │   ├── admin/               # UI reutilizável do admin (expõe window.HeloAdminUi)
│   │   │   │   ├── admin-toggle-pill.component.js
│   │   │   │   └── admin-settings-card.component.js
│   │   │   ├── brand-logo.component.js
│   │   │   ├── cabecalho.component.js
│   │   │   ├── chat-widget.component.js
│   │   │   ├── product-card.component.js
│   │   │   ├── rodape-site.component.js
│   │   │   ├── store-closed-vitrina.component.js  # Estado “loja fechada” (vitrine + preview admin)
│   │   │   └── vitrine-produtos.component.js
│   │   └── core/                    # Módulos compartilhados (IIFE em window.Helo*)
│   │       ├── config/
│   │       │   └── app-config.js    # window.HeloAppConfig (Firebase config)
│   │       ├── constants/
│   │       │   └── contatos-loja-publica.js  # window.HeloPublicContact (WhatsApp, redes)
│   │       ├── utils/
│   │       │   ├── admin-utils.js  # window.HeloAdminUtils (normalização, busca, IDs)
│   │       │   └── text-date-utils.js  # window.HeloCoreUtils (texto, datas, sanitização marketing)
│   │       ├── analytics/
│   │       │   └── client-ranking.js   # window.HeloClientRanking (ranking Top Clientes, sem Firestore)
│   │       ├── campaign/
│   │       │   └── campaign-utils.js   # window.HeloCampaignUtils (campanhas)
│   │       └── catalog.js          # window.HeloCatalog (categorias, abas, deduplicação)
│   ├── js-build/                    # Saída do esbuild (NÃO editar — regenerada pelo build)
│   ├── audio/
│   │   └── new-order-notification.wav
│   ├── LOGO HELÔ.png
│   ├── share-preview.jpg
│   └── favicon.svg / favicon.ico
├── functions/                       # Firebase Cloud Functions
│   ├── index.js                     # Todas as functions exportadas
│   ├── .env.example                 # Template de variáveis de ambiente (SEM valores reais)
│   └── package.json
├── scripts/                         # Scripts de build e utilidade
│   ├── build-public-js.js           # Transpila JSX de js/ → js-build/ via esbuild
│   ├── test-client-ranking.js       # Testes unitários de HeloClientRanking (Node, sem Jest)
│   ├── validate-html-pages.js       # Valida scripts em index/admin/confirmacao (dual-HTML)
│   ├── stamp-version.js             # Versão UTC: ?v= nos HTML, deploy-version.json, admin-utils
│   ├── strip-bom.js                 # Remove BOM de arquivos de texto
│   └── migrate-campaigns.js         # Migração de campanhas (backfill campaignId)
├── firestore.rules                  # Regras de segurança do Firestore
├── firestore.indexes.json           # Índices compostos do Firestore
├── storage.rules                    # Regras de segurança do Firebase Storage
├── firebase.json                    # Configuração do Firebase (hosting, functions, rewrites)
├── .firebaserc                      # Projeto Firebase padrão
├── .gitignore                       # Arquivos ignorados pelo Git
└── package.json                     # Scripts de build e deploy
```

---

## Instalação e Configuração

### Pré-requisitos

- **Node.js** 18+ (para scripts de build e Cloud Functions)
- **Firebase CLI** (`npm install -g firebase-tools`)
- Conta Firebase com projeto criado (Firestore, Auth, Hosting, Functions, Storage habilitados)

### Passos

1. **Clone o repositório:**

   ```bash
   git clone <url-do-repositorio>
   cd site-helo-final/site-helo-final
   ```

2. **Instale as dependências raiz (esbuild):**

   ```bash
   npm install
   ```

3. **Instale as dependências das Cloud Functions:**

   ```bash
   cd functions
   npm install
   cd ..
   ```

4. **Configure as variáveis de ambiente das Functions:**

   ```bash
   cd functions
   cp .env.example .env
   # Edite o .env com seus valores reais (NUNCA comite este arquivo)
   cd ..
   ```

   Variáveis necessárias (consulte `functions/.env.example`):
   - `QZ_CERT_PEM` — Certificado PEM para assinatura QZ Tray
   - `QZ_PRIVATE_KEY_PEM` — Chave privada para assinatura QZ Tray
   - `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` — Configuração EmailJS
   - `EMAILJS_NOTIFY_EMAILS` — E-mails destinatários de notificação
   - `ADMIN_ALLOWED_EMAILS` — E-mails autorizados a receber claim de admin
   - `GROQ_API_KEY` — Chave de API do Groq para assistente de IA (obter em https://console.groq.com/keys)

5. **Faça login no Firebase:**

   ```bash
   firebase login
   ```

6. **Selecione o projeto:**
   ```bash
   firebase use <seu-project-id>
   ```

---

## Execução

### Build local (transpila JSX → JS)

```bash
npm run build:public
```

Isso executa `esbuild` sobre os arquivos JSX em `public/js/` e gera a saída em `public/js-build/`.

### Servidor local de desenvolvimento

```bash
firebase emulators:start
```

Ou, para apenas o hosting:

```bash
firebase hosting:channel:live
```

### Deploy para produção

**Hosting (front-end):**

```bash
npm run deploy:hosting
# Equivalente a: firebase deploy --only hosting
```

O `predeploy` do `firebase.json` executa automaticamente:

1. `npm run build:public` — Transpila JSX
2. `node scripts/stamp-version.js` — Gera versão e atualiza cache-bust
3. `node scripts/strip-bom.js public` — Remove BOM de arquivos

> Nota: última implantação registrada em **09/05/2026** — versão `20260509-053850` em [heloconfeitarianr.web.app](https://heloconfeitarianr.web.app).

**Cloud Functions:**

```bash
cd functions
npm run env:sync-deploy
firebase deploy --only functions
```

(`env:sync-deploy` copia `functions/.env` → `functions/.env.helo-confeitaria` para o CLI injetar variáveis no deploy — necessário para InfinitePay entre outros.)

Teste rápido após o deploy (smoke HTTP): na raiz do projeto, `npm run functions:smoke:pix` (esperado **401** em `criarCheckoutPix` sem token se as variáveis estiverem no servidor; **503** = falta env/deploy). Detalhes: [`functions/README.md`](functions/README.md) secção «Como testar as funções PIX».

**Tudo (hosting + functions + regras):**

```bash
firebase deploy
```

---

## Arquitetura Front-end

### Padrão de Módulos (IIFE + window)

O projeto usa IIFEs (Immediately Invoked Function Express) que expõem APIs em objetos globais `window.Helo*`. Isso permite carregamento via `<script>` sem bundler de módulos:

| Módulo                  | Global                     | Arquivo Fonte                     |
| ----------------------- | -------------------------- | --------------------------------- |
| Configuração            | `window.HeloAppConfig`     | `core/config/app-config.js`       |
| Utilitários base        | `window.HeloCoreUtils`     | `core/utils/text-date-utils.js`   |
| Contatos públicos       | `window.HeloPublicContact` | `core/constants/contatos-loja-publica.js` |
| Utilitários de campanha | `window.HeloCampaignUtils` | `core/campaign/campaign-utils.js` |
| Utilitários admin       | `window.HeloAdminUtils`    | `core/utils/admin-utils.js`       |
| Catálogo                | `window.HeloCatalog`       | `core/catalog.js`                 |
| App central             | `window.HeloApp`           | `app.js`                          |
| Carrinho (hooks)        | `window.HeloCart`          | `carrinho.js`                     |
| CRM                     | `window.HeloCrm`           | `crm.js`                          |
| Financeiro              | `window.HeloFinance`       | `financeiro.js`                   |
| Ranking de clientes     | `window.HeloClientRanking` | `core/analytics/client-ranking.js` |
| Estoque                 | `window.HeloInventory`     | `estoque.js`                      |
| Estados globais         | `window.*` (escopo global) | `core-globals.js`                 |
| Componentes visuais     | `window.HeloComponents`    | `components/*.component.js`       |
| UI admin extraível      | `window.HeloAdminUi`       | `components/admin/*.component.js` |

### Ordem de Carregamento

#### index.html (Vitrine Pública)

```
core/config/app-config.js
→ core/utils/text-date-utils.js
→ core/constants/contatos-loja-publica.js
→ components (brand-logo, cabecalho, rodape-site, product-card, vitrine-produtos, store-closed-vitrina)
→ app.js → carrinho.js
→ core/utils/admin-utils.js → core/catalog.js → core-globals.js
→ cart-ui.js → main-app.js (React root)
→ chat-widget.component.js (lazy runtime, somente se `aiEnabled === true` após `site_settings` carregar)
```

**NÃO carrega:** `crm.js`, `financeiro.js`, `estoque.js`, `script.js`, `ui-shell.js`, `app-admin.js`

#### admin.html (Painel Administrativo)

```
core/config/app-config.js
→ core/utils/text-date-utils.js
→ core/constants/contatos-loja-publica.js
→ core/campaign/campaign-utils.js
→ components (brand-logo, cabecalho, rodape-site, store-closed-vitrina,
   admin/admin-toggle-pill, admin/admin-settings-card)
→ app.js → carrinho.js → crm.js → financeiro.js → estoque.js
→ core/utils/admin-utils.js
→ core/analytics/client-ranking.js   # HeloClientRanking — antes de script.js (lazy)
→ core/catalog.js → core-globals.js
→ app-admin.js (React root; `script.js` carrega depois sob demanda)
```

**NÃO carrega como `<script defer>` fixo:** `product-card`, `vitrine-produtos`, `chat-widget`, `cart-ui`, `main-app`, `script.js` (este último só após fluxo lazy no cliente)

### Regra de Edição

- **Editar sempre** os arquivos em `public/js/` (código-fonte JSX)
- **Nunca editar** `public/js-build/` (regenerado pelo build)
- Após alterações, executar `npm run build:public` para regerar os bundles

### Regra de documentação (obrigatória)

Toda alteração relevante deve ficar documentada em **dois níveis**:

- **No código**: adicionar comentário curto e objetivo no ponto da implementação quando a decisão não for óbvia (principalmente regras de navegação, toggles globais e comportamentos de negócio).
- **No README**: atualizar a seção correspondente com o que mudou, impacto funcional e convenções para próximos handoffs.
- **Preferências e decisões do projeto** (ex.: padrões de UI/admin, local correto de toggles, restrições de navegação) devem ser registradas no README para orientar próximos agentes.
- **Mudança sem documentação não está concluída**: ao finalizar feature/refactor, revisar se código + README ficaram alinhados.

#### Padrão JSDoc por função (obrigatório para código novo)

Para funções **novas** ou refatoradas, prefira JSDoc formal — facilita
hover do editor e auditoria automática:

```js
/**
 * Resumo curto da função (uma linha).
 *
 * @param {Tipo} nomeParametro - O que esse parâmetro representa
 * @returns {Tipo} O que devolve
 *
 * Notas opcionais sobre comportamento, decisões e edge cases.
 * @update YYYY-MM-DD — Descrição da última alteração relevante.
 */
```

Funções **antigas** já documentadas com comentário em PT acima da assinatura
NÃO precisam ser convertidas em massa — o conteúdo informativo já está lá.
A conversão acontece naturalmente quando o bloco é extraído ou refatorado.

> **Estado atual da cobertura documental:** completo nos diretórios
> `public/js/core/`, `public/js/components/`, `scripts/` e nos handlers
> HTTP/triggers de `functions/index.js`. Detalhes em
> `AUDITORIA_DOCS_CODIGO_2026-05-09.md` §8.

---

## Segurança

### Arquivos que NÃO devem ser commitados

O `.gitignore` já exclui os seguintes arquivos sensíveis. **Nunca** os adicione ao repositório:

- `.env` e `.env.*` (exceto `.env.example`) — Contêm chaves privadas, credenciais EmailJS e e-mails autorizados
- `*.key`, `*.pem`, `*.crt`, `*.p12` — Certificados e chaves criptográficas
- `config.local.*`, `secrets.*`, `credentials.*` — Configurações locais sensíveis
- `service-account*.json`, `google-credentials*.json` — Contas de serviço Firebase
- `logs/`, `backups/`, `dump/` — Dados operacionais e backups de banco

### Modelo de Segurança

- **Firestore Rules** — Leitura pública negada; clientes autenticados leem produtos; admins leem/escrevem tudo; pedidos só são lidos pelo dono ou admin; conclusão de pedido exige reserva de estoque válida
- **Storage Rules** — Leitura requer autenticação; escrita requer claim `admin`
- **Custom Claims** — Admin recebe claim `admin` via endpoint seguro que verifica e-mail contra lista autorizada no `.env`
- **QZ Tray** — Chave privada de assinatura permanece no servidor (Cloud Functions); front-end solicita assinatura via API, nunca acessa a chave diretamente
- **Auth** — Clientes usam autenticação anônima; admins usam e-mail/senha; listeners sensíveis (pedidos, financeiro, ingredientes) só são iniciados quando `isAdmin === true`
- **Dependências em `functions/`** — Evitar `overrides` para pacotes que não aparecem na árvore real ou que só existem para “silenciar” alertas sem atualizar a cadeia; prefira subir `firebase-admin` / `firebase-functions` ou a dependência intermediária. Detalhes e overrides atuais: [`functions/README.md`](functions/README.md).

### Separação de Bundles (08/05/2026)

A aplicação agora usa **dual HTML architecture** para máxima segurança e performance:

#### Vitrine Pública (index.html)

- Entrypoint: `main-app.js` (React root)
- Carrega apenas: catálogo, carrinho, chat IA
- **NÃO expõe:** lógica admin, financeiro, estoque, impressora térmica
- Bundle: ~30-50KB (otimizado para clientes)

#### Painel Admin (admin.html)

- Entrypoint: `app-admin.js` (React root)
- Carrega: AdminPanel, CRM, financeiro, estoque, impressora térmica
- **NÃO carrega:** componentes de vitrine
- Bundle: ~150-200KB (completo para operação)

**Benefícios:**

- Código administrativo nunca exposto no navegador do cliente
- Redução de ~120-150KB no bundle final do cliente
- Contextos público × privado totalmente isolados

#### Correção de Namespace Conflict (08/05/2026)

**Problema:** O `admin.html` carrega `core-globals.js` (que expõe variáveis em `window.*`) e também `script.js`. O `script.js` tinha declarações `const` para identificadores como `ProductCard`, `CATEGORIAS` etc. Quando o motor JS encontra `const X` e `X` já existe no escopo global via `var`, lança `SyntaxError: Identifier 'X' has already been declared`.

**Solução:** As declarações conflitantes em `script.js` foram convertidas de `const` para `var`. O `var` permite redeclaração no mesmo escopo sem gerar erro de sintaxe.

**Regra de prevenção:** Ao adicionar novas constantes/componentes em `script.js` que também existam em `core-globals.js` ou em qualquer componente carregado antes, use `var` (não `const`/`let`) para evitar o erro.

---

## Licença

Uso privado. Todos os direitos reservados.
