@echo off
title Office Manager
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║          OFFICE MANAGER              ║
echo  ║      Gestão de Reuniões e Tarefas    ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [INFO] Iniciando Office Manager...
echo [INFO] O browser abrirá automaticamente...
echo.

start /B npm start

timeout /t 3 /nobreak >nul

start http://localhost:3000

echo [OK] Office Manager iniciado!
echo [INFO] URL: http://localhost:3000
echo [INFO] Para parar: Feche esta janela
echo.

:wait
timeout /t 30 /nobreak >nul
goto wait
