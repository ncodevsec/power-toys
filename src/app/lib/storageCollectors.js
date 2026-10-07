/**
 * Serialized via `scripting.executeScript({ func, args })` and executed
 * inside the inspected page — must be fully self-contained, same
 * constraint as the link/secret collectors in lib/collectors.js.
 */
export function collectWebStorage() {
	const read = (storageArea) => {
		const items = [];
		try {
			for (let i = 0; i < storageArea.length; i++) {
				const key = storageArea.key(i);
				items.push({ key, value: storageArea.getItem(key) });
			}
		} catch {}
		return items;
	};
	return { local: read(window.localStorage), session: read(window.sessionStorage) };
}

export function setWebStorageItem(area, key, value) {
	(area === "session" ? window.sessionStorage : window.localStorage).setItem(key, value);
}

export function removeWebStorageItem(area, key) {
	(area === "session" ? window.sessionStorage : window.localStorage).removeItem(key);
}
