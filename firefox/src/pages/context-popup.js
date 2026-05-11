"use strict";

// ─── Firefox Compatibility ────────────────────────────────────────────────────
// Use 'browser' API in Firefox, fall back to 'chrome' in Chrome
if (typeof browser !== "undefined" && typeof chrome === "undefined") {
	window.chrome = browser;
}

let currentMethod = null;
let currentOperation = null;
let repeatCount = 0;

const repeatCounterEl = document.getElementById("contextRepeatCounter");

// ─── Theme ────────────────────────────────────────────────────────────────────
const darkModeQuery = matchMedia("(prefers-color-scheme: dark)");
function initTheme() {
	const isDark = (theme) =>
		theme === "dark" || (theme === "system" && darkModeQuery.matches);
	const apply = (isDarkMode) =>
		document.documentElement.classList.toggle("dark", isDarkMode);
	apply(isDark(localStorage.getItem("theme") || "system"));
}

// Apply theme immediately before rendering
initTheme();

// Check full-screen mode
if (new URLSearchParams(location.search).get("fullScreen") === "true") {
	document.body.classList.add("full-screen");
}

// Encoding/Decoding functions (self-contained)
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

function showToast(msg, type = "info") {
	const toast = document.getElementById("cp-toast");
	const colors = { info: "#3b82f6", error: "#ef4444", success: "#10b981" };
	toast.style.background = colors[type] || colors.info;
	toast.textContent = msg;
	toast.style.opacity = "1";
	clearTimeout(toast._t);
	toast._t = setTimeout(() => {
		toast.style.opacity = "0";
	}, 2000);
}

// Handle URL params for full-screen mode (selectedText passed via URL)
const urlParams = new URLSearchParams(location.search);
if (urlParams.has("selectedText")) {
	const method = urlParams.get("method");
	const operation = urlParams.get("operation");
	const selectedText = urlParams.get("selectedText");
	if (
		method &&
		operation &&
		selectedText &&
		encodingFunctions[method]?.[operation]
	) {
		currentMethod = method;
		currentOperation = operation;
		document.getElementById("contextInput").value = selectedText;
		document.getElementById("methodDisplay").textContent =
			`${method} (${operation})`;
		try {
			document.getElementById("contextOutput").value =
				encodingFunctions[method][operation](selectedText);
		} catch (e) {
			document.getElementById("contextOutput").value =
				`Error: ${e.message}`;
		}
		repeatCount = 0;
		repeatCounterEl.textContent = 0;
	}
}

// Initialize with data from background script (non-fullscreen mode)
window.addEventListener("DOMContentLoaded", () => {
	if (!urlParams.has("selectedText")) {
		chrome.runtime.sendMessage({ action: "getContextData" }, (response) => {
			if (
				!response?.selectedText ||
				!response.method ||
				!response.operation
			)
				return;
			if (!encodingFunctions[response.method]?.[response.operation])
				return;

			currentMethod = response.method;
			currentOperation = response.operation;

			document.getElementById("contextInput").value =
				response.selectedText;
			document.getElementById("methodDisplay").textContent =
				`${response.method} (${response.operation})`;

			try {
				document.getElementById("contextOutput").value =
					encodingFunctions[response.method][response.operation](
						response.selectedText,
					);
			} catch (e) {
				document.getElementById("contextOutput").value =
					`Error: ${e.message}`;
			}
			repeatCount = 0;
			repeatCounterEl.textContent = 0;
		});
	}

	// Open full-screen tab
	document
		.getElementById("openFullScreenBtn")
		.addEventListener("click", () => {
			if (!currentMethod || !currentOperation) return;
			const inputVal = document.getElementById("contextInput").value;
			if (!inputVal) return;
			const params = new URLSearchParams({
				selectedText: inputVal,
				method: currentMethod,
				operation: currentOperation,
				fullScreen: "true",
			});
			chrome.tabs.create({
				url: chrome.runtime.getURL(
					`src/pages/context-popup.html?${params}`,
				),
			});
			window.close();
		});
});

// Copy button
document
	.getElementById("contextCopyBtn")
	.addEventListener("click", function () {
		const output = document.getElementById("contextOutput").value;
		if (!output) {
			showToast("No output to copy", "error");
			return;
		}
		navigator.clipboard.writeText(output);
		const orig = this.innerHTML;
		this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.25rem"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
		setTimeout(() => {
			this.innerHTML = orig;
		}, 1500);
	});

// Repeat button
document.getElementById("contextRepeatBtn").addEventListener("click", () => {
	if (!currentMethod || !currentOperation) {
		showToast("No encoding method available", "error");
		return;
	}
	const outputEl = document.getElementById("contextOutput");
	if (!outputEl.value.trim()) {
		showToast("No output to repeat", "error");
		return;
	}
	if (!encodingFunctions[currentMethod]?.[currentOperation]) {
		showToast("Invalid encoding method", "error");
		return;
	}
	try {
		outputEl.value = encodingFunctions[currentMethod][currentOperation](
			outputEl.value,
		);
		repeatCounterEl.textContent = ++repeatCount;
	} catch (e) {
		outputEl.value = `Error: ${e.message}`;
	}
});
