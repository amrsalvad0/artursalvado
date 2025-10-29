# Artur Salvado - Script de Inicialização
# PowerShell Script para Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      ARTUR SALVADO - INICIANDO..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Node.js está instalado
Write-Host "Verificando Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js encontrado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ ERRO: Node.js não encontrado!" -ForegroundColor Red
    Write-Host "Por favor, instale o Node.js de https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""

# Verificar dependências
Write-Host "Verificando dependências..." -ForegroundColor Green
if (!(Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ ERRO: Falha ao instalar dependências!" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
    Write-Host "✓ Dependências instaladas!" -ForegroundColor Green
} else {
    Write-Host "✓ Dependências já instaladas!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Iniciando servidor..." -ForegroundColor Green
Write-Host "O browser abrirá automaticamente em alguns segundos..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Para parar o servidor, pressione Ctrl+C" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Aguardar um pouco
Start-Sleep -Seconds 2

# Iniciar o servidor
try {
    # Abrir browser após alguns segundos
    Start-Job -ScriptBlock {
        Start-Sleep -Seconds 5
        Start-Process "http://localhost:3000"
    } | Out-Null
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   ARTUR SALVADO ESTÁ A CORRER!" -ForegroundColor Yellow
    Write-Host "   Browser: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "   Para parar: Pressione Ctrl+C" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Executar o servidor
    npm start
    
} catch {
    Write-Host "✗ Erro ao iniciar o servidor!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
}
