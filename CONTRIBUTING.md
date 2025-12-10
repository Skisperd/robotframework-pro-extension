# Contributing to Robot Framework Pro

Thank you for your interest in contributing to Robot Framework Pro! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive criticism
- Assume good intentions

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check existing issues to avoid duplicates
2. Try the latest version
3. Gather relevant information

Create a bug report with:
- **Clear title**: Brief description of the issue
- **Description**: Detailed explanation
- **Steps to reproduce**: Exact steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**:
  - VS Code version
  - Extension version
  - Python version
  - Robot Framework version
  - Operating system
- **Screenshots**: If applicable
- **Logs**: From Output panel (Robot Framework channel)

### Suggesting Features

Feature requests should include:
- **Clear title**: Brief description
- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Examples**: Similar features in other tools

### Pull Requests

#### Before Starting
1. Check existing issues and PRs
2. Discuss major changes in an issue first
3. Ensure you can build and test locally

#### Process
1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/robotframework-pro.git
   cd robotframework-pro
   ```
3. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Make changes**:
   - Write clean, readable code
   - Follow existing code style
   - Add comments where needed
   - Update documentation
6. **Test**:
   - Compile: `npm run compile`
   - Lint: `npm run lint`
   - Test manually (press F5)
7. **Commit**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve bug"
   ```
8. **Push**:
   ```bash
   git push origin feature/your-feature-name
   ```
9. **Create Pull Request**:
   - Go to GitHub
   - Click "New Pull Request"
   - Fill in template
   - Link related issues

#### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Formatting, missing semicolons, etc.
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add keyword hover information
fix: resolve formatting issue with pipes
docs: update installation guide
refactor: improve parser performance
```

#### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #issue-number

## Testing
Describe testing done

## Checklist
- [ ] Code compiles without errors
- [ ] No linting errors
- [ ] Tested manually
- [ ] Updated documentation
- [ ] Updated CHANGELOG.md
```

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- VS Code
- Git
- Python 3.8+
- Robot Framework

### Setup Steps

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-username/robotframework-pro.git
   cd robotframework-pro
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Open in VS Code**:
   ```bash
   code .
   ```

4. **Build**:
   ```bash
   npm run compile
   ```

5. **Run extension**:
   - Press F5
   - Or: Run → Start Debugging

### Project Structure

```
robotframework-pro/
├── .vscode/              # VS Code config
│   ├── launch.json       # Debug configurations
│   ├── tasks.json        # Build tasks
│   └── settings.json     # Workspace settings
├── examples/             # Example Robot files
├── resources/            # Icons and assets
├── src/                  # Source code
│   ├── extension.ts      # Main entry point
│   ├── debugAdapter/     # Debug adapter
│   ├── languageServer/   # Language server
│   └── testRunner/       # Test execution
├── syntaxes/             # Syntax highlighting
├── themes/               # Color themes
├── snippets/             # Code snippets
├── out/                  # Compiled output
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
└── README.md             # Documentation
```

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on save)
npm run watch

# Lint
npm run lint

# Package extension
npm run package
```

### Testing

#### Manual Testing
1. Press F5 to launch Extension Development Host
2. Open a .robot file
3. Test features:
   - Syntax highlighting
   - Code completion
   - Diagnostics
   - Formatting
   - Test execution
   - Debugging
   - Themes

#### Test Checklist
- [ ] Syntax highlighting works
- [ ] Code completion appears
- [ ] Diagnostics show errors
- [ ] Formatting works (Ctrl+Shift+F)
- [ ] Run test works (Ctrl+Shift+R)
- [ ] Debug starts and stops
- [ ] Themes apply correctly
- [ ] Snippets insert correctly
- [ ] Commands appear in palette
- [ ] Settings work

### Debugging

#### Debug Extension
1. Open source in VS Code
2. Press F5
3. Set breakpoints in .ts files
4. Trigger feature in Extension Host

#### Debug Language Server
1. Start extension (F5)
2. In original VS Code: Run → "Debug Server"
3. Attach to language server
4. Set breakpoints in languageServer/

#### View Logs
- Output Panel → "Robot Framework"
- Developer Tools (Help → Toggle Developer Tools)

## Code Guidelines

### TypeScript

```typescript
// Use clear, descriptive names
function parseRobotFile(content: string): ParseResult {
    // Implementation
}

// Use interfaces for structure
interface TestCase {
    name: string;
    line: number;
    tags: string[];
}

// Use async/await for async operations
async function runTest(file: string): Promise<void> {
    await executeRobot(file);
}

// Handle errors properly
try {
    await operation();
} catch (error) {
    vscode.window.showErrorMessage(`Error: ${error}`);
}
```

### Code Style
- Use 4 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Max line length: 120 characters
- Use meaningful variable names
- Add comments for complex logic
- Follow existing patterns

### VS Code API
- Use appropriate VS Code APIs
- Register disposables properly
- Handle errors gracefully
- Provide user feedback
- Use output channel for logging

## Documentation

### Code Documentation
```typescript
/**
 * Parses a Robot Framework file
 * @param content File content to parse
 * @returns Parsed structure with sections, keywords, etc.
 */
function parse(content: string): ParseResult {
    // Implementation
}
```

### User Documentation
- Update README.md for user-facing changes
- Update CHANGELOG.md for all changes
- Add examples for new features
- Update configuration docs

## Release Process

Maintainers only:

1. Update version in package.json
2. Update CHANGELOG.md
3. Commit: `chore: release v1.x.x`
4. Tag: `git tag v1.x.x`
5. Push: `git push && git push --tags`
6. Publish: `vsce publish`
7. Create GitHub release

## Getting Help

- **Documentation**: Read README.md and other .md files
- **Issues**: Search existing issues
- **Discussions**: Ask in GitHub Discussions
- **Code**: Read existing code for patterns

## Areas for Contribution

Good first issues:
- Documentation improvements
- Additional snippets
- Theme tweaks
- Bug fixes

More advanced:
- Language server enhancements
- Parser improvements
- New diagnostics
- Advanced formatting

## Recognition

Contributors will be:
- Listed in CHANGELOG.md
- Mentioned in release notes
- Credited in repository

## Questions?

Feel free to ask questions in:
- GitHub Issues (for bugs/features)
- GitHub Discussions (for questions)
- Pull Request comments (for code questions)

Thank you for contributing! 🎉
