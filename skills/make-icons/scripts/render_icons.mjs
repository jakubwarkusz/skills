#!/usr/bin/env node
// render_icons.mjs: render every exported *Icon component of the given files into one HTML page for the audit.
//
//   node render_icons.mjs <out.html> <icons.tsx> [more.tsx ...] [--root <dir>]
//
// Needs Node 22.15 or newer. TypeScript and JSX are compiled on the fly with a compiler the project already has
// (typescript up to 6, esbuild, @swc/core or sucrase), looked for from the icons, the current folder and --root, and `paths` from the tsconfig.json in the current folder are followed, so run it from the project root.
// Bun and tsx run it too, with their own compilers. React is taken from where the first icon
// file finds it, so the page is rendered with the same copy the icons import. All icons go through one
// renderToStaticMarkup call: rendered one by one, every icon gets the same useId and so the same mask.
import * as nodeModule from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const { createRequire } = nodeModule;
const argv = process.argv.slice(2);
const rootAt = argv.indexOf("--root");
const root = rootAt >= 0 ? argv.splice(rootAt, 2)[1] : null;
const [out, ...files] = argv;
if (!out || !files.length) { console.error("usage: node render_icons.mjs <out.html> <icons.tsx> [more.tsx ...] [--root <dir>]"); process.exit(2); }
const fromProject = createRequire(resolve(files[0]));

// Plain Node can't import .tsx. Compile each source file as it is loaded, with whatever the project already has.
const source = /\.(tsx|ts|mts|jsx)$/;
const compiled = process.versions.bun || process.execArgv.some((arg) => /tsx|ts-node/.test(arg)) || process.env.TSX_TSCONFIG_PATH !== undefined;
if (!compiled && files.some((file) => source.test(file))) {
  if (typeof nodeModule.registerHooks !== "function") {
    console.error(`Node ${process.versions.node} can't load .tsx files here. Use Node 22.15 or newer, or point the audit at a folder of .svg files instead.`);
    process.exit(2);
  }
  const places = [resolve(files[0]), resolve("package.json"), ...(root ? [resolve(root, "package.json")] : [])].map((place) => createRequire(place));
  const load = (name, usable = () => true) => {
    for (const from of places) {
      try {
        const found = from(name);
        if (usable(found)) return found;
      } catch {}
    }
    return null;
  };
  const compilers = [
    () => {
      // TypeScript 7 no longer ships this API in its main entry.
      const ts = load("typescript", (found) => typeof found.transpileModule === "function");
      return ts && ((code, file) => ts.transpileModule(code, {
        fileName: file,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
      }).outputText);
    },
    () => {
      const esbuild = load("esbuild");
      return esbuild && ((code, file) => esbuild.transformSync(code, { loader: file.endsWith("x") ? "tsx" : "ts", jsx: "automatic", format: "esm", target: "es2022" }).code);
    },
    () => {
      const swc = load("@swc/core");
      return swc && ((code, file) => swc.transformSync(code, {
        filename: file,
        jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2022" },
        module: { type: "es6" },
      }).code);
    },
    () => {
      const sucrase = load("sucrase");
      return sucrase && ((code, file) => sucrase.transform(code, { transforms: ["typescript", "jsx"], jsxRuntime: "automatic", filePath: file }).code);
    },
  ];
  let compile = null;
  for (const make of compilers) if ((compile = make())) break;
  if (!compile) {
    console.error(`No compiler for .tsx was found from ${dirname(resolve(files[0]))}${root ? ` or ${resolve(root)}` : ""}: looked for typescript (up to 6), esbuild, @swc/core and sucrase.\nInstall esbuild in a scratch folder outside the project (npm i esbuild) and pass --root <that folder>, or point the audit at a folder of .svg files instead.`);
    process.exit(2);
  }
  // tsconfig paths, such as "@/*": ["./src/*"], read from the folder the script is run in.
  const aliases = [];
  try {
    const text = readFileSync(resolve("tsconfig.json"), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    const options = JSON.parse(text).compilerOptions ?? {};
    for (const [key, targets] of Object.entries(options.paths ?? {}))
      if (targets[0]) aliases.push([key.replace(/\*$/, ""), resolve(options.baseUrl ?? ".", targets[0].replace(/\*$/, ""))]);
  } catch {}
  const endings = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
  const find = (base) => {
    for (const ending of endings) {
      const path = base + ending;
      if (existsSync(path) && statSync(path).isFile()) return path;
    }
    return null;
  };
  nodeModule.registerHooks({
    resolve(specifier, context, next) {
      if (/\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|woff2?)(\?.*)?$/.test(specifier))
        return { url: "data:text/javascript,export default ''", shortCircuit: true };
      const alias = aliases.find(([prefix]) => specifier.startsWith(prefix));
      const base = alias
        ? resolve(alias[1], specifier.slice(alias[0].length))
        : /^\.{1,2}\//.test(specifier) && context.parentURL?.startsWith("file:")
          ? resolve(dirname(fileURLToPath(context.parentURL)), specifier)
          : null;
      const path = base && find(base);
      return path ? { url: pathToFileURL(path).href, shortCircuit: true } : next(specifier, context);
    },
    load(url, context, next) {
      if (!url.startsWith("file:") || !source.test(url) || url.includes("/node_modules/")) return next(url, context);
      const file = fileURLToPath(url);
      return { format: "module", source: compile(readFileSync(file, "utf8"), file), shortCircuit: true };
    },
  });
}
let createElement, renderToStaticMarkup;
try {
  const React = fromProject("react");
  // Files compiled with the classic JSX transform look for a global React.
  globalThis.React ??= React;
  ({ createElement } = React);
  ({ renderToStaticMarkup } = fromProject("react-dom/server"));
} catch {
  console.error(`react and react-dom were not found from ${dirname(resolve(files[0]))}. Install them in the project the icons belong to.`);
  process.exit(2);
}
const cells = [];
for (const file of files) {
  const mod = await import(pathToFileURL(resolve(file)).href);
  for (const [name, Component] of Object.entries(mod)) {
    if (!/Icon$/.test(name)) continue;
    // memo and forwardRef components are objects, not functions. A JSX element is an object too, and not a component.
    const wrapped = Component && typeof Component === "object" && ["react.memo", "react.forward_ref", "react.lazy"].some((kind) => Component.$$typeof === Symbol.for(kind));
    if (typeof Component !== "function" && !wrapped) {
      console.error(`${name} in ${file} is not a component and was left out`);
      continue;
    }
    cells.push(createElement("div", { "data-icon": name.replace(/Icon$/, ""), key: `${file}:${name}` }, createElement(Component)));
  }
}
if (!cells.length) { console.error("no exported component with a name ending in Icon was found in those files"); process.exit(2); }
mkdirSync(dirname(resolve(out)), { recursive: true });
// The audit looks for icons.audit.json beside the page and, through this tag, beside the icons it was made from.
const folder = dirname(resolve(files[0])).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
writeFileSync(out, `<!doctype html><meta name="icons-source" content="${folder}"><body>${renderToStaticMarkup(createElement("div", null, cells))}</body>`);
console.log(`rendered ${cells.length} icons to ${out}`);
