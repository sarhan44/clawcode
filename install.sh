#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="sarhan44"
REPO_NAME="clawcode"
REF="main"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

node_major_version() {
  node -p "Number((process.versions && process.versions.node || '0').split('.')[0])" 2>/dev/null || echo "0"
}

download() {
  local url="$1"
  local out="$2"
  if have_cmd curl; then
    curl -fsSL "$url" -o "$out"
    return 0
  fi
  if have_cmd wget; then
    wget -qO "$out" "$url"
    return 0
  fi
  die "Neither curl nor wget is installed."
}

main() {
  need_cmd node
  need_cmd npm
  need_cmd tar

  local major
  major="$(node_major_version)"
  if [[ "$major" -lt 18 ]]; then
    die "Node.js >= 18 is required (found: $(node -v)). Install Node.js 18+ and re-run."
  fi

  local tmpdir
  tmpdir="$(mktemp -d 2>/dev/null || mktemp -d -t clawcode-install)"
  cleanup() { rm -rf "$tmpdir"; }
  trap cleanup EXIT

  local url archive srcdir
  url="https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/tar.gz/refs/heads/${REF}"
  archive="${tmpdir}/${REPO_NAME}.tar.gz"
  srcdir="${tmpdir}/src"

  mkdir -p "$srcdir"
  echo "Downloading ${REPO_OWNER}/${REPO_NAME}@${REF}..."
  download "$url" "$archive"

  echo "Extracting..."
  tar -xzf "$archive" -C "$srcdir"

  local extracted
  extracted="$(cd "$srcdir" && ls -d */ 2>/dev/null | head -n 1 || true)"
  [[ -n "$extracted" ]] || die "Failed to locate extracted directory."

  local repo_dir
  repo_dir="${srcdir}/${extracted%/}"

  [[ -f "${repo_dir}/package.json" ]] || die "package.json not found in extracted repo."

  echo "Installing dependencies..."
  (cd "$repo_dir" && npm install --no-audit --no-fund)

  echo "Building..."
  (cd "$repo_dir" && npm run build)

  echo "Installing globally..."
  if (cd "$repo_dir" && npm install -g . --no-audit --no-fund); then
    :
  else
    cat >&2 <<'EOF'

Global install failed (likely due to permissions).

Try one of the following:
  - Re-run with sudo:
      curl -fsSL https://raw.githubusercontent.com/sarhan44/clawcode/main/install.sh | sudo bash
  - Or configure npm to use a user-writable global prefix:
      npm config set prefix "$HOME/.npm-global"
      export PATH="$HOME/.npm-global/bin:$PATH"
      # then re-run the installer

EOF
    exit 1
  fi

  echo ""
  echo "ClawCode installed successfully."
  echo "Run: clawcode"
}

main "$@"

