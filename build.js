#!/usr/bin/env node

/**
 * Build Script for Power Toys Extension
 *
 * Builds the extension for both Chrome and Firefox from a unified source
 * tree (src/), bundling the React UI and the background script with esbuild,
 * then copying static assets and stamping each output with its own
 * browser-specific manifest from manifests/.
 *
 * Usage: npm run build
 * Options:
 *   --clean-only    Only clean dist/ folder without building
 *   --watch         Rebuild automatically on source changes
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const esbuild = require("esbuild");

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, "src");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const MANIFESTS_DIR = path.join(ROOT_DIR, "manifests");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const CHROME_DIST = path.join(DIST_DIR, "chrome");
const FIREFOX_DIST = path.join(DIST_DIR, "firefox");

const BROWSERS = {
	chrome: { dist: CHROME_DIST, manifest: path.join(MANIFESTS_DIR, "manifest.chrome.json") },
	firefox: { dist: FIREFOX_DIST, manifest: path.join(MANIFESTS_DIR, "manifest.firefox.json") },
};

// Entry points bundled by esbuild. Each becomes a single self-contained
// (IIFE) file, so no ES module support is required at runtime — this is
// what lets the background script import shared helpers from src/app/lib
// without Chrome/Firefox needing `"type": "module"` wiring.
const BUNDLES = [
	{ in: path.join(SRC_DIR, "app", "popup", "main.jsx"), out: path.join(SRC_DIR, "pages", "popup.bundle.js") },
	{ in: path.join(SRC_DIR, "app", "context", "main.jsx"), out: path.join(SRC_DIR, "pages", "context-popup.bundle.js") },
	{ in: path.join(SRC_DIR, "scripts", "background.js"), out: path.join(SRC_DIR, "scripts", "background.bundle.js") },
];

// The design/QA preview (static fixture data, no real extension APIs) is
// only ever built on demand via `npm run preview`, not part of `npm run build`.
const PREVIEW_BUNDLE = { in: path.join(ROOT_DIR, "preview", "main.jsx"), out: path.join(ROOT_DIR, "preview", "preview.bundle.js") };

// ─── Utilities ────────────────────────────────────────────────────────────────

const log = (message, type = "info") => {
	const timestamp = new Date().toLocaleTimeString();
	const prefix = { info: "[INFO]", success: "[✓]", error: "[✗]", warn: "[!]" }[type] || "[LOG]";
	console.log(`${timestamp} ${prefix} ${message}`);
};

const removeDir = (dir) => {
	if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
};

const copyDir = (src, dest, { skip = () => false } = {}) => {
	if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
	for (const file of fs.readdirSync(src)) {
		const srcFile = path.join(src, file);
		const destFile = path.join(dest, file);
		if (skip(srcFile)) continue;
		if (fs.lstatSync(srcFile).isDirectory()) copyDir(srcFile, destFile, { skip });
		else fs.copyFileSync(srcFile, destFile);
	}
};

/**
 * Generate Tailwind CSS.
 *
 * Tailwind v4 ships its CLI as the separate `@tailwindcss/cli` package (the
 * core `tailwindcss` package no longer has a bin), so it's invoked by
 * package name rather than a guessed bin name.
 */
const generateTailwindCSS = () => {
	log("Generating Tailwind CSS...");
	const inputCSS = path.join(SRC_DIR, "styles", "input.css");
	const outputCSS = path.join(SRC_DIR, "styles", "main.css");
	execSync(`npx @tailwindcss/cli -i "${inputCSS}" -o "${outputCSS}" --minify`, { stdio: "inherit", cwd: ROOT_DIR });
	log("Tailwind CSS generated successfully", "success");
};

/**
 * Bundle the React app(s) and the background script with esbuild.
 * JSX runs through esbuild's automatic React 17+ transform, so component
 * files don't need `import React from "react"`.
 */
const bundleJavaScript = async ({ watch = false, bundles = BUNDLES } = {}) => {
	log("Bundling JavaScript (esbuild)...");
	const contexts = [];
	for (const bundle of bundles) {
		const options = {
			entryPoints: [bundle.in],
			outfile: bundle.out,
			bundle: true,
			format: "iife",
			target: ["chrome100", "firefox109"],
			jsx: "automatic",
			jsxImportSource: "react",
			loader: { ".js": "jsx" },
			minify: true,
			define: { "process.env.NODE_ENV": '"production"' },
			logLevel: "warning",
		};
		if (watch) {
			const ctx = await esbuild.context(options);
			await ctx.watch();
			contexts.push(ctx);
		} else {
			await esbuild.build(options);
		}
	}
	log("JavaScript bundled successfully", "success");
	return contexts;
};

/**
 * Build for a specific browser: copy the (already-bundled) src/ and config/
 * trees, skipping source files that only exist to be bundled, then inject
 * the browser's manifest.
 */
const buildForBrowser = (browserName, config) => {
	log(`Building for ${browserName.toUpperCase()}...`);
	removeDir(config.dist);
	fs.mkdirSync(config.dist, { recursive: true });

	copyDir(SRC_DIR, path.join(config.dist, "src"), {
		// The React source (app/) and the unbundled background.js are build
		// inputs only; only the emitted *.bundle.js files ship to the browser.
		skip: (p) => p === path.join(SRC_DIR, "app") || p === path.join(SRC_DIR, "scripts", "background.js"),
	});
	// Ship the bundled background script under the plain name the manifests expect.
	const bundledBg = path.join(config.dist, "src", "scripts", "background.bundle.js");
	fs.copyFileSync(bundledBg, path.join(config.dist, "src", "scripts", "background.js"));
	fs.unlinkSync(bundledBg);

	if (fs.existsSync(CONFIG_DIR)) copyDir(CONFIG_DIR, path.join(config.dist, "config"));

	const assetsDir = path.join(SRC_DIR, "assets");
	if (fs.existsSync(assetsDir)) copyDir(assetsDir, path.join(config.dist, "assets"));

	if (!fs.existsSync(config.manifest)) throw new Error(`Manifest not found: ${config.manifest}`);
	fs.copyFileSync(config.manifest, path.join(config.dist, "manifest.json"));

	log(`${browserName.toUpperCase()} build completed successfully`, "success");
};

const validateRequirements = () => {
	for (const dir of [SRC_DIR, MANIFESTS_DIR]) {
		if (!fs.existsSync(dir)) throw new Error(`Required directory not found: ${dir}`);
	}
	for (const [browser, config] of Object.entries(BROWSERS)) {
		if (!fs.existsSync(config.manifest)) throw new Error(`Manifest not found for ${browser}: ${config.manifest}`);
	}
};

const cleanOnly = () => {
	log("Cleaning dist folder...");
	removeDir(DIST_DIR);
	log("Dist folder cleaned", "success");
};

const build = async ({ watch = false } = {}) => {
	log("========================================");
	log("Power Toys Build System");
	log("========================================");

	validateRequirements();
	log("All requirements validated", "success");

	if (!watch) removeDir(DIST_DIR);

	generateTailwindCSS();
	const watchers = await bundleJavaScript({ watch });

	if (!fs.existsSync(path.join(SRC_DIR, "styles", "main.css")) || !fs.existsSync(path.join(SRC_DIR, "pages", "popup.bundle.js"))) {
		throw new Error("Build assets were not generated — check the esbuild/Tailwind output above.");
	}

	for (const [browserName, config] of Object.entries(BROWSERS)) {
		buildForBrowser(browserName, config);
	}

	log("========================================");
	log(watch ? "Initial build complete — watching for changes..." : "Build completed successfully!", "success");
	log("========================================");
	log("Output locations:");
	log(`  Chrome: ${CHROME_DIST}`);
	log(`  Firefox: ${FIREFOX_DIST}`);

	if (watch) {
		const rebuild = () => {
			try {
				for (const [browserName, config] of Object.entries(BROWSERS)) buildForBrowser(browserName, config);
				log("Rebuilt dist/ after source change", "success");
			} catch (e) {
				log(`Rebuild failed: ${e.message}`, "error");
			}
		};
		fs.watch(SRC_DIR, { recursive: true }, rebuild);
		fs.watch(CONFIG_DIR, { recursive: true }, rebuild);
		process.stdin.resume(); // keep the process alive
		process.on("SIGINT", async () => {
			await Promise.all(watchers.map((c) => c.dispose()));
			process.exit(0);
		});
	}
};

// ─── Main Execution ──────────────────────────────────────────────────────────

const buildPreview = async ({ watch = false } = {}) => {
	log("Building UI preview (fixture data, no real extension APIs)...");
	generateTailwindCSS();
	await bundleJavaScript({ watch, bundles: [PREVIEW_BUNDLE] });
	log("Preview ready: preview/index.html", "success");
};

const args = process.argv.slice(2);

if (args.includes("--clean-only")) {
	cleanOnly();
} else if (args.includes("--preview")) {
	buildPreview({ watch: args.includes("--watch") }).catch((error) => {
		log("Preview build failed!", "error");
		log(error.message, "error");
		process.exit(1);
	});
} else {
	build({ watch: args.includes("--watch") }).catch((error) => {
		log("Build failed!", "error");
		log(error.message, "error");
		process.exit(1);
	});
}
