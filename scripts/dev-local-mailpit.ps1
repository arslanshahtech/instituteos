# Local-only email testing for InstituteOS.
# All captured mail stays in Mailpit; no message is forwarded to a real inbox.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

$mailpitCommand = Get-Command 'mailpit' -ErrorAction SilentlyContinue
$mailpitExe = if ($mailpitCommand) { $mailpitCommand.Source } else { $null }

if (-not $mailpitExe) {
  $wingetPackages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  $mailpitPackage = Get-ChildItem $wingetPackages -Directory -Filter 'axllent.mailpit_*' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($mailpitPackage) {
    $candidate = Join-Path $mailpitPackage.FullName 'mailpit.exe'
    if (Test-Path $candidate) { $mailpitExe = $candidate }
  }
}

if (-not $mailpitExe) {
  throw "Mailpit is not installed. Install it with: winget install --id axllent.mailpit -e"
}

$smtpListener = Get-NetTCPConnection -State Listen -LocalPort 1025 -ErrorAction SilentlyContinue
$uiListener = Get-NetTCPConnection -State Listen -LocalPort 8025 -ErrorAction SilentlyContinue

if (-not $smtpListener -and -not $uiListener) {
  Start-Process -FilePath $mailpitExe -ArgumentList @(
    '--listen', '127.0.0.1:8025',
    '--smtp', '127.0.0.1:1025',
    '--smtp-auth-accept-any',
    '--smtp-auth-allow-insecure',
    '--max', '100',
    '--max-age', '24h'
  ) -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 300
    $smtpListener = Get-NetTCPConnection -State Listen -LocalPort 1025 -ErrorAction SilentlyContinue
    $uiListener = Get-NetTCPConnection -State Listen -LocalPort 8025 -ErrorAction SilentlyContinue
  } while ((-not $smtpListener -or -not $uiListener) -and (Get-Date) -lt $deadline)
}

if (-not $smtpListener -or -not $uiListener) {
  throw 'Mailpit ports 1025/8025 are not both available. Check for another process using either port.'
}

foreach ($port in @(4000, 5173)) {
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
    throw "Port $port is already in use. Stop the existing InstituteOS API/Vite process, then rerun this script."
  }
}

# Always run local app services against the isolated instituteos_dev database.
# If the caller did not supply a separate URI, derive one locally from .env
# without printing or persisting its credentials.
Push-Location (Join-Path $repoRoot 'apps\api')
try {
  if (-not $env:DEV_SEED_MONGODB_URI) {
    $env:DEV_SEED_MONGODB_URI = node -e "const fs=require('fs'),d=require('dotenv'),P=require('mongodb-connection-string-url'); const raw=d.parse(fs.readFileSync('../../.env')).MONGODB_URI; if(!raw) throw new Error('MONGODB_URI missing'); const c=new P.ConnectionString(raw); c.pathname='/instituteos_dev'; process.stdout.write(c.toString())"
    if ($LASTEXITCODE -ne 0 -or -not $env:DEV_SEED_MONGODB_URI) {
      throw 'Could not derive the isolated instituteos_dev URI. Configure MONGODB_URI locally or set DEV_SEED_MONGODB_URI.'
    }
  }

  $targetDatabase = node -e "const P=require('mongodb-connection-string-url'); const c=new P.ConnectionString(process.env.DEV_SEED_MONGODB_URI); process.stdout.write(c.pathname.replace(/^\/+/,''))"
  if ($LASTEXITCODE -ne 0 -or $targetDatabase -ne 'instituteos_dev') {
    throw 'Refusing to start local app: DEV_SEED_MONGODB_URI must target exactly instituteos_dev.'
  }
}
finally {
  Pop-Location
}

$env:MONGODB_URI = $env:DEV_SEED_MONGODB_URI
Write-Host 'Using isolated instituteos_dev database; existing .env database will not be used.' -ForegroundColor Green

$env:NODE_ENV = 'development'
$env:SMTP_HOST = '127.0.0.1'
$env:SMTP_PORT = '1025'
$env:SMTP_SECURE = 'false'
$env:SMTP_USER = 'local-test'
$env:SMTP_PASSWORD = 'local-test'
$env:SMTP_FROM = 'InstituteOS Local <no-reply@localhost>'
$env:AUTH_WEB_APP_URL = 'http://127.0.0.1:5173'
$env:AUTH_REQUIRE_EMAIL_VERIFICATION = 'true'
# The development dashboards fan out to multiple read-only API requests.
# Keep this override local-only; production rate limits remain unchanged.
$env:API_RATE_LIMIT_MAX = '600'

Write-Host ''
Write-Host 'InstituteOS local email testing is ready.' -ForegroundColor Green
Write-Host 'App:       http://127.0.0.1:5173'
Write-Host 'API:       http://127.0.0.1:4000'
Write-Host 'Mailpit:   http://127.0.0.1:8025'
Write-Host 'SMTP:      127.0.0.1:1025 (loopback only)'
Write-Host 'Email verification is enabled; verification and invitation emails are captured locally.'
if ($env:DEV_SEED_MONGODB_URI) {
  Write-Host 'Database: dedicated instituteos_dev database.' -ForegroundColor Green
} else {
  Write-Warning 'Database: using MONGODB_URI from .env. Set DEV_SEED_MONGODB_URI to isolate local development data.'
}
Write-Host ''

Push-Location $repoRoot
try {
  npm run dev
}
finally {
  Pop-Location
}
