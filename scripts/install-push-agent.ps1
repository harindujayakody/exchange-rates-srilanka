# Installs the LKR Rates push agent as a Windows background task: starts at logon, no window, restarts if it stops.
#   powershell -ExecutionPolicy Bypass -File scripts\install-push-agent.ps1            install (or update) and start
#   powershell -ExecutionPolicy Bypass -File scripts\install-push-agent.ps1 -Uninstall stop and remove
# Logs: push-agent.log in the project folder.
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$name = 'LKR Rates push agent'
$dir = Split-Path -Parent $PSScriptRoot

if ($Uninstall) {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Host "Removed '$name'."
  return
}

$envFile = Join-Path $dir '.env'
if (-not (Test-Path $envFile)) { throw "No .env in $dir. Copy .env.example to .env first." }
$envText = Get-Content $envFile -Raw
if ($envText -notmatch '(?m)^OPENROUTER_API_KEY=.+') { throw 'Add OPENROUTER_API_KEY to .env first.' }
if ($envText -notmatch '(?m)^PUSH_TO=.+') {
  Add-Content $envFile "`nPUSH_TO=https://rates.infiax.dev"
  Write-Host 'Added PUSH_TO=https://rates.infiax.dev to .env (edit it if your server has another address).'
}
if ($envText -notmatch '(?m)^PUSH_TOKEN=.+') {
  # A random shared secret: the same value must be set as PUSH_TOKEN on the server.
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  Add-Content $envFile "PUSH_TOKEN=$token"
  Set-Clipboard $token
  Write-Host 'Created PUSH_TOKEN in .env and copied it to your clipboard.'
  Write-Host 'Paste it into Coolify as PUSH_TOKEN (Environment Variables), then redeploy the server.'
}

$node = (Get-Command node -ErrorAction Stop).Source
# conhost --headless runs node with no console window.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" --env-file=.env push-agent.mjs" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "Installed and started '$name'. It starts automatically when you log in. Logs: $dir\push-agent.log"
