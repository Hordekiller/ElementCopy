const $ = (id) => document.getElementById(id);

const scanButton = $("scanButton");
const downloadElementorButton = $("downloadElementorButton");
const downloadReportButton = $("downloadReportButton");
const copyButton = $("copyButton");
const output = $("output");
const message = $("message");
const statusBadge = $("statusBadge");
const siteInfo = $("siteInfo");
const totalNodes = $("totalNodes");
const widgetCount = $("widgetCount");
const imageCount = $("imageCount");
const linkCount = $("linkCount");

let lastResult = null;
let lastDisplayedJson = "";

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
  scanButton.textContent = busy ? t("btnScanning") : t("btnScanPage");
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

const scanTab = async (tabId) => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["scanner.js"] });

  const result = await runInTab(tabId, { func: () => window.__elementorExtractor.run() });

  if (result) result.elementorConfig = await readElementorConfig(tabId);
  return result;
};

// ---------- actions ----------

const scanCurrentPage = async () => {
  setBusy(true);
  setMessage("");
  setStatus("statusScanning", "warning");

  try {
    const tab = await getActiveTab();
    const rawResult = await scanTab(tab.id);

    if (!rawResult) throw new Error(t("errNoResult"));

    const counter = { count: 0 };
    const result = sanitize(rawResult, counter);

    lastResult = result;
    lastDisplayedJson = JSON.stringify(result.importTemplate, null, 2);
    output.value = lastDisplayedJson;
    updateStats(result);
    downloadElementorButton.disabled = false;
    downloadReportButton.disabled = false;
    copyButton.disabled = false;
    siteInfo.textContent = result.page.title || result.page.url;

    const notes = [];
    if (result.elementor.detected) {
      setStatus("statusSuccess", "success");
      notes.push(t("msgSuccess"));
    } else {
      setStatus("statusNotFound", "warning");
      notes.push(t("msgNotDetected"));
    }
    if (counter.count) notes.push(t("msgRedacted", [formatter.format(counter.count)]));

    setMessage(notes.join(" "), result.elementor.detected ? "success" : "");
  } catch (error) {
    lastResult = null;
    lastDisplayedJson = "";
    output.value = "";
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
downloadElementorButton.addEventListener("click", downloadElementorTemplate);
downloadReportButton.addEventListener("click", downloadReport);
copyButton.addEventListener("click", copyResult);

applyI18n();
resetStats();
