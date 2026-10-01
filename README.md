<div align="center">

![Power Toys Logo](src/assets/images/power-toys-128.png)

# Power Toys

**An essential toolkit for pentesters and bug hunters**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-yellow?logo=firefox&logoColor=white)](https://addons.mozilla.org)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.8.0-informational)](package.json)

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

- **Navigation**:
    - Popup: a top tab bar with Recon, Bulk Opener, Cipher, and Cookies; Recon shows Links/Params/Secrets as a second row of sub-tabs
    - Full tab: a left sidebar instead of the top tab bar, with Links/Params/Secrets nested under a "Recon" section
    - Links — Extract and analyze page links
    - Params — Detect sensitive parameters
    - Secrets — Analyze hardcoded secrets
    - Bulk Opener — Open many URLs at once, by tab, by window, or grouped by domain
    - Cipher — Encoding/decoding tools
    - Cookies — View, add, edit, delete, export, and import cookies for the current site
    - Settings — Configuration and pattern management (gear icon in the header)
- **Dark Mode Support** — Automatically respects system preferences
- **Responsive Design** — Works seamlessly on different screen sizes
- **Toast Notifications** — Non-intrusive feedback for user actions
- **Copy-to-Clipboard** — Easy one-click copying of extracted data

### 8. **Context Menu Integration**

- Right-click access to quick functions on any webpage
- Direct access to Power Toys tools from context menus
- Instant analysis without opening the main popup

### 9. **Cookie Management**

- View every cookie set for the current site, grouped by domain
- Add, edit, and delete cookies directly (name, value, domain, path, SameSite, Secure, HttpOnly, expiration)
- Export the current site's cookies to a JSON file, or import a previously exported file
- Cookie names are checked against the same sensitive-keyword list used for parameters

## Technical Details

| Aspect               | Chrome                                                      | Firefox                                               |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Manifest Version** | 3 (service worker background)                                | 3 (persistent background script)                       |
| **Permissions**      | activeTab, scripting, storage, contextMenus, cookies, system.display | activeTab, scripting, storage, contextMenus, cookies  |
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

### v0.8.0

- Grouped Links, Params, and Secrets under a new "Recon" tab (page info-gathering), shown as sub-tabs in the popup
- Top-level tabs are now Recon, Bulk Opener, Cipher, Cookies — narrower popup (760px → 600px)
- Full-tab view now uses a left sidebar for navigation instead of the top tab bar, with Links/Params/Secrets nested under a "Recon" section
- Fixed the full-tab preview demo not showing fixture data (unrelated to the real extension)

### v0.7.0

- Added a Cookies tab (next to Cipher): view, add, edit, and delete cookies for the current site, with export/import as JSON
- Cookie names are checked against the same sensitive-keyword list as params, with a "Sensitive" badge
- Requires a new `cookies` permission in both manifests
- Widened the popup further (640px → 760px) to fit the new tab
- Made the Bulk Opener's radio rows more compact (single line, tighter padding)
- Fixed a bug where Bulk Opener/Cipher could show a stray "No links found" message alongside their own content

### v0.6.4

- Shortened changelog entries for readability
- Minor README cleanup

### v0.6.3

- Item text (links, params, secret values) now uses normal color; only the bullet dot stays red
- Plain count badges are neutral gray now; "Sensitive" flags stay solid red
- Removed the red glow from the main content background, kept it on the header
- Settings page hides the tab bar; the gear icon now toggles Settings open/closed properly
- Redesigned Bulk Opener's "Opening options" as a radio-row list
- Fixed a light-theme bug where the context-menu window's badge and full-screen button were invisible (white-on-white)

### v0.6.2

- Widened the popup (420px → 640px) so all tabs fit without wrapping
- Moved Settings out of the tab bar into a gear icon in the header
- Redesigned Settings as a two-pane nav + content layout
- Redesigned the footer with icon-only social links
- Removed the header's bottom-corner rounding

### v0.6.1

- Flipped the default theme to black-and-red, high-contrast (dark is now the baseline, not OS-dependent)
- Replaced the crimson gradient header with a flat dark bar plus a red glow accent
- Restyled toast notifications as neutral cards with a colored status dot
- Neutralized shadow colors to plain black

### v0.6.0

- Rebuilt the UI in React + Tailwind CSS v4 with a shared, reusable component library
- New crimson design system matching the NihonGo site, with light/dark variants
- Switched the build to esbuild (bundled and minified)
- Added a static UI preview (`npm run preview`)
- Removed `tailwind.config.js` (Tailwind v4 is CSS-first)
- Carries forward the Firefox/Chrome popup fixes, reimplemented against the new React code

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
