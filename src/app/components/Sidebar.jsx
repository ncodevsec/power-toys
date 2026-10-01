import { Icon } from "./ui/index.js";
import { cx } from "../lib/utils.js";

const RECON_ITEMS = [
	{ id: "links", label: "Links", icon: "link" },
	{ id: "params", label: "Params", icon: "sliders" },
	{ id: "secrets", label: "Secrets", icon: "key" },
];

const STANDALONE_ITEMS = [
	{ id: "bulk", label: "Bulk Opener", icon: "external" },
	{ id: "cipher", label: "Cipher", icon: "lock" },
	{ id: "cookies", label: "Cookies", icon: "cookie" },
];

function NavLink({ icon, label, active, onClick, indent }) {
	return (
		<button
			onClick={onClick}
			aria-current={active}
			className={cx(
				"flex w-full items-center gap-2.5 rounded-xl py-2 text-sm font-semibold transition",
				indent ? "pl-7 pr-3" : "px-3",
				active ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-fg",
			)}
		>
			<Icon name={icon} size={15} />
			<span className="truncate">{label}</span>
		</button>
	);
}

/**
 * Full-tab-only left navigation, replacing the horizontal tab bar used in
 * the popup. Recon's three sub-views are nested under a section label since
 * there's room here to show the whole hierarchy at once, instead of the
 * popup's two-row (top tabs + chip row) approach.
 */
export function Sidebar({ tab, reconSubTab, onSelectRecon, onSelectTab }) {
	return (
		<nav className="flex w-56 shrink-0 flex-col gap-4 border-r border-line bg-surface-2/40 px-3 py-4">
			<div>
				<p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">Recon</p>
				<div className="space-y-0.5">
					{RECON_ITEMS.map((item) => (
						<NavLink key={item.id} indent icon={item.icon} label={item.label} active={tab === "recon" && reconSubTab === item.id} onClick={() => onSelectRecon(item.id)} />
					))}
				</div>
			</div>
			<div className="h-px bg-line" />
			<div className="space-y-0.5">
				{STANDALONE_ITEMS.map((item) => (
					<NavLink key={item.id} icon={item.icon} label={item.label} active={tab === item.id} onClick={() => onSelectTab(item.id)} />
				))}
			</div>
		</nav>
	);
}
