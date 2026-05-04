#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const GENERATED_MARKER = "generated-by: sync-claude-command-parity.mjs";

const CODEX_BUILT_INS = new Set([
  "agent",
  "apps",
  "clear",
  "compact",
  "copy",
  "debug-config",
  "diff",
  "exit",
  "experimental",
  "fast",
  "feedback",
  "fork",
  "init",
  "keymap",
  "logout",
  "mcp",
  "mention",
  "model",
  "new",
  "permissions",
  "personality",
  "plan",
  "plugins",
  "ps",
  "quit",
  "resume",
  "review",
  "sandbox-add-read-dir",
  "side",
  "status",
  "statusline",
  "stop",
  "title",
]);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includePlugins = args.has("--include-plugins");
const clean = args.has("--clean");

const homeDir = os.homedir();
const repoRoot = process.cwd();
const claudeHome = process.env.CLAUDE_HOME || path.join(homeDir, ".claude");
const codexPromptsDir =
  process.env.CODEX_PROMPTS_DIR || path.join(homeDir, ".codex", "prompts");

const registry = new Map();

async function readJson(targetPath) {
  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

function commandNameFromFile(filePath) {
  return path.basename(filePath, ".md");
}

function sanitizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addPrompt(name, sourceCommand, sourcePath, scope) {
  const sanitizedName = sanitizeName(name);

  if (!sanitizedName || CODEX_BUILT_INS.has(sanitizedName)) {
    return;
  }

  if (registry.has(sanitizedName)) {
    return;
  }

  registry.set(sanitizedName, {
    name: sanitizedName,
    scope,
    sourceCommand,
    sourcePath,
  });
}

function addPluginPrompt(name, sourceCommand, sourcePath, scope) {
  const sanitizedName = sanitizeName(name);

  if (!sanitizedName || CODEX_BUILT_INS.has(sanitizedName)) {
    return;
  }

  if (!registry.has(sanitizedName)) {
    addPrompt(sanitizedName, sourceCommand, sourcePath, scope);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listMarkdownFiles(root, maxDepth = 1) {
  const files = [];

  async function walk(current, depth) {
    if (depth > maxDepth) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(root, 1);
  return files.sort();
}

function wrapperFor(entry) {
  const sourcePath = entry.sourcePath.replaceAll(homeDir, "$HOME");

  return `---
description: Run Claude Code /${entry.sourceCommand} through Codex command parity.
---

<!-- ${GENERATED_MARKER} -->

Use the \`claude-command-parity\` skill to execute this Claude Code command.

Claude command: /${entry.sourceCommand}
Arguments: $ARGUMENTS
Source scope: ${entry.scope}
Source: ${sourcePath}
`;
}

async function registerProjectCommands() {
  const projectCommandsDir = path.join(repoRoot, ".claude", "commands");
  const files = await listMarkdownFiles(projectCommandsDir, 2);

  for (const filePath of files) {
    const command = commandNameFromFile(filePath);

    addPrompt(command, command, filePath, "repo");
    addPrompt(`cc-${command}`, command, filePath, "repo");
    addPrompt(`cs-${command}`, command, filePath, "repo");
    addPrompt(`claude-${command}`, command, filePath, "repo");
  }
}

async function registerUserCommands() {
  const userCommandsDir = path.join(claudeHome, "commands");
  const files = await listMarkdownFiles(userCommandsDir, 3);

  for (const filePath of files) {
    const command = commandNameFromFile(filePath);

    addPrompt(command, command, filePath, "user");
    addPrompt(`cc-${command}`, command, filePath, "user");
    addPrompt(`claude-${command}`, command, filePath, "user");
  }
}

async function registerGsdWorkflows() {
  const workflowsDir = path.join(claudeHome, "get-shit-done", "workflows");
  const files = await listMarkdownFiles(workflowsDir, 1);

  for (const filePath of files) {
    const workflow = commandNameFromFile(filePath);
    const command = `gsd-${workflow}`;

    addPrompt(command, command, filePath, "gsd");
  }
}

async function registerPluginCommands() {
  if (!includePlugins) {
    return;
  }

  const settings =
    (await readJson(path.join(claudeHome, "settings.json"))) || {};
  const enabledPlugins = settings.enabledPlugins || {};
  const enabledEntries = Object.entries(enabledPlugins)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => {
      const separatorIndex = key.lastIndexOf("@");

      if (separatorIndex < 1) {
        return null;
      }

      return {
        marketplace: key.slice(separatorIndex + 1),
        plugin: key.slice(0, separatorIndex),
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      `${left.marketplace}/${left.plugin}`.localeCompare(
        `${right.marketplace}/${right.plugin}`,
      ),
    );

  for (const entry of enabledEntries) {
    const pluginRoot = path.join(
      claudeHome,
      "plugins",
      "cache",
      entry.marketplace,
      entry.plugin,
    );

    let versions;
    try {
      versions = (await fs.readdir(pluginRoot, { withFileTypes: true }))
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
        .sort();
    } catch {
      continue;
    }

    const version = versions.at(-1);

    if (!version) {
      continue;
    }

    const versionRoot = path.join(pluginRoot, version);
    const files = await listMarkdownFiles(versionRoot, 8);
    const prefix = sanitizeName(`${entry.marketplace}-${entry.plugin}`);
    const scope = `plugin:${entry.plugin}@${entry.marketplace}`;

    for (const filePath of files) {
      if (!filePath.includes(`${path.sep}commands${path.sep}`)) {
        continue;
      }

      const command = commandNameFromFile(filePath);

      if (command.toLowerCase() === "readme") {
        continue;
      }

      addPluginPrompt(command, command, filePath, scope);
      addPrompt(`${prefix}-${command}`, command, filePath, scope);
    }
  }
}

async function cleanGeneratedPrompts() {
  if (!clean || !(await pathExists(codexPromptsDir))) {
    return 0;
  }

  let removed = 0;
  const files = await listMarkdownFiles(codexPromptsDir, 1);

  for (const filePath of files) {
    const contents = await fs.readFile(filePath, "utf8");

    if (!contents.includes(GENERATED_MARKER)) {
      continue;
    }

    if (!dryRun) {
      await fs.unlink(filePath);
    }

    removed += 1;
  }

  return removed;
}

async function writePrompts() {
  const entries = [...registry.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  if (!dryRun) {
    await fs.mkdir(codexPromptsDir, { recursive: true });
  }

  let written = 0;
  let skipped = 0;

  for (const entry of entries) {
    const targetPath = path.join(codexPromptsDir, `${entry.name}.md`);
    const exists = await pathExists(targetPath);

    if (exists) {
      const contents = await fs.readFile(targetPath, "utf8");

      if (!contents.includes(GENERATED_MARKER)) {
        skipped += 1;
        continue;
      }
    }

    if (!dryRun) {
      await fs.writeFile(targetPath, wrapperFor(entry));
    }

    written += 1;
  }

  return { entries, skipped, written };
}

async function main() {
  await registerProjectCommands();
  await registerUserCommands();
  await registerGsdWorkflows();
  await registerPluginCommands();

  const removed = await cleanGeneratedPrompts();
  const { entries, skipped, written } = await writePrompts();

  const scopeCounts = entries.reduce((counts, entry) => {
    counts.set(entry.scope, (counts.get(entry.scope) || 0) + 1);
    return counts;
  }, new Map());

  console.log(
    `${dryRun ? "Would sync" : "Synced"} ${written} Codex prompt wrappers to ${codexPromptsDir}`,
  );
  console.log(`Registered commands: ${entries.length}`);

  for (const [scope, count] of [...scopeCounts.entries()].sort()) {
    console.log(`  ${scope}: ${count}`);
  }

  if (removed > 0) {
    console.log(`${dryRun ? "Would remove" : "Removed"} ${removed} old generated prompt wrappers`);
  }

  if (skipped > 0) {
    console.log(`Skipped ${skipped} existing non-generated prompt files`);
  }

  if (includePlugins) {
    console.log("Included Claude plugin commands");
  } else {
    console.log("Skipped Claude plugin commands; rerun with --include-plugins to add them");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
