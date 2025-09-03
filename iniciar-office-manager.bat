@echo off
echo ========================================
echo      OFFICE MANAGER - INICIANDO...
echo ========================================
echo.

echo Verificando se o Node.js está instalado...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js não encontrado!
    echo Por favor, instale o Node.js de https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Verificando dependências...
if not exist "node_modules" (
    echo Instalando dependências...
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependências!
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor...
echo O browser abrirá automaticamente em alguns segundos...
echo.
echo Para parar o servidor, pressione Ctrl+C
echo ========================================

timeout /t 3 /nobreak >nul

rem Iniciar o servidor em background
start /B npm start

rem Aguardar o servidor iniciar
timeout /t 5 /nobreak >nul

rem Abrir o browser
start http://localhost:3000

rem Manter o terminal aberto
echo.
echo ========================================
echo   OFFICE MANAGER ESTÁ A CORRER!
echo   Browser: http://localhost:3000
echo   Para parar: Pressione Ctrl+C
echo ========================================
echo.

rem Aguardar input do utilizador para manter o terminal aberto
pause
