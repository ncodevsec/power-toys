import { Icon, IconButton } from "./ui/index.js";
import { cx } from "../lib/utils.js";

const THEMES = [["system", "monitor"], ["light", "sun"], ["dark", "moon"]];

export function ThemeSwitch({ value, onChange }) {
	return (
		<div className="flex rounded-xl border border-line bg-bg/60 p-0.5">
			{THEMES.map(([id, icon]) => (
				<button
					key={id}
					title={`${id[0].toUpperCase()}${id.slice(1)} theme`}
					aria-pressed={value === id}
					onClick={() => onChange(id)}
					className={cx("grid size-8 place-items-center rounded-[10px] transition", value === id ? "bg-brand text-white shadow" : "text-muted hover:text-fg")}
				>
					<Icon name={icon} size={15} />
				</button>
			))}
		</div>
	);
}

/**
 * Flat, near-black app bar with a single red accent chip and a soft red glow
 * — a contrasty "black background, red foreground" look rather than a big
 * colored hero banner.
 */
export function AppHeader({ title, accent, subtitle, actions, className }) {
	return (
		<header className={cx("relative overflow-hidden border-b border-line bg-surface-2 px-5 pb-4 pt-4", className)}>
			<div className="pointer-events-none absolute -right-12 -top-20 size-56 rounded-full bg-brand/20 blur-3xl" />
			<div className="relative flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm"><Icon name="zap" size={22} strokeWidth={2.4} /></div>
					<div className="min-w-0">
						<h1 className="text-xl font-extrabold leading-tight tracking-tight text-fg">
							{title}
							{accent && <span className="text-brand">{accent}</span>}
						</h1>
						{subtitle && <p className="truncate text-xs font-medium text-muted">{subtitle}</p>}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			</div>
		</header>
	);
}

export const FullTabButton = ({ onClick }) => <IconButton icon="maximize" label="Open in full tab" variant="outline" onClick={onClick} />;
/** Gear icon that becomes a back arrow while Settings is open — the button
 * always describes the action a click will perform, not the current page. */
export const SettingsButton = ({ active, onClick }) => (
	<IconButton icon={active ? "arrow-left" : "settings"} label={active ? "Back" : "Settings"} variant="outline" active={active} onClick={onClick} />
);
