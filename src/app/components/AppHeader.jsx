import { Icon, IconButton } from "./ui/index.js";
import { cx } from "../lib/utils.js";

const THEMES = [["system", "monitor"], ["light", "sun"], ["dark", "moon"]];

export function ThemeSwitch({ value, onChange }) {
	return (
		<div className="flex rounded-xl bg-black/20 p-0.5">
			{THEMES.map(([id, icon]) => (
				<button
					key={id}
					title={`${id[0].toUpperCase()}${id.slice(1)} theme`}
					aria-pressed={value === id}
					onClick={() => onChange(id)}
					className={cx("grid size-8 place-items-center rounded-[10px] transition", value === id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white")}
				>
					<Icon name={icon} size={15} />
				</button>
			))}
		</div>
	);
}

/** Crimson hero header shared by the popup and the context-menu window. */
export function AppHeader({ title, accent, subtitle, actions, className }) {
	return (
		<header className={cx("relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-crimson-900 via-crimson-700 to-brand px-5 pb-6 pt-4 text-white shadow-lg", className)}>
			<div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
			<div className="relative flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Icon name="zap" size={22} strokeWidth={2.4} /></div>
					<div className="min-w-0">
						<h1 className="text-xl font-extrabold leading-tight tracking-tight">
							{title}
							{accent && <span className="text-white/70">{accent}</span>}
						</h1>
						{subtitle && <p className="truncate text-xs font-medium text-white/70">{subtitle}</p>}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			</div>
		</header>
	);
}

export const FullTabButton = ({ onClick }) => <IconButton icon="maximize" label="Open in full tab" onClick={onClick} />;
