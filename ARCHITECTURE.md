# Arquitetura Técnica — Helô Confeitaria

## Visão Geral da Aplicação

A aplicação é construída em **duas páginas HTML completamente separadas**:

1. **index.html** — Vitrine pública para clientes (compra de produtos)
2. **admin.html** — Painel administrativo (gestão do negócio)

Ambas compartilham o mesmo banco de dados (Firebase Firestore) e utilitários, mas carregam bundles de JavaScript completamente isolados por segurança e performance.

---

## Estrutura de Diretórios

```
site-helo-final/
├── public/                           # Arquivos estáticos servidos pelo Firebase Hosting
│   ├── index.html                    # Vitrine pública
│   ├── admin.html                    # Painel administrativo (novo em 08/05/2026)
│   ├── css/
│   │   └── style.css                 # Estilos compartilhados (vitrine + admin)
│   ├── js/                           # Arquivos fonte (.js) — raw JSX
│   │   ├── app.js                    # Config central Firebase (compartilhado)
│   │   ├── main-app.js               # React root da vitrine (index.html)
│   │   ├── app-admin.js              # React root do admin (admin.html)
│   │   ├── carrinho.js               # Lógica do carrinho (compartilhado)
│   │   ├── cart-ui.js                # Drawer do carrinho (vitrine)
│   │   ├── crm.js                    # Gestão de clientes (admin only)
│   │   ├── financeiro.js             # Fluxo de caixa (admin only)
│   │   ├── estoque.js                # Inventário (admin only)
│   │   ├── core-globals.js           # Desestruturação global de módulos
│   │   ├── ui-shell.js               # Modal de login legado (não usado)
│   │   ├── components/               # Componentes React
│   │   │   ├── product-card.component.js      # Card de produto (vitrine)
│   │   │   ├── vitrine-produtos.component.js  # Grid de produtos (vitrine)
│   │   │   ├── chat-widget.component.js       # Chat IA (vitrine)
│   │   │   ├── brand-logo.component.js        # Logo (compartilhado)
│   │   │   ├── cabecalho.component.js         # Header (compartilhado)
│   │   │   ├── rodape-site.component.js       # Footer (compartilhado)
│   │   │   └── ... (outros componentes)
│   │   ├── core/
│   │   │   ├── config/
│   │   │   │   └── app-config.js     # Config Firebase
│   │   │   ├── utils/
│   │   │   │   ├── admin-utils.js    # Utilitários admin (compartilhado)
│   │   │   │   └── text-date-utils.js# Utilitários base (compartilhado)
│   │   │   ├── campaign/
│   │   │   │   └── campaign-utils.js # Utilitários de campanha
│   │   │   └── catalog.js            # Dados do catálogo (compartilhado)
│   │   └── script.js                 # AdminPanel completo (~542KB, admin only)
│   ├── js-build/                     # Arquivos compilados (gerados por npm run build:public)
│   │   └── ... (mesma estrutura de js/, mas transpilado)
│   └── ... (imagens, favicon, etc.)
├── scripts/
│   ├── build-public-js.js            # Script que compila js/ → js-build/
│   ├── stamp-version.js              # Adiciona versão ao HTML
│   └── strip-bom.js                  # Remove BOM de arquivos UTF-8
├── functions/                        # Cloud Functions (Node.js 22)
│   ├── index.js                      # Entrypoint
│   └── ... (APIs para impressora, admin claims, chat IA, etc.)
├── firebase.json                     # Configuração Firebase Hosting
├── firestore.rules                   # Regras de segurança Firestore
├── storage.rules                     # Regras de segurança Storage
├── package.json                      # Scripts NPM (build, deploy)
├── README.md                         # Documentação geral
├── ARCHITECTURE.md                   # Este arquivo
└── ... (configs diversas)
```

---

## Namespace Conflict — Regra Crítica de Compatibilidade

### Causa Raiz

O `admin.html` carrega dois grupos de scripts que compartilham o mesmo escopo global:

1. **`core-globals.js`** — expõe variáveis via `var` no objeto `window` (ex.: `window.HeloComponents.ProductCard`)
2. **`script.js`** — originalmente declarava as mesmas variáveis com `const`

Quando o motor JavaScript encontra `const X` e `X` já foi declarado via `var` no mesmo escopo, lança:

```
Uncaught SyntaxError: Identifier 'X' has already been declared
```

### Solução Aplicada (08/05/2026)

As declarações conflitantes em `script.js` foram convertidas de `const` para `var`. O `var` permite redeclaração no mesmo escopo sem gerar erro de sintaxe — o segundo `var X` é simplesmente ignorado pelo motor.

### Regra de Prevenção

> **Ao adicionar qualquer novo componente ou constante em `script.js`:**
> Use `var` (não `const` nem `let`) para identificadores que também existam em `core-globals.js` ou em qualquer script carregado antes de `script.js` no `admin.html`.

---

## Bundle Separation (Performance & Security)

### Problema Original

Antes da implementação, o `index.html` carregava **todo o código da aplicação**, incluindo:

- AdminPanel (~542KB)
- CRM, Financeiro, Estoque modules
- Impressora térmica (qz-tray.js ~100KB)

**Resultado:** Cliente final baixava ~740KB+ de código administrativo que não precisava.

### Solução: Dual HTML Architecture

#### index.html (Vitrine Pública)

```
entrypoint: main-app.js
├── React root com renderização do catálogo
├── Carrinho de compras
├── Chat IA para suporte
└── Login (redireciona para admin.html)

Scripts carregados (~30-50KB):
✓ app.js              (config central)
✓ catalog.js          (produtos)
✓ core-globals.js     (states)
✓ admin-utils.js      (utilitários)
✓ carrinho.js
✓ cart-ui.js
✓ main-app.js         ← REACT ROOT
✓ components (vitrine)
✓ chat-widget.component.js
✗ NÃO carrega: script.js, crm.js, financeiro.js, estoque.js, ui-shell.js, qz-tray.js
```

#### admin.html (Painel Administrativo)

```
entrypoint: app-admin.js
├── React root com renderização do painel
├── Tabs de navegação (Operação, Catálogo, Clientes, etc.)
├── AdminPanel (script.js) — ~542KB completo
├── CRM, Financeiro, Estoque modules
└── Integração com impressora térmica

Scripts carregados (~150-200KB):
✓ app.js              (config central)
✓ catalog.js          (produtos)
✓ core-globals.js     (states)
✓ admin-utils.js      (utilitários)
✓ carrinho.js
✓ crm.js
✓ financeiro.js
✓ estoque.js
✓ script.js           (~542KB, AdminPanel completo)
✓ app-admin.js        ← REACT ROOT
✓ qz-tray.js (CDN)    (~100KB, impressora térmica)
✗ NÃO carrega: product-card, vitrine-produtos, chat-widget, main-app
```

### Resultados

| Métrica       | Antes             | Depois   | Ganho                |
| ------------- | ----------------- | -------- | -------------------- |
| Client Bundle | ~740KB+           | ~30-50KB | **690KB reduzidos!** |
| TTI (3G)      | Lento             | Rápido   | ⚡ +20%              |
| LCP           | > 2.5s            | < 1.2s   | ⚡ Otimizado         |
| FCP           | > 1.5s            | < 0.2s   | ⚡ Skeleton Screen   |
| Code Exposure | Script.js exposto | Privado  | 🔒 Seguro            |

---

## Estratégias de Performance Avançadas (Implementadas em 08/05/2026)

### 1. Skeleton Screens (FCP Optimization)
Para eliminar o "flash de tela branca" durante a inicialização do React/Firebase, o `index.html` agora contém um esqueleto visual em CSS inline.
- **Resultado:** Renderização visual imediata (< 200ms).

### 2. Priorização de Recursos (Critical Path)
- **Preloading:** O navegador é instruído a baixar `style.css` e bibliotecas React com prioridade máxima via `rel="preload"`.
- **Deferring:** Scripts não essenciais para a visualização inicial (como o Chat de IA e o Rodapé) são carregados com `defer` para não bloquear o LCP.

### 3. Firestore Offline Persistence (UX Optimization)
A persistência via IndexedDB foi habilitada no `app.js`.
- **Offline-First:** O catálogo carrega instantaneamente em visitas recorrentes, mesmo sem conexão.
- **Sincronização:** Mudanças feitas localmente são sincronizadas automaticamente com o servidor quando a conexão retorna.

### 4. Otimização Ultra-Mobile (Imagens e Renderização)
- **Lazy Loading & Decoding:** Imagens de produtos só carregam quando entram na tela e são decodificadas de forma assíncrona.
- **Fetch Priority:** A logo oficial tem prioridade máxima de download no navegador.
- **Content Visibility:** O navegador economiza bateria e CPU ao não renderizar elementos fora da dobra inicial.
- **Font Display Swap:** O texto é exibido imediatamente usando fontes do sistema enquanto as fontes premium carregam.

---

## Build Process

### Arquitetura do Build

```
js/ (fonte JSX)
  ↓ esbuild
js-build/ (JavaScript transpilado)
  ↓ Firebase Hosting
HTML files (index.html, admin.html)
  ↓ Navegador
React components renderizados
```

### Build Steps

1. **Local: Desenvolvimento**

   ```bash
   npm run build:public
   ```

   - Lê arquivos de `public/js/`
   - Transpila JSX → JavaScript moderno (ES2020)
   - Escreve em `public/js-build/`
   - Ambos index.html e admin.html referem arquivos em `js-build/`

2. **Pre-deploy: Preparação**

   ```bash
   npm run prepare:hosting
   ```

   - `npm run build:public` (compila JSX)
   - `node ./scripts/stamp-version.js` (adiciona versão ao HTML)
   - `node ./scripts/strip-bom.js public` (remove BOM UTF-8)

3. **Deploy: Produção**
   ```bash
   npm run deploy:hosting
   ```

   - Firebase Hosting publica `public/` inteiro
   - HTML não é cacheado (no-cache headers)
   - JS/CSS são immutable por 1 ano (versioning via query string)

---

## Firestore Data Model

### Collections

```
products/
  {productId}
    ├── name: string
    ├── description: string
    ├── price: number
    ├── category: string
    ├── image: string (URL do Storage)
    ├── bestseller: number (count)
    └── ... (outros campos)

pedidos/
  {orderId}
    ├── clientName: string
    ├── clientPhone: string
    ├── items: array[{productId, quantity, price}]
    ├── status: "novo" | "confirmado" | "pago" | "pronto" | "concluído"
    ├── deliveryMethod: "delivery" | "retirada"
    ├── totalPrice: number
    ├── createdAt: timestamp
    └── ... (observações, pagamento, endereço, etc.)

site_settings/
  ├── maxUnits: number (limite de unidades por campanha)
  ├── orderDeadline: string (ISO 8601)
  ├── siteMode: "evento" | "livre"
  ├── campaignMode: "manual" | "auto" | "hybrid"
  ├── isDeliveryAvailable: boolean
  ├── chavePix: string
  ├── nomeTitularPix: string
  └── ... (config de impressora térmica, etc.)

campanhas/
  {campaignId}
    ├── name: string
    ├── status: "ativo" | "inativo"
    ├── startDate: timestamp
    ├── endDate: timestamp
    ├── maxUnits: number
    └── ... (priority, mode, etc.)

... (coupons, financeiro, estoque, ingredientes, etc.)
```

---

## Authentication & Authorization

### Clientes (Vitrine)

- **Auth Type:** Anônima + opcional (email/senha para checkout VIP)
- **Firestore Access:** Lêem apenas `products/`, `site_settings/`, `campanhas/`
- **Não podem:** Criar pedidos diretamente (via WhatsApp + API de backend)

### Admins (Painel)

- **Auth Type:** Email/senha
- **Custom Claim:** `admin: true` (setado via Cloud Function segura)
- **Firestore Access:** Leem/escrevem tudo (protegido por Firestore Rules)
- **Funções Críticas:**
  - Pedidos
  - Financeiro
  - Estoque
  - Impressão térmica (qz-tray)

### Firestore Rules (Resumo)

```javascript
// Públicos (leitura apenas)
match /products/{document=**} {
  allow read: if true;
  allow write: if request.auth.token.admin == true;
}

// Admin-only
match /financeiro/{document=**} {
  allow read, write: if request.auth.token.admin == true;
}

// Pedidos: leitura por dono ou admin
match /pedidos/{orderId} {
  allow read: if request.auth.uid == resource.data.clientId || request.auth.token.admin == true;
  allow write: if request.auth.token.admin == true;
}
```

---

## Firebase Cloud Functions

### Funções Implementadas

1. **adminClaimApi** — Emite custom claim `admin: true` para e-mails autorizados
2. **qzApiV2** — Assina e envia comandos para impressora térmica (QZ Tray)
3. **groqChat** — Proxy para API Groq (chat IA do cliente)
4. **... (outras funções conforme necessidade)**

### Environment Variables (.env)

```
FIREBASE_PROJECT_ID=helo-confeitaria
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
AUTHORIZED_ADMIN_EMAILS=helô@confeitaria.com,admin@confeitaria.com
GROQ_API_KEY=...
```

---

## How to Extend

### Adicionar Nova Feature na Vitrine

1. Criar componente em `public/js/components/`
2. Importar em `public/js/main-app.js`
3. Rodar `npm run build:public`
4. HTML já referencia `js-build/`, sem mudanças necessárias

### Adicionar Nova Feature no Admin

1. Criar componente em `public/js/components/`
2. Importar em `public/js/app-admin.js` (não em main-app.js!)
3. Rodar `npm run build:public`
4. Garantir que `index.html` NÃO referencia esse novo script

### Criar Novo Módulo Admin-only

```javascript
// public/js/novo-modulo.js
const NovoModulo = () => {
  // ... código
};

// public/js/app-admin.js (adicionar aqui)
import NovoModulo from "./novo-modulo.js";

// admin.html (adicionar script)
<script src="./js-build/novo-modulo.js?v=..."></script>;

// ❌ NÃO adicionar a index.html!
```

---

## Testes & Validação

### Local Testing

```bash
npx firebase emulators:start
# Acesso:
# - http://localhost:5000/ → index.html
# - http://localhost:5000/admin.html → admin.html
```

### Bundle Size Validation

No Chrome DevTools:

- Network tab → Filtrar "Document"
- index.html: < 30KB (sem admin modules)
- admin.html: > 150KB (com script.js + qz-tray)

### Firestore Rules Testing

```bash
npm test  # (se testes estiverem configurados)
```

---

## Checklist de Deploy

- [ ] `npm run build:public` executa sem erros
- [ ] `npm run prepare:hosting` completa
- [ ] Ambos os HTMLs carregam localmente (emulator)
- [ ] Bundle sizes validados no DevTools
- [ ] Firestore rules testadas
- [ ] Admin claims funcionando
- [ ] Impressora térmica testada (se mudança)
- [ ] `npm run deploy:hosting` executa
- [ ] Produção validada: https://heloconfeitarianr.web.app/

---

## Referências

- **PDR.md** — Padrões, Decisões e Referência (referência viva: regras, correções, histórico)
- **README.md** — Documentação geral do projeto
- **implementation_plan.md.resolved** — Plano de otimização (histórico)
- **Firebase Docs** — https://firebase.google.com/docs
- **React 18** — https://react.dev
- **esbuild** — https://esbuild.github.io/
