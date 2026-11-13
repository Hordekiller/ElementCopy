const scanButton = document.getElementById("scanButton");
const downloadElementorButton = document.getElementById("downloadElementorButton");
const downloadReportButton = document.getElementById("downloadReportButton");
const copyButton = document.getElementById("copyButton");
const output = document.getElementById("output");
const message = document.getElementById("message");
const statusBadge = document.getElementById("statusBadge");
const siteInfo = document.getElementById("siteInfo");
const totalNodes = document.getElementById("totalNodes");
const widgetCount = document.getElementById("widgetCount");
const imageCount = document.getElementById("imageCount");
const linkCount = document.getElementById("linkCount");

let lastResult = null;
let lastDisplayedJson = "";

const formatter = new Intl.NumberFormat("fa-IR");

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

const setMessage = (text, type = "") => {
  message.textContent = text;
  message.className = `message ${type}`.trim();
  message.hidden = !text;
};

const setStatus = (text, type = "") => {
  statusBadge.textContent = text;
  statusBadge.className = `badge ${type}`.trim();
};

const setBusy = (busy) => {
  scanButton.disabled = busy;
  scanButton.textContent = busy ? "در حال اسکن..." : "اسکن صفحه فعلی";
};

const resetStats = () => {
  totalNodes.textContent = "۰";
  widgetCount.textContent = "۰";
  imageCount.textContent = "۰";
  linkCount.textContent = "۰";
};

const updateStats = (result) => {
  const widgets = Object.values(result.summary.widgetTypes || {}).reduce((sum, count) => sum + count, 0);
  totalNodes.textContent = formatter.format(result.summary.totalElementorNodes || 0);
  widgetCount.textContent = formatter.format(widgets);
  imageCount.textContent = formatter.format(result.summary.images || 0);
  linkCount.textContent = formatter.format(result.summary.links || 0);
};

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab?.id) {
    throw new Error("تب فعالی پیدا نشد.");
  }

  if (!/^https?:\/\//i.test(tab.url || "")) {
    throw new Error("این اکستنشن فقط روی صفحات http و https اجرا می‌شود.");
  }

  return tab;
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
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readPageGlobals,
      args: [ELEMENTOR_GLOBALS],
      world: "MAIN",
    });
    const raw = execution?.result || {};
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

const injectScanner = async (tabId) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scanner.js"],
  });

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__elementorExtractor.run(),
  });

  const result = execution?.result;
  if (result) result.elementorConfig = await readElementorConfig(tabId);
  return result;
};

const scanCurrentPage = async () => {
  setBusy(true);
  setMessage("");
  setStatus("اسکن", "warning");

  try {
    const tab = await getActiveTab();
    const rawResult = await injectScanner(tab.id);

    if (!rawResult) {
      throw new Error("خروجی اسکن دریافت نشد.");
    }

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

    if (result.elementor.detected) {
      setStatus("موفق", "success");
      setMessage("فایل قابل درون‌ریزی المنتور ساخته شد. برای آرشیو کامل، گزارش را جدا دانلود کنید.", "success");
    } else {
      setStatus("یافت نشد", "warning");
      setMessage("نشانه قطعی از المنتور پیدا نشد؛ یک قالب ساده از DOM ساخته شد، اما ممکن است نیاز به ویرایش داشته باشد.");
    }

    if (counter.count) {
      message.textContent += ` ${formatter.format(counter.count)} داده حساس (nonce/توکن) حذف شد.`;
    }
  } catch (error) {
    lastResult = null;
    lastDisplayedJson = "";
    output.value = "";
    resetStats();
    downloadElementorButton.disabled = true;
    downloadReportButton.disabled = true;
    copyButton.disabled = true;
    siteInfo.textContent = "اسکن ناموفق";
    setStatus("خطا", "error");
    setMessage(error.message || "خطای ناشناخته هنگام اسکن صفحه رخ داد.", "error");
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

  chrome.downloads.download(
    {
      url,
      filename,
      saveAs: true,
    },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  );
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
  setMessage("JSON قابل درون‌ریزی المنتور کپی شد.", "success");
};

scanButton.addEventListener("click", scanCurrentPage);
downloadElementorButton.addEventListener("click", downloadElementorTemplate);
downloadReportButton.addEventListener("click", downloadReport);
copyButton.addEventListener("click", copyResult);

resetStats();
