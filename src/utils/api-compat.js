/**
 * API Compatibility Layer
 *
 * Provides unified browser API access for Chrome and Firefox.
 * In Chrome: Uses the native chrome.* APIs
 * In Firefox: Uses the browser.* APIs
 *
 * Usage: const api = window.getBrowserAPI();
 */

"use strict";

/**
 * Get the appropriate browser API object
 * @returns {Object} chrome or browser API object
 */
window.getBrowserAPI = () => {
	if (typeof chrome !== "undefined" && chrome.runtime) {
		return chrome;
	}
	if (typeof browser !== "undefined" && browser.runtime) {
		return browser;
	}
	// Fallback - shouldn't happen in normal usage
	console.warn(
		"[API Compat] Neither chrome nor browser API available. Using browser as fallback.",
	);
	return browser || chrome;
};

// Get the appropriate API reference
const api = window.getBrowserAPI();

// Polyfill chrome.windows for Firefox if needed
// Firefox doesn't support window positioning in the same way
if (
	typeof chrome !== "undefined" &&
	!chrome.windows &&
	typeof browser !== "undefined"
) {
	if (browser.windows) {
		chrome.windows = browser.windows;
	} else {
		// Fallback for Firefox: use tab creation instead of window creation
		chrome.windows = {
			create: (options, callback) => {
				if (options.url) {
					browser.tabs.create(
						{ url: options.url, active: options.focused !== false },
						(tab) => {
							if (callback) callback(tab);
						},
					);
				}
			},
		};
	}
}

// Polyfill chrome.scripting.executeScript for Firefox compatibility
// Firefox uses 'func' instead of 'function' in the injection object
if (typeof chrome !== "undefined" && chrome.scripting) {
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

// Store API reference globally for easy access throughout the extension
window.api = api;
