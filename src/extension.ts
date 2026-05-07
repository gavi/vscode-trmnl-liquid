import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { Liquid } from "liquidjs";

const FONT_HOSTS = "https://trmnl.com https://usetrmnl.com";

type Layout = "full" | "half_horizontal" | "half_vertical" | "quadrant";
const LAYOUTS: Layout[] = ["full", "half_horizontal", "half_vertical", "quadrant"];

type DeviceId = "og" | "ogv2" | "v2";
type Device = {
  id: DeviceId;
  label: string;
  screenClass: string;
  bitDepth: 1 | 2 | 4;
  w: number;
  h: number;
};
const DEVICES: Device[] = [
  { id: "og",   label: "TRMNL OG (800×480, 1-bit)",     screenClass: "screen--og",   bitDepth: 1, w: 800,  h: 480 },
  { id: "ogv2", label: "TRMNL OG V2 (800×480, 2-bit)",  screenClass: "screen--ogv2", bitDepth: 2, w: 800,  h: 480 },
  { id: "v2",   label: "TRMNL X / V2 (1040×780, 4-bit)", screenClass: "screen--v2",  bitDepth: 4, w: 1040, h: 780 },
];

type Preview = {
  panel: vscode.WebviewPanel;
  fileUri: vscode.Uri;
  layoutOverride?: Layout;
  deviceId: DeviceId;
  liveData?: Record<string, unknown>;
  lastFetchedAt?: number;
  lastFetchError?: string;
};

type PollingConfig = {
  polling_url: string;
  method?: string;
  headers?: Record<string, string>;
};

const previews = new Map<string, Preview>();
let activePreview: Preview | undefined;

const engine = new Liquid({ jekyllInclude: true, dynamicPartials: false });

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("trmnl.openPreview", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "liquid") {
        vscode.window.showWarningMessage("TRMNL preview: open a .liquid file first.");
        return;
      }
      await openOrFocusPreview(context, editor.document);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("trmnl.setLayout", async () => {
      const preview = activePreview;
      if (!preview) {
        vscode.window.showWarningMessage("TRMNL preview: open a preview first.");
        return;
      }
      const detected = detectLayout(preview.fileUri.fsPath);
      const items: vscode.QuickPickItem[] = [
        { label: "Auto", description: `from filename → ${detected}` },
        ...LAYOUTS.map((l) => ({ label: l })),
      ];
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: "Select preview layout",
      });
      if (!pick) return;
      preview.layoutOverride = pick.label === "Auto" ? undefined : (pick.label as Layout);
      await refresh(context, preview);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("trmnl.setDevice", async () => {
      const preview = activePreview;
      if (!preview) {
        vscode.window.showWarningMessage("TRMNL preview: open a preview first.");
        return;
      }
      const pick = await vscode.window.showQuickPick(
        DEVICES.map((d) => ({ label: d.label, description: d.id, deviceId: d.id })),
        { placeHolder: "Select preview device" }
      );
      if (!pick) return;
      preview.deviceId = pick.deviceId as DeviceId;
      await refresh(context, preview);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const savedPath = doc.uri.fsPath;
      const savedDir = path.dirname(savedPath);
      const isSample =
        path.basename(savedPath) === "sample.json" || path.basename(savedPath) === "sample.yml";
      for (const preview of previews.values()) {
        const liquidPath = preview.fileUri.fsPath;
        const matches = liquidPath === savedPath || (isSample && path.dirname(liquidPath) === savedDir);
        if (matches) await refresh(context, preview);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || editor.document.languageId !== "liquid") return;
      const match = previews.get(editor.document.uri.fsPath);
      if (match) {
        match.panel.reveal(match.panel.viewColumn, true);
        activePreview = match;
      }
    })
  );
}

export function deactivate() {
  for (const p of previews.values()) p.panel.dispose();
  previews.clear();
}

async function openOrFocusPreview(
  context: vscode.ExtensionContext,
  doc: vscode.TextDocument
) {
  const key = doc.uri.fsPath;
  const existing = previews.get(key);
  if (existing) {
    existing.panel.reveal(undefined, true);
    activePreview = existing;
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "trmnlPreview",
    panelTitle(doc),
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    }
  );

  const preview: Preview = {
    panel,
    fileUri: doc.uri,
    layoutOverride: undefined,
    deviceId: "og",
  };
  previews.set(key, preview);
  activePreview = preview;

  panel.onDidDispose(() => {
    previews.delete(key);
    if (activePreview === preview) activePreview = undefined;
  });

  panel.onDidChangeViewState((e) => {
    if (e.webviewPanel.active) activePreview = preview;
  });

  panel.webview.onDidReceiveMessage(async (msg) => {
    let dirty = false;
    if (msg.type === "setDevice" && DEVICES.some((d) => d.id === msg.value)) {
      preview.deviceId = msg.value;
      dirty = true;
    } else if (msg.type === "setLayout") {
      preview.layoutOverride = msg.value === "auto" ? undefined : (msg.value as Layout);
      dirty = true;
    } else if (msg.type === "refreshData") {
      await fetchLive(preview);
      dirty = true;
    }
    if (dirty) await refresh(context, preview);
  });

  if (loadPollingConfig(path.dirname(doc.uri.fsPath))) {
    await fetchLive(preview);
  }
  await refresh(context, preview);
}

async function refresh(context: vscode.ExtensionContext, preview: Preview) {
  const doc = await vscode.workspace.openTextDocument(preview.fileUri);
  preview.panel.webview.html = await renderHtml(context, preview, doc);
  preview.panel.title = panelTitle(doc);
}

function panelTitle(doc: vscode.TextDocument): string {
  const fsPath = doc.uri.fsPath;
  const base = path.basename(fsPath);
  const parent = path.basename(path.dirname(fsPath));
  return parent ? `TRMNL — ${parent}/${base}` : `TRMNL — ${base}`;
}

async function renderHtml(
  context: vscode.ExtensionContext,
  preview: Preview,
  doc: vscode.TextDocument
): Promise<string> {
  const dir = path.dirname(doc.uri.fsPath);
  const liquidSrc = doc.getText();
  const layout = preview.layoutOverride ?? detectLayout(doc.uri.fsPath);
  const pollingConfig = loadPollingConfig(dir);

  const ctx: LoadedContext = preview.liveData
    ? { data: preview.liveData, warning: null }
    : pollingConfig
      ? { data: {}, warning: "Live data not yet fetched. Click Refresh." }
      : await loadContext(dir);

  let bodyHtml: string;
  let renderError: string | null = null;
  try {
    bodyHtml = await engine.parseAndRender(liquidSrc, ctx.data);
  } catch (e: any) {
    bodyHtml = "";
    renderError = e?.message ?? String(e);
  }

  const cssHref = preview.panel.webview
    .asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "plugins.css"))
    .toString();

  const nonce = randomNonce();
  const csp = [
    "default-src 'none'",
    `style-src ${preview.panel.webview.cspSource} 'unsafe-inline'`,
    `font-src ${FONT_HOSTS} data:`,
    `img-src ${preview.panel.webview.cspSource} https: data:`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  const fetchErrorBanner = preview.lastFetchError
    ? `<div class="trmnl-preview-error">Fetch error: ${escapeHtml(preview.lastFetchError)}</div>`
    : "";
  const banner = (renderError
    ? `<div class="trmnl-preview-error">Liquid render error: ${escapeHtml(renderError)}</div>`
    : ctx.warning
      ? `<div class="trmnl-preview-warning">${escapeHtml(ctx.warning)}</div>`
      : "") + fetchErrorBanner;

  const refreshButton = pollingConfig
    ? `<button id="refresh" type="button" title="Fetch ${escapeHtml(pollingConfig.polling_url)}">↻ Refresh</button>`
    : "";
  const fetchedReadout = preview.lastFetchedAt
    ? ` · fetched ${formatRelativeTime(preview.lastFetchedAt)}`
    : "";

  const device = DEVICES.find((d) => d.id === preview.deviceId)!;
  const screenClasses = buildScreenClasses(device);
  const [renderedW, renderedH] = [device.w, device.h];
  const detected = detectLayout(doc.uri.fsPath);

  const deviceOptions = DEVICES.map(
    (d) => `<option value="${d.id}"${d.id === preview.deviceId ? " selected" : ""}>${escapeHtml(d.label)}</option>`
  ).join("");
  const layoutOptions = [
    `<option value="auto"${preview.layoutOverride === undefined ? " selected" : ""}>Auto · from filename → ${detected}</option>`,
    ...LAYOUTS.map(
      (l) => `<option value="${l}"${preview.layoutOverride === l ? " selected" : ""}>${l}</option>`
    ),
  ].join("");

  const GAP = 10;
  const innerW = renderedW - GAP * 2;
  const innerH = renderedH - GAP * 2;
  const slotSize = (() => {
    switch (layout) {
      case "full":            return { w: innerW, h: innerH };
      case "half_horizontal": return { w: innerW, h: (innerH - GAP) / 2 };
      case "half_vertical":   return { w: (innerW - GAP) / 2, h: innerH };
      case "quadrant":        return { w: (innerW - GAP) / 2, h: (innerH - GAP) / 2 };
    }
  })();
  const mashupHtml = buildMashupHtml(layout, bodyHtml, slotSize, GAP);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${cssHref}" />
  <style>
    html { margin: 0; padding: 0; width: 100%; overflow-x: hidden; }
    body { margin: 0; padding: 16px 24px 24px; box-sizing: border-box; width: 100%; max-width: 100%; background: #2a2a2a; color: #eaeaea; font-family: ui-sans-serif, system-ui, sans-serif; overflow-x: hidden; }
    .trmnl-toolbar {
      display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
      padding: 8px 12px; margin-bottom: 12px;
      background: #1f1f1f; border-radius: 6px;
      font-size: 12px;
    }
    .trmnl-toolbar label { display: inline-flex; align-items: center; gap: 6px; color: #aaa; }
    .trmnl-toolbar select {
      background: #2a2a2a; color: #eaeaea; border: 1px solid #444;
      border-radius: 4px; padding: 3px 6px; font-size: 12px;
      font-family: inherit;
    }
    .trmnl-toolbar button {
      background: #2a2a2a; color: #eaeaea; border: 1px solid #444;
      border-radius: 4px; padding: 3px 8px; font-size: 12px;
      font-family: inherit; cursor: pointer;
    }
    .trmnl-toolbar button:hover { background: #333; border-color: #555; }
    .trmnl-toolbar .meta { margin-left: auto; color: #888; font-family: ui-monospace, monospace; }
    .trmnl-preview-stage {
      width: 100%;
      container-type: inline-size;
    }
    .trmnl-preview-frame {
      width: ${renderedW}px;
      height: ${renderedH}px;
      background: #fff; color: #000;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      overflow: hidden;
      zoom: min(1, calc(100cqi / ${renderedW}px));
    }
    .trmnl-preview-frame > .screen {
      width: 100%; height: 100%; box-sizing: border-box;
      --pixel-ratio: 1;
    }
    .mashup { width: 100%; height: 100%; box-sizing: border-box; display: grid; gap: ${GAP}px; }
    .mashup--full { grid-template-columns: ${slotSize.w}px; grid-template-rows: ${slotSize.h}px; }
    .mashup--half_horizontal { grid-template-columns: ${slotSize.w}px; grid-template-rows: ${slotSize.h}px ${slotSize.h}px; }
    .mashup--half_vertical { grid-template-columns: ${slotSize.w}px ${slotSize.w}px; grid-template-rows: ${slotSize.h}px; }
    .mashup--quadrant { grid-template-columns: ${slotSize.w}px ${slotSize.w}px; grid-template-rows: ${slotSize.h}px ${slotSize.h}px; }
    .mashup-slot { position: relative; width: ${slotSize.w}px; height: ${slotSize.h}px; overflow: hidden; box-sizing: border-box; }
    .mashup-slot--filled .view { width: ${slotSize.w}px !important; height: ${slotSize.h}px !important; }
    .mashup-slot--empty {
      border: 1.5px dashed #c4c4c4;
      border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      color: #888; font-size: 11px; font-family: ui-monospace, monospace;
      background: repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px);
    }
    .trmnl-preview-error, .trmnl-preview-warning {
      margin: 0 0 12px 0;
      padding: 8px 12px;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      border-radius: 4px;
    }
    .trmnl-preview-error { background: #5a1f1f; color: #ffd6d6; }
    .trmnl-preview-warning { background: #4a3f1f; color: #ffe9b8; }
  </style>
</head>
<body class="environment trmnl">
  <div class="trmnl-toolbar">
    <label>Device <select id="device">${deviceOptions}</select></label>
    <label>Layout <select id="layout">${layoutOptions}</select></label>
    ${refreshButton}
    <span class="meta" id="meta">${renderedW}×${renderedH} · ${device.bitDepth}-bit${fetchedReadout}</span>
  </div>
  ${banner}
  <div class="trmnl-preview-stage">
    <div class="trmnl-preview-frame">
      <div class="${screenClasses}">
        ${mashupHtml}
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const W = ${renderedW}, H = ${renderedH};
    const meta = document.getElementById("meta");

    const stage = document.querySelector(".trmnl-preview-stage");
    const fetchedSuffix = ${JSON.stringify(fetchedReadout)};
    function fit() {
      const stageW = stage.getBoundingClientRect().width;
      const scale = Math.min(1, stageW / W);
      meta.textContent = W + "×" + H + " · ${device.bitDepth}-bit · " + Math.round(scale * 100) + "%" + fetchedSuffix;
    }
    fit();
    new ResizeObserver(fit).observe(stage);

    document.getElementById("device").addEventListener("change", (e) => {
      vscode.postMessage({ type: "setDevice", value: e.target.value });
    });
    document.getElementById("layout").addEventListener("change", (e) => {
      vscode.postMessage({ type: "setLayout", value: e.target.value });
    });
    const refreshBtn = document.getElementById("refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "↻ Fetching…";
        vscode.postMessage({ type: "refreshData" });
      });
    }
  </script>
</body>
</html>`;
}

function buildMashupHtml(
  layout: Layout,
  bodyHtml: string,
  _slot: { w: number; h: number },
  _gap: number
): string {
  const slot = (kind: "filled" | "empty", inner: string = "") =>
    kind === "filled"
      ? `<div class="mashup-slot mashup-slot--filled"><div class="view view--${layout}">${inner}</div></div>`
      : `<div class="mashup-slot mashup-slot--empty">empty slot</div>`;

  switch (layout) {
    case "full":
      return `<div class="mashup mashup--full">${slot("filled", bodyHtml)}</div>`;
    case "half_horizontal":
      return `<div class="mashup mashup--half_horizontal">${slot("filled", bodyHtml)}${slot("empty")}</div>`;
    case "half_vertical":
      return `<div class="mashup mashup--half_vertical">${slot("filled", bodyHtml)}${slot("empty")}</div>`;
    case "quadrant":
      return `<div class="mashup mashup--quadrant">${slot("filled", bodyHtml)}${slot("empty")}${slot("empty")}${slot("empty")}</div>`;
  }
}

function randomNonce(): string {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function buildScreenClasses(device: Device): string {
  const sizes: string[] = [];
  if (device.w >= 600)  sizes.push("screen--sm");
  if (device.w >= 800)  sizes.push("screen--md");
  if (device.w >= 1024) sizes.push("screen--lg");
  return [
    "screen",
    device.screenClass,
    `screen--${device.bitDepth}bit`,
    ...sizes,
  ].join(" ");
}

function detectLayout(filePath: string): Layout {
  const base = path.basename(filePath, ".liquid").toLowerCase();
  if ((LAYOUTS as string[]).includes(base)) return base as Layout;
  return "full";
}

type LoadedContext = { data: Record<string, unknown>; warning: string | null };

function loadPollingConfig(dir: string): PollingConfig | null {
  const p = path.join(dir, "trmnl.yml");
  if (!fs.existsSync(p)) return null;
  try {
    const cfg = yaml.load(fs.readFileSync(p, "utf8")) as PollingConfig;
    if (!cfg || typeof cfg.polling_url !== "string") return null;
    return cfg;
  } catch {
    return null;
  }
}

async function fetchLive(preview: Preview): Promise<void> {
  const dir = path.dirname(preview.fileUri.fsPath);
  const config = loadPollingConfig(dir);
  if (!config) {
    preview.lastFetchError = "No trmnl.yml with polling_url found.";
    return;
  }
  try {
    const res = await fetch(config.polling_url, {
      method: config.method ?? "GET",
      headers: config.headers ?? {},
    });
    if (!res.ok) {
      preview.lastFetchError = `HTTP ${res.status} ${res.statusText}`;
      return;
    }
    const text = await res.text();
    try {
      preview.liveData = JSON.parse(text);
    } catch (e: any) {
      preview.lastFetchError = `Response is not JSON: ${e.message}`;
      return;
    }
    preview.lastFetchedAt = Date.now();
    preview.lastFetchError = undefined;
  } catch (e: any) {
    preview.lastFetchError = e?.message ?? String(e);
  }
}

async function loadContext(dir: string): Promise<LoadedContext> {
  const samplePath = path.join(dir, "sample.json");
  if (fs.existsSync(samplePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(samplePath, "utf8"));
      return { data, warning: null };
    } catch (e: any) {
      return { data: {}, warning: `sample.json parse error: ${e.message}` };
    }
  }
  const yamlPath = path.join(dir, "sample.yml");
  if (fs.existsSync(yamlPath)) {
    try {
      const data = yaml.load(fs.readFileSync(yamlPath, "utf8")) as Record<string, unknown>;
      return { data: data ?? {}, warning: null };
    } catch (e: any) {
      return { data: {}, warning: `sample.yml parse error: ${e.message}` };
    }
  }
  return {
    data: {},
    warning: "No sample.json (or sample.yml) found next to this file. Rendering with empty context.",
  };
}

function formatRelativeTime(ts: number): string {
  const sec = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  );
}
