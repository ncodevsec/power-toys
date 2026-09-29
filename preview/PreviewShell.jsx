import { useState } from "react";
import { Badge, Icon } from "../src/app/components/ui/index.js";
import { cx } from "../src/app/lib/utils.js";

const VIEWS = [
	{ id: "popup", label: "Extension popup", hint: "640px — click the toolbar icon" },
	{ id: "fulltab", label: "Full tab view", hint: "Opened via the ⤢ button" },
	{ id: "context", label: "Context-menu window", hint: "Right-click → Power Toys → Encode/Decode" },
];

export function PreviewShell({ children }) {
	const [view, setView] = useState("popup");
	return (
		<div className="min-h-screen bg-bg pb-16">
			<div className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
					<div className="flex items-center gap-2.5">
						<span className="grid size-8 place-items-center rounded-xl bg-brand text-white"><Icon name="zap" size={16} /></span>
						<div>
							<p className="text-sm font-extrabold leading-tight">Power Toys — UI preview</p>
							<p className="text-xs text-muted">Static build with example fixture data, not a live scan</p>
						</div>
					</div>
					<Badge tone="muted">Design/QA preview build</Badge>
				</div>
			</div>

			<div className="mx-auto max-w-5xl px-5 pt-6">
				<div role="tablist" className="flex gap-1.5 overflow-x-auto">
					{VIEWS.map((v) => (
						<button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
							className={cx("flex-1 min-w-[170px] rounded-2xl border px-4 py-2.5 text-left transition",
								view === v.id ? "border-brand bg-brand-soft ring-4 ring-brand/10" : "border-line bg-surface hover:border-brand/40")}>
							<span className="block text-sm font-bold">{v.label}</span>
							<span className="block text-xs text-muted">{v.hint}</span>
						</button>
					))}
				</div>
			</div>

			<main className="mx-auto flex max-w-5xl justify-center px-5 pt-8">
				{children(view)}
			</main>
		</div>
	);
}

export const Frame = ({ width, children }) => (
	<div className="overflow-hidden rounded-[28px] border border-line shadow-pop" style={{ width, maxWidth: "100%" }}>
		{children}
	</div>
);
