import { useStoredState } from "../hooks/useStoredState.js";

export const PREFS_KEY = "prefs";
export const DEFAULT_PREFS = {
	historyEnabled: true, // remember Cipher inputs/outputs and past Path Finder runs
	historyLimit: 50, // entries kept per history list
	selectionAction: "window", // keyboard shortcut on selected text: "window" (show result) | "copy"
	showTips: true, // first-run tips and hints
};

/** [prefs, setPref(patch), ready] — stored values merged over the defaults. */
export function usePrefs() {
	const [raw, setRaw, ready] = useStoredState(PREFS_KEY, {});
	const setPref = (patch) => setRaw((p) => ({ ...p, ...patch }));
	return [{ ...DEFAULT_PREFS, ...raw }, setPref, ready];
}
