# Robot Framework Pro - Extensão Completa para VS Code

Extensão completa do Visual Studio Code para desenvolvimento com Robot Framework, incluindo recursos avançados de teste, depuração, análise de código e formatação.

## 🎯 Características Principais

### 🎨 Temas Material Design Lindos
- **Material Dark** - Tema escuro otimizado para Robot Framework
- **Material Light** - Tema claro e limpo para programação diurna
- Destaque de sintaxe especialmente projetado para Robot Framework

### 🔍 Análise Inteligente de Código
- Verificação de sintaxe em tempo real
- Detecção de casos de teste e palavras-chave duplicadas
- Avisos de variáveis não definidas
- Detecção de casos de teste vazios
- Diagnósticos inteligentes com mensagens acionáveis

### ✨ Autocompletar Inteligente
- Sugestões de palavras-chave integradas
- Templates de estruturas de controle (FOR, IF, TRY, etc.)
- Cabeçalhos de seção (Settings, Variables, Test Cases, Keywords)
- Sugestões de configurações ([Documentation], [Tags], [Setup], etc.)

### 🎯 Depuração Avançada
- Suporte completo ao Debug Adapter Protocol (DAP)
- Definição de breakpoints em arquivos .robot
- Execução passo a passo dos testes
- Inspeção de variáveis durante a execução
- Visualização da pilha de chamadas

### 🚀 Execução de Testes
- Execute testes diretamente do VS Code
- Execute arquivos únicos ou suites inteiras
- Saída em tempo real no terminal integrado
- Geração automática de relatórios
- Acesso rápido aos relatórios HTML

### 📐 Formatação de Código
- Formatação automática de arquivos .robot
- Indentação e espaçamento configuráveis
- Suporte ao formato separado por pipes
- Formatar ao salvar
- Segue as melhores práticas do Robot Framework

### 📝 Snippets de Código Rico
- Templates de casos de teste
- Definições de palavras-chave
- Loops FOR com variações
- Condicionais IF-ELSE
- Blocos TRY-EXCEPT
- Templates de seções
- Padrões de palavras-chave comuns

## 📦 Instalação

### Requisitos

- **Python** 3.8 ou superior
- **Robot Framework** 5.0 ou superior

Instale o Robot Framework:
```bash
pip install robotframework
```

### Construir a Extensão

```bash
# Navegue até o diretório da extensão
cd D:\development\extensao

# Instale as dependências
npm install

# Compile o TypeScript
npm run compile

# Empacote a extensão
npm run package

# Instale no VS Code
code --install-extension robotframework-pro-1.0.0.vsix
```

## 🚀 Início Rápido

### 1. Crie um Arquivo Robot Framework

Crie um novo arquivo com extensão `.robot`:

```robotframework
*** Settings ***
Documentation     Exemplo de teste Robot Framework
Library           BuiltIn

*** Variables ***
${MENSAGEM}       Olá, Robot Framework!

*** Test Cases ***
Teste de Exemplo
    [Documentation]    Um teste de exemplo simples
    [Tags]    exemplo
    Log    ${MENSAGEM}
    Should Be Equal    ${MENSAGEM}    Olá, Robot Framework!

*** Keywords ***
Palavra-Chave Customizada
    [Documentation]    Exemplo de palavra-chave customizada
    [Arguments]    ${arg}
    Log    Recebido: ${arg}
    [Return]    ${arg}
```

### 2. Execute os Testes

- **Atalho de teclado**: `Ctrl+Shift+R` (Cmd+Shift+R no Mac)
- **Paleta de Comandos**: `Robot Framework: Run Current Test File`
- **Clique com botão direito** no editor → "Run Robot Framework Test"
- **Clique** no botão play na barra de título do editor

### 3. Depure os Testes

- Defina breakpoints clicando na margem
- Pressione `F5` ou use o comando "Debug Robot Framework Test"
- Use os controles de depuração para executar passo a passo

### 4. Formate o Código

- **Atalho de teclado**: `Ctrl+Shift+F` (Cmd+Shift+F no Mac)
- **Paleta de Comandos**: `Robot Framework: Format Robot Framework File`
- **Clique com botão direito** → "Format Document"

## ⚙️ Configuração

Acesse as configurações via `Arquivo → Preferências → Configurações` e procure por "Robot Framework".

### Configurações Essenciais

```json
{
  // Caminho do executável Python
  "robotframework.python.executable": "python",

  // Caminho do executável Robot Framework
  "robotframework.robot.executable": "robot",

  // Habilitar servidor de linguagem
  "robotframework.language.server.enabled": true,

  // Habilitar diagnósticos
  "robotframework.diagnostics.enabled": true,

  // Opções de formatação
  "robotframework.formatting.enabled": true,
  "robotframework.formatting.lineLength": 120,
  "robotframework.formatting.spaceCount": 4,

  // Configurações de execução
  "robotframework.execution.showOutputOnRun": true,
  "robotframework.execution.clearOutputBeforeRun": true
}
```

### Configuração de Depuração

Adicione ao seu `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "robotframework",
      "request": "launch",
      "name": "Robot Framework: Launch",
      "target": "${file}",
      "cwd": "${workspaceFolder}",
      "stopOnEntry": false,
      "arguments": ["-d", "results"]
    }
  ]
}
```

## ⌨️ Atalhos de Teclado

| Ação | Windows/Linux | macOS |
|------|---------------|-------|
| Executar Arquivo Atual | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Depurar Arquivo Atual | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Formatar Documento | `Ctrl+Shift+F` | `Cmd+Shift+F` |

## 🎨 Temas

Mude para os temas Material do Robot Framework:

1. Abra a Paleta de Comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Digite "Color Theme"
3. Selecione:
   - **Robot Framework Material Dark** (recomendado)
   - **Robot Framework Material Light**

## 🔧 Snippets Disponíveis

Digite estes prefixos e pressione Tab:

- `test` → Template de caso de teste
- `keyword` → Template de palavra-chave
- `for` → Loop FOR
- `forrange` → Loop FOR com range
- `if` → Declaração IF
- `ifelse` → Declaração IF-ELSE
- `try` → Bloco TRY-EXCEPT
- `settings` → Seção Settings
- `variables` → Seção Variables
- `testcases` → Seção Test Cases
- `keywords` → Seção Keywords
- `log` → Comando Log
- `shouldbe` → Should Be Equal

## 📚 Comandos Disponíveis

Todos os comandos são acessíveis via Paleta de Comandos (`Ctrl+Shift+P`):

- `Robot Framework: Run Robot Framework Test`
- `Robot Framework: Run Current Test File`
- `Robot Framework: Run Test Suite`
- `Robot Framework: Debug Robot Framework Test`
- `Robot Framework: Debug Current Test File`
- `Robot Framework: Format Robot Framework File`
- `Robot Framework: Show Output`
- `Robot Framework: Clear Language Server Cache`
- `Robot Framework: Restart Language Server`

## 🛠️ Desenvolvimento

### Construir do Código Fonte

```bash
# Clone o repositório
git clone https://github.com/your-username/robotframework-pro.git
cd robotframework-pro

# Instale dependências
npm install

# Compile
npm run compile

# Execute em modo de desenvolvimento
code .
# Pressione F5
```

### Estrutura do Projeto

```
robotframework-pro/
├── src/                      # Código-fonte TypeScript
│   ├── extension.ts         # Ponto de entrada principal
│   ├── languageServer/      # Servidor de linguagem (LSP)
│   ├── debugAdapter/        # Adaptador de depuração (DAP)
│   └── testRunner/          # Executor de testes
├── syntaxes/                # Gramática de sintaxe
├── themes/                  # Temas Material
├── snippets/                # Snippets de código
├── examples/                # Exemplos de testes
├── resources/               # Ícones e recursos
└── out/                     # Código compilado
```

## 🐛 Solução de Problemas

### Servidor de Linguagem Não Funciona

1. Verifique se Python está instalado: `python --version`
2. Verifique se Robot Framework está instalado: `robot --version`
3. Reinicie o Servidor de Linguagem: Paleta de Comandos → "Robot Framework: Restart Language Server"
4. Verifique o painel Output para erros

### Testes Não Executam

1. Verifique o caminho do executável Python nas configurações
2. Certifique-se de que Robot Framework está instalado: `pip install robotframework`
3. Verifique se uma pasta do workspace está aberta
4. Revise o painel Output para mensagens de erro

### Formatação Não Funciona

1. Habilite a formatação nas configurações
2. Verifique se as configurações de indentação estão corretas
3. Certifique-se de que o arquivo tem extensão `.robot`

## 📄 Documentação Adicional

- **README.md** - Documentação completa em inglês
- **QUICK_START.md** - Guia de início rápido
- **INSTALLATION.md** - Guia detalhado de instalação
- **DEVELOPMENT.md** - Guia de desenvolvimento
- **PUBLISHING.md** - Guia de publicação no marketplace
- **BUILD.md** - Instruções de build
- **CONTRIBUTING.md** - Guia de contribuição

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, leia o [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes.

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Créditos

Inspirado pela excelente extensão [RobotCode](https://robotcode.io/) e construído com as melhores práticas do ecossistema de extensões do VS Code.

## 📞 Suporte

- **Issues**: https://github.com/your-username/robotframework-pro/issues
- **Documentação**: https://robotframework.org
- **Comunidade**: https://forum.robotframework.org

---

**Aproveite seu desenvolvimento com Robot Framework!** 🤖✨
