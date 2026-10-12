$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $workspaceRoot '.env.local'

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
  throw "Root .env.local was not found at $envFile."
}

$tokenEntry = Get-Content -LiteralPath $envFile |
  Where-Object { $_ -match '^\s*CLOUDFLARE_TUNNEL_TOKEN\s*=' } |
  Select-Object -Last 1

if (-not $tokenEntry) {
  throw 'Add CLOUDFLARE_TUNNEL_TOKEN=<your Cloudflare Tunnel token> to the root .env.local first.'
}

$tunnelToken = ($tokenEntry -replace '^\s*CLOUDFLARE_TUNNEL_TOKEN\s*=\s*', '').Trim()
if (($tunnelToken.StartsWith('"') -and $tunnelToken.EndsWith('"')) -or
    ($tunnelToken.StartsWith("'") -and $tunnelToken.EndsWith("'"))) {
  $tunnelToken = $tunnelToken.Substring(1, $tunnelToken.Length - 2)
}

if (-not $tunnelToken) {
  throw 'CLOUDFLARE_TUNNEL_TOKEN is empty in the root .env.local.'
}

$localCloudflared = Join-Path $workspaceRoot 'cloudflared.exe'
$localCloudflaredIsValid = $false
if (Test-Path -LiteralPath $localCloudflared -PathType Leaf) {
  try {
    $null = & $localCloudflared --version 2>$null
    $localCloudflaredIsValid = ($LASTEXITCODE -eq 0)
  } catch {
    $localCloudflaredIsValid = $false
  }
}

if ($localCloudflaredIsValid) {
  $cloudflaredCommand = $localCloudflared
} else {
  $installedCloudflared = Get-Command -Name 'cloudflared.exe', 'cloudflared' -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $installedCloudflared) {
    throw 'A working cloudflared executable was not found. Install cloudflared and add it to PATH, or replace the repository-root cloudflared.exe with the official Windows executable.'
  }
  $cloudflaredCommand = $installedCloudflared.Source
}

$previousTunnelToken = $env:TUNNEL_TOKEN
try {
  # cloudflared recognizes TUNNEL_TOKEN directly, keeping the secret out of argv.
  $env:TUNNEL_TOKEN = $tunnelToken
  & $cloudflaredCommand tunnel run
  $exitCode = $LASTEXITCODE
} finally {
  if ($null -eq $previousTunnelToken) {
    Remove-Item Env:TUNNEL_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:TUNNEL_TOKEN = $previousTunnelToken
  }
}

exit $exitCode
