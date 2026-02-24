#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoOwner = "sarhan44"
$RepoName = "clawcode"
$Ref = "main"
$InstallDir = Join-Path $env:USERPROFILE ".clawcode"
$BinDir = Join-Path $InstallDir "bin"
$ZipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Ref.zip"

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
    $v = & node -p "process.versions.node" 2>$null
    if ($v) { return [int]($v.Trim().Split(".")[0]) }
  } catch {}
  return 0
}

Assert-Command "node"
Assert-Command "npm"

$nodeMajor = Get-NodeMajorVersion
if ($nodeMajor -lt 18) {
  $nodeVer = try { & node -v 2>$null } catch { "unknown" }
  Throw-InstallError "Node.js >= 18 is required (found: $nodeVer). Install Node.js 18+ and re-run."
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "clawcode-install-$([Guid]::NewGuid().ToString('N'))"
$zipPath = Join-Path $tempRoot "$RepoName.zip"

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

  Write-Host "Downloading $RepoOwner/${RepoName}@${Ref}..."
  Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath -UseBasicParsing

  Write-Host "Extracting..."
  Expand-Archive -Path $zipPath -DestinationPath $tempRoot -Force

  $extractedDir = Get-ChildItem -Path $tempRoot -Directory | Where-Object { $_.Name -like "${RepoName}-*" } | Select-Object -First 1
  if (-not $extractedDir) {
    Throw-InstallError "Failed to locate extracted directory."
  }

  $repoDir = $extractedDir.FullName
  if (-not (Test-Path (Join-Path $repoDir "package.json"))) {
    Throw-InstallError "package.json not found in extracted repo."
  }

  Write-Host "Installing dependencies..."
  Push-Location $repoDir
  try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Throw-InstallError "npm install failed." }

    Write-Host "Building..."
    & npm run build
    if ($LASTEXITCODE -ne 0) { Throw-InstallError "npm run build failed." }
  } finally {
    Pop-Location
  }

  Write-Host "Installing globally into $InstallDir (no sudo)..."
  New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
  Set-Content -Path (Join-Path $InstallDir "package.json") -Value '{"name":"clawcode-install","private":true}' -Encoding UTF8

  Push-Location $repoDir
  try {
    $packfile = (& npm pack 2>$null) | Select-Object -Last 1
    $packfile = $packfile?.Trim()
    if (-not $packfile -or -not (Test-Path (Join-Path $repoDir $packfile))) {
      Throw-InstallError "npm pack failed."
    }
    Push-Location $InstallDir
    try {
      & npm install --no-audit --no-fund (Join-Path $repoDir $packfile)
      if ($LASTEXITCODE -ne 0) { Throw-InstallError "npm install failed." }
    } finally {
      Pop-Location
    }
    Remove-Item -Path (Join-Path $repoDir $packfile) -Force -ErrorAction SilentlyContinue
  } finally {
    Pop-Location
  }

  $cliScript = Join-Path $InstallDir "node_modules" "clawcode" "dist" "cli.js"
  if (-not (Test-Path $cliScript)) {
    Throw-InstallError "Installed package missing dist\cli.js."
  }

  $clawcodeCmd = Join-Path $BinDir "clawcode.cmd"
  @"
@echo off
node "%USERPROFILE%\.clawcode\node_modules\clawcode\dist\cli.js" %*
"@ | Set-Content -Path $clawcodeCmd -Encoding ASCII

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $binDirNorm = $BinDir.TrimEnd('\')
  if ($userPath -notlike "*$binDirNorm*") {
    $newPath = if ($userPath) { "$binDirNorm;$userPath" } else { $binDirNorm }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  }

  Write-Host ""
  Write-Host "ClawCode installed successfully."
  Write-Host "Restart your terminal to use 'clawcode' from any folder. Starting ClawCode now..."
  Write-Host ""
  & $clawcodeCmd
} finally {
  if (Test-Path $tempRoot) {
    Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
