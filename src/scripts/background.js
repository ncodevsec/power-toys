// Background script for context menu and message handling
let contextMenuData = {};

// Link collection function — injected into page via executeScript
function collectAllLinksInPage() {
	const uniqueLinks = new Map();
	const IMG_RE = /\.(jpeg|jpg|gif|png|svg|webp|ico)$/i;
	const EXT_RE = /\.[a-zA-Z0-9]+$/;
	const selectors = "a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";

	for (const tag of document.querySelectorAll(selectors)) {
		const url = tag.href || tag.src || tag.getAttribute("data-url");
		if (!url?.startsWith("http") || uniqueLinks.has(url)) continue;

		const cleanUrl = url.split("?")[0].split("#")[0];
		let category;
		if (cleanUrl.endsWith(".js")) category = "JavaScript";
		else if (cleanUrl.endsWith(".json")) category = "JSON";
		else if (IMG_RE.test(cleanUrl)) category = "Images";
		else if (EXT_RE.test(cleanUrl)) category = "Others";
		else category = "Paths";

		try {
			const { hostname, pathname, search, hash } = new URL(url);
			uniqueLinks.set(url, { fullUrl: url, category, domain: hostname, path: pathname + search + hash || "/" });
		} catch {}
	}
	return [...uniqueLinks.values()];
}

// Context menu setup
const ENCODING_METHODS = [
	{ id: "encode-base64",   title: "Base64 Encode",        method: "base64",   op: "encode" },
	{ id: "decode-base64",   title: "Base64 Decode",        method: "base64",   op: "decode" },
	{ id: "encode-url",      title: "URL Encode",           method: "url",      op: "encode" },
	{ id: "decode-url",      title: "URL Decode",           method: "url",      op: "decode" },
	{ id: "encode-html",     title: "HTML Entity Encode",   method: "html",     op: "encode" },
	{ id: "decode-html",     title: "HTML Entity Decode",   method: "html",     op: "decode" },
	{ id: "encode-hex",      title: "Hex Encode",           method: "hex",      op: "encode" },
	{ id: "decode-hex",      title: "Hex Decode",           method: "hex",      op: "decode" },
	{ id: "encode-unicode",  title: "Unicode Encode",       method: "unicode",  op: "encode" },
	{ id: "decode-unicode",  title: "Unicode Decode",       method: "unicode",  op: "decode" },
];

// Build a fast lookup map from the array — no duplication
const METHOD_MAP = Object.fromEntries(ENCODING_METHODS.map((m) => [m.id, { method: m.method, op: m.op }]));

function createContextMenus() {
	chrome.contextMenus.removeAll();

	chrome.contextMenus.create({
		id: "power-toys-main",
		title: "Power Toys",
		contexts: ["page", "selection", "link", "image"],
	});

	chrome.contextMenus.create({
		id: "encode-decode-parent",
		title: "Encode/Decode",
		parentId: "power-toys-main",
		contexts: ["selection"],
	});

	for (const item of ENCODING_METHODS) {
		chrome.contextMenus.create({
			id: item.id,
			title: item.title,
			parentId: "encode-decode-parent",
			contexts: ["selection"],
		});
	}
}

chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.sync.get(["sensitivePatterns"], (result) => {
		if (!result.sensitivePatterns) {
			fetch(chrome.runtime.getURL("config/defaults.json"))
				.then((r) => r.json())
				.then((defaults) => {
					chrome.storage.sync.set({ sensitivePatterns: defaults });
					chrome.storage.local.set({ sensitivePatterns: defaults });
				})
				.catch(() => {
					const empty = { params: [], urlPatterns: [] };
					chrome.storage.sync.set({ sensitivePatterns: empty });
					chrome.storage.local.set({ sensitivePatterns: empty });
				});
		}
	});
	createContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
	const { menuItemId, selectionText } = info;

	if (menuItemId === "power-toys-main") {
		chrome.scripting.executeScript(
			{ target: { tabId: tab.id }, function: collectAllLinksInPage },
			(results) => {
				const links = results?.[0]?.result ?? [];
				chrome.storage.local.set({ savedLinks: links }, () => {
					chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/popup.html?fullTab=true") });
				});
			}
		);
		return;
	}

	const methodData = METHOD_MAP[menuItemId];
	if (methodData) {
		contextMenuData = { selectedText: selectionText, method: methodData.method, operation: methodData.op };
		chrome.windows.create({
			url: chrome.runtime.getURL("src/pages/context-popup.html"),
			type: "popup",
			width: 500,
			height: 500,
		});
	}
});

// Provide context data to context popup on request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "getContextData") sendResponse(contextMenuData);
});
