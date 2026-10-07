/**
 * Thin promise wrapper over the WebExtension API.
 * Uses the `chrome` namespace (callback style) because it works in both
 * Chrome and Firefox; `browser.*` is promise-only and Chrome lacks it.
 *
 * Resolved lazily (not cached at module load) so a preview/test harness can
 * install a mock `window.chrome` after this module has already been
 * imported — ES module imports are hoisted and evaluated before any
 * ordinary script code, so a module-load-time capture would miss a mock
 * set up later in the same entry file.
 */
const api = () => globalThis.chrome ?? globalThis.browser;

const call = (fn, ...args) =>
	new Promise((resolve) =>
		fn(...args, (res) => {
			void api().runtime.lastError; // read it so the browser doesn't log
			resolve(res);
		}),
	);

export const getURL = (path) => api().runtime.getURL(path);
export const getVersion = () => api().runtime.getManifest().version;

export const storage = {
	get: (area, keys) => call(api().storage[area].get.bind(api().storage[area]), keys),
	set: (area, data) => call(api().storage[area].set.bind(api().storage[area]), data),
};

export const sendMessage = (msg) =>
	call(api().runtime.sendMessage.bind(api().runtime), msg);

export const openTab = (url) => api().tabs.create({ url });

export const activeTab = async () =>
	(await call(api().tabs.query.bind(api().tabs), { active: true, currentWindow: true }))?.[0];

/** Run a self-contained function inside a tab and return its result.
 * `args` are passed through to the injected function (and must be
 * JSON-serializable, same constraint as the rest of the scripting API). */
export const runInTab = async (tabId, func, args = []) =>
	(
		await call(api().scripting.executeScript.bind(api().scripting), {
			target: { tabId },
			func,
			args,
		})
	)?.[0]?.result;

export const cookies = {
	getAll: (details) => call(api().cookies.getAll.bind(api().cookies), details),
	set: (details) => call(api().cookies.set.bind(api().cookies), details),
	remove: (details) => call(api().cookies.remove.bind(api().cookies), details),
};
