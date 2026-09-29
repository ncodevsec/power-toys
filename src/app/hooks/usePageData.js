import { useEffect, useState } from "react";
import { activeTab, runInTab, storage } from "../lib/browser.js";
import { collectAllLinksInPage, collectSecretsFromPage } from "../lib/collectors.js";

export const EMPTY_SECRETS = { apiKeys: [], credentials: [], endpoints: [], paths: [], comments: [], hiddenLinks: [] };
const RESTRICTED = /^(chrome|about|edge|brave|moz-extension|chrome-extension)/;

/**
 * Loads links + secrets for the inspected page.
 * - popup: scans the active tab and caches the result for the full-tab view
 * - full tab: reads the cache written by the popup / context-menu action
 */
export function usePageData({ fullTab }) {
	const [state, setState] = useState({ status: "loading", links: [], secrets: EMPTY_SECRETS, domain: "" });

	useEffect(() => {
		let alive = true;
		const set = (patch) => alive && setState((s) => ({ ...s, ...patch }));

		(async () => {
			if (fullTab) {
				const domain = new URLSearchParams(location.search).get("domain") || "";
				let data = await storage.get("local", ["savedLinks", "savedSecrets"]);
				if (!data?.savedLinks?.length) {
					await new Promise((r) => setTimeout(r, 250)); // background race
					data = await storage.get("local", ["savedLinks", "savedSecrets"]);
				}
				const links = data?.savedLinks || [];
				set({ domain, links, secrets: data?.savedSecrets || EMPTY_SECRETS, status: links.length ? "ready" : "empty" });
				return;
			}
			const tab = await activeTab();
			if (!tab?.url || RESTRICTED.test(tab.url)) return set({ status: "unavailable" });
			let domain = "";
			try { domain = new URL(tab.url).hostname; } catch {}
			set({ domain });
			const [links, secrets] = await Promise.all([
				runInTab(tab.id, collectAllLinksInPage),
				runInTab(tab.id, collectSecretsFromPage),
			]);
			if (links) storage.set("local", { savedLinks: links });
			if (secrets) storage.set("local", { savedSecrets: secrets });
			set({ links: links || [], secrets: secrets || EMPTY_SECRETS, status: "ready" });
		})();

		return () => { alive = false; };
	}, [fullTab]);

	return state;
}
