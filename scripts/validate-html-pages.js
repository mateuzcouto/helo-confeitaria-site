#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log(
  "\n════════════════════════════════════════════════════════════════════",
);
console.log("🔍 VALIDANDO REFERÊNCIAS DE SCRIPTS NAS PÁGINAS HTML");
console.log(
  "════════════════════════════════════════════════════════════════════\n",
);

const htmlPages = [
  { name: "Vitrine (index.html)", path: "public/index.html" },
  { name: "Admin (admin.html)", path: "public/admin.html" },
];

const forbiddenScriptsByPage = {
  "public/index.html": [
    "js-build/crm.js",
    "js-build/financeiro.js",
    "js-build/estoque.js",
    "js-build/script.js",
    "js-build/ui-shell.js",
  ],
  "public/admin.html": [
    "js-build/components/product-card.component.js",
    "js-build/components/vitrine-produtos.component.js",
    "js-build/components/chat-widget.component.js",
    "js-build/cart-ui.js",
    "js-build/main-app.js",
  ],
};

const publicDir = path.join(__dirname, "..", "public");
const jsBuildDir = path.join(publicDir, "js-build");

let totalErrors = 0;

htmlPages.forEach(({ name, path: htmlPath }) => {
  console.log(`📄 ${name}`);
  console.log(`   Arquivo: ${htmlPath}`);

  const fullPath = path.join(__dirname, "..", htmlPath);
  const content = fs.readFileSync(fullPath, "utf-8");

  // Extrair todos os scripts (captura src mesmo com atributos como defer/async)
  const scriptRegex = /<script\b[^>]*\bsrc=["']\.\/([^"']+)["'][^>]*>/g;
  const scripts = [];
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    scripts.push(match[1]);
  }

  console.log(`   Scripts encontrados: ${scripts.length}`);

  let pageErrors = 0;
  const references = {
    jsBuild: [],
    js: [],
    other: [],
    missing: [],
  };

  scripts.forEach((script) => {
    if (script.includes("?v=")) {
      script = script.split("?")[0];
    }

    const fullScriptPath = path.join(publicDir, script);
    const exists = fs.existsSync(fullScriptPath);

    if (script.startsWith("js-build/")) {
      references.jsBuild.push(script);
      if (!exists) {
        references.missing.push(script);
        pageErrors++;
      }
    } else if (script.startsWith("js/")) {
      references.js.push(script);
      if (!exists) {
        references.missing.push(script);
        pageErrors++;
      }
    } else {
      references.other.push(script);
      if (!exists) {
        references.missing.push(script);
        pageErrors++;
      }
    }
  });

  const forbiddenScripts = forbiddenScriptsByPage[htmlPath] || [];
  const normalizedScripts = scripts.map((script) =>
    script.includes("?v=") ? script.split("?")[0] : script,
  );
  const forbiddenFound = forbiddenScripts.filter((script) =>
    normalizedScripts.includes(script),
  );

  if (forbiddenFound.length > 0) {
    console.log(`   ❌ Scripts indevidos nesta página: ${forbiddenFound.length}`);
    forbiddenFound.forEach((script) => {
      console.log(`      └─ ${script}`);
    });
    totalErrors += forbiddenFound.length;
  }

  // Mostrar resumo
  if (references.jsBuild.length > 0) {
    console.log(`   ✓ js-build/ (transpilados): ${references.jsBuild.length}`);
  }

  if (references.js.length > 0) {
    console.log(
      `   ⚠ js/ (fonte/JSX): ${references.js.length} — AVISO: Browsers não executam JSX!`,
    );
    references.js.forEach((s) => {
      console.log(`      └─ ${s}`);
    });
  }

  if (references.missing.length > 0) {
    console.log(`   ❌ Arquivos FALTANDO: ${references.missing.length}`);
    references.missing.forEach((s) => {
      console.log(`      └─ ${s}`);
    });
    totalErrors += references.missing.length;
  } else if (references.js.length === 0) {
    console.log(`   ✅ TODOS OS SCRIPTS REFERENCIADOS EXISTEM!`);
  }

  console.log("");
});

console.log(
  "════════════════════════════════════════════════════════════════════",
);
if (totalErrors === 0) {
  console.log("✅ VALIDAÇÃO CONCLUÍDA — NENHUM ERRO ENCONTRADO!");
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );
  process.exit(0);
} else {
  console.log(`❌ VALIDAÇÃO FALHOU — ${totalErrors} ERRO(S) ENCONTRADO(S)!`);
  console.log(
    "═══════════════════════════════════════════════════════════════════\n",
  );
  process.exit(1);
}
