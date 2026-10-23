/**
 * Background Path Finder job runner.
 *
 * Runs inside the background service worker so a scan survives the popup
 * closing. State lives in chrome.storage.local (`pathJob`) after every
 * completed probe, so if the worker is suspended mid-scan it resumes from
 * exactly the paths not yet checked (see resumeIfNeeded, called on every
 * worker start and from a 30s alarm while a job is running).
 */
import { probePath } from "./pathsCheck.js";
import { PATH_HISTORY_KEY } from "./history.js";

export const JOB_KEY = "pathJob";
export const SETTINGS_KEY = "pathSettings";
export const ALARM = "power-toys-pathjob";
export const DEFAULT_SETTINGS = { rps: 5, concurrency: 3, timeoutMs: 6000 };

const clampRps = (n) => Math.min(50, Math.max(1, Number(n) || DEFAULT_SETTINGS.rps));
const sleep = (ms, signal) =>
	new Promise((resolve) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
	});

let running = false;
let controller = null;
let current = null;

const store = (api) => ({
	get: (keys) => new Promise((r) => api.storage.local.get(keys, r)),
	set: (data) => new Promise((r) => api.storage.local.set(data, r)),
});

async function loadSettings(api) {
	const r = await store(api).get([SETTINGS_KEY]);
	const s = { ...DEFAULT_SETTINGS, ...(r?.[SETTINGS_KEY] || {}) };
	return { ...s, rps: clampRps(s.rps) };
}

function setBadge(api, text, color) {
	try {
		api.action.setBadgeText({ text });
		if (color) api.action.setBadgeBackgroundColor({ color });
	} catch {}
}

export const clearBadge = (api) => setBadge(api, "");

/** Saves a finished/cancelled/failed run to the Path Finder history (if enabled). */
async function archive(api, job) {
	if (!job || !job.done) return;
	const r = await store(api).get(["prefs", PATH_HISTORY_KEY]);
	if (r?.prefs?.historyEnabled === false) return;
	const limit = r?.prefs?.historyLimit ?? 50;
	const entry = {
		id: job.id, ts: job.finishedAt || Date.now(), domain: job.domain, status: job.status, total: job.total, done: job.done,
		found: job.results.filter((x) => x.found).slice(0, 200).map(({ path, url, status }) => ({ path, url, status })),
	};
	const list = (r?.[PATH_HISTORY_KEY] || []).filter((x) => x.id !== entry.id);
	await store(api).set({ [PATH_HISTORY_KEY]: [entry, ...list].slice(0, limit) });
}

export async function startJob(api, { domain, paths }) {
	if (running) return { ok: false, error: "A scan is already running" };
	if (!domain) return { ok: false, error: "No site to scan" };
	if (!paths?.length) return { ok: false, error: "No paths configured" };
	const job = {
		id: String(Date.now()),
		status: "running",
		domain,
		baseUrl: `https://${domain}`,
		paths,
		total: paths.length,
		done: 0,
		results: [],
		startedAt: Date.now(),
		finishedAt: null,
		error: null,
	};
	await store(api).set({ [JOB_KEY]: job });
	runJob(api); // intentionally not awaited — progress is read from storage
	return { ok: true, job };
}

export async function cancelJob(api) {
	controller?.abort();
	const job = current || (await store(api).get([JOB_KEY]))?.[JOB_KEY];
	if (job && job.status === "running") {
		job.status = "cancelled";
		job.finishedAt = Date.now();
		await store(api).set({ [JOB_KEY]: job });
		await archive(api, job);
	}
	api.alarms?.clear(ALARM);
	clearBadge(api);
	return { ok: true };
}

export async function ackJob(api) {
	clearBadge(api);
	return { ok: true };
}

/** Called on every worker start and from the alarm: if storage says a job is
 * running but no runner is alive (worker was suspended), pick it back up. */
export async function resumeIfNeeded(api) {
	if (running) return;
	const job = (await store(api).get([JOB_KEY]))?.[JOB_KEY];
	if (job?.status === "running") runJob(api);
}

export async function runJob(api) {
	if (running) return;
	running = true;
	controller = new AbortController();
	const { signal } = controller;
	try {
		const job = (await store(api).get([JOB_KEY]))?.[JOB_KEY];
		if (!job || job.status !== "running") return;
		current = job;
		const settings = await loadSettings(api);
		api.alarms?.create(ALARM, { periodInMinutes: 0.5 });
		setBadge(api, "…", "#3b82f6");

		const doneSet = new Set(job.results.map((r) => r.path));
		const queue = job.paths.filter((p) => !doneSet.has(p));
		const gap = 1000 / settings.rps;
		let nextSlot = Date.now();

		const persist = async () => {
			if (signal.aborted) return;
			job.done = job.results.length;
			await store(api).set({ [JOB_KEY]: job });
		};

		const worker = async () => {
			while (queue.length && !signal.aborted) {
				const path = queue.shift();
				const now = Date.now();
				const wait = Math.max(0, nextSlot - now);
				nextSlot = Math.max(now, nextSlot) + gap; // shared slot clock = global requests/sec cap
				if (wait) await sleep(wait, signal);
				if (signal.aborted) return;
				const entry = await probePath(job.baseUrl, path, { timeoutMs: settings.timeoutMs, signal });
				if (signal.aborted) return;
				job.results.push({ path: entry.path, url: entry.url, status: entry.status, found: entry.found, ...(entry.error ? { error: true } : {}) });
				await persist();
			}
		};

		await Promise.all(Array.from({ length: Math.min(settings.concurrency, queue.length || 1) }, worker));
		if (signal.aborted) return; // cancelJob already recorded the final state

		job.results.sort((a, b) => a.path.localeCompare(b.path));
		job.status = "done";
		job.finishedAt = Date.now();
		job.done = job.results.length;
		await store(api).set({ [JOB_KEY]: job });
		await archive(api, job);
		api.alarms?.clear(ALARM);
		const found = job.results.filter((r) => r.found).length;
		setBadge(api, found ? String(found) : "✓", found ? "#dc2626" : "#16a34a");
	} catch (e) {
		if (current) {
			current.status = "error";
			current.error = String(e?.message || e);
			current.finishedAt = Date.now();
			await store(api).set({ [JOB_KEY]: current });
			await archive(api, current);
		}
		api.alarms?.clear(ALARM);
		setBadge(api, "!", "#dc2626");
	} finally {
		running = false;
		controller = null;
	}
}
