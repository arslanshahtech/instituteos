$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path $repoRoot 'apps\api'
$secretDirectory = Join-Path $env:LOCALAPPDATA 'InstituteOS-Local-QA'
$passwordFile = Join-Path $secretDirectory 'password.txt'

if (-not (Test-Path (Join-Path $repoRoot '.env'))) {
  throw 'Repository .env is missing. Configure the existing Atlas MONGODB_URI locally first.'
}

$env:NODE_ENV = 'development'
Push-Location $apiRoot
try {
  if (-not $env:DEV_SEED_MONGODB_URI) {
    $env:DEV_SEED_MONGODB_URI = node -e "const fs=require('fs'),d=require('dotenv'),P=require('mongodb-connection-string-url'); const raw=d.parse(fs.readFileSync('../../.env')).MONGODB_URI; if(!raw) throw new Error('MONGODB_URI missing'); const c=new P.ConnectionString(raw); c.pathname='/instituteos_dev'; process.stdout.write(c.toString())"
    if ($LASTEXITCODE -ne 0 -or -not $env:DEV_SEED_MONGODB_URI) {
      throw 'Could not derive the local development database URI from .env.'
    }
  }

  $targetDatabase = node -e "const P=require('mongodb-connection-string-url'); const c=new P.ConnectionString(process.env.DEV_SEED_MONGODB_URI); process.stdout.write(c.pathname.replace(/^\/+/,''))"
  if ($LASTEXITCODE -ne 0 -or $targetDatabase -ne 'instituteos_dev') {
    throw 'Refusing to seed: DEV_SEED_MONGODB_URI must target exactly instituteos_dev.'
  }

  $devUri = $env:DEV_SEED_MONGODB_URI
  $password = node -e "process.stdout.write('IosQA-'+require('crypto').randomBytes(24).toString('base64url')+'!')"
  if ($LASTEXITCODE -ne 0 -or $password.Length -lt 12) {
    throw 'Could not generate a development-only password.'
  }

  New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
  [System.IO.File]::WriteAllText($passwordFile, $password, [System.Text.Encoding]::ASCII)
  attrib +h $passwordFile

  $env:DEV_SEED_MONGODB_URI = $devUri
  $env:DEV_TEST_PASSWORD = $password

  Write-Host 'Seeding only the instituteos_dev database...' -ForegroundColor Cyan
  npm run seed:dev --workspace @instituteos/api
  if ($LASTEXITCODE -ne 0) {
    throw 'Seed failed. Do not use the development accounts.'
  }

  Write-Host 'Verifying users, roles, memberships, teacher assignment and linked student...' -ForegroundColor Cyan
  npm run verify:dev --workspace @instituteos/api
  if ($LASTEXITCODE -ne 0) {
    throw 'Database verification failed. Do not use the development accounts.'
  }

  Write-Host ''
  Write-Host 'Development accounts are created and verified.' -ForegroundColor Green
  Write-Host 'Database: instituteos_dev'
  Write-Host 'Admin:   admin@instituteos.test'
  Write-Host 'Teacher: teacher@instituteos.test'
  Write-Host 'Parent:  parent@instituteos.test'
  Write-Host "Local-only password file: $passwordFile"
  Write-Host 'Open the hidden password file locally to copy the same password for all three accounts.'
}
finally {
  Remove-Item Env:DEV_SEED_MONGODB_URI -ErrorAction SilentlyContinue
  Remove-Item Env:DEV_TEST_PASSWORD -ErrorAction SilentlyContinue
  $password = $null
  $devUri = $null
  Pop-Location
}
