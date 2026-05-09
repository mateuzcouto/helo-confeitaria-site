# Auditoria Completa — Docs + Código

Data: 09/05/2026  
Escopo: workspace completo, com foco em `site-helo-final/site-helo-final`

## 1) Resultado executivo

- Documentação principal existe, mas havia pontos de ambiguidade entre arquivos canônicos.
- Foram aplicadas correções de alinhamento documental e de rastreabilidade.
- Foi removido um artefato compilado legado e ajustado o pipeline para não recompilar código não utilizado.
- Validações técnicas de build e estrutura HTML passaram.
- Segurança de dependências: raiz sem vulnerabilidades altas/críticas; `functions` com vulnerabilidades transitivas conhecidas (inclui 1 crítica) via cadeia `firebase-admin/firebase-functions`.

## 2) Fonte de verdade documental (definida)

- Produto (escopo de negócio): `../../PDR.md` (na raiz do workspace).
- Engenharia e decisões técnicas: `PDR.md` (dentro deste projeto).
- Operação técnica geral: `README.md`.
- Arquitetura: `ARCHITECTURE.md`.
- Setup rápido: `QUICK_START.md`.
- Backend/Functions: `functions/README.md`.

## 3) Ajustes aplicados nesta execução

### Documentação

1. Criado `../../README.md` na raiz do workspace para mapear projeto principal e documentos canônicos.
2. Ajustado `QUICK_START.md` (`cd site-helo-final/site-helo-final`) para bater com estrutura real.
3. Atualizado `README.md` do projeto com seção explícita de "Fonte de Verdade Documental".
4. Atualizado `../../PDR.md` com nota de escopo (produto) e ponte para PDR técnico do projeto.
5. Reescrito `functions/README.md` para refletir endpoints reais (`/api/qz/*`, `/api/admin/*`, `/api/groq/*`), variáveis e fluxo de conhecimento IA.
6. Atualizado `IMPLEMENTACAO_IA_ATENDIMENTO.md` para declarar `functions/BASE_CONHECIMENTO_IA_ATENDIMENTO.md` como fonte canônica de runtime.

### Código e pipeline

1. Removido `ui-shell.js` da lista de compilação em `scripts/build-public-js.js` (arquivo legado não referenciado por `index.html` ou `admin.html`).
2. Removido artefato legado compilado `public/js-build/ui-shell.js`.
3. Corrigido `scripts/validate-html-pages.js` para detectar `<script src>` mesmo com `defer/async` (antes subcontava scripts do `admin.html`).
4. Melhorado `functions/package.json`:
   - `lint`: de placeholder para verificação real de sintaxe (`node --check index.js`).

## 4) Classificação dos hotspots (necessidade x qualidade)

### Essencial

- `public/js/script.js` (AdminPanel completo): essencial para operação admin atual.
- `public/js/app-admin.js`: essencial para bootstrap/login admin e carga sob demanda de `script.js`.
- `functions/index.js`: essencial para APIs/claims/QZ/Groq.

### Candidato a refatoração (alta prioridade)

- `public/js/script.js` (~8.9k linhas): alto acoplamento e custo de manutenção.
- `functions/index.js` (~1.3k linhas): concentrado demais para superfície crítica de backend.
- Defaults repetidos de `chavePix` em `main-app.js`, `app-admin.js`, `script.js`.

### Candidato a remoção (baixo risco)

- `public/js/ui-shell.js` no build runtime (já removido da compilação).

### Legado controlado

- `scripts/fix-main-app.js`: sem uso na pipeline atual; manter somente se houver processo manual documentado, senão arquivar/remover em próxima limpeza.

## 5) Validações executadas e evidências

## Build + integridade de páginas

- `npm run build:public` -> OK.
- `node scripts/validate-html-pages.js` -> OK.
  - `index.html`: 13 scripts detectados.
  - `admin.html`: 15 scripts detectados.
  - todos existentes e sem scripts proibidos por contexto.

## Lint/sintaxe

- `functions/npm run lint` -> OK (`node --check index.js`).
- Frontend JSX é validado no build (esbuild), já que `node --check` não interpreta JSX puro.

## Segurança de dependências

- Raiz (`npm audit --omit=dev --audit-level=high`) -> 0 vulnerabilidades.
- `functions` (`npm audit --omit=dev --audit-level=high`) -> 13 vulnerabilidades totais, com destaque:
  - 1 crítica (`protobufjs` transitive),
  - 1 alta (`fast-xml-builder` transitive),
  - cadeia transitiva principal via ecossistema Firebase.

## 6) Backlog priorizado (próximos passos)

### Alta prioridade

1. Dividir `functions/index.js` por domínio (`qz`, `admin-claim`, `groq`, `email`) mantendo um `index.js` mínimo de export.
2. Extrair blocos de `public/js/script.js` restantes para módulos (`feedback`, `image-manager`, `printer-service`, `admin-panel-core`).
3. Centralizar fallback de `chavePix` em um único local de configuração para evitar drift.
4. Tratar vulnerabilidades transitivas de `functions` com estratégia controlada (atualização compatível de `firebase-admin/firebase-functions` + regressão em emulador e produção).

### Média prioridade

1. Definir política única para base de conhecimento IA (manter apenas a cópia canônica em `functions/` e automatizar sync da cópia de referência, se necessária).
2. Formalizar `CHANGELOG.md` para rastreabilidade de mudanças técnicas e operacionais.

### Baixa prioridade

1. Limpeza de artefatos auxiliares fora do runtime (`.kombai`, scripts experimentais) com política de arquivamento.

## 7) Conclusão

O projeto ficou mais alinhado entre documentação e implementação real, com melhoria objetiva na rastreabilidade e no pipeline de validação. O próximo ganho estrutural virá da redução de arquivos monolíticos (`script.js` e `functions/index.js`) e da mitigação das vulnerabilidades transitivas do backend.
