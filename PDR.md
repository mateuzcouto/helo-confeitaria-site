# PDR — Padrões, Decisões e Referência

## Helô Confeitaria — Sistema de Pedidos e Gestão

> Este documento é a **referência viva** do projeto. Concentra todas as decisões técnicas, padrões de desenvolvimento, regras de negócio e histórico de correções. Mantenha-o atualizado a cada mudança relevante.  
> Para setup inicial, use o `QUICK_START.md`. Para detalhes de arquitetura técnica, use o `ARCHITECTURE.md`. Para features e configuração, use o `README.md`.

---

## 1. Visão do Produto

**Helô Confeitaria** é uma plataforma web mobile-first para confeitaria artesanal. Permite que clientes montem pedidos online (via WhatsApp) e que a equipe gerencie toda a operação em tempo real.

### Modos de Operação

| Modo | Quando usar | Comportamento |
| --- | --- | --- |
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
| --- | --- | --- | --- |
| `index.html` | Cliente final | `main-app.js` | ~30-50 KB |
| `admin.html` | Staff/admin | `app-admin.js` | ~150-200 KB |

### O que cada página carrega

**`index.html` (Vitrine)** — ordem real em `public/index.html` / `js-build/`:

- React 18 e Firebase (auth, firestore) — na vitrine, React vem de `./vendor/` (self-hosted).
- `core/config/app-config.js` → `core/utils/text-date-utils.js` → `core/constants/contatos-loja-publica.js`.
- Componentes: `brand-logo`, `cabecalho`, `rodape-site`, `product-card`, `vitrine-produtos`, `store-closed-vitrina`.
- `app.js` → `carrinho.js` → `core/utils/admin-utils.js` → `core/catalog.js` → `core-globals.js` → `cart-ui.js` → `main-app.js`.
- `chat-widget.component.js` continua **lazy** em runtime quando `site_settings.aiEnabled === true`.
- Phosphor: CSS self-hosted em `./vendor/phosphor/` (variantes usadas).

**`admin.html` (Painel)** — ordem real em `public/admin.html` / `js-build/`:

- React (unpkg) + Phosphor web + Firebase; folha extra [`public/css/admin-settings.css`](public/css/admin-settings.css).
- `app-config` → `text-date-utils` → `contatos-loja-publica` → `campaign-utils`.
- Componentes compartilhados para **pré-visualização** e rodapé: `brand-logo`, `cabecalho`, `rodape-site`, `store-closed-vitrina`, `admin/admin-toggle-pill`, `admin/admin-settings-card`.
- `app.js` → `carrinho.js` → `crm.js` → `financeiro.js` → `estoque.js` → `admin-utils` → `catalog.js` → `core-globals.js` → `app-admin.js`.
- `script.js` (AdminPanel pesado) é carregado **sob demanda** após fluxo de login/feedback (lazy), não como `<script>` fixo no HTML.
- QZ Tray também é carregado sob demanda na primeira impressão/diagnóstico.
- **Não carrega** para o cliente final: `product-card`, `vitrine-produtos`, `cart-ui`, `main-app`, `chat-widget` (estes ficam só na vitrine).

### Regra Crítica de Isolamento

> ❌ **Nunca adicionar `script.js`, CRM, financeiro, estoque ou QZ em `index.html`.**  
> ❌ **Nunca adicionar `main-app.js`, `cart-ui.js` ou vitrine completa de produtos em `admin.html`.**  
> O painel admin pode carregar um **subconjunto mínimo** de componentes de vitrine (`rodape-site`, `store-closed-vitrina`, contatos) apenas para **espelhar pré-visualização** e manter uma única fonte de verdade de contatos — isso não substitui as regras acima.

---

## 3. Namespace Conflict — Regra Crítica

### Problema

O `admin.html` carrega `core-globals.js` (que expõe variáveis via `var` no escopo global) e depois `script.js`. Quando `script.js` usava `const` para declarar identificadores já existentes no escopo global, o motor JavaScript lançava:

```text
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

```text
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

#### 5.5.1 `site_settings`: cache local vs servidor — `main-app.js` / `app-admin.js`

- O documento `site_settings` usa `onSnapshot` com `includeMetadataChanges: true` para detectar leituras servidas do cache local.
- O payload recebido passa por sanitização (ex.: texto de marketing / mojibake) antes de atualizar o estado React.
- Em retorno de rede (`pageshow` **persisted**, `visibilitychange` para visível, listener `online`), a vitrine faz `get({ source: 'server' })` no meta doc para **reconciliar** com o servidor. No admin, o mesmo refresh é **gated** por `isAdmin` para não disparar leituras sensíveis antes do login.
- Objetivo: após edição noutro dispositivo ou reabertura rápida da aba, o cliente não fica preso a um snapshot antigo do IndexedDB sem tentativa explícita de alinhar ao backend.

#### 5.6 Transporte Inteligente — `app.js`

Firebase usa WebSockets/gRPC por padrão (mais eficientes em 3G/4G). O `experimentalForceLongPolling` foi **removido** — forçar long-polling era mais lento em redes móveis modernas.

#### 5.7 Timeouts Tolerantes para 3G — `main-app.js`

| Timeout | Valor | Motivo |
| --- | --- | --- |
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
| --- | --- | --- |
| FCP (First Contentful Paint) | 3G | < 200ms (skeleton) |
| LCP (Largest Contentful Paint) | 4G | < 1.2s |
| TTI (Time to Interactive) | 4G | < 2s |
| Reload em visita recorrente | qualquer | < 500ms (IndexedDB) |
| Catálogo desatualizado | — | **Impossível** (onSnapshot ativo) |

---

## 6. Build System

### Fluxo

```text
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
| --- | --- | --- |
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
| `window.HeloComponents` | `components/*.component.js` | Componentes React (vitrine + utilitários registrados em `HeloComponents.*`) |
| `window.HeloPublicContact` | `core/constants/contatos-loja-publica.js` | WhatsApp, redes e helpers (`montarHrefWhatsAppLojaPublica`, lista de ícones do rodapé) — **fonte única** vitrine + pré-visualização admin |
| `window.HeloAdminUi` | `components/admin/admin-toggle-pill.component.js`, `components/admin/admin-settings-card.component.js` | `AdminTogglePill`, `AdminSettingsCard` (UI reutilizável em `script.js`) |

**Build:** entradas correspondentes em [`scripts/build-public-js.js`](scripts/build-public-js.js) (`filesToCompile`).

---

## 8. Navegação do Painel Admin (Contrato de UI)

- **Navbar primária (topo):** apenas módulos de alto nível (`Operação`, `Catálogo`, `Clientes`, `Produção`, `Sistema`).
- **Tabs secundárias:** seções internas do módulo ativo — não são botões de ação avulsos.
- Novas configurações globais devem entrar em **`Sistema > Configurações`** (tab `settings`).
- Opções de **pagamento e PIX** (chave, titular, toggle InfinitePay) ficam em **`Sistema > Pagamentos`** (tab `payments`), persistindo no mesmo documento `site_settings`.
- **Pré-visualização pública** em **Sistema → Configurações**: espelha o estado “loja fechada” (`VitrineStoreClosed` / `store-closed-vitrina.component.js`) com link para abrir a vitrine aberta numa nova aba; contatos e redes vêm de `HeloPublicContact` (não duplicar URLs no `script.js`).
- Estrutura das tabs definida em `public/js/script.js` → `NAV_GROUPS`.

---

## 9. Regras de Documentação

> **Mudança sem documentação não está concluída.**

1. **No código:** comentário curto no ponto da implementação quando a decisão não for óbvia.
2. **Neste PDR:** registrar decisões técnicas, regras, bugs corrigidos e padrões.
3. **No README:** atualizar a seção de features correspondente.
4. **No ARCHITECTURE.md:** atualizar se houver mudança estrutural de alto nível.

### 9.1. Padrão de comentário por função

- Função **nova ou refatorada** → JSDoc formal (`@param`, `@returns` e nota de comportamento).
- Função **antiga já comentada em PT acima da assinatura** → manter como está (a informação útil já existe).
- Edição em função existente → atualizar o JSDoc com `@update YYYY-MM-DD — resumo`.
- Estado atual da cobertura: `public/js/core/`, `public/js/components/`, `scripts/` e handlers/triggers de `functions/index.js` cobertos. Detalhes em `AUDITORIA_DOCS_CODIGO_2026-05-09.md` §8.

### 9.2. Plano de otimização de RAM do admin

O documento `c:\Users\SAC\.cursor\plans\otimização_ram_admin_e5575e87.plan.md`
lista a fila priorizada de tarefas para reduzir uso de memória/CPU no painel
admin em notebooks antigos. Itens classificados como **Prioridade alta**:

1. Virtualizar a tabela de "Fluxo de Pedidos" (`react-window` ou similar).
2. Cortar `onSnapshot` da operação quando a aba não está visível.
3. Acoplar `limit(N)` aos snapshots de `orders` / `products`.
4. Lazy-load de `qz-tray.js` e ícones Phosphor (já parcialmente feito).
5. Reduzir escopo do `MutationObserver` global e adicionar debounce.

Esses itens DEVEM ser tratados antes de adicionar features pesadas novas no
admin. O backlog é considerado parte do contrato de manutenção.

---

## 10. Histórico de Decisões e Correções

| Data | O que | Impacto |
| --- | --- | --- |
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
| 09/05/2026 | Documentação inline (Fase 2) — JSDoc em `core/`, `scripts/`, `functions/index.js` | Cobertura completa nas áreas críticas; build idempotente (mesmos bytes) |
| 09/05/2026 | `scripts/fix-main-app.js` marcado como DEPRECATED com `process.exit(0)` | Evita re-injeção duplicada do wrapper de globals |
| 09/05/2026 | PDR §9.2 — backlog de RAM do admin oficializado | Plano de virtualização e cortes de listener entra no contrato |
| 11/05/2026 | Entrega obrigatória: rua, bairro e **ponto de referência** na modalidade entrega (`saveAndSend` + labels no drawer) | Menos pedidos sem referência para localização |
| 11/05/2026 | Disciplina global de release: README + PDR + comentários/JSDoc obrigatórios junto ao deploy; checklist §11 expandido | Documentação alinhada a produção em todo ciclo |
| 14/05/2026 | PIX InfinitePay: `criarCheckoutPix` + `confirmarPagamentoPix`, página `confirmacao.html`, status `AguardandoPagamento` → `Pago` via Make webhook | Checkout sem expor secrets; operação vê PIX pendente em `STATUS_ATIVOS_OPERACAO` |
| 14/05/2026 | Gate **`site_settings.infinityPayEnabled`** (admin **Sistema → Pagamentos**): default `false` mantém PIX legado (chave + WhatsApp); só com `true` o cliente usa checkout InfinitePay | Vendas estáveis em produção enquanto Make/API são validados; vitrine: `main-app.js` (`usarInfinitePix`) |
| 14/05/2026 | Modal pós-pedido (fluxo WhatsApp): identidade visual Helô no overlay de sucesso (`main-app.js` + classes `.helo-modal-sucesso-*` em `style.css`); logo com `.helo-modal-sucesso-logo-wrap` para largura mínima estável | UX coerente com a marca; corrige logo minúscula quando o pai flex não tinha largura |
| 14/05/2026 | Deploy hosting produção (`heloconfeitarianr.web.app`) com bundles atualizados | Predeploy `prepare:hosting` mantém `js-build/` e query `?v=` alinhados |
| 14/05/2026 | Documentação: clientes inativos (**Clientes → Inativos**, >30 dias; relatório HTML) no README e PDR §10.2 | Operação encontra regra e navegação sem ler o código |
| 14/05/2026 | **n8n WhatsApp:** flag `site_settings.n8nWhatsAppAutomationsEnabled` (admin **Sistema → Configurações**); Functions `dispatchN8nWebhookOnOrderCreated/Updated`, cron `cronDispatchN8nFeedbackReminder`, `confirmFeedbackInviteFromN8n`; helper `functions/n8nWhatsAppIntegration.js`; índice Firestore `orders` status+concluidoEm | Automação opcional com cutoff manual; modo desligado preserva vendas sem VPS |
| 15/05/2026 | **n8n — operação e observabilidade:** admin com aviso quando o toggle difere do valor salvo + botão dedicado de salvar; leitura da flag no cliente alinhada ao backend (`true` \| `"true"`). Documentação README/PDR: URL Production no `.env`, workflow **ativo**, logs `[n8n]` no GCP, arquivo de workflow em `docs/n8n-workflow-helo-firebase.json` | Menos divergência “liguei e não foi”; handoff claro para VPS e suporte |
| 16/05/2026 | **InfinitePay (alinhado ao suporte):** API de Checkout identifica o estabelecimento pela **Tag** (`INFINITEPAY_HANDLE`); Bearer (`INFINITEPAY_API_TOKEN`) **opcional** em `criarCheckoutPix`; não há sandbox — teste ponta a ponta só com **transação real** (valor mínimo). Referência: app.infinitepay.io → Checkout → Documentação; [Central de Ajuda — checkout](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-da-infinitepay) | Evita bloquear deploy por token ausente quando a conta só usa Tag no corpo da requisição |
| 16/05/2026 | **InfinitePay deploy:** `defineString` + `readStringParamOrEnv` em Functions; `functions/.env.<projectId>` no deploy; vitrine: porta **5000** (emulador Hosting) usa `/api/pix/checkout`; `index.html` manifest com caminho relativo (Live Server) | Elimina 503 por `.env` só local; menos 404 no manifest em dev |
| 16/05/2026 | **Operação PIX:** scripts `functions/scripts/sync-deploy-env.js`, `smoke-pix-endpoints.js`; npm `env:sync-deploy`, `smoke:pix`; raiz `deploy:functions`, `functions:smoke:pix` | Deploy e smoke test repetíveis sem adivinhar passos |
| 16/05/2026 | **`functions/package.json` — override `asynckit` removido:** o pin a `0.5.0` não alterava a instalação efetiva (`npm ls asynckit` sem entradas) e era destacado por análise estática (Meterian / CWE-1104). Overrides remanescentes: `uuid`, `retry-request`, `yargs` | Manifest alinhado à árvore real; política: não declarar override para pacote transitivo ausente; se `asynckit` reaparecer, corrigir na dependência que o introduz |
| 18/05/2026 | **Pós-evento (vitrine + admin):** módulo único `HeloPublicContact`; helpers de texto UTF-8 / sanitização de `announcementText` em `text-date-utils.js`; `site_settings` com metadata + `get({ source: 'server' })` na reconexão (§5.5.1); componentes `HeloAdminUi` + `store-closed-vitrina` para cartões configuráveis e pré-visualização em **Sistema → Configurações**; `admin-settings.css`; entradas novas em `build-public-js.js` | Menos divergência de contatos e cache; UX admin alinhada à vitrine sem expor `main-app` no painel |
| 18/05/2026 | **Cache WebView (Instagram):** `deploy-version.json` + bootstrap inline em `index.html` / `confirmacao.html`; headers `no-cache` para JSON/manifest; `stamp-version.js` alinha `VERSAO_ASSETS_ESTATICOS` | Cliente vê deploy novo sem refresh manual no in-app browser da Meta |

### 10.1 PIX — modo legado × InfinitePay

| Condição | Comportamento na vitrine | Firestore / observações |
| --- | --- | --- |
| `infinityPayEnabled !== true` (campo ausente ou `false`) | PIX: chave e cópia no carrinho; após salvar, WhatsApp + modal de sucesso temático | Pedido segue regra atual do `saveAndSend` para PIX legado (sem checkout InfinitePay). |
| `infinityPayEnabled === true` | PIX: cria checkout, redireciona cliente; retorno em `confirmacao.html?nsu=…` | Status `AguardandoPagamento` até `confirmarPagamentoPix`; depende de Functions + Make mapeados. |

Persistência: `getMetaDoc('site_settings').set({ … }, { merge: true })` inclui `infinityPayEnabled` (boolean). Estado inicial no admin e na vitrine: `false` até o admin gravar `true`.

### 10.2 Clientes inativos (reativação)

- **Onde:** painel admin → navbar **Clientes** → tab secundária **Inativos** (`tab === 'inativos'` em `public/js/script.js`).
- **Critério:** último pedido do cliente (por telefone normalizado) com data **`createdAt` há mais de 30 dias corridos** — não é calendário “mês cheio”, mas corresponde ao pedido de negócio “~1 mês sem recompra”.
- **UI:** cards com dias sem comprar, data da última compra, cores por urgência (ex. 30–59 dias), link **Chamar no WhatsApp**; botão para **exportar relatório HTML** quando há inativos (`ClientesInativosAlerta`, `useClientesInativos(allOrders, 30)`).

### 10.3 WhatsApp opcional via n8n (VPS)

- **Onde:** admin **Sistema → Configurações** — seção **Mensagens WhatsApp automáticas (n8n)**. Persistência exige **Salvar automação n8n no Firebase** ou **Salvar Configurações** (fim da página); o resumo “Estado salvo no Firebase” / linha **WhatsApp automático (n8n)** no bloco de status deve refletir **ligado** após gravar.
- **Firestore:** `artifacts/.../meta/site_settings` campo `n8nWhatsAppAutomationsEnabled`. O backend aceita **boolean `true` ou string `"true"`** (console manual). **URLs e segredos não ficam no Firestore** — apenas a flag (`site_settings` é legível por usuários autenticados).
- **Backend:** `functions/n8nWhatsAppIntegration.js` + triggers em `functions/index.js`. Env: `N8N_ORDER_EVENTS_URL` (URL **Production** copiada do nó Webhook no n8n), `N8N_WEBHOOK_SECRET` (header `Authorization: Bearer` nos POSTs Firebase → n8n), `N8N_CALLBACK_BEARER_TOKEN` opcional, `HELO_PUBLIC_SITE_URL` para montar `feedbackUrl`.
- **Comportamento:** flag off ou `N8N_ORDER_EVENTS_URL` / `N8N_WEBHOOK_SECRET` ausentes → logs `[n8n]` explicam e **nenhum** `fetch` externo; vendas e WhatsApp manual intactos.
- **Gatilhos:** `onCreate` em `orders` → evento `novo_pedido` (pedidos antigos não “re-disparam” criação). `onUpdate` com mudança de status → `pedido_confirmado_cliente` (→ **Confirmado**), `pedido_pronto_cliente` (→ **Pronto**). Marcação idempotente só após HTTP **2xx** em `integrations.n8n.*`.
- **Cron feedback:** ~09:05 `America/Fortaleza`; pedidos **Concluídos** na janela temporal; evento `feedback_convite`.
- **Observabilidade:** Google Cloud Logging — nas functions `dispatchN8nWebhookOnOrderCreated` / `…Updated` / cron, filtrar texto **`[n8n]`**. A linha **`Enviando webhook`** indica que passou flag, credenciais e idempotência; erros de rede ou status HTTP ficam no mesmo fluxo de log.
- **n8n (VPS):** workflow publicado e **Active**; URL do `.env` = Production do Webhook; validação do Bearer no fluxo (nó Code/IF conforme [`docs/n8n-workflow-helo-firebase.json`](docs/n8n-workflow-helo-firebase.json)). Se o Webhook estiver configurado para responder via nó **Respond to Webhook**, esse nó deve existir no caminho de execução — caso contrário o `fetch` do backend pode expirar aguardando resposta.
- **Deploy:** após alterar `.env` das functions, `firebase deploy --only functions`; após alterar admin JSX, `npm run prepare:hosting` + deploy hosting (predeploy já roda o prepare).

### 10.4 Melhorias pós-evento (vitrina, textos e `site_settings`)

- **Contatos únicos:** `public/js/core/constants/contatos-loja-publica.js` define `window.HeloPublicContact`. Rodapé (`rodape-site.component.js`), estado loja fechada (`store-closed-vitrina.component.js`) e fallback no admin (`script.js`) leem apenas esse objeto — alterar números/URLs num único ficheiro.
- **UTF-8 / marketing:** `text-date-utils.js` expõe correção sanitização de texto vindo do Firestore (evita “mojibake” típico em `announcementText` e campos parecidos).
- **Reconcile `site_settings`:** além do `onSnapshot` com `includeMetadataChanges`, há `get({ source: 'server' })` em eventos de rede relevantes (vitrine: sempre que aplicável; admin: apenas com sessão admin) — ver §5.5.1.
- **Pré-visualização no admin:** `AdminSettingsCard` + `AdminTogglePill` (`window.HeloAdminUi`) e CSS `admin-settings.css`; pré-visualização reutiliza `VitrineStoreClosed` como na vitrine.
- **Invariante de deploy:** qualquer edição em `public/js/**/*.js` exige `npm run build:public` ou `npm run prepare:hosting` antes de validar Hosting — bundles servidos são `public/js-build/`.

## 11. Checklist de Deploy

### 11.1 Documentação (obrigatória antes ou junto com o deploy)

- [ ] `README.md` atualizado com mudanças visíveis ao time / operação.
- [ ] `PDR.md` atualizado se houver decisão técnica ou entrada nova no §10 / §10.1 / §10.2 / §10.3 / **§10.4** / §5.5.1 (histórico, PIX, clientes inativos, n8n, pós-evento, `site_settings`).
- [ ] Comentários / JSDoc no código nos pontos alterados (regra de negócio ou função pública).
- [ ] Se houver alteração em `functions/package.json` (dependências ou `overrides`): `cd functions && npm install` e conferir scanner de supply chain / `npm audit` conforme processo do repositório.

### 11.2 Build e hospedagem

- [ ] `npm run build:public` sem erros (ou confiar no predeploy do Firebase que roda `prepare:hosting`).
- [ ] `npm run prepare:hosting` completa quando rodada manualmente.
- [ ] Vitrine sem erros no DevTools Console (`http://localhost:5000/` ou produção).
- [ ] Admin sem erros no DevTools Console (`http://localhost:5000/admin.html` ou produção).
- [ ] Nenhum script de admin em `index.html`.
- [ ] Subconjunto de vitrine em `admin.html` limitado ao que está no HTML (rodapé, loja fechada, contatos + UI admin): **sem** `main-app.js`, **sem** `cart-ui.js`, **sem** grid de produtos.
- [ ] `firebase deploy --only hosting` (ou `npm run deploy:hosting`) executa com sucesso — predeploy aplica build + stamp de versão nos HTML.
- [ ] Validação em produção: <https://heloconfeitarianr.web.app/>

### 11.3 Comando canônico

```bash
firebase deploy --only hosting
```

Projeto: `helo-confeitaria`. Hosting site id: `heloconfeitarianr`.
