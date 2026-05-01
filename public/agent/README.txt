# Deploy Console Agent

Pequeno agente para Windows 7 SP1 ou superior que instala softwares
em segundo plano através do protocolo `lvinstall://`.

## Conteúdo do pacote
- `install-agent.bat`  → registra o protocolo (executar como admin, uma vez)
- `deploy-agent.ps1`   → executor que baixa e instala silenciosamente
- `uninstall-agent.bat`→ remove tudo

## Como usar
1. Botão direito em **install-agent.bat** → **Executar como administrador**.
2. Volte ao painel web e clique em **Instalar** em qualquer programa.
3. O navegador abrirá o handler `lvinstall://` que invoca o agente.
4. O agente baixa o instalador para `%TEMP%`, executa com os switches
   silenciosos cadastrados e remove o arquivo no fim.

## Logs
`%ProgramData%\DeployConsoleAgent\agent.log`

## Switches silenciosos comuns
- MSI: `/qn /norestart`
- Inno Setup: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
- NSIS: `/S`
- InstallShield: `/s /v"/qn"`
- WiX bundles: `/quiet /norestart`
