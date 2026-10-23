import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, Code, CopyButton, EmptyState, Spinner } from "../components/ui/index.js";
import { checkSecurityHeaders, toCurl } from "../lib/headers.js";
import { downloadJson } from "../lib/utils.js";
import { useToast } from "../providers.jsx";

export default function HeadersTab({ domain, autoRun = false }) {
	const toast = useToast();
	const [status, setStatus] = useState("idle"); // idle | loading | done | error
	const [result, setResult] = useState(null);
	const [onlyIssues, setOnlyIssues] = useState(false);

	const run = async () => {
		if (!domain) return toast("No page to check", "error");
		setStatus("loading");
		try {
			setResult(await checkSecurityHeaders(`https://${domain}/`));
			setStatus("done");
		} catch {
			setStatus("error");
		}
	};

	// Opened from the page context menu: check once on arrival.
	const autoStarted = useRef(false);
	useEffect(() => {
		if (autoRun && domain && !autoStarted.current) { autoStarted.current = true; run(); }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoRun, domain]);

	const rows = result?.rows ?? [];
	const security = rows.filter((r) => r.missingIsIssue);
	const securityPresent = security.filter((r) => r.value !== null).length;
	const visibleRows = onlyIssues ? rows.filter((r) => r.missingIsIssue && r.value === null) : rows;

	const exportJson = () => downloadJson(
		{ url: result.url, status: result.status, fetchedAt: new Date().toISOString(), headers: result.all },
		`power-toys-headers-${domain}-${Date.now()}.json`,
	);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted">Fetches <span className="font-mono text-fg">https://{domain}/</span> and inspects the response headers.</p>
				<Button variant="primary" size="md" icon="shield" onClick={run} disabled={status === "loading"}>{status === "done" ? "Re-check" : "Check headers"}</Button>
			</div>

			{status === "loading" && <Spinner />}
			{status === "idle" && <EmptyState icon="shield" title="No check run yet" hint="Click “Check headers” to inspect this site's security headers." />}
			{status === "error" && (
				<div className="space-y-3">
					<EmptyState icon="alert-circle" title="Couldn't fetch headers" hint="The site didn't respond, blocked the request, or isn't reachable over HTTPS." />
					<div className="flex justify-center"><Button icon="refresh" onClick={run}>Try again</Button></div>
				</div>
			)}

			{status === "done" && result && (
				<>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex flex-wrap gap-2">
							<Badge>{result.status} response</Badge>
							<Badge tone={securityPresent === security.length ? "ok" : "muted"}>{securityPresent}/{security.length} security headers present</Badge>
							{securityPresent < security.length && <Badge tone="danger">{security.length - securityPresent} missing</Badge>}
						</div>
						<div className="flex flex-wrap gap-1.5">
							<Button size="xs" active={onlyIssues} icon="shield" onClick={() => setOnlyIssues((v) => !v)} title="Show only missing recommended headers">Missing only</Button>
							<CopyButton size="xs" label="Copy cURL" getText={() => toCurl(result.url)} />
							<Button size="xs" icon="download" onClick={exportJson}>Export JSON</Button>
						</div>
					</div>

					<Card>
						<CardHeader title="Headers" />
						{!visibleRows.length ? (
							<p className="px-4 py-5 text-center text-sm text-muted">All recommended security headers are present.</p>
						) : (
							<ul className="divide-y divide-line">
								{visibleRows.map((h) => {
									const present = h.value !== null;
									return (
										<li key={h.key} className="flex items-start gap-3 px-4 py-2.5">
											<span className={`mt-2 size-1.5 shrink-0 rounded-full ${present ? "bg-ok" : h.missingIsIssue ? "bg-brand" : "bg-subtle"}`} />
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="text-sm font-semibold">{h.label}</p>
													{h.missingIsIssue && <Badge tone={present ? "ok" : "danger"}>{present ? "Present" : "Missing"}</Badge>}
												</div>
												{present ? <Code className="mt-1">{h.value}</Code> : <p className="mt-0.5 text-xs text-muted">{h.hint}</p>}
											</div>
											{present && <CopyButton size="xs" label="" getText={() => h.value} />}
										</li>
									);
								})}
							</ul>
						)}
					</Card>

					{!!result.extra.length && (
						<Card>
							<CardHeader title="Other headers" actions={<Badge tone="muted">{result.extra.length}</Badge>} />
							<ul className="divide-y divide-line">
								{result.extra.map(([k, v]) => (
									<li key={k} className="flex items-start gap-3 px-4 py-2.5">
										<span className="mt-2 size-1.5 shrink-0 rounded-full bg-subtle" />
										<div className="min-w-0 flex-1">
											<p className="text-sm font-semibold">{k}</p>
											<Code className="mt-1">{v}</Code>
										</div>
										<CopyButton size="xs" label="" getText={() => v} />
									</li>
								))}
							</ul>
						</Card>
					)}
				</>
			)}
		</div>
	);
}
