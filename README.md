# Robot Framework Pro

Complete Robot Framework extension for Visual Studio Code with advanced features including debugging, code analysis, formatting, test execution, and Material theme.

## Features

### Test Explorer & Execution
- **Test Explorer** with hierarchical test display
- Individual test execution and debugging
- Real-time test status (passed/failed)
- Execute tests directly from editor or explorer
- Keyboard shortcuts for quick test execution

### Language Features
- **Go to Definition (F12)** - Navigate to keyword and variable definitions
- **Find All References (Shift+F12)** - Find all usages of keywords and variables
- **Hover Documentation** - See documentation on hover
- **Signature Help (Ctrl+Shift+Space)** - View keyword arguments while typing
- **Advanced IntelliSense** - Smart code completion with documentation
- **Rename Refactoring (F2)** - Rename keywords and variables across the workspace

### Code Quality
- **Syntax Highlighting** - Complete Robot Framework syntax support
- **Code Formatting** - Format your Robot Framework files
- **Diagnostics** - Real-time error detection
- **Robocop Integration** - Linting with Robocop
- **Import Management** - Organize imports and auto-import keywords

### Testing & Reporting
- **Test Report Viewer** - View test reports directly in VS Code
- **Test Log Viewer** - View test logs in VS Code
- **Real-time Output** - See test execution output as it happens

### Workspace Features
- **Multi-root Workspace Support** - Work with multiple projects simultaneously
- **Keyword Indexer** - Fast workspace indexing for quick navigation
- **Document Symbols** - Outline and breadcrumb navigation

### Visual
- **Material Theme** - Beautiful dark and light themes
- **Code Snippets** - Pre-built snippets for all Robot Framework structures

## Requirements

- Visual Studio Code 1.85.0 or higher
- Python 3.8 or higher
- Robot Framework 4.0 or higher (install with \`pip install robotframework\`)
- (Optional) Robocop for linting (\`pip install robotframework-robocop\`)
- (Optional) robotidy for formatting (\`pip install robotframework-tidy\`)

## Extension Settings

This extension contributes the following settings:

### Python & Robot Framework
* \`robotframework.python.executable\`: Path to Python executable (default: \`python\`)
* \`robotframework.robot.executable\`: Path to Robot Framework executable (default: \`robot\`)

### Language Server
* \`robotframework.language.server.enabled\`: Enable/disable the language server (default: \`true\`)
* \`robotframework.language.server.trace\`: Trace level for language server communication (default: \`off\`)

### Code Completion
* \`robotframework.completion.enabled\`: Enable/disable code completion (default: \`true\`)
* \`robotframework.completion.filterText\`: Filter completion items based on typed text (default: \`true\`)

### Diagnostics
* \`robotframework.diagnostics.enabled\`: Enable/disable diagnostics (default: \`true\`)
* \`robotframework.diagnostics.level\`: Minimum diagnostic level to show (default: \`warning\`)

### Formatting
* \`robotframework.formatting.enabled\`: Enable/disable code formatting (default: \`true\`)
* \`robotframework.formatting.lineLength\`: Maximum line length (default: \`120\`)
* \`robotframework.formatting.spaceCount\`: Number of spaces for indentation (default: \`4\`)
* \`robotframework.formatting.usePipes\`: Use pipe-separated format (default: \`false\`)

### Test Execution
* \`robotframework.execution.arguments\`: Additional arguments for robot execution (default: \`[]\`)
* \`robotframework.execution.showOutputOnRun\`: Show output panel when running tests (default: \`true\`)
* \`robotframework.execution.clearOutputBeforeRun\`: Clear output before running tests (default: \`true\`)

### Debugging
* \`robotframework.debug.port\`: Port for debug adapter (default: \`5678\`)
* \`robotframework.debug.stopOnEntry\`: Stop on entry when debugging (default: \`false\`)

## Keyboard Shortcuts

- \`Ctrl+Shift+R\` / \`Cmd+Shift+R\` - Run current test file
- \`Ctrl+Shift+D\` / \`Cmd+Shift+D\` - Debug current test file
- \`Ctrl+Shift+F\` / \`Cmd+Shift+F\` - Format current file
- \`F12\` - Go to Definition
- \`Shift+F12\` - Find All References
- \`F2\` - Rename Symbol
- \`Ctrl+Shift+Space\` - Signature Help

## Commands

All commands are available via the Command Palette (\`Ctrl+Shift+P\` / \`Cmd+Shift+P\`):

- \`Robot Framework: Run Test\` - Run a single test
- \`Robot Framework: Run Current Test File\` - Run the current file
- \`Robot Framework: Run Test Suite\` - Run a test suite
- \`Robot Framework: Debug Test\` - Debug a test
- \`Robot Framework: Debug Current Test File\` - Debug the current file
- \`Robot Framework: Format File\` - Format the current file
- \`Robot Framework: Show Test Report\` - View the latest test report
- \`Robot Framework: Show Test Log\` - View the latest test log
- \`Robot Framework: Organize Imports\` - Organize imports alphabetically
- \`Robot Framework: Reindex Workspace\` - Re-index the workspace
- \`Robot Framework: Show Output\` - Show the output panel
- \`Robot Framework: Clear Cache\` - Clear the language server cache
- \`Robot Framework: Restart Language Server\` - Restart the language server

## Release Notes

### 1.0.0

Initial release with complete feature set:
- Test Explorer with hierarchical display
- Go to Definition, Find References, Hover, Signature Help
- Advanced IntelliSense with documentation
- Rename Refactoring
- Import Management with auto-import
- Test Report Viewer
- Multi-root Workspace Support
- Robocop Integration
- Material Dark & Light themes
- Code Snippets for all RF structures
- Complete syntax highlighting

## License

MIT License - see LICENSE file for details

---

**Enjoy using Robot Framework Pro!** 🤖
