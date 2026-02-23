# ClawCode CLI

CLI coding agent (**ClawCode**) that uses **Azure OpenAI**, **Groq**, or **Google Gemini** to plan and apply code changes. It scans your project (respecting `.gitignore`), sends minimal context to the LLM, and applies structured patches with backups and confirmation. Persistent memory (global + per-project session) survives restarts and model switches.

## Requirements

- **Node.js** >= 18
- At least one AI provider configured (Azure OpenAI, Groq, or Google Gemini)

---

## Installation

### From source (recommended)

```bash
cd coding-agent
npm install
npm run build
```

**Use locally** (run from project directory):

```bash
node dist/cli.js
# or with a task:
node dist/cli.js "Add unit tests for auth"
```

**Install globally** (use `clawcode` from anywhere):

```bash
npm link
# or: npm install -g .
```

Then run from any directory:

```bash
clawcode
clawcode "Your task here"
```

### Quick start after install

1. Run `clawcode` (or `node dist/cli.js` if not linked).
2. On first run, complete onboarding: choose a project directory, then configure at least one AI provider (or skip and run `clawcode config` later).
3. The interactive TUI opens—enter a task and press Enter.

![ClawCode TUI](docs/tui-screenshot.png)

*ClawCode interactive UI: logo, project/provider info, activity feed, status bar, and task input.*

---

## Commands

| Command | Description |
|--------|-------------|
| `clawcode` | Open the interactive TUI (default). Select project and provider, then enter tasks. |
| `clawcode config` | Add or update AI provider credentials (API keys, endpoints). |
| `clawcode shell` | Start REPL mode with `clawcode>` prompt. Use `:exit`, `:provider`, `:project`, `:help`. |
| `clawcode "task"` | Run a single task in the current directory (no TUI). |
| `clawcode --dir <path> "task"` | Run a task in the specified project directory. |

### Options

| Option | Description |
|--------|-------------|
| `--dir <path>` | Project root directory (default: current directory). |
| `--provider <name>` | Force provider: `azure` \| `groq` \| `gemini`. |
| `--dry-run` | Show plan and diff only; do not apply patches or run commands. |
| `--yes`, `-y` | Skip confirmation prompts (apply patches and run commands automatically). |
| `--debug` | Show detailed errors. |
| `--version`, `-v` | Print version. |
| `--help`, `-h` | Show help. |

### Examples

```bash
# Open TUI (default)
clawcode

# Configure providers
clawcode config

# Single task in current directory
clawcode "Add error handling to login"

# Task in another directory
clawcode --dir ./my-app "Fix typo in README"

# Use a specific provider and skip confirmations
clawcode --provider groq "Refactor auth module" --yes

# Preview changes only
clawcode --dry-run "Add unit tests"
```

---

## Configuration

Config is stored in **`~/.clawcode/config.json`**. On first run, ClawCode runs onboarding and saves your provider settings. You can also use environment variables or a `.env` file in the project or package root.

**Azure OpenAI**

- `AZURE_OPENAI_ENDPOINT` – e.g. `https://<resource>.openai.azure.com`
- `AZURE_OPENAI_API_KEY` – your API key
- `AZURE_OPENAI_DEPLOYMENT` – deployment name (default: `gpt-4o`)

**Groq**

- `GROQ_API_KEY` – your Groq API key
- `GROQ_MODEL` – optional (default: `openai/gpt-oss-120b`)

**Google Gemini**

- `GEMINI_API_KEY` – your Gemini API key
- `GEMINI_MODEL` – optional (default: `gemini-2.0-flash`)

Example `.env`:

```env
AZURE_OPENAI_ENDPOINT=https://myresource.openai.azure.com
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

GROQ_API_KEY=your-groq-key
GROQ_MODEL=openai/gpt-oss-120b

GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash
```

---

## Usage

**Default: interactive TUI**

```bash
clawcode
```

Shows the ClawCode logo and header, then prompts for project directory and AI provider (or uses recent/cached choices). The TUI shows an activity feed, status bar (mode, iteration, model, memory), and the `clawcode ❯` input. Enter a task and press Enter to run.

**Single task (no TUI)**

```bash
clawcode "Add a unit test for the login function"
clawcode --dir /path/to/repo "Refactor auth module"
```

Runs the task once with confirmations (unless `--yes`). Use for scripts or one-off runs.

**REPL mode**

```bash
clawcode shell
```

Persistent prompt; enter tasks one per line. Commands: `:exit`, `:provider`, `:project`, `:clear`, `:help`.

---

## Flow

1. **Scan** – Lists text files under the project root, respecting `.gitignore` and built-in ignore patterns.
2. **Select** – Picks a small set of relevant files (by task keywords and size) so only minimal context is sent.
3. **Plan** – Sends task + file list + selected file contents to the chosen LLM; expects a single JSON object:
   - `analysis` – short explanation
   - `files_to_edit` – `[{ path, reason }]`
   - `patches` – `[{ file, operation: "replace", find, replace }]`
   - `commands` – optional shell commands to run after edits
4. **Review** – Shows analysis, files to edit, and a diff of all patches (in TUI or console).
5. **Confirm** – Asks to apply patches (and optionally run commands), unless `--yes`.
6. **Apply** – Backs up touched files to `.coding-agent-backups/`, then applies patches and, if confirmed, runs commands. Session memory is updated for the project.

---

## Project layout

- `cli.ts` – CLI entry, args, env, and flow (config, REPL, UI, task)
- `agent/` – Runner, file selector, executor, events
- `llm/` – Provider dispatch, Azure/Groq/Gemini clients, prompts, plan parsing
- `config/` – Config dir, provider registry, types
- `memory/` – Global and per-project session memory
- `ui/` – Ink TUI (App, Logo, Header, ActivityFeed, StatusBar, InputPrompt, DiffView)
- `utils/` – Scanner (gitignore-aware), backup, patch, diff

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed logic and algorithms.

---

## Safety

- Backups are written to `.coding-agent-backups/` before any edit.
- Patches are applied only after you confirm (unless `--yes`).
- Commands are run only after a second confirmation (unless `--yes`).
- Use `--dry-run` to see the plan and diff without applying anything.

---

## Contributing

Contributions are welcome! Please open issues or submit pull requests.
