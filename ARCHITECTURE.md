# ClawCode (pushpak-code-cli) – Architecture

This document describes the **coding-agent** codebase: structure, entry flow, key modules, **logic and algorithms**, and data structures.

---

## 1. Top-level structure

| Path | Purpose |
|------|--------|
| **`cli.ts`** | Entry point: argv parsing, branches (config, version, onboarding, REPL, UI, task). |
| **`agent/`** | Agent orchestration: runner (scan → plan → patches), executor (content map, apply, diff), selector (file relevance), events (emitter for UI). |
| **`cli/`** | CLI flows: `flow.ts` (executeTask, executeTaskWithSummary), onboarding, provider selection, project selection, REPL, cache, console UI. |
| **`config/`** | Config dir `~/.clawcode`, read/write `config.json`, provider registry (prompts/validation), types (ClawCodeConfig, credentials). |
| **`llm/`** | Provider-agnostic LLM: `provider.ts` (dispatch), Azure/Groq/Gemini clients, prompts, types, plan-parser. |
| **`memory/`** | Persistent context: memoryManager (global + session load/save, buildMemoryContext), projectHasher (stable hash for session file names). |
| **`ui/`** | Ink-based TUI: run-ui, App, Logo, Header, ActivityFeed, StatusBar, InputPrompt, DiffView. |
| **`utils/`** | scanner (project scan + .gitignore), patch (applyPatch, applyPatches), diff, backup, re-exported from index. |
| **`scripts/`** | Build/aux scripts. |
| **`types/`** | Shared TypeScript types (if any). |

---

## 2. Entry point and flow

**File:** `coding-agent/cli.ts`

1. **Parse args** via `parseArgs(argv)` → `ParsedArgs`: `task`, `rootDir`, `dryRun`, `yes`, `provider`, `explicitDir`, `debug`, `version`, `shell`, `ui`, `help`.
2. **Branch order:**
   - **`--help` / `-h`** → `showHelp()`, exit 0.
   - **`config`** (argv[0]) → `runProviderConfig()`, exit 0.
   - **`--version` / `-v`** → print version from `package.json`, exit 0.
   - **Onboarding** → `runOnboardingIfNeeded()` (ensure at least one provider in `~/.clawcode/config.json`).
   - **REPL** → if `shell && !ui`: `runRepl({ debug })`, return.
   - **UI (default when no task or `--ui`)** → `showHeader()`, project selection, add recent, read config, select provider (UI or cached), model name, git branch, `createAgentEmitter()`, define `runTask` calling `executeTask(..., emitter, yes: true)`, then `runInkUI({ rootDir, provider, model, branch, emitter, runTask })`, return.
   - **Single/multi task (non-UI)** → `showHeader()`, optionally project selection and inquirer for task; then **do-while** loop: `executeTaskWithSummary(...)` then “What next?” until empty; on error show box and exit if not interactive.

So: **config** and **version** exit early; **onboarding** runs once when no providers; then either **REPL**, **Ink UI**, or **console task loop**.

---

## 3. Key modules

### 3.1 LLM

- **Selection:** `cli/provider.ts`: `--provider` when set, else inquirer; result is `ProviderConfig`. Session cache: `getCachedProvider()` / `setCachedProvider()`.
- **Dispatch:** `llm/provider.ts`: `getStructuredPlan(providerConfig, systemPrompt, userPrompt)` calls Azure, Groq, or Gemini based on `provider`.
- **Clients:** Each client builds messages (system + user), calls API, reads `content` from first choice, then `parsePlanJson(content)`.
- **Prompts:** `llm/prompts.ts`: `buildSystemPrompt()` returns instructions + JSON schema. `buildUserPrompt(task, fileList, selectedFiles, memoryContext)` builds task + file list + selected file contents + optional memory block.
- **Response:** `llm/plan-parser.ts`: `parsePlanJson(raw)` uses `extractJson()` (first `{` to last `}`), then maps to `AgentPlan`.

### 3.2 Task execution

- **Flow:** `cli/flow.ts`: `executeTask(options)` → resolve provider, then `runAgent({ rootDir, task, llm, emitter })`. Then: show analysis/files/patch warnings/diffs (unless emitter); confirm apply; if apply → `applyPatches(...)`; confirm commands; if run → `runCommand(rootDir, cmd)` per command; `saveSessionAfterRun(...)`; return `SummaryOptions`.
- **Agent core:** `agent/runner.ts`: `runAgent(options)` → emit `planning`; scan; select files; load memory; build prompts; `getStructuredPlan(...)`; `buildContentMapForPlan`; `computePatchResults`; `buildDiffs`; return `{ plan, patchResults, diffs, contentMap }`.
- **Apply/diff:** `agent/executor.ts`: content map from scanned + on-demand read; `computePatchResults` = `applyPatches(contentMap, patches)`; `buildDiffs` per patch via `makeReplaceDiff`; `applyPlanToDisk`: backup then write final content.

### 3.3 Runners

- **executeTaskWithSummary** (`cli/flow.ts`): Full task run with console UX; used by REPL and non-UI do-while loop.
- **runInkUI** (`ui/run-ui.tsx`): Renders `<App ... />`, then `waitUntilExit()`. UI driven by emitter and `runTask`.
- **runRepl** (`cli/repl.ts`): readline loop; `:exit`, `:provider`, `:project`, `:clear`, `:help`; else `executeTaskWithSummary` for the line as task.

### 3.4 Config and onboarding

- **Config dir:** `~/.clawcode`; `migrateFromHelixIfNeeded()` then create; config file `config.json`; `readConfig()` / `writeConfig()`, `hasProviders(config)`.
- **Provider registry:** `getProviderRegistry()` returns `ProviderMeta` (id, label, prompts with key, label, default, mask). Validate and build credentials for Azure/Groq/Gemini.
- **First-run:** `runOnboardingIfNeeded()`: if no providers, welcome then loop: select provider or “Skip”, prompt credentials, validate, write, “Add another?”. `runProviderConfig()` for `clawcode config`.

### 3.5 Memory

- **Locations:** `~/.clawcode/memory/global.json`, `~/.clawcode/memory/sessions/<projectHash>.json`. Hash = first 16 chars of SHA256(normalize(projectRoot)).
- **Structures:** Global: `projectSummaries[projectRoot]` = { framework, testCommand, architecture }. Session: lastTasks[], recentFiles[], agentNotes[] (capped: 10, 30, 20).
- **Manager:** `loadGlobalMemory()`, `loadSessionMemory(projectRoot)`, `buildMemoryContext(...)` → string for user prompt. `saveSessionAfterRun(...)` appends/caps and writes session file.

### 3.6 UI (Ink)

- **Entry:** `runInkUI(options)` renders `<App {...} />`, returns `waitUntilExit()`.
- **App:** Subscribes to emitter (planning, read_file, write_file, run_tests, error, success, diffs), maps to FeedItem; layout: Logo → Header → ActivityFeed → DiffView (if any) → StatusBar → InputPrompt. `handleSubmit(task)` calls `runTask(...)`.
- **Components:** Logo (ASCII CLAWCODE), Header (provider, project, branch), ActivityFeed (scroll, spinner/done/error), StatusBar (mode, iteration, model, memory), InputPrompt (submit, scroll), DiffView (unified-style -/+).

---

## 4. Logic and algorithms

### 4.1 High-level execution pipeline

```
User: clawcode [task?] [options]
         │
         ▼
   parseArgs(argv) → ParsedArgs
         │
         ├─ help / config / version → exit
         ├─ runOnboardingIfNeeded()
         ├─ shell && !ui → runRepl() → exit
         ├─ ui || shell || !task → showHeader → project selection → provider → runInkUI() → exit
         └─ task provided → showHeader → (optional project/task prompts) → loop:
                  executeTaskWithSummary(rootDir, task, ...)
                    │
                    ├─ selectProviderUI() → ProviderConfig
                    ├─ runAgent(rootDir, task, llm, emitter)
                    │     ├─ emit("planning")
                    │     ├─ scanProject() → files, fileList
                    │     ├─ selectRelevantFiles(task, files) → selected
                    │     ├─ loadGlobalMemory(), loadSessionMemory(rootDir)
                    │     ├─ buildMemoryContext(), buildSystemPrompt(), buildUserPrompt()
                    │     ├─ getStructuredPlan(llm, systemPrompt, userPrompt) → plan (AgentPlan)
                    │     ├─ buildContentMapForPlan(rootDir, plan, selected) → contentMap
                    │     ├─ computePatchResults(contentMap, plan.patches) → patchResults
                    │     └─ buildDiffs(plan, contentMap, patchResults) → diffs
                    ├─ (if emitter) emit("diffs", { diffs })
                    ├─ (if !emitter) show analysis, files, warnings, diffs
                    ├─ confirm apply → applyPatches() → filesModified
                    ├─ confirm commands → runCommand() per command
                    ├─ saveSessionAfterRun(rootDir, task, filesModified, plan.agent_notes)
                    └─ showSummaryBox() or emit("success")
                  prompt "What next?" → if empty exit, else next task
```

### 4.2 Project scanning algorithm

**File:** `utils/scanner.ts`

**Goal:** Enumerate project files under a size limit, respecting .gitignore and text-only extensions.

**Steps:**

1. **Build ignore rules:** Start with `DEFAULT_IGNORE` (node_modules, .git, dist, .env, etc.). Read `.gitignore` from `rootDir` and add to ignore. Merge `customIgnore`.
2. **List files:** Recursive walk from `rootDir`. For each path, check `ig.ignores(relativePath)`. Keep only paths whose extension is in `TEXT_EXTENSIONS` (e.g. .ts, .js, .py, .md) or path is `Dockerfile`. Stop when `maxFiles` (default 500) reached.
3. **Read content:** For each path, read file (with optional `maxFileSizeBytes`). Build `ScannedFile[]`: `path`, `relativePath`, `content`, `size`. Also build `fileList: string[]` (relative paths only) for the prompt.

**Output:** `{ files: ScannedFile[], fileList: string[] }`.

### 4.3 File selection algorithm (relevance scoring)

**File:** `agent/selector.ts`

**Goal:** Choose a small set of files that fit in the LLM context while maximizing relevance to the task.

**Constants:** `MAX_CONTEXT_FILES = 12`, `MAX_TOTAL_CHARS = 18_000`.

**Algorithm:**

1. **Tokenize task:** Lowercase task, strip non-word chars (keep letters, digits, `.`, `-`, `/`), split on whitespace, drop words of length ≤ 1 → set of keywords.
2. **Score each file:** For each keyword:
   - If keyword appears in **file path** (relativePath): +10.
   - If keyword appears in **file content**: +2.
   - Size penalty: `min(content.length / 1000, 5)` subtracted from score.
3. **Sort:** By score descending.
4. **Greedy selection:** Take files in order until either `MAX_CONTEXT_FILES` is reached or adding the next file would exceed `MAX_TOTAL_CHARS`. Skip files that would exceed the char limit.
5. **Fallback:** If no file was selected but `files.length > 0`, take up to 6 files from the start of the list that fit within `MAX_TOTAL_CHARS` (so the model still gets some context).

**Output:** `ScannedFile[]` (subset of input).

### 4.4 Patch application algorithm

**File:** `utils/patch.ts`

**Goal:** Apply a list of “replace” operations (find → replace) to file contents in memory, in order, so later patches see earlier edits.

**Single patch (`applyPatch(content, find, replace)`):**

1. **Empty find:** Allowed only when `content.length === 0` (new/empty file). Then `newContent = replace`, `applied = true`. Otherwise `applied = false`, error.
2. **Find:** `index = content.indexOf(find)`. If `index === -1` → `applied = false`, error "Find string not found".
3. **Replace:** `newContent = content.slice(0, index) + replace + content.slice(index + find.length)`; `applied = true`.

**Multiple patches (`applyPatches(fileContents: Map, patches: PatchOp[])`):**

1. Initialize `updated = new Map(fileContents)` and `results = new Map()`.
2. For each patch `p` in order:
   - `content = updated.get(p.file)`. If undefined → result `{ applied: false, error: "File not in context" }`.
   - Call `applyPatch(content, p.find, p.replace)`.
   - Store result keyed by `p.file`.
   - If `result.applied` and `result.newContent` is set, set `updated.set(p.file, result.newContent)` so the next patch for the same file sees the updated content.
3. Return `results` (and conceptually the final `updated` is the patched content map).

**Important:** Patches are applied in array order; overlapping or out-of-order edits can cause “find not found” if the LLM’s `find` string no longer exists after a previous patch.

### 4.5 Content map and diff building

**File:** `agent/executor.ts`, `utils/diff.ts`

**Content map (`buildContentMapForPlan`):**

1. Start with `contentMap = getFileContentsMap(scannedFiles)` (selected scanned files only).
2. Collect all `plan.patches[].file` paths; find those not in `contentMap`.
3. For each missing path: read from disk (`readCurrentContents`), set in `contentMap`; if read fails, set `contentMap.set(p, "")` for new files.
4. Return `contentMap` (all files that will be patched have an entry).

**Patch results:** `computePatchResults(contentMap, patches)` = `applyPatches(contentMap, patches)` from utils (same algorithm as above).

**Diffs (`buildDiffs`):**

1. For each patch in `plan.patches`, if `patchResults.get(p.file).applied` is true, append `makeReplaceDiff(p.file, p.find, p.replace)`.
2. `makeReplaceDiff`: output `--- <file>`, `+++ <file>`, then each line of `find` prefixed with `-`, each line of `replace` prefixed with `+`. This is a simple find/replace diff, not a full line-diff (that exists as `makeUnifiedDiff` for old/new full content).

### 4.6 Applying plan to disk

**File:** `agent/executor.ts`, `utils/backup.ts`

**Algorithm (`applyPlanToDisk`):**

1. **Backup:** `pathsToBackup = unique(plan.patches[].file)`. For each path that exists on disk, copy to `.coding-agent-backups/<sanitized_path>.<timestamp>.backup`. New files are not backed up.
2. **Final content:** `finalContent = collectPatchedContent(initialContent, plan.patches)` (same in-memory apply as in 4.4).
3. **Write:** For each `(relPath, content)` in `finalContent`, if `content !== initialContent.get(relPath)`: emit `onWriteFile(relPath)`, `mkdir(dirname(full), { recursive: true })`, `writeFile(full, content)`.

### 4.7 LLM plan parsing

**File:** `llm/plan-parser.ts`

**Algorithm:**

1. **extractJson(text):** Trim; find first `{` and last `}`; if both exist and end > start, return `text.slice(start, end + 1)`. This strips surrounding markdown or prose.
2. **parsePlanJson(raw):** Parse `extractJson(raw)` as JSON. Normalize:
   - `analysis` → string (default "").
   - `files_to_edit` → array of `{ path, reason }` (strings).
   - `patches` → array of `{ file, operation: "replace", find, replace }` (strings).
   - `commands` → array of strings.
   - `agent_notes` → optional array of strings.
3. Return typed `AgentPlan`.

### 4.8 Memory context and persistence

**File:** `memory/memoryManager.ts`, `memory/projectHasher.ts`

**Project hash:** `getProjectHash(projectRoot)` = first 16 characters of `SHA256(resolve(projectRoot))` (normalized path). Used as session filename: `sessions/<hash>.json`.

**buildMemoryContext(projectRoot, globalMemory, sessionMemory):**

1. If global has `projectSummaries[projectRoot]`, add one line: framework, testCommand, architecture.
2. If session has `lastTasks`, add “Recent tasks: …” (up to 5).
3. If session has `recentFiles`, add “Recently touched files: …” (up to 10).
4. If session has `agentNotes`, add “Agent notes: …” (up to 5).
5. If any part was added, return `"\n\n[Context memory]\n" + parts.join("\n") + "\n"`; else `""`.

**saveSessionAfterRun(projectRoot, task, filesTouched, agentNotes):**

1. Load current session (by hash).
2. Prepend `task` to `lastTasks` (dedupe by removing previous same task), cap at `MAX_LAST_TASKS`.
3. Prepend `filesTouched` to `recentFiles`, dedupe, cap at `MAX_RECENT_FILES`.
4. If `agentNotes.length > 0`, prepend to `agentNotes`, cap at `MAX_AGENT_NOTES`.
5. Write session JSON to `~/.clawcode/memory/sessions/<hash>.json`.

### 4.9 Project selection (CLI)

**File:** `cli/projects.ts`

**Logic:** Recent projects from cache first (from `~/.clawcode/recent-projects.json`, max 5). Then `getProjectDirectoryChoices(cwd)`: current dir “.”, subdirs that contain a project marker (e.g. `package.json`, `.git`, `pyproject.toml`, `go.mod`), plus “Other (enter path)”. Inquirer select; if “Other”, prompt for path and check existence.

### 4.10 Provider selection

**File:** `cli/provider.ts`

**Logic:** If `--provider` flag is set, use it (and validate it’s configured). Else if multiple providers configured, inquirer with session default (`getCachedProvider()`). Else if exactly one configured, use it. Else exit with “Configure at least one provider” (or run onboarding).

---

## 5. Data structures

- **ParsedArgs** (`cli.ts`): task, rootDir, dryRun, yes, provider (azure|groq|gemini|null), explicitDir, debug, version, shell, ui, help.
- **FeedItem** (UI): id, icon, text, status (`active` | `done` | `error`).
- **ClawCodeConfig:** defaultProvider, providers: { azure?, groq?, gemini? }. Credentials: AzureCredentials, GroqCredentials, GeminiCredentials (`config/types.ts`).
- **Memory:** Global: `{ projectSummaries: { [projectRoot]: { framework, testCommand, architecture } } }`. Session: `{ lastTasks, recentFiles, agentNotes }` (arrays, capped).
- **AgentPlan** (`llm/types.ts`): analysis (string), files_to_edit ({ path, reason }[]), patches ({ file, operation: "replace", find, replace }[]), commands (string[]), agent_notes? (string[]).
- **Events:** planning, read_file, write_file, run_tests, error, success, diffs (`agent/events.ts`).
- **PatchOp / PatchResult** (`utils/patch.ts`): file, applied, error?, newContent?.
- **ScannedFile** (`utils/scanner.ts`): path, relativePath, content, size.
- **Recent projects:** `~/.clawcode/recent-projects.json`: `{ recent: { path, lastUsed }[] }`, max 5.

---

## 6. File path quick reference

| Area | Key files |
|------|-----------|
| Entry | `cli.ts` |
| Flow / task | `cli/flow.ts`, `agent/runner.ts`, `agent/executor.ts` |
| Runners | `cli/flow.ts`, `ui/run-ui.tsx`, `cli/repl.ts` |
| LLM | `llm/provider.ts`, `llm/azure-client.ts`, `llm/groq-client.ts`, `llm/gemini-client.ts`, `llm/prompts.ts`, `llm/types.ts`, `llm/plan-parser.ts` |
| Config | `config/config.ts`, `config/types.ts`, `config/providerRegistry.ts` |
| Onboarding | `cli/onboarding.ts` |
| Memory | `memory/memoryManager.ts`, `memory/projectHasher.ts` |
| UI | `ui/run-ui.tsx`, `ui/App.tsx`, `ui/Logo.tsx`, `ui/Header.tsx`, `ui/ActivityFeed.tsx`, `ui/StatusBar.tsx`, `ui/InputPrompt.tsx`, `ui/DiffView.tsx` |
| Agent | `agent/selector.ts`, `agent/events.ts` |
| Utils | `utils/scanner.ts`, `utils/patch.ts`, `utils/diff.ts`, `utils/backup.ts`, `utils/index.ts` |
| CLI helpers | `cli/provider.ts`, `cli/projects.ts`, `cli/cache.ts`, `cli/ui.ts` |
