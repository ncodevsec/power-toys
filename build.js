#!/usr/bin/env node

/**
 * Build Script for Power Toys Extension
 *
 * Builds the extension for both Chrome and Firefox from a unified source directory.
 * - Cleans the dist/ folder
 * - Generates Tailwind CSS
 * - Copies unified src/ to both browser folders
 * - Injects browser-specific manifests
 *
 * Usage: npm run build
 * Options:
 *   --clean-only    Only clean dist/ folder without building
 *   --watch         Watch mode (future enhancement)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, "src");
const CONFIG_DIR = path.join(ROOT_DIR, "config");
const MANIFESTS_DIR = path.join(ROOT_DIR, "manifests");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const CHROME_DIST = path.join(DIST_DIR, "chrome");
const FIREFOX_DIST = path.join(DIST_DIR, "firefox");

const BROWSERS = {
	chrome: {
		dist: CHROME_DIST,
		manifest: path.join(MANIFESTS_DIR, "manifest.chrome.json"),
	},
	firefox: {
		dist: FIREFOX_DIST,
		manifest: path.join(MANIFESTS_DIR, "manifest.firefox.json"),
	},
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Log with timestamp
 */
const log = (message, type = "info") => {
	const timestamp = new Date().toLocaleTimeString();
	const prefix =
		{
			info: "[INFO]",
			success: "[✓]",
			error: "[✗]",
			warn: "[!]",
		}[type] || "[LOG]";

	console.log(`${timestamp} ${prefix} ${message}`);
};

/**
 * Recursively delete a directory
 */
const removeDir = (dir) => {
	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach((file) => {
			const filePath = path.join(dir, file);
			if (fs.lstatSync(filePath).isDirectory()) {
				removeDir(filePath);
			} else {
				fs.unlinkSync(filePath);
			}
		});
		fs.rmdirSync(dir);
	}
};

/**
 * Recursively copy directory
 */
const copyDir = (src, dest) => {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const files = fs.readdirSync(src);
	files.forEach((file) => {
		const srcFile = path.join(src, file);
		const destFile = path.join(dest, file);

		if (fs.lstatSync(srcFile).isDirectory()) {
			copyDir(srcFile, destFile);
		} else {
			fs.copyFileSync(srcFile, destFile);
		}
	});
};

/**
 * Copy file if it exists
 */
const copyFile = (src, dest) => {
	if (!fs.existsSync(src)) {
		return false;
	}
	const destDir = path.dirname(dest);
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
	}
	fs.copyFileSync(src, dest);
	return true;
};

/**
 * Generate Tailwind CSS
 */
const generateTailwindCSS = () => {
	try {
		log("Generating Tailwind CSS...");

		const tailwindConfigPath = path.join(ROOT_DIR, "tailwind.config.js");
		if (!fs.existsSync(tailwindConfigPath)) {
			log(
				"tailwind.config.js not found, skipping CSS generation",
				"warn",
			);
			return;
		}

		const inputCSS = path.join(SRC_DIR, "styles", "input.css");
		const outputCSS = path.join(SRC_DIR, "styles", "tailwind.min.css");

		// Create input.css if it doesn't exist
		if (!fs.existsSync(inputCSS)) {
			fs.mkdirSync(path.dirname(inputCSS), { recursive: true });
			fs.writeFileSync(
				inputCSS,
				"@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
			);
		}

		// Run tailwindcss CLI
		const command = `npx tailwindcss -i "${inputCSS}" -o "${outputCSS}" --minify`;
		execSync(command, { stdio: "inherit", cwd: ROOT_DIR });

		log("Tailwind CSS generated successfully", "success");
	} catch (error) {
		log(`Error generating Tailwind CSS: ${error.message}`, "error");
		// Don't fail build - continue with existing CSS or fallback
	}
};

/**
 * Build for a specific browser
 */
const buildForBrowser = (browserName, config) => {
	try {
		log(`Building for ${browserName.toUpperCase()}...`);

		// Remove old dist folder for this browser
		if (fs.existsSync(config.dist)) {
			removeDir(config.dist);
			log(`Removed old ${browserName} dist folder`);
		}

		// Create browser dist structure
		fs.mkdirSync(config.dist, { recursive: true });

		// Copy src directory
		const srcDest = path.join(config.dist, "src");
		copyDir(SRC_DIR, srcDest);
		log(`Copied src/ to ${browserName}`);

		// Copy config directory
		const configDest = path.join(config.dist, "config");
		if (fs.existsSync(CONFIG_DIR)) {
			copyDir(CONFIG_DIR, configDest);
			log(`Copied config/ to ${browserName}`);
		}

		// Copy assets if separate (they should be in src/assets now)
		const assetsDir = path.join(SRC_DIR, "assets");
		if (fs.existsSync(assetsDir)) {
			const assetsDest = path.join(config.dist, "assets");
			copyDir(assetsDir, assetsDest);
			log(`Copied assets/ to ${browserName}`);
		}

		// Copy manifest
		if (!fs.existsSync(config.manifest)) {
			throw new Error(`Manifest not found: ${config.manifest}`);
		}
		const manifestDest = path.join(config.dist, "manifest.json");
		fs.copyFileSync(config.manifest, manifestDest);
		log(`Injected manifest for ${browserName}`);

		log(
			`${browserName.toUpperCase()} build completed successfully`,
			"success",
		);
	} catch (error) {
		log(`Error building for ${browserName}: ${error.message}`, "error");
		throw error;
	}
};

/**
 * Validate required files exist
 */
const validateRequirements = () => {
	const required = [SRC_DIR, MANIFESTS_DIR];
	for (const dir of required) {
		if (!fs.existsSync(dir)) {
			throw new Error(`Required directory not found: ${dir}`);
		}
	}

	for (const [browser, config] of Object.entries(BROWSERS)) {
		if (!fs.existsSync(config.manifest)) {
			throw new Error(
				`Manifest not found for ${browser}: ${config.manifest}`,
			);
		}
	}
};

/**
 * Clean dist folder only
 */
const cleanOnly = () => {
	try {
		log("Cleaning dist folder...");
		if (fs.existsSync(DIST_DIR)) {
			removeDir(DIST_DIR);
			log("Dist folder cleaned", "success");
		}
	} catch (error) {
		log(`Error cleaning dist: ${error.message}`, "error");
		process.exit(1);
	}
};

/**
 * Main build function
 */
const build = () => {
	try {
		log("========================================");
		log("Power Toys Build System");
		log("========================================");

		// Validate requirements
		validateRequirements();
		log("All requirements validated", "success");

		// Clean old dist
		if (fs.existsSync(DIST_DIR)) {
			removeDir(DIST_DIR);
			log("Removed old dist folder");
		}

		// Generate Tailwind CSS
		generateTailwindCSS();

		// Build for each browser
		for (const [browserName, config] of Object.entries(BROWSERS)) {
			buildForBrowser(browserName, config);
		}

		log("========================================");
		log("Build completed successfully!", "success");
		log("========================================");
		log("Output locations:");
		log(`  Chrome: ${CHROME_DIST}`);
		log(`  Firefox: ${FIREFOX_DIST}`);
	} catch (error) {
		log("Build failed!", "error");
		log(error.message, "error");
		process.exit(1);
	}
};

// ─── Main Execution ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--clean-only")) {
	cleanOnly();
} else if (args.includes("--watch")) {
	log("Watch mode not yet implemented", "warn");
	build();
} else {
	build();
}
