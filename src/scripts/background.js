// Background service worker / background script.
// Bundled by build.js (esbuild, IIFE) so the ES import below works
// identically as a Chrome MV3 service worker and a Firefox background script.
"use strict";

import { collectAllLinksInPage, collectSecretsFromPage } from "../app/lib/collectors.js";

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
];

const METHOD_MAP = Object.fromEntries(ENCODING_METHODS.map((m) => [m.id, { method: m.method, op: m.op }]));

function createContextMenus() {
	const api = getBrowserAPI();
	api.contextMenus.removeAll(() => {
		api.contextMenus.create({ id: "power-toys-page", title: "Power Toys", contexts: ["page"] });
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

// ─── Context menu click handler ───────────────────────────────────────────────
getBrowserAPI().contextMenus.onClicked.addListener(async (info, tab) => {
	const api = getBrowserAPI();
	const { menuItemId, selectionText } = info;

	if (menuItemId === "power-toys-page" || menuItemId === "power-toys-main") {
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
		const secrets =
			secretsResult.status === "fulfilled"
				? (secretsResult.value?.[0]?.result ?? { apiKeys: [], credentials: [], endpoints: [], paths: [], comments: [], hiddenLinks: [] })
				: { apiKeys: [], credentials: [], endpoints: [], paths: [], comments: [], hiddenLinks: [] };

		await api.storage.local.set({ savedLinks: links, savedSecrets: secrets });
		api.tabs.create({ url: api.runtime.getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`) });
		return;
	}

	const methodData = METHOD_MAP[menuItemId];
	if (methodData && selectionText) {
		contextMenuData = { selectedText: selectionText, method: methodData.method, operation: methodData.op };
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
