// API Compatibility Shim: Provides 'chrome' API for Firefox using 'browser' API
// This allows code written for Chrome to work in Firefox

"use strict";

// Check if we're in Firefox (has browser API but not chrome)
if (typeof browser !== "undefined" && typeof chrome === "undefined") {
	window.chrome = browser;
} else if (typeof browser !== "undefined" && typeof chrome !== "undefined") {
	// In case both exist, make sure we can use both
	// Chrome takes precedence, but provide fallback
	if (!chrome.runtime?.id) {
		window.chrome = browser;
	}
}

// Polyfill chrome.windows if not available (Firefox doesn't have this)
if (!chrome.windows) {
	chrome.windows = {
		create: (options, callback) => {
			// Firefox doesn't support window positioning in the same way
			// We'll fall back to tab creation instead
			if (options.url) {
				chrome.tabs.create({ url: options.url }, (tab) => {
					if (callback) callback(tab);
				});
			}
		},
	};
}
// Polyfill chrome.scripting.executeScript for Firefox compatibility
// Firefox uses 'func' instead of 'function' in the injection object
if (chrome.scripting) {
	const originalExecuteScript = chrome.scripting.executeScript;
	chrome.scripting.executeScript = function (injection, ...args) {
		// Convert 'function' to 'func' for Firefox compatibility
		if (injection && injection.function && !injection.func) {
			const modifiedInjection = {
				...injection,
				func: injection.function,
			};
			delete modifiedInjection.function;
			return originalExecuteScript.call(this, modifiedInjection, ...args);
		}
		return originalExecuteScript.call(this, injection, ...args);
	};
}
