<div align="center">

![Power Toys Logo](assets/images/power-toys-128.png)

# Power Toys

**An essential toolkit for pentesters and bug hunters**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?logo=google-chrome&logoColor=white)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.4.0-informational)](package.json)

---

</div>

## Overview

Quickly extract links, encode/decode data, and simplify everyday security tasks with this lightweight, powerful Chrome extension. Perfect for pentesters, bug hunters, and security researchers.

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

### From Chrome Web Store _(Coming Soon)_

Once available on the Chrome Web Store, install directly for automatic updates and easy distribution.

### For Development

1. **Clone the repository:**

    ```bash
    git clone https://github.com/ncodevsec/power-toys.git
    cd power-toys
    ```

2. **Open Chrome Extensions:**
    - Navigate to `chrome://extensions/`
    - Enable **Developer mode** (toggle in top-right)

3. **Load the extension:**
    - Click **Load unpacked**
    - Select the `power-toys` folder

4. **Start using Power Toys!** ✅

## Usage

### Popup Interface

Click the Power Toys icon in your toolbar to access all available tools in an intuitive interface.

### Context Menu

Right-click on any page element and select Power Toys options for instant access to specific functions.

## Project Structure

```
power-toys/
├── manifest.json              # Extension manifest (Manifest V3)
├── LICENSE                    # MIT License
├── README.md                  # This file
├── config/
│   └── defaults.json          # Default sensitive parameter patterns & keywords
├── src/
│   ├── pages/
│   │   ├── popup.html         # Main popup interface with tab-based UI
│   │   ├── popup.js           # Popup logic, event handlers, encoding/decoding
│   │   └── context-popup.html # Context menu quick access interface
│   ├── scripts/
│   │   └── background.js      # Service worker - link collection, context menus
│   └── styles/
│       └── style.css          # Unified styling, dark mode support, responsive design
└── assets/
    └── images/                # Icon and image assets
        ├── power-toys-16.png
        ├── power-toys-48.png
        └── power-toys-128.png
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

| Aspect               | Details                                                        |
| -------------------- | -------------------------------------------------------------- |
| **Manifest Version** | 3 (Latest Chrome Extension standard)                           |
| **Permissions**      | activeTab, scripting, storage, contextMenus, system.display    |
| **Host Permissions** | All URLs (`<all_urls>`)                                        |
| **Service Worker**   | `src/scripts/background.js` (background tasks & context menus) |
| **Popup Interface**  | `src/pages/popup.html` + `src/pages/popup.js`                  |
| **Styling**          | Tailwind CSS 2.2.19 + Custom CSS (style.css)                   |
| **Storage**          | Chrome Storage API for persistent configuration                |
| **Author**           | [@ncodevsec](https://github.com/ncodevsec)                     |

## Requirements

- **Browser**: Chrome/Chromium v88+
- **Platform**: Windows, macOS, or Linux
- **Developer Mode**: Required for local installation

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
