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
    Write-Log "EXEC: \\"$file\\" $arguments"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $file
    $psi.Arguments = $arguments
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = 'Hidden'
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.WaitForExit()
    Write-Log "EXIT: $($p.ExitCode)"
    return $p.ExitCode
}

function Install-Program($p) {
    $name = $p['name']
    $type = ([string]$p['installer_type']).ToLower()
    $args = [string]$p['silent_install_args']
    $url  = Public-Url ([string]$p['installer_path'])
    $ext  = if ($type) { ".$type" } else { '.exe' }
    $tmp  = Join-Path $env:TEMP ("dc-" + [Guid]::NewGuid().ToString('N') + $ext)
    Write-Log "==> Instalando $name"
    Download-File $url $tmp
    $code = if ($ext -ieq '.msi') {
        Run-Hidden 'msiexec.exe' "/i \\"$tmp\\" $args /L*v \\"$LogDir\\msi-$name.log\\""
    } else {
        Run-Hidden $tmp $args
    }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $code
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
$sub.Text = 'Marque um ou mais e clique em Instalar selecionados.'
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
