#requires -Version 7.0
# OpenAI: offline syntax/compile gate only; does not read credentials or start agents.
$ErrorActionPreference='Stop'
foreach($name in @('headless-host.ps1','install-headless-tasks.ps1','test-headless.ps1')){
    $tokens=$null;$parseErrors=$null
    $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name),[ref]$tokens,[ref]$parseErrors)
    if($parseErrors.Count){throw "PowerShell parse failed: $name"}
}
Add-Type -Path (Join-Path $PSScriptRoot 'HeadlessNative.cs')
$cfg=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'headless-host.example.json') -Raw | ConvertFrom-Json
if($cfg.owner -notin $cfg.allowedAuthors){throw 'Example omitted owner'}
if($cfg.PSObject.Properties.Name -match '(?i)password|private.key|secret'){throw 'Example must not contain secret fields'}
$installer=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'install-headless-tasks.ps1') -Raw
if($installer -notmatch '-LogonType Interactive -RunLevel Limited' -or $installer -notmatch '-AtLogOn'){
    throw 'Re-review logon/sandbox boundary before changing task principal'
}
if($installer -match '-AtStartup|-LogonType S4U|-RunLevel Highest|-Password'){
    throw 'Do not silently migrate to a privileged/non-interactive service'
}
Write-Output 'PASS: PowerShell syntax, C# compilation, example shape and logon-task contract. No production state touched.'
