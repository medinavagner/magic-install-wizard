// Serve os arquivos do Deploy Console Agent contornando o proxy do preview do Lovable.
// GET /functions/v1/download-agent?file=zip|ps1|bat|uninstall|readme

import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PS1 = String.raw`# =====================================================================
#  Deploy Console Agent v2 - instalacao silenciosa de softwares no Windows
#  Compativel: Windows 7 SP1 ou superior (PowerShell 2.0+)
#  Invocacao: registrado como handler do protocolo lvinstall://
# =====================================================================
param([Parameter(Mandatory=$true)][string]$Uri)
$AgentVersion = '2.0.0'

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
    Write-Log "EXEC: ""$file"" $arguments"
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

function Download-File([string]$url, [string]$dest) {
    Write-Log "DOWNLOAD: $url -> $dest"
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
    try {
        (New-Object System.Net.WebClient).DownloadFile($url, $dest)
    } catch {
        Write-Log "WebClient falhou ($($_.Exception.Message)), tentando BITS..."
        try { Start-BitsTransfer -Source $url -Destination $dest -ErrorAction Stop }
        catch { throw "Falha ao baixar instalador: $($_.Exception.Message)" }
    }
    if (-not (Test-Path $dest)) { throw "Arquivo baixado nao foi encontrado: $dest" }
    $sz = (Get-Item $dest).Length
    Write-Log "DOWNLOAD OK: $sz bytes"
    if ($sz -lt 1024) { throw "Arquivo baixado parece invalido ($sz bytes)" }
}

try {
    Write-Log "================================================="
    Write-Log "Deploy Console Agent v$AgentVersion"
    Write-Log "URI recebida: $Uri"
    $req = Parse-LvUri $Uri
    $action = $req.Action.ToLower()
    $params = $req.Params
    $name   = $params['name']
    Write-Log "ACAO: $action  PROGRAMA: $name"

    if ($action -eq 'install') {
        $url  = $params['url']
        $type = ($params['type']).ToLower()
        $args = $params['args']
        if (-not $url) { throw "URL do instalador ausente" }

        $ext = if ($type) { ".$type" } else { [System.IO.Path]::GetExtension($url) }
        if (-not $ext) { $ext = '.exe' }
        $tmp = Join-Path $env:TEMP ("dc-" + [Guid]::NewGuid().ToString('N') + $ext)

        Download-File $url $tmp

        if ($ext -ieq '.msi') {
            $msiArgs = "/i `"$tmp`" $args /L*v `"$LogDir\msi-last.log`""
            $code = Run-Hidden 'msiexec.exe' $msiArgs
        } else {
            $code = Run-Hidden $tmp $args
        }

        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        Write-Log "RESULTADO INSTALL '$name' -> codigo $code"
        if ($code -eq 0) { Write-Log "SUCESSO" }
        elseif ($code -eq 3010) { Write-Log "SUCESSO (reinicializacao necessaria)" }
        elseif ($code -eq 1603) { Write-Log "ERRO MSI 1603 - falha generica. Verifique privilegios e logs." }
        else { Write-Log "Codigo de saida nao zero" }
        exit $code
    }
    elseif ($action -eq 'uninstall') {
        $args = $params['args']
        $key  = $params['key']
        $type = ($params['type']).ToLower()

        if ($type -eq 'msi' -and $key -and $key -match '^\{[0-9A-Fa-f\-]+\}$') {
            $code = Run-Hidden 'msiexec.exe' "/x $key /qn /norestart"
            Write-Log "Desinstalacao MSI '$name' codigo $code"
            exit $code
        }

        $info = Find-UninstallString $key
        if ($null -eq $info) { throw "Nao foi possivel localizar a entrada de desinstalacao para '$key'" }

        if ($info.IsMsi) {
            $code = Run-Hidden 'msiexec.exe' "/x $($info.SubKey) /qn /norestart"
        }
        elseif ($info.QuietUninstall) {
            $code = Run-Hidden 'cmd.exe' "/c $($info.QuietUninstall)"
        }
        else {
            $cmd = $info.UninstallString
            if ($args) { $cmd = "$cmd $args" }
            $code = Run-Hidden 'cmd.exe' "/c $cmd"
        }
        Write-Log "Desinstalacao '$name' codigo $code"
        exit $code
    }
    else {
        throw "Acao desconhecida: $action"
    }
}
catch {
    Write-Log "ERRO: $($_.Exception.Message)"
    exit 1
}
`;

const INSTALL_BAT = `@echo off
REM =====================================================================
REM  Deploy Console Agent - Instalador / Registrador do protocolo
REM  Execute como Administrador (botao direito -> Executar como admin)
REM =====================================================================
setlocal

set "INSTALL_DIR=%ProgramData%\\DeployConsoleAgent"
set "AGENT_PS1=%INSTALL_DIR%\\deploy-agent.ps1"

echo.
echo === Deploy Console Agent ===
echo Instalando em: %INSTALL_DIR%
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

copy /Y "%~dp0deploy-agent.ps1" "%AGENT_PS1%" >nul
if errorlevel 1 (
    echo ERRO: nao consegui copiar deploy-agent.ps1
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Try { Set-ExecutionPolicy -Scope LocalMachine -ExecutionPolicy RemoteSigned -Force } Catch {}"

echo Registrando protocolo lvinstall:// ...

reg add "HKCR\\lvinstall" /ve /t REG_SZ /d "URL:Deploy Console Install Protocol" /f >nul
reg add "HKCR\\lvinstall" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCR\\lvinstall\\DefaultIcon" /ve /t REG_SZ /d "%SystemRoot%\\System32\\shell32.dll,12" /f >nul
reg add "HKCR\\lvinstall\\shell" /f >nul
reg add "HKCR\\lvinstall\\shell\\open" /f >nul
reg add "HKCR\\lvinstall\\shell\\open\\command" /ve /t REG_SZ /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"%AGENT_PS1%\\" -Uri \\"%%1\\"" /f >nul

if errorlevel 1 (
    echo ERRO: registro do protocolo falhou. Execute como Administrador.
    pause
    exit /b 1
)

echo.
echo OK! Agente instalado e protocolo lvinstall:// registrado.
echo Volte ao painel web e clique em "Instalar" em qualquer programa.
echo.
pause
endlocal
`;

const UNINSTALL_BAT = `@echo off
REM Remove o agente Deploy Console e o protocolo lvinstall://
REM Execute como Administrador.
reg delete "HKCR\\lvinstall" /f >nul 2>&1
rmdir /S /Q "%ProgramData%\\DeployConsoleAgent" 2>nul
echo Agente removido.
pause
`;

const README = `# Deploy Console Agent

Pequeno agente para Windows 7 SP1 ou superior que instala softwares
em segundo plano atraves do protocolo lvinstall://.

## Conteudo do pacote
- install-agent.bat    -> registra o protocolo (executar como admin, uma vez)
- deploy-agent.ps1     -> executor que baixa e instala silenciosamente
- uninstall-agent.bat  -> remove tudo

## Como usar
1. Botao direito em install-agent.bat -> Executar como administrador.
2. Volte ao painel web e clique em Instalar em qualquer programa.
3. O navegador abrira o handler lvinstall:// que invoca o agente.
4. O agente baixa o instalador para %TEMP%, executa silenciosamente e remove.

## Logs
%ProgramData%\\DeployConsoleAgent\\agent.log

## Switches silenciosos comuns
- MSI:           /qn /norestart
- Inno Setup:    /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
- NSIS:          /S
- InstallShield: /s /v"/qn"
- WiX bundles:   /quiet /norestart
`;

function textResponse(body: string, filename: string, contentType: string) {
  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const file = (url.searchParams.get("file") ?? "zip").toLowerCase();

  try {
    switch (file) {
      case "ps1":
        return textResponse(PS1, "deploy-agent.ps1", "text/plain; charset=utf-8");
      case "bat":
      case "install":
        return textResponse(INSTALL_BAT, "install-agent.bat", "text/plain; charset=utf-8");
      case "uninstall":
        return textResponse(UNINSTALL_BAT, "uninstall-agent.bat", "text/plain; charset=utf-8");
      case "readme":
        return textResponse(README, "README.txt", "text/plain; charset=utf-8");
      case "zip":
      default: {
        const zip = new JSZip();
        zip.file("install-agent.bat", INSTALL_BAT);
        zip.file("deploy-agent.ps1", PS1);
        zip.file("uninstall-agent.bat", UNINSTALL_BAT);
        zip.file("README.txt", README);
        const buf = await zip.generateAsync({ type: "uint8array" });
        return new Response(buf, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="deploy-console-agent.zip"',
            "Cache-Control": "no-store",
          },
        });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
