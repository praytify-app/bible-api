#!/usr/bin/env node
// Puts the real <praytify-verse> widget at public/embed/v1.js so the embed
// builder previews exactly what integrators load, and `vite build` ships it
// as dist/embed/v1.js. Runs as the `predev` and `prebuild` scripts.
//
// Three cases:
//   1. ../packages/embed is here (a checkout): build it with its own tsc when
//      the source is newer than its dist, then copy dist/embed.js across.
//   2. The package is absent but public/embed/v1.js exists (the Docker image,
//      whose embed stage wrote the file): nothing to do.
//   3. Neither is available: fail, because the preview and the shipped
//      /embed/v1.js would both be missing.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const portal = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = resolve(portal, "../packages/embed");
const built = join(pkg, "dist/embed.js");
const target = join(portal, "public/embed/v1.js");
const tsc = join(pkg, "node_modules/.bin/tsc");
const rel = (path) => path.replace(`${resolve(portal, "..")}/`, "");

function fail(message) {
  console.error(`copy-embed: ${message}`);
  process.exit(1);
}

function newestSourceMtime() {
  const src = join(pkg, "src");
  const files = [join(pkg, "tsconfig.json"), join(pkg, "tsconfig.build.json")];
  for (const name of readdirSync(src)) files.push(join(src, name));
  return Math.max(...files.filter(existsSync).map((file) => statSync(file).mtimeMs));
}

if (!existsSync(join(pkg, "package.json"))) {
  if (existsSync(target)) process.exit(0);
  fail(`${rel(target)} is missing and ${rel(pkg)} is not available to build it from.`);
}

const stale = !existsSync(built) || statSync(built).mtimeMs < newestSourceMtime();
if (stale) {
  if (!existsSync(tsc)) {
    const fix = `Run \`pnpm install\` in ${rel(pkg)} (it is its own workspace root) to install its TypeScript.`;
    if (existsSync(target)) {
      console.warn(`copy-embed: cannot rebuild the widget, keeping the existing ${rel(target)}, which may be stale. ${fix}`);
      process.exit(0);
    }
    fail(`cannot build the widget: ${rel(tsc)} is missing. ${fix}`);
  }
  try {
    execFileSync(tsc, ["-p", "tsconfig.build.json"], { cwd: pkg, stdio: "inherit" });
  } catch {
    fail(`building ${rel(pkg)} failed (see the tsc output above).`);
  }
}

const same = existsSync(target) && readFileSync(target).equals(readFileSync(built));
if (!same) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(built, target);
  console.log(`copy-embed: ${rel(built)} -> ${rel(target)}`);
}
