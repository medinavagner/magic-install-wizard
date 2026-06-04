// Gera o instalador Deploy Console (Windows): um app PowerShell com GUI
// que lista os programas do catalogo e instala em silencio os selecionados.
// GET /functions/v1/download-agent           -> ZIP (recomendado)
// GET /functions/v1/download-agent?file=bat  -> apenas DeployConsole.bat
// GET /functions/v1/download-agent?file=ps1  -> apenas DeployConsole.ps1

import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function buildPs1(supabaseUrl: string, anonKey: string) {
  return `# =====================================================================
#  Deploy Console - Instalador de softwares (Windows 7 SP1 ou superior)
#  Lista o catalogo do servidor e instala silenciosamente os selecionados.
# =====================================================================
$ErrorActionPreference = 'Stop'
$SupabaseUrl = '${supabaseUrl}'
$AnonKey     = '${anonKey}'

$LogDir  = Join-Path $env:ProgramData 'DeployConsole'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile = Join-Path $LogDir 'install.log'
function Write-Log([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
    Add-Content -Path $LogFile -Value $line
}

try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function Fetch-Programs() {
    $url = "$SupabaseUrl/rest/v1/programs?select=*&order=name.asc"
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = 'GET'
    $req.Headers.Add('apikey', $AnonKey)
    $req.Headers.Add('Authorization', "Bearer $AnonKey")
    $req.Accept = 'application/json'
    $resp = $req.GetResponse()
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $json = $sr.ReadToEnd()
    $sr.Close(); $resp.Close()
    # PowerShell 2.0 nao tem ConvertFrom-Json: usar serializador .NET
    Add-Type -AssemblyName System.Web.Extensions
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = 67108864
    return $ser.DeserializeObject($json)
}

function Public-Url([string]$path) {
    return "$SupabaseUrl/storage/v1/object/public/installers/$path"
}

function Download-File([string]$url, [string]$dest) {
    Write-Log "DOWNLOAD: $url"
    (New-Object System.Net.WebClient).DownloadFile($url, $dest)
    if (-not (Test-Path $dest)) { throw "Falha ao baixar $url" }
}

function Run-Hidden([string]$file, [string]$arguments) {
    Write-Log "EXEC: [$file] $arguments"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $file
    $psi.Arguments = $arguments
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = 'Hidden'
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardOutput = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    Write-Log "EXIT: $($p.ExitCode)"
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
        if ($stdout) { Write-Log "STDOUT: $stdout" }
        if ($stderr) { Write-Log "STDERR: $stderr" }
    }
    return $p.ExitCode
}

function Install-Program($p) {
    $name = [string]$p['name']
    $type = ([string]$p['installer_type']).ToLower()
    $silentArgs = [string]$p['silent_install_args']
    $url  = Public-Url ([string]$p['installer_path'])
    $ext  = if ($type) { ".$type" } else { '.exe' }
    $tmp  = Join-Path $env:TEMP ("dc-" + [Guid]::NewGuid().ToString('N') + $ext)
    Write-Log "==> Instalando $name (args: $silentArgs)"
    Download-File $url $tmp
    $safeName = ($name -replace '[^a-zA-Z0-9_\-]', '_')
    $code = if ($ext -ieq '.msi') {
        # Normaliza args legados de EXE (/S) para o padrao MSI
        if ($silentArgs -match '^\\s*/S\\s*$') { $silentArgs = '/qn /norestart' }
        $msiLog = Join-Path $LogDir ("msi-" + $safeName + ".log")
        $msiArgs = "/i \`"$tmp\`" $silentArgs /L*v \`"$msiLog\`""
        Run-Hidden 'msiexec.exe' $msiArgs
    } else {
        Run-Hidden $tmp $silentArgs
    }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $code
}

function Find-UninstallEntry([string]$displayName, [string]$regKeyHint) {
    $roots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall'
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if (-not $props) { return }
                $keyLeaf = Split-Path $_.PSPath -Leaf
                $match = $false
                if ($regKeyHint) {
                    if ($keyLeaf -ieq $regKeyHint) { $match = $true }
                    elseif ($props.DisplayName -and $props.DisplayName -ieq $regKeyHint) { $match = $true }
                }
                if (-not $match -and $displayName -and $props.DisplayName) {
                    if ($props.DisplayName -ieq $displayName -or $props.DisplayName -like "*$displayName*") { $match = $true }
                }
                if ($match) {
                    return [PSCustomObject]@{
                        KeyLeaf = $keyLeaf
                        DisplayName = $props.DisplayName
                        UninstallString = $props.UninstallString
                        QuietUninstallString = $props.QuietUninstallString
                    } | Tee-Object -Variable found
                }
            } catch {}
        }
    }
    return $null
}

function Uninstall-Program($p) {
    $name = [string]$p['name']
    $type = ([string]$p['installer_type']).ToLower()
    $uArgs = [string]$p['silent_uninstall_args']
    $regHint = [string]$p['uninstall_registry_key']
    Write-Log "==> Desinstalando $name (hint: $regHint, args: $uArgs)"

    # 1) Caminho rapido: GUID MSI explicito na chave de registro
    if ($regHint -match '^\{[0-9A-Fa-f\-]+\}$') {
        if ($uArgs -match '^\s*/S\s*$' -or -not $uArgs) { $uArgs = '/qn /norestart' }
        $msiLog = Join-Path $LogDir ("uninst-" + ($name -replace '[^a-zA-Z0-9_\-]', '_') + ".log")
        $args = "/x $regHint $uArgs /L*v \`"$msiLog\`""
        return Run-Hidden 'msiexec.exe' $args
    }

    # 2) Busca no registro Uninstall
    $entries = @()
    $hits = Find-UninstallEntry $name $regHint
    if ($hits) { $entries = @($hits) | Where-Object { $_ -ne $null } }
    if ($entries.Count -eq 0) {
        Write-Log "Nenhuma entrada de desinstalacao encontrada para $name"
        return 1605
    }
    $entry = $entries[0]
    Write-Log ("Match: {0} ({1})" -f $entry.DisplayName, $entry.KeyLeaf)

    # MSI registrado -> usa /x {GUID}
    if ($entry.KeyLeaf -match '^\{[0-9A-Fa-f\-]+\}$') {
        if ($uArgs -match '^\s*/S\s*$' -or -not $uArgs) { $uArgs = '/qn /norestart' }
        $msiLog = Join-Path $LogDir ("uninst-" + ($name -replace '[^a-zA-Z0-9_\-]', '_') + ".log")
        $args = "/x $($entry.KeyLeaf) $uArgs /L*v \`"$msiLog\`""
        return Run-Hidden 'msiexec.exe' $args
    }

    # EXE: prefere QuietUninstallString, senao UninstallString + args silenciosos cadastrados
    $cmd = if ($entry.QuietUninstallString) { $entry.QuietUninstallString } else { $entry.UninstallString }
    if (-not $cmd) { Write-Log "Sem UninstallString para $name"; return 1605 }

    # Parse: pode vir "\"C:\path\unins.exe\" /flags" ou C:\path\unins.exe /flags
    $exe = $null; $existingArgs = ''
    if ($cmd.StartsWith('"')) {
        $end = $cmd.IndexOf('"', 1)
        if ($end -gt 0) {
            $exe = $cmd.Substring(1, $end - 1)
            $existingArgs = $cmd.Substring($end + 1).Trim()
        }
    } else {
        $sp = $cmd.IndexOf(' ')
        if ($sp -gt 0) {
            $exe = $cmd.Substring(0, $sp)
            $existingArgs = $cmd.Substring($sp + 1).Trim()
        } else {
            $exe = $cmd
        }
    }
    $finalArgs = ($existingArgs + ' ' + $uArgs).Trim()
    return Run-Hidden $exe $finalArgs
}


# ---------- GUI ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Deploy Console - Instalador'
$form.Size = New-Object System.Drawing.Size(720, 540)
$form.StartPosition = 'CenterScreen'
$form.MinimumSize = New-Object System.Drawing.Size(560, 420)

$header = New-Object System.Windows.Forms.Label
$header.Text = 'Selecione os programas que deseja instalar'
$header.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$header.Location = New-Object System.Drawing.Point(16, 12)
$header.Size = New-Object System.Drawing.Size(680, 24)
$header.Anchor = 'Top,Left,Right'
$form.Controls.Add($header)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = 'Marque os programas e use Instalar ou Desinstalar selecionados.'
$sub.Location = New-Object System.Drawing.Point(16, 38)
$sub.Size = New-Object System.Drawing.Size(680, 20)
$sub.ForeColor = [System.Drawing.Color]::DimGray
$sub.Anchor = 'Top,Left,Right'
$form.Controls.Add($sub)

$list = New-Object System.Windows.Forms.CheckedListBox
$list.Location = New-Object System.Drawing.Point(16, 64)
$list.Size = New-Object System.Drawing.Size(680, 340)
$list.Anchor = 'Top,Bottom,Left,Right'
$list.CheckOnClick = $true
$list.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.Controls.Add($list)

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(16, 412)
$status.Size = New-Object System.Drawing.Size(450, 40)
$status.Anchor = 'Bottom,Left,Right'
$status.ForeColor = [System.Drawing.Color]::DimGray
$form.Controls.Add($status)

$btnAll = New-Object System.Windows.Forms.Button
$btnAll.Text = 'Marcar todos'
$btnAll.Location = New-Object System.Drawing.Point(16, 460)
$btnAll.Size = New-Object System.Drawing.Size(110, 32)
$btnAll.Anchor = 'Bottom,Left'
$form.Controls.Add($btnAll)

$btnNone = New-Object System.Windows.Forms.Button
$btnNone.Text = 'Limpar'
$btnNone.Location = New-Object System.Drawing.Point(132, 460)
$btnNone.Size = New-Object System.Drawing.Size(80, 32)
$btnNone.Anchor = 'Bottom,Left'
$form.Controls.Add($btnNone)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = 'Atualizar'
$btnRefresh.Location = New-Object System.Drawing.Point(218, 460)
$btnRefresh.Size = New-Object System.Drawing.Size(90, 32)
$btnRefresh.Anchor = 'Bottom,Left'
$form.Controls.Add($btnRefresh)

$btnUninstall = New-Object System.Windows.Forms.Button
$btnUninstall.Text = 'Desinstalar selecionados'
$btnUninstall.Size = New-Object System.Drawing.Size(180, 32)
$btnUninstall.Location = New-Object System.Drawing.Point(326, 460)
$btnUninstall.Anchor = 'Bottom,Right'
$btnUninstall.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
$btnUninstall.ForeColor = [System.Drawing.Color]::White
$btnUninstall.FlatStyle = 'Flat'
$form.Controls.Add($btnUninstall)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = 'Instalar selecionados'
$btnInstall.Size = New-Object System.Drawing.Size(180, 32)
$btnInstall.Location = New-Object System.Drawing.Point(516, 460)
$btnInstall.Anchor = 'Bottom,Right'
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235)
$btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = 'Flat'
$form.Controls.Add($btnInstall)

$script:Programs = @()

function Load-List() {
    $status.Text = 'Carregando catalogo...'
    $list.Items.Clear()
    try {
        $script:Programs = Fetch-Programs
        foreach ($p in $script:Programs) {
            $line = "{0}  -  {1}  [{2}]" -f $p['name'], ($p['publisher']), ([string]$p['installer_type']).ToUpper()
            [void]$list.Items.Add($line, $false)
        }
        $status.Text = ("{0} programa(s) disponivel(eis)." -f $script:Programs.Count)
    } catch {
        $status.Text = 'Falha ao carregar catalogo: ' + $_.Exception.Message
        Write-Log $status.Text
    }
}

$btnAll.Add_Click({ for ($i=0; $i -lt $list.Items.Count; $i++) { $list.SetItemChecked($i, $true) } })
$btnNone.Add_Click({ for ($i=0; $i -lt $list.Items.Count; $i++) { $list.SetItemChecked($i, $false) } })
$btnRefresh.Add_Click({ Load-List })

$btnInstall.Add_Click({
    $checked = @()
    for ($i=0; $i -lt $list.Items.Count; $i++) {
        if ($list.GetItemChecked($i)) { $checked += $script:Programs[$i] }
    }
    if ($checked.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show('Selecione ao menos um programa.', 'Deploy Console') | Out-Null
        return
    }
    $btnInstall.Enabled = $false; $btnAll.Enabled = $false; $btnNone.Enabled = $false; $btnRefresh.Enabled = $false
    $ok = 0; $fail = 0
    foreach ($p in $checked) {
        $status.Text = ("Instalando {0}..." -f $p['name'])
        $form.Refresh()
        try {
            $code = Install-Program $p
            if ($code -eq 0 -or $code -eq 3010) { $ok++ } else { $fail++ ; Write-Log "Codigo nao zero para $($p['name']): $code" }
        } catch {
            $fail++
            Write-Log ("ERRO instalando {0}: {1}" -f $p['name'], $_.Exception.Message)
        }
    }
    $status.Text = ("Concluido. Sucesso: {0}  Falhas: {1}" -f $ok, $fail)
    [System.Windows.Forms.MessageBox]::Show(("Instalacao concluida.\`nSucesso: {0}\`nFalhas: {1}\`n\`nLog: {2}" -f $ok, $fail, $LogFile), 'Deploy Console') | Out-Null
    $btnInstall.Enabled = $true; $btnAll.Enabled = $true; $btnNone.Enabled = $true; $btnRefresh.Enabled = $true
})

$form.Add_Shown({ Load-List })
[System.Windows.Forms.Application]::Run($form)
`;
}

const LAUNCHER_BAT = `@echo off
REM Bootstrap do Deploy Console - executa o instalador grafico em PowerShell.
REM Se nao estiver elevado, tenta elevar via UAC para permitir as instalacoes.
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%DeployConsole.ps1"

net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%PS1%' -Verb RunAs"
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
endlocal
`;

const README = `Deploy Console - Instalador para Windows
==========================================

Como usar:
1. Extraia o ZIP em qualquer pasta.
2. Clique duas vezes em DeployConsole.bat (ou bot. direito > Executar como administrador).
3. Marque os programas desejados e clique em "Instalar selecionados".

Requisitos:
- Windows 7 SP1 ou superior
- PowerShell 2.0+
- Conexao com a internet

Log:
%ProgramData%\\DeployConsole\\install.log
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const file = (url.searchParams.get("file") ?? "zip").toLowerCase();
  const PS1 = buildPs1(SUPABASE_URL, ANON_KEY);

  try {
    switch (file) {
      case "ps1":
        return textResponse(PS1, "DeployConsole.ps1", "text/plain; charset=utf-8");
      case "bat":
        return textResponse(LAUNCHER_BAT, "DeployConsole.bat", "text/plain; charset=utf-8");
      case "readme":
        return textResponse(README, "README.txt", "text/plain; charset=utf-8");
      case "zip":
      default: {
        const zip = new JSZip();
        zip.file("DeployConsole.bat", LAUNCHER_BAT);
        zip.file("DeployConsole.ps1", PS1);
        zip.file("README.txt", README);
        const buf = await zip.generateAsync({ type: "uint8array" });
        return new Response(buf, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="DeployConsole.zip"',
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
