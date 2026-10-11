#requires -Version 7.0
param([Parameter(Mandatory)][string]$Runtime,[Parameter(Mandatory)][string]$PowerShellExe,[string[]]$Agents)
$ErrorActionPreference='Stop'
$Runtime=(Resolve-Path -LiteralPath $Runtime).Path
if(-not(Test-Path -LiteralPath $PowerShellExe -PathType Leaf)){throw 'PowerShell 7 executable required'}
$cfg=Get-Content -LiteralPath (Join-Path $Runtime 'headless-host.json') -Raw|ConvertFrom-Json
if($env:COMPUTERNAME -ine $cfg.computerName){throw 'Wrong execution computer'}
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 2)
$configuredNames=@($cfg.agents.PSObject.Properties.Name)
$agentNames=if($Agents){@($Agents | Select-Object -Unique)}else{$configuredNames}
if($agentNames.Count -eq 0){throw 'No configured agents'}
foreach($agent in $agentNames){
    if($agent -notmatch '^[a-z][a-z0-9_-]{0,31}$'){throw 'Invalid agent id'}
    if($agent -notin $configuredNames){throw "Unconfigured agent: $agent"}
    if(Get-ScheduledTask -TaskName "LD Buzz Lanzhou Codex $agent" -ErrorAction SilentlyContinue){throw "Task already exists: $agent; inspect before replacement"}
}
foreach($agent in $agentNames){
    $name="LD Buzz Lanzhou Codex $agent"
    if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){throw "Task already exists: $name; inspect before replacement"}
    $action=New-ScheduledTaskAction -Execute $PowerShellExe -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$Runtime\headless-host.ps1`" -Agent $agent" -WorkingDirectory $Runtime
    # OpenAI: Codex's restricted-token shell fails in Session 0 on the tested baseline.
    # Use a hidden logged-on-user task, independent of the Buzz Desktop process.
    $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
    $trigger.Delay='PT15S'
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Native Buzz ACP on this execution host, independent of Buzz Desktop. Owner shutdown remains terminal until explicitly started.' | Select-Object TaskName,State
}
# OpenAI: start only after stopping old Desktop-owned instances; never duplicate an identity.
