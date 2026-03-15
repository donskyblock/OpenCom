import { useEffect, useMemo, useState } from "react";
import { coreApi, installThemeLocally } from "./themeApi";
import "./theme-studio.css";

const starterTemplates = [
  {
    id: "clean",
    name: "Clean Glass",
    css: [
      ".chat-header, .composer, .sidebar-block {",
      "  backdrop-filter: blur(14px);",
      "  background: rgba(9, 16, 31, 0.72);",
      "}"
    ].join("\n")
  },
  {
    id: "neon",
    name: "Neon Grid",
    css: [
      "body {",
      "  background:",
      "    radial-gradient(circle at 12% 10%, rgba(47, 180, 255, 0.24), transparent 45%),",
      "    linear-gradient(145deg, #050b16, #11152b 60%);",
      "}"
    ].join("\n")
  },
  {
    id: "sunset",
    name: "Sunset Warm",
    css: [
      "body {",
      "  background: linear-gradient(160deg, #2f1b20, #5c2c2c 40%, #231a2e);",
      "}",
      ":root { --brand: #ff8f54; }"
    ].join("\n")
  }
];

const visualPresets = [
  {
    id: "midnight",
    name: "Midnight",
    values: {
      bgFrom: "#081329",
      bgTo: "#151f3a",
      surface: "#13213a",
      text: "#eef4ff",
      muted: "#9eb2d9",
      brand: "#5a9fff",
      radius: 14,
      blur: 12,
      shadow: 0.45
    }
  },
  {
    id: "aurora",
    name: "Aurora",
    values: {
      bgFrom: "#07211f",
      bgTo: "#1d1f40",
      surface: "#132a34",
      text: "#ecfffb",
      muted: "#9dc9d6",
      brand: "#48d5ac",
      radius: 16,
      blur: 14,
      shadow: 0.42
    }
  },
  {
    id: "ember",
    name: "Ember",
    values: {
      bgFrom: "#28120f",
      bgTo: "#311d2f",
      surface: "#342025",
      text: "#fff1e5",
      muted: "#d1ab9c",
      brand: "#ff8656",
      radius: 13,
      blur: 9,
      shadow: 0.5
    }
  }
];

const elementTargets = [
  {
    id: "shell",
    name: "App Shell",
    description: "Overall app canvas and major frame colours.",
    selectors: [".opencom-shell"],
    accentSelectors: [".send-btn", ".voice-action-pill.active", ".server-pill.active"]
  },
  {
    id: "serverRail",
    name: "Server Rail",
    description: "Left rail, home pill, and server icons.",
    selectors: [".server-rail", ".rail-header", ".server-pill", ".server-pill-surface"],
    accentSelectors: [".rail-header.active", ".server-pill.active", ".server-pill-ping-badge"]
  },
  {
    id: "sidebar",
    name: "Channel Sidebar",
    description: "Server/channel sidebar and social sidebar surfaces.",
    selectors: [".channel-sidebar", ".sidebar-header", ".sidebar-block", ".social-profile-preview"],
    accentSelectors: [".channel-row.active", ".category-header", ".social-sidebar-head-action"]
  },
  {
    id: "social",
    name: "Social Cards",
    description: "Friends, DM cards, social hub, and profile previews.",
    selectors: [".social-hub-link", ".active-card", ".friend-add-card", ".profile-preview", ".social-profile-preview"],
    accentSelectors: [".social-hub-link.active", ".friend-row button", ".active-card button"]
  },
  {
    id: "chat",
    name: "Chat Surface",
    description: "Chat pane, header, reply bar, and message area frame.",
    selectors: [".chat-main", ".chat-header", ".messages", ".reply-banner", ".pinned-strip", ".voice-widget"],
    accentSelectors: [".chat-header .ghost", ".pinned-item"]
  },
  {
    id: "messages",
    name: "Message Cards",
    description: "Message blocks, embeds, pinned items, and chat content cards.",
    selectors: [".msg", ".message-embed-card", ".message-content-wrap", ".pinned-item"],
    accentSelectors: [".msg p a", ".message-embed-card-btn"]
  },
  {
    id: "composer",
    name: "Composer",
    description: "Text composer, send button, and inline compose tools.",
    selectors: [".composer", ".composer-input-wrap", ".composer textarea", ".composer input"],
    accentSelectors: [".send-btn", ".composer-icon", ".slash-command-item.active"]
  },
  {
    id: "buttons",
    name: "Buttons",
    description: "Primary buttons, icon pills, and action controls.",
    selectors: ["button", ".voice-action-pill", ".icon-btn", ".channel-action-btn"],
    accentSelectors: ["button", ".voice-action-pill", ".icon-btn", ".channel-action-btn"]
  },
  {
    id: "inputs",
    name: "Inputs",
    description: "Inputs, textareas, selects, and editable controls.",
    selectors: [
      "input:not([type=\"color\"]):not([type=\"checkbox\"]):not([type=\"range\"]):not([type=\"file\"])",
      "textarea",
      "select"
    ],
    accentSelectors: ["input:focus", "textarea:focus", "select:focus"]
  },
  {
    id: "settings",
    name: "Settings",
    description: "Settings overlay, panels, and settings cards.",
    selectors: [".settings-overlay", ".settings-panel", ".settings-nav", ".settings-content", ".settings-content .card"],
    accentSelectors: [".settings-nav button.active", ".settings-content button"]
  },
  {
    id: "profileStudio",
    name: "Profile Studio",
    description: "Profile creator canvas and editing side panels.",
    selectors: [".profile-studio-panel", ".profile-studio-canvas-wrap", ".profile-studio-element-frame"],
    accentSelectors: [".profile-studio-panel button", ".profile-studio-element-frame.selected"]
  },
  {
    id: "voice",
    name: "Voice Controls",
    description: "Voice widgets, call stage controls, and live call pills.",
    selectors: [".voice-widget", ".voice-actions-modern", ".voice-action-pill", ".private-call-stage-dock-slot"],
    accentSelectors: [".voice-action-pill.active", ".voice-action-pill.danger"]
  }
];

const targetCollections = [
  { id: "all", name: "Select All", targetIds: elementTargets.map((target) => target.id) },
  { id: "navigation", name: "Navigation", targetIds: ["shell", "serverRail", "sidebar", "social"] },
  { id: "messaging", name: "Messaging", targetIds: ["chat", "messages", "composer"] },
  { id: "overlays", name: "Overlays", targetIds: ["settings", "profileStudio", "voice"] }
];

const DEFAULT_VISUAL = visualPresets[0].values;
const DEFAULT_ELEMENT_STYLE = {
  background1: "#12203a",
  background2: "#0d162a",
  text: "#eef4ff",
  border: "#5f78ac",
  accent: "#72a2ff",
  radius: 16,
  blur: 10,
  shadow: 0.28,
  opacity: 100
};

const META_PREFIX = "/* OpenCom Theme Studio Meta:";
const META_RE = /\/\* OpenCom Theme Studio Meta:([A-Za-z0-9+/=]+) \*\//;
const VISUAL_START = "/* OpenCom Visual Builder Start */";
const VISUAL_END = "/* OpenCom Visual Builder End */";
const ELEMENTS_START = "/* OpenCom Element Builder Start */";
const ELEMENTS_END = "/* OpenCom Element Builder End */";

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function escapeRegexPattern(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeVisualState(values = {}) {
  return {
    bgFrom: String(values.bgFrom || DEFAULT_VISUAL.bgFrom),
    bgTo: String(values.bgTo || DEFAULT_VISUAL.bgTo),
    surface: String(values.surface || DEFAULT_VISUAL.surface),
    text: String(values.text || DEFAULT_VISUAL.text),
    muted: String(values.muted || DEFAULT_VISUAL.muted),
    brand: String(values.brand || DEFAULT_VISUAL.brand),
    radius: clampNumber(values.radius, 4, 32, DEFAULT_VISUAL.radius),
    blur: clampNumber(values.blur, 0, 24, DEFAULT_VISUAL.blur),
    shadow: clampNumber(values.shadow, 0, 0.8, DEFAULT_VISUAL.shadow)
  };
}

function sanitizeElementStyle(style = {}) {
  return {
    background1: String(style.background1 || DEFAULT_ELEMENT_STYLE.background1),
    background2: String(style.background2 || DEFAULT_ELEMENT_STYLE.background2),
    text: String(style.text || DEFAULT_ELEMENT_STYLE.text),
    border: String(style.border || DEFAULT_ELEMENT_STYLE.border),
    accent: String(style.accent || DEFAULT_ELEMENT_STYLE.accent),
    radius: clampNumber(style.radius, 0, 36, DEFAULT_ELEMENT_STYLE.radius),
    blur: clampNumber(style.blur, 0, 24, DEFAULT_ELEMENT_STYLE.blur),
    shadow: clampNumber(style.shadow, 0, 0.7, DEFAULT_ELEMENT_STYLE.shadow),
    opacity: clampNumber(style.opacity, 30, 100, DEFAULT_ELEMENT_STYLE.opacity)
  };
}

function buildManagedBlock(markers, lines) {
  if (!lines.length) return "";
  return [markers[0], ...lines, markers[1]].join("\n");
}

function buildVisualCss(values) {
  const visual = sanitizeVisualState(values);
  const surfaceMix = `color-mix(in srgb, ${visual.surface} 84%, #050b15 16%)`;
  return buildManagedBlock([VISUAL_START, VISUAL_END], [
    "body, .opencom-shell {",
    `  --brand: ${visual.brand};`,
    `  --brand-strong: color-mix(in srgb, ${visual.brand} 72%, #ffffff 28%);`,
    `  --text-main: ${visual.text};`,
    `  --text-soft: color-mix(in srgb, ${visual.text} 78%, ${visual.bgTo} 22%);`,
    `  --text-dim: color-mix(in srgb, ${visual.muted} 82%, ${visual.bgTo} 18%);`,
    `  --bg-app: ${visual.bgFrom};`,
    `  --bg-rail: color-mix(in srgb, ${visual.surface} 70%, #050a13 30%);`,
    `  --bg-sidebar: color-mix(in srgb, ${visual.surface} 82%, ${visual.bgTo} 18%);`,
    `  --bg-chat: color-mix(in srgb, ${visual.surface} 78%, ${visual.bgFrom} 22%);`,
    `  --bg-chat-alt: color-mix(in srgb, ${visual.surface} 90%, #08101d 10%);`,
    `  --bg-elev: ${surfaceMix};`,
    `  --bg-input: color-mix(in srgb, ${visual.surface} 64%, #02070f 36%);`,
    `  --border-subtle: color-mix(in srgb, ${visual.brand} 28%, transparent);`,
    `  --bg-hover: color-mix(in srgb, ${visual.brand} 16%, transparent);`,
    `  --bg-active: color-mix(in srgb, ${visual.brand} 28%, transparent);`,
    `  --radius: ${visual.radius}px;`,
    "}",
    "body {",
    `  background: radial-gradient(1000px 520px at 12% -8%, color-mix(in srgb, ${visual.brand} 26%, transparent), transparent 52%), linear-gradient(155deg, ${visual.bgFrom}, ${visual.bgTo});`,
    "}",
    ".opencom-shell, .landing-page {",
    `  background: radial-gradient(1100px 540px at 10% -12%, color-mix(in srgb, ${visual.brand} 20%, transparent), transparent 48%), linear-gradient(155deg, ${visual.bgFrom}, ${visual.bgTo});`,
    "}",
    ".card, .settings-panel, .message-embed-card, .social-hub-link, .profile-preview, .friend-add-card, .voice-widget, .composer, .chat-header, .theme-studio-card, .theme-studio-shell-preview {",
    "  border-radius: var(--radius);",
    `  backdrop-filter: blur(${visual.blur}px);`,
    `  -webkit-backdrop-filter: blur(${visual.blur}px);`,
    `  box-shadow: 0 18px 40px rgba(4, 8, 18, ${visual.shadow});`,
    "}"
  ]);
}

function buildElementCss(targetStyles = {}) {
  const blocks = [];

  for (const target of elementTargets) {
    const rawStyle = targetStyles[target.id];
    if (!rawStyle) continue;

    const style = sanitizeElementStyle(rawStyle);
    const surface =
      style.background1 === style.background2
        ? style.background1
        : `linear-gradient(165deg, ${style.background1}, ${style.background2})`;

    blocks.push(`${target.selectors.join(", ")} {`);
    blocks.push(`  background: ${surface} !important;`);
    blocks.push(`  color: ${style.text} !important;`);
    blocks.push(`  border-color: ${style.border} !important;`);
    blocks.push(`  border-radius: ${style.radius}px !important;`);
    blocks.push(`  opacity: ${(style.opacity / 100).toFixed(2)} !important;`);
    blocks.push(`  box-shadow: 0 18px 36px rgba(3, 8, 18, ${style.shadow}) !important;`);
    blocks.push(`  --brand: ${style.accent};`);
    blocks.push(`  --brand-strong: color-mix(in srgb, ${style.accent} 72%, #ffffff 28%);`);
    blocks.push(`  --text-main: ${style.text};`);
    blocks.push(`  --text-soft: color-mix(in srgb, ${style.text} 76%, ${style.background2} 24%);`);
    blocks.push(`  --text-dim: color-mix(in srgb, ${style.text} 56%, ${style.background2} 44%);`);
    blocks.push(`  --border-subtle: color-mix(in srgb, ${style.border} 72%, transparent);`);
    blocks.push(`  --bg-hover: color-mix(in srgb, ${style.accent} 18%, transparent);`);
    blocks.push(`  --bg-active: color-mix(in srgb, ${style.accent} 26%, transparent);`);
    blocks.push(`  backdrop-filter: blur(${style.blur}px) !important;`);
    blocks.push(`  -webkit-backdrop-filter: blur(${style.blur}px) !important;`);
    blocks.push("}");

    if (target.accentSelectors?.length) {
      blocks.push(`${target.accentSelectors.join(", ")} {`);
      blocks.push(`  border-color: ${style.accent} !important;`);
      blocks.push(`  accent-color: ${style.accent};`);
      blocks.push("}");
    }
  }

  return buildManagedBlock([ELEMENTS_START, ELEMENTS_END], blocks);
}

function stripManagedSections(cssText = "") {
  return String(cssText || "")
    .replace(META_RE, "")
    .replace(
      new RegExp(
        `${escapeRegexPattern(VISUAL_START)}[\\s\\S]*?${escapeRegexPattern(VISUAL_END)}`,
      ),
      "",
    )
    .replace(
      new RegExp(
        `${escapeRegexPattern(ELEMENTS_START)}[\\s\\S]*?${escapeRegexPattern(ELEMENTS_END)}`,
      ),
      "",
    )
    .trim();
}

function encodeMeta(meta) {
  try {
    return `${META_PREFIX}${btoa(JSON.stringify(meta))} */`;
  } catch {
    return "";
  }
}

function parseMeta(cssText = "") {
  const match = String(cssText || "").match(META_RE);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

function sanitizeTargetStyles(input = {}) {
  const next = {};
  for (const target of elementTargets) {
    if (!input[target.id]) continue;
    next[target.id] = sanitizeElementStyle(input[target.id]);
  }
  return next;
}

function buildCompiledThemeCss({
  visualEnabled,
  visual,
  targetStyles,
  customCss
}) {
  const meta = encodeMeta({
    version: 1,
    visualEnabled: !!visualEnabled,
    visual: sanitizeVisualState(visual),
    targetStyles: sanitizeTargetStyles(targetStyles)
  });
  return [meta, visualEnabled ? buildVisualCss(visual) : "", buildElementCss(targetStyles), stripManagedSections(customCss)]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function hydrateDraftFromCss(cssText = "") {
  const meta = parseMeta(cssText);
  return {
    visualEnabled: !!meta?.visualEnabled || String(cssText || "").includes(VISUAL_START),
    visual: sanitizeVisualState(meta?.visual),
    targetStyles: sanitizeTargetStyles(meta?.targetStyles),
    customCss: stripManagedSections(cssText)
  };
}

function applyThemeLocally(cssText, setThemeCss, setThemeEnabled) {
  if (!String(cssText || "").trim()) {
    throw new Error("EMPTY_THEME_CSS");
  }
  if (typeof setThemeCss === "function") {
    setThemeCss(cssText);
    if (typeof setThemeEnabled === "function") setThemeEnabled(true);
    return;
  }
  installThemeLocally(cssText);
}

function ThemeCard({
  theme,
  busyThemeId,
  onInstall,
  onCopy,
  onRemix
}) {
  return (
    <article className="theme-studio-theme-card">
      <div className="theme-studio-theme-top">
        <div>
          <h3>{theme.name}</h3>
          <span>By {theme.authorUsername || "unknown"}</span>
        </div>
        <small>#{String(theme.id || "").slice(0, 8)}</small>
      </div>
      <p>{theme.description || "No description provided."}</p>
      <div className="theme-studio-chip-row">
        {(theme.tags || []).map((tag) => (
          <span key={`${theme.id}-${tag}`} className="theme-studio-chip">
            {tag}
          </span>
        ))}
      </div>
      <div className="theme-studio-theme-meta">
        <span>{theme.installCount || 0} installs</span>
        <span>{theme.visibility || "public"}</span>
      </div>
      <div className="theme-studio-inline-actions">
        <button
          type="button"
          onClick={() => onInstall(theme.id)}
          disabled={busyThemeId === theme.id}
        >
          {busyThemeId === theme.id ? "Installing..." : "Install"}
        </button>
        <button type="button" className="ghost" onClick={() => onRemix(theme.id)}>
          Remix
        </button>
        <button type="button" className="ghost" onClick={() => onCopy(theme.id)}>
          Copy ID
        </button>
      </div>
    </article>
  );
}

export function ThemeStudioApp({
  defaultTab = "catalog",
  activeTab: controlledTab,
  onTabChange,
  standalone = false,
  themeCss = "",
  setThemeCss,
  setThemeEnabled
}) {
  const [internalTab, setInternalTab] = useState(defaultTab);
  const activeTab = controlledTab || internalTab;
  const [catalogThemes, setCatalogThemes] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSort, setCatalogSort] = useState("new");
  const [catalogStatus, setCatalogStatus] = useState("Loading themes...");
  const [busyThemeId, setBusyThemeId] = useState("");

  const [myThemes, setMyThemes] = useState([]);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [customCss, setCustomCss] = useState("");
  const [creatorStatus, setCreatorStatus] = useState("Load a theme or start a new draft.");
  const [creatorBusy, setCreatorBusy] = useState(false);
  const [visualEnabled, setVisualEnabled] = useState(false);
  const [visual, setVisual] = useState(DEFAULT_VISUAL);
  const [targetQuery, setTargetQuery] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [activeTargetId, setActiveTargetId] = useState(elementTargets[0].id);
  const [targetStyles, setTargetStyles] = useState({});
  const [editorStyle, setEditorStyle] = useState(DEFAULT_ELEMENT_STYLE);

  const selectedTheme = useMemo(
    () => myThemes.find((theme) => theme.id === selectedThemeId) || null,
    [myThemes, selectedThemeId]
  );

  const filteredCatalogThemes = useMemo(() => {
    const term = catalogQuery.trim().toLowerCase();
    if (!term) return catalogThemes;
    return catalogThemes.filter((theme) => {
      const haystack = `${theme.name || ""} ${theme.description || ""} ${(theme.tags || []).join(" ")}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [catalogThemes, catalogQuery]);

  const filteredTargets = useMemo(() => {
    const term = targetQuery.trim().toLowerCase();
    if (!term) return elementTargets;
    return elementTargets.filter((target) => {
      const haystack = `${target.name} ${target.description}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [targetQuery]);

  const compiledCss = useMemo(
    () =>
      buildCompiledThemeCss({
        visualEnabled,
        visual,
        targetStyles,
        customCss
      }),
    [customCss, targetStyles, visual, visualEnabled]
  );

  const styledTargetCount = Object.keys(targetStyles).length;
  const activeTarget = elementTargets.find((target) => target.id === activeTargetId) || elementTargets[0];
  const applyTargetIds = selectedTargetIds.length ? selectedTargetIds : [activeTarget.id];

  function changeTab(nextTab) {
    setInternalTab(nextTab);
    if (typeof onTabChange === "function") onTabChange(nextTab);
  }

  async function loadCatalogue() {
    try {
      setCatalogStatus("Loading themes...");
      const params = new URLSearchParams();
      params.set("sort", catalogSort);
      params.set("limit", "80");
      const data = await coreApi(`/v1/themes?${params.toString()}`);
      const themes = Array.isArray(data?.themes) ? data.themes : [];
      setCatalogThemes(themes);
      setCatalogStatus(`Loaded ${themes.length} theme(s).`);
    } catch (error) {
      setCatalogStatus(`Could not load themes: ${error.message}`);
    }
  }

  async function loadMine() {
    try {
      const data = await coreApi("/v1/me/themes");
      const themes = Array.isArray(data?.themes) ? data.themes : [];
      setMyThemes(themes);
      setCreatorStatus(`Loaded ${themes.length} theme draft(s).`);
    } catch (error) {
      setCreatorStatus(`Could not load your themes: ${error.message}.`);
    }
  }

  function loadDraft(theme, { duplicate = false } = {}) {
    const draft = hydrateDraftFromCss(theme?.css || "");
    setSelectedThemeId(duplicate ? "" : theme?.id || "");
    setName(
      duplicate
        ? `${theme?.name || "Imported"} Remix`
        : String(theme?.name || "")
    );
    setDescription(String(theme?.description || ""));
    setTags(Array.isArray(theme?.tags) ? theme.tags.join(", ") : "");
    setVisibility(duplicate ? "private" : String(theme?.visibility || "private"));
    setCustomCss(draft.customCss);
    setVisualEnabled(draft.visualEnabled);
    setVisual(draft.visual);
    setTargetStyles(draft.targetStyles);
    setSelectedTargetIds([]);
    const firstStyledTarget = Object.keys(draft.targetStyles)[0];
    setActiveTargetId(firstStyledTarget || elementTargets[0].id);
    setEditorStyle(
      sanitizeElementStyle(
        draft.targetStyles[firstStyledTarget || elementTargets[0].id]
      )
    );
    setCreatorStatus(
      duplicate
        ? `Remixing "${theme?.name || "theme"}".`
        : `Loaded "${theme?.name || "theme"}".`
    );
    changeTab("creator");
  }

  function resetDraft() {
    setSelectedThemeId("");
    setName("");
    setDescription("");
    setTags("");
    setVisibility("private");
    setCustomCss("");
    setVisualEnabled(false);
    setVisual(DEFAULT_VISUAL);
    setTargetStyles({});
    setSelectedTargetIds([]);
    setActiveTargetId(elementTargets[0].id);
    setEditorStyle(DEFAULT_ELEMENT_STYLE);
    setCreatorStatus("New theme draft ready.");
  }

  function toggleTargetSelection(targetId) {
    setSelectedTargetIds((current) =>
      current.includes(targetId)
        ? current.filter((id) => id !== targetId)
        : [...current, targetId]
    );
  }

  function selectTargetCollection(targetIds) {
    setSelectedTargetIds(targetIds);
    setActiveTargetId(targetIds[0] || elementTargets[0].id);
    setCreatorStatus(`Selected ${targetIds.length} interface areas.`);
  }

  function applyEditorToTargets() {
    const nextStyle = sanitizeElementStyle(editorStyle);
    setTargetStyles((current) => {
      const next = { ...current };
      for (const targetId of applyTargetIds) {
        next[targetId] = nextStyle;
      }
      return next;
    });
    setCreatorStatus(
      `Applied styling to ${applyTargetIds.length} interface area${applyTargetIds.length === 1 ? "" : "s"}.`
    );
  }

  function clearSelectedTargetStyles() {
    setTargetStyles((current) => {
      const next = { ...current };
      for (const targetId of applyTargetIds) delete next[targetId];
      return next;
    });
    setCreatorStatus(
      `Cleared custom styling for ${applyTargetIds.length} interface area${applyTargetIds.length === 1 ? "" : "s"}.`
    );
  }

  function applyVisualPreset(presetId) {
    const preset = visualPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setVisualEnabled(true);
    setVisual(sanitizeVisualState(preset.values));
    setCreatorStatus(`Preset applied: ${preset.name}.`);
  }

  function applyStarterTemplate(templateId) {
    const template = starterTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setCustomCss((current) =>
      current.trim() ? `${current.trim()}\n\n${template.css}` : template.css
    );
    if (!name.trim()) setName(template.name);
    setCreatorStatus(`Inserted starter snippet: ${template.name}.`);
  }

  async function installTheme(themeId) {
    if (!themeId) return;
    try {
      setBusyThemeId(themeId);
      const data = await coreApi(`/v1/themes/${encodeURIComponent(themeId)}`);
      const css = data?.theme?.css || "";
      applyThemeLocally(css, setThemeCss, setThemeEnabled);
      await coreApi(`/v1/themes/${encodeURIComponent(themeId)}/install`, {
        method: "POST"
      }).catch(() => {});
      setCatalogStatus(`Installed "${data?.theme?.name || "theme"}".`);
    } catch (error) {
      setCatalogStatus(`Install failed: ${error.message}`);
    } finally {
      setBusyThemeId("");
    }
  }

  async function remixTheme(themeId) {
    if (!themeId) return;
    try {
      const data = await coreApi(`/v1/themes/${encodeURIComponent(themeId)}`);
      if (!data?.theme?.css) throw new Error("EMPTY_THEME_CSS");
      loadDraft(data.theme, { duplicate: true });
    } catch (error) {
      setCatalogStatus(`Could not remix theme: ${error.message}`);
    }
  }

  async function previewDraftTheme() {
    try {
      applyThemeLocally(compiledCss, setThemeCss, setThemeEnabled);
      setCreatorStatus(`Previewing "${name.trim() || "untitled theme"}" in OpenCom.`);
    } catch (error) {
      setCreatorStatus(`Preview failed: ${error.message}`);
    }
  }

  async function saveTheme() {
    if (!name.trim()) {
      setCreatorStatus("Theme name is required.");
      return;
    }
    if (!compiledCss.trim()) {
      setCreatorStatus("Add CSS, a visual foundation, or interface element styling before saving.");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      css: compiledCss,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      visibility
    };

    try {
      setCreatorBusy(true);
      if (selectedThemeId) {
        await coreApi(`/v1/themes/${encodeURIComponent(selectedThemeId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setCreatorStatus(`Updated "${name.trim()}".`);
      } else {
        const data = await coreApi("/v1/themes", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setSelectedThemeId(data?.themeId || "");
        setCreatorStatus(`Created "${name.trim()}".`);
      }
      await loadMine();
    } catch (error) {
      setCreatorStatus(`Save failed: ${error.message}`);
    } finally {
      setCreatorBusy(false);
    }
  }

  async function copyCompiledCss() {
    try {
      await navigator.clipboard.writeText(compiledCss);
      setCreatorStatus("Copied compiled theme CSS.");
    } catch {
      setCreatorStatus("Could not copy compiled CSS.");
    }
  }

  async function copyThemeId(themeId) {
    try {
      await navigator.clipboard.writeText(themeId);
      setCatalogStatus(`Copied theme id ${themeId}.`);
    } catch {
      setCatalogStatus("Could not copy theme id.");
    }
  }

  function importCurrentTheme() {
    if (!String(themeCss || "").trim()) {
      setCreatorStatus("There is no active local theme loaded right now.");
      return;
    }
    loadDraft(
      {
        id: "",
        name: "Current local theme",
        description: "Imported from the current local app theme.",
        tags: [],
        visibility: "private",
        css: themeCss
      },
      { duplicate: true }
    );
  }

  useEffect(() => {
    loadCatalogue().catch(() => {});
  }, [catalogSort]);

  useEffect(() => {
    if (activeTab !== "creator") return;
    loadMine().catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (!selectedTheme) return;
    loadDraft(selectedTheme);
  }, [selectedTheme?.id]);

  useEffect(() => {
    setEditorStyle(
      sanitizeElementStyle(targetStyles[activeTargetId] || DEFAULT_ELEMENT_STYLE)
    );
  }, [activeTargetId, targetStyles]);

  useEffect(() => {
    if (!standalone || typeof document === "undefined") return undefined;
    document.body.classList.add("theme-studio-body");
    return () => document.body.classList.remove("theme-studio-body");
  }, [standalone]);

  return (
    <div className={`theme-studio-page ${standalone ? "theme-studio-standalone" : "theme-studio-embedded"}`}>
      <header className="theme-studio-hero">
        <div className="theme-studio-hero-copy">
          <span className="theme-studio-eyebrow">Theme Studio</span>
          <h1>Open the catalogue, then shape every part of the interface.</h1>
          <p>
            Browse public themes, remix them into your own draft, and customise
            individual OpenCom surfaces or whole groups in one place.
          </p>
        </div>
        <div className="theme-studio-hero-panel theme-studio-shell-preview">
          <span className="theme-studio-panel-kicker">Live workflow</span>
          <strong>Catalogue first, creator second.</strong>
          <p>
            Install a theme instantly, or jump into the creator to style the app
            shell, chat, buttons, voice controls, settings, and more.
          </p>
          <div className="theme-studio-inline-actions">
            <button type="button" onClick={() => changeTab("catalog")}>
              Browse Themes
            </button>
            <button type="button" className="ghost" onClick={() => changeTab("creator")}>
              Open Creator
            </button>
          </div>
        </div>
      </header>

      <div className="theme-studio-tabbar">
        <button
          type="button"
          className={activeTab === "catalog" ? "active" : ""}
          onClick={() => changeTab("catalog")}
        >
          Theme Catalogue
        </button>
        <button
          type="button"
          className={activeTab === "creator" ? "active" : ""}
          onClick={() => changeTab("creator")}
        >
          Theme Creator
        </button>
      </div>

      {activeTab === "catalog" ? (
        <section className="theme-studio-stack">
          <section className="theme-studio-card theme-studio-toolbar">
            <label>
              Search
              <input
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Search by name, description, or tags..."
              />
            </label>
            <label>
              Sort
              <select
                value={catalogSort}
                onChange={(event) => setCatalogSort(event.target.value)}
              >
                <option value="new">Newest</option>
                <option value="popular">Most Installed</option>
              </select>
            </label>
            <div className="theme-studio-inline-actions">
              <button type="button" className="ghost" onClick={() => changeTab("creator")}>
                Go To Creator
              </button>
              <button type="button" onClick={() => loadCatalogue().catch(() => {})}>
                Refresh
              </button>
            </div>
          </section>

          <p className="theme-studio-status">{catalogStatus}</p>

          <section className="theme-studio-grid">
            {filteredCatalogThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                busyThemeId={busyThemeId}
                onInstall={installTheme}
                onCopy={copyThemeId}
                onRemix={remixTheme}
              />
            ))}
          </section>

          {!filteredCatalogThemes.length && (
            <section className="theme-studio-card theme-studio-empty">
              <h3>No themes matched that search.</h3>
              <p>Try a different tag, or open the creator and build your own.</p>
            </section>
          )}
        </section>
      ) : (
        <section className="theme-creator-layout">
          <aside className="theme-creator-sidebar">
            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Your Themes</h3>
                  <p>Saved drafts and published themes.</p>
                </div>
                <button type="button" className="ghost" onClick={loadMine}>
                  Reload
                </button>
              </div>
              <div className="theme-studio-inline-actions">
                <button type="button" onClick={resetDraft}>
                  + New Theme
                </button>
                <button type="button" className="ghost" onClick={importCurrentTheme}>
                  Import Live Theme
                </button>
              </div>
              <div className="theme-studio-list">
                {myThemes.map((theme) => (
                  <button
                    type="button"
                    key={theme.id}
                    className={`theme-studio-list-item ${selectedThemeId === theme.id ? "active" : ""}`}
                    onClick={() => setSelectedThemeId(theme.id)}
                  >
                    <strong>{theme.name}</strong>
                    <span>{theme.visibility}</span>
                  </button>
                ))}
                {!myThemes.length && (
                  <p className="theme-studio-muted">No saved theme drafts yet.</p>
                )}
              </div>
            </section>

            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Starter Snippets</h3>
                  <p>Quick building blocks for your CSS.</p>
                </div>
              </div>
              <div className="theme-studio-list">
                {starterTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="ghost theme-studio-fill-button"
                    onClick={() => applyStarterTemplate(template.id)}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Mass Select</h3>
                  <p>Grab whole clusters of interface elements at once.</p>
                </div>
              </div>
              <div className="theme-studio-preset-grid">
                {targetCollections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    className="ghost"
                    onClick={() => selectTargetCollection(collection.targetIds)}
                  >
                    {collection.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setSelectedTargetIds([])}
                >
                  Clear Selection
                </button>
              </div>
            </section>
          </aside>

          <div className="theme-creator-main">
            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Theme Details</h3>
                  <p>Name it, tag it, and decide whether it stays private or goes public.</p>
                </div>
              </div>
              <div className="theme-studio-form-grid">
                <label>
                  Theme Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="My clean midnight theme"
                  />
                </label>
                <label>
                  Visibility
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value)}
                  >
                    <option value="private">Private draft</option>
                    <option value="public">Public in catalogue</option>
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short summary for the catalogue..."
                />
              </label>
              <label>
                Tags
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="dark, glass, minimal, creator"
                />
              </label>
            </section>

            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Visual Foundation</h3>
                  <p>
                    Set the global palette and shared radius/blur behaviour that the
                    app falls back to.
                  </p>
                </div>
                <label className="theme-studio-toggle">
                  <input
                    type="checkbox"
                    checked={visualEnabled}
                    onChange={(event) => setVisualEnabled(event.target.checked)}
                  />
                  <span>Enable visual foundation</span>
                </label>
              </div>

              <div className="theme-studio-preset-grid">
                {visualPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="ghost"
                    onClick={() => applyVisualPreset(preset.id)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="theme-studio-form-grid">
                <label>
                  Gradient Start
                  <input
                    type="color"
                    value={visual.bgFrom}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, bgFrom: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Gradient End
                  <input
                    type="color"
                    value={visual.bgTo}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, bgTo: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Surface
                  <input
                    type="color"
                    value={visual.surface}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, surface: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Text
                  <input
                    type="color"
                    value={visual.text}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, text: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Muted Text
                  <input
                    type="color"
                    value={visual.muted}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, muted: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Brand
                  <input
                    type="color"
                    value={visual.brand}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({ ...current, brand: event.target.value }));
                    }}
                  />
                </label>
                <label>
                  Radius ({visual.radius}px)
                  <input
                    type="range"
                    min="4"
                    max="32"
                    value={visual.radius}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({
                        ...current,
                        radius: Number(event.target.value)
                      }));
                    }}
                  />
                </label>
                <label>
                  Blur ({visual.blur}px)
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={visual.blur}
                    onChange={(event) => {
                      setVisualEnabled(true);
                      setVisual((current) => ({
                        ...current,
                        blur: Number(event.target.value)
                      }));
                    }}
                  />
                </label>
              </div>

              <label>
                Shadow Strength ({visual.shadow.toFixed(2)})
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.01"
                  value={visual.shadow}
                  onChange={(event) => {
                    setVisualEnabled(true);
                    setVisual((current) => ({
                      ...current,
                      shadow: Number(event.target.value)
                    }));
                  }}
                />
              </label>

              <div
                className="theme-studio-visual-preview"
                style={{
                  background: `linear-gradient(155deg, ${visual.bgFrom}, ${visual.bgTo})`
                }}
              >
                <div
                  className="theme-studio-preview-card"
                  style={{
                    color: visual.text,
                    background: visual.surface,
                    borderRadius: `${visual.radius}px`
                  }}
                >
                  <strong>Live Preview</strong>
                  <p style={{ color: visual.muted }}>
                    The shared visual foundation updates the whole app before
                    per-element overrides layer on top.
                  </p>
                  <button
                    type="button"
                    style={{ background: visual.brand, borderColor: visual.brand }}
                  >
                    Accent Action
                  </button>
                </div>
              </div>
            </section>

            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Element Designer</h3>
                  <p>
                    Customise individual interface zones or multi-select a batch and
                    push one style payload across all of them.
                  </p>
                </div>
                <span className="theme-studio-badge">
                  {selectedTargetIds.length
                    ? `${selectedTargetIds.length} selected`
                    : "Editing active target"}
                </span>
              </div>

              <div className="theme-studio-toolbar theme-studio-target-toolbar">
                <label>
                  Find Interface Elements
                  <input
                    value={targetQuery}
                    onChange={(event) => setTargetQuery(event.target.value)}
                    placeholder="Search chat, buttons, sidebar..."
                  />
                </label>
                <div className="theme-studio-inline-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => selectTargetCollection(elementTargets.map((target) => target.id))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setSelectedTargetIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="theme-studio-target-grid">
                {filteredTargets.map((target) => {
                  const isSelected = selectedTargetIds.includes(target.id);
                  const targetStyle = sanitizeElementStyle(
                    targetStyles[target.id] || DEFAULT_ELEMENT_STYLE
                  );
                  return (
                    <div
                      key={target.id}
                      className={`theme-studio-target-card ${activeTargetId === target.id ? "active" : ""} ${isSelected ? "selected" : ""}`}
                      onClick={() => setActiveTargetId(target.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveTargetId(target.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      style={{
                        borderColor: targetStyle.border,
                        background: `linear-gradient(155deg, ${targetStyle.background1}, ${targetStyle.background2})`,
                        color: targetStyle.text
                      }}
                    >
                      <span className="theme-studio-target-check">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleTargetSelection(target.id);
                          }}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </span>
                      <strong>{target.name}</strong>
                      <small>{target.description}</small>
                    </div>
                  );
                })}
              </div>

              <div className="theme-studio-editor-grid">
                <div className="theme-studio-editor-controls">
                  <div className="theme-studio-section-head">
                    <div>
                      <h4>{activeTarget.name}</h4>
                      <p>
                        {selectedTargetIds.length
                          ? `Changes will apply to ${selectedTargetIds.length} selected areas.`
                          : "Changes will apply to the active area only."}
                      </p>
                    </div>
                  </div>

                  <div className="theme-studio-form-grid">
                    <label>
                      Surface
                      <input
                        type="color"
                        value={editorStyle.background1}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            background1: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Surface Alt
                      <input
                        type="color"
                        value={editorStyle.background2}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            background2: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Text
                      <input
                        type="color"
                        value={editorStyle.text}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            text: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Border
                      <input
                        type="color"
                        value={editorStyle.border}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            border: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Accent
                      <input
                        type="color"
                        value={editorStyle.accent}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            accent: event.target.value
                          }))
                        }
                      />
                    </label>
                    <label>
                      Radius ({editorStyle.radius}px)
                      <input
                        type="range"
                        min="0"
                        max="36"
                        value={editorStyle.radius}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            radius: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      Blur ({editorStyle.blur}px)
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={editorStyle.blur}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            blur: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                    <label>
                      Opacity ({editorStyle.opacity}%)
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={editorStyle.opacity}
                        onChange={(event) =>
                          setEditorStyle((current) => ({
                            ...current,
                            opacity: Number(event.target.value)
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Shadow ({editorStyle.shadow.toFixed(2)})
                    <input
                      type="range"
                      min="0"
                      max="0.7"
                      step="0.01"
                      value={editorStyle.shadow}
                      onChange={(event) =>
                        setEditorStyle((current) => ({
                          ...current,
                          shadow: Number(event.target.value)
                        }))
                      }
                    />
                  </label>

                  <div className="theme-studio-inline-actions">
                    <button type="button" onClick={applyEditorToTargets}>
                      Apply To {applyTargetIds.length === 1 ? "Area" : `${applyTargetIds.length} Areas`}
                    </button>
                    <button type="button" className="ghost" onClick={clearSelectedTargetStyles}>
                      Clear Custom Style
                    </button>
                  </div>
                </div>

                <div className="theme-studio-target-preview">
                  <div
                    className="theme-studio-target-sample"
                    style={{
                      color: editorStyle.text,
                      background: `linear-gradient(155deg, ${editorStyle.background1}, ${editorStyle.background2})`,
                      borderColor: editorStyle.border,
                      borderRadius: `${editorStyle.radius}px`,
                      boxShadow: `0 18px 36px rgba(3, 8, 18, ${editorStyle.shadow})`,
                      opacity: editorStyle.opacity / 100
                    }}
                  >
                    <span className="theme-studio-panel-kicker">Target Sample</span>
                    <strong>{activeTarget.name}</strong>
                    <p>{activeTarget.description}</p>
                    <button
                      type="button"
                      style={{
                        background: editorStyle.accent,
                        borderColor: editorStyle.accent
                      }}
                    >
                      Accent Preview
                    </button>
                  </div>
                  <div className="theme-studio-target-summary">
                    <strong>{styledTargetCount} customised areas</strong>
                    <span>
                      Save the theme to persist every target override, or preview it
                      in the app immediately.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="theme-studio-card">
              <div className="theme-studio-section-head">
                <div>
                  <h3>Advanced CSS</h3>
                  <p>
                    Extra CSS here is appended after the managed builder blocks so you
                    can keep hand-written overrides too.
                  </p>
                </div>
              </div>

              <label>
                Advanced CSS Additions
                <textarea
                  rows={12}
                  value={customCss}
                  onChange={(event) => setCustomCss(event.target.value)}
                  placeholder="Paste manual CSS overrides here..."
                />
              </label>

              <details className="theme-studio-details">
                <summary>Preview compiled theme CSS</summary>
                <textarea rows={12} value={compiledCss} readOnly />
              </details>

              <div className="theme-studio-inline-actions">
                <button type="button" onClick={saveTheme} disabled={creatorBusy}>
                  {creatorBusy ? "Saving..." : "Save Theme"}
                </button>
                <button type="button" className="ghost" onClick={previewDraftTheme}>
                  Preview In App
                </button>
                <button type="button" className="ghost" onClick={copyCompiledCss}>
                  Copy CSS
                </button>
              </div>

              <p className="theme-studio-status">{creatorStatus}</p>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
