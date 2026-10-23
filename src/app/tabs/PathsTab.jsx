import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, Input, Spinner } from "../components/ui/index.js";
import { checkGraphqlIntrospection } from "../lib/pathsCheck.js";
import { JOB_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from "../lib/pathJob.js";
import { PATH_HISTORY_KEY, formatWhen } from "../lib/history.js";
import { useStoredState } from "../hooks/useStoredState.js";
import { usePrefs } from "../lib/prefs.js";
import { onStorageChanged, sendMessage, storage } from "../lib/browser.js";
import { cx } from "../lib/utils.js";
import { useSensitivePaths, useToast } from "../providers.jsx";

export default function PathsTab({ domain, autoRun = false }) {
	const toast = useToast();
	const sensitivePaths = useSensitivePaths();
	const [job, setJob] = useState(undefined); // undefined = loading, null = none
	const [scan, setScan] = useStoredState(SETTINGS_KEY, DEFAULT_SETTINGS);
	const [rps, setRps] = useState(DEFAULT_SETTINGS.rps);
	const [graphqlResult, setGraphqlResult] = useState(null);

	useEffect(() => {
		let alive = true;
		storage.get("local", [JOB_KEY]).then((r) => { if (alive) setJob(r?.[JOB_KEY] || null); });
		const off = onStorageChanged((changes, area) => {
			if (area === "local" && changes[JOB_KEY]) setJob(changes[JOB_KEY].newValue || null);
		});
		return () => { alive = false; off(); };
	}, []);

	const mine = job && job.domain === domain ? job : null;
	const otherRunning = job && job.status === "running" && job.domain !== domain;
	const running = mine?.status === "running";

	// Opening the tab acknowledges a finished/failed job, clearing the icon badge.
	useEffect(() => {
		if (mine && mine.status !== "running") sendMessage({ action: "pathJob:ack" });
	}, [mine?.status, mine?.id]);

	// The rate limit shares its stored settings with Settings → General (rps, parallelism, timeout).
	useEffect(() => { if (scan?.rps) setRps(scan.rps); }, [scan?.rps]);
	const saveRps = (v) => {
		const n = Math.min(50, Math.max(1, Math.round(Number(v)) || DEFAULT_SETTINGS.rps));
		setRps(n);
		setScan((cur) => ({ ...DEFAULT_SETTINGS, ...cur, rps: n }));
	};

	const run = async () => {
		if (!domain) return toast("No page to check", "error");
		const paths = sensitivePaths?.items || [];
		if (!paths.length) return toast("No paths configured — add some in Settings", "error");
		setGraphqlResult(null);
		saveRps(rps);
		const res = await sendMessage({ action: "pathJob:start", domain, paths });
		if (!res?.ok) toast(res?.error || "Couldn't start the scan", "error");
	};

	const cancel = async () => {
		await sendMessage({ action: "pathJob:cancel" });
		toast("Scan cancelled", "info");
	};

	// Opened from the page context menu: start a scan once everything has loaded.
	const autoStarted = useRef(false);
	useEffect(() => {
		if (autoRun && !autoStarted.current && domain && job !== undefined && sensitivePaths?.items?.length && !running && !otherRunning) {
			autoStarted.current = true;
			run();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoRun, domain, job, sensitivePaths?.items]);

	const found = (mine?.results || []).filter((r) => r.found).sort((a, b) => a.path.localeCompare(b.path));
	const graphqlHit = found.find((r) => r.path.includes("graphql"));
	const pct = mine?.total ? Math.round((mine.done / mine.total) * 100) : 0;

	const checkGraphql = async () => {
		setGraphqlResult({ loading: true });
		setGraphqlResult(await checkGraphqlIntrospection(graphqlHit.url));
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted">Checks {sensitivePaths?.items?.length ?? 0} common paths against <span className="font-mono text-fg">https://{domain}/</span>. Runs in the background — you can close this window.</p>
				{running ? (
					<Button variant="primary" size="md" icon="x" onClick={cancel}>Cancel</Button>
				) : (
					<Button variant="primary" size="md" icon="folder" onClick={run} disabled={!!otherRunning}>{mine?.status === "done" ? "Re-check" : "Check paths"}</Button>
				)}
			</div>

			<div className="flex items-center gap-2 text-xs text-muted">
				<label htmlFor="rps" className="font-bold uppercase tracking-wider">Rate limit</label>
				<Input id="rps" type="number" min={1} max={50} value={rps} disabled={running} onChange={(e) => setRps(e.target.value)} onBlur={(e) => saveRps(e.target.value)} className="!w-20 !py-1.5" />
				<span>requests / second (applies to the next scan)</span>
			</div>

			{otherRunning && <p className="rounded-2xl border border-dashed border-line px-4 py-2.5 text-xs text-muted">A scan for <span className="font-mono text-fg">{job.domain}</span> is still running. Cancel it from that site's Paths tab to start another.</p>}

			{job === undefined && <Spinner />}

			{running && (
				<div className="space-y-1.5 rounded-2xl border border-line bg-surface-2/60 p-3">
					<div className="flex items-center justify-between text-xs font-semibold">
						<span>Checked {mine.done} of {mine.total}</span>
						<span>{pct}%</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
				</div>
			)}

			{job !== undefined && !mine && !otherRunning && <EmptyState icon="folder" title="No check run yet" hint="Click “Check paths” to probe common sensitive paths on this site." />}

			{mine?.status === "error" && <p className="rounded-2xl border border-brand bg-brand-soft px-4 py-3 text-sm text-brand-ink">The scan failed: {mine.error || "unknown error"}. Partial results are shown below.</p>}
			{mine?.status === "cancelled" && <p className="rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-muted">Scan cancelled after {mine.done} of {mine.total} paths. Partial results are shown below.</p>}

			{mine && !running && !found.length && mine.status === "done" && (
				<EmptyState icon="folder" title="Nothing found" hint={`Checked ${mine.total} paths — none responded.`} />
			)}

			{mine && !!found.length && (
				<Card>
					<CardHeader title={running ? "Found so far" : "Found"} actions={<Badge tone="danger">{found.length}</Badge>} />
					<ul className="divide-y divide-line">
						{found.map((r) => (
							<li key={r.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
								<div className="flex min-w-0 items-center gap-2.5">
									<span className="size-1.5 shrink-0 rounded-full bg-brand" />
									<a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-fg hover:underline">/{r.path}</a>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<Badge>{r.status}</Badge>
									<CopyButton size="xs" label="" getText={() => r.url} />
									{r.path.includes("graphql") && <Button size="xs" onClick={checkGraphql}>Check introspection</Button>}
								</div>
							</li>
						))}
					</ul>
				</Card>
			)}

			<PathHistory />

			{graphqlResult && !graphqlResult.loading && (
				<div className={cx("rounded-2xl border px-4 py-3 text-sm", graphqlResult.open ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface-2/60 text-muted")}>
					{graphqlResult.open ? "Introspection is enabled — the full schema is queryable." : "Introspection appears to be disabled (or this isn't a GraphQL endpoint)."}
				</div>
			)}
		</div>
	);
}

/** Past Path Finder runs (newest first): expand to see what was found, delete one, or clear all. */
function PathHistory() {
	const toast = useToast();
	const [prefs] = usePrefs();
	const [runs, setRuns] = useStoredState(PATH_HISTORY_KEY, []);
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(null);

	return (
		<Card>
			<CardHeader title="Past runs" actions={<>
				<Badge>{runs.length}</Badge>
				{!!runs.length && <Button size="xs" icon="trash" onClick={() => { setRuns([]); toast("Path history cleared", "success"); }}>Clear</Button>}
				<Button size="xs" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</Button>
			</>} />
			{open && (!runs.length ? (
				<p className="px-4 py-4 text-xs text-muted">{prefs.historyEnabled ? "No finished scans yet. Completed and cancelled runs are listed here, stored only on this device." : "History is off. Turn it on in Settings → General → History & privacy."}</p>
			) : (
				<ul className="divide-y divide-line">
					{runs.map((r) => (
						<li key={r.id} className="px-4 py-2.5">
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate font-mono text-xs font-semibold text-fg">{r.domain}</p>
									<p className="text-[11px] text-subtle">{formatWhen(r.ts)} · {r.done}/{r.total} checked{r.status !== "done" ? ` · ${r.status}` : ""}</p>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<Badge tone={r.found.length ? "danger" : "muted"}>{r.found.length} found</Badge>
									{!!r.found.length && <Button size="xs" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? "Hide" : "View"}</Button>}
									<Button size="xs" icon="x" aria-label="Delete run" title="Delete run" onClick={() => setRuns((l) => l.filter((x) => x.id !== r.id))} />
								</div>
							</div>
							{expanded === r.id && (
								<ul className="mt-2 space-y-1">
									{r.found.map((f) => (
										<li key={f.path} className="flex items-center justify-between gap-2 text-xs">
											<a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-fg hover:underline">/{f.path}</a>
											<Badge>{f.status}</Badge>
										</li>
									))}
								</ul>
							)}
						</li>
					))}
				</ul>
			))}
		</Card>
	);
}
