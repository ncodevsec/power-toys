import { cx } from "../../lib/utils.js";
import { Icon } from "./Icon.jsx";

const VARIANTS = {
	primary: "bg-brand text-white shadow-sm hover:bg-brand-hover",
	soft: "bg-brand-soft text-brand-ink hover:bg-brand/20",
	outline: "border border-line bg-surface text-fg hover:border-brand/50 hover:text-brand",
	ghost: "text-muted hover:bg-surface-2 hover:text-fg",
};
const SIZES = {
	xs: "h-7 px-2.5 text-xs gap-1",
	sm: "h-8 px-3 text-xs gap-1.5",
	md: "h-10 px-4 text-sm gap-2",
};

/** `active` swaps any variant to the solid brand style (toggle buttons). */
export function Button({ variant = "outline", size = "sm", icon, active, className, children, ...props }) {
	return (
		<button
			type="button"
			className={cx(
				"inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:opacity-50",
				SIZES[size],
				VARIANTS[active ? "primary" : variant],
				className,
			)}
			{...props}
		>
			{icon && <Icon name={icon} size={size === "md" ? 16 : 14} />}
			{children}
		</button>
	);
}

export function IconButton({ icon, label, variant = "outline", className, ...props }) {
	return (
		<Button variant={variant} title={label} aria-label={label} className={cx("!px-0 w-9 !h-9 !rounded-xl", className)} {...props}>
			<Icon name={icon} size={16} />
		</Button>
	);
}
