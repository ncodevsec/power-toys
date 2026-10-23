import { useCallback, useEffect, useState } from "react";
import { onStorageChanged, storage } from "../lib/browser.js";

/** useState persisted in chrome.storage.local under `key`.
 * Returns [value, setValue, ready]; `ready` is false until the first read,
 * so UI can avoid flashing the default before the saved value arrives. */
export function useStoredState(key, initial) {
	const [value, setValue] = useState(initial);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let alive = true;
		storage.get("local", [key]).then((r) => {
			if (!alive) return;
			if (r?.[key] !== undefined) setValue(r[key]);
			setReady(true);
		});
		const off = onStorageChanged((changes, area) => {
			if (area === "local" && changes[key]) setValue(changes[key].newValue ?? initial);
		});
		return () => { alive = false; off(); };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	const set = useCallback((next) => {
		setValue((prev) => {
			const v = typeof next === "function" ? next(prev) : next;
			storage.set("local", { [key]: v });
			return v;
		});
	}, [key]);

	return [value, set, ready];
}
