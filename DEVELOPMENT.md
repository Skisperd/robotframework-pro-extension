# Development Guide

Complete guide for developing the Robot Framework Pro extension.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/your-username/robotframework-pro.git
cd robotframework-pro
npm install

# Open in VS Code
code .

# Build and run
npm run compile
# Press F5 to launch Extension Development Host
```

## Environment Setup

### Required Tools
- **Node.js**: 18+ (https://nodejs.org/)
- **npm**: Comes with Node.js
- **VS Code**: Latest version (https://code.visualstudio.com/)
- **Git**: For version control
- **Python**: 3.8+ (for testing Robot Framework features)
- **Robot Framework**: `pip install robotframework`

### Optional Tools
- **TypeScript**: Global install `npm install -g typescript`
- **VSCE**: For packaging `npm install -g @vscode/vsce`
- **ESLint**: VS Code extension for linting

### IDE Setup

1. **Install VS Code Extensions**:
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features

2. **Workspace Settings**:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "typescript.tsdk": "./node_modules/typescript/lib"
   }
   ```

## Project Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────┐
│          VS Code Extension Host             │
├─────────────────────────────────────────────┤
│  extension.ts (Main Extension)              │
│  ├─ Language Client                         │
│  ├─ Debug Configuration Provider            │
│  ├─ Test Runner                             │
│  └─ Commands & UI                           │
├─────────────────────────────────────────────┤
│  Language Server (Separate Process)         │
│  ├─ Parser                                  │
│  ├─ Diagnostics Provider                    │
│  ├─ Completion Provider                     │
│  └─ Formatter                               │
├─────────────────────────────────────────────┤
│  Debug Adapter (Separate Process)           │
│  └─ Robot Framework Debug Session           │
└─────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── extension.ts              # Entry point, activates extension
├── languageServer/
│   ├── server.ts            # Language server main
│   ├── parser.ts            # Parses .robot files
│   ├── formatter.ts         # Formats code
│   └── diagnostics.ts       # Provides diagnostics
├── debugAdapter/
│   ├── debugAdapter.ts      # Debug adapter implementation
│   └── debugConfigProvider.ts  # Debug configuration
└── testRunner/
    └── testRunner.ts        # Executes Robot tests
```

### Component Interaction

1. **Extension Activation**:
   - User opens .robot file
   - VS Code activates extension
   - extension.ts runs activate()
   - Language server starts
   - Commands register

2. **Language Features**:
   - User types in editor
   - Changes sent to language server
   - Server parses and analyzes
   - Results sent back (completions, diagnostics)
   - VS Code displays results

3. **Test Execution**:
   - User runs command (Ctrl+Shift+R)
   - TestRunner spawns robot process
   - Output captured and displayed
   - Results shown in status bar

4. **Debugging**:
   - User starts debug (F5)
   - Debug adapter spawns
   - Communicates with VS Code via DAP
   - Controls Robot Framework execution

## Development Workflow

### Daily Development

1. **Start watching**:
   ```bash
   npm run watch
   ```

2. **Launch extension** (F5):
   - Opens Extension Development Host
   - Extension loaded and active

3. **Make changes**:
   - Edit TypeScript files
   - Watch automatically recompiles
   - Reload window (Ctrl+R in Extension Host)

4. **Test changes**:
   - Create/open .robot file
   - Test feature
   - Check Output panel for logs

### Building

```bash
# One-time compile
npm run compile

# Watch mode (recommended during development)
npm run watch

# Clean build
rm -rf out/
npm run compile
```

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npx eslint src --ext ts --fix
```

### Packaging

```bash
# Create VSIX package
npm run package

# Creates: robotframework-pro-1.0.0.vsix
```

## Testing

### Manual Testing Procedure

1. **Launch Extension Host** (F5)

2. **Test Syntax Highlighting**:
   - Open examples/example.robot
   - Verify colors match theme
   - Check all sections highlighted

3. **Test Code Completion**:
   - Type `***` + space
   - Should show section completions
   - Type `FOR` + space
   - Should show FOR completion

4. **Test Diagnostics**:
   - Create duplicate test case
   - Should show error
   - Fix it, error should disappear

5. **Test Formatting**:
   - Unformat a file
   - Ctrl+Shift+F
   - Should format nicely

6. **Test Execution**:
   - Ctrl+Shift+R on example.robot
   - Should run tests
   - Check output panel

7. **Test Debugging**:
   - Set breakpoint
   - F5 to debug
   - Should stop at breakpoint

8. **Test Themes**:
   - Change to Material Dark
   - Verify colors
   - Change to Material Light
   - Verify colors

### Automated Testing (Future)

```typescript
// test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('your-publisher.robotframework-pro');
        assert.ok(ext);
        await ext?.activate();
        assert.ok(ext?.isActive);
    });
});
```

## Debugging

### Debug Extension Code

1. Set breakpoints in .ts files
2. Press F5
3. Trigger feature in Extension Host
4. Execution stops at breakpoint

### Debug Language Server

1. Launch extension (F5)
2. Start "Debug Server" configuration
3. Set breakpoints in languageServer/*.ts
4. Trigger language feature
5. Execution stops at breakpoint

### Debug Output

```typescript
// In extension code
const outputChannel = vscode.window.createOutputChannel('Robot Framework');
outputChannel.appendLine('Debug message');
outputChannel.show();

// In language server
connection.console.log('Server debug message');
```

### Common Issues

**Extension doesn't activate**:
- Check activationEvents in package.json
- Check for errors in Developer Tools (Help → Toggle Developer Tools)

**Language server not working**:
- Check Output → Robot Framework for errors
- Verify server.ts compiles without errors
- Check serverOptions in extension.ts

**Changes not appearing**:
- Reload window (Ctrl+R in Extension Host)
- Check if watch is running
- Check for compile errors

## Adding Features

### Add New Command

1. **package.json**:
```json
{
  "contributes": {
    "commands": [{
      "command": "robotframework.myCommand",
      "title": "My Command",
      "category": "Robot Framework"
    }]
  }
}
```

2. **extension.ts**:
```typescript
context.subscriptions.push(
    vscode.commands.registerCommand('robotframework.myCommand', async () => {
        vscode.window.showInformationMessage('My Command executed!');
    })
);
```

### Add New Diagnostic

**diagnostics.ts**:
```typescript
// In validate() method
for (const testCase of parseResult.testCases) {
    if (testCase.name.includes('TODO')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Information,
            range: this.getLineRange(document, testCase.line),
            message: 'Test case marked as TODO',
            source: 'robotframework'
        });
    }
}
```

### Add New Completion

**server.ts**:
```typescript
// In onCompletion handler
{
    label: 'My Keyword',
    kind: CompletionItemKind.Function,
    detail: 'My custom keyword',
    documentation: 'Does something useful'
}
```

### Add New Snippet

**snippets/robotframework.json**:
```json
{
  "My Snippet": {
    "prefix": "mysnip",
    "body": [
      "${1:Name}",
      "    [Documentation]    ${2:Description}",
      "    ${3:Log}    ${4:Message}"
    ],
    "description": "My custom snippet"
  }
}
```

### Add Configuration

1. **package.json**:
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "robotframework.myFeature.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable my feature"
        }
      }
    }
  }
}
```

2. **Use in code**:
```typescript
const config = vscode.workspace.getConfiguration('robotframework');
const enabled = config.get<boolean>('myFeature.enabled', true);
```

## Performance Optimization

### Language Server Performance
- Use incremental parsing
- Cache parse results
- Debounce diagnostics
- Limit completion items

### Extension Performance
- Lazy load heavy dependencies
- Use async/await properly
- Dispose resources properly
- Minimize main thread work

## Troubleshooting Development Issues

### TypeScript Errors

```bash
# Clear and rebuild
rm -rf out/
npm run compile
```

### Extension Not Loading

Check Output panel:
- "Log (Extension Host)"
- Look for activation errors

### Breakpoints Not Working

- Ensure sourceMaps: true in tsconfig.json
- Check outFiles in launch.json
- Reload window after changes

### Language Server Not Starting

Check extension.ts:
- Verify serverModule path
- Check serverOptions configuration
- Look for errors in Output → Robot Framework

## Resources

### VS Code Extension API
- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/references/vscode-api

### Language Server Protocol
- https://microsoft.github.io/language-server-protocol/
- https://github.com/microsoft/vscode-languageserver-node

### Debug Adapter Protocol
- https://microsoft.github.io/debug-adapter-protocol/
- https://github.com/microsoft/vscode-debugadapter-node

### Robot Framework
- https://robotframework.org/
- https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html

## Getting Help

- **VS Code Extension Samples**: https://github.com/microsoft/vscode-extension-samples
- **VS Code Discussions**: https://github.com/microsoft/vscode-discussions
- **Stack Overflow**: Tag with `vscode-extensions`

## Next Steps

1. Explore the codebase
2. Try adding a simple feature
3. Read VS Code API documentation
4. Join Robot Framework community
5. Contribute improvements!

Happy coding! 🚀
