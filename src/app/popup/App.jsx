import { useState } from "react";
import { AppHeader, FullTabButton, SettingsButton, ThemeSwitch } from "../components/AppHeader.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { EmptyState, Spinner, Tabs } from "../components/ui/index.js";
import { Footer } from "../components/Footer.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { usePageData } from "../hooks/usePageData.js";
import { getURL, openTab } from "../lib/browser.js";
import { TOP_TABS, RECON_SUBTABS, CIPHER_SUBTABS } from "../lib/navigation.js";
import LinksTab from "../tabs/LinksTab.jsx";
import ParamsTab from "../tabs/ParamsTab.jsx";
import SecretsTab from "../tabs/SecretsTab.jsx";
import PathsTab from "../tabs/PathsTab.jsx";
import HeadersTab from "../tabs/HeadersTab.jsx";
import BulkTab from "../tabs/BulkTab.jsx";
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
	const [showSettings, setShowSettings] = useState(false);
	const [settingsSection, setSettingsSection] = useState("general");
	const { status, links, secrets, domain } = usePageData({ fullTab });

	const openFullTab = () => openTab(getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`));
	const selectTab = (id) => { setShowSettings(false); setTab(id); };
	const selectRecon = (subId) => { setShowSettings(false); setTab("recon"); setReconSubTab(subId); };
	const selectCipher = (subId) => { setShowSettings(false); setTab("cipher"); setCipherSubTab(subId); };

	const content = showSettings ? (
		<SettingsTab section={settingsSection} onSectionChange={setSettingsSection} fullTab={fullTab} />
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
			{reconSubTab === "paths" && <PathsTab domain={domain} />}
			{reconSubTab === "headers" && <HeadersTab domain={domain} />}
		</>
	) : tab === "cipher" ? (
		<CipherTab mode={cipherSubTab} onModeChange={setCipherSubTab} fullTab={fullTab} />
	) : (
		<>
			{tab === "bulk" && <BulkTab />}
			{tab === "storage" && <StorageTab domain={domain} fullTab={fullTab} />}
			{tab === "cookies" && <CookiesTab domain={domain} />}
		</>
	);

	return (
		<div className={fullTab ? "mx-auto max-w-[1200px]" : "w-[640px]"}>
			<AppHeader
				title="Power" accent=" Toys"
				subtitle={domain || "Bug hunting toolkit"}
				actions={<>
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
						onSelectRecon={selectRecon}
						onSelectCipher={selectCipher}
						onSelectTab={selectTab}
						settingsSection={settingsSection}
						onSelectSettingsSection={setSettingsSection}
					/>
					<main className="min-h-[500px] min-w-0 flex-1 px-5 py-4">{content}</main>
				</div>
			) : (
				<>
					{!showSettings && (
						<div className="space-y-2 px-4 pt-4">
							<Tabs items={TOP_TABS} value={tab} onChange={selectTab} />
							{tab === "recon" && <Tabs variant="chip" items={RECON_SUBTABS} value={reconSubTab} onChange={setReconSubTab} />}
							{tab === "cipher" && <Tabs variant="chip" items={CIPHER_SUBTABS} value={cipherSubTab} onChange={setCipherSubTab} />}
						</div>
					)}
					<main className="min-h-[300px] px-4 py-4">{content}</main>
				</>
			)}

			<Footer />
		</div>
	);
}
