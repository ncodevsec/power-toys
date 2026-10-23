// Single source of truth for nav items shared between the popup's Tabs
// (horizontal) and the full-tab view's Sidebar (vertical) presentations.
export const TOP_TABS = [
	{ id: "recon", label: "Recon", icon: "eye" },
	{ id: "cipher", label: "Cipher", icon: "lock" },
	{ id: "bulk", label: "Bulk Opener", icon: "external" },
	{ id: "storage", label: "Storage", icon: "database" },
	{ id: "cookies", label: "Cookies", icon: "cookie" },
];

export const RECON_SUBTABS = [
	{ id: "links", label: "Links", icon: "link" },
	{ id: "params", label: "Params", icon: "sliders" },
	{ id: "secrets", label: "Secrets", icon: "key" },
	{ id: "paths", label: "Paths", icon: "folder" },
	{ id: "headers", label: "Headers", icon: "shield" },
];

export const CIPHER_SUBTABS = [
	{ id: "encode", label: "Encode/Decode", icon: "lock" },
	{ id: "jwt", label: "JWT", icon: "key" },
	{ id: "hash", label: "Hash ID", icon: "hash" },
	{ id: "tools", label: "Utilities", icon: "sliders" },
];

export const SETTINGS_SECTIONS = [
	{ id: "general", label: "General", icon: "shield" },
	{ id: "urls", label: "URL Patterns", icon: "link" },
	{ id: "params", label: "Parameter Keywords", icon: "sliders" },
	{ id: "custom", label: "Custom Patterns", icon: "star" },
	{ id: "paths", label: "Sensitive Paths", icon: "folder" },
];

/** Flat list of every navigable tool, keyed "recon:links" / "cipher:jwt" / "bulk".
 * Used by the full-tab side panel (pinned tools) and, later, the command palette. */
export const DESTINATIONS = [
	...RECON_SUBTABS.map((t) => ({ ...t, key: `recon:${t.id}`, label: `Recon · ${t.label}` })),
	...CIPHER_SUBTABS.map((t) => ({ ...t, key: `cipher:${t.id}`, label: `Cipher · ${t.label}` })),
	...TOP_TABS.filter((t) => !["recon", "cipher"].includes(t.id)).map((t) => ({ ...t, key: t.id })),
];
