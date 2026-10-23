import { useState } from "react";
import { Badge, Button, Icon, IconButton } from "./ui/index.js";
import { useStoredState } from "../hooks/useStoredState.js";
import { sendMessage } from "../lib/browser.js";
import { JOB_KEY } from "../lib/pathJob.js";
import { DESTINATIONS } from "../lib/navigation.js";
import { cx } from "../lib/utils.js";

const DEFAULT_PINS = ["recon:paths", "recon:headers", "cipher:encode"];

function Widget({ title, actions, children }) {
	return (
		<section className="overflow-hidden rounded-2xl border border-line bg-surface">
			<div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-3 py-2">
				<h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
				{actions}
			</div>
			<div className="p-3">{children}</div>
		</section>
	);
}

/* ─── Widget: background job status ─────────────────────────────────────── */
function JobStatusWidget({ go }) {
	const [job] = useStoredState(JOB_KEY, null);
	if (!job) return <p className="text-xs text-muted">No scans yet. Start one from Recon → Paths; it keeps running in the background.</p>;
	const found = job.results.filter((r) => r.found).length;
	const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
	const label = { running: "Running", done: "Finished", cancelled: "Cancelled", error: "Failed" }[job.status] || job.status;
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate font-mono text-xs text-fg" title={job.domain}>{job.domain}</span>
				<Badge tone={job.status === "error" ? "danger" : "muted"}>{label}</Badge>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-line"><div className={cx("h-full rounded-full transition-all", job.status === "error" ? "bg-brand" : "bg-brand")} style={{ width: `${pct}%` }} /></div>
			<p className="text-xs text-muted">{job.done} of {job.total} checked · {found} found</p>
			<div className="flex gap-1.5">
				{job.status === "running" && <Button size="xs" icon="x" onClick={() => sendMessage({ action: "pathJob:cancel" })}>Cancel</Button>}
				<Button size="xs" variant="soft" onClick={() => go("recon:paths")}>Open Paths</Button>
			</div>
		</div>
	);
}

/* ─── Widget: latest findings from the most recent scan ─────────────────── */
function RecentResultsWidget() {
	const [job] = useStoredState(JOB_KEY, null);
	const found = (job?.results || []).filter((r) => r.found).slice(0, 6);
	if (!found.length) return <p className="text-xs text-muted">Nothing found yet. Interesting paths from your latest scan show up here.</p>;
	return (
		<ul className="space-y-1.5">
			{found.map((r) => (
				<li key={r.path} className="flex items-center justify-between gap-2 text-xs">
					<a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-fg hover:underline" title={r.url}>/{r.path}</a>
					<Badge>{r.status}</Badge>
				</li>
			))}
		</ul>
	);
}

/* ─── Widget: pinned tools (quick jump) ─────────────────────────────────── */
function PinnedToolsWidget({ go, editing }) {
	const [pins, setPins] = useStoredState("pinnedTools", DEFAULT_PINS);
	const list = editing ? DESTINATIONS : DESTINATIONS.filter((d) => pins.includes(d.key));
	const toggle = (key) => setPins((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
	if (!list.length) return <p className="text-xs text-muted">No pinned tools. Use Edit to pin the ones you open most.</p>;
	return (
		<div className="space-y-0.5">
			{list.map((d) => (
				<div key={d.key} className="flex items-center gap-1">
					<button onClick={() => go(d.key)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg">
						<Icon name={d.icon} size={14} /><span className="truncate">{d.label}</span>
					</button>
					{editing && (
						<button aria-pressed={pins.includes(d.key)} aria-label={`Pin ${d.label}`} onClick={() => toggle(d.key)} className={cx("grid size-6 place-items-center rounded-md transition", pins.includes(d.key) ? "text-brand" : "text-subtle hover:text-fg")}>
							<Icon name="pin" size={13} />
						</button>
					)}
				</div>
			))}
		</div>
	);
}

/**
 * Collapsible right-hand panel for the full-tab view only. `WIDGETS` is the
 * extension point — later items (history, shortcuts) register another entry
 * instead of editing the layout. Hidden below 1100px (CSS), collapsed state
 * is remembered across opens.
 */
export function SidePanel({ go }) {
	const [open, setOpen, ready] = useStoredState("sidePanelOpen", true);
	const [editingPins, setEditingPins] = useState(false);

	const WIDGETS = [
		{ id: "job", title: "Background scan", body: <JobStatusWidget go={go} /> },
		{ id: "recent", title: "Latest findings", body: <RecentResultsWidget /> },
		{
			id: "pins", title: "Pinned tools",
			actions: <button onClick={() => setEditingPins((v) => !v)} className="text-[11px] font-semibold text-brand-ink hover:underline">{editingPins ? "Done" : "Edit"}</button>,
			body: <PinnedToolsWidget go={go} editing={editingPins} />,
		},
	];

	if (!ready) return <aside className="hidden w-12 shrink-0 min-[1100px]:block" />;

	return (
		<aside className="hidden shrink-0 border-l border-line bg-surface-2/40 min-[1100px]:block">
			{open ? (
				<div className="sticky top-0 flex h-screen w-72 flex-col gap-3 overflow-y-auto px-3 py-4">
					<div className="flex items-center justify-between">
						<p className="px-1 text-[11px] font-bold uppercase tracking-wider text-subtle">Quick panel</p>
						<IconButton icon="panel-right" label="Collapse panel" variant="ghost" className="!size-8 !h-8 !w-8" onClick={() => setOpen(false)} />
					</div>
					{WIDGETS.map((w) => <Widget key={w.id} title={w.title} actions={w.actions}>{w.body}</Widget>)}
				</div>
			) : (
				<div className="sticky top-0 flex w-12 justify-center py-4">
					<IconButton icon="panel-right" label="Expand panel" variant="ghost" onClick={() => setOpen(true)} />
				</div>
			)}
		</aside>
	);
}
