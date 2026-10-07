import { useEffect, useState } from "react";
import { activeTab, runInTab, storage } from "../lib/browser.js";
import { collectWebStorage, setWebStorageItem, removeWebStorageItem } from "../lib/storageCollectors.js";

const RESTRICTED = /^(chrome|about|edge|brave|moz-extension|chrome-extension)/;

/**
 * Web Storage has no privileged browser API (unlike cookies) — reading or
 * writing it requires injecting a script into the exact page. That only
 * works against a live tab, so:
 *  - popup (live tab): full read + CRUD
 *  - full tab: a cached read-only snapshot, captured the same way links and
 *    secrets are cached for the full-tab view
 */
export function useWebStorage({ fullTab }) {
	const [state, setState] = useState({ status: "loading", local: [], session: [], tabId: null });

	const refresh = async () => {
		if (fullTab) {
			const cached = await storage.get("local", ["savedWebStorage"]);
			const data = cached?.savedWebStorage;
			setState({ status: data ? "ready" : "empty", local: data?.local || [], session: data?.session || [], tabId: null });
			return;
		}
		const tab = await activeTab();
		if (!tab?.url || RESTRICTED.test(tab.url)) {
			setState({ status: "unavailable", local: [], session: [], tabId: null });
			return;
		}
		const result = await runInTab(tab.id, collectWebStorage);
		setState({ status: "ready", local: result?.local || [], session: result?.session || [], tabId: tab.id });
		if (result) storage.set("local", { savedWebStorage: result });
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { refresh(); }, [fullTab]);

	const setItem = async (area, key, value) => {
		if (!state.tabId) return false;
		await runInTab(state.tabId, setWebStorageItem, [area, key, value]);
		await refresh();
		return true;
	};

	const removeItem = async (area, key) => {
		if (!state.tabId) return false;
		await runInTab(state.tabId, removeWebStorageItem, [area, key]);
		await refresh();
		return true;
	};

	return { ...state, editable: !fullTab, refresh, setItem, removeItem };
}
