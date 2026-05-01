# =====================================================================
#  Deploy Console Agent — instalação silenciosa de softwares no Windows
#  Compatível: Windows 7 SP1 ou superior (PowerShell 2.0+)
#  Invocação: registrado como handler do protocolo lvinstall://
#
#  URIs suportadas:
#    lvinstall://install/<id>?url=<urlInstalador>&type=exe|msi&args=<switches>&name=<nome>
#    lvinstall://uninstall/<id>?type=exe|msi&args=<switches>&key=<chaveRegistro|GUID>&name=<nome>
# =====================================================================
param([Parameter(Mandatory=$true)][string]$Uri)

$ErrorActionPreference = 'Stop'
$LogDir  = Join-Path $env:ProgramData 'DeployConsoleAgent'
$LogFile = Join-Path $LogDir 'agent.log'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $LogFile -Value $line
}

function Decode-QueryString([string]$qs) {
    $result = @{}
    if ([string]::IsNullOrWhiteSpace($qs)) { return $result }
    foreach ($pair in $qs.Split('&')) {
        $kv = $pair.Split('=', 2)
        if ($kv.Length -eq 2) {
            $key = [System.Uri]::UnescapeDataString($kv[0])
            $val = [System.Uri]::UnescapeDataString($kv[1].Replace('+', ' '))
            $result[$key] = $val
        }
    }
    return $result
}

function Parse-LvUri([string]$raw) {
    # Esperado: lvinstall://<action>/<id>?<query>
    $stripped = $raw -replace '^lvinstall://', ''
    $stripped = $stripped.TrimEnd('/')
    $qIndex = $stripped.IndexOf('?')
    if ($qIndex -ge 0) {
        $path = $stripped.Substring(0, $qIndex)
        $query = $stripped.Substring($qIndex + 1)
    } else {
        $path = $stripped; $query = ''
    }
    $parts = $path.Split('/')
    return @{
        Action = $parts[0]
        Id     = if ($parts.Length -gt 1) { $parts[1] } else { '' }
        Params = Decode-QueryString $query
    }
}

function Find-UninstallString([string]$key) {
    if ([string]::IsNullOrWhiteSpace($key)) { return $null }
    $roots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
            $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($null -eq $props) { return }
            $name = $_.PSChildName
            $display = "$($props.DisplayName)"
            if ($name -ieq $key -or $display -ieq $key -or $display -like "*$key*") {
                return @{
                    SubKey            = $name
                    DisplayName       = $display
                    UninstallString   = $props.UninstallString
                    QuietUninstall    = $props.QuietUninstallString
                    IsMsi             = ($name -match '^\{[0-9A-Fa-f\-]+\}$')
                }
            }
        }
    }
    return $null
}

function Run-Hidden([string]$file, [string]$arguments) {
    Write-Log "EXEC: `"$file`" $arguments"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $file
    $psi.Arguments = $arguments
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = 'Hidden'
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.WaitForExit()
    Write-Log "EXIT CODE: $($p.ExitCode)"
    return $p.ExitCode
}

try {
    Write-Log "=== Invocado com URI: $Uri ==="
    $req = Parse-LvUri $Uri
    $action = $req.Action.ToLower()
    $params = $req.Params
    $name   = $params['name']

    if ($action -eq 'install') {
        $url  = $params['url']
        $type = ($params['type']).ToLower()
        $args = $params['args']
        if (-not $url) { throw "URL do instalador ausente" }

        $ext = if ($type) { ".$type" } else { [System.IO.Path]::GetExtension($url) }
        if (-not $ext) { $ext = '.exe' }
        $tmp = Join-Path $env:TEMP ("dc-" + [Guid]::NewGuid().ToString('N') + $ext)

        Write-Log "Baixando '$name' de $url -> $tmp"
        # Compatível com Windows 7: WebClient (não exige TLS recente em alguns casos)
        try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
        (New-Object System.Net.WebClient).DownloadFile($url, $tmp)

        if ($ext -ieq '.msi') {
            $msiArgs = "/i `"$tmp`" $args"
            $code = Run-Hidden 'msiexec.exe' $msiArgs
        } else {
            $code = Run-Hidden $tmp $args
        }

        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        Write-Log "Instalação de '$name' finalizada com código $code"
        exit $code
    }
    elseif ($action -eq 'uninstall') {
        $args = $params['args']
        $key  = $params['key']
        $type = ($params['type']).ToLower()

        if ($type -eq 'msi' -and $key -and $key -match '^\{[0-9A-Fa-f\-]+\}$') {
            $code = Run-Hidden 'msiexec.exe' "/x $key /qn /norestart"
            Write-Log "Desinstalação MSI '$name' código $code"
            exit $code
        }

        $info = Find-UninstallString $key
        if ($null -eq $info) { throw "Não foi possível localizar a entrada de desinstalação para '$key'" }

        if ($info.IsMsi) {
            $code = Run-Hidden 'msiexec.exe' "/x $($info.SubKey) /qn /norestart"
        }
        elseif ($info.QuietUninstall) {
            # QuietUninstallString geralmente já contém os switches silenciosos
            $code = Run-Hidden 'cmd.exe' "/c $($info.QuietUninstall)"
        }
        else {
            $cmd = $info.UninstallString
            if ($args) { $cmd = "$cmd $args" }
            $code = Run-Hidden 'cmd.exe' "/c $cmd"
        }
        Write-Log "Desinstalação '$name' código $code"
        exit $code
    }
    else {
        throw "Ação desconhecida: $action"
    }
}
catch {
    Write-Log "ERRO: $($_.Exception.Message)"
    exit 1
}
