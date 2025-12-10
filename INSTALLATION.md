# Installation Guide

This guide will help you install and configure Robot Framework Pro extension for VS Code.

## Prerequisites

Before installing the extension, ensure you have the following:

### 1. Visual Studio Code
- Version 1.85.0 or higher
- Download from: https://code.visualstudio.com/

### 2. Python
- Python 3.8 or higher
- Verify installation:
  ```bash
  python --version
  ```
- Download from: https://www.python.org/downloads/

### 3. Robot Framework
- Install via pip:
  ```bash
  pip install robotframework
  ```
- Verify installation:
  ```bash
  robot --version
  ```

## Installation Methods

### Method 1: From VS Code Marketplace (Recommended)

1. Open Visual Studio Code
2. Click on Extensions icon in the Activity Bar (or press `Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Robot Framework Pro"
4. Click "Install"
5. Reload VS Code when prompted

### Method 2: From VSIX File

If you have the `.vsix` file:

1. Open Visual Studio Code
2. Open Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click the "..." menu at the top of the Extensions view
4. Select "Install from VSIX..."
5. Navigate to and select the `.vsix` file
6. Reload VS Code when prompted

### Method 3: From Source (Development)

For development or customization:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/robotframework-pro.git
   cd robotframework-pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Open in VS Code:
   ```bash
   code .
   ```

5. Press `F5` to launch Extension Development Host

## Post-Installation Configuration

### 1. Configure Python Path

If Python is not in your PATH:

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "robotframework python"
3. Set `robotframework.python.executable` to your Python path

Example:
```json
{
  "robotframework.python.executable": "C:\\Python39\\python.exe"
}
```

### 2. Configure Robot Framework Path

If Robot Framework executable is not in PATH:

1. Open Settings
2. Search for "robotframework robot"
3. Set `robotframework.robot.executable` to robot path

Example:
```json
{
  "robotframework.robot.executable": "C:\\Python39\\Scripts\\robot.exe"
}
```

### 3. Enable/Configure Features

#### Language Server
```json
{
  "robotframework.language.server.enabled": true,
  "robotframework.language.server.trace": "off"
}
```

#### Diagnostics
```json
{
  "robotframework.diagnostics.enabled": true,
  "robotframework.diagnostics.level": "warning"
}
```

#### Formatting
```json
{
  "robotframework.formatting.enabled": true,
  "robotframework.formatting.lineLength": 120,
  "robotframework.formatting.spaceCount": 4,
  "robotframework.formatting.usePipes": false
}
```

#### Test Execution
```json
{
  "robotframework.execution.showOutputOnRun": true,
  "robotframework.execution.clearOutputBeforeRun": true,
  "robotframework.execution.arguments": ["-d", "results"]
}
```

### 4. Set Up Debug Configuration

Create or update `.vscode/launch.json` in your workspace:

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

## Verification

### 1. Check Extension is Loaded

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Robot Framework"
3. You should see all Robot Framework commands

### 2. Test Syntax Highlighting

1. Create a test file `test.robot`:
```robotframework
*** Test Cases ***
Example Test
    Log    Hello World
```
2. Verify syntax highlighting is active

### 3. Test Code Completion

1. In a .robot file, type `***` and press Space
2. You should see section suggestions

### 4. Test Execution

1. Create a simple test file
2. Press `Ctrl+Shift+R` (or `Cmd+Shift+R`)
3. Check Output panel for execution results

## Troubleshooting

### Extension Not Activating

**Symptoms**: No Robot Framework commands, no syntax highlighting

**Solutions**:
1. Check file extension is `.robot` or `.resource`
2. Reload VS Code: Command Palette → "Reload Window"
3. Check Extensions view for errors
4. Check Output panel → "Robot Framework" for errors

### Language Server Not Working

**Symptoms**: No completions, no diagnostics

**Solutions**:
1. Verify Python is accessible:
   ```bash
   python --version
   ```
2. Restart Language Server:
   - Command Palette → "Robot Framework: Restart Language Server"
3. Check settings for correct Python path
4. Check Output panel for Language Server errors

### Tests Not Running

**Symptoms**: Nothing happens when running tests

**Solutions**:
1. Verify Robot Framework is installed:
   ```bash
   robot --version
   ```
2. Check Python and Robot paths in settings
3. Open workspace folder (not just files)
4. Check Output panel for error messages

### Debug Not Working

**Symptoms**: Debug doesn't start or breakpoints don't work

**Solutions**:
1. Verify `.vscode/launch.json` exists and is configured
2. Check Python and Robot Framework are accessible
3. Try "Robot Framework: Debug Current Test File" command
4. Check Debug Console for errors

### Formatting Not Working

**Symptoms**: Format command has no effect

**Solutions**:
1. Enable formatting in settings:
   ```json
   {"robotframework.formatting.enabled": true}
   ```
2. Ensure file has `.robot` extension
3. Check for syntax errors that might prevent formatting

## Updating the Extension

### From Marketplace
VS Code automatically updates extensions. To manually update:

1. Go to Extensions view
2. Find "Robot Framework Pro"
3. Click "Update" if available

### From VSIX
1. Uninstall current version
2. Install new VSIX following installation steps

## Uninstalling

1. Open Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Find "Robot Framework Pro"
3. Click gear icon → "Uninstall"
4. Reload VS Code

## Additional Resources

- **Documentation**: See [README.md](README.md)
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md)
- **Issues**: https://github.com/your-username/robotframework-pro/issues
- **Robot Framework**: https://robotframework.org
- **VS Code Extensions**: https://code.visualstudio.com/docs/editor/extension-marketplace

## Getting Help

If you encounter issues:

1. Check this installation guide
2. Check [README.md](README.md) troubleshooting section
3. Search existing issues on GitHub
4. Create a new issue with:
   - VS Code version
   - Extension version
   - Python version
   - Robot Framework version
   - Error messages from Output panel
   - Steps to reproduce

## Next Steps

After installation:

1. Read the [README.md](README.md) for feature overview
2. Try the Quick Start examples
3. Explore code snippets (type `test`, `keyword`, `for`, etc.)
4. Configure keyboard shortcuts to your preference
5. Try the Material themes: Command Palette → "Color Theme" → "Robot Framework Material Dark/Light"

Enjoy using Robot Framework Pro!
