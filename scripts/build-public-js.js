const fs = require('fs/promises');
const path = require('path');
const { transform } = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const sourceDir = path.join(publicDir, 'js');
const outputDir = path.join(publicDir, 'js-build');

const filesToCompile = [
    'components/brand-logo.component.js',
    'components/cabecalho.component.js',
    'components/rodape-site.component.js',
    'components/product-card.component.js',
    'components/vitrine-produtos.component.js',
    'core/utils/admin-utils.js',
    'core/catalog.js',
    'script.js',
    'cart-ui.js',
    'ui-shell.js',
    'main-app.js',
];

const banner = '/* Arquivo gerado automaticamente por scripts/build-public-js.js */\n';

async function buildFile(fileName) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(outputDir, fileName);
    const targetDir = path.dirname(targetPath);
    const sourceCode = await fs.readFile(sourcePath, 'utf8');
    const result = await transform(sourceCode, {
        loader: 'jsx',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
        target: 'es2020',
        charset: 'utf8',
        sourcemap: false,
    });

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, `${banner}${result.code}`, 'utf8');
    return { fileName, bytes: Buffer.byteLength(result.code, 'utf8') };
}

async function main() {
    await fs.mkdir(outputDir, { recursive: true });
    const results = [];

    for (const fileName of filesToCompile) {
        results.push(await buildFile(fileName));
    }

    results.forEach((result) => {
        console.log(`[build-public-js] ${result.fileName} -> ${result.bytes} bytes`);
    });
}

main().catch((error) => {
    console.error('[build-public-js] erro ao compilar scripts JSX');
    console.error(error);
    process.exitCode = 1;
});