import { useState } from "react";
import { AppHeader, FullTabButton, SettingsButton, ThemeSwitch } from "../components/AppHeader.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { EmptyState, Spinner, Tabs } from "../components/ui/index.js";
import { Footer } from "../components/Footer.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { usePageData } from "../hooks/usePageData.js";
import { getURL, openTab } from "../lib/browser.js";
import { TOP_TABS, RECON_SUBTABS } from "../lib/navigation.js";
import LinksTab from "../tabs/LinksTab.jsx";
import ParamsTab from "../tabs/ParamsTab.jsx";
import SecretsTab from "../tabs/SecretsTab.jsx";
import BulkTab from "../tabs/BulkTab.jsx";
import CipherTab from "../tabs/CipherTab.jsx";
import CookiesTab from "../tabs/CookiesTab.jsx";
import SettingsTab from "../tabs/SettingsTab.jsx";

export default function App({ fullTab = false }) {
	const [theme, setTheme] = useTheme();
	// `tab` always holds the last-selected top-level tab; `reconSubTab` is
	// which of Links/Params/Secrets is showing while on Recon; `showSettings`
	// is a separate overlay-like toggle so the gear button can open AND close
	// settings, and returning from it lands back on whichever tab was active.
	// `settingsSection` is lifted up here (rather than owned by SettingsTab)
	// so it can drive both the popup's horizontal tabs and the full-tab
	// sidebar's settings nav from the same state.
	const [tab, setTab] = useState("recon");
	const [reconSubTab, setReconSubTab] = useState("links");
	const [showSettings, setShowSettings] = useState(false);
	const [settingsSection, setSettingsSection] = useState("general");
	const { status, links, secrets, domain } = usePageData({ fullTab });

	const openFullTab = () => openTab(getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`));
	const selectTab = (id) => { setShowSettings(false); setTab(id); };
	const selectRecon = (subId) => { setShowSettings(false); setTab("recon"); setReconSubTab(subId); };

	const content = showSettings ? (
		<SettingsTab section={settingsSection} onSectionChange={setSettingsSection} fullTab={fullTab} />
	) : tab === "recon" ? (
		<>
			{status === "loading" && <Spinner />}
			{status === "unavailable" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages can't be inspected." />}
			{status === "empty" && <EmptyState icon="inbox" title="No links found" hint="Try opening this from the extension's popup instead." />}
			{status === "ready" && (
				<>
					{reconSubTab === "links" && <LinksTab links={links} domain={domain} />}
					{reconSubTab === "params" && <ParamsTab links={links} />}
					{reconSubTab === "secrets" && <SecretsTab secrets={secrets} />}
				</>
			)}
		</>
	) : (
		<>
			{tab === "bulk" && <BulkTab />}
			{tab === "cipher" && <CipherTab />}
			{tab === "cookies" && <CookiesTab domain={domain} />}
		</>
	);

	return (
		<div className={fullTab ? "mx-auto max-w-[1100px]" : "w-[600px]"}>
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
						onSelectRecon={selectRecon}
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
						</div>
					)}
					<main className="min-h-[300px] px-4 py-4">{content}</main>
				</>
			)}

			<Footer />
		</div>
	);
}
