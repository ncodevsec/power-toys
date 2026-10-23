import { useState } from "react";
import { Badge, Button, Card, CardHeader, CopyButton } from "../../components/ui/index.js";
import { formatWhen } from "../../lib/history.js";

const preview = (s, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s).replace(/\s+/g, " ");

/** Recent Cipher runs: restore, copy the output, delete one, or clear all. */
export default function CipherHistory({ items, enabled, labelOf, onRestore, onDelete, onClear }) {
	const [open, setOpen] = useState(false);
	return (
		<Card>
			<CardHeader
				title="History"
				actions={<>
					<Badge>{items.length}</Badge>
					{!!items.length && <Button size="xs" icon="trash" onClick={onClear}>Clear</Button>}
					<Button size="xs" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</Button>
				</>}
			/>
			{open && (
				!enabled && !items.length ? (
					<p className="px-4 py-4 text-xs text-muted">History is off. Turn it on in Settings → General → History &amp; privacy.</p>
				) : !items.length ? (
					<p className="px-4 py-4 text-xs text-muted">Nothing yet. Your recent encodes and decodes show up here, stored only on this device.</p>
				) : (
					<ul className="divide-y divide-line">
						{items.map((h) => (
							<li key={h.id} className="space-y-1.5 px-4 py-2.5">
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-1.5">
										<Badge tone="brand">{labelOf(h.method)}</Badge>
										<Badge>{h.op}</Badge>
										<span className="truncate text-[11px] text-subtle">{formatWhen(h.ts)}</span>
									</div>
									<div className="flex shrink-0 gap-1.5">
										<Button size="xs" variant="soft" onClick={() => onRestore(h)}>Restore</Button>
										<CopyButton size="xs" label="" getText={() => h.output} />
										<Button size="xs" icon="x" aria-label="Delete entry" title="Delete entry" onClick={() => onDelete(h.id)} />
									</div>
								</div>
								<p className="break-all font-mono text-[12px] text-muted">{preview(h.input)} <span className="text-subtle">→</span> <span className="text-fg">{preview(h.output)}</span></p>
							</li>
						))}
					</ul>
				)
			)}
		</Card>
	);
}
