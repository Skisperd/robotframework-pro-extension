# Build Instructions

Complete instructions for building and packaging the Robot Framework Pro extension.

## Prerequisites

Ensure you have:
- Node.js 18+ installed
- npm (comes with Node.js)
- Git
- Python 3.8+
- Robot Framework installed

## Quick Build

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

This creates `robotframework-pro-1.0.0.vsix`.

## Detailed Build Steps

### 1. Clone Repository

```bash
git clone https://github.com/your-username/robotframework-pro.git
cd robotframework-pro
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- TypeScript compiler
- VS Code extension dependencies
- Language server packages
- Debug adapter packages
- Development tools

### 3. Compile TypeScript

```bash
npm run compile
```

Output goes to `out/` directory:
```
out/
├── extension.js
├── languageServer/
│   ├── server.js
│   ├── parser.js
│   ├── formatter.js
│   └── diagnostics.js
├── debugAdapter/
│   ├── debugAdapter.js
│   └── debugConfigProvider.js
└── testRunner/
    └── testRunner.js
```

### 4. Verify Build

```bash
# Check for TypeScript errors
npm run compile

# Check for lint errors
npm run lint

# Should see no errors
```

### 5. Test Locally

Option A - Launch from VS Code:
1. Open project in VS Code
2. Press F5
3. Extension Development Host opens
4. Test features

Option B - Install VSIX:
1. Package: `npm run package`
2. Install: `code --install-extension robotframework-pro-1.0.0.vsix`
3. Reload VS Code
4. Test features

### 6. Package for Distribution

```bash
npm run package
```

Creates `robotframework-pro-1.0.0.vsix` ready for:
- Local installation
- Publishing to marketplace
- Distribution to users

## Build Scripts

All scripts defined in `package.json`:

### Compile
```bash
npm run compile
```
- Runs TypeScript compiler
- Outputs to `out/`
- Shows compilation errors

### Watch
```bash
npm run watch
```
- Runs TypeScript compiler in watch mode
- Auto-recompiles on file changes
- Use during development

### Lint
```bash
npm run lint
```
- Runs ESLint on TypeScript files
- Shows code quality issues
- Enforces code style

### Clean Build
```bash
# Manual clean
rm -rf out/
npm run compile
```

### Package
```bash
npm run package
```
- Runs `vsce package`
- Creates `.vsix` file
- Validates package contents

### Publish
```bash
npm run publish
```
- Publishes to VS Code Marketplace
- Requires authentication
- See PUBLISHING.md for details

## Build Artifacts

After building:

```
robotframework-pro/
├── out/                  # Compiled JavaScript
│   ├── extension.js
│   ├── languageServer/
│   ├── debugAdapter/
│   └── testRunner/
├── node_modules/         # Dependencies
└── *.vsix               # Package (after npm run package)
```

## Troubleshooting Build Issues

### TypeScript Compilation Errors

**Error**: Cannot find module 'vscode'
```bash
npm install --save-dev @types/vscode
```

**Error**: Property X does not exist
- Check VS Code API version in package.json
- Verify @types/vscode version matches

### Package Issues

**Error**: Publisher not found
- Create publisher at marketplace.visualstudio.com
- Update publisher in package.json

**Error**: Icon not found
- Ensure `resources/icon.png` exists
- Must be 128x128 PNG
- Check path in package.json

**Error**: README validation failed
- Ensure README.md exists
- Check markdown syntax
- Include required sections

### Dependency Issues

**Error**: npm install fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error**: Version conflicts
```bash
# Update package-lock.json
npm update
```

## Build Optimization

### Minimize Package Size

What's included in VSIX:
- All files except those in `.vscodeignore`
- `out/` directory (compiled code)
- `resources/` (icons, assets)
- `syntaxes/`, `themes/`, `snippets/`
- `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`

What's excluded (via `.vscodeignore`):
- `src/` (TypeScript source)
- `node_modules/` (dependencies bundled separately)
- `.vscode/`, `.vscode-test/`
- Development files

### Bundle with webpack (Optional)

For smaller package size, can use webpack:

1. Install webpack:
```bash
npm install --save-dev webpack webpack-cli ts-loader
```

2. Create `webpack.config.js`:
```javascript
const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: 'ts-loader'
    }]
  }
};
```

3. Update scripts:
```json
{
  "compile": "webpack --mode production",
  "watch": "webpack --mode development --watch"
}
```

## CI/CD Build

### GitHub Actions

Create `.github/workflows/build.yml`:

```yaml
name: Build

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Compile
      run: npm run compile

    - name: Lint
      run: npm run lint

    - name: Package
      run: npm run package

    - name: Upload VSIX
      uses: actions/upload-artifact@v3
      with:
        name: extension
        path: '*.vsix'
```

### Automated Publishing

```yaml
name: Publish

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Publish to Marketplace
      run: npm run publish
      env:
        VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

## Version Management

### Update Version

1. Update `package.json`:
```json
{
  "version": "1.1.0"
}
```

2. Update `CHANGELOG.md`:
```markdown
## [1.1.0] - 2024-XX-XX
### Added
- New feature
```

3. Commit and tag:
```bash
git commit -am "chore: bump version to 1.1.0"
git tag v1.1.0
git push && git push --tags
```

### Automated Versioning

```bash
# Patch: 1.0.0 → 1.0.1
npm version patch

# Minor: 1.0.0 → 1.1.0
npm version minor

# Major: 1.0.0 → 2.0.0
npm version major
```

## Build Checklist

Before building for release:

- [ ] All TypeScript compiles without errors
- [ ] No lint warnings
- [ ] Tested locally (F5)
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Icon exists (resources/icon.png)
- [ ] All required files included
- [ ] No debug/console.log statements
- [ ] License file exists
- [ ] Repository URL correct

Build and verify:

- [ ] Package builds successfully
- [ ] VSIX file created
- [ ] Install VSIX locally and test
- [ ] All features work
- [ ] No errors in Output panel
- [ ] Extension activates correctly
- [ ] Themes work
- [ ] Commands work

## Release Process

1. **Build**:
   ```bash
   npm install
   npm run compile
   npm run lint
   npm run package
   ```

2. **Test VSIX**:
   ```bash
   code --install-extension robotframework-pro-1.0.0.vsix
   ```

3. **Publish**:
   ```bash
   npm run publish
   # or
   vsce publish
   ```

4. **Tag Release**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

5. **Create GitHub Release**:
   - Attach VSIX file
   - Copy CHANGELOG entry
   - Publish release

## Support

For build issues:
- Check this guide
- Read DEVELOPMENT.md
- Check GitHub issues
- Create new issue with build error details

## Resources

- **VSCE**: https://github.com/microsoft/vscode-vsce
- **Extension Publishing**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/intro.html

Happy building! 🏗️
