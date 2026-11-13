// Section picker. Injected into the active tab (isolated world) when the user
// clicks "Select section" in the popup. The chosen element is kept in this
// isolated world so scanner.js can use it as the scan root later.
(() => {
  if (window.__eePicker) return;

  const CANDIDATE_SELECTOR =
    ".elementor-section, .e-con, .elementor-column, .elementor-widget, [data-element_type], [data-widget_type]";
  const t = (key) => chrome.i18n.getMessage(key) || key;

  const getRole = (element) => {
    const elementType = element.getAttribute("data-element_type");
    if (elementType) return elementType.replace(/\..*$/, "");
    if (element.classList.contains("elementor-widget")) return "widget";
    if (element.classList.contains("elementor-column")) return "column";
    if (element.classList.contains("elementor-section")) return "section";
    if (element.classList.contains("e-con")) return "container";
    return "html";
  };

  const getWidgetType = (element) =>
    (element.getAttribute("data-widget_type") || "").replace(/\..*$/, "") ||
    ([...element.classList].find((name) => name.startsWith("elementor-widget-")) || "").replace(
      "elementor-widget-",
      "",
    );

  const describe = (element) => ({
    role: getRole(element),
    widgetType: getWidgetType(element),
    id: element.getAttribute("data-id") || element.id || "",
    tag: element.tagName.toLowerCase(),
    preview: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60),
  });

  const findCandidate = (element) => {
    if (!element || element === document.body || element === document.documentElement) return null;
    return element.closest(CANDIDATE_SELECTOR) || element;
  };

  const findParentCandidate = (element) => findCandidate(element?.parentElement);

  // ---- overlay (in a closed shadow root so page CSS can't affect it) ----
  let host = null;
  let box = null;
  let label = null;
  let hint = null;

  const createOverlay = () => {
    host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483647;margin:0;padding:0;border:0;";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .box { position: fixed; border: 2px solid #92003b; background: rgba(146,0,59,.12);
               border-radius: 4px; transition: all 60ms ease; display: none; }
        .label, .hint, .toast { position: fixed; font: 600 12px/1.4 system-ui, sans-serif;
               color: #fff; background: #92003b; border-radius: 6px; padding: 4px 8px; white-space: nowrap; }
        .label { display: none; }
        .hint { left: 50%; bottom: 16px; transform: translateX(-50%); background: #1f1620;
               padding: 8px 14px; font-size: 13px; }
        .toast { left: 50%; bottom: 16px; transform: translateX(-50%); padding: 10px 16px; font-size: 13px; }
      </style>
      <div class="box"></div><div class="label"></div><div class="hint"></div>`;
    box = shadow.querySelector(".box");
    label = shadow.querySelector(".label");
    hint = shadow.querySelector(".hint");
    hint.textContent = t("pickerHint");
    document.documentElement.appendChild(host);
  };

  const showToast = (message) => {
    const toastHost = document.createElement("div");
    toastHost.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const shadow = toastHost.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>.toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);
      font:600 13px/1.4 system-ui,sans-serif;color:#fff;background:#15803d;border-radius:6px;
      padding:10px 16px;max-width:90vw;text-align:center}</style><div class="toast"></div>`;
    shadow.querySelector(".toast").textContent = message;
    document.documentElement.appendChild(toastHost);
    setTimeout(() => toastHost.remove(), 4000);
  };

  // ---- picking state ----
  let current = null;
  const childStack = [];

  const draw = () => {
    if (!box) return;
    if (!current || !current.isConnected) {
      box.style.display = "none";
      label.style.display = "none";
      return;
    }
    const rect = current.getBoundingClientRect();
    Object.assign(box.style, {
      display: "block",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const info = describe(current);
    label.textContent = [info.role, info.widgetType, info.id && `#${info.id}`].filter(Boolean).join(" · ");
    label.style.display = "block";
    label.style.top = `${Math.max(4, rect.top - 26)}px`;
    label.style.left = `${Math.max(4, rect.left)}px`;
  };

  const setCurrent = (element) => {
    current = element;
    draw();
  };

  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const onMove = (event) => {
    const candidate = findCandidate(event.target);
    if (candidate && candidate !== current && !childStack.includes(candidate)) {
      childStack.length = 0;
      setCurrent(candidate);
    }
  };

  const onKey = (event) => {
    if (event.key === "Escape") {
      swallow(event);
      stop();
      showToast(t("pickerCancelled"));
    } else if (event.key === "ArrowUp" && current) {
      swallow(event);
      const parent = findParentCandidate(current);
      if (parent) {
        childStack.push(current);
        setCurrent(parent);
      }
    } else if (event.key === "ArrowDown" && childStack.length) {
      swallow(event);
      setCurrent(childStack.pop());
    } else if (event.key === "Enter" && current) {
      swallow(event);
      select(current);
    }
  };

  const onClick = (event) => {
    swallow(event);
    const target = current || findCandidate(event.target);
    if (target) select(target);
  };

  const onRedraw = () => requestAnimationFrame(draw);

  const BLOCKED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "auxclick", "dblclick"];

  const start = () => {
    if (state.active) return;
    state.active = true;
    createOverlay();
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onRedraw, true);
    window.addEventListener("resize", onRedraw, true);
    BLOCKED_EVENTS.forEach((type) => window.addEventListener(type, swallow, true));
  };

  const stop = () => {
    if (!state.active) return;
    state.active = false;
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onRedraw, true);
    window.removeEventListener("resize", onRedraw, true);
    BLOCKED_EVENTS.forEach((type) => window.removeEventListener(type, swallow, true));
    host?.remove();
    host = box = label = hint = null;
    current = null;
    childStack.length = 0;
  };

  const select = (element) => {
    state.selected = element;
    stop();
    showToast(t("pickerSaved"));
  };

  const state = {
    active: false,
    selected: null,
    start,
    stop,
    clear: () => {
      state.selected = null;
    },
    getSelection: () =>
      state.selected && state.selected.isConnected ? describe(state.selected) : null,
  };

  window.__eePicker = state;
})();
