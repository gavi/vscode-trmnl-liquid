const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const ctx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
};

(async () => {
  if (watch) {
    const c = await esbuild.context(ctx);
    await c.watch();
  } else {
    await esbuild.build(ctx);
  }
})();
