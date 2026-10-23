# Chrome Web Store listing — Power Toys

**Name:** Power Toys
**Category:** Developer Tools
**Summary (≤132 chars):** Toolkit for pentesters and bug hunters: extract links and secrets, decode data, scan paths and headers — all local.

**Description**
Power Toys puts everyday security-testing tools one click away.
• Recon: extract every link and parameter on a page, spot hardcoded keys, credentials, endpoints and comments, probe common sensitive paths in the background, and check security headers.
• Cipher: encode/decode Base64, URL, HTML, Hex and Unicode, decode JWTs, identify hashes.
• Cookies & Storage: view, edit, import and export cookies, localStorage and sessionStorage.
• Command palette, keyboard shortcuts, local history, JSON/diff/epoch/UUID/regex utilities.
• Bulk opener, custom regex patterns (CTF flags included), Burp/Postman export.
Everything runs locally. No accounts, no tracking.
For authorized testing only.

**Single purpose:** Provide a set of web-security inspection and encoding tools for the page the user is viewing.

## Permission justifications (paste into the "Privacy practices" tab)
- **activeTab / scripting:** read links, scripts, comments and storage of the page the user is inspecting.
- **host permissions (<all_urls>):** the Paths and Headers tools must request URLs on whichever site the user chooses to test, and cookies on that site; no fixed host list is possible.
- **storage:** save settings, custom patterns and background scan state.
- **cookies:** view/edit/export the current site's cookies (Cookies tab).
- **contextMenus:** encode/decode selected text from the right-click menu.
- **alarms:** resume a background path scan if the service worker is suspended.
- **system.display:** place the encode/decode popup window on screen.
- **clipboardRead / clipboardWrite:** "Paste" and "Copy" buttons.
- **Remote code:** none. All code is bundled in the package.
- **Data usage:** collects no user data; select "I do not sell/transfer user data" and the three certifications.

## Assets to prepare
- Icon 128×128 (included), at least 1 screenshot 1280×800 (up to 5), small promo tile 440×280.
- Privacy policy URL: host `store/PRIVACY.md`, e.g. https://github.com/ncodevsec/power-toys/blob/main/store/PRIVACY.md
