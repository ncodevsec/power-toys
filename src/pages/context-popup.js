// Context popup — show result of right-click encode/decode on selected text
let currentMethod = null;
let currentOperation = null;
let repeatCount = 0;

const repeatCounterEl = document.getElementById("contextRepeatCounter");

// Check full-screen mode
if (new URLSearchParams(location.search).has("fullScreen")) {
	document.body.classList.add("full-screen");
}

// Encoding/Decoding functions (self-contained — separate page from popup)
const encodingFunctions = {
	base64: {
		encode: (t) => btoa(unescape(encodeURIComponent(t))),
		decode: (t) => decodeURIComponent(escape(atob(t))),
	},
	url: { encode: encodeURIComponent, decode: decodeURIComponent },
	html: {
		encode: (t) => { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; },
		decode: (t) => { const d = document.createElement("div"); d.innerHTML = t; return d.textContent || d.innerText || ""; },
	},
	hex: {
		encode: (t) => Array.from(t, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
		decode: (t) => { const s = t.replace(/\s/g, ""); let r = ""; for (let i = 0; i < s.length; i += 2) r += String.fromCharCode(parseInt(s.substr(i, 2), 16)); return r; },
	},
	unicode: {
		encode: (t) => Array.from(t, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join(""),
		decode: (t) => t.replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16))),
	},
};

// Initialize with data from background script
window.addEventListener("DOMContentLoaded", () => {
	chrome.runtime.sendMessage({ action: "getContextData" }, (response) => {
		if (!response?.selectedText || !response.method || !response.operation) return;

		currentMethod = response.method;
		currentOperation = response.operation;

		document.getElementById("contextInput").value = response.selectedText;
		document.getElementById("methodDisplay").textContent = `${response.method} (${response.operation})`;

		try {
			document.getElementById("contextOutput").value = encodingFunctions[response.method][response.operation](response.selectedText);
		} catch (e) {
			document.getElementById("contextOutput").value = `Error: ${e.message}`;
		}
		repeatCount = 0;
		repeatCounterEl.textContent = 0;
	});

	// Open full-screen tab
	document.getElementById("openFullScreenBtn").addEventListener("click", () => {
		chrome.runtime.sendMessage({ action: "getContextData" }, (response) => {
			if (!response?.selectedText || !response.method || !response.operation) return;
			const params = new URLSearchParams({ selectedText: response.selectedText, method: response.method, operation: response.operation, fullScreen: "true" });
			chrome.tabs.create({ url: chrome.runtime.getURL(`src/pages/context-popup.html?${params}`) });
			window.close();
		});
	});
});

// Copy button
document.getElementById("contextCopyBtn").addEventListener("click", function () {
	const output = document.getElementById("contextOutput").value;
	if (!output) { alert("No output to copy"); return; }
	navigator.clipboard.writeText(output);
	const orig = this.innerHTML;
	this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;margin-right:0.25rem"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
	setTimeout(() => { this.innerHTML = orig; }, 1500);
});

// Repeat button
document.getElementById("contextRepeatBtn").addEventListener("click", () => {
	if (!currentMethod || !currentOperation) { alert("No encoding method available"); return; }
	const outputEl = document.getElementById("contextOutput");
	if (!outputEl.value.trim()) { alert("No output to repeat"); return; }
	try {
		outputEl.value = encodingFunctions[currentMethod][currentOperation](outputEl.value);
		repeatCounterEl.textContent = ++repeatCount;
	} catch (e) {
		outputEl.value = `Error: ${e.message}`;
	}
});
