$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectDir ".venv\Scripts\python.exe"
$Script = Join-Path $ProjectDir "sync_garmin.py"
$LogFile = Join-Path $ProjectDir "logs\sync.log"

New-Item -ItemType Directory -Force -Path (Split-Path $LogFile) | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $LogFile -Value "===== $timestamp =====" -Encoding utf8

$env:PYTHONIOENCODING = "utf-8"
$output = & $Python $Script 2>&1 | Out-String
Add-Content -Path $LogFile -Value $output -Encoding utf8

# Mantener el log en un tamano razonable (ultimas ~2000 lineas).
$lines = Get-Content $LogFile -Encoding utf8
if ($lines.Count -gt 2000) {
    $lines[-2000..-1] | Set-Content $LogFile -Encoding utf8
}
