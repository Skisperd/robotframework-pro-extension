# Robot Framework Pro

The complete Visual Studio Code extension for Robot Framework development with advanced features for testing, debugging, code analysis, and formatting.

## Features

### 🎨 Beautiful Material Design Themes
- **Material Dark** - Eye-friendly dark theme optimized for Robot Framework
- **Material Light** - Clean light theme for daytime coding
- Syntax highlighting specifically designed for Robot Framework keywords, variables, and structures

### 🔍 Intelligent Code Analysis
- Real-time syntax checking and error detection
- Duplicate test case and keyword detection
- Undefined variable warnings
- Empty test case detection
- Smart diagnostics with actionable messages

### ✨ Smart Code Completion
- Built-in keyword suggestions
- Control structure templates (FOR, IF, TRY, etc.)
- Section headers (Settings, Variables, Test Cases, Keywords)
- Setting suggestions ([Documentation], [Tags], [Setup], etc.)
- Context-aware completions

### 🎯 Advanced Debugging
- Full Debug Adapter Protocol (DAP) support
- Set breakpoints in .robot files
- Step through test execution
- Inspect variables during execution
- View call stack and execution flow
- Stop on entry option
- Integrated debug console

### 🚀 Test Execution
- Run tests directly from VS Code
- Execute single test files or entire suites
- Run tests via command palette, context menu, or keyboard shortcuts
- Real-time output in integrated terminal
- Automatic report and log generation
- Quick access to HTML reports
- Status bar integration showing test results

### 📐 Code Formatting
- Automatic code formatting for .robot files
- Configurable indentation and spacing
- Support for pipe-separated format
- Format on save option
- Format selection or entire document
- Respects Robot Framework best practices

### 📝 Rich Code Snippets
- Test case templates
- Keyword definitions
- FOR loops with variations
- IF-ELSE conditionals
- TRY-EXCEPT blocks
- Section templates
- Common keyword patterns
- Variable declarations

### 🔧 Extensive Configuration
- Customizable Python and Robot paths
- Adjustable diagnostic levels
- Formatting preferences
- Execution arguments
- Debug settings
- Language server options

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Robot Framework Pro"
4. Click Install

### From VSIX File
1. Download the .vsix file
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
4. Click "..." menu → "Install from VSIX"
5. Select the downloaded file

## Requirements

- **Python** 3.8 or higher
- **Robot Framework** 5.0 or higher

Install Robot Framework:
```bash
pip install robotframework
```

## Quick Start

### 1. Create a Robot Framework File
Create a new file with `.robot` extension:

```robotframework
*** Settings ***
Documentation     Example Robot Framework test
Library           BuiltIn

*** Variables ***
${MESSAGE}        Hello, Robot Framework!

*** Test Cases ***
Example Test
    [Documentation]    A simple example test
    [Tags]    example
    Log    ${MESSAGE}
    Should Be Equal    ${MESSAGE}    Hello, Robot Framework!

*** Keywords ***
Custom Keyword
    [Documentation]    A custom keyword example
    [Arguments]    ${arg}
    Log    Received: ${arg}
    [Return]    ${arg}
```

### 2. Run Tests
- **Keyboard shortcut**: `Ctrl+Shift+R` (Cmd+Shift+R on Mac)
- **Command Palette**: `Robot Framework: Run Current Test File`
- **Right-click** in editor → "Run Robot Framework Test"
- **Click** the play button in the editor title bar

### 3. Debug Tests
- Set breakpoints by clicking in the gutter
- Press `F5` or use "Debug Robot Framework Test" command
- Use debug controls to step through execution

### 4. Format Code
- **Keyboard shortcut**: `Ctrl+Shift+F` (Cmd+Shift+F on Mac)
- **Command Palette**: `Robot Framework: Format Robot Framework File`
- **Right-click** → "Format Document"

## Configuration

Access settings via `File → Preferences → Settings` and search for "Robot Framework".

### Essential Settings

```json
{
  // Python executable path
  "robotframework.python.executable": "python",

  // Robot Framework executable path
  "robotframework.robot.executable": "robot",

  // Enable language server
  "robotframework.language.server.enabled": true,

  // Enable diagnostics
  "robotframework.diagnostics.enabled": true,

  // Formatting options
  "robotframework.formatting.enabled": true,
  "robotframework.formatting.lineLength": 120,
  "robotframework.formatting.spaceCount": 4,
  "robotframework.formatting.usePipes": false,

  // Execution settings
  "robotframework.execution.showOutputOnRun": true,
  "robotframework.execution.clearOutputBeforeRun": true,
  "robotframework.execution.arguments": []
}
```

### Debug Configuration

Add to your `.vscode/launch.json`:

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

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Run Current File | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Debug Current File | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Format Document | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Show Output | - | - |

## Commands

All commands are accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Robot Framework: Run Robot Framework Test`
- `Robot Framework: Run Current Test File`
- `Robot Framework: Run Test Suite`
- `Robot Framework: Debug Robot Framework Test`
- `Robot Framework: Debug Current Test File`
- `Robot Framework: Format Robot Framework File`
- `Robot Framework: Show Output`
- `Robot Framework: Clear Language Server Cache`
- `Robot Framework: Restart Language Server`

## Themes

Switch to Robot Framework Material themes:

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Color Theme"
3. Select:
   - **Robot Framework Material Dark** (recommended)
   - **Robot Framework Material Light**

## Troubleshooting

### Language Server Not Working
1. Check Python is installed: `python --version`
2. Check Robot Framework is installed: `robot --version`
3. Restart Language Server: Command Palette → "Robot Framework: Restart Language Server"
4. Check Output panel for errors

### Tests Not Running
1. Verify Python executable path in settings
2. Ensure Robot Framework is installed: `pip install robotframework`
3. Check workspace folder is open
4. Review Output panel for error messages

### Formatting Issues
1. Enable formatting in settings
2. Check indentation settings match your preference
3. Ensure file has `.robot` extension

### Debug Not Starting
1. Verify debug configuration in `.vscode/launch.json`
2. Check Python and Robot Framework are accessible
3. Ensure target file path is correct

## Known Limitations

- Debug stepping is currently limited (Robot Framework doesn't expose full debugging API)
- Some advanced Robot Framework features may not have full IntelliSense support
- Variable evaluation during debugging is basic

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

Repository: https://github.com/your-username/robotframework-pro

## Support

- **Issues**: https://github.com/your-username/robotframework-pro/issues
- **Documentation**: https://robotframework.org
- **Community**: https://forum.robotframework.org

## License

This extension is licensed under the MIT License. See LICENSE file for details.

## Credits

Inspired by the excellent [RobotCode](https://robotcode.io/) extension and built with best practices from the VS Code extension ecosystem.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

**Enjoy your Robot Framework development!** 🤖✨
