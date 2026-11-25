@echo off
chcp 65001 >nul
title Ameaça Biológica - Servidor
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao foi encontrado neste computador.
  echo  Instale a versao LTS em https://nodejs.org e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if "%PORTA%"=="" set PORTA=3000

echo.
echo  Iniciando o servidor do Laboratorio...
echo  Para encerrar, feche esta janela ou pressione Ctrl+C.
echo.

rem Abre o Laboratorio no navegador do Mestre depois de 2 segundos
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORTA%"

node servidor\server.js

echo.
echo  O servidor foi encerrado.
pause
