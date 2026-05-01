@echo off
REM =====================================================================
REM  Deploy Console Agent - Instalador / Registrador do protocolo
REM  Execute como Administrador (botao direito -> Executar como admin)
REM =====================================================================
setlocal

set "INSTALL_DIR=%ProgramData%\DeployConsoleAgent"
set "AGENT_PS1=%INSTALL_DIR%\deploy-agent.ps1"

echo.
echo === Deploy Console Agent ===
echo Instalando em: %INSTALL_DIR%
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copia o script PS1 que esta junto deste .bat
copy /Y "%~dp0deploy-agent.ps1" "%AGENT_PS1%" >nul
if errorlevel 1 (
    echo ERRO: nao consegui copiar deploy-agent.ps1
    pause
    exit /b 1
)

REM Permite execucao do script (LocalMachine, RemoteSigned)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Try { Set-ExecutionPolicy -Scope LocalMachine -ExecutionPolicy RemoteSigned -Force } Catch {}"

REM Registra o protocolo lvinstall:// no HKEY_CLASSES_ROOT
echo Registrando protocolo lvinstall:// ...

reg add "HKCR\lvinstall" /ve /t REG_SZ /d "URL:Deploy Console Install Protocol" /f >nul
reg add "HKCR\lvinstall" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCR\lvinstall\DefaultIcon" /ve /t REG_SZ /d "%SystemRoot%\System32\shell32.dll,12" /f >nul
reg add "HKCR\lvinstall\shell" /f >nul
reg add "HKCR\lvinstall\shell\open" /f >nul
reg add "HKCR\lvinstall\shell\open\command" /ve /t REG_SZ /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%AGENT_PS1%\" -Uri \"%%1\"" /f >nul

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
