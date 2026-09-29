import { useLayoutEffect, useState } from "react";

const read = () => {
	try {
		return localStorage.getItem("theme") || "system";
	} catch {
		return "system";
	}
};

/** "system" | "light" | "dark" – toggles the `dark` class on <html>. */
export function useTheme() {
	const [theme, setTheme] = useState(read);
	useLayoutEffect(() => {
		const mq = matchMedia("(prefers-color-scheme: dark)");
		const apply = () =>
			document.documentElement.classList.toggle(
				"dark",
				theme === "dark" || (theme === "system" && mq.matches),
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
