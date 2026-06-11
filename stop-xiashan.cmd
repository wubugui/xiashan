@echo off
setlocal
cd /d "%~dp0"

echo Stopping Xiashan game and content tools...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$PSNativeCommandUseErrorActionPreference=$false;" ^
  "$runtime=Join-Path (Get-Location).Path '.runtime';" ^
  "function Stop-Port($port) {" ^
  "  $listeners=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "  foreach ($listener in $listeners) {" ^
  "    if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {" ^
  "      Write-Host ('port ' + $port + ': stopping PID=' + $listener.OwningProcess);" ^
  "      taskkill /PID $listener.OwningProcess /T /F 2>$null | Out-Null;" ^
  "    }" ^
  "  }" ^
  "}" ^
  "if (!(Test-Path $runtime)) { Write-Host 'No .runtime directory found.' }" ^
  "foreach ($name in @('game','content-tools')) {" ^
  "  $pidFile=Join-Path $runtime ($name + '.pid');" ^
  "  if (!(Test-Path $pidFile)) { Write-Host ($name + ': not running'); continue }" ^
  "  $targetPid=(Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1);" ^
  "  if ($targetPid -match '^\d+$' -and (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) {" ^
  "    Write-Host ($name + ': stopping PID=' + $targetPid);" ^
  "    taskkill /PID $targetPid /T /F 2>$null | Out-Null;" ^
  "  }" ^
  "  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue;" ^
  "}" ^
  "Stop-Port 5173;" ^
  "Stop-Port 5174;"

echo Done.
endlocal
