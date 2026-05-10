<div align="center">

![Power Toys Logo](img/power-toys-128.png)

# Power Toys

**An essential toolkit for pentesters and bug hunters**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow?logo=google-chrome&logoColor=white)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.1.0-informational)](package.json)

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
│   └── defaults.json          # Default sensitive patterns
├── src/
│   ├── pages/
│   │   ├── popup.html         # Main popup interface
│   │   ├── popup.js           # Popup logic & event handlers
│   │   ├── context-popup.html # Context menu interface
│   │   ├── context-popup.js   # Context menu logic
│   │   └── settings.js        # Settings page logic
│   ├── scripts/
│   │   ├── background.js      # Service worker (background tasks)
│   │   └── content.js         # Content script (page injection)
│   └── styles/
│       └── style.css          # Unified styling for all pages
└── assets/
    └── images/                # Icon and image assets
        ├── power-toys-16.png
        ├── power-toys-48.png
        ├── power-toys-128.png
        └── power-toys.png
```

## Technical Details

| Aspect               | Details                                       |
| -------------------- | --------------------------------------------- |
| **Manifest**         | Version 3                                     |
| **Permissions**      | Active Tab, Scripting, Storage, Context Menus |
| **Host Permissions** | All URLs                                      |
| **Author**           | [@ncodevsec](https://github.com/ncodevsec)    |

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
