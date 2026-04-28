# Core Frontend - Modularização (Fases 1, 2, 3 e 4)

Este diretório inicia a modularização profissional do frontend com foco em **segurança de mudança** e **compatibilidade total**.

## Objetivo desta fase

- Separar utilitários puros em arquivos dedicados.
- Reduzir acoplamento do arquivo `public/js/app.js`.
- Manter o comportamento 100% compatível com produção atual.

## Arquivos das fases atuais

- `utils/text-date-utils.js`
  - Exporta utilitários em `window.HeloCoreUtils`.
  - Não depende de React nem Firebase.

- `campaign/campaign-utils.js`
  - Exporta utilitários de campanha em `window.HeloCampaignUtils`.
  - Consome utilitários base de `window.HeloCoreUtils` quando disponíveis.

- `config/app-config.js`
  - Exporta configurações e constantes em `window.HeloAppConfig`.
  - Serve como ponto central para parâmetros de negócio, catálogo e integrações.

- `../components/brand-logo.component.js`
  - Exporta o componente visual `BrandLogo` em `window.HeloComponents`.
  - Permite reaproveitamento no hero e no rodapé com fallback local no `script.js`.

- `../components/cabecalho.component.js`
  - Exporta o componente visual `Cabecalho` em `window.HeloComponents`.
  - Mantém comportamento do carrinho flutuante desacoplado do arquivo principal.

- `../components/rodape-site.component.js`
  - Exporta o componente visual `RodapeSite` em `window.HeloComponents`.
  - Inclui fallback interno para `BrandLogo` quando necessário.

- `../components/product-card.component.js`
  - Exporta o componente visual `ProductCard` em `window.HeloComponents`.
  - Recebe helpers por props para manter baixo acoplamento e fallback no `script.js`.

- `../components/vitrine-produtos.component.js`
  - Exporta o componente visual `VitrineProdutos` em `window.HeloComponents`.
  - Suporta injeção de helpers/componentes por props e fallback local no `script.js`.

## Estratégia de compatibilidade

1. Os módulos core são carregados antes de `app.js` em `public/index.html`.
2. `app.js` consome `window.HeloAppConfig`, `window.HeloCoreUtils` e `window.HeloCampaignUtils`.
3. `script.js` pode consumir componentes de `window.HeloComponents`.
4. Os arquivos consumidores mantêm fallback local para evitar quebra por cache ou ordem de carregamento.
5. Componentes JSX em `public/js/components/` não devem ser carregados diretamente no navegador.
6. Os componentes devem ser compilados para `public/js-build/components/` via `npm run build:public` e carregados compilados no `index.html`.

## Registro de ações executadas

1. Criado `public/js/core/utils/text-date-utils.js`.
2. Adicionado script no `index.html` antes de `app.js`.
3. Ajustado `app.js` para usar módulo externo com fallback.
4. Criado `public/js/core/campaign/campaign-utils.js`.
5. Adicionado script de campanha no `index.html` antes de `app.js`.
6. Ajustado `app.js` para usar utilitários de campanha com fallback local.
7. Criado `public/js/core/config/app-config.js`.
8. Adicionado script de config no `index.html` antes de `app.js`.
9. Ajustado `app.js` para usar configurações centralizadas com fallback local.
10. Criado `public/js/components/brand-logo.component.js`.
11. Adicionado script do componente no `index.html` antes de `app.js`.
12. Ajustado `script.js` para usar `window.HeloComponents.BrandLogo` com fallback local.
13. Criado `public/js/components/cabecalho.component.js`.
14. Criado `public/js/components/rodape-site.component.js`.
15. Adicionados scripts dos novos componentes no `index.html` antes de `app.js`.
16. Ajustado `script.js` para usar `window.HeloComponents.Cabecalho` e `window.HeloComponents.RodapeSite` com fallback local.
17. Criado `public/js/components/product-card.component.js`.
18. Adicionado script do `ProductCard` no `index.html` antes de `app.js`.
19. Ajustado `script.js` para usar `window.HeloComponents.ProductCard` com fallback local e injeção de helpers.
20. Criado `public/js/components/vitrine-produtos.component.js`.
21. Adicionado script da `VitrineProdutos` no `index.html` antes de `app.js`.
22. Ajustado `script.js` para usar `window.HeloComponents.VitrineProdutos` com fallback local e injeção de dependências.
23. Validado com `npm run build:public` (sem erros).
24. Corrigido `scripts/build-public-js.js` para compilar também `public/js/components/*.component.js` para `public/js-build/components/`.
25. Ajustado `public/index.html` para carregar componentes compilados em `public/js-build/components/` (evitando JSX bruto no browser).
26. Revalidado com `npm run build:public` (sem erros).

## Próxima fase sugerida (baixo risco)

- Extrair `ProdutoModal` para `public/js/components/` com fallback local.
- Manter fallback e validar a cada extração.
- Sempre executar `npm run build:public` após mudanças em `public/js/components/`.

## Fase 5 — Modularização SRP do script.js (God Object → Orquestrador)

Objetivo: esvaziar o `script.js` (8.500+ linhas) aplicando o Princípio da Responsabilidade Única.

### Arquivos criados nesta fase

- `utils/admin-utils.js`
  - Exporta utilitários e constantes em `window.HeloAdminUtils`.
  - Contém: normalização de texto, conversão de timestamps, constantes de operação,
    acessibilidade de formulários (IDs únicos + associação label↔campo),
    busca normalizada (termo + texto pesquisável), cache-bust de assets.
  - Funções com nomes novos (descritivos em português) + aliases retrocompatíveis
    com os nomes antigos em inglês (ex: `normalizarTexto` / `normalizeText`).

- `catalog.js`
  - Exporta constantes e funções do cardápio em `window.HeloCatalog`.
  - Contém: categorias de ingredientes, unidades de medida, abas de menu,
    resolução de aba do produto, identidade/deduplicação, score de completude,
    normalização de imagens do produto.
  - Depende de `window.HeloApp` (safeText, normalizeCampaignId, CAMPAIGN_LEGACY_ID)
    e `window.HeloAdminUtils` (normalizarTexto).

### Registro de ações executadas (Fase 5)

27. Criado `public/js/core/utils/admin-utils.js` com IIFE + `window.HeloAdminUtils`.
28. Adicionado script compilado no `index.html` após `app.js`.
29. Ajustado `script.js` para importar de `window.HeloAdminUtils` (removidas ~155 linhas de definições locais).
30. Removidas definições duplicadas de `normalizeSearchTerm` e `buildSearchableText` do `script.js`.
31. Ajustado `main-app.js` para acessar funções de acessibilidade via `window.HeloAdminUtils` dentro de `App()`.
32. Removido `getMillis` do import do `script.js` (não mais usado diretamente após migração).
33. Adicionado `core/utils/admin-utils.js` ao `scripts/build-public-js.js`.
34. Validado com `node scripts/build-public-js.js` (sem erros).
35. Criado `public/js/core/catalog.js` com IIFE + `window.HeloCatalog`.
36. Ajustado `script.js` para importar de `window.HeloCatalog` (removidas ~289 linhas de definições de catálogo).
37. Adicionado `core/catalog.js` ao `scripts/build-public-js.js` e `index.html`.
38. Validado com `node scripts/build-public-js.js` (sem erros). script.js: 527KB → 515KB.

### Próximos passos planejados (ordem de risco crescente)

- Passo 3: `core/feedback.js` — Componente FeedbackExperience
- Passo 4: `core/image-manager.js` — compressImage + ImageManager
- Passo 5: `core/printer-service.js` — ESC/POS + QZ Tray
- Passo 6: Remover fallbacks de componentes já extraídos
- Passo 7: `core/admin-panel.js` — AdminPanel + DriversTab (maior bloco, ~6.685 linhas)
- Passo 8: Limpar `script.js` final → orquestrador de ~50 linhas
