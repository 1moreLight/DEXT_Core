$ErrorActionPreference='Stop'
$scriptPath=Join-Path $PSScriptRoot '../../scripts/start.ps1'
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$parseErrors)
if($parseErrors){throw $parseErrors[0]}
$function=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Test-ConfiguratorLaunch'},$true)
if(!$function){throw 'Missing configurator launch gate'}
Invoke-Expression $function.Extent.Text
$normalizer=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-NormalizedPath'},$true)
Invoke-Expression $normalizer.Extent.Text
$script:processes=@()
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) $script:processes}
function Check($value,$name){if(!$value){throw $name};Write-Output "PASS $name"}
$target='C:/Dext Test/dext-configurator.exe'
Check (Test-ConfiguratorLaunch $target) 'empty process set may launch'
$script:processes=@([pscustomobject]@{ProcessId=10;ExecutablePath=$target})
Check (!(Test-ConfiguratorLaunch $target)) 'same product is reused'
Check (!(Test-ConfiguratorLaunch 'c:/dext test/DEXT-CONFIGURATOR.EXE')) 'Windows case variant is reused'
$script:processes=@([pscustomobject]@{ProcessId=11;ExecutablePath='C:/old/dext-configurator.exe'})
Check (!(Test-ConfiguratorLaunch $target)) 'other product is preserved without starting another'
$script:processes=@([pscustomobject]@{ProcessId=12;ExecutablePath=$null})
Check (!(Test-ConfiguratorLaunch $target)) 'unknown executable path does not cause another window'
$parameter=$ast.ParamBlock.Parameters|Where-Object {$_.Name.VariablePath.UserPath -eq 'CoreOnly'}
Check ($null -ne $parameter) 'explicit CoreOnly switch exists'
