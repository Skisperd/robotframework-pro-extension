# Project Structure - Estrutura do Projeto

Visão completa da estrutura da extensão Robot Framework Pro.

```
D:\development\extensao\
│
├── 📁 .vscode/                      # Configurações do VS Code para desenvolvimento
│   ├── launch.json                  # Configurações de debug da extensão
│   ├── tasks.json                   # Tarefas de build
│   └── settings.json                # Configurações do workspace
│
├── 📁 src/                          # Código-fonte TypeScript
│   ├── extension.ts                 # 🎯 Ponto de entrada principal da extensão
│   │                                # - Ativa extensão
│   │                                # - Inicia Language Server
│   │                                # - Registra comandos
│   │                                # - Configura debugger
│   │                                # - Registra formatadores
│   │
│   ├── 📁 languageServer/           # Language Server Protocol (LSP)
│   │   ├── server.ts                # 🌐 Servidor LSP principal
│   │   │                            # - Completions
│   │   │                            # - Diagnostics
│   │   │                            # - Formatting
│   │   │                            # - Hover
│   │   │                            # - Definitions
│   │   │
│   │   ├── parser.ts                # 📖 Parser Robot Framework
│   │   │                            # - Analisa arquivos .robot
│   │   │                            # - Extrai sections, keywords, tests
│   │   │                            # - Identifica variáveis
│   │   │
│   │   ├── formatter.ts             # 📐 Formatador de código
│   │   │                            # - Formata documentos
│   │   │                            # - Formata ranges
│   │   │                            # - Alinha keywords e argumentos
│   │   │
│   │   └── diagnostics.ts           # 🔍 Provedor de diagnósticos
│   │                                # - Detecta erros
│   │                                # - Avisa sobre problemas
│   │                                # - Valida código
│   │
│   ├── 📁 debugAdapter/             # Debug Adapter Protocol (DAP)
│   │   ├── debugAdapter.ts          # 🐛 Debug Adapter
│   │   │                            # - Controla sessão de debug
│   │   │                            # - Gerencia breakpoints
│   │   │                            # - Inspeciona variáveis
│   │   │                            # - Stack frames
│   │   │
│   │   └── debugConfigProvider.ts   # ⚙️ Provedor de configuração de debug
│   │                                # - Resolve configurações
│   │                                # - Fornece defaults
│   │                                # - Valida configurações
│   │
│   └── 📁 testRunner/               # Executor de Testes
│       └── testRunner.ts            # 🚀 Runner de testes Robot Framework
│                                    # - Executa testes
│                                    # - Captura output
│                                    # - Mostra resultados
│                                    # - Abre relatórios
│
├── 📁 syntaxes/                     # Gramáticas de Sintaxe
│   └── robotframework.tmLanguage.json  # 🎨 Gramática TextMate
│                                    # - Syntax highlighting
│                                    # - Tokens e scopes
│                                    # - Padrões de matching
│
├── 📁 themes/                       # Temas de Cores
│   ├── material-dark.json           # 🌙 Tema Material Dark
│   └── material-light.json          # ☀️ Tema Material Light
│
├── 📁 snippets/                     # Code Snippets
│   └── robotframework.json          # 💡 Snippets Robot Framework
│                                    # - test, keyword, for, if, try, etc.
│
├── 📁 resources/                    # Recursos da Extensão
│   ├── icon.png                     # 🖼️ Ícone da extensão (128x128)
│   └── robot-icon.svg               # 🤖 Ícone SVG do Robot Framework
│
├── 📁 examples/                     # Exemplos
│   ├── example.robot                # 📝 Exemplo completo de teste
│   └── example.resource             # 📚 Exemplo de resource file
│
├── 📁 out/                          # Código Compilado (gerado por npm run compile)
│   ├── extension.js
│   ├── languageServer/
│   ├── debugAdapter/
│   └── testRunner/
│
├── 📁 node_modules/                 # Dependências (gerado por npm install)
│
├── 📄 package.json                  # 📦 Manifesto da Extensão
│                                    # - Metadata
│                                    # - Contribuições (commands, themes, etc.)
│                                    # - Activation events
│                                    # - Dependencies
│                                    # - Scripts
│
├── 📄 tsconfig.json                 # ⚙️ Configuração TypeScript
├── 📄 .eslintrc.json                # 📏 Regras ESLint
├── 📄 .gitignore                    # 🚫 Arquivos ignorados pelo Git
├── 📄 .vscodeignore                 # 📦 Arquivos ignorados no package
├── 📄 .npmrc                        # ⚙️ Configuração NPM
├── 📄 .editorconfig                 # 📝 Configuração do Editor
├── 📄 language-configuration.json   # ⚙️ Configuração da Linguagem
│
├── 📄 README.md                     # 📖 Documentação Principal (English)
├── 📄 LEIA-ME.md                    # 📖 Documentação Principal (Português)
├── 📄 CHANGELOG.md                  # 📋 Histórico de Mudanças
├── 📄 LICENSE                       # ⚖️ Licença MIT
│
├── 📄 INSTALLATION.md               # 🔧 Guia de Instalação Detalhado
├── 📄 QUICK_START.md                # 🚀 Guia de Início Rápido
├── 📄 DEVELOPMENT.md                # 👨‍💻 Guia de Desenvolvimento
├── 📄 CONTRIBUTING.md               # 🤝 Guia de Contribuição
├── 📄 PUBLISHING.md                 # 📤 Guia de Publicação
├── 📄 BUILD.md                      # 🏗️ Instruções de Build
├── 📄 NEXT_STEPS.md                 # ✅ Próximos Passos
└── 📄 PROJECT_STRUCTURE.md          # 📁 Este arquivo
```

## 📊 Estatísticas do Projeto

### Arquivos de Código
- **TypeScript**: 8 arquivos
  - 1 extension.ts (entrada principal)
  - 4 language server files
  - 2 debug adapter files
  - 1 test runner file

### Arquivos de Configuração
- **VS Code**: 11 arquivos
  - package.json (manifesto)
  - language-configuration.json
  - 1 syntax grammar
  - 2 themes
  - 1 snippets file
  - 3 .vscode/ config files
  - 3 lint/build configs

### Documentação
- **Guides**: 10 arquivos markdown
  - 2 README (EN + PT)
  - 8 specialized guides

### Recursos
- **Examples**: 2 arquivos .robot/.resource
- **Icons**: 2 arquivos (SVG + PNG)

### Total
- **~35 arquivos** criados manualmente
- **Linhas de código**: ~3,000+
- **Linhas de docs**: ~2,500+

## 🔄 Fluxo de Dados

### 1. Activation Flow
```
Usuário abre .robot file
    ↓
VS Code detecta language ID
    ↓
Ativa extensão (extension.ts)
    ↓
Inicia Language Server (server.ts)
    ↓
Registra comandos e providers
    ↓
Extensão pronta
```

### 2. Code Completion Flow
```
Usuário digita no editor
    ↓
VS Code envia mudança para Language Server
    ↓
Server.ts recebe onCompletion event
    ↓
Retorna lista de CompletionItems
    ↓
VS Code mostra sugestões
```

### 3. Diagnostic Flow
```
Arquivo .robot muda
    ↓
Server recebe onDidChangeContent
    ↓
Parser.ts analisa o código
    ↓
DiagnosticsProvider valida
    ↓
Server envia diagnostics para VS Code
    ↓
VS Code mostra squiggles/problemas
```

### 4. Test Execution Flow
```
Usuário pressiona Ctrl+Shift+R
    ↓
Comando robotframework.runFile executado
    ↓
TestRunner.ts recebe chamada
    ↓
Spawna processo 'robot'
    ↓
Captura stdout/stderr
    ↓
Mostra no Output Channel
    ↓
Atualiza Status Bar
```

### 5. Debug Flow
```
Usuário pressiona F5
    ↓
DebugConfigProvider resolve config
    ↓
VS Code inicia Debug Adapter
    ↓
DebugAdapter.ts spawna robot process
    ↓
Comunica via Debug Adapter Protocol
    ↓
VS Code mostra debug UI
```

### 6. Formatting Flow
```
Usuário pressiona Ctrl+Shift+F
    ↓
VS Code chama formatting provider
    ↓
Extension envia request para server
    ↓
Formatter.ts formata código
    ↓
Retorna TextEdit[]
    ↓
VS Code aplica edições
```

## 🏗️ Arquitetura da Extensão

```
┌─────────────────────────────────────────────────────┐
│                VS Code Extension Host               │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         Extension (extension.ts)           │    │
│  │  - Activation                              │    │
│  │  - Command Registration                    │    │
│  │  - UI Integration                          │    │
│  └────────────────────────────────────────────┘    │
│          │              │              │             │
│          ├──────────────┼──────────────┤            │
│          ↓              ↓              ↓             │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │Language     │ │Debug       │ │Test          │  │
│  │Client       │ │Config      │ │Runner        │  │
│  │(LSP)        │ │Provider    │ │              │  │
│  └─────────────┘ └────────────┘ └──────────────┘  │
│          │              │              │             │
└──────────┼──────────────┼──────────────┼───────────┘
           │              │              │
           ↓              ↓              ↓
  ┌────────────────┐ ┌──────────────┐ ┌──────────┐
  │Language Server │ │Debug Adapter │ │Robot     │
  │(server.ts)     │ │(debugAdap.)  │ │Process   │
  │                │ │              │ │          │
  │ - Parser       │ │ - Breakpts   │ │ - Exec   │
  │ - Diagnostics  │ │ - Variables  │ │ - Output │
  │ - Completions  │ │ - Stack      │ │ - Report │
  │ - Formatting   │ │              │ │          │
  └────────────────┘ └──────────────┘ └──────────┘
```

## 📦 Dependências

### Production Dependencies
```json
{
  "vscode-languageclient": "^9.0.1",      // Cliente LSP
  "vscode-languageserver": "^9.0.1",      // Servidor LSP
  "vscode-languageserver-textdocument": "^1.0.11",  // Text docs
  "vscode-debugadapter": "^1.51.0",       // Debug adapter
  "vscode-debugprotocol": "^1.51.0"       // Debug protocol
}
```

### Development Dependencies
```json
{
  "@types/node": "^20.10.0",              // Node types
  "@types/vscode": "^1.85.0",             // VS Code types
  "@typescript-eslint/eslint-plugin": "^6.13.0",  // ESLint
  "@typescript-eslint/parser": "^6.13.0", // Parser
  "@vscode/test-electron": "^2.3.8",      // Testing
  "eslint": "^8.55.0",                    // Linter
  "typescript": "^5.3.3",                 // Compiler
  "@vscode/vsce": "^2.22.0"               // Packaging
}
```

## 🎯 Recursos Principais

### Language Server Features
- ✅ Code Completion (onCompletion)
- ✅ Diagnostics (onDidChangeContent)
- ✅ Document Formatting (onDocumentFormatting)
- ✅ Range Formatting (onDocumentRangeFormatting)
- ✅ Hover Information (onHover)
- 🔜 Go to Definition
- 🔜 Find References
- 🔜 Document Symbols
- 🔜 Rename

### Debug Adapter Features
- ✅ Launch Configuration
- ✅ Breakpoints
- ✅ Step Through
- ✅ Variable Inspection
- ✅ Stack Frames
- ✅ Terminate/Disconnect
- 🔜 Conditional Breakpoints
- 🔜 Watch Expressions
- 🔜 Step Into/Out

### Test Runner Features
- ✅ Run Single File
- ✅ Run Test Suite
- ✅ Real-time Output
- ✅ Status Bar Updates
- ✅ Open Reports
- ✅ Configurable Arguments
- 🔜 Test Explorer Integration
- 🔜 Individual Test Execution
- 🔜 Code Lens

## 📈 Roadmap

### v1.0.0 (Current)
- ✅ Funcionalidades básicas completas
- ✅ Documentação completa
- ✅ Pronto para publicação

### v1.1.0 (Future)
- Test Explorer integration
- Code Lens for running tests
- Enhanced hover information
- Go to definition
- Find all references

### v1.2.0 (Future)
- Keyword library discovery
- Auto-import suggestions
- Refactoring support
- Enhanced debugging

### v2.0.0 (Future)
- Robot Framework 7.0 support
- Performance optimizations
- Advanced analysis
- Machine learning suggestions

## 🔧 Como Funciona

### TypeScript → JavaScript
```bash
npm run compile
# Compila src/*.ts → out/*.js
```

### Packaging
```bash
npm run package
# 1. Compila TypeScript
# 2. Inclui out/, resources/, syntaxes/, etc.
# 3. Exclui src/, node_modules/, etc.
# 4. Cria robotframework-pro-1.0.0.vsix
```

### Installation
```bash
code --install-extension robotframework-pro-1.0.0.vsix
# VS Code extrai VSIX para ~/.vscode/extensions/
# Carrega extension.ts quando .robot file é aberto
```

## 🎓 Conceitos Aplicados

### Design Patterns
- **Observer**: Language Server observa mudanças no documento
- **Provider**: Formatters, completions, diagnostics providers
- **Factory**: Criação de completion items, diagnostics
- **Singleton**: Extension instance, output channel

### Protocols
- **LSP**: Language Server Protocol para features de linguagem
- **DAP**: Debug Adapter Protocol para debugging
- **IPC**: Inter-Process Communication entre cliente/servidor

### VS Code APIs
- **Languages API**: Providers, formatters
- **Debug API**: Debug configurations, adapters
- **Commands API**: Comandos registrados
- **Configuration API**: Settings
- **Window API**: Output channels, status bar

## 📚 Recursos para Aprender Mais

### Official Docs
- **VS Code Extension API**: https://code.visualstudio.com/api
- **LSP Specification**: https://microsoft.github.io/language-server-protocol/
- **DAP Specification**: https://microsoft.github.io/debug-adapter-protocol/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

### Examples
- **VS Code Extension Samples**: https://github.com/microsoft/vscode-extension-samples
- **Language Server Example**: https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample
- **Debug Adapter Example**: https://github.com/microsoft/vscode-mock-debug

### Community
- **VS Code Discussions**: https://github.com/microsoft/vscode-discussions
- **Robot Framework Forum**: https://forum.robotframework.org/
- **Stack Overflow**: Tag `vscode-extensions`

---

**Estrutura completa e profissional pronta para desenvolvimento e publicação! 🚀**
