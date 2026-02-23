#!/usr/bin/env node
/**
 * Post-build hardening for CLI packaging:
 * - Ensure dist/cli.js has a shebang (some toolchains drop it).
 * - Ensure dist/cli.js is executable on POSIX (Windows uses npm shims).
 */

const fs = require("fs");
const path = require("path");

const cliPath = path.join(__dirname, "..", "dist", "cli.js");
const shebang = "#!/usr/bin/env node\n";

if (!fs.existsSync(cliPath)) {
  console.warn("postbuild: dist/cli.js not found, skipping shebang");
  process.exit(0);
}

let content = fs.readFileSync(cliPath, "utf8");
if (!content.startsWith("#!")) {
  content = shebang + content;
  fs.writeFileSync(cliPath, content, "utf8");
}

// Best-effort chmod on POSIX. On Windows this is a no-op for execution (npm generates shims).
try {
  if (process.platform !== "win32") fs.chmodSync(cliPath, 0o755);
} catch {
  // ignore chmod failures; npm may still provide runnable shims
}
