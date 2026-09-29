import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getURL, storage } from "./lib/browser.js";
import { compilePatterns } from "./lib/sensitivity.js";
import { Toast } from "./components/ui/Feedback.jsx";

/* ─── Toast ─────────────────────────────────────────────────────────────── */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
	const [toast, setToast] = useState(null);
	const timer = useRef();
	const show = useCallback((message, type = "info") => {
		clearTimeout(timer.current);
		setToast({ message, type, id: Date.now() });
		timer.current = setTimeout(() => setToast(null), 2500);
	}, []);
	return (
		<ToastContext.Provider value={show}>
			{children}
			<Toast toast={toast} />
		</ToastContext.Provider>
	);
}

/* ─── Sensitive patterns (defaults.json + user overrides) ───────────────── */
const PatternsContext = createContext(null);
export const usePatterns = () => useContext(PatternsContext);

export function PatternsProvider({ children }) {
	const [defaults, setDefaults] = useState({ params: [], urlPatterns: [] });
	const [raw, setRaw] = useState({ params: [], urlPatterns: [] });

	useEffect(() => {
		(async () => {
			let base = { params: [], urlPatterns: [] };
			try {
				const res = await fetch(getURL("config/defaults.json"));
				const json = await res.json();
				base = { params: json.params || [], urlPatterns: json.urlPatterns || [] };
			} catch {}
			setDefaults(base);
			const sync = await storage.get("sync", ["sensitivePatterns"]);
			const local = sync?.sensitivePatterns ? sync : await storage.get("local", ["sensitivePatterns"]);
			const saved = local?.sensitivePatterns;
			setRaw({
				params: saved?.params || base.params,
				urlPatterns: saved?.urlPatterns || base.urlPatterns,
			});
		})();
	}, []);

	const save = useCallback(async (patterns) => {
		storage.set("sync", { sensitivePatterns: patterns }); // may exceed sync quota; local is the source of truth
		await storage.set("local", { sensitivePatterns: patterns });
		setRaw(patterns);
	}, []);

	const value = useMemo(
		() => ({ raw, defaults, compiled: compilePatterns(raw), save, reset: () => save(defaults) }),
		[raw, defaults, save],
	);
	return <PatternsContext.Provider value={value}>{children}</PatternsContext.Provider>;
}
