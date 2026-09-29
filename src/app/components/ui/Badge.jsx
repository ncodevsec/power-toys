import { cx } from "../../lib/utils.js";

const TONES = {
	brand: "bg-brand-soft text-brand-ink",
	muted: "bg-surface-2 text-muted",
	danger: "bg-brand text-white",
	// Theme-adaptive instead of hardcoded white — a fixed white-on-white chip
	// disappears in the light theme. bg-fg/10 + text-fg tracks whichever
	// foreground color is legible against the current surface, in either theme.
	solid: "bg-fg/10 text-fg",
};

export const Badge = ({ tone = "muted", className, children }) => (
	<span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-4", TONES[tone], className)}>{children}</span>
);

/** Monospace value chip used for keys, params, URLs and comments. */
export const Code = ({ block, className, children }) => (
	<code className={cx("rounded-lg bg-surface-2 px-2 py-1 font-mono text-[12px] text-fg break-all", block ? "block whitespace-pre-wrap" : "inline-block", className)}>{children}</code>
);
