import { useMemo, useState } from "react";
import { Badge, Code, Dropdown, EmptyState, SearchInput } from "../components/ui/index.js";
import { DomainCard } from "../components/DomainCard.jsx";
import { ResultCount, SensitiveToggle, Toolbar } from "../components/Toolbar.jsx";
import { isSensitiveParam } from "../lib/sensitivity.js";
import { usePatterns, useToast } from "../providers.jsx";

/** domain -> { paramName -> Set(values) } */
function collectParams(links) {
	const out = {};
	for (const { fullUrl } of links) {
		try {
			const { hostname, searchParams } = new URL(fullUrl);
			const dom = (out[hostname] ||= {});
			searchParams.forEach((v, k) => (dom[k] ||= new Set()).add(v));
		} catch {}
	}
	return out;
}

export default function ParamsTab({ links }) {
	const { compiled } = usePatterns();
	const toast = useToast();
	const [query, setQuery] = useState("");
	const [onlySensitive, setOnlySensitive] = useState(false);
	const all = useMemo(() => collectParams(links), [links]);

	const domains = useMemo(() => {
		const q = query.toLowerCase();
		return Object.entries(all)
			.map(([domain, params]) => [
				domain,
				Object.entries(params)
					.filter(([name, values]) =>
						(!q || name.toLowerCase().includes(q) || domain.toLowerCase().includes(q) || [...values].some((v) => v.toLowerCase().includes(q))) &&
						(!onlySensitive || isSensitiveParam(name, compiled)))
					.sort((a, b) => a[0].localeCompare(b[0])),
			])
			.filter(([, entries]) => entries.length)
			.sort((a, b) => a[0].localeCompare(b[0]));
	}, [all, query, onlySensitive, compiled]);

	const copyAs = (mode) => {
		const out = new Set();
		for (const [, entries] of domains)
			for (const [name, values] of entries) {
				if (mode === "names") out.add(name);
				else for (const v of values) if (mode === "both") out.add(`${name}=${v}`); else if (v) out.add(v);
			}
		if (!out.size) return toast("No params to copy", "error");
		navigator.clipboard.writeText([...out].join("\n")).then(() => toast("Copied to clipboard", "success"));
	};

	return (
		<div className="space-y-3">
			<Toolbar
				left={<SearchInput value={query} onChange={setQuery} placeholder="Search params…" />}
				right={<>
					<SensitiveToggle active={onlySensitive} onClick={() => setOnlySensitive((v) => !v)} />
					<Dropdown icon="copy" label="Copy" items={[
						{ label: "Names + Values", onClick: () => copyAs("both") },
						{ label: "Names only", onClick: () => copyAs("names") },
						{ label: "Values only", onClick: () => copyAs("values") },
					]} />
				</>}
			/>
			<ResultCount show={!!query} count={domains.reduce((n, [, e]) => n + e.length, 0)} />

			{!domains.length ? (
				<EmptyState icon="sliders" title="No parameters found" hint="No URL parameters were detected on this page." />
			) : (
				domains.map(([domain, entries]) => (
					<DomainCard key={domain} domain={domain} count={entries.length} unit="params"
						getCopyText={() => entries.flatMap(([n, vs]) => [...vs].map((v) => `${n}=${v}`)).join("\n")}>
						{entries.map(([name, values]) => {
							const list = [...values];
							return (
								<li key={name} className="space-y-1.5 px-4 py-2.5 text-sm">
									<div className="flex items-center gap-2.5">
										<span className="size-1.5 rounded-full bg-brand" />
										<span className="font-semibold text-fg">{name}</span>
										{isSensitiveParam(name, compiled) && <Badge tone="danger">Sensitive</Badge>}
									</div>
									<div className="flex flex-wrap gap-1.5 pl-4">
										{list.slice(0, 3).map((v) => <Code key={v}>{v.length > 50 ? v.slice(0, 50) + "…" : v || "(empty)"}</Code>)}
										{list.length > 3 && <span className="self-center text-xs italic text-subtle">+{list.length - 3} more</span>}
									</div>
								</li>
							);
						})}
					</DomainCard>
				))
			)}
		</div>
	);
}
