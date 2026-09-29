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
];

export default function App({ fullTab = false }) {
	const [theme, setTheme] = useTheme();
	const [tab, setTab] = useState("links");
	const { status, links, secrets, domain } = usePageData({ fullTab });

	const openFullTab = () => openTab(getURL(`src/pages/popup.html?fullTab=true&domain=${encodeURIComponent(domain)}`));

	return (
		<div className={fullTab ? "mx-auto max-w-[880px]" : "w-[640px]"}>
			<AppHeader
				title="Power" accent=" Toys"
				subtitle={domain || "Bug hunting toolkit"}
				actions={<>
					<ThemeSwitch value={theme} onChange={setTheme} />
					<SettingsButton active={tab === "settings"} onClick={() => setTab("settings")} />
					{!fullTab && <FullTabButton onClick={openFullTab} />}
				</>}
			/>

			<div className="px-4 pt-4">
				<Tabs items={TABS} value={tab === "settings" ? null : tab} onChange={setTab} />
			</div>

			<main className="min-h-[300px] px-4 py-4">
				{status === "loading" && tab !== "settings" && <Spinner />}
				{status === "unavailable" && tab !== "settings" && <EmptyState icon="shield" title="Unavailable on this page" hint="Browser and extension pages can't be inspected." />}
				{status === "empty" && tab !== "settings" && <EmptyState icon="inbox" title="No links found" hint="Try opening this from the extension's popup instead." />}
				{(status === "ready" || tab === "bulk" || tab === "cipher" || tab === "settings") && (
					<>
						{tab === "links" && <LinksTab links={links} domain={domain} />}
						{tab === "params" && <ParamsTab links={links} />}
						{tab === "secrets" && <SecretsTab secrets={secrets} />}
						{tab === "bulk" && <BulkTab />}
						{tab === "cipher" && <CipherTab />}
						{tab === "settings" && <SettingsTab />}
					</>
				)}
			</main>
			<Footer />
		</div>
	);
}
