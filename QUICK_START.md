# Quick Start Guide

Get started with Robot Framework Pro in 5 minutes!

## Step 1: Install Prerequisites

### Install Python (if not installed)
1. Download from https://python.org/downloads/
2. Run installer, check "Add Python to PATH"
3. Verify: Open terminal and run:
   ```bash
   python --version
   ```

### Install Robot Framework
```bash
pip install robotframework
```

Verify installation:
```bash
robot --version
```

### Install Material Icon Theme (Recomendado)

Para uma experiência visual profissional:
```bash
code --install-extension PKief.material-icon-theme
```

Depois ative:
1. `Ctrl+Shift+P` → `Preferences: File Icon Theme`
2. Selecione: **Material Icon Theme**

## Step 2: Build the Extension

### Option A: From Source (Development)

```bash
# Navigate to the extension directory
cd D:\development\extensao

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Test in VS Code
code .
# Press F5 to launch Extension Development Host
```

### Option B: Package and Install

```bash
# Build VSIX package
npm run package

# Install in VS Code
code --install-extension robotframework-pro-1.0.0.vsix
```

## Step 3: Verify Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Robot Framework Pro" (if installed from package)
4. Verify it's enabled

## Step 4: Test the Extension

### Test with Example File

1. Open the examples folder in VS Code:
   ```bash
   code D:\development\extensao\examples
   ```

2. Open `example.robot`

3. You should see:
   - ✅ Syntax highlighting
   - ✅ Colored keywords and variables
   - ✅ Section headers highlighted

### Test Code Completion

1. In `example.robot`, go to the end
2. Type: `***` and press Space
3. You should see suggestions for sections
4. Type: `FOR` and press Space
5. You should see FOR loop completion

### Test Running Tests

1. Open `example.robot`
2. Press `Ctrl+Shift+R` (or Cmd+Shift+R on Mac)
3. Output panel should open
4. Tests should execute
5. Results shown in output

### Test Debugging

1. Open `example.robot`
2. Click in gutter to set breakpoint (red dot appears)
3. Press `F5` to start debugging
4. Debug toolbar should appear
5. Test execution starts

### Test Formatting

1. In `example.robot`, mess up the indentation
2. Press `Ctrl+Shift+F` (or Cmd+Shift+F on Mac)
3. Code should format nicely

### Test Themes

1. Press `Ctrl+K Ctrl+T` (or Cmd+K Cmd+T on Mac)
2. Search for "Robot Framework Material"
3. Try:
   - Robot Framework Material Dark
   - Robot Framework Material Light

## Step 5: Configure for Your Project

### Set Python Path (if needed)

1. Open Settings (Ctrl+,)
2. Search: "robotframework python"
3. Set: "Robotframework: Python Executable"
4. Example: `C:\Python39\python.exe`

### Add to Your Project

Create `.vscode/settings.json` in your Robot Framework project:

```json
{
  "robotframework.python.executable": "python",
  "robotframework.robot.executable": "robot",
  "robotframework.formatting.enabled": true,
  "robotframework.diagnostics.enabled": true,
  "robotframework.execution.showOutputOnRun": true
}
```

### Create Debug Configuration

Create `.vscode/launch.json`:

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
      "stopOnEntry": false
    }
  ]
}
```

## Common Tasks

### Create New Test File

1. Create file: `my_test.robot`
2. Type: `testcases` and press Tab
3. Template appears!
4. Fill in your test

### Run Specific Test

1. Open test file
2. Right-click in editor
3. Select "Run Robot Framework Test"

### View Test Results

After running tests:
- Check Output panel: "Robot Framework"
- Open `report.html` in browser
- Open `log.html` for detailed log

### Use Snippets

Type these prefixes and press Tab:
- `test` → Test case template
- `keyword` → Keyword template
- `for` → FOR loop
- `if` → IF statement
- `try` → TRY-EXCEPT block
- `log` → Log statement
- `shouldbe` → Should Be Equal

## Troubleshooting

### Extension doesn't activate

**Problem**: No syntax highlighting, no commands

**Solution**:
1. Check file extension is `.robot`
2. Reload window: Command Palette → "Reload Window"
3. Check for errors: Help → Toggle Developer Tools

### Tests won't run

**Problem**: Nothing happens when running tests

**Solution**:
1. Verify Robot Framework: `robot --version`
2. Check Python path in settings
3. Open Output panel, check for errors
4. Ensure workspace folder is open

### No code completion

**Problem**: No suggestions when typing

**Solution**:
1. Check Output → "Robot Framework" for errors
2. Restart Language Server: Command Palette → "Robot Framework: Restart Language Server"
3. Verify Python is accessible
4. Check language-server.enabled in settings

### Debugging doesn't work

**Problem**: Debug won't start

**Solution**:
1. Create `.vscode/launch.json` (see above)
2. Verify Python and Robot Framework installed
3. Check Debug Console for errors

## Next Steps

Now that everything works:

1. **Read the full README**: `README.md`
   - Detailed feature descriptions
   - All keyboard shortcuts
   - Advanced configuration

2. **Explore Examples**: `examples/example.robot`
   - Complete test examples
   - All Robot Framework features
   - Best practices

3. **Try Advanced Features**:
   - Set breakpoints and debug
   - Use snippets (type `for`, `if`, etc.)
   - Format code (Ctrl+Shift+F)
   - Try both themes

4. **Configure for Your Workflow**:
   - Customize keyboard shortcuts
   - Adjust formatting options
   - Set execution arguments
   - Configure diagnostics level

5. **Publish to Marketplace** (Optional):
   - See `PUBLISHING.md`
   - Create publisher account
   - Generate access token
   - Publish extension

## Getting Help

- **Documentation**: All .md files in project
- **Examples**: `examples/` folder
- **Issues**: Create issue on GitHub
- **Robot Framework**: https://robotframework.org

## Keyboard Shortcuts Reference

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Run Test | Ctrl+Shift+R | Cmd+Shift+R |
| Debug Test | Ctrl+Shift+D | Cmd+Shift+D |
| Format Code | Ctrl+Shift+F | Cmd+Shift+F |
| Command Palette | Ctrl+Shift+P | Cmd+Shift+P |
| Change Theme | Ctrl+K Ctrl+T | Cmd+K Cmd+T |
| Show Output | Ctrl+Shift+U | Cmd+Shift+U |

## Useful Commands

Access via Command Palette (Ctrl+Shift+P):

- `Robot Framework: Run Current Test File`
- `Robot Framework: Debug Current Test File`
- `Robot Framework: Format Robot Framework File`
- `Robot Framework: Restart Language Server`
- `Robot Framework: Show Output`

## You're Ready! 🚀

You now have a complete Robot Framework development environment with:
- ✅ Syntax highlighting
- ✅ Code completion
- ✅ Real-time diagnostics
- ✅ Code formatting
- ✅ Test execution
- ✅ Debugging support
- ✅ Beautiful themes
- ✅ Helpful snippets

Start writing tests and enjoy your enhanced Robot Framework experience!

For more information, see:
- `README.md` - Complete documentation
- `DEVELOPMENT.md` - Development guide
- `INSTALLATION.md` - Detailed installation
- `PUBLISHING.md` - Publishing guide
