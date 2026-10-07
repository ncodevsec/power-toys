import { useState } from "react";
import { Icon } from "./ui/index.js";
import { cx } from "../lib/utils.js";
import { TOP_TABS, RECON_SUBTABS, CIPHER_SUBTABS, SETTINGS_SECTIONS } from "../lib/navigation.js";

const ACCORDION_GROUPS = [
	{ id: "recon", icon: "eye", label: "Recon", items: RECON_SUBTABS },
	{ id: "cipher", icon: "lock", label: "Cipher", items: CIPHER_SUBTABS },
];
const STANDALONE_ITEMS = TOP_TABS.filter((t) => !ACCORDION_GROUPS.some((g) => g.id === t.id));

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

/** Collapsible nav group (Recon, Cipher) — the header only toggles
 * open/closed, it's never itself navigable, matching how category headers
 * behave in most docs sidebars. Its children spread open/closed via a CSS
 * grid-rows transition. */
function AccordionGroup({ icon, label, items, active, activeSub, onSelect, defaultOpen = true }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
			>
				<span className="flex items-center gap-2.5">
					<Icon name={icon} size={15} />
					{label}
				</span>
				<Icon name="chevron" size={13} className={cx("transition-transform", open && "rotate-180")} />
			</button>
			<div className={cx("grid transition-all duration-200 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
				<div className="overflow-hidden">
					<div className="space-y-0.5 pt-0.5">
						{items.map((item) => (
							<NavLink key={item.id} indent icon={item.icon} label={item.label} active={active && activeSub === item.id} onClick={() => onSelect(item.id)} />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Full-tab-only left navigation, replacing the popup's horizontal tab bar.
 * Recon and Cipher are collapsible accordion groups (their sub-views spread
 * open below them) rather than always-expanded. While Settings is open, the
 * whole nav swaps to Settings' own sections instead of the main app's tabs.
 */
export function Sidebar({ showSettings, tab, reconSubTab, cipherSubTab, onSelectRecon, onSelectCipher, onSelectTab, settingsSection, onSelectSettingsSection }) {
	return (
		<nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface-2/40 px-3 py-4">
			{showSettings ? (
				<div>
					<p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">Settings</p>
					<div className="space-y-0.5">
						{SETTINGS_SECTIONS.map((s) => (
							<NavLink key={s.id} icon={s.icon} label={s.label} active={settingsSection === s.id} onClick={() => onSelectSettingsSection(s.id)} />
						))}
					</div>
				</div>
			) : (
				<>
					<AccordionGroup icon="eye" label="Recon" items={RECON_SUBTABS} active={tab === "recon"} activeSub={reconSubTab} onSelect={onSelectRecon} />
					<div className="h-px bg-line" />
					<AccordionGroup icon="lock" label="Cipher" items={CIPHER_SUBTABS} active={tab === "cipher"} activeSub={cipherSubTab} onSelect={onSelectCipher} defaultOpen={false} />
					<div className="h-px bg-line" />
					<div className="space-y-0.5">
						{STANDALONE_ITEMS.map((item) => (
							<NavLink key={item.id} icon={item.icon} label={item.label} active={tab === item.id} onClick={() => onSelectTab(item.id)} />
						))}
					</div>
				</>
			)}
		</nav>
	);
}
