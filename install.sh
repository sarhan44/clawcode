#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="sarhan44"
REPO_NAME="clawcode"
REF="main"
INSTALL_DIR="${HOME:?}/.clawcode"
BIN_DIR="$INSTALL_DIR/bin"
TARBALL_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${REF}.tar.gz"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

node_major_version() {
  node -p "Number((process.versions && process.versions.node || '0').split('.')[0])" 2>/dev/null || echo "0"
}

download() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$out"
    return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$out" "$url"
    return 0
  fi
  die "Neither curl nor wget is installed."
}

main() {
  TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t clawcode-install)
  trap 'rm -rf "${TMPDIR:-}"' EXIT

  need_cmd node
  need_cmd npm
  need_cmd tar

  local major
  major="$(node_major_version)"
  if [[ "$major" -lt 18 ]]; then
    die "Node.js >= 18 is required (found: $(node -v 2>/dev/null || echo 'unknown')). Install Node.js 18+ and re-run."
  fi

  mkdir -p "$BIN_DIR"
  local archive="$TMPDIR/${REPO_NAME}.tar.gz"
  echo "Downloading ${REPO_OWNER}/${REPO_NAME}@${REF}..."
  download "$TARBALL_URL" "$archive"

  echo "Extracting..."
  tar -xzf "$archive" -C "$TMPDIR"

  local extracted
  extracted="$(cd "$TMPDIR" && ls -d "${REPO_NAME}"-*/ 2>/dev/null | head -n 1)"
  [[ -n "$extracted" ]] || die "Failed to locate extracted directory."
  local repo_dir="$TMPDIR/${extracted%/}"

  [[ -f "${repo_dir}/package.json" ]] || die "package.json not found in extracted repo."

  echo "Installing dependencies..."
  (cd "$repo_dir" && npm install --no-audit --no-fund)

  echo "Building..."
  (cd "$repo_dir" && npm run build)

  echo "Installing globally into $INSTALL_DIR (no sudo)..."
  mkdir -p "$BIN_DIR"
  printf '%s\n' '{"name":"clawcode-install","private":true}' > "$INSTALL_DIR/package.json"
  local packfile
  packfile="$(cd "$repo_dir" && npm pack --silent)"
  [[ -n "$packfile" ]] && [[ -f "$repo_dir/$packfile" ]] || die "npm pack failed."
  (cd "$INSTALL_DIR" && npm install --no-audit --no-fund "$repo_dir/$packfile")
  rm -f "$repo_dir/$packfile"

  local cli_script="$INSTALL_DIR/node_modules/clawcode/dist/cli.js"
  [[ -f "$cli_script" ]] || die "Installed package missing dist/cli.js."
  ln -sf "$cli_script" "$BIN_DIR/clawcode"
  chmod +x "$BIN_DIR/clawcode"

  local path_line="export PATH=\"\$HOME/.clawcode/bin:\$PATH\""
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [[ -f "$rc" ]]; then
      grep -qF '.clawcode/bin' "$rc" 2>/dev/null || echo "$path_line" >> "$rc"
    else
      echo "$path_line" >> "$rc"
    fi
  done

  export PATH="$BIN_DIR:$PATH"

  echo ""
  echo "ClawCode installed successfully."
  echo ""
  echo "This terminal session does not have the new PATH yet (installer ran in a subshell)."
  echo "Either:"
  echo "  • Restart your terminal, then run: clawcode"
  if [[ -n "${SHELL:-}" && "$SHELL" == *zsh* ]]; then
    echo "  • Or run: source ~/.zshrc   then run: clawcode"
  else
    echo "  • Or run: source ~/.bashrc  then run: clawcode"
  fi
}

main "$@"
