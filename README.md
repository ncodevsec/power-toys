<div align="center">

![Power Toys Logo](src/assets/images/power-toys-128.png)

# Power Toys

**An essential toolkit for pentesters and bug hunters**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?logo=google-chrome&logoColor=white)](https://chrome.google.com)
[![Firefox Extension](https://img.shields.io/badge/Firefox-Extension-yellow?logo=firefox&logoColor=white)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.5.2-informational)](package.json)

---

</div>

## Overview

Quickly extract links, encode/decode data, and simplify everyday security tasks with this lightweight, powerful browser extension. Available for both Chrome and Firefox, it's perfect for pentesters, bug hunters, and security researchers.

## ✨ Features

| Feature                      | Description                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Link Extraction**          | Extract all links from any webpage with categorization (JS, JSON, Images, etc.) |
| **Encode/Decode Tools**      | Support for Base64, URL encoding, HTML entities, Hex, and Unicode escaping      |
| **Sensitive Data Detection** | Automatically highlight links and parameters containing sensitive keywords      |
| **Link Categorization**      | Organize extracted links by type (paths, JavaScript, JSON, images, etc.)        |
| **Search & Filter**          | Search and filter links with real-time results and sensitive link highlighting  |
| **Customizable Patterns**    | Define custom regex patterns for sensitive URLs and parameter keywords          |
| **Settings Management**      | Import/export configurations for easy sharing and backup                        |
| **Dark Mode Support**        | Light and dark theme options for comfortable browsing                           |
| **Context Menu Integration** | Right-click access to quick tools and functions                                 |
| **Lightweight & Fast**       | Minimal performance impact with instant results                                 |

## Installation

### For Chrome

1. **Clone the repository:**
    - `git clone https://github.com/ncodevsec/power-toys.git`

2. **Open Chrome Extensions:**
    - Navigate to `chrome://extensions/`
    - Enable **Developer mode** (toggle in top-right)

3. **Load the extension:**
    - Click **Load unpacked**
    - Select the `power-toys/chrome` folder

4. **Start using Power Toys!** ✅

### For Firefox

1. **Clone the repository:**
    - `git clone https://github.com/ncodevsec/power-toys.git`

2. **In Firefox URL bar:**
    - Navigate to `about:debugging#/runtime/this-firefox`
    - Click **This Firefox** in the left sidebar

3. **Load the extension:**
    - Click **Load Temporary Add-on**
    - Select the `manifest.json` file from the `power-toys/firefox` folder

4. **Start using Power Toys!** ✅

## Usage

### Popup Interface

Click the Power Toys icon in your toolbar to access all available tools in an intuitive interface.

### Context Menu

Right-click on any page element and select Power Toys options for instant access to specific functions.

## Project Structure

```
power-toys/
├── chrome/                    # Chrome extension (Manifest V3)
│   ├── manifest.json          # Chrome manifest
│   ├── config/
│   │   └── defaults.json      # Default sensitive parameter patterns & keywords
│   ├── src/
│   │   ├── pages/
│   │   │   ├── popup.html     # Main popup interface with tab-based UI
│   │   │   ├── popup.js       # Popup logic, event handlers, encoding/decoding
│   │   │   ├── context-popup.html # Context menu quick access interface
│   │   │   └── context-popup.js
│   │   ├── scripts/
│   │   │   └── background.js  # Service worker - link collection, context menus
│   │   └── styles/
│   │       ├── style.css      # Unified styling, dark mode support, responsive design
│   │       └── tailwind.min.css
│   └── assets/
│       └── images/            # Icon and image assets
├── firefox/                   # Firefox extension (Manifest V2 compatible)
│   ├── manifest.json          # Firefox manifest
│   ├── config/
│   │   └── defaults.json      # Default sensitive parameter patterns & keywords
│   ├── src/
│   │   ├── pages/
│   │   │   ├── popup.html
│   │   │   ├── popup.js
│   │   │   ├── context-popup.html
│   │   │   └── context-popup.js
│   │   ├── scripts/
│   │   │   ├── api-compat.js  # Firefox API compatibility layer
│   │   │   └── background.js  # Background script for Firefox
│   │   └── styles/
│   │       ├── style.css
│   │       └── tailwind.min.css
│   └── assets/
│       └── images/            # Icon and image assets
├── LICENSE                    # MIT License
└── README.md                  # This file
```

## Core Functionalities

### 1. **Link Extraction & Categorization**

- Automatically collects all links from the current webpage
- Categorizes links by type:
    - **JavaScript files** (.js)
    - **JSON endpoints** (.json)
    - **Images** (.jpeg, .jpg, .gif, .png, .svg, .webp, .ico)
    - **Paths** (URLs without extensions)
    - **Others** (miscellaneous resources)
- Extracts links from: `<a>`, `<link>`, `<script>`, `<img>`, `<iframe>`, `<source>`, `<video>`, `<audio>` tags, and `data-url` attributes
- Removes duplicate links and filters by domain

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

Supports 5 encoding formats with bidirectional conversion:

- **Base64** - Encode/decode with proper handling of UTF-8 characters
- **URL Encoding** - Escape/unescape URL-safe characters
- **HTML Entities** - Convert special characters to HTML entities
- **Hexadecimal** - Convert text to/from hex representation
- **Unicode Escaping** - Convert to/from Unicode escape sequences (\\uXXXX format)

### 4. **Intelligent Search & Filtering**

- Real-time search across extracted links
- Filter by category (Links, Paths, JavaScript, JSON, Images, Others)
- Filter by sensitivity level (all vs. sensitive-only)
- Filter secrets by type (API Keys, Credentials, Endpoints, Paths, Comments, Hidden Links)
- Live highlighting of matching results

### 5. **Secret Collection & Analysis**

Automated detection of hardcoded secrets and sensitive patterns:

- **API Keys & Tokens** - Regex patterns for common API key variables
- **Credentials** - Username/password patterns in HTML/JavaScript
- **Endpoints** - Hardcoded base URLs and hostnames
- **Paths** - Potentially dangerous endpoints (admin, debug, backup)
- **Comments** - Hidden URLs and paths in HTML comments
- Uses comprehensive regex patterns from defaults.json (500+ sensitive keywords)

### 6. **Settings Management**

- **Import Patterns** - Load custom regex patterns for sensitive detection
- **Export Patterns** - Save current patterns for backup/sharing
- **Pattern Customization** - Add custom regex patterns for your use cases
- **Theme Selection** - Light, Dark, or System preference modes
- **Local Storage** - Persists settings and patterns across sessions

### 7. **User Interface Features**

- **Tab-Based Navigation**:
    - Links Tab - Extract and analyze page links
    - Params Tab - Detect sensitive parameters (coming soon)
    - Secrets Tab - Analyze hardcoded secrets
    - Cipher Tab - Encoding/decoding tools
    - Settings Tab - Configuration and pattern management
- **Dark Mode Support** - Automatically respects system preferences
- **Responsive Design** - Works seamlessly on different screen sizes
- **Toast Notifications** - Non-intrusive feedback for user actions
- **Copy-to-Clipboard** - Easy one-click copying of extracted data

### 8. **Context Menu Integration**

- Right-click access to quick functions on any webpage
- Direct access to Power Toys tools from context menus
- Instant analysis without opening the main popup

## Technical Details

| Aspect               | Chrome                                                      | Firefox                                               |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **Manifest Version** | 3 (Latest standard)                                         | 2 (With V3 compatibility layer)                       |
| **Permissions**      | activeTab, scripting, storage, contextMenus, system.display | activeTab, scripting, storage, contextMenus           |
| **Host Permissions** | `<all_urls>`                                                | `<all_urls>`                                          |
| **Background**       | Service Worker (`background.js`)                            | Background Script (`background.js` + `api-compat.js`) |
| **Popup**            | `popup.html` + `popup.js`                                   | `popup.html` + `popup.js`                             |
| **Styling**          | Tailwind CSS 4.3.0 + Custom CSS                             | Tailwind CSS 4.3.0 + Custom CSS                       |
| **Storage API**      | Chrome Storage API                                          | Firefox Storage API                                   |
| **Node.js Version**  | v16+ (for development)                                      | v16+ (for development)                                |

### Build & Development

- **Build System**: `build.js` - Automated packaging for both browsers
- **CSS Framework**: Tailwind CSS 4.3.0 with custom styling
- **Package Manager**: npm
- **Output**: `dist/` folder with separate `chrome/` and `firefox/` builds
- **Configuration Files**: `manifests/manifest.chrome.json` and `manifests/manifest.firefox.json`

## Requirements

### Chrome

- **Browser**: Chrome/Chromium v88+
- **Platform**: Windows, macOS, or Linux
- **Developer Mode**: Required for local installation

### Firefox

- **Browser**: Firefox 88+
- **Platform**: Windows, macOS, or Linux
- **Developer Mode**: Temporary add-on loading for testing

## Changelog

### v0.5 (Current)

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
