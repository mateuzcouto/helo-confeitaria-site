# PDR — Padrões, Decisões e Referência  
## Helô Confeitaria — Sistema de Pedidos e Gestão

> Este documento é a **referência viva** do projeto. Concentra todas as decisões técnicas, padrões de desenvolvimento, regras de negócio e histórico de correções. Mantenha-o atualizado a cada mudança relevante.  
> Para setup inicial, use o `QUICK_START.md`. Para detalhes de arquitetura técnica, use o `ARCHITECTURE.md`. Para features e configuração, use o `README.md`.

---

## 1. Visão do Produto

**Helô Confeitaria** é uma plataforma web mobile-first para confeitaria artesanal. Permite que clientes montem pedidos online (via WhatsApp) e que a equipe gerencie toda a operação em tempo real.

### Modos de Operação

| Modo | Quando usar | Comportamento |
|---|---|---|
| **Evento** | Campanhas sazonais (Páscoa, Natal etc.) | Limite de unidades, prazo de pedidos, escassez controlada |
| **Dia a Dia** | Operação contínua | Cardápio aberto, sem limitadores |

### Premissas Inegociáveis

- **~100% dos pedidos chegam via smartphone** (3G/4G). Performance mobile é prioridade máxima.
- **O cardápio muda diariamente.** Qualquer otimização de cache deve garantir que o cliente veja sempre o cardápio atual.
- **O catálogo nunca pode ficar desatualizado.** O Firebase Firestore mantém um `onSnapshot` ativo — alterações no painel admin refletem em segundos em todos os clientes abertos, independente de cache.

---

## 2. Arquitetura Dual-HTML (Segurança e Performance)

O projeto usa **duas páginas HTML completamente separadas**:

| Arquivo | Para quem | Entrypoint | Bundle |
|---|---|---|---|
| `index.html` | Cliente final | `main-app.js` | ~30-50 KB |
| `admin.html` | Staff/admin | `app-admin.js` | ~150-200 KB |

### O que cada página carrega

**`index.html` (Vitrine)** — carrega apenas:
- React 18 (CDN)
- Firebase (app, auth, firestore)
- `app.js`, `carrinho.js`, `admin-utils.js`, `catalog.js`, `core-globals.js`
- Componentes de vitrine: `brand-logo`, `cabecalho`, `rodape-site`, `product-card`, `vitrine-produtos`
- `cart-ui.js`, `main-app.js`
- `chat-widget.component.js` é carregado sob demanda em runtime (lazy) somente quando `site_settings.aiEnabled === true`.

**`admin.html` (Painel)** — carrega adicionalmente:
- `crm.js`, `financeiro.js`, `estoque.js`, `script.js` (AdminPanel ~542 KB)
- `app-admin.js` (entrypoint)
- QZ Tray (impressora térmica ~100 KB)
- **Não carrega:** product-card, vitrine-produtos, chat-widget, cart-ui, main-app

### Regra Crítica de Isolamento

> ❌ **Nunca adicionar scripts de admin em `index.html`.**  
> ❌ **Nunca adicionar scripts de vitrine em `admin.html`.**  
> O código administrativo jamais deve ser exposto no navegador do cliente.

---

## 3. Namespace Conflict — Regra Crítica

### Problema

O `admin.html` carrega `core-globals.js` (que expõe variáveis via `var` no escopo global) e depois `script.js`. Quando `script.js` usava `const` para declarar identificadores já existentes no escopo global, o motor JavaScript lançava:

```
Uncaught SyntaxError: Identifier 'X' has already been declared
```

Isso quebrava **toda a cadeia de dependências** (`window.HeloApp` nunca era definido → `carrinho.js`, `admin-utils.js`, `catalog.js`, `main-app.js` todos falhavam em cascata).

### Solução (08/05/2026)

As declarações conflitantes em `script.js` foram convertidas de `const` para `var`.

### Regra de Prevenção

> **Ao adicionar qualquer novo componente ou constante em `script.js`:** use `var` (não `const` nem `let`) para identificadores que também existam em `core-globals.js` ou em qualquer script carregado antes de `script.js` no `admin.html`.

---

## 4. Inicialização do Firestore — Ordem Obrigatória

### Regra

`db.settings()` **DEVE** ser chamado antes de qualquer outra operação no objeto `db` (incluindo `enablePersistence`). Chamar depois lança:

```
FirebaseError: Firestore has already been started and its settings can no longer be changed.
```

### Ordem correta em `app.js`

```javascript
const db = firebase.firestore();

// 1. settings() PRIMEIRO — antes de qualquer outra operação
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });

// 2. enablePersistence() depois
db.enablePersistence({ synchronizeTabs: true }).catch(err => { ... });
```

---

## 5. Performance Ultra-Mobile (3G/4G)

### Por que é crítico

~100% dos pedidos são feitos via smartphone. Uma rede 3G com alta latência pode levar >8s para estabelecer a conexão inicial com o Firestore.

### Estratégias implementadas

#### 5.1 Skeleton Screen — `index.html`

HTML/CSS inline no `<div id="root">` que aparece **instantaneamente** (< 200ms) antes do React carregar, eliminando flash de tela branca.

- O skeleton usa apenas `<div>` com gradiente — **sem `<img>`** (evita 404 caso a imagem não exista).
- Substituído automaticamente quando o React monta.

#### 5.2 Priorização de Recursos — `index.html`

```html
<!-- Preconnect: negocia SSL antes do JS pedir -->
<link rel="preconnect" href="https://firestore.googleapis.com" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

<!-- Preload: focado em CSS crítico -->
<link rel="preload" href="./css/style.css" as="style" />
```

#### 5.3 Lazy Loading de Imagens — `product-card.component.js`

```jsx
<img loading="lazy" decoding="async" src={produto.image} />
```

- `loading="lazy"`: imagens abaixo da dobra só baixam quando o usuário faz scroll.
- `decoding="async"`: decodificação em background sem travar o scroll.

#### 5.4 Content-Visibility — `style.css`

```css
.card-neon-hover {
    content-visibility: auto;
    contain-intrinsic-size: 0 420px;
}
```

O browser não renderiza cards fora da tela — economiza CPU e bateria do celular.

#### 5.5 Persistência Offline (IndexedDB) — `app.js`

```javascript
db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED, merge: true });
db.enablePersistence({ synchronizeTabs: true });
```

- 1ª visita: dados baixam da rede e salvos localmente.
- 2ª visita: catálogo carrega do cache (< 500ms).
- **O `onSnapshot` continua ativo** — se o cardápio mudar, a tela atualiza em segundos.
- `CACHE_SIZE_UNLIMITED`: nunca expulsa dados do cache.
- `synchronizeTabs: true`: múltiplas abas compartilham o cache sem conflito.

#### 5.6 Transporte Inteligente — `app.js`

Firebase usa WebSockets/gRPC por padrão (mais eficientes em 3G/4G). O `experimentalForceLongPolling` foi **removido** — forçar long-polling era mais lento em redes móveis modernas.

#### 5.7 Timeouts Tolerantes para 3G — `main-app.js`

| Timeout | Valor | Motivo |
|---|---|---|
| Aviso progressivo de conexão lenta | **6s** | Transparência de UX em rede instável |
| Fallback `get()` se `onSnapshot` não disparar | **8s** | Evita espera longa sem resposta |
| Segurança (remove skeleton se tudo falhar) | **15s** | Evita loading infinito em falha severa |

#### 5.9 Horário Dia a Dia (comunicação operacional)

- Exibição oficial no site: **Quarta a domingo — 14:30hrs às 20hrs**.
- Pontos de exibição/fallback: `main-app.js`, `cart-ui.js` e fallback em `script.js`.

#### 5.8 Font Display Swap — `style.css`

Google Fonts carregados com `display=swap`. O texto é exibido com fonte do sistema enquanto as fontes premium baixam — sem FOIT (Flash of Invisible Text).

### Resultado esperado

| Métrica | Rede | Meta |
|---|---|---|
| FCP (First Contentful Paint) | 3G | < 200ms (skeleton) |
| LCP (Largest Contentful Paint) | 4G | < 1.2s |
| TTI (Time to Interactive) | 4G | < 2s |
| Reload em visita recorrente | qualquer | < 500ms (IndexedDB) |
| Catálogo desatualizado | — | **Impossível** (onSnapshot ativo) |

---

## 6. Build System

### Fluxo

```
public/js/          ← Editar AQUI (código-fonte JSX)
  ↓ npm run build:public  (esbuild)
public/js-build/    ← Gerado automaticamente (NÃO editar)
  ↓
index.html + admin.html referenciam js-build/
  ↓ Firebase Hosting
Navegador (React renderiza)
```

### Regra de Edição

- **Sempre editar** em `public/js/`
- **Nunca editar** `public/js-build/` (regenerado e sobrescrito pelo build)
- **Após qualquer alteração** em `public/js/`, rodar: `npm run build:public`

### Scripts NPM

```bash
npm run build:public      # Transpila JSX → JS (desenvolvimento)
npm run prepare:hosting   # Build + versioning + strip-BOM (pré-deploy)
npm run deploy:hosting    # Deploy para produção (Firebase Hosting)
```

---

## 7. Padrão de Namespaces Globais (IIFE + window)

Scripts carregados via `<script>` expõem APIs em objetos globais:

| Global | Arquivo fonte | Conteúdo |
|---|---|---|
| `window.HeloAppConfig` | `core/config/app-config.js` | Configuração Firebase |
| `window.HeloCoreUtils` | `core/utils/text-date-utils.js` | Funções de texto e datas |
| `window.HeloCampaignUtils` | `core/campaign/campaign-utils.js` | Lógica de campanhas |
| `window.HeloAdminUtils` | `core/utils/admin-utils.js` | Normalização, busca, IDs |
| `window.HeloCatalog` | `core/catalog.js` | Categorias, abas, deduplicação |
| `window.HeloApp` | `app.js` | Firebase, auth, db, helpers |
| `window.HeloCart` | `carrinho.js` | Hooks do carrinho |
| `window.HeloCrm` | `crm.js` | CRM (admin only) |
| `window.HeloFinance` | `financeiro.js` | Financeiro (admin only) |
| `window.HeloInventory` | `estoque.js` | Estoque (admin only) |
| `window.HeloComponents` | `components/*.component.js` | Componentes React |

---

## 8. Navegação do Painel Admin (Contrato de UI)

- **Navbar primária (topo):** apenas módulos de alto nível (`Operação`, `Catálogo`, `Clientes`, `Produção`, `Sistema`).
- **Tabs secundárias:** seções internas do módulo ativo — não são botões de ação avulsos.
- Novas configurações globais devem entrar em **`Sistema > Configurações`** (tab `settings`).
- Estrutura das tabs definida em `public/js/script.js` → `NAV_GROUPS`.

---

## 9. Regras de Documentação

> **Mudança sem documentação não está concluída.**

1. **No código:** comentário curto no ponto da implementação quando a decisão não for óbvia.
2. **Neste PDR:** registrar decisões técnicas, regras, bugs corrigidos e padrões.
3. **No README:** atualizar a seção de features correspondente.
4. **No ARCHITECTURE.md:** atualizar se houver mudança estrutural de alto nível.

---

## 10. Histórico de Decisões e Correções

| Data | O que | Impacto |
|---|---|---|
| 08/05/2026 | Dual-HTML Architecture — separação index.html / admin.html | -690 KB no bundle do cliente; isolamento de segurança |
| 08/05/2026 | Namespace Conflict fix — `const` → `var` em `script.js` | Correção de SyntaxError que quebrava todo o admin |
| 08/05/2026 | Firestore `db.settings()` antes de `enablePersistence()` | Correção de FirebaseError que quebrava `window.HeloApp` em cascata |
| 08/05/2026 | Skeleton Screen no `index.html` | FCP < 200ms — zero tela branca |
| 08/05/2026 | Preloads CSS + React, Preconnect Firebase/Fonts | LCP < 1.2s |
| 08/05/2026 | `loading="lazy"` + `decoding="async"` no ProductCard | Scroll fluido; economia de dados em 3G |
| 08/05/2026 | `content-visibility: auto` nos cards — `style.css` | Economia de CPU e bateria no celular |
| 08/05/2026 | Persistência offline IndexedDB + cache ilimitado | 2ª visita < 500ms |
| 08/05/2026 | Remoção do `experimentalForceLongPolling` | Conexão mais rápida em 4G/3G |
| 09/05/2026 | Timeouts 3G: hint 6s, fallback 8s, timeout 15s | UX de rede lenta mais clara e sem loading infinito |
| 09/05/2026 | Chat IA lazy por `aiEnabled` + gate backend no `groqChat` | Redução de custo e payload quando IA desativada |
| 09/05/2026 | Horário do Dia a Dia atualizado para 14:30–20:00 | Comunicação operacional alinhada no site |
| 08/05/2026 | Deploy versão 20260508-235530 em produção | Vitrine e admin online com dual-HTML architecture |

---

## 11. Checklist de Deploy

- [x] `npm run build:public` sem erros
- [x] `npm run prepare:hosting` completa
- [x] Vitrine sem erros no DevTools Console (`http://localhost:5000/`)
- [x] Admin sem erros no DevTools Console (`http://localhost:5000/admin.html`)
- [x] Nenhum script de admin em `index.html`
- [x] Nenhum script de vitrine em `admin.html`
- [x] `npm run deploy:hosting` executa
- [x] Validação em produção: https://heloconfeitarianr.web.app/
