@echo off
setlocal
cd /d "%~dp0"

if not exist ".runtime" mkdir ".runtime"

echo Starting Xiashan game and content tools...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$PSNativeCommandUseErrorActionPreference=$false;" ^
  "$root=(Get-Location).Path;" ^
  "$runtime=Join-Path $root '.runtime';" ^
  "New-Item -ItemType Directory -Force -Path $runtime | Out-Null;" ^
  "function Stop-Old($name) {" ^
  "  $pidFile=Join-Path $runtime ($name + '.pid');" ^
  "  if (Test-Path $pidFile) {" ^
  "    $oldPid=(Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1);" ^
  "    if ($oldPid -match '^\d+$' -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) { taskkill /PID $oldPid /T /F 2>$null | Out-Null }" ^
  "    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue;" ^
  "  }" ^
  "}" ^
  "function Stop-Port($port) {" ^
  "  $listeners=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "  foreach ($listener in $listeners) {" ^
  "    if ($listener.OwningProcess -and $listener.OwningProcess -ne $PID) {" ^
  "      Write-Host ('port ' + $port + ': stopping PID=' + $listener.OwningProcess);" ^
  "      taskkill /PID $listener.OwningProcess /T /F 2>$null | Out-Null;" ^
  "    }" ^
  "  }" ^
  "}" ^
  "function Start-Service($name, $command) {" ^
  "  Stop-Old $name;" ^
  "  $out=Join-Path $runtime ($name + '.out.log');" ^
  "  $err=Join-Path $runtime ($name + '.err.log');" ^
  "  Remove-Item $out,$err -Force -ErrorAction SilentlyContinue;" ^
  "  $process=Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WorkingDirectory $root -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden;" ^
  "  Set-Content -Path (Join-Path $runtime ($name + '.pid')) -Value $process.Id -Encoding ascii;" ^
  "  Write-Host ($name + ' PID=' + $process.Id);" ^
  "}" ^
  "Stop-Port 5173;" ^
  "Stop-Port 5174;" ^
  "Start-Sleep -Milliseconds 300;" ^
  "Start-Service 'game' 'npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort';" ^
  "Start-Service 'content-tools' 'npm.cmd run content:tools';"

if errorlevel 1 (
  echo Failed to start services.
  exit /b 1
)

echo.
echo Game:          http://127.0.0.1:5173/
echo Content tools: http://127.0.0.1:5174/
echo.
echo Logs are in .runtime
echo Stop with: stop-xiashan.cmd

endlocal
