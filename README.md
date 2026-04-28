# Helô Confeitaria — Sistema de Pedidos e Gestão

Sistema web completo para confeitaria artesanal, integrando vitrine de produtos com pedidos online, painel administrativo em tempo real, gestão de estoque e produção, fluxo de caixa, impressão térmica e automação via WhatsApp.

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

### Back-end (Cloud Functions)

- **Notificação por e-mail** — Disparo automático via EmailJS ao criar pedido
- **Reserva de estoque** — Transação atômica ao criar pedido (decrementa `stockLimit` dos produtos limitados)
- **Restauração de estoque** — Ao deletar ou cancelar pedido, estoque é revertido em transação
- **Proteção de conclusão** — Impede concluir pedido sem reserva de estoque válida
- **Admin Claim API** — Endpoint seguro para atribuir custom claim `admin` a e-mails autorizados
- **QZ Tray API** — Endpoints de assinatura digital e certificado para impressão térmica segura (chaves privadas no servidor, nunca expostas ao front-end)

### Impressão Térmica

- Comandos **ESC/POS** para impressora Elgin i9 via QZ Tray
- Recibos separados: cozinha e caixa
- Sequência de corte dedicada (full/partial cut)
- Configuração de largura e linhas de alimentação no painel admin

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| **Front-end** | React 18 (CDN), HTML5, CSS3 puro, JSX via esbuild |
| **Back-end** | Firebase Cloud Functions (Node.js 22) |
| **Banco de Dados** | Firebase Firestore (tempo real via `onSnapshot`) |
| **Autenticação** | Firebase Auth (anônimo para clientes, e-mail/senha para admin, custom claims) |
| **Armazenamento** | Firebase Storage (imagens de produtos) |
| **Hospedagem** | Firebase Hosting com cache-control otimizado |
| **Impressão** | QZ Tray 2.2.5 + ESC/POS (Elgin i9) |
| **Notificação** | EmailJS (server-side via Cloud Functions) |
| **Build** | esbuild (transpilação JSX → JS), scripts Node.js customizados |
| **Ícones** | Phosphor Icons |

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
│   │   ├── main-app.js              # Componente App — estados globais, auth, listeners, checkout
│   │   ├── script.js                # AdminPanel + ESC/POS + FeedbackExperience + ImageManager
│   │   ├── ui-shell.js              # Modal de login admin + container administrativo
│   │   ├── components/              # Componentes React extraídos (modularização)
│   │   │   ├── brand-logo.component.js
│   │   │   ├── cabecalho.component.js
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
   cd site-helo-final
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

| Módulo | Global | Arquivo Fonte |
|---|---|---|
| Configuração | `window.HeloAppConfig` | `core/config/app-config.js` |
| Utilitários base | `window.HeloCoreUtils` | `core/utils/text-date-utils.js` |
| Utilitários de campanha | `window.HeloCampaignUtils` | `core/campaign/campaign-utils.js` |
| Utilitários admin | `window.HeloAdminUtils` | `core/utils/admin-utils.js` |
| Catálogo | `window.HeloCatalog` | `core/catalog.js` |
| App central | `window.HeloApp` | `app.js` |
| Carrinho (hooks) | `window.HeloCart` | `carrinho.js` |
| CRM | `window.HeloCrm` | `crm.js` |
| Financeiro | `window.HeloFinance` | `financeiro.js` |
| Estoque | `window.HeloInventory` | `estoque.js` |
| Componentes visuais | `window.HeloComponents` | `components/*.component.js` |

### Ordem de Carregamento (index.html)

```
app-config → text-date-utils → campaign-utils → components (compilados)
→ app.js → carrinho → crm → financeiro → estoque
→ admin-utils (compilado) → catalog (compilado)
→ script.js (compilado) → cart-ui (compilado) → ui-shell (compilado) → main-app (compilado)
```

### Regra de Edição

- **Editar sempre** os arquivos em `public/js/` (código-fonte JSX)
- **Nunca editar** `public/js-build/` (regenerado pelo build)
- Após alterações, executar `npm run build:public` para regerar os bundles

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

---

## Licença

Uso privado. Todos os direitos reservados.
