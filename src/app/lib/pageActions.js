/**
 * Functions injected into the inspected page via scripting.executeScript.
 * Like lib/collectors.js, each must be fully self-contained (no imports,
 * no closures, no shared helpers).
 */

/** The user's current selection, including text selected inside inputs. */
export function getSelectedText() {
	const el = document.activeElement;
	if (el && typeof el.selectionStart === "number" && el.selectionEnd > el.selectionStart) {
		return el.value.slice(el.selectionStart, el.selectionEnd);
	}
	return String(window.getSelection?.() || "");
}

/** Copies text using a temporary textarea (works from an injected script
 * without needing the page to have focus on the async clipboard API). */
export function copyInPage(text) {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
	document.body.appendChild(ta);
	ta.select();
	let ok = false;
	try { ok = document.execCommand("copy"); } catch {}
	ta.remove();
	return ok;
}

/** A small self-dismissing notice in the corner of the page. */
export function toastInPage(message) {
	const id = "power-toys-toast";
	document.getElementById(id)?.remove();
	const t = document.createElement("div");
	t.id = id;
	t.textContent = message;
	t.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;padding:10px 14px;border-radius:12px;background:#161617;color:#f5f5f6;font:600 13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);border:1px solid #2c2c2f;word-break:break-word";
	document.documentElement.appendChild(t);
	setTimeout(() => t.remove(), 3500);
}
