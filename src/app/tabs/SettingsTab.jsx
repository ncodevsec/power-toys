import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, GithubGlyph, Icon, Input, Modal, Tabs, Textarea } from "../components/ui/index.js";
import { getVersion, openTab } from "../lib/browser.js";
import { cx, downloadJson, pickJsonFile } from "../lib/utils.js";
import { SETTINGS_SECTIONS } from "../lib/navigation.js";
import { usePatterns, useCustomPatterns, useSensitivePaths, useToast } from "../providers.jsx";

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

function PatternEditor({ isUrls, value, onChange, count, unit }) {
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

function SaveResetBar({ hint, onReset, onSave }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
			<p className="text-xs text-muted">{hint}</p>
			<div className="flex shrink-0 gap-2">
				<Button icon="refresh" onClick={onReset}>Reset</Button>
				<Button variant="primary" icon="check" onClick={onSave}>Save</Button>
			</div>
		</div>
	);
}

/* ─── Custom Patterns section: full CRUD over named regex rules ───────────── */
function regexError(pattern, flags) {
	try {
		// eslint-disable-next-line no-new
		new RegExp(pattern, flags || "g");
		return null;
	} catch (e) {
		return e.message;
	}
}

function CustomPatternModal({ editing, onCancel, onSave }) {
	const [form, setForm] = useState(editing);
	const [testText, setTestText] = useState("");
	useEffect(() => { setForm(editing); setTestText(""); }, [editing]);
	if (!editing || !form) return null;

	const error = form.pattern ? regexError(form.pattern, form.flags) : null;
	let testMatches = [];
	if (!error && form.pattern && testText) {
		try {
			testMatches = [...testText.matchAll(new RegExp(form.pattern, form.flags?.includes("g") ? form.flags : (form.flags || "") + "g"))].map((m) => m[0]);
		} catch {}
	}

	return (
		<Modal open title={editing._isNew ? "Add pattern" : "Edit pattern"} onClose={onCancel}
			footer={<>
				<Button size="md" onClick={onCancel}>Cancel</Button>
				<Button variant="primary" size="md" icon="check" disabled={!!error || !form.name.trim() || !form.pattern.trim()} onClick={() => onSave(form)}>Save</Button>
			</>}
		>
			<div className="space-y-4">
				<Field label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="CTF Flag" /></Field>
				<Field label="Regex pattern" hint={error || "Matched against discovered link URLs and secret values/comments."}>
					<Input value={form.pattern} onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))} placeholder="flag\{[^}]+\}" className={cx("font-mono", error && "border-brand")} />
				</Field>
				<Field label="Flags"><Input value={form.flags || ""} onChange={(e) => setForm((f) => ({ ...f, flags: e.target.value }))} placeholder="gi" className="font-mono" /></Field>
				<Field label="Test against (optional)">
					<Textarea rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Paste some sample text to try the pattern against…" />
				</Field>
				{testText && !error && (
					<p className="text-xs text-muted">{testMatches.length ? `${testMatches.length} match(es): ${testMatches.slice(0, 5).join(", ")}${testMatches.length > 5 ? "…" : ""}` : "No matches."}</p>
				)}
			</div>
		</Modal>
	);
}

function CustomPatternsSection() {
	const toast = useToast();
	const custom = useCustomPatterns();
	const [editing, setEditing] = useState(null);
	const [deleting, setDeleting] = useState(null);

	const items = custom?.items || [];

	const save = async (form) => {
		const next = form._isNew
			? [...items, { id: `p-${Date.now()}`, name: form.name.trim(), pattern: form.pattern, flags: form.flags || "g" }]
			: items.map((p) => (p.id === form.id ? { ...p, name: form.name.trim(), pattern: form.pattern, flags: form.flags || "g" } : p));
		await custom.save(next);
		toast(form._isNew ? "Pattern added" : "Pattern updated", "success");
		setEditing(null);
	};

	const confirmDelete = async () => {
		await custom.save(items.filter((p) => p.id !== deleting.id));
		toast("Pattern deleted", "success");
		setDeleting(null);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted">Named regex rules matched against discovered links and secrets — used for CTF flag detection and any other pattern you want flagged, shown on the Secrets tab's "Custom" category.</p>
				<Button variant="primary" size="md" icon="plus" onClick={() => setEditing({ name: "", pattern: "", flags: "gi", _isNew: true })}>Add pattern</Button>
			</div>

			{!items.length ? (
				<p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No custom patterns yet.</p>
			) : (
				<div className="space-y-2">
					{items.map((p) => (
						<div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
							<div className="min-w-0">
								<p className="text-sm font-semibold">{p.name}</p>
								<p className="truncate font-mono text-xs text-muted">/{p.pattern}/{p.flags}</p>
							</div>
							<div className="flex shrink-0 gap-1.5">
								<Button size="xs" icon="edit" onClick={() => setEditing({ ...p, _isNew: false })}>Edit</Button>
								<Button size="xs" icon="trash" onClick={() => setDeleting(p)}>Delete</Button>
							</div>
						</div>
					))}
				</div>
			)}

			{custom?.defaults?.length > 0 && (
				<Button icon="refresh" onClick={async () => { await custom.reset(); toast("Reset to default patterns", "success"); }}>Reset to defaults</Button>
			)}

			<CustomPatternModal editing={editing} onCancel={() => setEditing(null)} onSave={save} />
			<Modal open={!!deleting} title="Delete pattern?" onClose={() => setDeleting(null)}
				footer={<><Button size="md" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="primary" size="md" onClick={confirmDelete}>Delete</Button></>}>
				<p className="text-sm text-muted">This removes <span className="font-semibold text-fg">{deleting?.name}</span>.</p>
			</Modal>
		</div>
	);
}

/* ─── Sensitive Paths section: textarea list, same shape as URL Patterns ─── */
function SensitivePathsSection() {
	const toast = useToast();
	const paths = useSensitivePaths();
	const [text, setText] = useState("");

	useEffect(() => { setText((paths?.items || []).join("\n")); }, [paths?.items]);

	const count = useMemo(() => text.split("\n").map((p) => p.trim()).filter(Boolean).length, [text]);

	const save = async () => {
		const next = text.split("\n").map((p) => p.trim()).filter(Boolean);
		if (!next.length) return toast("Enter at least one path", "error");
		await paths.save(next);
		toast("Paths saved!", "success");
	};

	return (
		<div className="space-y-4">
			<Field label="Candidate paths (one per line, no leading slash needed)" hint="Checked against the current site by Recon → Paths." action={<Badge>{count} paths</Badge>}>
				<Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder=".git/config&#10;.env&#10;backup.sql" />
			</Field>
			<SaveResetBar hint="Changes apply the next time you run a Paths check." onReset={async () => { await paths.reset(); toast("Reset to default paths!", "success"); }} onSave={save} />
		</div>
	);
}

/* ─── General section ───────────────────────────────────────────────────── */
function GeneralSection({ patternsRaw, customItems, pathsItems }) {
	const toast = useToast();

	const exportAll = () => downloadJson(
		{ sensitivePatterns: patternsRaw, customPatterns: customItems, sensitivePaths: pathsItems },
		`power-toys-settings-${Date.now()}.json`,
	);

	const importAll = async () => {
		try {
			const data = await pickJsonFile();
			if (!data) return;
			toast("Imported settings file loaded — open each section to review and save.", "info");
			// Each section reads its own slice from storage on next load; a full
			// cross-section import-and-apply is intentionally out of scope here
			// to avoid silently overwriting one section while editing another.
			void data;
		} catch {
			toast("Error reading settings file!", "error");
		}
	};

	return (
		<div className="space-y-4">
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
					label="Export all settings"
					hint="Sensitive patterns, custom patterns, and sensitive paths"
					action={<Button size="xs" onClick={exportAll}>Export</Button>}
				/>
				<SettingRow
					icon="upload"
					label="Import settings"
					hint="Review and save each section after importing"
					action={<Button size="xs" onClick={importAll}>Import</Button>}
				/>
			</div>
		</div>
	);
}

/**
 * `section`/`onSectionChange` are controlled from the parent (App.jsx) so
 * the same selection can drive two different navigation presentations:
 * a horizontal tab bar here in the popup, or the full-tab view's sidebar
 * (which replaces its own nav with these sections and renders nothing of
 * its own here — hence the `fullTab` flag to skip the tab bar in that case).
 */
export default function SettingsTab({ section, onSectionChange, fullTab }) {
	const { raw, save, reset } = usePatterns();
	const custom = useCustomPatterns();
	const sensitivePaths = useSensitivePaths();
	const toast = useToast();
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

	return (
		<div className="space-y-4">
			{!fullTab && <Tabs items={SETTINGS_SECTIONS} value={section} onChange={onSectionChange} />}

			<div className={cx("space-y-4", fullTab && "max-w-2xl")}>
				{section === "general" && <GeneralSection patternsRaw={raw} customItems={custom?.items} pathsItems={sensitivePaths?.items} />}

				{section === "urls" && (
					<>
						<PatternEditor isUrls value={urls} onChange={(e) => setUrls(e.target.value)} count={urlCount} unit="patterns" />
						<SaveResetBar hint="Changes apply immediately to link, parameter, and secret highlighting." onReset={() => setConfirmReset(true)} onSave={onSave} />
					</>
				)}

				{section === "params" && (
					<>
						<PatternEditor isUrls={false} value={params} onChange={(e) => setParams(e.target.value)} count={paramCount} unit="keywords" />
						<SaveResetBar hint="Changes apply immediately to link, parameter, and secret highlighting." onReset={() => setConfirmReset(true)} onSave={onSave} />
					</>
				)}

				{section === "custom" && <CustomPatternsSection />}
				{section === "paths" && <SensitivePathsSection />}
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
