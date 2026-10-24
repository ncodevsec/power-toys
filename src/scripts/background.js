// Background service worker / background script.
// Bundled by build.js (esbuild, IIFE) so the ES import below works
// identically as a Chrome MV3 service worker and a Firefox background script.
"use strict";

import { collectAllLinksInPage, collectSecretsFromPage } from "../app/lib/collectors.js";
import { autoDecode, describePath } from "../app/lib/encoding.js";
import { getSelectedText, copyInPage, toastInPage } from "../app/lib/pageActions.js";
import { startJob, cancelJob, ackJob, resumeIfNeeded, ALARM } from "../app/lib/pathJob.js";
import { startSitemap, stopSitemap, clearSitemap, registerSitemap } from "../app/lib/sitemap.js";

const getBrowserAPI = () => globalThis.chrome ?? globalThis.browser;

let contextMenuData = {};

// ─── Context menu definitions ─────────────────────────────────────────────────
const ENCODING_METHODS = [
	{ id: "encode-base64", title: "Base64 Encode", method: "base64", op: "encode" },
	{ id: "decode-base64", title: "Base64 Decode", method: "base64", op: "decode" },
	{ id: "encode-url", title: "URL Encode", method: "url", op: "encode" },
	{ id: "decode-url", title: "URL Decode", method: "url", op: "decode" },
	{ id: "encode-html", title: "HTML Entity Encode", method: "html", op: "encode" },
	{ id: "decode-html", title: "HTML Entity Decode", method: "html", op: "decode" },
	{ id: "encode-hex", title: "Hex Encode", method: "hex", op: "encode" },
	{ id: "decode-hex", title: "Hex Decode", method: "hex", op: "decode" },
	{ id: "encode-unicode", title: "Unicode Encode", method: "unicode", op: "encode" },
	{ id: "decode-unicode", title: "Unicode Decode", method: "unicode", op: "decode" },
	{ id: "encode-base64url", title: "Base64URL Encode", method: "base64url", op: "encode" },
	{ id: "decode-base64url", title: "Base64URL Decode", method: "base64url", op: "decode" },
	{ id: "encode-base32", title: "Base32 Encode", method: "base32", op: "encode" },
	{ id: "decode-base32", title: "Base32 Decode", method: "base32", op: "decode" },
	{ id: "decode-jwt", title: "JWT Decode", method: "jwt", op: "decode" },
	{ id: "decode-auto", title: "Auto Decode", method: "auto", op: "decode" }, // detects the format; see lib/encoding.js autoDecode
];

const METHOD_MAP = Object.fromEntries(ENCODING_METHODS.map((m) => [m.id, { method: m.method, op: m.op }]));

function createContextMenus() {
	const api = getBrowserAPI();
	api.contextMenus.removeAll(() => {
		// Right-click on a page: run tools on the current tab's URL.
		api.contextMenus.create({ id: "power-toys-page", title: "Power Toys", contexts: ["page"] });
		api.contextMenus.create({ id: "page-scan", title: "Scan this page", parentId: "power-toys-page", contexts: ["page"] });
		api.contextMenus.create({ id: "page-headers", title: "Check security headers", parentId: "power-toys-page", contexts: ["page"] });
		api.contextMenus.create({ id: "page-paths", title: "Check sensitive paths", parentId: "power-toys-page", contexts: ["page"] });
		api.contextMenus.create({ id: "page-decode-url", title: "Auto-decode this page's URL", parentId: "power-toys-page", contexts: ["page"] });
		// Right-click on a link: decode its address.
		api.contextMenus.create({ id: "link-decode", title: "Power Toys: Auto-decode link", contexts: ["link"] });
		api.contextMenus.create({ id: "power-toys-main", title: "Power Toys", contexts: ["selection"] });
		api.contextMenus.create({ id: "encode-parent", title: "Encode", parentId: "power-toys-main", contexts: ["selection"] });
		api.contextMenus.create({ id: "decode-parent", title: "Decode", parentId: "power-toys-main", contexts: ["selection"] });
		for (const item of ENCODING_METHODS) {
			api.contextMenus.create({
				id: item.id,
				title: item.title,
				parentId: item.op === "encode" ? "encode-parent" : "decode-parent",
				contexts: ["selection"],
			});
		}
	});
}

// ─── Install handler ──────────────────────────────────────────────────────────
getBrowserAPI().runtime.onInstalled.addListener(() => {
	const api = getBrowserAPI();
	api.storage.sync.get(["sensitivePatterns"], (result) => {
		if (result.sensitivePatterns) return;
		fetch(api.runtime.getURL("config/defaults.json"))
			.then((r) => r.json())
			.then((defaults) => {
				api.storage.sync.set({ sensitivePatterns: defaults });
				api.storage.local.set({ sensitivePatterns: defaults });
			})
			.catch(() => {
				const empty = { params: [], urlPatterns: [] };
				api.storage.sync.set({ sensitivePatterns: empty });
				api.storage.local.set({ sensitivePatterns: empty });
			});
	});
	createContextMenus();
});

// ─── Shared actions (context menu + keyboard shortcuts) ───────────────────────
const EMPTY_SECRETS = { apiKeys: [], credentials: [], endpoints: [], paths: [], comments: [], hiddenLinks: [] };
const getLocal = (keys) => new Promise((resolve) => getBrowserAPI().storage.local.get(keys, (r) => resolve(r || {})));

/** Scans the tab, caches the result, and opens the full-tab view for it. */
async function openFullView(tab, extraQuery = "") {
	const api = getBrowserAPI();
	let domain = "";
	try {
		domain = new URL(tab.url).hostname;
	} catch {
		return;
	}
	const [linksResult, secretsResult] = await Promise.allSettled([
		api.scripting.executeScript({ target: { tabId: tab.id }, func: collectAllLinksInPage }),
		api.scripting.executeScript({ target: { tabId: tab.id }, func: collectSecretsFromPage }),
	]);
	const links = linksResult.status === "fulfilled" ? (linksResult.value?.[0]?.result ?? []) : [];
	const secrets = secretsResult.status === "fulfilled" ? (secretsResult.value?.[0]?.result ?? EMPTY_SECRETS) : EMPTY_SECRETS;
	await api.storage.local.set({ savedLinks: links, savedSecrets: secrets });
	api.tabs.create({ url: api.runtime.getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}${extraQuery}`) });
}

/** Opens the small Encode/Decode window for `data` ({ selectedText, method, operation }). */
function openContextWindow(data) {
	const api = getBrowserAPI();
	contextMenuData = data;
	// Persist so the data survives Firefox background-page unloads.
	api.storage.local.set({ contextMenuData });

	const POPUP_W = 560;
	const POPUP_H = 600; // includes the window title bar
	const windowOptions = { url: api.runtime.getURL("src/pages/context-popup.html"), type: "popup", width: POPUP_W, height: POPUP_H };

	if (api.system?.display) {
		// Chrome: place the popup window at the bottom-right of the screen.
		api.system.display.getInfo((displays) => {
			if (displays?.length > 0) {
				const { left, top, width, height } = displays[0].workArea || displays[0].bounds;
				windowOptions.left = Math.max(0, left + width - POPUP_W - 20);
				windowOptions.top = Math.max(0, top + height - POPUP_H - 20);
			}
			api.windows.create(windowOptions);
		});
	} else {
		// Firefox: no system.display, but windows.create({type:"popup"}) works.
		api.windows.create(windowOptions);
	}
}

/** Keyboard shortcut: auto-decode whatever text is selected on the page. */
async function decodeSelection(tab) {
	const api = getBrowserAPI();
	const inPage = (func, args = []) =>
		api.scripting.executeScript({ target: { tabId: tab.id }, func, args }).then((r) => r?.[0]?.result).catch(() => undefined);

	const text = String((await inPage(getSelectedText)) ?? "").trim();
	if (!text) return inPage(toastInPage, ["Power Toys: select some text first"]);

	const { prefs } = await getLocal(["prefs"]);
	if ((prefs?.selectionAction ?? "window") === "window") {
		return openContextWindow({ selectedText: text, method: "auto", operation: "decode" });
	}
	const [best] = autoDecode(text);
	if (!best) return inPage(toastInPage, ["Power Toys: no readable decoding found"]);
	const copied = await inPage(copyInPage, [best.value]);
	return inPage(toastInPage, [copied ? `Decoded (${describePath(best.path)}) and copied` : `Decoded (${describePath(best.path)}): ${best.value.slice(0, 120)}`]);
}

// ─── Context menu click handler ───────────────────────────────────────────────
getBrowserAPI().contextMenus.onClicked.addListener(async (info, tab) => {
	const { menuItemId, selectionText } = info;

	if (menuItemId === "power-toys-main" || menuItemId === "page-scan") return openFullView(tab);
	if (menuItemId === "page-headers") return openFullView(tab, "&goto=recon:headers&run=1");
	if (menuItemId === "page-paths") return openFullView(tab, "&goto=recon:paths&run=1");
	if (menuItemId === "page-decode-url") return openContextWindow({ selectedText: info.pageUrl || tab.url, method: "auto", operation: "decode" });
	if (menuItemId === "link-decode" && info.linkUrl) return openContextWindow({ selectedText: info.linkUrl, method: "auto", operation: "decode" });

	const methodData = METHOD_MAP[menuItemId];
	if (methodData && selectionText) openContextWindow({ selectedText: selectionText, method: methodData.method, operation: methodData.op });
});

// ─── Keyboard shortcuts (manifest "commands") ─────────────────────────────────
getBrowserAPI().commands?.onCommand.addListener(async (command, tabArg) => {
	const api = getBrowserAPI();
	const tab = tabArg || (await new Promise((r) => api.tabs.query({ active: true, currentWindow: true }, (t) => r(t?.[0]))));
	if (!tab) return;
	if (command === "open-palette") return openFullView(tab, "&palette=1");
	if (command === "open-full-tab") return openFullView(tab);
	if (command === "auto-decode-selection") return decodeSelection(tab);
});

// ─── Message handler ───────────────────────────────────────────────────────────
getBrowserAPI().runtime.onMessage.addListener((request, sender, sendResponse) => {
	const api = getBrowserAPI();
	// Only accept messages from our own extension (works in Chrome and Firefox;
	// sender.origin differs between them because Firefox uses an internal UUID
	// rather than the add-on id in moz-extension:// URLs).
	if (sender.id !== api.runtime.id) return false;

	if (request?.action === "getContextData") {
		if (contextMenuData.selectedText) {
			sendResponse(contextMenuData);
			return false;
		}
		api.storage.local.get(["contextMenuData"], (r) => sendResponse(r.contextMenuData || {}));
		return true; // async response
	}

	if (request?.action === "pathJob:start") {
		startJob(api, request).then(sendResponse);
		return true; // async response
	}
	if (request?.action === "pathJob:cancel") {
		cancelJob(api).then(sendResponse);
		return true;
	}
	if (request?.action === "pathJob:ack") {
		ackJob(api).then(sendResponse);
		return true;
	}

	if (request?.action === "sitemapStart") {
		startSitemap(api, request.domain).then(sendResponse);
		return true;
	}
	if (request?.action === "sitemapStop") {
		stopSitemap(api).then(sendResponse);
		return true;
	}
	if (request?.action === "sitemapClear") {
		clearSitemap(api).then(sendResponse);
		return true;
	}

	if (request?.action === "openUrlsInNewTabs" && request.urls) {
		request.urls.forEach((url) => api.tabs.create({ url, active: false }));
		sendResponse({ status: "success" });
		return false;
	}

	if (request?.action === "openUrlsInNewWindow" && request.urls) {
		api.windows.create({ url: request.urls, incognito: false }, (win) => sendResponse({ status: "success", windowId: win.id }));
		return true;
	}

	if (request?.action === "openUrlsByDomain" && request.domainMap) {
		request.domainMap.forEach(([, urls]) => api.windows.create({ url: urls, incognito: false }));
		sendResponse({ status: "success" });
		return false;
	}

	return false;
});

// ─── Path Finder job resume ───────────────────────────────────────────────────
// The worker can be suspended mid-scan. Job state is persisted after every
// probe, so resuming on worker start and on a 30s alarm picks up where it left off.
getBrowserAPI().alarms?.onAlarm.addListener((a) => {
	if (a.name === ALARM) resumeIfNeeded(getBrowserAPI());
});
resumeIfNeeded(getBrowserAPI());

// ─── Sitemap tracker ──────────────────────────────────────────────────────────
// Records the site's requests while tracking is on (see lib/sitemap.js).
registerSitemap(getBrowserAPI());
