const $ = (id) => document.getElementById(id);

const scanButton = $("scanButton");
const pickButton = $("pickButton");
const clearSelectionButton = $("clearSelectionButton");
const downloadElementorButton = $("downloadElementorButton");
const downloadReportButton = $("downloadReportButton");
const copyButton = $("copyButton");
const output = $("output");
const treeView = $("treeView");
const tabTree = $("tabTree");
const tabJson = $("tabJson");
const message = $("message");
const statusBadge = $("statusBadge");
const scopeValue = $("scopeValue");
const siteInfo = $("siteInfo");
const totalNodes = $("totalNodes");
const widgetCount = $("widgetCount");
const imageCount = $("imageCount");
const linkCount = $("linkCount");

let lastResult = null;
let lastDisplayedJson = "";
let currentSelection = null;

// ---------- i18n ----------

const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

const applyI18n = () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.documentElement.dir = chrome.i18n.getMessage("@@bidi_dir") || "ltr";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
};

const formatter = new Intl.NumberFormat(chrome.i18n.getUILanguage());

const roleLabel = (role) => {
  const known = { section: "elTypeSection", column: "elTypeColumn", container: "elTypeContainer", widget: "elTypeWidget" };
  return known[role] ? t(known[role]) : role;
};

// ---------- sensitive data removal ----------

const REDACTED = "[redacted]";
const SENSITIVE_KEY = /nonce|token|secret|passw|api[_-]?key|csrf|signature|session|(^|[_-])auth($|[_-])/i;
const SENSITIVE_URL_PARAM =
  /([?&](?:amp;)?[\w-]*(?:nonce|token|secret|api[_-]?key|csrf|signature|session|auth)[\w-]*=)[^&#"'\s<>]+/gi;

// Deep-copies `value`, replacing values under sensitive keys and sensitive URL
// query parameters (e.g. ?_wpnonce=...) with a placeholder.
const sanitize = (value, counter, forced = false) => {
  if (typeof value === "string") {
    if (forced && value) {
      counter.count += 1;
      return REDACTED;
    }
    return value.replace(SENSITIVE_URL_PARAM, (_, prefix) => {
      counter.count += 1;
      return prefix + REDACTED;
    });
  }
  if (typeof value === "number" && forced) {
    counter.count += 1;
    return REDACTED;
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, counter, forced));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitize(item, counter, forced || SENSITIVE_KEY.test(key))]),
    );
  }
  return value;
};

// ---------- UI helpers ----------

const setMessage = (text, type = "") => {
  message.textContent = text;
  message.className = `message ${type}`.trim();
  message.hidden = !text;
};

const setStatus = (key, type = "") => {
  statusBadge.textContent = t(key);
  statusBadge.className = `badge ${type}`.trim();
};

const setBusy = (busy) => {
  scanButton.disabled = busy;
  pickButton.disabled = busy;
  scanButton.textContent = busy ? t("btnScanning") : t(currentSelection ? "btnScanSelection" : "btnScanPage");
};

const renderScope = () => {
  if (currentSelection) {
    const parts = [roleLabel(currentSelection.role), currentSelection.widgetType, currentSelection.id && `#${currentSelection.id}`];
    scopeValue.textContent = t("scopeSelection", [parts.filter(Boolean).join(" · ")]);
    scopeValue.title = currentSelection.preview || "";
    clearSelectionButton.hidden = false;
  } else {
    scopeValue.textContent = t("scopePage");
    scopeValue.title = "";
    clearSelectionButton.hidden = true;
  }
  scanButton.textContent = t(currentSelection ? "btnScanSelection" : "btnScanPage");
};

const setStat = (element, value) => {
  element.textContent = formatter.format(value || 0);
};

const resetStats = () => [totalNodes, widgetCount, imageCount, linkCount].forEach((element) => setStat(element, 0));

const updateStats = (result) => {
  const widgets = Object.values(result.summary.widgetTypes || {}).reduce((sum, count) => sum + count, 0);
  setStat(totalNodes, result.summary.totalElementorNodes);
  setStat(widgetCount, widgets);
  setStat(imageCount, result.summary.images);
  setStat(linkCount, result.summary.links);
};

const showTab = (tab) => {
  const isTree = tab === "tree";
  tabTree.classList.toggle("active", isTree);
  tabJson.classList.toggle("active", !isTree);
  tabTree.setAttribute("aria-selected", String(isTree));
  tabJson.setAttribute("aria-selected", String(!isTree));
  treeView.hidden = !isTree;
  output.hidden = isTree;
};

// ---------- structure preview ----------

const MAX_TREE_NODES = 400;

const nodeSummary = (node) => {
  const settings = Array.isArray(node.settings) ? {} : node.settings || {};
  const raw =
    settings.title ||
    settings.text ||
    settings.alert_title ||
    settings.testimonial_content ||
    settings.editor ||
    settings.html ||
    settings.image?.url?.split("/").pop() ||
    settings.youtube_url ||
    settings.vimeo_url ||
    "";
  const plain = String(raw).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 60 ? `${plain.slice(0, 60)}…` : plain;
};

const renderTree = (content) => {
  treeView.replaceChildren();

  if (!content?.length) {
    const empty = document.createElement("p");
    empty.className = "tree-empty";
    empty.textContent = t("treeEmpty");
    treeView.append(empty);
    return;
  }

  let rendered = 0;
  let skipped = 0;

  const buildList = (nodes, depth) => {
    const list = document.createElement("ul");

    for (const node of nodes) {
      if (rendered >= MAX_TREE_NODES) {
        skipped += 1;
        continue;
      }
      rendered += 1;

      const item = document.createElement("li");
      const line = document.createElement("span");
      line.className = "tree-line";

      const tag = document.createElement("span");
      tag.className = `tree-tag ${node.elType}`;
      tag.textContent = node.elType === "widget" ? node.widgetType : roleLabel(node.elType);
      line.append(tag);

      const summary = nodeSummary(node);
      if (summary) {
        const text = document.createElement("span");
        text.className = "tree-text";
        text.textContent = summary;
        line.append(text);
      }

      if (node.elements?.length) {
        const details = document.createElement("details");
        details.open = depth < 2;
        const summaryElement = document.createElement("summary");
        summaryElement.append(line);
        details.append(summaryElement, buildList(node.elements, depth + 1));
        item.append(details);
      } else {
        item.append(line);
      }

      list.append(item);
    }

    return list;
  };

  treeView.append(buildList(content, 0));

  if (skipped) {
    const more = document.createElement("p");
    more.className = "tree-empty";
    more.textContent = t("treeMore", [formatter.format(skipped)]);
    treeView.append(more);
  }
};

// ---------- tab access ----------

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) throw new Error(t("errNoTab"));
  if (!/^https?:\/\//i.test(tab.url || "")) throw new Error(t("errNotHttp"));

  return tab;
};

const runInTab = async (tabId, options) => {
  const [execution] = await chrome.scripting.executeScript({ target: { tabId }, ...options });
  return execution?.result;
};

// The only code that runs in the page's own JS context: it reads Elementor's
// config globals and returns them as JSON strings. Everything else runs in the
// extension's isolated world.
const readPageGlobals = (keys) => {
  const values = {};
  for (const key of keys) {
    try {
      if (window[key] !== undefined) values[key] = JSON.stringify(window[key]);
    } catch {
      values[key] = JSON.stringify("[unserializable]");
    }
  }
  return values;
};

const ELEMENTOR_GLOBALS = [
  "elementorFrontendConfig",
  "elementorModules",
  "ElementorProFrontendConfig",
  "elementorCommonConfig",
];

const readElementorConfig = async (tabId) => {
  try {
    const raw = (await runInTab(tabId, { func: readPageGlobals, args: [ELEMENTOR_GLOBALS], world: "MAIN" })) || {};
    return Object.fromEntries(
      Object.entries(raw)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => {
          try {
            return [key, JSON.parse(value)];
          } catch {
            return [key, "[unserializable]"];
          }
        }),
    );
  } catch {
    return {};
  }
};

const scanTab = async (tabId, useSelection) => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["scanner.js"] });

  const result = await runInTab(tabId, {
    func: (selectionWanted) =>
      window.__elementorExtractor.run({ root: selectionWanted ? window.__eePicker?.selected : null }),
    args: [useSelection],
  });

  if (result) result.elementorConfig = await readElementorConfig(tabId);
  return result;
};

const loadSelection = async () => {
  try {
    const tab = await getActiveTab();
    currentSelection = await runInTab(tab.id, { func: () => window.__eePicker?.getSelection?.() ?? null });
  } catch {
    currentSelection = null;
  }
  renderScope();
};

// ---------- actions ----------

const scanCurrentPage = async () => {
  setBusy(true);
  setMessage("");
  setStatus("statusScanning", "warning");

  try {
    const tab = await getActiveTab();
    const rawResult = await scanTab(tab.id, Boolean(currentSelection));

    if (!rawResult) throw new Error(t("errNoResult"));

    const counter = { count: 0 };
    const result = sanitize(rawResult, counter);

    lastResult = result;
    lastDisplayedJson = JSON.stringify(result.importTemplate, null, 2);
    output.value = lastDisplayedJson;
    renderTree(result.importTemplate.content);
    updateStats(result);
    downloadElementorButton.disabled = false;
    downloadReportButton.disabled = false;
    copyButton.disabled = false;
    siteInfo.textContent = result.page.title || result.page.url;

    const notes = [];
    if (result.scope.selectionLost) {
      currentSelection = null;
      renderScope();
      notes.push(t("msgSelectionGone"));
    }

    if (result.elementor.detected) {
      setStatus("statusSuccess", "success");
      notes.unshift(t("msgSuccess"));
    } else {
      setStatus("statusNotFound", "warning");
      notes.unshift(t("msgNotDetected"));
    }
    if (counter.count) notes.push(t("msgRedacted", [formatter.format(counter.count)]));

    setMessage(notes.join(" "), result.elementor.detected ? "success" : "");
  } catch (error) {
    lastResult = null;
    lastDisplayedJson = "";
    output.value = "";
    renderTree([]);
    resetStats();
    downloadElementorButton.disabled = true;
    downloadReportButton.disabled = true;
    copyButton.disabled = true;
    siteInfo.textContent = t("scanFailed");
    setStatus("statusError", "error");
    setMessage(error.message || t("errUnknown"), "error");
  } finally {
    setBusy(false);
  }
};

const startPicker = async () => {
  try {
    const tab = await getActiveTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["picker.js"] });
    await runInTab(tab.id, { func: () => window.__eePicker.start() });
    // Close the popup so the user can click on the page right away.
    window.close();
  } catch (error) {
    setStatus("statusError", "error");
    setMessage(error.message || t("errUnknown"), "error");
  }
};

const clearSelection = async () => {
  try {
    const tab = await getActiveTab();
    await runInTab(tab.id, { func: () => window.__eePicker?.clear?.() });
  } catch {
    // Nothing to clear.
  }
  currentSelection = null;
  renderScope();
};

const safeFileName = (result, prefix) => {
  const host = new URL(result.page.url).hostname.replace(/[^\w.-]+/g, "-");
  const date = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${host}-${date}.json`;
};

const downloadJson = (payload, filename) => {
  if (!payload) return;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
};

const downloadElementorTemplate = () => {
  if (!lastResult) return;
  downloadJson(lastResult.importTemplate, safeFileName(lastResult, "elementor-import-template"));
};

const downloadReport = () => {
  if (!lastResult) return;
  downloadJson(lastResult, safeFileName(lastResult, "elementor-extract-report"));
};

const copyResult = async () => {
  if (!lastDisplayedJson) return;
  await navigator.clipboard.writeText(lastDisplayedJson);
  setMessage(t("msgCopied"), "success");
};

scanButton.addEventListener("click", scanCurrentPage);
pickButton.addEventListener("click", startPicker);
clearSelectionButton.addEventListener("click", clearSelection);
downloadElementorButton.addEventListener("click", downloadElementorTemplate);
downloadReportButton.addEventListener("click", downloadReport);
copyButton.addEventListener("click", copyResult);
tabTree.addEventListener("click", () => showTab("tree"));
tabJson.addEventListener("click", () => showTab("json"));

applyI18n();
resetStats();
renderScope();
loadSelection();
