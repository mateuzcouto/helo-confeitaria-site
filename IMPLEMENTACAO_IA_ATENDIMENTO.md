# Implementação de IA de Atendimento - Helô Confeitaria

**Data:** 29/04/2026  
**Versão:** 1.0  
**Status:** ✅ Produção

---

## Resumo

Implementação de assistente de vendas com IA (Groq API) para atendimento ao cliente no site da Helô Confeitaria. O sistema permite que clientes interajam com um chatbot treinado com a base de conhecimento da confeitaria, respondendo perguntas sobre produtos, pedidos, pagamentos, entrega e políticas.

---

## Arquitetura

### Componentes

1. **Front-end:** `public/js/components/chat-widget.component.js`
   - Widget de chat flutuante no canto inferior direito
   - Interface React com histórico de conversa
   - Detecção automática de ambiente (localhost vs produção)

2. **Back-end:** `functions/index.js` - Cloud Function `groqChat`
   - Proxy seguro para API Groq
   - Leitura dinâmica da base de conhecimento
   - Rate limiting por IP (10 req/min)
   - CORS configurado

3. **Base de Conhecimento (canônica para runtime):** `functions/BASE_CONHECIMENTO_IA_ATENDIMENTO.md`
   - Documento markdown com informações da confeitaria
   - Atualizável sem modificar código
   - Fallback seguro em caso de erro

4. **Configuração:** `firebase.json`
   - Rewrite `/api/groq/**` → `groqChat`
   - Permite chamada via mesmo domínio em produção

---

## Detalhes de Implementação

### 1. Front-end (chat-widget.component.js)

#### URL Dinâmica
```javascript
const getGroqChatUrl = () => {
  const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
  );
  return isLocalhost
    ? 'https://us-central1-helo-confeitaria.cloudfunctions.net/groqChat'
    : '/api/groq/chat';
};
```

**Benefício:** Funciona tanto em desenvolvimento (localhost) quanto em produção sem alterações.

#### Parse Seguro de JSON
```javascript
const safeParseJson = async (response) => {
  try {
    const text = await response.text();
    if (!text || !text.trim()) return { error: 'Resposta vazia do servidor' };
    return JSON.parse(text);
  } catch (_) {
    return { error: 'Resposta inválida do servidor' };
  }
};
```

**Benefício:** Evita SyntaxError quando o servidor retorna erro não-JSON (ex: 405 do Live Server).

### 2. Cloud Function (functions/index.js)

#### Leitura Dinâmica da Base de Conhecimento
```javascript
function loadKnowledgeBase() {
  try {
    const knowledgePath = path.join(__dirname, 'BASE_CONHECIMENTO_IA_ATENDIMENTO.md');
    const content = fs.readFileSync(knowledgePath, 'utf8');
    return content;
  } catch (error) {
    console.error('[groqChat] Failed to load knowledge base file:', error);
    return /* fallback hardcoded */;
  }
}
```

**Benefício:** Permite atualizar o conhecimento da IA editando apenas o arquivo markdown, sem modificar código.

#### Rate Limiting
```javascript
const GROQ_RATE_LIMIT_MAX = 10;
const GROQ_RATE_LIMIT_WINDOW_MS = 60_000;
const groqRateLimitMap = new Map();

function checkGroqRateLimit(ip) {
  // Limpa entradas expiradas
  // Verifica se IP excedeu limite
  // Retorna true/false
}
```

**Benefício:** Protege contra abuso (máximo 10 mensagens por minuto por IP).

#### Integração com API Groq
```javascript
const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${groqApiKey}`,
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  }),
});
```

**Benefício:** Usa modelo de produção da Groq com alta velocidade de inferência.

### 3. Firebase Hosting (firebase.json)

#### Rewrite Configuration
```json
"rewrites": [
  {
    "source": "/api/groq/**",
    "function": "groqChat"
  }
]
```

**Benefício:** Permite que o front-end chame `/api/groq/chat` em produção e o Firebase Hosting redirecione para a Cloud Function.

---

## Como Atualizar o Conhecimento da IA

### Passo 1: Editar o arquivo de runtime
Edite `functions/BASE_CONHECIMENTO_IA_ATENDIMENTO.md` com as novas informações.

### Passo 2 (opcional): sincronizar cópia de referência na raiz
Se você também mantém a cópia de referência na raiz do projeto, sincronize manualmente:
```bash
copy functions\BASE_CONHECIMENTO_IA_ATENDIMENTO.md BASE_CONHECIMENTO_IA_ATENDIMENTO.md
```

### Passo 3: Deploy da Cloud Function
```bash
firebase deploy --project helo-confeitaria --only functions:groqChat
```

**Nota:** Não é necessário fazer deploy do hosting, apenas da Cloud Function.

---

## Variáveis de Ambiente

### functions/.env
```env
GROQ_API_KEY="sua_chave_groq_aqui"
```

**Obter chave:** https://console.groq.com/keys

---

## Testes Realizados

### Teste 1: Cloud Function Direta
```bash
curl -X POST https://us-central1-helo-confeitaria.cloudfunctions.net/groqChat \
  -H "Content-Type: application/json" \
  -d '{"message":"Olá","conversationHistory":[]}'
```

**Resultado:** ✅ Sucesso
```json
{"reply":"Olá! Seja bem-vindo à Helô Confeitaria! Estou aqui para ajudar..."}
```

### Teste 2: Pergunta Específica
```bash
curl -X POST https://us-central1-helo-confeitaria.cloudfunctions.net/groqChat \
  -H "Content-Type: application/json" \
  -d '{"message":"Qual o endereço para retirada?","conversationHistory":[]}'
```

**Resultado:** ✅ Sucesso
```json
{"reply":"O endereço para retirada é Anastácio Paulo de Sousa, 63 - Nova Aldeota."}
```

### Teste 3: Front-end Local
- Acessado via localhost
- URL dinâmica detectou ambiente local
- Usou URL direta da Cloud Function
- Chat funcionou corretamente

---

## Deploy em Produção

### Versão Deployada
- **Data:** 29/04/2026
- **Versão:** 20260429-053857
- **URL:** https://heloconfeitarianr.web.app

### Comandos Executados
```bash
# Deploy da Cloud Function
firebase deploy --project helo-confeitaria --only functions:groqChat

# Deploy do Hosting
firebase deploy --project helo-confeitaria --only hosting
```

---

## Estrutura de Arquivos

```
site-helo-final/
├── BASE_CONHECIMENTO_IA_ATENDIMENTO.md          # Base de conhecimento (cópia de referência)
├── functions/
│   ├── BASE_CONHECIMENTO_IA_ATENDIMENTO.md      # Base de conhecimento canônica (runtime/deploy)
│   ├── .env                                     # Variáveis de ambiente
│   ├── .env.example                             # Exemplo de variáveis
│   └── index.js                                 # Cloud Function groqChat
├── public/
│   ├── index.html                               # Carrega chat-widget
│   └── js/
│       ├── components/
│       │   └── chat-widget.component.js        # Widget de chat
│       └── js-build/
│           └── components/
│               └── chat-widget.component.js    # Versão compilada
└── firebase.json                                # Configuração Firebase
```

---

## Dependências

### functions/package.json
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

### public/index.html
```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
```

---

## Segurança

### Chaves API
- ✅ API key do Groq armazenada em `functions/.env` (não exposta ao front-end)
- ✅ Cloud Function como proxy seguro
- ✅ CORS configurado para permitir chamadas do domínio

### Rate Limiting
- ✅ 10 requisições por minuto por IP
- ✅ Mapa em memória com expiração automática
- ✅ Proteção contra abuso

### Fallback
- ✅ Se arquivo de conhecimento não existir, usa fallback hardcoded
- ✅ Parse seguro de JSON evita crashes
- ✅ Tratamento de erros em todas as camadas

---

## Manutenção

### Atualizar Modelo da IA
Se desejar trocar o modelo da Groq:
1. Edite `functions/index.js`
2. Altere `model: 'llama-3.3-70b-versatile'` para o modelo desejado
3. Deploy: `firebase deploy --project helo-confeitaria --only functions:groqChat`

### Modelos Disponíveis (Groq)
- `llama-3.3-70b-versatile` (recomendado para produção)
- `llama-3.1-8b-instant` (mais rápido, menos capacidade)
- `gpt-oss-120b` (modelo OpenAI de código aberto)

Documentação: https://console.groq.com/docs/models

---

## Troubleshooting

### IA não responde
1. Verificar se Cloud Function está ativa: `firebase functions:list`
2. Verificar logs: `firebase functions:log --only groqChat`
3. Verificar API key no `.env`

### Erro de CORS
1. Verificar se `sendCors(res, req)` está sendo chamado
2. Verificar configuração no `firebase.json`

### Base de conhecimento não atualizada
1. Verificar se arquivo foi copiado para `functions/`
2. Verificar se Cloud Function foi redeployada
3. Verificar logs para erros de leitura de arquivo

---

## Contato e Suporte

**Responsável:** T.I da Helô Confeitaria  
**Frequência de revisão:** Mensal ou quando houver mudanças nas políticas/produtos

---

**Fim do documento**
