# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Helô Confeitaria is a Firebase-based bakery order management system with a public storefront and admin panel. See `README.md` for full details.

### Development commands

| Task | Command | Notes |
|---|---|---|
| Install root deps | `npm install` (in `/workspace`) | Provides `esbuild` for JSX transpilation |
| Install function deps | `npm install` (in `/workspace/functions`) | Firebase Cloud Functions dependencies |
| Build JSX | `npm run build:public` | Transpiles `public/js/` → `public/js-build/` via esbuild |
| Run locally | `firebase emulators:start` | Starts Hosting (:5000), Functions (:5001), Firestore (:8080), Storage (:9199), Emulator UI (:4000) |
| Lint | `cd functions && npm run lint` | Currently a no-op (`echo "No lint configured"`) |

### Non-obvious caveats

- **`public/js-build/` is gitignored.** You must run `npm run build:public` before `firebase emulators:start` or the app will fail to load scripts in the browser.
- **The build script references `components/chat-widget.component.js`** which was added to the build manifest but has only a placeholder source file. If a full implementation is added later, the build will pick it up automatically.
- **No Auth emulator is configured.** The Firebase emulators start without Auth; the front-end connects to the production Firebase Auth/Firestore/Storage using credentials in `public/js/core/config/app-config.js`. This means the app works locally but talks to the real Firebase project for data and auth.
- **`functions/.env` must be created** from `functions/.env.example` before running emulators. At minimum, set `ADMIN_ALLOWED_EMAILS`. All other env vars (EmailJS, QZ Tray, Groq) are optional and degrade gracefully.
- **Firebase CLI is needed globally** (`npm install -g firebase-tools`). The update script handles this.
- **Edit JSX source files in `public/js/`**, never in `public/js-build/`. After edits, run `npm run build:public` to regenerate transpiled output.
- **No automated test suite exists** in this codebase. Verification is done by running the app locally and manual testing.
