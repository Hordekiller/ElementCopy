(() => {
  const EXTRACTOR_KEY = "__elementorExtractor";

  const unique = (items) => [...new Set(items.filter(Boolean))];

  const toArray = (value) => Array.from(value || []);

  const text = (element, limit = 180) => {
    const value = (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
  };

  const attr = (element, name) => element?.getAttribute?.(name) || "";

  const classes = (element) => toArray(element?.classList);

  const getSelector = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
    if (element.id) return `#${CSS.escape(element.id)}`;

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 5) {
      let selector = current.nodeName.toLowerCase();
      const classNames = classes(current)
        .filter((className) => /^elementor-|^e-|^jet-|^uael-|^premium-|^swiper/.test(className))
        .slice(0, 3);

      if (classNames.length) {
        selector += `.${classNames.map((className) => CSS.escape(className)).join(".")}`;
      } else if (current.parentElement) {
        const siblings = [...current.parentElement.children].filter(
          (sibling) => sibling.nodeName === current.nodeName,
        );
        if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(" > ");
  };

  const getElementRole = (element) => {
    const elementType = attr(element, "data-element_type");
    if (elementType) return elementType;
    if (element.classList.contains("elementor-widget")) return "widget";
    if (element.classList.contains("elementor-section")) return "section";
    if (element.classList.contains("elementor-column")) return "column";
    if (element.classList.contains("e-con")) return "container";
    if (element.classList.contains("elementor-inner-section")) return "inner-section";
    if (element.classList.contains("elementor")) return "root";
    return "unknown";
  };

  const getWidgetType = (element) => {
    const dataWidget = attr(element, "data-widget_type");
    if (dataWidget) return dataWidget.replace(/\..*$/, "");

    const className = classes(element).find((item) => item.startsWith("elementor-widget-"));
    return className ? className.replace("elementor-widget-", "") : "";
  };

  const getBackgroundImages = (element) => {
    const urls = [];
    const inlineStyle = attr(element, "style");
    const computedBackground = getComputedStyle(element).backgroundImage;
    const combined = `${inlineStyle} ${computedBackground}`;
    const matches = combined.matchAll(/url\(["']?([^"')]+)["']?\)/g);

    for (const match of matches) {
      try {
        urls.push(new URL(match[1], location.href).href);
      } catch {
        urls.push(match[1]);
      }
    }

    return unique(urls);
  };

  const getResponsiveSettings = (element) => {
    const result = {};
    const responsiveClasses = classes(element).filter(
      (className) =>
        className.includes("-hide-") ||
        className.includes("-hidden-") ||
        className.includes("-tablet") ||
        className.includes("-mobile") ||
        className.includes("-desktop"),
    );

    if (responsiveClasses.length) result.classes = responsiveClasses;
    if (attr(element, "data-settings")) {
      try {
        const settings = JSON.parse(attr(element, "data-settings"));
        result.dataSettings = settings;
      } catch {
        result.dataSettingsRaw = attr(element, "data-settings");
      }
    }

    return result;
  };

  const extractLinks = (root = document) =>
    toArray(root.querySelectorAll("a[href]")).map((link) => ({
      text: text(link, 120),
      href: link.href,
      target: attr(link, "target"),
      rel: attr(link, "rel"),
      classes: classes(link),
      selector: getSelector(link),
    }));

  const extractImages = (root = document) =>
    toArray(root.querySelectorAll("img, picture source[srcset]")).map((image) => ({
      tag: image.tagName.toLowerCase(),
      src: image.currentSrc || image.src || attr(image, "src") || "",
      srcset: attr(image, "srcset"),
      alt: attr(image, "alt"),
      title: attr(image, "title"),
      width: attr(image, "width") || image.naturalWidth || "",
      height: attr(image, "height") || image.naturalHeight || "",
      loading: attr(image, "loading"),
      classes: classes(image),
      selector: getSelector(image),
    }));

  const extractForms = (root = document) =>
    toArray(root.querySelectorAll("form")).map((form) => ({
      action: form.action || attr(form, "action"),
      method: (attr(form, "method") || "get").toUpperCase(),
      name: attr(form, "name"),
      id: form.id,
      classes: classes(form),
      selector: getSelector(form),
      fields: toArray(form.querySelectorAll("input, textarea, select, button")).map((field) => ({
        tag: field.tagName.toLowerCase(),
        type: attr(field, "type"),
        name: attr(field, "name"),
        id: field.id,
        placeholder: attr(field, "placeholder"),
        required: Boolean(field.required || attr(field, "aria-required") === "true"),
        label:
          field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`)
            ? text(document.querySelector(`label[for="${CSS.escape(field.id)}"]`), 80)
            : "",
      })),
    }));

  const extractVideos = (root = document) =>
    toArray(root.querySelectorAll("video, iframe, embed")).map((video) => ({
      tag: video.tagName.toLowerCase(),
      src: video.currentSrc || video.src || attr(video, "src") || "",
      title: attr(video, "title"),
      width: attr(video, "width"),
      height: attr(video, "height"),
      classes: classes(video),
      selector: getSelector(video),
    }));

  const extractCssVariables = () => {
    const styles = getComputedStyle(document.documentElement);
    return toArray(styles)
      .filter((name) => name.startsWith("--e-") || name.startsWith("--elementor-"))
      .reduce((variables, name) => {
        variables[name] = styles.getPropertyValue(name).trim();
        return variables;
      }, {});
  };

  const extractGlobalAssets = () => ({
    stylesheets: toArray(document.querySelectorAll('link[rel~="stylesheet"][href]')).map((link) => ({
      href: link.href,
      id: link.id,
      media: attr(link, "media"),
      elementorRelated: /elementor|e-icons|frontend|widget|global/i.test(link.href + link.id),
    })),
    scripts: toArray(document.querySelectorAll("script[src]")).map((script) => ({
      src: script.src,
      id: script.id,
      type: attr(script, "type"),
      elementorRelated: /elementor|element-pack|frontend|webpack|widget|swiper/i.test(
        script.src + script.id,
      ),
    })),
    cssVariables: extractCssVariables(),
  });

  const extractElementorConfig = () => {
    const config = {};
    const globals = [
      "elementorFrontendConfig",
      "elementorModules",
      "ElementorProFrontendConfig",
      "elementorCommonConfig",
    ];

    for (const key of globals) {
      if (window[key]) {
        try {
          config[key] = JSON.parse(JSON.stringify(window[key]));
        } catch {
          config[key] = "[unserializable]";
        }
      }
    }

    return config;
  };

  const readJsonAttribute = (element, name) => {
    const value = attr(element, name);
    if (!value) return {};

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const hashString = (value) => {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 7);
  };

  const compactSettings = (settings) => {
    const cleanSettings = Object.entries(settings || {}).reduce((result, [key, value]) => {
      if (value !== undefined && value !== null && value !== "") result[key] = value;
      return result;
    }, {});

    return Object.keys(cleanSettings).length ? cleanSettings : [];
  };

  const getCustomClasses = (element) => {
    const internalPattern =
      /^(elementor|e-|ui-|swiper|slick|animated|jet-|uael|premium-|wpr-|bdt-|has-|wp-|attachment-|size-)/;

    return classes(element)
      .filter((className) => !internalPattern.test(className))
      .filter((className) => !/^(active|loaded|current|open|closed|visible|hidden)$/.test(className))
      .slice(0, 24);
  };

  const getCommonImportSettings = (element) => {
    const settings = { ...readJsonAttribute(element, "data-settings") };
    const customClasses = getCustomClasses(element);
    const backgroundImage = getBackgroundImages(element)[0];

    if (customClasses.length) settings._css_classes = customClasses.join(" ");
    if (backgroundImage) {
      settings.background_background = settings.background_background || "classic";
      settings.background_image = settings.background_image || {
        url: backgroundImage,
        id: "",
        size: "",
        alt: "",
        source: "library",
      };
    }

    return settings;
  };

  const cleanHtml = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    template.content.querySelectorAll("script, noscript, style, link, meta").forEach((element) => {
      element.remove();
    });

    return template.innerHTML.trim();
  };

  const getWidgetContainer = (element) =>
    element.querySelector(":scope > .elementor-widget-container") ||
    element.querySelector(".elementor-widget-container") ||
    element;

  const getWidgetHtml = (element) => cleanHtml(getWidgetContainer(element).innerHTML);

  const getLinkControl = (link) => ({
    url: link?.href || "",
    is_external: attr(link, "target") === "_blank",
    nofollow: attr(link, "rel").split(/\s+/).includes("nofollow"),
  });

  const getMediaControl = (url, alt = "") => ({
    url: url || "",
    id: "",
    size: "",
    alt,
    source: "library",
  });

  const getImportElementType = (element) => {
    const elementType = attr(element, "data-element_type");

    if (attr(element, "data-widget_type") || element.classList.contains("elementor-widget")) return "widget";
    if (elementType === "column" || element.classList.contains("elementor-column")) return "column";
    if (elementType === "section" || element.classList.contains("elementor-section")) return "section";
    if (elementType === "container" || element.classList.contains("e-con")) return "container";
    return "";
  };

  const isImportableElement = (element) =>
    Boolean(
      element?.matches?.(
        ".elementor-element, .elementor-section, .elementor-column, .elementor-widget, .e-con, [data-element_type], [data-widget_type]",
      ) && getImportElementType(element),
    );

  const getDirectImportChildren = (root) => {
    const found = [];

    const visit = (parent) => {
      for (const child of toArray(parent.children)) {
        if (isImportableElement(child)) {
          found.push(child);
        } else {
          visit(child);
        }
      }
    };

    visit(root);
    return unique(found);
  };

  const getTopLevelImportElements = () => {
    const rootCandidates = toArray(document.querySelectorAll("[data-elementor-type], .elementor"));
    const roots = rootCandidates.filter(
      (root) => !rootCandidates.some((other) => other !== root && other.contains(root)),
    );
    const rootChildren = unique(roots.flatMap(getDirectImportChildren));

    if (rootChildren.length) return rootChildren;

    const allImportableElements = toArray(
      document.querySelectorAll(
        ".elementor-element, .elementor-section, .elementor-column, .elementor-widget, .e-con, [data-element_type], [data-widget_type]",
      ),
    ).filter(isImportableElement);

    return allImportableElements.filter(
      (element) => !allImportableElements.some((other) => other !== element && other.contains(element)),
    );
  };

  const inferWidgetType = (element) => {
    if (element.querySelector(".elementor-heading-title, h1, h2, h3, h4, h5, h6")) return "heading";
    if (element.querySelector(".elementor-button, a[href]")) return "button";
    if (element.querySelector("img, picture source[srcset]")) return "image";
    if (element.querySelector("video, iframe")) return "video";
    if (element.querySelector("form")) return "html";
    return "html";
  };

  const getImportWidgetType = (element) => {
    const rawWidgetType = getWidgetType(element);
    const aliases = {
      "theme-post-title": "heading",
      "theme-site-title": "heading",
      "theme-page-title": "heading",
      "theme-post-content": "text-editor",
      form: "html",
      "nav-menu": "html",
      "woocommerce-menu-cart": "html",
      "woocommerce-products": "html",
      "loop-grid": "html",
      "posts": "html",
    };
    const supportedWidgets = new Set([
      "accordion",
      "alert",
      "audio",
      "button",
      "counter",
      "divider",
      "google_maps",
      "heading",
      "html",
      "icon",
      "icon-box",
      "icon-list",
      "image",
      "image-box",
      "image-carousel",
      "menu-anchor",
      "progress",
      "shortcode",
      "social-icons",
      "spacer",
      "star-rating",
      "tabs",
      "testimonial",
      "text-editor",
      "toggle",
      "video",
    ]);

    if (aliases[rawWidgetType]) return aliases[rawWidgetType];
    if (supportedWidgets.has(rawWidgetType)) return rawWidgetType;
    return inferWidgetType(element);
  };

  const getRepeaterTabs = (element) => {
    const titles = toArray(element.querySelectorAll(".elementor-tab-title"));
    const contents = toArray(element.querySelectorAll(".elementor-tab-content"));

    return titles.map((title, index) => ({
      tab_title: text(title, 120) || `Tab ${index + 1}`,
      tab_content: cleanHtml(contents[index]?.innerHTML || ""),
    }));
  };

  const getWidgetImportSettings = (element, widgetType) => {
    const link = element.querySelector("a[href]");
    const image = element.querySelector("img");
    const iframeOrVideo = element.querySelector("iframe, video, embed");
    const html = getWidgetHtml(element);

    switch (widgetType) {
      case "heading": {
        const heading = element.querySelector(".elementor-heading-title, h1, h2, h3, h4, h5, h6");
        const tagName = heading?.tagName?.toLowerCase();

        return {
          title: text(heading || element, 500) || "Heading",
          header_size: /^h[1-6]$/.test(tagName || "") ? tagName : "h2",
        };
      }
      case "text-editor":
        return {
          editor: html || `<p>${text(element, 1000)}</p>`,
        };
      case "image":
        return {
          image: getMediaControl(image?.currentSrc || image?.src || "", attr(image, "alt")),
          image_size: "full",
          caption_source: "none",
        };
      case "image-carousel":
        return {
          carousel: extractImages(element).map((item) => getMediaControl(item.src, item.alt)),
          slides_to_show: "3",
          navigation: "both",
        };
      case "button":
        return {
          text:
            text(element.querySelector(".elementor-button-text") || link || element, 200) ||
            attr(link, "aria-label") ||
            "Click Here",
          link: getLinkControl(link),
        };
      case "video": {
        const source = iframeOrVideo?.currentSrc || iframeOrVideo?.src || attr(iframeOrVideo, "src");
        const isYoutube = /youtube\.com|youtu\.be/i.test(source);
        const isVimeo = /vimeo\.com/i.test(source);

        if (isYoutube) return { video_type: "youtube", youtube_url: source };
        if (isVimeo) return { video_type: "vimeo", vimeo_url: source };
        return { video_type: "hosted", hosted_url: { url: source || "" } };
      }
      case "spacer": {
        const height = Number.parseInt(getComputedStyle(element).height, 10);
        return {
          space: {
            unit: "px",
            size: Number.isFinite(height) && height > 0 ? height : 50,
            sizes: [],
          },
        };
      }
      case "divider":
        return { style: "solid" };
      case "icon-list": {
        const items = toArray(element.querySelectorAll("li")).map((item) => {
          const itemLink = item.querySelector("a[href]");
          return {
            text: text(item.querySelector(".elementor-icon-list-text") || item, 160),
            link: getLinkControl(itemLink),
            selected_icon: { value: "fas fa-check", library: "fa-solid" },
          };
        });

        return {
          icon_list: items.length
            ? items
            : [
                {
                  text: text(element, 160),
                  link: getLinkControl(link),
                  selected_icon: { value: "fas fa-check", library: "fa-solid" },
                },
              ],
        };
      }
      case "tabs":
      case "accordion":
      case "toggle": {
        const tabs = getRepeaterTabs(element);
        return {
          tabs: tabs.length ? tabs : [{ tab_title: text(element, 80) || "Item", tab_content: html }],
        };
      }
      case "google_maps":
        return {
          address: iframeOrVideo?.src || text(element, 200),
        };
      case "alert":
        return {
          alert_type: "info",
          alert_title: text(element.querySelector(".elementor-alert-title") || element, 120),
          alert_description: text(element.querySelector(".elementor-alert-description") || element, 500),
        };
      case "counter":
        return {
          ending_number: text(element.querySelector(".elementor-counter-number") || element, 40) || "100",
          title: text(element.querySelector(".elementor-counter-title") || element, 120),
        };
      case "progress":
        return {
          title: text(element.querySelector(".elementor-title") || element, 120),
          percent: Number.parseInt(text(element.querySelector(".elementor-progress-percentage") || element, 20), 10) || 50,
        };
      case "testimonial":
        return {
          testimonial_content: text(element.querySelector(".elementor-testimonial-content") || element, 500),
          testimonial_name: text(element.querySelector(".elementor-testimonial-name") || element, 120),
          testimonial_job: text(element.querySelector(".elementor-testimonial-job") || element, 120),
          testimonial_image: getMediaControl(image?.currentSrc || image?.src || "", attr(image, "alt")),
        };
      case "shortcode":
        return {
          shortcode: text(element, 500),
        };
      case "html":
      default:
        return {
          html: html || text(element, 1000),
        };
    }
  };

  const buildElementorTemplate = () => {
    const usedIds = new Set();

    const makeIdFromValue = (value) => {
      let id = hashString(value);
      let attempt = 1;

      while (usedIds.has(id)) {
        id = hashString(`${value}:${attempt}`);
        attempt += 1;
      }

      usedIds.add(id);
      return id;
    };

    const makeId = (element, fallback) => {
      const dataId = attr(element, "data-id").replace(/[^a-fA-F0-9]/g, "").slice(0, 7).toLowerCase();

      if (dataId && !usedIds.has(dataId)) {
        usedIds.add(dataId);
        return dataId;
      }

      return makeIdFromValue(`${fallback}:${getSelector(element)}:${text(element, 160)}`);
    };

    const createVirtualColumn = (children, source) => ({
      id: makeIdFromValue(`column:${source}`),
      elType: "column",
      isInner: false,
      settings: {
        _column_size: 100,
        _inline_size: null,
      },
      elements: children,
    });

    const createVirtualSection = (children, source) => ({
      id: makeIdFromValue(`section:${source}`),
      elType: "section",
      isInner: false,
      settings: [],
      elements: children.every((child) => child.elType === "column")
        ? children
        : [createVirtualColumn(children, `${source}:column`)],
    });

    const buildNode = (element, depth = 0) => {
      const elType = getImportElementType(element);
      if (!elType) return null;

      const id = makeId(element, `${elType}:${depth}`);

      if (elType === "widget") {
        const widgetType = getImportWidgetType(element);
        const settings = {
          ...getCommonImportSettings(element),
          ...getWidgetImportSettings(element, widgetType),
        };

        return {
          id,
          elType: "widget",
          widgetType,
          isInner: false,
          settings: compactSettings(settings),
          elements: [],
        };
      }

      let children = getDirectImportChildren(element)
        .map((child) => buildNode(child, depth + 1))
        .filter(Boolean);
      const settings = getCommonImportSettings(element);

      if (elType === "column") {
        const siblingColumns = element.parentElement
          ? getDirectImportChildren(element.parentElement).filter((child) => getImportElementType(child) === "column")
          : [];

        if (!settings._column_size) {
          settings._column_size = siblingColumns.length ? Math.round(100 / siblingColumns.length) : 100;
        }
        if (!("_inline_size" in settings)) settings._inline_size = null;
      }

      if (elType === "section") {
        const columns = children.filter((child) => child.elType === "column");
        const nonColumns = children.filter((child) => child.elType !== "column");
        children = nonColumns.length ? [...columns, createVirtualColumn(nonColumns, `${id}:orphans`)] : columns;
      }

      return {
        id,
        elType,
        isInner: elType === "section" && depth > 0,
        settings: compactSettings(settings),
        elements: children,
      };
    };

    const normalizeTopLevelContent = (nodes) => {
      const content = [];
      let orphanNodes = [];

      const flushOrphans = () => {
        if (!orphanNodes.length) return;
        content.push(createVirtualSection(orphanNodes, `top:${content.length}`));
        orphanNodes = [];
      };

      for (const node of nodes) {
        if (node.elType === "section" || node.elType === "container") {
          flushOrphans();
          content.push(node);
        } else {
          orphanNodes.push(node);
        }
      }

      flushOrphans();
      return content;
    };

    const nodes = getTopLevelImportElements()
      .map((element) => buildNode(element))
      .filter(Boolean);
    const content = normalizeTopLevelContent(nodes);

    return {
      title: (document.title || new URL(location.href).hostname || "Imported Elementor Template").slice(0, 120),
      type: "page",
      version: "0.4",
      page_settings: [],
      content,
    };
  };

  const extractElementorElements = () => {
    const selector = [
      ".elementor",
      ".elementor-element",
      ".elementor-section",
      ".elementor-column",
      ".elementor-widget",
      ".elementor-inner-section",
      ".e-con",
      ".e-con-inner",
      "[data-element_type]",
      "[data-widget_type]",
      "[data-id]",
      "[data-model-cid]",
    ].join(",");

    return unique(toArray(document.querySelectorAll(selector))).map((element, index) => {
      const role = getElementRole(element);
      const widgetType = getWidgetType(element);
      const childWidgets = toArray(element.querySelectorAll(":scope .elementor-widget")).map(getWidgetType);
      const rootLinks = extractLinks(element);
      const rootImages = extractImages(element);

      return {
        index,
        tag: element.tagName.toLowerCase(),
        role,
        widgetType,
        elementId: attr(element, "data-id") || element.id,
        modelCid: attr(element, "data-model-cid"),
        elementType: attr(element, "data-element_type"),
        widgetRawType: attr(element, "data-widget_type"),
        classes: classes(element),
        selector: getSelector(element),
        textPreview: text(element),
        responsive: getResponsiveSettings(element),
        backgroundImages: getBackgroundImages(element),
        childElementorCount: element.querySelectorAll(".elementor-element, .e-con").length,
        childWidgetTypes: unique(childWidgets),
        links: rootLinks.slice(0, 20),
        images: rootImages.slice(0, 20),
      };
    });
  };

  const extractTemplates = () =>
    toArray(document.querySelectorAll("[data-elementor-type], .elementor-location-header, .elementor-location-footer"))
      .map((template) => ({
        type:
          attr(template, "data-elementor-type") ||
          classes(template).find((className) => className.startsWith("elementor-location-")) ||
          "",
        id: attr(template, "data-elementor-id") || template.id,
        classes: classes(template),
        selector: getSelector(template),
      }));

  const detectElementor = () => {
    const html = document.documentElement.outerHTML.slice(0, 250000);
    return {
      detected:
        Boolean(document.querySelector(".elementor, .elementor-element, [data-elementor-type]")) ||
        /elementor/i.test(html),
      domMarkers: {
        root: document.querySelectorAll(".elementor").length,
        elements: document.querySelectorAll(".elementor-element").length,
        widgets: document.querySelectorAll(".elementor-widget").length,
        containers: document.querySelectorAll(".e-con").length,
        sections: document.querySelectorAll(".elementor-section").length,
        columns: document.querySelectorAll(".elementor-column").length,
      },
      bodyClasses: classes(document.body).filter((className) => /elementor|element-pack|hello-/.test(className)),
      generator:
        document.querySelector('meta[name="generator"]')?.content ||
        document.querySelector('meta[property="generator"]')?.content ||
        "",
    };
  };

  const summarize = (elements, links, images, forms, videos, assets) => {
    const widgetTypes = elements.map((element) => element.widgetType).filter(Boolean);
    const roles = elements.map((element) => element.role).filter(Boolean);

    return {
      totalElementorNodes: elements.length,
      roles: roles.reduce((summary, role) => {
        summary[role] = (summary[role] || 0) + 1;
        return summary;
      }, {}),
      widgetTypes: widgetTypes.reduce((summary, widgetType) => {
        summary[widgetType] = (summary[widgetType] || 0) + 1;
        return summary;
      }, {}),
      links: links.length,
      images: images.length,
      forms: forms.length,
      videos: videos.length,
      elementorStylesheets: assets.stylesheets.filter((asset) => asset.elementorRelated).length,
      elementorScripts: assets.scripts.filter((asset) => asset.elementorRelated).length,
    };
  };

  const run = () => {
    const elements = extractElementorElements();
    const links = extractLinks();
    const images = extractImages();
    const forms = extractForms();
    const videos = extractVideos();
    const templates = extractTemplates();
    const assets = extractGlobalAssets();
    const elementor = detectElementor();
    const importTemplate = buildElementorTemplate();

    return {
      schemaVersion: "1.0.0",
      extractedAt: new Date().toISOString(),
      page: {
        url: location.href,
        origin: location.origin,
        title: document.title,
        language: document.documentElement.lang || "",
        charset: document.characterSet,
      },
      elementor,
      summary: summarize(elements, links, images, forms, videos, assets),
      templates,
      elements,
      links,
      images,
      forms,
      videos,
      assets,
      elementorConfig: extractElementorConfig(),
      importTemplate,
    };
  };

  window[EXTRACTOR_KEY] = { run };
})();
