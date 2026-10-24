import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader, FullTabButton, SettingsButton, ThemeSwitch } from "../components/AppHeader.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { SidePanel } from "../components/SidePanel.jsx";
import { CommandPalette } from "../components/CommandPalette.jsx";
import { Onboarding } from "../components/Onboarding.jsx";
import { EmptyState, IconButton, Spinner, Tabs } from "../components/ui/index.js";
import { Footer } from "../components/Footer.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { usePageData } from "../hooks/usePageData.js";
import { getURL, openTab } from "../lib/browser.js";
import { TOP_TABS, RECON_SUBTABS, CIPHER_SUBTABS, UTILITIES_SUBTABS, DESTINATIONS } from "../lib/navigation.js";
import { CIPHERS } from "../lib/encoding.js";
import { CIPHER_HISTORY_KEY, PATH_HISTORY_KEY } from "../lib/history.js";
import { storage } from "../lib/browser.js";
import { useToast } from "../providers.jsx";
import LinksTab from "../tabs/LinksTab.jsx";
import ParamsTab from "../tabs/ParamsTab.jsx";
import SecretsTab from "../tabs/SecretsTab.jsx";
import PathsTab from "../tabs/PathsTab.jsx";
import HeadersTab from "../tabs/HeadersTab.jsx";
import SitemapTab from "../tabs/SitemapTab.jsx";
import UtilitiesTab from "../tabs/UtilitiesTab.jsx";
import CipherTab from "../tabs/CipherTab.jsx";
import StorageTab from "../tabs/StorageTab.jsx";
import CookiesTab from "../tabs/CookiesTab.jsx";
import SettingsTab from "../tabs/SettingsTab.jsx";

const RECON_SCAN_ONLY = new Set(["links", "params", "secrets"]); // sub-tabs gated by the page link/secret scan status; paths/headers run their own independent fetches

export default function App({ fullTab = false }) {
	const [theme, setTheme] = useTheme();
	// `tab` holds the last-selected top-level tab; `reconSubTab`/`cipherSubTab`
	// are which child is showing within those two grouped tabs; `showSettings`
	// is a separate overlay-like toggle so the gear button can open AND close
	// settings, landing back on whichever tab was active. `settingsSection` is
	// lifted here (not owned by SettingsTab) so it can drive both the popup's
	// horizontal tabs and the full-tab sidebar's settings nav from one state.
	const [tab, setTab] = useState("recon");
	const [reconSubTab, setReconSubTab] = useState("links");
	const [cipherSubTab, setCipherSubTab] = useState("encode");
	const [utilitiesSubTab, setUtilitiesSubTab] = useState("bulk");
	const [showSettings, setShowSettings] = useState(false);
	const [settingsSection, setSettingsSection] = useState("general");
	const { status, links, secrets, domain } = usePageData({ fullTab });
	const toast = useToast();
	const [paletteOpen, setPaletteOpen] = useState(() => new URLSearchParams(location.search).has("palette"));
	const [cipherPreset, setCipherPreset] = useState(null); // { method, n } from the command palette

	// Ctrl/Cmd+K toggles the command palette anywhere in the popup or full tab.
	useEffect(() => {
		const onKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	const openFullTab = () => openTab(getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`));
	const selectTab = (id) => { setShowSettings(false); setTab(id); };
	const selectRecon = (subId) => { setShowSettings(false); setTab("recon"); setReconSubTab(subId); };
	const selectCipher = (subId) => { setShowSettings(false); setTab("cipher"); setCipherSubTab(subId); };
	const selectUtilities = (subId) => { setShowSettings(false); setTab("utilities"); setUtilitiesSubTab(subId); };

	// "recon:paths" / "cipher:jwt" / "utilities:diff" → the matching select* handler.
	const goTo = (key) => {
		const [group, sub] = key.split(":");
		if (group === "recon" && sub) selectRecon(sub);
		else if (group === "cipher" && sub) selectCipher(sub);
		else if (group === "utilities" && sub) selectUtilities(sub);
		else selectTab(group);
	};

	// Context-menu page actions open the full tab with ?goto=recon:headers&run=1.
	const autoRun = useRef(new URLSearchParams(location.search).has("run")).current;
	useEffect(() => {
		const target = new URLSearchParams(location.search).get("goto");
		if (target) goTo(target);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const actions = useMemo(() => {
		const nav = DESTINATIONS.map((d) => ({ id: `go:${d.key}`, group: "Go to", label: d.label, icon: d.icon, run: () => goTo(d.key) }));
		const ciphers = CIPHERS.map((c) => ({
			id: `cipher:${c.id}`, group: "Cipher methods", label: c.label, icon: "lock",
			hint: [c.encode && "encode", c.decode && "decode"].filter(Boolean).join(" / "),
			run: () => { goTo("cipher:encode"); setCipherPreset({ method: c.id, n: Date.now() }); },
		}));
		const themes = [["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([id, label]) => ({ id: `theme:${id}`, group: "Actions", label: `Theme: ${label}`, icon: id === "dark" ? "moon" : id === "light" ? "sun" : "monitor", run: () => setTheme(id) }));
		const clear = (key, label) => ({ id: `clear:${key}`, group: "Actions", label, icon: "trash", run: async () => { await storage.remove("local", [key]); toast("Cleared", "success"); } });
		return [
			...nav, ...ciphers,
			{ id: "settings", group: "Actions", label: "Open Settings", icon: "settings", run: () => setShowSettings(true) },
			...(fullTab ? [] : [{ id: "fulltab", group: "Actions", label: "Open in full tab", icon: "maximize", run: openFullTab }]),
			...themes,
			clear(CIPHER_HISTORY_KEY, "Clear Cipher history"),
			clear(PATH_HISTORY_KEY, "Clear Path Finder history"),
		];
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fullTab, domain]);

	const content = showSettings ? (
		<SettingsTab section={settingsSection} onSectionChange={setSettingsSection} fullTab={fullTab} theme={theme} onThemeChange={setTheme} />
	) : tab === "recon" && RECON_SCAN_ONLY.has(reconSubTab) ? (
		<>
			{status === "loading" && <Spinner />}
			{status === "unavailable" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages can't be inspected." />}
			{status === "empty" && <EmptyState icon="inbox" title="No links found" hint="Try opening this from the extension's popup instead." />}
			{status === "ready" && (
				<>
					{reconSubTab === "links" && <LinksTab links={links} domain={domain} />}
					{reconSubTab === "params" && <ParamsTab links={links} />}
					{reconSubTab === "secrets" && <SecretsTab secrets={secrets} links={links} />}
				</>
			)}
		</>
	) : tab === "recon" ? (
		<>
			{reconSubTab === "paths" && <PathsTab domain={domain} autoRun={autoRun} />}
			{reconSubTab === "headers" && <HeadersTab domain={domain} autoRun={autoRun} />}
			{reconSubTab === "sitemap" && <SitemapTab domain={domain} />}
		</>
	) : tab === "cipher" ? (
		<CipherTab mode={cipherSubTab} onModeChange={setCipherSubTab} fullTab={fullTab} preset={cipherPreset} />
	) : tab === "utilities" ? (
		<UtilitiesTab mode={utilitiesSubTab} />
	) : (
		<>
			{tab === "storage" && <StorageTab domain={domain} fullTab={fullTab} />}
			{tab === "cookies" && <CookiesTab domain={domain} />}
		</>
	);

	return (
		<div className={fullTab ? "" : "w-[640px]"}>
			<AppHeader
				title="Power" accent=" Toys"
				subtitle={domain || "Bug hunting toolkit"}
				actions={<>
					<IconButton icon="search" label="Command palette (Ctrl+K)" variant="outline" onClick={() => setPaletteOpen(true)} />
					<ThemeSwitch value={theme} onChange={setTheme} />
					<SettingsButton active={showSettings} onClick={() => setShowSettings((v) => !v)} />
					{!fullTab && <FullTabButton onClick={openFullTab} />}
				</>}
			/>

			{fullTab ? (
				<div className="flex">
					<Sidebar
						showSettings={showSettings}
						tab={tab}
						reconSubTab={reconSubTab}
						cipherSubTab={cipherSubTab}
						utilitiesSubTab={utilitiesSubTab}
						onSelectRecon={selectRecon}
						onSelectCipher={selectCipher}
						onSelectUtilities={selectUtilities}
						onSelectTab={selectTab}
						settingsSection={settingsSection}
						onSelectSettingsSection={setSettingsSection}
					/>
					<main className="mx-auto min-h-[500px] w-auto min-w-0 max-w-[1100px] flex-1 px-5 py-4">{!showSettings && <Onboarding onOpenPalette={() => setPaletteOpen(true)} />}{content}</main>
					<SidePanel go={goTo} />
				</div>
			) : (
				<>
					{!showSettings && (
						<div className="space-y-2 px-4 pt-4">
							<Tabs items={TOP_TABS} value={tab} onChange={selectTab} />
							{tab === "recon" && <Tabs variant="chip" items={RECON_SUBTABS} value={reconSubTab} onChange={setReconSubTab} />}
							{tab === "cipher" && <Tabs variant="chip" items={CIPHER_SUBTABS} value={cipherSubTab} onChange={setCipherSubTab} />}
							{tab === "utilities" && <Tabs variant="chip" items={UTILITIES_SUBTABS} value={utilitiesSubTab} onChange={setUtilitiesSubTab} />}
						</div>
					)}
					<main className="min-h-[300px] px-4 py-4">{!showSettings && <Onboarding onOpenPalette={() => setPaletteOpen(true)} />}{content}</main>
				</>
			)}

			<Footer />
			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
		</div>
	);
}
