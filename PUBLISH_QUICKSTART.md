# 🚀 Publicar Extensão - Início Rápido

## ⚡ Passos Rápidos (5 minutos)

### 1️⃣ Instalar vsce
```bash
npm install -g @vscode/vsce
```

### 2️⃣ Criar conta no Marketplace
1. Acesse: https://marketplace.visualstudio.com/manage
2. Login com conta Microsoft
3. Create Publisher → ID: `robotframework-pro`

### 3️⃣ Criar Personal Access Token
1. Acesse: https://dev.azure.com
2. User Settings → Personal Access Tokens
3. New Token → Marketplace (Manage) → Create
4. **COPIE O TOKEN!**

### 4️⃣ Fazer Login
```bash
vsce login robotframework-pro
# Cole o token quando solicitado
```

### 5️⃣ Publicar
```bash
# Usando script automático (recomendado)
.\publish.ps1

# Ou manualmente
npm run compile
vsce publish
```

## ✅ Pronto!

Sua extensão estará em:
https://marketplace.visualstudio.com/items?itemName=robotframework-pro.robotframework-pro

## 📚 Mais Detalhes

Veja: `PUBLISHING_GUIDE.md` para guia completo

## 🆘 Precisa de Ajuda?

### Login não funciona?
```bash
# Crie novo token em: https://dev.azure.com
vsce login robotframework-pro
```

### Publisher não existe?
```bash
# Crie em: https://marketplace.visualstudio.com/manage
```

### Erro ao compilar?
```bash
npm install
npm run compile
```

## 🎯 Comandos Úteis

```bash
# Apenas empacotar (não publica)
vsce package

# Instalar localmente para testar
code --install-extension robotframework-pro-1.0.0.vsix

# Publicar nova versão patch (1.0.0 → 1.0.1)
vsce publish patch

# Publicar nova versão minor (1.0.0 → 1.1.0)
vsce publish minor

# Publicar nova versão major (1.0.0 → 2.0.0)
vsce publish major

# Ver informações
vsce show robotframework-pro.robotframework-pro

# Despublicar (cuidado!)
vsce unpublish robotframework-pro.robotframework-pro
```

## 📊 Status

Após publicar, monitore em:
- Marketplace: https://marketplace.visualstudio.com/manage
- Downloads e ratings aparecem lá

---

**Boa sorte com a publicação! 🎉**
