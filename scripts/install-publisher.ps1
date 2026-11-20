# Schedules the static publisher on this PC: at logon and then every 3 hours, no window. Each run fetches the
# banks, writes the rate files and uploads the site to Cloudflare Pages, then exits (nothing stays running).
#   powershell -ExecutionPolicy Bypass -File scripts\install-publisher.ps1            install (or update) and run once now
#   powershell -ExecutionPolicy Bypass -File scripts\install-publisher.ps1 -Uninstall remove the task
# Logs: publish.log in the project folder. Needs OPENROUTER_API_KEY in .env and `npx wrangler login` done once.
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$name = 'LKR Rates publisher'
$dir = Split-Path -Parent $PSScriptRoot

if ($Uninstall) {
  Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Host "Removed '$name'."
  return
}

$envFile = Join-Path $dir '.env'
if (-not (Test-Path $envFile)) { throw "No .env in $dir. Copy .env.example to .env first." }
if ((Get-Content $envFile -Raw) -notmatch '(?m)^OPENROUTER_API_KEY=.+') { throw 'Add OPENROUTER_API_KEY to .env first.' }

$node = (Get-Command node -ErrorAction Stop).Source
# conhost --headless runs node with no console window.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" --env-file=.env publish.mjs" -WorkingDirectory $dir
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$every3h = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 3)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger @($logon, $every3h) -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "Installed '$name' and started the first run. It runs at logon and every 3 hours. Logs: $dir\publish.log"
