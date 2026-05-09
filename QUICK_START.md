# Quick Start — Helô Confeitaria

Guia rápido para desenvolvedores iniciarem trabalho no projeto.

---

## 🚀 Setup Inicial (5 minutos)

```bash
cd site-helo-final/site-helo-final
npm install
npm run build:public
npx firebase emulators:start
```

Acesse:

- **Vitrine:** http://localhost:5000/
- **Admin:** http://localhost:5000/admin.html

---

## 📝 Estrutura Rápida

### Duas Páginas Separadas

| Arquivo      | Entrypoint     | Tamanho    | Para Quem     |
| ------------ | -------------- | ---------- | ------------- |
| `index.html` | `main-app.js`  | ~30-50KB   | Cliente final |
| `admin.html` | `app-admin.js` | ~150-200KB | Staff/admin   |

### Build Process

```
public/js/          (source .jsx)
  ↓ npm run build:public (esbuild)
public/js-build/    (transpilado .js)
  ↓
index.html & admin.html (referem js-build/)
  ↓ Firebase Hosting
Navegador (React renderiza)
```

---

## 💻 Desenvolvimento Day-to-Day

### Para Editar a Vitrine (Cliente Final)

1. Editar arquivos em `public/js/`:
   - Componentes: `components/*.component.js`
   - Lógica: `main-app.js`, `carrinho.js`, `app.js`, etc.

2. Compilar:

   ```bash
   npm run build:public
   ```

3. Testar:

   ```bash
   # Emulator já rodando em outro terminal?
   # Browser refaz o refresh sozinho (hot reload do Firefox/Chrome)
   ```

4. **Importante:**
   - Se editar `index.html`, adicione novos scripts em `js-build/`
   - **Nunca adicione scripts de admin** (crm.js, financeiro.js, estoque.js, script.js) em `index.html`

### Para Editar o Admin (Painel)

1. Editar arquivos em `public/js/`:
   - Lógica admin: `crm.js`, `financeiro.js`, `estoque.js`, `script.js`
   - Novo entrypoint: `app-admin.js`

2. Compilar:

   ```bash
   npm run build:public
   ```

3. Testar:

   ```bash
   # http://localhost:5000/admin.html
   ```

4. **Importante:**
   - Se editar `admin.html`, adicione novos scripts em `js-build/`
   - **Nunca adicione scripts de vitrine** (product-card.component.js, vitrine-produtos.component.js, chat-widget.component.js) em `admin.html`

---

## 🔍 Onde Colocar Novo Código?

### Nova Feature de Cliente (Vitrine)

```
Editar:
  public/js/main-app.js (adicionar lógica)
  public/js/components/nova-feature.component.js (UI)

HTML:
  public/index.html (adicionar <script src="./js-build/components/nova-feature.component.js">)

Build:
  npm run build:public

NÃO FAZER:
  ✗ Adicionar a admin.html
  ✗ Misturar com lógica de admin
```

### Nova Feature de Admin

```
Editar:
  public/js/novo-modulo.js (lógica)
  public/js/components/nova-feature-admin.component.js (UI)

HTML:
  public/admin.html (adicionar <script src="./js-build/novo-modulo.js">)

Build:
  npm run build:public

NÃO FAZER:
  ✗ Adicionar a index.html
  ✗ Misturar com lógica de vitrine
```

---

## 📦 Scripts NPM

```bash
# Compilar JSX → JavaScript
npm run build:public

# Compilar + adicionar versão ao HTML + preparar para deploy
npm run prepare:hosting

# Deploy para produção
npm run deploy:hosting

# Emular Firebase Hosting localmente
npx firebase emulators:start
```

---

## 🐛 Troubleshooting

### Build falha

```bash
# Verificar syntax
npm run build:public

# Erro no console? Verifica em public/js/ se tem JSON ou typo
```

### Vitrine/Admin não carregam

```bash
# Verificar DevTools Console (F12)
# Erro de script? Checar se está em js-build/ (não em js/)

# Emulator rodando?
npx firebase emulators:start
```

### Impressora térmica não funciona

```bash
# Só funciona em admin.html
# Verificar se qz-tray.js está carregando
# https://localhost:5000/admin.html → DevTools → Network → procurar qz-tray
```

---

## 📚 Documentação Completa

- **PDR.md** — Padrões, Decisões e Referência (regras, histórico de correções, checklist de deploy)
- **README.md** — Features, configuração, segurança
- **ARCHITECTURE.md** — Estrutura técnica profunda (diagramas, bundle separation, auth)
- **Este arquivo (QUICK_START.md)** — Setup rápido

---

## ✅ Checklist Antes de Commit

- [ ] `npm run build:public` passa sem erros
- [ ] Testar em `http://localhost:5000/` (vitrine)
- [ ] Testar em `http://localhost:5000/admin.html` (admin)
- [ ] DevTools Console sem erros
- [ ] Novo script **não foi adicionado** a página errada

---

## 🚀 Deploy

```bash
# Pré-deploy (build + versioning)
npm run prepare:hosting

# Deploy real (precisa de firebase CLI + credenciais)
npm run deploy:hosting

# Validar em produção
# https://heloconfeitarianr.web.app/
# https://heloconfeitarianr.web.app/admin.html
```

---

## 🤝 Contribuindo

1. Criar branch: `git checkout -b feature/sua-feature`
2. Editar código em `public/js/`
3. Build: `npm run build:public`
4. Testar localmente
5. Commit com mensagem clara
6. Push e criar PR

**Lembrete:** Nunca commitar:

- `.env` e senhas
- `node_modules/`
- Arquivos compilados acidentalmente duplicados

---

## 📞 Dúvidas?

Referências rápidas:

- React 18: https://react.dev
- Firebase: https://firebase.google.com/docs
- esbuild: https://esbuild.github.io/
- QZ Tray (impressora): https://www.qzindustries.com/
