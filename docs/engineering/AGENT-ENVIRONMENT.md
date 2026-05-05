# Agent Environment

Reference for the Kimi CLI agent environment, MCP server configuration, and zero-friction operation.

---

## Active MCP Servers

MCP servers extend the agent with external capabilities. Only stable, non-interactive servers are enabled.

| Server | Purpose | Version |
|--------|---------|---------|
| **context7** | Upstash Context7 &mdash; documentation search and retrieval for libraries and APIs | `2.2.4` |
| **playwright** | Browser automation &mdash; page interaction, screenshots, end-to-end testing | `0.0.73` |

### Why These Servers

- **context7** &mdash; Used to query current API documentation (Twilio, Stripe, Anthropic, etc.) before writing integration code. Avoids stale patterns from training data.
- **playwright** &mdash; Used for automated browser interaction, visual verification, and integration testing.

### Removed Servers

- **serena** &mdash; Removed because it opened a dashboard popup on every Kimi CLI startup, breaking hands-off agent operation.

---

## Version Pinning Strategy

All MCP servers use explicit version tags. This prevents surprise breaking changes from `@latest` and makes the environment reproducible.

| Rule | Example |
|------|---------|
| Pin to exact version in the `args` array | `"@upstash/context7-mcp@2.2.4"` |
| Never use `@latest` in production config | Avoid `"@playwright/mcp@latest"` |
| Document the pinned version in this file | Keep the table above in sync |

### Updating a Version

1. Verify the new version works: `npx -y <package>@<version> --help` (or check release notes)
2. Update `~/.kimi/mcp.json`
3. Update the version table in this file
4. Restart Kimi CLI and run `kimi mcp list` to confirm

---

## Managing MCP Servers

### List active servers

```bash
kimi mcp list
```

### Add a server

```bash
kimi mcp add <name> <command> [args...]
```

Example:

```bash
kimi mcp add context7 npx -y @upstash/context7-mcp@2.2.4
```

### Remove a server

```bash
kimi mcp remove <name>
```

Example:

```bash
kimi mcp remove serena
```

### Edit manually

The config file is at `~/.kimi/mcp.json`. Edit it directly if you need to change arguments or reorder servers.

---

## Zero-Friction Rules

1. **No popup servers** &mdash; If an MCP server opens a window, dashboard, or browser tab on startup, remove it immediately.
2. **No `@latest`** &mdash; Pin every server to a specific version.
3. **Test before add** &mdash; Run the server command standalone to verify it does not hang or open UI.
4. **Minimal set** &mdash; Only enable servers the codebase actually uses.

---

## Troubleshooting

### MCP server hangs or freezes

1. Remove it from `~/.kimi/mcp.json`
2. Restart Kimi CLI
3. If the server is required, test the command standalone in a shell before re-adding

### MCP server opens a window or popup

Remove it immediately. Servers that require GUI interaction are incompatible with hands-off agent operation.

```bash
kimi mcp remove <server-name>
```

### `kimi mcp list` shows errors

- Check that the command in `~/.kimi/mcp.json` is available in your PATH
- For `npx` packages, verify the version exists: `npm view <package>@<version>`
- For `uvx` packages, verify the tool is installed: `uvx --help`

### Version mismatch after update

If a pinned version stops working (e.g., package deprecated), find the current stable version and update both `~/.kimi/mcp.json` and this document.

---

## Config File Location

```
~/.kimi/mcp.json
```

Keep this file under version control in your dotfiles if you want to sync the agent environment across machines.
