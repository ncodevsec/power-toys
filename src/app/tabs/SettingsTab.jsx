import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, GithubGlyph, Icon, Modal, Textarea } from "../components/ui/index.js";
import { getVersion, openTab } from "../lib/browser.js";
import { cx, downloadJson, pickJsonFile } from "../lib/utils.js";
import { usePatterns, useToast } from "../providers.jsx";

const SECTIONS = [
	{ id: "general", label: "General", icon: "shield" },
	{ id: "urls", label: "URL patterns", icon: "link" },
	{ id: "params", label: "Parameter keywords", icon: "sliders" },
];

function NavItem({ item, active, onClick }) {
	return (
		<button
			onClick={onClick}
			aria-current={active}
			className={cx(
				"flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
				active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
			)}
		>
			<Icon name={item.icon} size={16} />
			{item.label}
		</button>
	);
}

/** A single labeled row with a leading icon chip and a trailing action — the
 * settings-app list pattern (macOS/iOS Settings), used for General items. */
function SettingRow({ icon, glyph, label, hint, action }) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
			<div className="flex min-w-0 items-center gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">{glyph ?? <Icon name={icon} size={16} />}</span>
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold">{label}</p>
					{hint && <p className="truncate text-xs text-muted">{hint}</p>}
				</div>
			</div>
			<div className="shrink-0">{action}</div>
		</div>
	);
}

function PatternEditor({ section, value, onChange, count, unit }) {
	const isUrls = section === "urls";
	return (
		<Field
			label={isUrls ? "URL patterns (regex, one per line)" : "Sensitive parameter keywords"}
			hint={isUrls ? "Example: /admin/i or /\\.git/i" : "Comma-separated. Example: api_key, password, token"}
			action={<Badge>{count} {unit}</Badge>}
		>
			<Textarea rows={11} value={value} onChange={onChange} placeholder={isUrls ? "Enter regex patterns, one per line…" : "Enter keywords separated by commas…"} />
		</Field>
	);
}

export default function SettingsTab() {
	const { raw, save, reset } = usePatterns();
	const toast = useToast();
	const [section, setSection] = useState("general");
	const [params, setParams] = useState("");
	const [urls, setUrls] = useState("");
	const [confirmReset, setConfirmReset] = useState(false);

	useEffect(() => {
		setParams(raw.params.join(", "));
		setUrls(raw.urlPatterns.join("\n"));
	}, [raw]);

	const paramCount = useMemo(() => params.split(",").map((p) => p.trim()).filter(Boolean).length, [params]);
	const urlCount = useMemo(() => urls.split("\n").map((p) => p.trim()).filter(Boolean).length, [urls]);

	const onSave = async () => {
		const next = {
			params: params.split(",").map((p) => p.trim()).filter(Boolean),
			urlPatterns: urls.split("\n").map((p) => p.trim()).filter(Boolean),
		};
		if (!next.params.length && !next.urlPatterns.length) return toast("Enter at least one parameter or URL pattern", "error");
		await save(next);
		toast("Settings saved!", "success");
	};

	const onImport = async () => {
		try {
			const data = await pickJsonFile();
			if (!data) return;
			if (!Array.isArray(data.params) || !Array.isArray(data.urlPatterns)) return toast("Invalid settings file format!", "error");
			await save({ params: data.params, urlPatterns: data.urlPatterns });
			toast("Settings imported!", "success");
		} catch {
			toast("Error parsing settings file!", "error");
		}
	};

	return (
		<div className="grid grid-cols-[168px_1fr] gap-5">
			<nav className="space-y-1 border-r border-line pr-4">
				{SECTIONS.map((s) => (
					<NavItem key={s.id} item={s} active={section === s.id} onClick={() => setSection(s.id)} />
				))}
			</nav>

			<div className="min-w-0 space-y-4">
				{section === "general" && (
					<>
						<div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface-2/60 p-4">
							<div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm"><Icon name="zap" size={22} strokeWidth={2.4} /></div>
							<div className="min-w-0">
								<p className="text-base font-extrabold leading-tight">Power Toys</p>
								<div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
									<Badge>v{getVersion()}</Badge>
									<span>by nCodevSec</span>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<SettingRow
								glyph={<GithubGlyph size={16} />}
								label="View source on GitHub"
								hint="github.com/ncodevsec/power-toys"
								action={<Button size="xs" icon="external" onClick={() => openTab("https://github.com/ncodevsec/power-toys")}>Open</Button>}
							/>
							<SettingRow
								icon="download"
								label="Export settings"
								hint="Save your patterns as a JSON file"
								action={<Button size="xs" onClick={() => downloadJson(raw, `power-toys-settings-${Date.now()}.json`)}>Export</Button>}
							/>
							<SettingRow
								icon="upload"
								label="Import settings"
								hint="Load patterns from a JSON file"
								action={<Button size="xs" onClick={onImport}>Import</Button>}
							/>
						</div>
					</>
				)}

				{(section === "urls" || section === "params") && (
					<>
						{section === "urls"
							? <PatternEditor section="urls" value={urls} onChange={(e) => setUrls(e.target.value)} count={urlCount} unit="patterns" />
							: <PatternEditor section="params" value={params} onChange={(e) => setParams(e.target.value)} count={paramCount} unit="keywords" />}

						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
							<p className="text-xs text-muted">Changes apply immediately to link, parameter, and secret highlighting.</p>
							<div className="flex shrink-0 gap-2">
								<Button icon="refresh" onClick={() => setConfirmReset(true)}>Reset</Button>
								<Button variant="primary" icon="check" onClick={onSave}>Save</Button>
							</div>
						</div>
					</>
				)}
			</div>

			<Modal open={confirmReset} title="Reset to defaults?" onClose={() => setConfirmReset(false)}
				footer={<>
					<Button size="md" onClick={() => setConfirmReset(false)}>Cancel</Button>
					<Button variant="primary" size="md" onClick={async () => { await reset(); setConfirmReset(false); toast("Reset to defaults!", "success"); }}>Reset</Button>
				</>}>
				<p className="text-sm text-muted">Your custom URL patterns and parameter keywords will be replaced by the built-in defaults.</p>
			</Modal>
		</div>
	);
}
