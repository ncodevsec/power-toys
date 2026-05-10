// === State ===
let allLinksGlobal = [];
let currentCategory = "All";
let currentSearchQuery = "";
let showOnlySensitiveLinks = false;
let cachedDomain = "";

let SENSITIVE_PATTERNS = { params: [], urlPatterns: [] };
let DEFAULT_PATTERNS_RAW = { params: [], urlPatterns: [] };

// === Pattern Utilities ===

function parseUrlPatterns(rawPatterns = []) {
	return rawPatterns.map((p) => {
		const m = p.match(/^\/(.*)\/([igm]*)$/);
		try {
			return m ? new RegExp(m[1], m[2]) : new RegExp(p);
		} catch {
			return new RegExp(p);
		}
	});
}

function applyPatterns(patterns) {
	if (patterns.params) SENSITIVE_PATTERNS.params = patterns.params;
	if (patterns.urlPatterns)
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(patterns.urlPatterns);
}

async function loadPatterns() {
	// Load defaults from JSON
	try {
		const res = await fetch(chrome.runtime.getURL("config/defaults.json"));
		const defaults = await res.json();
		DEFAULT_PATTERNS_RAW = {
			params: defaults.params || [],
			urlPatterns: defaults.urlPatterns || [],
		};
		SENSITIVE_PATTERNS.params = defaults.params || [];
		SENSITIVE_PATTERNS.urlPatterns = parseUrlPatterns(defaults.urlPatterns);
	} catch (e) {
		console.error("Error loading default patterns:", e);
	}

	// Override with custom patterns from storage (sync first, fallback to local)
	await new Promise((resolve) => {
		chrome.storage.sync.get(["sensitivePatterns"], (result) => {
			if (result.sensitivePatterns) {
				applyPatterns(result.sensitivePatterns);
				return resolve();
			}
			chrome.storage.local.get(["sensitivePatterns"], (local) => {
				if (local.sensitivePatterns)
					applyPatterns(local.sensitivePatterns);
				resolve();
			});
		});
	});
}

// === Link Collection (injected into page via executeScript) ===

function collectAllLinksInPage() {
	const uniqueLinks = new Map();
	const IMG_RE = /\.(jpeg|jpg|gif|png|svg|webp|ico)$/i;
	const EXT_RE = /\.[a-zA-Z0-9]+$/;
	const selectors =
		"a[href],link[href],script[src],img[src],iframe[src],source[src],video[src],audio[src],[data-url]";

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
			uniqueLinks.set(url, {
				fullUrl: url,
				category,
				domain: hostname,
				path: pathname + search + hash || "/",
			});
		} catch {}
	}
	return [...uniqueLinks.values()];
}

// === Sensitive Detection ===

function isSensitiveLink(url) {
	try {
		const { pathname, search, searchParams } = new URL(url);
		const path = pathname + search;
		return (
			SENSITIVE_PATTERNS.urlPatterns.some((p) => p.test(path)) ||
			SENSITIVE_PATTERNS.params.some((p) => searchParams.has(p))
		);
	} catch {
		return false;
	}
}

function isSensitiveParam(name) {
	const lower = name.toLowerCase();
	return SENSITIVE_PATTERNS.params.some(
		(p) => lower.includes(p) || p.includes(lower),
	);
}

// === Theme ===

function initTheme() {
	const select = document.getElementById("themeSelect");
	const apply = (theme) => {
		const dark =
			theme === "dark" ||
			(theme === "system" &&
				matchMedia("(prefers-color-scheme: dark)").matches);
		document.documentElement.classList.toggle("dark", dark);
	};
	select.addEventListener("change", (e) => {
		apply(e.target.value);
		localStorage.setItem("theme", e.target.value);
	});
	const saved = localStorage.getItem("theme") || "system";
	select.value = saved;
	apply(saved);
}

// === Tab Switching ===

document.getElementById("topLevelTabBar").addEventListener("click", (e) => {
	const topLevel = e.target.dataset.toplevel;
	if (!topLevel) return;
	document
		.querySelectorAll("#topLevelTabBar .top-level-tab")
		.forEach((el) => el.classList.remove("tab-active"));
	e.target.classList.add("tab-active");
	document
		.querySelectorAll(".section-content")
		.forEach((el) => el.classList.add("hidden"));
	document.getElementById(`${topLevel}-section`)?.classList.remove("hidden");
});

// Settings sub-tab switching via delegation
document.addEventListener("click", (e) => {
	const tab = e.target.closest(".settings-tab");
	if (!tab?.dataset.settingsTab) return;
	document
		.querySelectorAll(".settings-tab")
		.forEach((t) => t.classList.remove("active"));
	document
		.querySelectorAll(".settings-tab-content")
		.forEach((c) => c.classList.remove("active"));
	tab.classList.add("active");
	document.getElementById(tab.dataset.settingsTab)?.classList.add("active");
});

// Links sub-tab switching
document.getElementById("linksSubTabBar").addEventListener("click", (e) => {
	if (e.target.closest("#sensitiveLinkFilterBtn")) {
		showOnlySensitiveLinks = !showOnlySensitiveLinks;
		document
			.getElementById("sensitiveLinkFilterBtn")
			.classList.toggle("filter-active", showOnlySensitiveLinks);
		if (!document.getElementById("links-view").classList.contains("hidden"))
			renderLinks();
		else if (
			!document.getElementById("params-view").classList.contains("hidden")
		)
			renderParams();
		return;
	}

	const subTab = e.target.dataset.subtab;
	if (!subTab) return;

	document
		.querySelectorAll("#linksSubTabBar .sub-tab-item")
		.forEach((el) => el.classList.remove("sub-tab-active"));
	e.target.classList.add("sub-tab-active");

	const isParams = subTab === "links-params";
	document.getElementById("links-view").classList.toggle("hidden", isParams);
	document
		.getElementById("params-view")
		.classList.toggle("hidden", !isParams);

	if (isParams) {
		renderParams();
		return;
	}

	const CAT_MAP = {
		"links-all": "All",
		"links-paths": "Paths",
		"links-javascript": "JavaScript",
		"links-json": "JSON",
		"links-images": "Images",
		"links-others": "Others",
	};
	currentCategory = CAT_MAP[subTab] || "All";
	renderLinks();
});

// Search
document.getElementById("searchInput").addEventListener("input", (e) => {
	currentSearchQuery = e.target.value.toLowerCase();
	if (!document.getElementById("links-view").classList.contains("hidden"))
		renderLinks();
	else if (
		!document.getElementById("params-view").classList.contains("hidden")
	)
		renderParams();
});

// === Render Functions ===

function renderLinks() {
	const resultsDiv = document.getElementById("links-view");
	resultsDiv.innerHTML = "";

	// Update category tab counts
	for (const tab of document.querySelectorAll("#tabBar .tab-item")) {
		const type = tab.dataset.type;
		const count = allLinksGlobal.filter(
			(l) => type === "All" || l.category === type,
		).length;
		tab.innerHTML = `${type} <span class="tab-count">${count}</span>`;
	}

	const filtered = allLinksGlobal
		.filter(
			(l) => currentCategory === "All" || l.category === currentCategory,
		)
		.filter(
			(l) =>
				!currentSearchQuery ||
				l.fullUrl.toLowerCase().includes(currentSearchQuery) ||
				l.domain.includes(currentSearchQuery) ||
				l.path.toLowerCase().includes(currentSearchQuery),
		)
		.filter((l) => !showOnlySensitiveLinks || isSensitiveLink(l.fullUrl));

	if (!filtered.length) {
		resultsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">Search</div><p class="font-semibold">No links found</p><p class="text-xs mt-1">Try adjusting your search or category filters</p></div>`;
		document.getElementById("searchResults").classList.add("hidden");
		return;
	}

	// Group by domain
	const grouped = {};
	const mainBase = cachedDomain.replace("www.", "");
	for (const link of filtered) (grouped[link.domain] ||= []).push(link);

	const sortedDomains = Object.keys(grouped).sort((a, b) => {
		if (a === cachedDomain) return -1;
		if (b === cachedDomain) return 1;
		const aRel = a === mainBase || a.endsWith("." + mainBase);
		const bRel = b === mainBase || b.endsWith("." + mainBase);
		if (aRel !== bRel) return aRel ? -1 : 1;
		return a
			.split(".")
			.reverse()
			.join(".")
			.localeCompare(b.split(".").reverse().join("."));
	});

	const frag = document.createDocumentFragment();
	for (const domain of sortedDomains) {
		const links = grouped[domain].sort((a, b) =>
			a.path.localeCompare(b.path),
		);
		const section = document.createElement("div");
		section.className = "cyber-card";
		section.innerHTML = `
			<div class="domain-header-box">
				<div class="flex items-center">
					<img src="https://www.google.com/s2/favicons?sz=64&domain=${domain}" class="w-5 h-5 mr-3 rounded bg-white" onerror="this.src='images/links16.ico'">
					<h2 class="text-sm font-bold truncate" style="max-width:250px">${domain}</h2>
				</div>
				<span class="badge-count">${links.length} Links</span>
			</div>
			<ul class="space-y-2 ml-2">
				${links
					.map((link) => {
						const sensitive = isSensitiveLink(link.fullUrl);
						return `<li class="flex items-center text-sm">
						<span class="bullet-point mr-2">•</span>
						<a href="${link.fullUrl}" target="_blank" class="cyber-link text-blue-500 font-semibold" title="${link.fullUrl}">${link.path}</a>
						${sensitive ? '<span class="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded">Sensitive</span>' : ""}
					</li>`;
					})
					.join("")}
			</ul>`;
		frag.appendChild(section);
	}
	resultsDiv.appendChild(frag);

	const searchEl = document.getElementById("searchResults");
	if (currentSearchQuery) {
		searchEl.textContent = `Found ${filtered.length} link${filtered.length !== 1 ? "s" : ""}`;
		searchEl.classList.remove("hidden");
	} else {
		searchEl.classList.add("hidden");
	}
}

function renderParams() {
	const paramsDiv = document.getElementById("params-view");
	paramsDiv.innerHTML = "";

	const allParams = {};
	for (const link of allLinksGlobal) {
		try {
			const { hostname: domain, searchParams } = new URL(link.fullUrl);
			const domParams = (allParams[domain] ||= {});
			searchParams.forEach((value, key) => {
				const entry = (domParams[key] ||= {
					values: new Set(),
					sources: [],
				});
				entry.values.add(value);
				if (!entry.sources.some((s) => s.fullUrl === link.fullUrl))
					entry.sources.push({
						path: link.path,
						fullUrl: link.fullUrl,
					});
			});
		} catch {}
	}

	let domains = Object.entries(allParams)
		.filter(([, p]) => Object.keys(p).length > 0)
		.sort((a, b) => a[0].localeCompare(b[0]));

	if (currentSearchQuery || showOnlySensitiveLinks) {
		domains = domains
			.map(([domain, params]) => {
				const filtered = Object.fromEntries(
					Object.entries(params).filter(([name, data]) => {
						const matchSearch =
							!currentSearchQuery ||
							name.toLowerCase().includes(currentSearchQuery) ||
							[...data.values].some((v) =>
								v.toLowerCase().includes(currentSearchQuery),
							) ||
							domain.toLowerCase().includes(currentSearchQuery);
						return (
							matchSearch &&
							(!showOnlySensitiveLinks || isSensitiveParam(name))
						);
					}),
				);
				return [domain, filtered];
			})
			.filter(([, p]) => Object.keys(p).length > 0);
	}

	if (!domains.length) {
		paramsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-gray-500"><div class="text-4xl mb-3">No mail</div><p class="font-semibold">No parameters found</p><p class="text-xs mt-1">No URL parameters were detected on this page</p></div>`;
		return;
	}

	const frag = document.createDocumentFragment();
	for (const [domain, params] of domains) {
		const entries = Object.entries(params).sort((a, b) =>
			a[0].localeCompare(b[0]),
		);
		const section = document.createElement("div");
		section.className = "cyber-card";
		const items = entries
			.map(([name, data]) => {
				const sensitive = isSensitiveParam(name);
				const values = [...data.values].slice(0, 3);
				const more = data.values.size - 3;
				return `<li class="text-sm">
				<div class="flex items-center">
					<span class="bullet-point mr-2">•</span>
					<span class="font-semibold">${name}</span>
					${sensitive ? '<span class="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-2 py-0.5 rounded">Sensitive</span>' : ""}
					<span class="ml-2 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">${data.sources.length} link${data.sources.length !== 1 ? "s" : ""}</span>
				</div>
				<div class="text-xs text-gray-600 dark:text-gray-400 ml-4 mt-2">
					${values.map((v) => `<div class="break-all"><code>${v.substring(0, 50)}${v.length > 50 ? "..." : ""}</code></div>`).join("")}
					${more > 0 ? `<div class="text-gray-500 italic">+${more} more value${more > 1 ? "s" : ""}</div>` : ""}
				</div>
			</li>`;
			})
			.join("");
		section.innerHTML = `
			<div class="domain-header-box">
				<div class="flex items-center">
					<img src="https://www.google.com/s2/favicons?sz=64&domain=${domain}" class="w-5 h-5 mr-3 rounded bg-white" onerror="this.src='images/links16.ico'">
					<h2 class="text-sm font-bold truncate" style="max-width:250px">${domain}</h2>
				</div>
				<span class="badge-count">${entries.length} Params</span>
			</div>
			<ul class="space-y-3 ml-2">${items}</ul>`;
		frag.appendChild(section);
	}
	paramsDiv.appendChild(frag);
}

// === Encoding / Decoding ===

const encodingFunctions = {
	base64: {
		encode: (t) => btoa(unescape(encodeURIComponent(t))),
		decode: (t) => decodeURIComponent(escape(atob(t))),
	},
	url: { encode: encodeURIComponent, decode: decodeURIComponent },
	html: {
		encode: (t) => {
			const d = document.createElement("div");
			d.textContent = t;
			return d.innerHTML;
		},
		decode: (t) => {
			const d = document.createElement("div");
			d.innerHTML = t;
			return d.textContent || d.innerText || "";
		},
	},
	hex: {
		encode: (t) =>
			Array.from(t, (c) =>
				c.charCodeAt(0).toString(16).padStart(2, "0"),
			).join(""),
		decode: (t) => {
			const s = t.replace(/\s/g, "");
			let r = "";
			for (let i = 0; i < s.length; i += 2)
				r += String.fromCharCode(parseInt(s.substr(i, 2), 16));
			return r;
		},
	},
	unicode: {
		encode: (t) =>
			Array.from(
				t,
				(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
			).join(""),
		decode: (t) =>
			t.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) =>
				String.fromCharCode(parseInt(c, 16)),
			),
	},
};

const encodeInput = document.getElementById("encodeInput");
const encodeMethod = document.getElementById("encodeMethod");
const encodeOutput = document.getElementById("encodeOutput");
const repeatCounter = document.getElementById("repeatCounter");

let lastOperation = null,
	lastMethod = null,
	repeatCount = 0;

function runEncoding(op) {
	const method = encodeMethod.value;
	if (!method) {
		alert("Please select an encoding method");
		return;
	}
	try {
		encodeOutput.value = encodingFunctions[method][op](encodeInput.value);
		lastOperation = op;
		lastMethod = method;
		repeatCount = 0;
		repeatCounter.textContent = 0;
	} catch (e) {
		encodeOutput.value = `Error: ${e.message}`;
	}
}

document
	.getElementById("encodeBtn")
	.addEventListener("click", () => runEncoding("encode"));
document
	.getElementById("decodeBtn")
	.addEventListener("click", () => runEncoding("decode"));

document.getElementById("repeatBtn").addEventListener("click", () => {
	if (!lastOperation || !lastMethod) {
		alert("Please perform an encode/decode operation first");
		return;
	}
	if (!encodeOutput.value.trim()) {
		alert("No output to repeat");
		return;
	}
	try {
		encodeOutput.value = encodingFunctions[lastMethod][lastOperation](
			encodeOutput.value,
		);
		repeatCounter.textContent = ++repeatCount;
	} catch (e) {
		encodeOutput.value = `Error: ${e.message}`;
	}
});

function flashCopied(btn, origHtml) {
	btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.5rem"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
	setTimeout(() => {
		btn.innerHTML = origHtml;
	}, 1500);
}

document.getElementById("copyResultBtn").addEventListener("click", function () {
	if (!encodeOutput.value) {
		alert("No output to copy");
		return;
	}
	navigator.clipboard.writeText(encodeOutput.value);
	flashCopied(this, this.innerHTML);
});

document.getElementById("copyBtn").addEventListener("click", function () {
	navigator.clipboard.writeText(
		allLinksGlobal.map((l) => l.fullUrl).join("\n"),
	);
	const orig = this.innerHTML;
	this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
	setTimeout(() => {
		this.innerHTML = orig;
	}, 1500);
});

document.getElementById("openTabBtn").addEventListener("click", async () => {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	const domain = new URL(tab.url).hostname;
	chrome.tabs.create({
		url: chrome.runtime.getURL(
			`src/pages/popup.html?fullTab=true&domain=${domain}`,
		),
	});
});

document.getElementById("settingsBtn")?.addEventListener("click", () => {
	document.querySelector('[data-toplevel="settings"]')?.click();
});

// === Settings Functions ===

function loadPopupSettings() {
	chrome.storage.local.get(["sensitivePatterns"], (local) => {
		const patterns = local.sensitivePatterns || {
			params: SENSITIVE_PATTERNS.params,
			urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
		};
		const paramsEl = document.getElementById("sensitiveParams");
		const urlsEl = document.getElementById("urlPatterns");
		if (!paramsEl || !urlsEl) return;
		paramsEl.value = Array.isArray(patterns.params)
			? patterns.params.join(", ")
			: "";
		urlsEl.value = Array.isArray(patterns.urlPatterns)
			? patterns.urlPatterns.join("\n")
			: "";
	});
}

function savePopupSettings() {
	const paramsEl = document.getElementById("sensitiveParams");
	const urlsEl = document.getElementById("urlPatterns");
	if (!paramsEl || !urlsEl) return;
	const params = paramsEl.value
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean);
	const urlPatterns = urlsEl.value
		.split("\n")
		.map((p) => p.trim())
		.filter(Boolean);
	if (!params.length && !urlPatterns.length) {
		alert("Please enter at least one parameter or URL pattern");
		return;
	}
	const patterns = { params, urlPatterns };
	chrome.storage.sync.set({ sensitivePatterns: patterns });
	chrome.storage.local.set({ sensitivePatterns: patterns }, () => {
		alert("Settings saved successfully!");
		applyPatterns(patterns);
	});
}

function resetPopupToDefaults() {
	if (!confirm("Reset to default patterns?")) return;
	const defaults = {
		params: DEFAULT_PATTERNS_RAW.params,
		urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
	};
	chrome.storage.sync.set({ sensitivePatterns: defaults });
	chrome.storage.local.set({ sensitivePatterns: defaults }, () => {
		alert("Reset to defaults!");
		applyPatterns(defaults);
		loadPopupSettings();
	});
}

function exportPopupSettings() {
	chrome.storage.local.get(["sensitivePatterns"], (result) => {
		const patterns = result.sensitivePatterns || {
			params: SENSITIVE_PATTERNS.params,
			urlPatterns: DEFAULT_PATTERNS_RAW.urlPatterns,
		};
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(patterns, null, 2)], {
				type: "application/json",
			}),
		);
		const a = Object.assign(document.createElement("a"), {
			href: url,
			download: `power-toys-settings-${Date.now()}.json`,
		});
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		alert("Settings exported!");
	});
}

function importPopupSettings() {
	const input = Object.assign(document.createElement("input"), {
		type: "file",
		accept: ".json",
	});
	input.addEventListener("change", (e) => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				const patterns = JSON.parse(ev.target.result);
				if (!patterns.params || !patterns.urlPatterns) {
					alert("Invalid settings file format!");
					return;
				}
				chrome.storage.sync.set({ sensitivePatterns: patterns });
				chrome.storage.local.set(
					{ sensitivePatterns: patterns },
					() => {
						alert("Settings imported successfully!");
						applyPatterns(patterns);
						loadPopupSettings();
					},
				);
			} catch {
				alert("Error parsing settings file!");
			}
		};
		reader.readAsText(file);
	});
	input.click();
}

function attachEventListeners() {
	// Use event delegation for settings buttons (works for both parameter-keywords and url-patterns tabs)
	document.addEventListener("click", (e) => {
		if (e.target.closest(".settings-save-btn")) savePopupSettings();
		if (e.target.closest(".settings-reset-btn")) resetPopupToDefaults();
	});

	document
		.getElementById("popupExportBtn")
		?.addEventListener("click", exportPopupSettings);
	document
		.getElementById("popupImportBtn")
		?.addEventListener("click", importPopupSettings);
	document
		.querySelector('[data-toplevel="settings"]')
		?.addEventListener("click", () => {
			setTimeout(loadPopupSettings, 50);
		});
}

// === Init ===

document.addEventListener("DOMContentLoaded", async () => {
	initTheme();
	await loadPatterns();
	attachEventListeners();

	const urlParams = new URLSearchParams(location.search);
	const isFullTab = urlParams.has("fullTab");

	if (isFullTab) {
		document.body.classList.add("full-tab");
		document.getElementById("openTabBtn").style.display = "none";
		cachedDomain = urlParams.get("domain") || "";

		chrome.storage.local.get(["savedLinks"], (data) => {
			if (data.savedLinks) {
				allLinksGlobal = data.savedLinks;
				renderLinks();
			} else {
				// Retry once — storage write from background may still be in flight
				setTimeout(() => {
					chrome.storage.local.get(["savedLinks"], (data2) => {
						allLinksGlobal = data2.savedLinks || [];
						if (allLinksGlobal.length) renderLinks();
						else
							document.getElementById("links-view").innerHTML =
								'<p class="text-yellow-500 text-center">No links found. Try opening from the extension popup instead.</p>';
					});
				}, 200);
			}
		});
	} else {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tab.url.startsWith("chrome")) {
			document.getElementById("results").innerHTML =
				'<p class="text-red-500 text-center">Unavailable on this page.</p>';
			return;
		}
		try {
			cachedDomain = new URL(tab.url).hostname;
		} catch {}

		chrome.scripting.executeScript(
			{ target: { tabId: tab.id }, function: collectAllLinksInPage },
			(results) => {
				if (results?.[0]) {
					allLinksGlobal = results[0].result;
					chrome.storage.local.set({ savedLinks: allLinksGlobal });
					renderLinks();
				}
			},
		);
	}
});
