import { useState } from "react";
import { getURL } from "../lib/browser.js";
import { Icon } from "./ui/index.js";
import { cx } from "../lib/utils.js";

/** The extension's PNG logo (shipped in assets/images). Falls back to the
 * bolt icon if the image can't load, e.g. in the static design preview. */
export function Logo({ size = 44, className }) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<span style={{ width: size, height: size }} className={cx("grid shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-sm", className)}>
				<Icon name="zap" size={Math.round(size / 2)} strokeWidth={2.4} />
			</span>
		);
	}
	return (
		<img
			src={getURL("assets/images/power-toys-128.png")}
			width={size}
			height={size}
			alt="Power Toys"
			draggable={false}
			onError={() => setFailed(true)}
			className={cx("shrink-0 rounded-2xl object-contain", className)}
		/>
	);
}
