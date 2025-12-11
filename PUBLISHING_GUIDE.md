# 🚀 Guia de Publicação - Robot Framework Pro

## 📋 Pré-requisitos

Antes de publicar, você precisa:

1. ✅ Conta no Azure DevOps
2. ✅ Personal Access Token (PAT)
3. ✅ vsce (VS Code Extension Manager) instalado
4. ✅ Extensão compilada e testada
5. ✅ README.md atualizado
6. ✅ CHANGELOG.md com histórico de versões

## 🔧 Passo 1: Instalar vsce

```bash
npm install -g @vscode/vsce
```

Verificar instalação:
```bash
vsce --version
```

## 🔑 Passo 2: Criar Publisher Account

### 2.1 Acessar o Portal

1. Acesse: https://marketplace.visualstudio.com/manage
2. Faça login com conta Microsoft

### 2.2 Criar Publisher

1. Clique em **"Create publisher"**
2. Preencha:
   - **ID**: `robotframework-pro` (deve ser único)
   - **Display Name**: `Robot Framework Pro`
   - **Description**: `Professional tools for Robot Framework development`
   - **Email**: seu email

### 2.3 Criar Personal Access Token (PAT)

1. Acesse: https://dev.azure.com
2. Clique no ícone de usuário → **Personal Access Tokens**
3. Clique em **"New Token"**
4. Configure:
   - **Name**: `vscode-marketplace`
   - **Organization**: `All accessible organizations`
   - **Expiration**: 90 dias (ou custom)
   - **Scopes**: Marque **"Marketplace"** → **"Manage"**
5. Clique em **"Create"**
6. **COPIE O TOKEN** (só aparece uma vez!)

## 📦 Passo 3: Preparar a Extensão

### 3.1 Limpar e Compilar

```bash
# Limpar builds anteriores
Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue

# Compilar
npm run compile

# Verificar erros
npm run lint
```

### 3.2 Verificar package.json

Confirme que tem todas as informações:

```json
{
  "name": "robotframework-pro",
  "displayName": "Robot Framework Pro",
  "description": "Complete Robot Framework extension...",
  "version": "1.0.0",
  "publisher": "robotframework-pro",
  "repository": {
    "type": "git",
    "url": "https://github.com/Skisperd/robotframework-pro-extension.git"
  },
  "bugs": {
    "url": "https://github.com/Skisperd/robotframework-pro-extension/issues"
  },
  "icon": "resources/icon.png"
}
```

### 3.3 Criar/Verificar Ícone

O ícone deve ser:
- **128x128 pixels** (mínimo)
- Formato: **PNG**
- Localização: `resources/icon.png`

Se não tem, crie um:
```bash
# Exemplo: criar ícone placeholder
# Use uma ferramenta como GIMP, Photoshop, ou online
```

### 3.4 Atualizar README.md

Certifique-se que o README tem:
- ✅ Título e descrição clara
- ✅ Screenshots ou GIFs (opcional mas recomendado)
- ✅ Lista de features
- ✅ Instruções de instalação
- ✅ Requisitos
- ✅ Exemplos de uso
- ✅ Comandos disponíveis

### 3.5 Criar CHANGELOG.md

```markdown
# Changelog

## [1.0.0] - 2025-12-10

### Added
- Syntax highlighting para arquivos .robot e .resource
- Code completion inteligente
- Debug adapter para Robot Framework
- Execução de testes integrada
- Formatação automática de código
- Temas Material Dark e Light
- Snippets para estruturas comuns
- Diagnósticos em tempo real
- Test Explorer integration

### Features
- Run tests diretamente do VS Code
- Debug com breakpoints
- Output em tempo real
- Report HTML automático
- Suporte para multi-root workspaces
```

## 🎯 Passo 4: Fazer Login no vsce

```bash
vsce login robotframework-pro
```

Quando solicitado, cole o **Personal Access Token** que você criou.

## 📤 Passo 5: Empacotar a Extensão

### 5.1 Validar antes de empacotar

```bash
vsce package --allow-star-activation
```

Isso cria: `robotframework-pro-1.0.0.vsix`

### 5.2 Verificar warnings

Se aparecerem avisos:
- ⚠️ **"activationEvents"**: Pode remover eventos duplicados
- ⚠️ **"Missing license"**: Adicione arquivo LICENSE
- ⚠️ **"Missing repository"**: Já adicionamos no package.json

## 🚀 Passo 6: Publicar

### 6.1 Primeira Publicação

```bash
vsce publish
```

Ou especifique a versão:
```bash
vsce publish 1.0.0
```

### 6.2 Aguardar Validação

- Publicação é **imediata** mas pode levar alguns minutos
- Verificação de malware e segurança
- Indexação no marketplace

## ✅ Passo 7: Verificar Publicação

1. Acesse: https://marketplace.visualstudio.com/items?itemName=robotframework-pro.robotframework-pro
2. Ou busque por "Robot Framework Pro" no marketplace
3. Teste instalar via VS Code:
   ```
   code --install-extension robotframework-pro.robotframework-pro
   ```

## 📊 Passo 8: Monitorar

### Ver Estatísticas

1. Acesse: https://marketplace.visualstudio.com/manage
2. Clique na sua extensão
3. Veja:
   - Downloads
   - Avaliações
   - Análises

### Ver no VS Code

1. Abra VS Code
2. Extensions (Ctrl+Shift+X)
3. Busque: "Robot Framework Pro"
4. Deve aparecer publicada!

## 🔄 Atualizações Futuras

### Incrementar Versão

```bash
# Patch (1.0.0 → 1.0.1)
vsce publish patch

# Minor (1.0.0 → 1.1.0)
vsce publish minor

# Major (1.0.0 → 2.0.0)
vsce publish major
```

### Ou manualmente:

1. Edite `version` no package.json
2. Atualize CHANGELOG.md
3. Compile: `npm run compile`
4. Publique: `vsce publish`

## 🐛 Troubleshooting

### Erro: "Publisher not found"

**Solução**:
1. Verifique se criou o publisher no portal
2. ID do publisher deve ser exatamente igual ao do package.json
3. Faça login novamente: `vsce login robotframework-pro`

### Erro: "Missing README"

**Solução**:
- Certifique-se que tem README.md na raiz
- Conteúdo deve ter pelo menos 100 caracteres

### Erro: "Icon not found"

**Solução**:
```bash
# Verificar se existe
Test-Path resources/icon.png

# Se não existe, criar pasta
New-Item -ItemType Directory -Force -Path resources

# Adicionar ícone
# Copie um ícone PNG 128x128 para resources/icon.png
```

### Erro: "Activation events"

**Solução**: Remova eventos redundantes do package.json:
```json
{
  "activationEvents": [
    "workspaceContains:**/*.robot",
    "workspaceContains:**/*.resource",
    "onDebug"
  ]
}
```

### Erro: "Authentication failed"

**Solução**:
1. Crie novo Personal Access Token
2. Certifique-se que tem scope "Marketplace (Manage)"
3. Faça login novamente: `vsce login robotframework-pro`

## 📝 Checklist Pré-Publicação

- [ ] `npm run compile` sem erros
- [ ] `vsce package` gera .vsix com sucesso
- [ ] README.md completo e atualizado
- [ ] CHANGELOG.md com versão atual
- [ ] LICENSE file presente (MIT)
- [ ] Icon resources/icon.png existe (128x128)
- [ ] package.json tem repository, bugs, homepage
- [ ] Testado em Extension Development Host
- [ ] Versão incrementada corretamente
- [ ] Personal Access Token válido
- [ ] Publisher criado no marketplace

## 🎉 Após Publicação

### Divulgar

1. **GitHub**: Adicione badge ao README
   ```markdown
   [![VS Marketplace](https://img.shields.io/vscode-marketplace/v/robotframework-pro.robotframework-pro)](https://marketplace.visualstudio.com/items?itemName=robotframework-pro.robotframework-pro)
   ```

2. **Social Media**: Compartilhe
   - Twitter/X
   - LinkedIn
   - Reddit (r/RobotFramework, r/vscode)
   - Dev.to

3. **Documentação**: 
   - Crie Wiki no GitHub
   - Adicione exemplos
   - Vídeo tutorial (opcional)

### Coletar Feedback

1. Monitore issues no GitHub
2. Responda reviews no marketplace
3. Peça feedback na comunidade

## 🔒 Segurança

⚠️ **NUNCA** commite seu Personal Access Token!

Adicione ao `.gitignore`:
```
*.vsix
.vsce-token
```

## 📞 Suporte

- **Documentação**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **vsce CLI**: https://github.com/microsoft/vscode-vsce
- **Fórum**: https://github.com/microsoft/vscode-discussions

---

## 🚀 Quick Publish (Resumo)

```bash
# 1. Instalar vsce
npm install -g @vscode/vsce

# 2. Compilar
npm run compile

# 3. Fazer login
vsce login robotframework-pro

# 4. Publicar
vsce publish

# 5. Verificar
# https://marketplace.visualstudio.com/items?itemName=robotframework-pro.robotframework-pro
```

**Pronto! Sua extensão está publicada! 🎉**
