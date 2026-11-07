// Plain (non-module) stylesheets are side-effect imports, e.g. `import "./globals.css"`.
// Next only declares `*.module.css`; TypeScript with `noUncheckedSideEffectImports`
// (default in newer versions, e.g. VS Code's bundled TS) needs this to resolve them.
declare module "*.css";
