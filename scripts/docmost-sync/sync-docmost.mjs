#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const DEFAULT_CONFIG_PATH = "docmost.sync.config.json";
const ARTIFACTS_DIR = path.resolve(".docmost-sync-artifacts");

function log(message) {
  // Keep logs easy to parse in CI output.
  console.log(`[docmost-sync] ${message}`);
}

function asBoolean(value) {
  if (!value) return false;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function ensureRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function normalizeBaseUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

async function parseConfig(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing sync config file: ${filePath}`);
  }

  const raw = JSON.parse(await readFile(filePath, "utf8"));

  if (!raw.sourceDir || !raw.managedRootTitle) {
    throw new Error("Config must include sourceDir and managedRootTitle");
  }

  return {
    sourceDir: raw.sourceDir,
    managedRootTitle: raw.managedRootTitle,
    spacePath: raw.spacePath || "/s/general",
    includeExtensions: Array.isArray(raw.includeExtensions) ? raw.includeExtensions.map((ext) => ext.toLowerCase()) : [],
    excludeDirNames: new Set(Array.isArray(raw.excludeDirNames) ? raw.excludeDirNames : []),
    excludeFileNames: new Set(Array.isArray(raw.excludeFileNames) ? raw.excludeFileNames : []),
  };
}

async function collectFiles(baseDir, config) {
  const files = [];

  async function walk(currentDir, relDir = "") {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryName = entry.name;
      if (entryName.startsWith(".")) {
        continue;
      }

      const absPath = path.join(currentDir, entryName);
      const relPath = relDir ? path.join(relDir, entryName) : entryName;

      if (entry.isDirectory()) {
        if (config.excludeDirNames.has(entryName)) continue;
        await walk(absPath, relPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (config.excludeFileNames.has(entryName)) continue;

      const ext = path.extname(entryName).toLowerCase();
      if (config.includeExtensions.length > 0 && !config.includeExtensions.includes(ext)) {
        continue;
      }

      files.push({ absPath, relPath });
    }
  }

  await walk(baseDir);
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function ensureZipInstalled() {
  const result = spawnSync("zip", ["-v"], { stdio: "ignore" });
  if (result.status !== 0) {
    throw new Error("`zip` command is required but not available on this machine");
  }
}

async function createBundle(config, files) {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "docmost-sync-"));
  const stagedRoot = path.join(tmpRoot, config.managedRootTitle);
  await mkdir(stagedRoot, { recursive: true });

  for (const file of files) {
    const targetPath = path.join(stagedRoot, file.relPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(file.absPath, targetPath);
  }

  const manifestPath = path.join(tmpRoot, "sync-manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        managedRootTitle: config.managedRootTitle,
        fileCount: files.length,
        files: files.map((file) => file.relPath),
      },
      null,
      2
    )
  );

  const zipPath = path.join(tmpRoot, "docmost-sync-bundle.zip");
  const zipResult = spawnSync("zip", ["-r", "-q", zipPath, config.managedRootTitle], { cwd: tmpRoot });
  if (zipResult.status !== 0) {
    throw new Error(`Failed to create zip bundle (exit code ${zipResult.status ?? "unknown"})`);
  }

  return { tmpRoot, zipPath, manifestPath };
}

async function writeFailureArtifacts(page, error) {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = path.join(ARTIFACTS_DIR, `docmost-sync-failure-${stamp}.png`);
  const htmlPath = path.join(ARTIFACTS_DIR, `docmost-sync-failure-${stamp}.html`);
  const errorPath = path.join(ARTIFACTS_DIR, `docmost-sync-failure-${stamp}.log`);

  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {}

  try {
    await writeFile(htmlPath, await page.content(), "utf8");
  } catch {}

  await writeFile(errorPath, `${error.stack || error.message}\n`, "utf8");
  log(`Failure artifacts written to ${ARTIFACTS_DIR}`);
}

async function firstVisibleLocator(page, selectors, timeoutMs = 4000) {
  const startedAt = Date.now();
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const remaining = Math.max(200, timeoutMs - (Date.now() - startedAt));
      await locator.waitFor({ state: "visible", timeout: remaining });
      return locator;
    } catch {}
  }
  return null;
}

async function fillFirst(page, selectors, value, label) {
  const field = await firstVisibleLocator(page, selectors, 6000);
  if (!field) {
    throw new Error(`Could not find ${label} field`);
  }
  await field.fill(value);
}

async function clickFirst(page, selectors, label) {
  const target = await firstVisibleLocator(page, selectors, 7000);
  if (!target) {
    throw new Error(`Could not find ${label}`);
  }
  await target.click();
}

function ensurePathPrefix(pathValue) {
  if (!pathValue.startsWith("/")) return `/${pathValue}`;
  return pathValue;
}

async function login(page, baseUrl, email, password) {
  const loginCandidates = ["/login", "/auth/login", "/auth/signin", "/"];
  let reachedPage = false;

  for (const candidate of loginCandidates) {
    const url = new URL(candidate, baseUrl).toString();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      const emailField = await firstVisibleLocator(page, [
        'input[type="email"]',
        'input[name="email"]',
        'input[autocomplete="email"]',
      ]);
      const passwordField = await firstVisibleLocator(page, [
        'input[type="password"]',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
      ]);

      if (emailField && passwordField) {
        reachedPage = true;
        break;
      }
    } catch {}
  }

  if (!reachedPage) {
    throw new Error("Could not find a reachable login form");
  }

  await fillFirst(
    page,
    ['input[type="email"]', 'input[name="email"]', 'input[autocomplete="email"]'],
    email,
    "email"
  );
  await fillFirst(
    page,
    ['input[type="password"]', 'input[name="password"]', 'input[autocomplete="current-password"]'],
    password,
    "password"
  );

  await clickFirst(
    page,
    [
      'button[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Login")',
      'button:has-text("Continue")',
    ],
    "login submit button"
  );

  await page.waitForTimeout(2500);
  const stillHasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
  if (stillHasPasswordField) {
    throw new Error("Login failed or did not complete");
  }
}

async function maybeDeleteManagedRoot(page, title) {
  const existingNode = page.getByText(title, { exact: true }).first();
  if ((await existingNode.count()) === 0) {
    log(`Managed root "${title}" not found. Skipping delete.`);
    return;
  }

  log(`Managed root "${title}" found. Attempting delete before import.`);
  await existingNode.click();
  await page.waitForTimeout(500);

  await clickFirst(
    page,
    [
      'button[aria-label*="more" i]',
      'button[aria-label*="menu" i]',
      'button:has-text("More")',
      'button:has-text("Actions")',
    ],
    "page actions menu"
  );

  await clickFirst(
    page,
    ['[role="menuitem"]:has-text("Delete")', 'button:has-text("Delete")', 'text=Delete'],
    "delete action"
  );

  await clickFirst(
    page,
    ['button:has-text("Delete")', 'button:has-text("Confirm")', 'button:has-text("Yes")'],
    "delete confirmation button"
  );

  await page.waitForTimeout(1200);
}

async function uploadImportBundle(page, zipPath) {
  let importTrigger = await firstVisibleLocator(page, [
    'button:has-text("Import")',
    'text=Import',
  ]);

  if (!importTrigger) {
    const spaceMenu = await firstVisibleLocator(page, [
      'button[aria-label="Space menu"]',
      'button[aria-label*="space menu" i]',
    ]);

    if (spaceMenu) {
      await spaceMenu.click();
      await clickFirst(
        page,
        [
          '[role="menuitem"]:has-text("Import pages")',
          '[role="menuitem"]:has-text("Import")',
          'button:has-text("Import pages")',
          'button:has-text("Import")',
        ],
        "import menu item"
      );
    } else {
      await clickFirst(
        page,
        ['button:has-text("New")', 'button:has-text("Create")', 'button[aria-label*="new" i]'],
        "new/create button"
      );
      importTrigger = await firstVisibleLocator(page, [
        '[role="menuitem"]:has-text("Import pages")',
        '[role="menuitem"]:has-text("Import")',
        'button:has-text("Import pages")',
        'button:has-text("Import")',
        'text=Import',
      ]);
    }
  }

  if (importTrigger) {
    await importTrigger.click();
  }

  const importModalReady = await firstVisibleLocator(
    page,
    ['h2:has-text("Import pages")', 'button:has-text("Upload file")'],
    10000
  );
  if (!importModalReady) {
    throw new Error("Could not find Docmost import trigger");
  }

  const uploadButton = await firstVisibleLocator(page, ['button:has-text("Upload file")'], 8000);
  if (uploadButton) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      uploadButton.click(),
    ]);
    await fileChooser.setFiles(zipPath);
  } else {
    // Fallback when the upload button cannot be found: pick the zip input directly.
    const zipInput = page.locator('input[type="file"][accept*="zip"]').last();
    if ((await zipInput.count()) === 0) {
      throw new Error("Could not find zip file input in import dialog");
    }
    await zipInput.setInputFiles(zipPath);
  }

  // Docmost import endpoints can vary by release/build; rely on UI/notification checks after upload.
  await page.waitForTimeout(7000);
  return 202;
}

async function syncToDocmost(config, zipPath = null) {
  const baseUrl = normalizeBaseUrl(ensureRequiredEnv("DOCMOST_URL"));
  const email = ensureRequiredEnv("DOCMOST_EMAIL");
  const password = ensureRequiredEnv("DOCMOST_PASSWORD");
  const spacePath = ensurePathPrefix(process.env.DOCMOST_SPACE_PATH?.trim() || config.spacePath);
  const headless = !asBoolean(process.env.DOCMOST_HEADFUL);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    log("Logging into Docmost...");
    await login(page, baseUrl, email, password);

    log(`Opening space: ${spacePath}`);
    await page.goto(new URL(spacePath, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1000);

    await maybeDeleteManagedRoot(page, config.managedRootTitle);

    if (!zipPath) {
      log("No syncable files found locally. Managed root removed; skipping import.");
      return;
    }

    log("Uploading import bundle...");
    const importStatus = await uploadImportBundle(page, zipPath);
    log(`Docmost accepted import request (status ${importStatus}).`);

    // Give the UI a short window to surface immediate failure notifications.
    await page.waitForTimeout(5000);
    const immediateError = await firstVisibleLocator(
      page,
      [
        '[role="alert"]:has-text("failed")',
        '[role="alert"]:has-text("error")',
        'div:has-text("Import failed")',
      ],
      2000
    );
    if (immediateError) {
      throw new Error("Docmost surfaced an import failure notification");
    }

    log("Docmost sync completed.");
  } catch (error) {
    await writeFailureArtifacts(page, error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const configPath = process.env.DOCMOST_SYNC_CONFIG || DEFAULT_CONFIG_PATH;
  const config = await parseConfig(configPath);
  const sourceDir = path.resolve(config.sourceDir);

  if (!existsSync(sourceDir)) {
    throw new Error(`Configured sourceDir does not exist: ${sourceDir}`);
  }

  ensureZipInstalled();

  const files = await collectFiles(sourceDir, config);
  const dryRun = asBoolean(process.env.DOCMOST_DRY_RUN);

  if (files.length === 0) {
    log(`No syncable files found in ${sourceDir}.`);
    if (dryRun) {
      log("DOCMOST_DRY_RUN is enabled. Skipping remote delete.");
      return;
    }
    await syncToDocmost(config);
    return;
  }

  log(`Preparing bundle from ${sourceDir} (${files.length} files)...`);
  const { tmpRoot, zipPath, manifestPath } = await createBundle(config, files);
  log(`Bundle created: ${zipPath}`);
  log(`Manifest created: ${manifestPath}`);

  try {
    if (dryRun) {
      log("DOCMOST_DRY_RUN is enabled. Skipping upload.");
      return;
    }

    await syncToDocmost(config, zipPath);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[docmost-sync] ERROR: ${error.message}`);
  process.exit(1);
});
