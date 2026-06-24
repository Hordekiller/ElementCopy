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

const injectScanner = async (tabId) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scanner.js"],
    world: "MAIN",
  });

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__elementorExtractor.run(),
    world: "MAIN",
  });

  return execution?.result;
};

const scanCurrentPage = async () => {
  setBusy(true);
  setMessage("");
  setStatus("اسکن", "warning");

  try {
    const tab = await getActiveTab();
    const result = await injectScanner(tab.id);

    if (!result) {
      throw new Error("خروجی اسکن دریافت نشد.");
    }

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
