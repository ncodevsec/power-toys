import { useLayoutEffect, useState } from "react";

const read = () => {
	try {
		return localStorage.getItem("theme") || "dark";
	} catch {
		return "dark";
	}
};

/**
 * "system" | "light" | "dark" — toggles the `light` class on <html>.
 * Dark (near-black, red accent) is the baseline theme with no class needed;
 * `.light` overrides it, so a fresh install always opens in the dark theme
 * regardless of the OS preference, matching the intended default look.
 */
export function useTheme() {
	const [theme, setTheme] = useState(read);
	useLayoutEffect(() => {
		const mq = matchMedia("(prefers-color-scheme: light)");
		const apply = () =>
			document.documentElement.classList.toggle(
				"light",
				theme === "light" || (theme === "system" && mq.matches),
			);
		apply();
		mq.addEventListener("change", apply);
		try {
			localStorage.setItem("theme", theme);
		} catch {}
		return () => mq.removeEventListener("change", apply);
	}, [theme]);
	return [theme, setTheme];
}
