$ErrorActionPreference = "SilentlyContinue"
$projectDir = "C:\Users\Arsahd Raza\Downloads\ar4goHR\gohr"
$logDir = "C:\Users\Arsahd Raza\AppData\Local\Temp\opencode"

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

$backendLog = "$logDir\backend.log"
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "set AUTH_BYPASS=1&&cd /d `"$projectDir`" && node server/index.mjs > `"$backendLog`" 2>&1"
Write-Host "Backend starting..."
Start-Sleep -Seconds 3

$frontendLog = "$logDir\vite.log"
# No --host: the dev server proxies /auth to the backend, and AUTH_BYPASS=1 is
# set above, so binding vite to every interface would expose admin-as-anyone
# to the network. Set DEV_HOST=0.0.0.0 before running if you need LAN access.
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$projectDir`" && npx vite --clearScreen false --port 9173 > `"$frontendLog`" 2>&1"
Write-Host "Frontend starting..."
Start-Sleep -Seconds 8

$backend = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
$frontend = Get-NetTCPConnection -LocalPort 9173 -ErrorAction SilentlyContinue
Write-Host "Backend on 8080: $(if($backend){'RUNNING'}else{'NOT RUNNING'})"
Write-Host "Frontend on 9173: $(if($frontend){'RUNNING'}else{'NOT RUNNING'})"

if (Test-Path $backendLog) { Write-Host "--- Backend log ---"; Get-Content $backendLog }
if (Test-Path $frontendLog) { Write-Host "--- Frontend log ---"; Get-Content $frontendLog }
