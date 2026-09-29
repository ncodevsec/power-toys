import { cx } from "../../lib/utils.js";
import { Icon } from "./Icon.jsx";

export const Spinner = () => (
	<div className="flex justify-center py-14">
		<div className="size-8 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
	</div>
);

export const EmptyState = ({ icon = "inbox", title, hint }) => (
	<div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
		<div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink"><Icon name={icon} size={22} /></div>
		<p className="text-sm font-bold">{title}</p>
		{hint && <p className="mt-1 max-w-xs text-xs text-muted">{hint}</p>}
	</div>
);

const TOAST_DOT = { info: "bg-brand", success: "bg-ok", error: "bg-brand" };

export const Toast = ({ toast }) => (
	<div
		role="status"
		className={cx(
			"pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-[280px] items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-fg shadow-pop transition duration-200",
			toast ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
		)}
	>
		<span className={cx("size-2 shrink-0 rounded-full", TOAST_DOT[toast?.type] || TOAST_DOT.info)} />
		{toast?.message}
	</div>
);
