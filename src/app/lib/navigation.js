// Single source of truth for nav items shared between the popup's Tabs
// (horizontal) and the full-tab view's Sidebar (vertical) presentations.
export const TOP_TABS = [
	{ id: "recon", label: "Recon", icon: "eye" },
	{ id: "bulk", label: "Bulk Opener", icon: "external" },
	{ id: "cipher", label: "Cipher", icon: "lock" },
	{ id: "cookies", label: "Cookies", icon: "cookie" },
];

export const RECON_SUBTABS = [
	{ id: "links", label: "Links", icon: "link" },
	{ id: "params", label: "Params", icon: "sliders" },
	{ id: "secrets", label: "Secrets", icon: "key" },
];

export const SETTINGS_SECTIONS = [
	{ id: "general", label: "General", icon: "shield" },
	{ id: "urls", label: "URL Patterns", icon: "link" },
	{ id: "params", label: "Parameter Keywords", icon: "sliders" },
];
