import { useState } from "react";
import { initialOf } from "../lib/utils.js";

// Session-wide cache: domains whose /favicon.ico failed (so we don't retry
// per render) and ones that loaded. The browser's HTTP cache covers the bytes.
const failed = new Set();
const loaded = new Set();

/** Site favicon (`https://<domain>/favicon.ico`), lazy-loaded, falling back
 * to the domain's first letter on a brand-colored tile if it can't load. */
export function Favicon({ domain, size = 24 }) {
	const [broken, setBroken] = useState(() => failed.has(domain));
	const tile = "grid shrink-0 place-items-center rounded-lg";
	if (broken || !domain) {
		return <span style={{ width: size, height: size }} className={`${tile} bg-brand text-[11px] font-extrabold text-white`}>{initialOf(domain)}</span>;
	}
	return (
		<span style={{ width: size, height: size }} className={`${tile} overflow-hidden bg-surface-2`}>
			<img
				src={`https://${domain}/favicon.ico`}
				alt=""
				width={size - 6}
				height={size - 6}
				loading="lazy"
				decoding="async"
				referrerPolicy="no-referrer"
				draggable={false}
				onLoad={() => loaded.add(domain)}
				onError={() => { failed.add(domain); setBroken(true); }}
				className="object-contain"
			/>
		</span>
	);
}
