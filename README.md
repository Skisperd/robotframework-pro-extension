# Robot Framework Pro

<p align="center">
  <img src="https://raw.githubusercontent.com/Skisperd/robotframework-pro-extension/main/resources/icon.png" alt="Robot Framework Pro" width="128">
</p>

<p align="center">
  <strong>Complete Robot Framework extension for Visual Studio Code</strong><br>
  Debugging • Code Analysis • Test Explorer • Real-time Output • Material Theme
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ConnectionsSystem.robotframework-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/v/ConnectionsSystem.robotframework-pro?style=flat-square" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ConnectionsSystem.robotframework-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/i/ConnectionsSystem.robotframework-pro?style=flat-square" alt="Installs">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ConnectionsSystem.robotframework-pro">
    <img src="https://img.shields.io/visual-studio-marketplace/r/ConnectionsSystem.robotframework-pro?style=flat-square" alt="Rating">
  </a>
</p>

---

## ✨ Features

### 🧪 Test Explorer & Results

Run and debug your Robot Framework tests directly from VS Code's Test Explorer with colored results.

![Test Results](https://raw.githubusercontent.com/Skisperd/robotframework-pro-extension/main/docs/images/test-results.png)

### 🔍 Real-time Debug Output

See each keyword being executed in real-time with colored output in the Debug Console.

![Debug Console](https://raw.githubusercontent.com/Skisperd/robotframework-pro-extension/main/docs/images/debug-console.png)

**Features:**
- 🟢 **PASS** in green
- 🔴 **FAIL** in red with error details
- 🟡 **SETUP/TEARDOWN** in yellow
- 🔵 **FOR/IF/TRY** control structures in cyan
- Smart filtering of internal keywords (Log, Set Variable, etc.)

### 🔄 Control Structures Support

Full support for FOR loops, IF statements, TRY/EXCEPT with real-time iteration display.

![Debug Iteration](https://raw.githubusercontent.com/Skisperd/robotframework-pro-extension/main/docs/images/debug-console-iteration.png)

### 📊 Test Execution Summary

At the end of each test run, see a complete summary with all results and pass/fail counts.

![Test Summary](https://raw.githubusercontent.com/Skisperd/robotframework-pro-extension/main/docs/images/debug-console-results.png)

---

## 🚀 Quick Start

1. Install the extension from the VS Code Marketplace
2. Open a folder containing `.robot` files
3. Open the Test Explorer (beaker icon in the sidebar)
4. Click the play button to run tests!

---

## 📦 Features List

### Test Explorer & Execution
- ✅ Test Explorer with hierarchical test display
- ✅ Run individual tests or entire files
- ✅ Debug mode with real-time keyword output
- ✅ Three run profiles: Run, Debug, Run Verbose
- ✅ Real-time test status (passed/failed)
- ✅ Test execution summary with failure details

### Language Features
- ✅ **Go to Definition (F12)** - Navigate to keyword definitions
- ✅ **Find All References (Shift+F12)** - Find all usages
- ✅ **Hover Documentation** - See documentation on hover
- ✅ **Signature Help (Ctrl+Shift+Space)** - View keyword arguments
- ✅ **Advanced IntelliSense** - Smart code completion
- ✅ **Rename Refactoring (F2)** - Rename across workspace

### Code Quality
- ✅ Complete syntax highlighting
- ✅ Code formatting
- ✅ Real-time error detection
- ✅ Robocop integration for linting
- ✅ Import management

### Reporting
- ✅ View test reports in VS Code
- ✅ View test logs in VS Code
- ✅ Real-time colored output

---

## ⚙️ Requirements

- Visual Studio Code 1.85.0+
- Python 3.8+
- Robot Framework 4.0+ (`pip install robotframework`)

**Optional:**
- Robocop for linting (`pip install robotframework-robocop`)
- Robotidy for formatting (`pip install robotframework-tidy`)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Run current test file |
| `Ctrl+Shift+D` | Debug current test file |
| `F12` | Go to Definition |
| `Shift+F12` | Find All References |
| `F2` | Rename Symbol |
| `Ctrl+Shift+Space` | Signature Help |

---

## 🎨 Themes

Includes beautiful Material themes:
- **Material Dark** - Dark theme for comfortable coding
- **Material Light** - Light theme for bright environments

---

## 📝 Release Notes

### 1.1.2 (Latest)
- 🎨 New extension icon
- 🐛 Fixed extension activation issues

### 1.1.0
- ✨ Real-time keyword execution in Debug Console
- ✨ Colored output (PASS/FAIL/TEST/SUITE)
- ✨ Smart filtering of internal keywords
- ✨ Test execution summary with failure details
- ✨ Three run profiles (Run, Debug, Run Verbose)
- 🐛 Fixed "Suite contains no tests" error

### 1.0.0
- 🎉 Initial release

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Enjoy using Robot Framework Pro!</strong> 🤖
</p>
