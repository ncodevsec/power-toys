import { cx } from "../../lib/utils.js";
import { Icon } from "./Icon.jsx";

const base =
	"w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 read-only:bg-surface-2";

export const Input = ({ className, ...p }) => <input className={cx(base, className)} {...p} />;

export const Textarea = ({ mono = true, className, ...p }) => (
	<textarea className={cx(base, "resize-none", mono && "font-mono text-[13px]", className)} {...p} />
);

export const Select = ({ className, children, ...p }) => (
	<div className="relative">
		<select className={cx(base, "cursor-pointer appearance-none pr-9", className)} {...p}>{children}</select>
		<Icon name="chevron" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
	</div>
);

export const SearchInput = ({ value, onChange, placeholder }) => (
	<div className="relative">
		<Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
		<Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="!rounded-2xl pl-10" />
	</div>
);

export const Field = ({ label, hint, action, children }) => (
	<div className="space-y-1.5">
		<div className="flex items-center justify-between">
			<label className="text-xs font-bold uppercase tracking-wider text-muted">{label}</label>
			{action}
		</div>
		{children}
		{hint && <p className="text-xs text-subtle">{hint}</p>}
	</div>
);
