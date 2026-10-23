import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui/index.js";
import { cx } from "../lib/utils.js";

/** Every word of the query must appear in the action's label or group. */
const matches = (a, q) => {
	const hay = `${a.group} ${a.label} ${a.hint || ""}`.toLowerCase();
	return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

/**
 * Quick-open search over tools and actions. `actions` is
 * [{ id, label, group, icon?, hint?, run }]. Arrow keys + Enter to choose,
 * Esc to close.
 */
export function CommandPalette({ open, onClose, actions }) {
	const [query, setQuery] = useState("");
	const [index, setIndex] = useState(0);
	const listRef = useRef(null);

	useEffect(() => { if (open) { setQuery(""); setIndex(0); } }, [open]);

	const results = useMemo(() => actions.filter((a) => matches(a, query)).slice(0, 50), [actions, query]);
	useEffect(() => setIndex(0), [query]);
	useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [index, results]);

	if (!open) return null;

	const choose = (a) => { if (!a) return; onClose(); a.run(); };
	const onKeyDown = (e) => {
		if (e.key === "Escape") { e.preventDefault(); onClose(); }
		else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
		else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
		else if (e.key === "Enter") { e.preventDefault(); choose(results[index]); }
	};

	let lastGroup = null;
	return (
		<div className="fixed inset-0 z-[90] grid place-items-start justify-items-center p-4 pt-[12vh]" onKeyDown={onKeyDown}>
			<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
			<div role="dialog" aria-modal="true" aria-label="Command palette" className="relative flex max-h-[70vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-pop">
				<div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
					<Icon name="search" size={16} className="text-subtle" />
					<input
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search tools and actions…"
						aria-label="Search tools and actions"
						className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
					/>
					<kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-subtle">Esc</kbd>
				</div>
				<div ref={listRef} role="listbox" className="overflow-y-auto p-1.5">
					{!results.length && <p className="px-3 py-8 text-center text-sm text-muted">No matches for “{query}”.</p>}
					{results.map((a, i) => {
						const header = a.group !== lastGroup ? a.group : null;
						lastGroup = a.group;
						return (
							<div key={a.id}>
								{header && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-subtle">{header}</p>}
								<button
									role="option"
									aria-selected={i === index}
									onMouseMove={() => setIndex(i)}
									onClick={() => choose(a)}
									className={cx("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition", i === index ? "bg-brand text-white" : "text-fg")}
								>
									{a.icon && <Icon name={a.icon} size={15} />}
									<span className="min-w-0 flex-1 truncate">{a.label}</span>
									{a.hint && <span className={cx("truncate text-xs font-medium", i === index ? "text-white/80" : "text-subtle")}>{a.hint}</span>}
								</button>
							</div>
						);
					})}
				</div>
				<div className="flex items-center gap-3 border-t border-line bg-surface-2/60 px-4 py-2 text-[11px] text-subtle">
					<span>↑↓ navigate</span><span>↵ run</span><span>Esc close</span>
				</div>
			</div>
		</div>
	);
}
