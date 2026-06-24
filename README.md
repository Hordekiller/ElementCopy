<p align="center">
  <picture>
    <source srcset="icons/icon128.png" />
    <img alt="Elementor Extractor" src="icons/icon128.png" width="128" height="128" />
  </picture>
</p>

<h1 align="center">Elementor Extractor</h1>

<p align="center">
  <strong>استخراج کامل ساختار المنتور از صفحات وردپرس</strong>
  <br />
  A Manifest V3 Chrome Extension to extract, export, and reconstruct Elementor page structures from live WordPress sites.
</p>

<p align="center">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome%20Extension-MV3-92003b?logo=googlechrome&logoColor=white" />
  <img alt="Elementor" src="https://img.shields.io/badge/Elementor-Compatible-92003b?logo=elementor" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-92003b" />
  <img alt="Version" src="https://img.shields.io/badge/Version-1.0.0-92003b" />
</p>

---

## 📋 Overview | نمای کلی

**Elementor Extractor** is a powerful Chrome extension that scans any WordPress page built with the Elementor page builder and reconstructs its full structure from the live DOM. It generates two distinct JSON outputs:

| Output | Purpose |
|--------|---------|
| **`elementor-import-template-*.json`** | A clean, import-ready Elementor template that can be directly imported via `Elementor → Templates → Import` |
| **`elementor-extract-report-*.json`** | A comprehensive technical report containing every extracted element, asset, config, and statistical summary |

This tool is designed for developers, designers, and content migrators who need to archive, migrate, or analyze Elementor-built pages.

> **اکستنشن Elementor Extractor** یک ابزار حرفه‌ای برای اسکن و استخراج ساختار کامل صفحات ساخته‌شده با صفحه‌ساز المنتور است. این اکستنشن دو خروجی JSON مجزا تولید می‌کند: یکی برای درون‌ریزی مستقیم در المنتور و دیگری برای گزارش کامل فنی.

---

## ✨ Features | قابلیت‌ها

### 🧠 Elementor Detection
- Automatic detection of Elementor-built pages via DOM markers, CSS classes, scripts, stylesheets, and meta tags
- Counts all Elementor root containers, sections, columns, widgets, and inner sections

### 🏗️ Full Structure Extraction
- Extracts **sections**, **columns**, **containers (`e-con`)**, and **widgets** with their hierarchy
- Identifies Elementor template types (header, footer, etc.) via `data-elementor-type` attributes
- Recovers responsive settings, custom CSS classes, and background images

### 🧩 Widget Intelligence
- Recognizes **30+ Elementor widget types** with type-specific settings extraction:
  - `heading`, `text-editor`, `image`, `button`, `video`, `spacer`, `divider`, `icon-list`, `tabs`, `accordion`, `toggle`, `google_maps`, `alert`, `counter`, `progress`, `testimonial`, `shortcode`, `icon-box`, `social-icons`, and more
- Automatically infers widget type from DOM structure when explicit type data is unavailable
- Maps Pro/theme widget aliases (`theme-post-title`, `nav-menu`, `form`, etc.) to their closest importable equivalents

### 📦 Comprehensive Asset Extraction
| Category | Details |
|----------|---------|
| **Links** | All `<a>` tags with href, target, rel, classes, and CSS selector |
| **Images** | `<img>` and `<picture>` sources with src, srcset, alt, title, dimensions, and loading mode |
| **Forms** | `<form>` elements with all fields (input, textarea, select, button), labels, and attributes |
| **Videos** | `<video>`, `<iframe>`, `<embed>` sources with dimensions |
| **Backgrounds** | CSS `background-image` from both inline styles and computed styles |
| **CSS Variables** | Elementor-specific custom properties (`--e-*`, `--elementor-*`) |
| **Global Assets** | All stylesheets and scripts with Elementor-related flagging |
| **Elementor Config** | Snapshots of `elementorFrontendConfig`, `ElementorProFrontendConfig`, and other runtime globals |

### 📊 Rich Summary Statistics
- Total Elementor nodes, widget type breakdown, role distribution
- Link, image, form, and video counts
- Elementor-related stylesheet and script counts
- All numbers displayed with Persian locale formatting in the popup

### 🛠️ Smart Template Reconstruction
- **Hashed stable IDs** using FNV-1a algorithm for reproducible element identifiers
- **Virtual structure wrapping**: orphan widgets/columns are automatically wrapped in virtual sections for valid Elementor import
- **Settings compaction**: removes empty/null values for clean output
- **Content sanitization**: strips script, style, and meta tags from widget HTML content
- **Responsive class preservation**: captures tablet/mobile/desktop breakpoint classes and `data-settings`

---

## 🖼️ Screenshots | تصاویر

<p align="center">
  <em>Screenshots coming soon</em>
  <br />
  <em>— تصاویر به زودی اضافه می‌شوند —</em>
</p>

---

## 🔧 Installation | نصب

### Chrome / Chromium Browsers

1. **Download** or clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/elementor-extractor-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked** and select the extension folder

5. The Elementor Extractor icon will appear in your toolbar

6. Navigate to any Elementor-built page and click the icon to start

> **نصب در کروم:** مرورگر را باز کنید، به `chrome://extensions` بروید، حالت توسعه‌دهنده را فعال کنید، روی "Load unpacked" کلیک کنید و پوشه اکستنشن را انتخاب کنید.

---

## 🚀 Usage | نحوه استفاده

### Step-by-Step | راهنمای گام‌به‌گام

1. **Navigate** to a WordPress page built with Elementor
2. **Click** the Elementor Extractor icon in your browser toolbar
3. **Click** the **"اسکن صفحه فعلی"** (Scan Current Page) button
4. Review the extracted JSON preview in the popup
5. Choose your action:

| Button | Action |
|--------|--------|
| **دانلود برای المنتور** | Downloads the Elementor-compatible import template JSON |
| **دانلود گزارش** | Downloads the full technical extract report JSON |
| **کپی خروجی** | Copies the import template JSON to clipboard |

### Importing into Elementor | درون‌ریزی در المنتور

1. Download the **`elementor-import-template-*.json`** file
2. In your WordPress admin panel, go to **Templates → Saved Templates**
3. Click **Import Template**
4. Select the downloaded JSON file
5. The template will be imported with all recognized sections, columns, and widgets

> **⚠️ Important:** Only use the `elementor-import-template-*.json` file for Elementor import. The `elementor-extract-report-*.json` file is for reference only; importing it will cause Elementor to show "Invalid Content In File" error.

> **⚠️ نکته مهم:** فقط فایل `elementor-import-template` را برای درون‌ریزی استفاده کنید. فایل گزارش کامل برای وارد کردن در المنتور نیست و باعث خطا می‌شود.

---

## 🏗️ Architecture | معماری

```
┌─────────────────────────────────────────────────────────────┐
│                  Chrome Extension (MV3)                     │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │   popup.html  │    │          scanner.js              │  │
│  │   popup.js    │───▶│   (injected into MAIN world)     │  │
│  │   popup.css   │    │                                  │  │
│  │              │    │  ┌──────────────────────────┐   │  │
│  │  ┌─────────┐ │    │  │  buildElementorTemplate │   │  │
│  │  │   UI    │ │    │  │  extractElementorElements│   │  │
│  │  │ buttons │ │    │  │  extractLinks/Images/... │   │  │
│  │  │ stats   │ │    │  │  detectElementor         │   │  │
│  │  │ output  │ │    │  │  summarize               │   │  │
│  │  └─────────┘ │    │  └──────────────────────────┘   │  │
│  └──────┬───────┘    └──────────────┬───────────────────┘  │
│         │                           │                       │
│         │    chrome.scripting       │                       │
│         └──────executeScript────────┘                       │
│                                                             │
│  Permissions: activeTab, scripting, downloads               │
│  Host: <all_urls>                                           │
└─────────────────────────────────────────────────────────────┘
```

### Flow | جریان اجرا

1. **Popup** (`popup.js`) queries the active tab via `chrome.tabs`
2. Injects **`scanner.js`** into the page's MAIN world (required for full DOM and JS access)
3. Calls `window.__elementorExtractor.run()` which returns a comprehensive result object
4. Popup displays the import template JSON, updates statistics, and enables download/copy actions

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **MAIN world injection** | Required to access Elementor's runtime globals (`elementorFrontendConfig`, etc.) |
| **FNV-1a hashing for IDs** | Generates deterministic, short (7 char) element IDs without collisions |
| **Virtual structure wrapping** | Ensures generated templates conform to Elementor's strict section→column→widget hierarchy |
| **Widget type inference fallback** | Gracefully handles unknown or third-party widgets by inferring from DOM patterns |

---

## 📁 Project Structure | ساختار پروژه

```
elementor-extractor-extension/
├── icons/                          # Extension icons (SVG sources + PNG renders)
│   ├── icon16.svg / icon16.png     # 16×16 toolbar icon
│   ├── icon32.svg / icon32.png     # 32×32 icon
│   ├── icon48.svg / icon48.png     # 48×48 extensions page icon
│   └── icon128.svg / icon128.png   # 128×128 store listing icon
├── manifest.json                   # Chrome Extension Manifest V3 configuration
├── popup.html                      # Popup UI (Persian/RTL layout)
├── popup.css                       # Popup styles (carmine theme, Persian font stack)
├── popup.js                        # Popup controller (scan, download, copy logic)
├── scanner.js                      # Core scanning engine (~840 lines)
└── README.md                       # This file
```

---

## ⚙️ Technical Details | جزئیات فنی

### Widget Type Mapping

The scanner maps real Elementor widget types to importable types:

| Source Widget | Import Widget |
|---------------|---------------|
| `heading` | `heading` |
| `text-editor` | `text-editor` |
| `image` | `image` |
| `button` | `button` |
| `video` | `video` |
| `spacer` | `spacer` |
| `divider` | `divider` |
| `icon-list` | `icon-list` |
| `tabs` / `accordion` / `toggle` | Respective type |
| `google_maps` | `google_maps` |
| `alert` | `alert` |
| `counter` | `counter` |
| `progress` | `progress` |
| `testimonial` | `testimonial` |
| `shortcode` | `shortcode` |
| `theme-post-title` / `theme-site-title` / `theme-page-title` | `heading` |
| `theme-post-content` | `text-editor` |
| `nav-menu` / `form` / `loop-grid` / `posts` / `woocommerce-*` | `html` |
| Unknown widgets | Inferred from DOM (`heading`, `button`, `image`, `video`, or `html`) |

### Supported Settings Extraction

Each widget type gets custom settings extraction appropriate to its nature:
- **heading**: title text, header size tag
- **image**: source URL, alt text, full size
- **button**: button text, link URL, external/noFollow flags
- **video**: YouTube/Vimeo URL detection vs. hosted video
- **tabs/accordion/toggle**: repeater tab titles with content
- **icon-list**: list items with links and icon defaults
- **counter/progress**: numeric values and titles

---

## ⚠️ Limitations | محدودیت‌ها

- **DOM-only extraction**: Only content present in the live DOM is captured. Lazy-loaded elements, scroll-triggered content, or click-activated sections must be visible before scanning
- **No database access**: Internal Elementor settings stored in the WordPress database (e.g., dynamic tags, advanced responsive conditions) are not accessible from the frontend
- **Pro & third-party widgets**: Elementor Pro widgets and third-party addon widgets (JetElements, Premium Addons, etc.) are mapped to their closest generic equivalents; some specialized settings may be lost
- **Server-specific CSS**: Theme-specific or dynamically-generated CSS files are not reconstructed
- **No media upload**: Images are referenced by their original URLs; they are not uploaded to the target WordPress media library

---

## 🤝 Contributing | مشارکت

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing patterns and conventions used throughout the codebase.

> مشارکت‌کنندگان عزیز، خوش آمدید! لطفاً قبل از ارسال Pull Request، از رعایت الگوهای کدنویسی پروژه اطمینان حاصل کنید.

---

## 📄 License | مجوز

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 Elementor Extractor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
```

---

<p align="center">
  <sub>Made with ❤️ for the Elementor & WordPress community</sub>
  <br />
  <sub>ساخته‌شده با عشق برای جامعه المنتور و وردپرس</sub>
</p>
