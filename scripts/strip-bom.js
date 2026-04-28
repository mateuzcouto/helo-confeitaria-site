#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_EXTENSIONS = ['.html', '.js', '.css', '.json', '.txt', '.svg', '.xml'];
const DEFAULT_IGNORE_DIRS = new Set(['.git', 'node_modules', '.firebase']);

function printHelp() {
  console.log(`
Usage:
  node scripts/strip-bom.js [targetDir] [options]

Options:
  --ext=.js,.css,.html  Comma-separated extension allowlist
  --dry-run             Show which files would be fixed without writing
  --verbose             Log scanned files and skipped directories
  --include-hidden      Process hidden directories/files (default skips hidden dirs)
  --help                Show this help

Examples:
  node scripts/strip-bom.js public
  node scripts/strip-bom.js . --dry-run --verbose
  node scripts/strip-bom.js public --ext=.js,.css,.html
`);
}

function parseArgs(argv) {
  let targetArg = null;
  let dryRun = false;
  let verbose = false;
  let includeHidden = false;
  let extensions = new Set(DEFAULT_EXTENSIONS);

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg === '--include-hidden') {
      includeHidden = true;
      continue;
    }

    if (arg.startsWith('--ext=')) {
      const raw = arg.slice('--ext='.length).trim();
      const next = raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .map((item) => (item.startsWith('.') ? item : `.${item}`));

      if (next.length > 0) {
        extensions = new Set(next);
      }
      continue;
    }

    if (!arg.startsWith('-') && !targetArg) {
      targetArg = arg;
      continue;
    }

    console.error(`[strip-bom] unknown argument: ${arg}`);
    process.exit(1);
  }

  return {
    targetArg: targetArg || 'public',
    dryRun,
    verbose,
    includeHidden,
    extensions,
  };
}

function countLeadingBomBytes(data) {
  let start = 0;
  while (
    start + 2 < data.length &&
    data[start] === 0xef &&
    data[start + 1] === 0xbb &&
    data[start + 2] === 0xbf
  ) {
    start += 3;
  }
  return start;
}

function shouldIgnoreDir(name, includeHidden) {
  if (DEFAULT_IGNORE_DIRS.has(name)) return true;
  if (!includeHidden && name.startsWith('.')) return true;
  return false;
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const targetDir = path.resolve(process.cwd(), options.targetArg);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`[strip-bom] directory not found: ${targetDir}`);
    process.exit(1);
  }

  let scanned = 0;
  let fixed = 0;
  let errors = 0;

  const stack = [targetDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      errors += 1;
      console.error(`[strip-bom] failed to read directory: ${path.relative(process.cwd(), dir)} (${error.message})`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name, options.includeHidden)) {
          if (options.verbose) {
            console.log(`[strip-bom] skipped directory ${path.relative(process.cwd(), fullPath)}`);
          }
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!options.extensions.has(ext)) continue;

      scanned += 1;
      if (options.verbose) {
        console.log(`[strip-bom] scanning ${path.relative(process.cwd(), fullPath)}`);
      }

      let data;
      try {
        data = fs.readFileSync(fullPath);
      } catch (error) {
        errors += 1;
        console.error(`[strip-bom] failed to read file: ${path.relative(process.cwd(), fullPath)} (${error.message})`);
        continue;
      }

      const start = countLeadingBomBytes(data);
      if (start === 0) continue;

      try {
        if (!options.dryRun) {
          fs.writeFileSync(fullPath, data.subarray(start));
        }
        fixed += 1;
        console.log(`[strip-bom] ${options.dryRun ? 'would-fix' : 'fixed'} ${path.relative(process.cwd(), fullPath)}`);
      } catch (error) {
        errors += 1;
        console.error(`[strip-bom] failed to write file: ${path.relative(process.cwd(), fullPath)} (${error.message})`);
      }
    }
  }

  const mode = options.dryRun ? 'dry-run' : 'write';
  console.log(`[strip-bom] mode=${mode} scanned=${scanned} fixed=${fixed} errors=${errors}`);
  if (errors > 0) process.exitCode = 2;
}

run();
