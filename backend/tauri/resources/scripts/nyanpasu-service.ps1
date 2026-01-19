[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Action,

  [Parameter(Mandatory = $true, Position = 1)]
  [string]$ServiceExe,

  [Parameter(Mandatory = $false)]
  [string]$LogPath,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ServiceArgs
)

function Test-IsAdmin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if ([string]::IsNullOrWhiteSpace($LogPath)) {
  $LogPath = Join-Path $env:TEMP ("nyanpasu-service-{0}-{1}.log" -f $PID, (Get-Random))
}

if (-not (Test-IsAdmin)) {
  try {
    $psArgs = @(
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', $PSCommandPath,
      $Action,
      $ServiceExe,
      '-LogPath', $LogPath
    ) + $ServiceArgs

    $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -Verb RunAs -Wait -PassThru

    if (Test-Path -LiteralPath $LogPath) {
      Get-Content -LiteralPath $LogPath -Raw
    }

    exit $p.ExitCode
  } catch {
    $msg = $_.Exception.Message

    $log = @(
      ('[{0}] action={1} (elevate failed)' -f (Get-Date -Format o), $Action),
      $msg
    ) -join "`r`n"

    try {
      $log | Set-Content -LiteralPath $LogPath -Encoding UTF8
      Get-Content -LiteralPath $LogPath -Raw
    } catch {
      Write-Output $log
    }

    if ($msg -match 'canceled by the user' -or $msg -match 'cancelled by the user') {
      exit 1223
    }
    exit 1
  }
}

$header = @(
  ('[{0}] action={1}' -f (Get-Date -Format o), $Action),
  ('service_exe={0}' -f $ServiceExe),
  ('service_args={0}' -f ($ServiceArgs -join ' ')),
  ('log_path={0}' -f $LogPath)
) -join "`r`n"

try {
  if (-not (Test-Path -LiteralPath $ServiceExe)) {
    $out = $header + "`r`n" + "ERROR: service exe not found"
    $out | Set-Content -LiteralPath $LogPath -Encoding UTF8
    Write-Output $out
    exit 2
  }

  $lines = @()
  $lines += $header
  $lines += "---- begin output ----"

  $cmdOutput = & $ServiceExe @ServiceArgs 2>&1 | ForEach-Object { $_.ToString() }
  if ($null -ne $cmdOutput) {
    $lines += $cmdOutput
  }

  $lines += "---- end output ----"
  $exitCode = $LASTEXITCODE
  $lines += ('exit_code={0}' -f $exitCode)

  ($lines -join "`r`n") | Set-Content -LiteralPath $LogPath -Encoding UTF8
  Get-Content -LiteralPath $LogPath -Raw

  exit $exitCode
} catch {
  $msg = $_.Exception.Message
  $out = $header + "`r`n" + "ERROR: " + $msg
  $out | Set-Content -LiteralPath $LogPath -Encoding UTF8
  Write-Output $out
  exit 1
}
