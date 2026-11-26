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

echo.
echo  Iniciando o servidor do Laboratorio...
echo  Para encerrar, feche esta janela ou pressione Ctrl+C.

rem O servidor escolhe uma porta livre (3000 ou a proxima) e abre o navegador nela.
set ABRIR_NAVEGADOR=1
node servidor\server.js

echo.
echo  O servidor foi encerrado.
pause
