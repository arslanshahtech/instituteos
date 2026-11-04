$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path $repoRoot 'apps\api'

if (-not (Test-Path (Join-Path $repoRoot '.env'))) {
  throw 'Repository .env is missing. Configure the existing MongoDB URI locally first.'
}

Push-Location $apiRoot
try {
  # The regular .env URI intentionally has no database name. Never let a local
  # development server silently fall back to MongoDB's default database.
  if (-not $env:DEV_SEED_MONGODB_URI) {
    $env:DEV_SEED_MONGODB_URI = node -e "const fs=require('fs'),d=require('dotenv'),P=require('mongodb-connection-string-url'); const raw=d.parse(fs.readFileSync('../../.env')).MONGODB_URI; if(!raw) throw new Error('MONGODB_URI missing'); const c=new P.ConnectionString(raw); c.pathname='/instituteos_dev'; process.stdout.write(c.toString())"
    if ($LASTEXITCODE -ne 0 -or -not $env:DEV_SEED_MONGODB_URI) {
      throw 'Could not derive the isolated instituteos_dev URI from .env.'
    }
  }

  $targetDatabase = node -e "const P=require('mongodb-connection-string-url'); const c=new P.ConnectionString(process.env.DEV_SEED_MONGODB_URI); process.stdout.write(c.pathname.replace(/^\/+/,''))"
  if ($LASTEXITCODE -ne 0 -or $targetDatabase -ne 'instituteos_dev') {
    throw 'Refusing to start local API: database must be exactly instituteos_dev.'
  }

  $env:MONGODB_URI = $env:DEV_SEED_MONGODB_URI
  $env:NODE_ENV = 'development'
  Write-Host 'InstituteOS API: isolated instituteos_dev database selected.' -ForegroundColor Green
  npm run dev:watch
  if ($LASTEXITCODE -ne 0) {
    throw 'InstituteOS API dev process exited with an error.'
  }
}
finally {
  Remove-Item Env:DEV_SEED_MONGODB_URI -ErrorAction SilentlyContinue
  Pop-Location
}
