# Script de Publicação da Extensão Robot Framework Pro
# Este script automatiza o processo de publicação

Write-Host "🚀 Robot Framework Pro - Publishing Script" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Verificar se vsce está instalado
Write-Host "📦 Verificando vsce..." -ForegroundColor Yellow
$vsceInstalled = Get-Command vsce -ErrorAction SilentlyContinue

if (-not $vsceInstalled) {
    Write-Host "❌ vsce não está instalado!" -ForegroundColor Red
    Write-Host "   Instale com: npm install -g @vscode/vsce" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ vsce encontrado: $($vsceInstalled.Version)`n" -ForegroundColor Green

# Verificar arquivos necessários
Write-Host "📋 Verificando arquivos necessários..." -ForegroundColor Yellow

$requiredFiles = @(
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "resources/icon.png"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`n❌ Arquivos faltando: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "   Por favor, adicione os arquivos necessários antes de publicar." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Todos os arquivos necessários encontrados!`n" -ForegroundColor Green

# Limpar build anterior
Write-Host "🧹 Limpando build anterior..." -ForegroundColor Yellow
if (Test-Path "out") {
    Remove-Item -Recurse -Force out
    Write-Host "✅ Build anterior removido`n" -ForegroundColor Green
}

# Compilar
Write-Host "🔨 Compilando TypeScript..." -ForegroundColor Yellow
npm run compile

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Compilação falhou!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Compilação concluída com sucesso!`n" -ForegroundColor Green

# Ler versão do package.json
$packageJson = Get-Content package.json | ConvertFrom-Json
$version = $packageJson.version
$publisher = $packageJson.publisher

Write-Host "📦 Versão: $version" -ForegroundColor Cyan
Write-Host "👤 Publisher: $publisher`n" -ForegroundColor Cyan

# Menu de opções
Write-Host "Escolha uma ação:" -ForegroundColor Yellow
Write-Host "  1) Empacotar (.vsix)" -ForegroundColor White
Write-Host "  2) Publicar no Marketplace" -ForegroundColor White
Write-Host "  3) Empacotar E Publicar" -ForegroundColor White
Write-Host "  4) Cancelar" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Digite sua escolha (1-4)"

switch ($choice) {
    "1" {
        Write-Host "`n📦 Empacotando extensão..." -ForegroundColor Yellow
        vsce package --allow-star-activation
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Extensão empacotada com sucesso!" -ForegroundColor Green
            Write-Host "   Arquivo: robotframework-pro-$version.vsix" -ForegroundColor Cyan
            Write-Host "`n   Para instalar localmente:" -ForegroundColor Yellow
            Write-Host "   code --install-extension robotframework-pro-$version.vsix" -ForegroundColor White
        } else {
            Write-Host "`n❌ Falha ao empacotar!" -ForegroundColor Red
            exit 1
        }
    }
    
    "2" {
        Write-Host "`n🚀 Publicando no Marketplace..." -ForegroundColor Yellow
        Write-Host "   Você precisa estar logado com: vsce login $publisher" -ForegroundColor Cyan
        Write-Host ""
        
        $confirm = Read-Host "Deseja continuar? (s/n)"
        if ($confirm -eq "s" -or $confirm -eq "S") {
            vsce publish
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`n✅ Extensão publicada com sucesso!" -ForegroundColor Green
                Write-Host "   URL: https://marketplace.visualstudio.com/items?itemName=$publisher.robotframework-pro" -ForegroundColor Cyan
            } else {
                Write-Host "`n❌ Falha ao publicar!" -ForegroundColor Red
                Write-Host "   Verifique se você está logado: vsce login $publisher" -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "❌ Publicação cancelada" -ForegroundColor Red
        }
    }
    
    "3" {
        Write-Host "`n📦 Empacotando extensão..." -ForegroundColor Yellow
        vsce package --allow-star-activation
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "`n❌ Falha ao empacotar!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✅ Empacotado com sucesso!`n" -ForegroundColor Green
        
        Write-Host "🚀 Publicando no Marketplace..." -ForegroundColor Yellow
        Write-Host "   Você precisa estar logado com: vsce login $publisher" -ForegroundColor Cyan
        Write-Host ""
        
        $confirm = Read-Host "Deseja continuar? (s/n)"
        if ($confirm -eq "s" -or $confirm -eq "S") {
            vsce publish
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`n✅ Extensão publicada com sucesso!" -ForegroundColor Green
                Write-Host "   URL: https://marketplace.visualstudio.com/items?itemName=$publisher.robotframework-pro" -ForegroundColor Cyan
                Write-Host "`n   Arquivo local: robotframework-pro-$version.vsix" -ForegroundColor Cyan
            } else {
                Write-Host "`n❌ Falha ao publicar!" -ForegroundColor Red
                Write-Host "   Verifique se você está logado: vsce login $publisher" -ForegroundColor Yellow
                Write-Host "   Mas o arquivo .vsix foi criado com sucesso!" -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "❌ Publicação cancelada (mas .vsix foi criado)" -ForegroundColor Yellow
        }
    }
    
    "4" {
        Write-Host "`n❌ Operação cancelada" -ForegroundColor Red
        exit 0
    }
    
    default {
        Write-Host "`n❌ Opção inválida!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✨ Processo concluído!" -ForegroundColor Green
Write-Host "`n📊 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Verifique a extensão no marketplace" -ForegroundColor White
Write-Host "   2. Teste a instalação: code --install-extension $publisher.robotframework-pro" -ForegroundColor White
Write-Host "   3. Monitore downloads e reviews" -ForegroundColor White
Write-Host "   4. Divulgue nas redes sociais!" -ForegroundColor White
Write-Host ""
