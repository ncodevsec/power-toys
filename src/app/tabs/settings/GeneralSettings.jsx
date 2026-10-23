import { useEffect, useState } from "react";
import { Badge, Button, GithubGlyph, Input, Modal, Select } from "../../components/ui/index.js";
import { Toggle } from "../../components/ui/Toggle.jsx";
import { ThemeSwitch } from "../../components/AppHeader.jsx";
import { Logo } from "../../components/Logo.jsx";
import { getCommands, getVersion, openTab, storage } from "../../lib/browser.js";
import { downloadJson, pickJsonFile } from "../../lib/utils.js";
import { usePrefs, PREFS_KEY } from "../../lib/prefs.js";
import { useStoredState } from "../../hooks/useStoredState.js";
import { SETTINGS_KEY, DEFAULT_SETTINGS } from "../../lib/pathJob.js";
import { CIPHER_HISTORY_KEY, PATH_HISTORY_KEY } from "../../lib/history.js";
import { usePatterns, useCustomPatterns, useSensitivePaths, useToast } from "../../providers.jsx";

const RESET_KEYS = [PREFS_KEY, SETTINGS_KEY, "sidePanelOpen", "pinnedTools", "onboardingDone"];
const CACHE_KEYS = ["savedLinks", "savedSecrets", "savedWebStorage", "pathJob"];
const isFirefox = typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);

function Section({ title, hint, children }) {
	return (
		<section className="space-y-2">
			<div className="px-1">
				<h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
				{hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
			</div>
			<div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
		</section>
	);
}

function Row({ label, hint, children }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold">{label}</p>
				{hint && <p className="text-xs text-muted">{hint}</p>}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

const clamp = (v, min, max, fallback) => Math.min(max, Math.max(min, Math.round(Number(v)) || fallback));

function NumberSetting({ value, min, max, onCommit, unit }) {
	const [text, setText] = useState(String(value));
	useEffect(() => setText(String(value)), [value]);
	return (
		<div className="flex items-center gap-2">
			<Input type="number" min={min} max={max} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(clamp(text, min, max, value))} className="!w-20 !py-1.5" />
			{unit && <span className="text-xs text-muted">{unit}</span>}
		</div>
	);
}

export default function GeneralSettings({ theme, onThemeChange }) {
	const toast = useToast();
	const patterns = usePatterns();
	const custom = useCustomPatterns();
	const paths = useSensitivePaths();
	const [prefs, setPref] = usePrefs();
	const [scan, setScan] = useStoredState(SETTINGS_KEY, DEFAULT_SETTINGS);
	const [panelOpen, setPanelOpen] = useStoredState("sidePanelOpen", true);
	const [shortcuts, setShortcuts] = useState([]);
	const [confirmReset, setConfirmReset] = useState(false);
	const s = { ...DEFAULT_SETTINGS, ...scan };

	useEffect(() => { getCommands().then(setShortcuts); }, []);

	const setScanKey = (patch) => setScan((cur) => ({ ...DEFAULT_SETTINGS, ...cur, ...patch }));
	const clearKeys = async (keys, message) => { await storage.remove("local", keys); toast(message, "success"); };

	const exportAll = async () => {
		const stored = await storage.get("local", [PREFS_KEY, SETTINGS_KEY]);
		downloadJson(
			{ app: "power-toys", version: getVersion(), sensitivePatterns: patterns.raw, customPatterns: custom?.items, sensitivePaths: paths?.items, prefs: stored?.[PREFS_KEY], pathSettings: stored?.[SETTINGS_KEY] },
			`power-toys-settings-${Date.now()}.json`,
		);
	};

	const importAll = async () => {
		let data;
		try { data = await pickJsonFile(); } catch { return toast("That file isn't valid JSON", "error"); }
		if (!data) return;
		if (data.app !== "power-toys") return toast("This doesn't look like a Power Toys settings file", "error");
		const applied = [];
		const sp = data.sensitivePatterns;
		if (sp && Array.isArray(sp.params) && Array.isArray(sp.urlPatterns)) { await patterns.save({ params: sp.params.map(String), urlPatterns: sp.urlPatterns.map(String) }); applied.push("patterns"); }
		if (Array.isArray(data.customPatterns)) { await custom.save(data.customPatterns.filter((p) => p?.name && p?.pattern)); applied.push("custom patterns"); }
		if (Array.isArray(data.sensitivePaths)) { await paths.save(data.sensitivePaths.map(String)); applied.push("paths"); }
		if (data.prefs && typeof data.prefs === "object") { await storage.set("local", { [PREFS_KEY]: data.prefs }); applied.push("preferences"); }
		if (data.pathSettings && typeof data.pathSettings === "object") { await storage.set("local", { [SETTINGS_KEY]: data.pathSettings }); applied.push("scan settings"); }
		toast(applied.length ? `Imported ${applied.join(", ")}` : "Nothing to import in that file", applied.length ? "success" : "error");
	};

	const resetAll = async () => {
		await storage.remove("local", RESET_KEYS);
		await Promise.all([patterns.reset(), custom?.reset?.(), paths?.reset?.()]);
		onThemeChange("dark");
		setConfirmReset(false);
		toast("All settings reset to defaults", "success");
	};

	const openShortcuts = () => openTab("chrome://extensions/shortcuts").catch?.(() => toast("Open chrome://extensions/shortcuts manually", "info"));

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/60 p-4">
				<Logo size={48} />
				<div className="min-w-0 flex-1">
					<p className="text-base font-extrabold leading-tight">Power Toys</p>
					<div className="mt-0.5 flex items-center gap-2 text-xs text-muted"><Badge>v{getVersion()}</Badge><span>by nCodevSec</span></div>
				</div>
				<Button size="xs" icon="external" onClick={() => openTab("https://github.com/ncodevsec/power-toys")}><GithubGlyph size={13} />Source</Button>
			</div>

			<Section title="Appearance">
				<Row label="Theme" hint="Dark is the default; System follows your OS."><ThemeSwitch value={theme} onChange={onThemeChange} /></Row>
				<Row label="Quick panel" hint="Side panel in the full-tab view (hidden on narrow windows)."><Toggle checked={panelOpen} onChange={setPanelOpen} label={panelOpen ? "Shown" : "Collapsed"} /></Row>
				<Row label="Tips and hints" hint="Show first-run tips and short hints in empty states."><Toggle checked={prefs.showTips} onChange={(v) => setPref({ showTips: v })} /></Row>
			</Section>

			<Section title="Path Finder" hint="Applies to the next scan. Scans run in the background, so keep these polite on sites you don't own.">
				<Row label="Rate limit" hint="Maximum requests per second across all workers."><NumberSetting value={s.rps} min={1} max={50} unit="req/s" onCommit={(v) => setScanKey({ rps: v })} /></Row>
				<Row label="Parallel requests" hint="How many requests can be in flight at once."><NumberSetting value={s.concurrency} min={1} max={10} onCommit={(v) => setScanKey({ concurrency: v })} /></Row>
				<Row label="Request timeout" hint="Give up on a path after this long."><NumberSetting value={Math.round(s.timeoutMs / 1000)} min={1} max={60} unit="seconds" onCommit={(v) => setScanKey({ timeoutMs: v * 1000 })} /></Row>
			</Section>

			<Section title="Keyboard shortcuts" hint={isFirefox ? "Change these in Add-ons → ⚙ → Manage Extension Shortcuts." : "Change them on the browser's shortcuts page."}>
				{shortcuts.filter((c) => c.name !== "_execute_action").map((c) => (
					<Row key={c.name} label={c.description || c.name}>{c.shortcut ? <Badge tone="solid">{c.shortcut}</Badge> : <span className="text-xs text-subtle">Not set</span>}</Row>
				))}
				{!shortcuts.length && <p className="px-4 py-3 text-xs text-muted">Shortcuts aren't available in this view.</p>}
				<Row label="Selected-text shortcut" hint="What the auto-decode shortcut does with the result.">
					<Select value={prefs.selectionAction} onChange={(e) => setPref({ selectionAction: e.target.value })} className="!w-44 !py-1.5">
						<option value="window">Show in a window</option>
						<option value="copy">Copy to clipboard</option>
					</Select>
				</Row>
				{!isFirefox && <Row label="Customize shortcuts"><Button size="xs" icon="external" onClick={openShortcuts}>Open</Button></Row>}
			</Section>

			<Section title="History & privacy" hint="Everything Power Toys does runs locally in your browser. Nothing is sent to us. Requests go only to the sites you scan.">
				<Row label="Save history" hint="Remember recent Cipher inputs/outputs and past Path Finder runs, on this device only."><Toggle checked={prefs.historyEnabled} onChange={(v) => setPref({ historyEnabled: v })} /></Row>
				<Row label="History size" hint="Entries kept per list.">
					<Select value={prefs.historyLimit} onChange={(e) => setPref({ historyLimit: Number(e.target.value) })} className="!w-28 !py-1.5">
						{[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
					</Select>
				</Row>
				<Row label="Clear history"><div className="flex gap-1.5"><Button size="xs" icon="trash" onClick={() => clearKeys([CIPHER_HISTORY_KEY], "Cipher history cleared")}>Cipher</Button><Button size="xs" icon="trash" onClick={() => clearKeys([PATH_HISTORY_KEY], "Path history cleared")}>Paths</Button></div></Row>
				<Row label="Clear cached page data" hint="Saved links, secrets, storage snapshot and the last scan."><Button size="xs" icon="trash" onClick={() => clearKeys(CACHE_KEYS, "Cached page data cleared")}>Clear</Button></Row>
			</Section>

			<Section title="Backup & reset">
				<Row label="Export settings" hint="Patterns, paths, preferences and scan settings as JSON."><Button size="xs" icon="download" onClick={exportAll}>Export</Button></Row>
				<Row label="Import settings" hint="Replaces the matching sections from a Power Toys export."><Button size="xs" icon="upload" onClick={importAll}>Import</Button></Row>
				<Row label="Reset everything" hint="Restores all settings to their defaults. History is kept."><Button size="xs" icon="refresh" onClick={() => setConfirmReset(true)}>Reset</Button></Row>
			</Section>

			<Modal open={confirmReset} title="Reset all settings?" onClose={() => setConfirmReset(false)}
				footer={<><Button size="md" onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="primary" size="md" onClick={resetAll}>Reset</Button></>}>
				<p className="text-sm text-muted">Patterns, paths, preferences, scan settings and pinned tools go back to their defaults. Your history isn't touched.</p>
			</Modal>
		</div>
	);
}
