@echo off
title Artur Salvado
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║           ARTUR SALVADO              ║
echo  ║      Gestão de Reuniões e Tarefas    ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [INFO] Iniciando Artur Salvado...
echo [INFO] O browser abrirá automaticamente...
echo.

start /B npm start

echo [OK] Artur Salvado iniciado!
echo [INFO] URL: http://localhost:3000
echo [INFO] O browser abrirá automaticamente em alguns segundos...

timeout /t 5 /nobreak >nul
start http://localhost:3000

echo [INFO] Para parar: Feche esta janela
echo.

:wait
timeout /t 30 /nobreak >nul
goto wait
