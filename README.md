# ClawCode CLI

CLI coding agent (**ClawCode**) that uses **Azure OpenAI**, **Groq**, or **Google Gemini** to plan and apply code changes. It scans your project (respecting `.gitignore`), sends minimal context to the LLM, and applies structured patches with backups and confirmation. Persistent memory (global + per-project session) survives restarts and model switches.

- **Website:** [https://clawcode.vercel.app/](https://clawcode.vercel.app/)
- **Documentation:** [https://clawcode.vercel.app/docs](https://clawcode.vercel.app/docs)

## Requirements

- **Node.js** >= 18
- At least one AI provider configured (Azure OpenAI, Groq, or Google Gemini)

---

## Installation

### Install (GitHub)

Mac / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/sarhan44/clawcode/main/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr https://raw.githubusercontent.com/sarhan44/clawcode/main/install.ps1 -useb | iex
```

After install:

```bash
clawcode
```

On first run, ClawCode will guide you through configuring an AI provider. You can also run `clawcode config` any time to add/update providers.

<img width="1906" height="824" alt="image" src="https://github.com/user-attachments/assets/be90d8ea-5630-435d-ba77-778b41b3071d" />


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

Provider credentials are stored in **`~/.clawcode/config.json`**.

To configure or update providers, run:

```bash
clawcode config
```

ClawCode currently **does not load provider credentials from `.env` files or environment variables**. Use onboarding or `clawcode config` to manage providers.

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
