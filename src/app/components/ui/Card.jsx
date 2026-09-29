import { cx } from "../../lib/utils.js";

export const Card = ({ className, children }) => (
	<section className={cx("overflow-hidden rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</section>
);

/** Header strip: leading node, title, trailing meta/actions. */
export const CardHeader = ({ leading, title, actions }) => (
	<div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/70 px-4 py-2.5">
		<div className="flex min-w-0 items-center gap-2.5">
			{leading}
			<h2 className="truncate text-sm font-bold">{title}</h2>
		</div>
		<div className="flex shrink-0 items-center gap-2">{actions}</div>
	</div>
);
