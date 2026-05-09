# Helô Confeitaria — Sistema de Pedidos e Gestão

Sistema web completo para confeitaria artesanal, integrando vitrine de produtos com pedidos online, painel administrativo em tempo real, gestão de estoque e produção, fluxo de caixa, impressão térmica e automação via WhatsApp.

---

## Fonte de Verdade Documental

- `README.md` (este arquivo): operação e visão técnica geral.
- `PDR.md` (dentro do projeto): decisões técnicas e padrões de manutenção.
- `ARCHITECTURE.md`: estrutura e arquitetura de execução.
- `QUICK_START.md`: onboarding rápido para desenvolvimento local.
- `functions/README.md`: contrato de APIs backend, variáveis e deploy de functions.

---

## Visão Geral

Plataforma **mobile-first** construída com React 18 (via CDN, sem bundler de app), Firebase Firestore em tempo real e Firebase Cloud Functions. O sistema opera em dois modos:

- **Modo Evento** — Campanhas sazonais (Páscoa, Natal etc.) com limite de unidades, prazo de pedidos e escassez controlada.
- **Modo Dia a Dia** — Operação contínua com cardápio aberto, sem limitadores de unidades.

Clientes navegam pelo catálogo, montam pedidos no carrinho e finalizam via WhatsApp com pagamento PIX, dinheiro ou cartão. Administradores gerenciam toda a operação por um painel integrado com atualizações em tempo real.

---

## Funcionalidades Principais

### Vitrine Pública (Cliente)

- Catálogo de produtos com abas de menu dinâmicas (deduzidas dos produtos cadastrados)
- Badge de **Mais Vendido** calculado por `productId` com deduplicação
- **Assistente de IA** — Chatbot treinado com base de conhecimento da confeitaria para responder dúvidas sobre produtos, pedidos, pagamentos, entrega e políticas
- Carrinho lateral (drawer) com formulário completo:
  - Dados do cliente (nome, WhatsApp)
  - Escolha de retirada ou entrega (controle admin de ativação/desativação)
  - Campos de endereço condicionais (rua, bairro, referência)
  - Observações do pedido com destaque visual
  - Pagamento: **PIX** (chave + botão copiar), **Dinheiro** (campo troco obrigatório) ou **Cartão** (1x–3x com taxas)
  - Cupom de desconto com validação
  - Detecção automática de cliente **VIP** (desconto 10% acima de threshold mensal)
- Resumo com subtotal, desconto VIP, frete, taxa de cartão e total
- Finalização via WhatsApp com mensagem pré-formatada contendo todos os dados do pedido
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
- **Agenda** — Agendamentos com categorias, status e busca normalizada
- **Entregas** — Filtros por motorista, campanha e período; KPIs de rentabilidade; tabela diária consolidada
- **Cardápio** — CRUD de produtos com upload de imagens, categorias, abas de menu, score de completude e deduplicação por identidade
- **Produção & Estoque** — Cadastro de insumos, fichas técnicas (receitas), produção em bateladas com baixa automática de estoque, conversões de unidade (g↔kg, ml↔L, customizadas), alertas de estoque baixo, custos de produção (energia, gás, mão de obra, impostos, fixos)
- **Financeiro** — Fluxo de caixa (CRUD de entradas/saídas), indicadores líquidos (sem frete/juros), pedidos pendentes, fechamento diário, exportação CSV, edição inline de transações
- **Feedbacks** — Visualização de pesquisas de satisfação
- **Campanhas** — CRUD com status (ativo/inativo), modo de ativação (manual/automático/híbrido), conflitos de janela, prioridade
- **Configurações** — Modo do site (evento/livre), controle de entrega on/off, limitador de unidades, prazo de pedidos, chave PIX, configuração de impressora térmica

#### Convenção obrigatória de navegação (navbar + tabs)

Para evitar regressões no painel admin, considere esta regra como contrato de UI:

- **Navbar primária (topo)**: apenas módulos de alto nível (`Operação`, `Catálogo`, `Clientes`, `Produção`, `Sistema`).
- **Tabs secundárias (abaixo da navbar)**: seções internas do módulo ativo.
- As tabs secundárias **não são botões de ação avulsos**; elas determinam a seção renderizada pelo estado `tab` no `AdminPanel`.
- Novas configurações globais devem entrar em **`Sistema > Configurações`** (tab `settings`), sem criar rota isolada ou componente não vinculado à navegação.
- O controle **`IA no catálogo`** segue esse padrão e deve permanecer em `Sistema > Configurações`, persistindo em `site_settings.aiEnabled`.

Referências de implementação:

- Estrutura dos grupos e tabs: `public/js/script.js` (`NAV_GROUPS`).
- Renderização das seções por tab ativa: `public/js/script.js` (condições `tab === ...`).
- Gate do chat público por configuração: `public/js/main-app.js` (`siteSettingsLoaded && siteSettings.aiEnabled === true`) com carregamento lazy do script.

### Back-end (Cloud Functions)

- **Notificação por e-mail** — Disparo automático via EmailJS ao criar pedido
- **Reserva de estoque** — Transação atômica ao criar pedido (decrementa `stockLimit` dos produtos limitados)
- **Restauração de estoque** — Ao deletar ou cancelar pedido, estoque é revertido em transação
- **Proteção de conclusão** — Impede concluir pedido sem reserva de estoque válida
- **Admin Claim API** — Endpoint seguro para atribuir custom claim `admin` a e-mails autorizados
- **QZ Tray API** — Endpoints de assinatura digital e certificado para impressão térmica segura (chaves privadas no servidor, nunca expostas ao front-end)
- **Assistente de IA (groqChat)** — Proxy seguro para API Groq com base de conhecimento dinâmica, rate limiting (10 req/min por IP), CORS configurado e gate de custo por `site_settings.aiEnabled`.

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
│   ├── index.html                   # SPA — ponto de entrada, carrega scripts em ordem
│   ├── css/
│   │   └── style.css                # Estilos globais (mobile-first)
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
│   │   │   ├── brand-logo.component.js
│   │   │   ├── cabecalho.component.js
│   │   │   ├── chat-widget.component.js
│   │   │   ├── product-card.component.js
│   │   │   ├── rodape-site.component.js
│   │   │   └── vitrine-produtos.component.js
│   │   └── core/                    # Módulos compartilhados (IIFE em window.Helo*)
│   │       ├── config/
│   │       │   └── app-config.js    # window.HeloAppConfig (Firebase config)
│   │       ├── utils/
│   │       │   ├── admin-utils.js  # window.HeloAdminUtils (normalização, busca, IDs)
│   │       │   └── text-date-utils.js  # window.HeloCoreUtils (texto, datas)
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
│   ├── stamp-version.js             # Gera versão UTC e atualiza ?v= no index.html
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

> Nota: última implantação registrada em **09/05/2026** — versão `20260509-053850` em https://heloconfeitarianr.web.app .

**Cloud Functions:**

```bash
cd functions
firebase deploy --only functions
```

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
| Utilitários de campanha | `window.HeloCampaignUtils` | `core/campaign/campaign-utils.js` |
| Utilitários admin       | `window.HeloAdminUtils`    | `core/utils/admin-utils.js`       |
| Catálogo                | `window.HeloCatalog`       | `core/catalog.js`                 |
| App central             | `window.HeloApp`           | `app.js`                          |
| Carrinho (hooks)        | `window.HeloCart`          | `carrinho.js`                     |
| CRM                     | `window.HeloCrm`           | `crm.js`                          |
| Financeiro              | `window.HeloFinance`       | `financeiro.js`                   |
| Estoque                 | `window.HeloInventory`     | `estoque.js`                      |
| Estados globais         | `window.*` (escopo global) | `core-globals.js`                 |
| Componentes visuais     | `window.HeloComponents`    | `components/*.component.js`       |

### Ordem de Carregamento

#### index.html (Vitrine Pública)

```
components de marca (brand-logo, cabecalho, rodape-site, product-card, vitrine-produtos)
→ app.js → carrinho.js
→ core/utils/admin-utils.js → core/catalog.js → core-globals.js
→ cart-ui.js → main-app.js (React root)
→ chat-widget.component.js (lazy runtime, somente se `aiEnabled === true` após `site_settings` carregar)
```

**NÃO carrega:** `crm.js`, `financeiro.js`, `estoque.js`, `script.js`, `ui-shell.js`, `app-admin.js`

#### admin.html (Painel Administrativo)

```
core/config/app-config.js → core/utils/text-date-utils.js → core/campaign/campaign-utils.js
→ components de marca (brand-logo, cabecalho, rodape-site)
→ app.js → carrinho.js → crm.js → financeiro.js → estoque.js
→ core/utils/admin-utils.js → core/catalog.js → core-globals.js
→ script.js → app-admin.js (React root)
```

**NÃO carrega:** `product-card.component.js`, `vitrine-produtos.component.js`, `chat-widget.component.js`, `cart-ui.js`, `main-app.js`, `ui-shell.js`

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
