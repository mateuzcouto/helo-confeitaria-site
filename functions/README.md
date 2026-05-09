# Firebase Functions — Helô Confeitaria

Este diretório contém as Cloud Functions do projeto, incluindo APIs de segurança para QZ Tray, sincronização de claim de admin, proxy de IA (Groq) e trigger de notificação por e-mail.

## Endpoints HTTP expostos via Hosting rewrites

### Segurança QZ Tray

- `GET /api/qz/certificate` — retorna o certificado público para handshake do QZ.
- `POST /api/qz/sign` — assina o payload de impressão no backend.

### Administração

- `POST /api/admin/claim/sync` — valida token autenticado e aplica claim `admin` para e-mails autorizados em `ADMIN_ALLOWED_EMAILS`.

### Assistente de IA

- `POST /api/groq/chat` — endpoint público via rewrite para a function `groqChat`.
- Produção: o front chama `/api/groq/chat` no mesmo domínio.
- Localhost: o front pode chamar a URL direta da function conforme implementação do widget.
- Segurança/custo: quando `site_settings.aiEnabled !== true`, o endpoint retorna `403` (`code: ai_disabled`).
- A leitura de `aiEnabled` usa cache curto em memória no backend para reduzir overhead por requisição.

## Trigger Firestore

- `sendOrderNotificationEmail` — dispara ao criar pedido em `orders` e envia notificação EmailJS pelo backend.

## Base de conhecimento da IA

- Arquivo efetivamente lido em runtime: `functions/BASE_CONHECIMENTO_IA_ATENDIMENTO.md`.
- Se você editar a cópia na raiz do projeto (`../BASE_CONHECIMENTO_IA_ATENDIMENTO.md`), sincronize para `functions/` antes do deploy.

## Variáveis de ambiente

Defina no ambiente de execução (`functions/.env` em local e secrets/config no deploy):

- `QZ_CERT_PEM` — certificado PEM público.
- `QZ_PRIVATE_KEY_PEM` — chave privada PEM usada para assinatura.
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`
- `EMAILJS_NOTIFY_EMAILS` — lista de destinatários separada por vírgula.
- `ADMIN_ALLOWED_EMAILS` — e-mails autorizados a receber claim admin.
- `GROQ_API_KEY` — chave de API da Groq.

Observação: valores PEM podem ser salvos com quebra real de linha ou com `\\n`.

## Desenvolvimento local

1. Instalar dependências:
   - `npm install`
2. Criar arquivo de ambiente:
   - copiar `.env.example` para `.env` e preencher os valores.
3. Subir emuladores na raiz do projeto:
   - `firebase emulators:start`

## Deploy

- Apenas functions:
  - `firebase deploy --only functions`
- Functions + hosting:
  - `firebase deploy --only functions,hosting`

Nunca exponha chaves privadas no frontend.
