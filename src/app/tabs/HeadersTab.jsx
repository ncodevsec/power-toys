import { useState } from "react";
import { Badge, Button, Card, CardHeader, Code, EmptyState, Spinner } from "../components/ui/index.js";
import { checkSecurityHeaders } from "../lib/headers.js";
import { useToast } from "../providers.jsx";

export default function HeadersTab({ domain }) {
	const toast = useToast();
	const [status, setStatus] = useState("idle"); // idle | loading | done | error
	const [result, setResult] = useState(null);

	const run = async () => {
		if (!domain) return toast("No page to check", "error");
		setStatus("loading");
		try {
			const r = await checkSecurityHeaders(`https://${domain}/`);
			setResult(r);
			setStatus("done");
		} catch {
			setStatus("error");
			toast("Couldn't fetch headers for this site", "error");
		}
	};

	const presentCount = result?.rows.filter((r) => r.value !== null).length ?? 0;
	const issueCount = result?.rows.filter((r) => r.missingIsIssue && r.value === null).length ?? 0;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted">Fetches <span className="font-mono text-fg">https://{domain}/</span> and inspects the response headers.</p>
				<Button variant="primary" size="md" icon="shield" onClick={run}>{status === "done" ? "Re-check" : "Check headers"}</Button>
			</div>

			{status === "loading" && <Spinner />}
			{status === "idle" && <EmptyState icon="shield" title="No check run yet" hint="Click “Check headers” to inspect this site's security headers." />}

			{status === "done" && result && (
				<>
					<div className="flex gap-2">
						<Badge>{result.status} response</Badge>
						<Badge tone="muted">{presentCount}/{result.rows.length} headers present</Badge>
						{issueCount > 0 && <Badge tone="danger">{issueCount} missing (recommended)</Badge>}
					</div>
					<Card>
						<CardHeader title="Headers" />
						<ul className="divide-y divide-line">
							{result.rows.map((h) => (
								<li key={h.key} className="flex items-start gap-3 px-4 py-2.5">
									<span className={`mt-2 size-1.5 shrink-0 rounded-full ${h.value !== null ? "bg-ok" : h.missingIsIssue ? "bg-brand" : "bg-subtle"}`} />
									<div className="min-w-0 flex-1">
										<p className="text-sm font-semibold">{h.label}</p>
										{h.value !== null ? <Code className="mt-1">{h.value}</Code> : <p className="mt-0.5 text-xs text-muted">{h.hint}</p>}
									</div>
								</li>
							))}
						</ul>
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
