# Fix: instalação silenciosa de .msi não executa

## Causa raiz

Na função `buildPs1` (arquivo `supabase/functions/download-agent/index.ts`), a chamada do `msiexec` usa `\"` para escapar aspas. PowerShell **não interpreta `\` como escape** — usa backtick `` ` ``. Com isso, o `msiexec` recebe uma linha de comando malformada (`/i \"C:\...\arquivo.msi\" ...`) e encerra imediatamente sem instalar. Por isso o `.msi` "baixa e nada acontece", enquanto `.exe` (que não usa quoting) funciona.

## Mudanças

Arquivo único: `supabase/functions/download-agent/index.ts`, dentro do template `buildPs1`.

### 1. Trocar escape de `\"` por backtick no PowerShell

Linha atual (msiexec):
```
Run-Hidden 'msiexec.exe' "/i \"$tmp\" $silentArgs /L*v \"$LogDir\msi-$safeName.log\""
```

Passa a ser (no template literal JS, com `` \` `` para preservar o backtick):
```js
Run-Hidden 'msiexec.exe' "/i \`"$tmp\`" $silentArgs /L*v \`"$LogDir\\msi-$safeName.log\`""
```

Que produz no PS1 final:
```
Run-Hidden 'msiexec.exe' "/i `"$tmp`" $silentArgs /L*v `"$LogDir\msi-$safeName.log`""
```

### 2. Reforço defensivo em `Run-Hidden`

Logar `ExitCode` formatado e capturar stdout/stderr para o log, ajuda diagnóstico futuro:
- `$psi.RedirectStandardError = $true` (com `UseShellExecute=$false`)
- Após `WaitForExit`, anexar `StandardError.ReadToEnd()` ao log quando ExitCode ≠ 0.

### 3. (Opcional, sem risco) Normalizar args MSI

Se `silent_install_args` para MSI estiver com `/S` (legado de EXE), forçar `/qn /norestart` em runtime, evitando erro 1639 do msiexec. Comparar `installer_type` == "msi" e `silentArgs -match '^/S\b'` → substituir por `/qn /norestart`.

## Validação

1. Redeploy automático da edge function (Lovable Cloud).
2. Baixar o ZIP novamente pelo botão "Baixar DeployConsole" na home.
3. Executar `DeployConsole.bat` (como admin), marcar um `.msi` e clicar Instalar.
4. Conferir `%ProgramData%\DeployConsole\install.log` — deve mostrar `EXIT: 0` (ou 3010 para reboot pendente) e o log detalhado do MSI em `%ProgramData%\DeployConsole\msi-<nome>.log`.

## Fora do escopo

Não altera schema, RLS, frontend, nem o fluxo de upload de instaladores.
