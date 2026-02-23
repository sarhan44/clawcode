#!/usr/bin/env node
/**
 * Prepends shebang to dist/cli.js so the binary runs with node when invoked as `clawcode`.
 * tsc does not preserve shebang from source.
 */

const fs = require("fs");
const path = require("path");

const cliPath = path.join(__dirname, "..", "dist", "cli.js");
const shebang = "#!/usr/bin/env node\n";

if (!fs.existsSync(cliPath)) {
  console.warn("postbuild: dist/cli.js not found, skipping shebang");
  process.exit(0);
}

const content = fs.readFileSync(cliPath, "utf8");
if (content.startsWith("#!")) {
  process.exit(0);
}

fs.writeFileSync(cliPath, shebang + content, "utf8");
