import { cx } from "../../lib/utils.js";
import { Icon } from "./Icon.jsx";

/**
 * variant "pill": segmented top-level navigation.
 * variant "chip": compact filter chips with optional counts.
 */
export function Tabs({ items, value, onChange, variant = "pill", className }) {
	const pill = variant === "pill";
	return (
		<div
			role="tablist"
			className={cx(
				pill ? "flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 shadow-card" : "flex flex-wrap gap-1.5",
				className,
			)}
		>
			{items.map((t) => {
				const active = t.id === value;
				return (
					<button
						key={t.id}
						role="tab"
						aria-selected={active}
						onClick={() => onChange(t.id)}
						className={cx(
							"inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25",
							pill ? "flex-1 justify-center rounded-xl px-3 py-2 text-[13px]" : "rounded-full border px-3 py-1 text-xs",
							pill
								? active ? "bg-brand text-white shadow" : "text-muted hover:bg-surface-2 hover:text-fg"
								: active ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-line text-muted hover:border-brand/40 hover:text-fg",
						)}
					>
						{t.icon && <Icon name={t.icon} size={15} />}
						{t.label}
						{t.count != null && (
							<span className={cx("rounded-full px-1.5 text-[10px] font-bold leading-4", active && pill ? "bg-white/25 text-white" : "bg-brand/10 text-brand-ink")}>{t.count}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
