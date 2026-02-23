$ErrorActionPreference = "Stop"

$RepoOwner = "sarhan44"
$RepoName = "clawcode"
$Ref = "main"

function Throw-InstallError([string]$Message) {
  throw "ClawCode installer: $Message"
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Throw-InstallError "Missing required command: $Name"
  }
}

function Get-NodeMajorVersion {
  try {
    $v = & node -p "process.versions.node"
    return [int]($v.Split(".")[0])
  } catch {
    return 0
  }
}

Assert-Command "node"
Assert-Command "npm"

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -lt 18) {
  $nodeVer = ""
  try { $nodeVer = (& node -v) } catch { $nodeVer = "unknown" }
  Throw-InstallError "Node.js >= 18 is required (found: $nodeVer). Install Node.js 18+ and re-run."
}

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("clawcode-install-" + [Guid]::NewGuid().ToString("N"))
$srcDir = Join-Path $tempRoot "src"
$zipPath = Join-Path $tempRoot "$RepoName.zip"

New-Item -ItemType Directory -Path $srcDir -Force | Out-Null

$zipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Ref.zip"

try {
  Write-Host "Downloading $RepoOwner/$RepoName@$Ref..."
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

  Write-Host "Extracting..."
  Expand-Archive -Path $zipPath -DestinationPath $srcDir -Force

  $extracted = Get-ChildItem -Path $srcDir -Directory | Select-Object -First 1
  if (-not $extracted) {
    Throw-InstallError "Failed to locate extracted directory."
  }

  $repoDir = $extracted.FullName
  if (-not (Test-Path (Join-Path $repoDir "package.json"))) {
    Throw-InstallError "package.json not found in extracted repo."
  }

  Write-Host "Installing dependencies..."
  Push-Location $repoDir
  try {
    & npm install --no-audit --no-fund

    Write-Host "Building..."
    & npm run build

    Write-Host "Installing globally..."
    & npm install -g . --no-audit --no-fund
  } finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "ClawCode installed successfully."
  Write-Host "Run: clawcode"
} finally {
  if (Test-Path $tempRoot) {
    Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
  }
}

