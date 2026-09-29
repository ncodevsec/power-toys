<div align="center">

![Power Toys Logo](src/assets/images/power-toys-128.png)

# Power Toys

**An essential toolkit for pentesters and bug hunters**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-yellow?logo=firefox&logoColor=white)](https://addons.mozilla.org)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.6.1-informational)](package.json)

---

</div>

## Overview

Quickly extract links, encode/decode data, and simplify everyday security tasks with this lightweight, powerful browser extension. Available for both Chrome and Firefox, it's perfect for pentesters, bug hunters, and security researchers.

## ✨ Features

| Feature                      | Description                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Link Extraction**          | Extract all links from any webpage with categorization (Files, Paths, Others) |
| **Encode/Decode Tools**      | Support for Base64, URL encoding, HTML entities, Hex, and Unicode escaping     |
| **Sensitive Data Detection** | Automatically highlight links and parameters containing sensitive keywords    |
| **Link Categorization**      | Organize extracted links by type, with a nested file-type breakdown for Files |
| **Search & Filter**          | Search and filter links with real-time results and sensitive link highlighting |
| **Customizable Patterns**    | Define custom regex patterns for sensitive URLs and parameter keywords        |
| **Settings Management**      | Import/export configurations for easy sharing and backup                      |
| **Dark Mode Support**        | Light and dark theme options for comfortable browsing                         |
| **Context Menu Integration** | Right-click access to quick tools and functions                               |
| **Lightweight & Fast**       | Minimal performance impact with instant results                               |

## Project Architecture

Power Toys is built from **one unified source tree**, not separate Chrome/Firefox codebases. The UI is a React app styled with Tailwind CSS v4, bundled by esbuild; `build.js` compiles it, generates the Tailwind stylesheet, copies the result plus `config/` into `dist/chrome` and `dist/firefox`, and stamps each with its own browser-specific manifest from `manifests/`. You always build before loading the extension — there is no pre-built `chrome/` or `firefox/` folder checked into the repo.

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/ncodevsec/power-toys.git
cd power-toys
npm install
```

### 2. Build the extension

```bash
npm run build
```

This generates the Tailwind CSS bundle and produces two ready-to-load folders:

```
dist/
├── chrome/    # Load this in Chrome
└── firefox/   # Load this in Firefox
```

Run `npm run watch` during development to rebuild automatically. `npm run build:css` / `npm run watch:css` regenerate just the stylesheet.

### 3. Load it in your browser

**Chrome**

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** and select the `dist/chrome` folder
4. Start using Power Toys! ✅

**Firefox**

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on** and select `dist/firefox/manifest.json`
4. Start using Power Toys! ✅

## Usage

### Popup Interface

Click the Power Toys icon in your toolbar to access all available tools in an intuitive interface.

### Context Menu

Right-click on any page element and select Power Toys options for instant access to specific functions.

## Project Structure

```
power-toys/
├── build.js                    # esbuild + Tailwind build script — generates dist/chrome & dist/firefox
├── package.json
├── config/
│   └── defaults.json           # Default sensitive parameter patterns & keywords
├── manifests/
│   ├── manifest.chrome.json    # Chrome manifest (MV3, service worker background)
│   └── manifest.firefox.json   # Firefox manifest (MV3, background script)
├── src/                         # Single source of truth, copied to both builds
│   ├── app/                     # React UI (bundled by esbuild — not shipped as source)
│   │   ├── components/          # Shared layout pieces (header, footer, domain cards, toolbar)
│   │   │   └── ui/               # Reusable primitives: Button, Card, Tabs, Field, Modal, etc.
│   │   ├── tabs/                 # One component per top-level tab (Links, Params, Secrets, …)
│   │   ├── popup/                # Popup + full-tab entry point (App.jsx, main.jsx)
│   │   ├── context/               # Context-menu quick-view entry point
│   │   ├── hooks/                 # useTheme, usePageData
│   │   ├── lib/                   # encoding, sensitivity matching, link grouping, page collectors
│   │   └── providers.jsx          # Toast + sensitive-pattern React contexts
│   ├── pages/
│   │   ├── popup.html            # Loads the built popup.bundle.js
│   │   ├── popup.bundle.js        # Generated — not committed, produced by `npm run build`
│   │   ├── context-popup.html    # Loads the built context-popup.bundle.js
│   │   └── context-popup.bundle.js # Generated — not committed
│   ├── scripts/
│   │   └── background.js         # Service worker/background script source (bundled on build)
│   ├── styles/
│   │   ├── input.css             # Tailwind entry point + design tokens (colors, radii, shadows)
│   │   └── main.css              # Generated — not committed, produced by `npm run build`
│   └── assets/
│       └── images/               # Icon and image assets
├── preview/                     # Static UI preview with fixture data — `npm run preview`
│   ├── index.html
│   ├── mock-env.js               # Mocks chrome.* APIs so the real App renders outside a browser extension
│   └── fixtures.js               # Example links/secrets/params shown in the preview
├── dist/                        # Generated — not committed
│   ├── chrome/                   # Load unpacked from here
│   └── firefox/                  # Load temporary add-on from here
├── LICENSE
└── README.md
```

## Core Functionalities

### 1. **Link Extraction & Categorization**

- Automatically collects all links from the current webpage
- Categorizes links by type:
    - **Files** — anything ending in a recognizable extension (`.js`, `.json`, `.png`, `.pdf`, etc.), with a nested file-type breakdown
    - **Paths** — URL paths with no file extension
    - **Others** — everything else
- Extracts links from: `<a>`, `<link>`, `<script>`, `<img>`, `<iframe>`, `<source>`, `<video>`, `<audio>` tags, and `data-url` attributes
- Removes duplicate links and groups results by domain

### 2. **Sensitive Data Detection**

- **Sensitive Parameters**: Detects common security-related keywords in URLs:
    - Authentication: `api_key`, `token`, `auth_token`, `bearer`, `jwt`, `access_token`
    - Credentials: `password`, `passwd`, `pwd`, `username`, `email`
    - Identifiers: `user_id`, `session_id`, `uuid`, `admin`
    - Endpoints: `redirect`, `callback`, `return`, `origin`
- Supports **customizable regex patterns** for detecting sensitive URLs
- Highlights links containing sensitive parameters in a dedicated section
- Scans HTML comments for hidden URLs and sensitive paths
- Filters paths containing admin, api, internal, private, secret, debug, backup endpoints

### 3. **Encoding/Decoding Tools**

Supports 5 encoding formats with bidirectional conversion, backed by a single shared implementation (`src/app/lib/encoding.js`) used by both the popup and the context-menu quick view:

- **Base64** — Encode/decode with proper handling of UTF-8 characters
- **URL Encoding** — Escape/unescape URL-safe characters
- **HTML Entities** — Convert special characters to/from HTML entities, decoded via an inert `DOMParser` document so embedded resources (e.g. tracking pixels) are never fetched
- **Hexadecimal** — Convert text to/from hex over UTF-8 bytes, so non-Latin characters round-trip correctly
- **Unicode Escaping** — Convert to/from Unicode escape sequences (`\uXXXX` format)

### 4. **Intelligent Search & Filtering**

- Real-time search across extracted links
- Filter by category (Links, Paths, Files, Others)
- Filter by sensitivity level (all vs. sensitive-only)
- Filter secrets by type (API Keys, Credentials, Endpoints, Paths, Comments, Hidden Links)
- Live highlighting of matching results

### 5. **Secret Collection & Analysis**

Automated detection of hardcoded secrets and sensitive patterns:

- **API Keys & Tokens** — Regex patterns for common API key variables
- **Credentials** — Username/password patterns in HTML/JavaScript
- **Endpoints** — Hardcoded base URLs and hostnames
- **Paths** — Potentially dangerous endpoints (admin, debug, backup)
- **Comments** — Hidden URLs and paths in HTML comments
- Uses comprehensive regex patterns from `defaults.json` (500+ sensitive keywords), with vendor/dev-tool noise filtered out

### 6. **Settings Management**

- **Import Patterns** — Load custom regex patterns for sensitive detection
- **Export Patterns** — Save current patterns for backup/sharing
- **Pattern Customization** — Add custom regex patterns for your use cases
- **Theme Selection** — Light, Dark, or System preference modes
- **Local Storage** — Persists settings and patterns across sessions

### 7. **User Interface Features**

- **Tab-Based Navigation**:
    - Links Tab — Extract and analyze page links
    - Params Tab — Detect sensitive parameters
    - Secrets Tab — Analyze hardcoded secrets
    - Cipher Tab — Encoding/decoding tools
    - Settings Tab — Configuration and pattern management
- **Dark Mode Support** — Automatically respects system preferences
- **Responsive Design** — Works seamlessly on different screen sizes
- **Toast Notifications** — Non-intrusive feedback for user actions
- **Copy-to-Clipboard** — Easy one-click copying of extracted data

### 8. **Context Menu Integration**

- Right-click access to quick functions on any webpage
- Direct access to Power Toys tools from context menus
- Instant analysis without opening the main popup

## Technical Details

| Aspect               | Chrome                                                      | Firefox                                               |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Manifest Version** | 3 (service worker background)                                | 3 (persistent background script)                       |
| **Permissions**      | activeTab, scripting, storage, contextMenus, system.display | activeTab, scripting, storage, contextMenus           |
| **Host Permissions** | `<all_urls>`                                                 | `<all_urls>`                                          |
| **Background**       | Service Worker (`background.js`, esbuild-bundled)             | Background Script (`background.js`, esbuild-bundled)  |
| **Popup**            | `popup.html` + React (`popup.bundle.js`)                      | `popup.html` + React (`popup.bundle.js`)               |
| **UI Framework**     | React 18 + Tailwind CSS 4                                    | React 18 + Tailwind CSS 4                              |
| **Storage API**      | Chrome Storage API                                           | Firefox Storage API (via `browser.*`)                  |
| **Node.js Version**  | v16+ (for development)                                       | v16+ (for development)                                 |

Both browser builds ship the *same* `src/` tree — the manifest is the only thing that differs, injected by `build.js` from `manifests/manifest.chrome.json` / `manifests/manifest.firefox.json`.

### Build & Development

- **Build System**: `build.js` — generates the Tailwind stylesheet, bundles the React UI and the background script with [esbuild](https://esbuild.github.io/) (minified, single-file IIFE output — no runtime module loader needed), then copies `src/` + `config/` into `dist/chrome` and `dist/firefox`, injecting the right manifest into each
- **UI**: React 18, written as function components with hooks; JSX runs through esbuild's automatic runtime, so component files don't need `import React`
- **CSS Framework**: Tailwind CSS v4 (`@tailwindcss/cli`), with the color/spacing/radius/shadow design tokens defined directly in `src/styles/input.css` (no separate `tailwind.config.js` — Tailwind v4 is CSS-first)
- **Package Manager**: npm
- **Output**: `dist/` folder with separate `chrome/` and `firefox/` builds (git-ignored — always run `npm run build` after cloning)
- **Configuration Files**: `manifests/manifest.chrome.json` and `manifests/manifest.firefox.json`
- **UI Preview**: `npm run preview` builds `preview/index.html` — the real popup/full-tab/context-menu React app mounted with mocked `chrome.*` APIs and fixture data, for design review without loading the extension into a browser

## Requirements

### Chrome

- **Browser**: Chrome/Chromium v88+
- **Platform**: Windows, macOS, or Linux
- **Developer Mode**: Required for local installation

### Firefox

- **Browser**: Firefox 109+ (first version with MV3 support)
- **Platform**: Windows, macOS, or Linux
- **Developer Mode**: Temporary add-on loading for testing

## Changelog

### v0.6.1

- **Flipped the default theme to a black-and-red, high-contrast look** (the v0.6.0 palette defaulted to a light, pink-tinted surface and only went dark if the OS was set to dark mode). Near-black is now the baseline theme regardless of OS setting — `#0c0c0d` page background, layered charcoal surfaces (`#16` → `#1f`), a single vivid red accent (`#ef4141`) used consistently for primary buttons (red background, white text), active tabs, badges, and focus states. Explicit Light/Dark/System theme switching still works; "Light" is now the opt-in override instead of the default
- Replaced the colorful crimson gradient hero header with a flat, near-black app bar (a soft red glow accent in the corner, a solid red icon chip) — closer to the flat, minimal chrome of apps like ChatGPT than a colored banner
- Restyled toast notifications as a neutral dark card with a small colored status dot, instead of a solid red/green block
- Neutralized card/modal shadow colors to plain black (the previous shadows were tinted dark red, which was part of what made the light theme look "reddish" overall)

### v0.6.0

- **Rebuilt the entire UI in React + Tailwind CSS v4**, replacing the hand-written DOM manipulation in `popup.js`/`context-popup.js`. The popup, full-tab view, and context-menu quick view are now one shared React app (`src/app/`) with a reusable component library (`Button`, `Card`, `Tabs`, `Field`, `Modal`, `Badge`, `CopyButton`, etc.) instead of copy-pasted markup and event-delegation strings
- **New crimson design system**, colour-matched to the author's other project ([NihonGo](https://ncodevsec.github.io/nihongo/), `#bd2828`): a full set of CSS custom-property design tokens (surface/border/text/brand colors, radii, shadows) with automatic light/dark variants, rounded corners on every card/button/input, and a gradient hero header
- **Switched the build to esbuild**: the React UI and the background script are now bundled and minified (`npm run build`), instead of the old plain file-copy — smaller, faster-loading, and lets the background script import the same page-collector functions the popup uses (`src/app/lib/collectors.js`) instead of keeping a second hand-synced copy
- **Added a static UI preview** (`npm run preview` → `preview/index.html`): mounts the real popup/full-tab/context-menu components with mocked `chrome.*` APIs and realistic fixture data, so the UI can be reviewed without loading the extension into a browser
- **Removed `tailwind.config.js`**: Tailwind v4 is CSS-first, so the theme now lives entirely in `src/styles/input.css`
- Carries forward the unreleased Firefox context-menu-window fix, the Firefox blank-output fix, and the Chrome popup sizing fix, now reimplemented against the new React background/context-menu code

### v0.5.3

- **Fixed** link categorization mismatch between the right-click "Power Toys" page action and the popup — both now use the same Files/Paths/Others scheme that matches the UI's sub-tabs, instead of the page action silently sorting links into categories the UI couldn't display
- **Fixed** a data-leak risk in HTML entity decoding: decoding untrusted text via `div.innerHTML` could trigger real network requests for embedded resources (e.g. a tracking pixel) even though the element was never shown; decoding now uses an inert `DOMParser` document, which fetches nothing
- **Fixed** Hex encode/decode corrupting any non-Latin-1 character (emoji, accented letters, CJK, etc.) — it now operates over UTF-8 bytes instead of raw UTF-16 code units
- **Fixed** the context-menu secret scanner missing the vendor/dev-tool noise filter and de-dupe pass that the popup's scanner has, so results no longer differ depending on how you opened the tool
- **Fixed** dead code in the link collector (an unused regex and a pointless re-declaration inside the loop)
- **Unified** all encode/decode logic into one shared module (`src/app/lib/encoding.js`) instead of two copies that could drift apart
- **Hardened** the manifest by removing `web_accessible_resources` — nothing in the extension actually needed to expose `context-popup.html` or `config/defaults.json` to arbitrary web pages; both are only ever opened/fetched from the extension's own background/popup context
- **Fixed** the Tailwind build: Tailwind v4 moved its CLI to the separate `@tailwindcss/cli` package, and the custom theme in `tailwind.config.js` wasn't actually being loaded (v4 requires an explicit `@config` directive) — both are now correct
- **Fixed** documentation drift: the README's install instructions, project structure, and the Firefox manifest-version claim didn't match the real unified-build architecture; the Firefox badge also linked to the Chrome Web Store by mistake

### v0.5.2

- **Refactored popup & context menu styles** with Tailwind CSS for consistent, modern design
- **Centralized design tokens** in theme layer for single source of truth (SSoT) architecture
- **Added cross-browser API compatibility layer** for seamless Firefox and Chrome support
- **Optimized CSS architecture** with Tailwind integration for better maintainability
- **Implemented bulk URL opener functionality** for efficient opening of multiple links
- **Enhanced context menu structure** for improved usability and organization
- **Added copy buttons for header groups** with quick access to copy links, parameters, and secrets
- **Added input paste functionality** and improved button styles
- **Added sensitive parameter filter** with console log cleanup
- **Fixed tab opening via event delegation** for streamlined event handling
- **Updated build scripts** with concurrently support for improved dev workflow

### v0.4

- Improved overall architecture, styling, and cross-browser support
- Enhanced URL handling with protocol-relative URL support
- Improved secret grouping and categorization
- Added sensitive secrets filter button with improved functionality
- Updated secrets popup styles and logic for better UX
- Renamed "URLs & Paths" tab to "Links" for clarity
- Improved file type filtering in popup interface

### v0.3

- Added Secrets tab and functionality to collect and display sensitive information
- Enhanced popup with file type filtering and modal for viewing full content
- Added copy parameters menu with options for names, values, and both
- Security hardening, XSS fixes, and performance optimizations
- Improved README formatting

### v0.2

- Added Secrets tab functionality to detect and display sensitive information
- Initial implementation of sensitive data detection and collection
- Basic secret pattern recognition and categorization

### v0.1

- Initial release with core settings and background setup
- Foundation for extension infrastructure and core components

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to:

- Report bugs via GitHub Issues
- Submit pull requests with improvements
- Suggest new features

## Support & Feedback

Have questions or suggestions? Connect with us:

- **Issues**: [GitHub Issues](https://github.com/ncodevsec/power-toys/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ncodevsec/power-toys/discussions)
- **Author**: [@ncodevsec](https://github.com/ncodevsec)

---

<div align="center">

**Built with ❤️ by security professionals for security professionals**

[Give us a star(⭐) if you find this useful!](https://github.com/ncodevsec/power-toys)

</div>
