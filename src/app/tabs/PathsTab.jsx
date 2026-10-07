import { useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Spinner } from "../components/ui/index.js";
import { checkPaths, checkGraphqlIntrospection } from "../lib/pathsCheck.js";
import { cx } from "../lib/utils.js";
import { useSensitivePaths, useToast } from "../providers.jsx";

export default function PathsTab({ domain }) {
	const toast = useToast();
	const sensitivePaths = useSensitivePaths();
	const [status, setStatus] = useState("idle"); // idle | loading | done
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [results, setResults] = useState([]);
	const [graphqlResult, setGraphqlResult] = useState(null);

	const run = async () => {
		if (!domain) return toast("No page to check", "error");
		const paths = sensitivePaths?.items || [];
		if (!paths.length) return toast("No paths configured — add some in Settings", "error");
		setStatus("loading");
		setGraphqlResult(null);
		setProgress({ done: 0, total: paths.length });
		const res = await checkPaths(`https://${domain}`, paths, { onProgress: (done, total) => setProgress({ done, total }) });
		setResults(res);
		setStatus("done");
	};

	const found = results.filter((r) => r.found);
	const graphqlHit = found.find((r) => r.path.includes("graphql"));

	const checkGraphql = async () => {
		setGraphqlResult({ loading: true });
		setGraphqlResult(await checkGraphqlIntrospection(graphqlHit.url));
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs text-muted">Checks {sensitivePaths?.items?.length ?? 0} common paths against <span className="font-mono text-fg">https://{domain}/</span>.</p>
				<Button variant="primary" size="md" icon="folder" onClick={run}>{status === "done" ? "Re-check" : "Check paths"}</Button>
			</div>

			{status === "loading" && (
				<div className="space-y-2">
					<Spinner />
					<p className="text-center text-xs text-muted">Checked {progress.done} of {progress.total}…</p>
				</div>
			)}
			{status === "idle" && <EmptyState icon="folder" title="No check run yet" hint="Click “Check paths” to probe common sensitive paths on this site." />}

			{status === "done" && (
				!found.length ? (
					<EmptyState icon="folder" title="Nothing found" hint={`Checked ${results.length} paths — none responded.`} />
				) : (
					<Card>
						<CardHeader title="Found" actions={<Badge tone="danger">{found.length}</Badge>} />
						<ul className="divide-y divide-line">
							{found.map((r) => (
								<li key={r.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
									<div className="flex min-w-0 items-center gap-2.5">
										<span className="size-1.5 shrink-0 rounded-full bg-brand" />
										<a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-fg hover:underline">/{r.path}</a>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<Badge>{r.status}</Badge>
										{r.path.includes("graphql") && <Button size="xs" onClick={checkGraphql}>Check introspection</Button>}
									</div>
								</li>
							))}
						</ul>
					</Card>
				)
			)}

			{graphqlResult && !graphqlResult.loading && (
				<div className={cx("rounded-2xl border px-4 py-3 text-sm", graphqlResult.open ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface-2/60 text-muted")}>
					{graphqlResult.open ? "Introspection is enabled — the full schema is queryable." : "Introspection appears to be disabled (or this isn't a GraphQL endpoint)."}
				</div>
			)}
		</div>
	);
}
