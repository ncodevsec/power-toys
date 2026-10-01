import { cx } from "../../lib/utils.js";

export function Toggle({ checked, onChange, label }) {
	return (
		<button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5">
			<span className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition", checked ? "border-brand bg-brand" : "border-line bg-surface-2")}>
				<span className={cx("inline-block size-3.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-1")} />
			</span>
			{label && <span className="text-sm font-medium text-fg">{label}</span>}
		</button>
	);
}
