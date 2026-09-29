export const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Only http(s) URLs may become clickable links (never javascript:/data:). */
export const safeHref = (url) => (/^https?:\/\//i.test(url || "") ? url : null);

export const countLines = (text) => (text ? text.split("\n").length : 0);

export const truncateToLines = (text, max) =>
	text.split("\n").slice(0, max).join("\n");

export const initialOf = (name = "") =>
	(name.replace(/^www\./, "")[0] || "?").toUpperCase();

export function downloadJson(data, filename) {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
	);
	const a = Object.assign(document.createElement("a"), {
		href: url,
		download: filename,
	});
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export function pickJsonFile() {
	return new Promise((resolve, reject) => {
		const input = Object.assign(document.createElement("input"), {
			type: "file",
			accept: ".json",
		});
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) return resolve(null);
			const reader = new FileReader();
			reader.onload = () => {
				try {
					resolve(JSON.parse(reader.result));
				} catch (e) {
					reject(e);
				}
			};
			reader.readAsText(file);
		});
		input.click();
	});
}
