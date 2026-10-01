import { useState } from "react";
import { AppHeader, FullTabButton, SettingsButton, ThemeSwitch } from "../components/AppHeader.jsx";
import { EmptyState, Spinner, Tabs } from "../components/ui/index.js";
import { Footer } from "../components/Footer.jsx";
import { useTheme } from "../hooks/useTheme.js";
import { usePageData } from "../hooks/usePageData.js";
import { getURL, openTab } from "../lib/browser.js";
import LinksTab from "../tabs/LinksTab.jsx";
import ParamsTab from "../tabs/ParamsTab.jsx";
import SecretsTab from "../tabs/SecretsTab.jsx";
import BulkTab from "../tabs/BulkTab.jsx";
import CipherTab from "../tabs/CipherTab.jsx";
import CookiesTab from "../tabs/CookiesTab.jsx";
import SettingsTab from "../tabs/SettingsTab.jsx";

// Settings lives behind the gear icon in the header, not in this tab bar —
// keeping it out is also what lets the remaining tabs comfortably fit the
// popup's width without wrapping or horizontal scrolling.
const TABS = [
	{ id: "links", label: "Links", icon: "link" },
	{ id: "params", label: "Params", icon: "sliders" },
	{ id: "secrets", label: "Secrets", icon: "key" },
	{ id: "bulk", label: "Bulk Opener", icon: "external" },
	{ id: "cipher", label: "Cipher", icon: "lock" },
	{ id: "cookies", label: "Cookies", icon: "cookie" },
];

// Tabs backed by the page link/secret scan (usePageData) vs. tabs that work
// independently of it — only the former should react to scan status.
const SCAN_TABS = new Set(["links", "params", "secrets"]);

export default function App({ fullTab = false }) {
	const [theme, setTheme] = useTheme();
	// `tab` always holds the last-selected content tab; `showSettings` is a
	// separate overlay-like toggle so the gear button can open AND close
	// settings, and returning from it lands back on whichever tab was active.
	const [tab, setTab] = useState("links");
	const [showSettings, setShowSettings] = useState(false);
	const { status, links, secrets, domain } = usePageData({ fullTab });

	const openFullTab = () => openTab(getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`));
	const selectTab = (id) => { setShowSettings(false); setTab(id); };

	return (
		<div className={fullTab ? "mx-auto max-w-[880px]" : "w-[760px]"}>
			<AppHeader
				title="Power" accent=" Toys"
				subtitle={domain || "Bug hunting toolkit"}
				actions={<>
					<ThemeSwitch value={theme} onChange={setTheme} />
					<SettingsButton active={showSettings} onClick={() => setShowSettings((v) => !v)} />
					{!fullTab && <FullTabButton onClick={openFullTab} />}
				</>}
			/>

			{!showSettings && (
				<div className="px-4 pt-4">
					<Tabs items={TABS} value={tab} onChange={selectTab} />
				</div>
			)}

			<main className="min-h-[300px] px-4 py-4">
				{showSettings ? (
					<SettingsTab />
				) : SCAN_TABS.has(tab) ? (
					<>
						{status === "loading" && <Spinner />}
						{status === "unavailable" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages can't be inspected." />}
						{status === "empty" && <EmptyState icon="inbox" title="No links found" hint="Try opening this from the extension's popup instead." />}
						{status === "ready" && (
							<>
								{tab === "links" && <LinksTab links={links} domain={domain} />}
								{tab === "params" && <ParamsTab links={links} />}
								{tab === "secrets" && <SecretsTab secrets={secrets} />}
							</>
						)}
					</>
				) : (
					<>
						{tab === "bulk" && <BulkTab />}
						{tab === "cipher" && <CipherTab />}
						{tab === "cookies" && <CookiesTab domain={domain} />}
					</>
				)}
			</main>
			<Footer />
		</div>
	);
}
