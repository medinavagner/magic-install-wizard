@echo off
REM Remove o agente Deploy Console e o protocolo lvinstall://
REM Execute como Administrador.
reg delete "HKCR\lvinstall" /f >nul 2>&1
rmdir /S /Q "%ProgramData%\DeployConsoleAgent" 2>nul
echo Agente removido.
pause
