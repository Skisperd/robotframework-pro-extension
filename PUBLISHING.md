# Publishing Guide

This guide explains how to publish the Robot Framework Pro extension to the Visual Studio Code Marketplace.

## Prerequisites

### 1. Visual Studio Code Account
- Create a Microsoft account if you don't have one
- Visit https://marketplace.visualstudio.com/
- Sign in with your Microsoft account

### 2. Azure DevOps Organization
1. Go to https://dev.azure.com/
2. Sign in with the same Microsoft account
3. Create a new organization (e.g., "yourname-extensions")

### 3. Personal Access Token (PAT)
1. In Azure DevOps, click on User Settings (top right)
2. Select "Personal Access Tokens"
3. Click "New Token"
4. Set the following:
   - Name: "VSCode Marketplace"
   - Organization: Select your organization
   - Expiration: Custom (1 year recommended)
   - Scopes: Select "Marketplace" → "Manage"
5. Click "Create"
6. **IMPORTANT**: Copy the token immediately (you won't see it again)

### 4. Create Publisher
1. Visit https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Click "Create publisher"
4. Fill in:
   - Publisher ID: `your-publisher-name` (lowercase, no spaces)
   - Display Name: "Your Name" or "Your Company"
   - Description: Brief description of your extensions
5. Click "Create"

### 5. Install VSCE
```bash
npm install -g @vscode/vsce
```

## Preparation

### 1. Update package.json

Ensure these fields are set correctly:

```json
{
  "name": "robotframework-pro",
  "displayName": "Robot Framework Pro",
  "description": "Complete Robot Framework extension with debugging, code analysis, formatting, execution and Material theme",
  "version": "1.0.0",
  "publisher": "your-publisher-name",
  "author": {
    "name": "Your Name"
  },
  "license": "MIT",
  "icon": "resources/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/robotframework-pro"
  },
  "bugs": {
    "url": "https://github.com/your-username/robotframework-pro/issues"
  },
  "homepage": "https://github.com/your-username/robotframework-pro#readme"
}
```

### 2. Create Icon
- Create a 128x128 PNG image
- Save as `resources/icon.png`
- Icon should be clear and recognizable
- Avoid text in icon (it will be scaled down)

### 3. Update README.md
- Include screenshots
- Clear feature descriptions
- Installation instructions
- Usage examples
- Configuration guide

### 4. Update CHANGELOG.md
- Document all features in version 1.0.0
- Use semantic versioning
- Include release date

### 5. Test Thoroughly
```bash
# Install dependencies
npm install

# Compile
npm run compile

# Lint
npm run lint

# Test in development
# Press F5 in VS Code to launch Extension Development Host
```

## Building the Extension

### Create VSIX Package

```bash
# Build the package
vsce package

# This creates: robotframework-pro-1.0.0.vsix
```

### Test VSIX Package

1. Install the VSIX locally:
   ```bash
   code --install-extension robotframework-pro-1.0.0.vsix
   ```

2. Test all features:
   - Syntax highlighting
   - Code completion
   - Diagnostics
   - Formatting
   - Test execution
   - Debugging
   - Themes

3. Uninstall test version:
   - Extensions view → Uninstall

## Publishing

### Method 1: Using VSCE (Recommended)

```bash
# Login to publisher account
vsce login your-publisher-name
# Enter your Personal Access Token when prompted

# Publish
vsce publish

# Or publish with specific version
vsce publish 1.0.0

# Or publish patch/minor/major version
vsce publish patch
vsce publish minor
vsce publish major
```

### Method 2: Manual Upload

1. Package the extension:
   ```bash
   vsce package
   ```

2. Go to https://marketplace.visualstudio.com/manage/publishers/your-publisher-name

3. Click "New extension" → "Visual Studio Code"

4. Drag and drop the `.vsix` file

5. Click "Upload"

## Post-Publishing

### 1. Verify Publication
1. Visit https://marketplace.visualstudio.com/items?itemName=your-publisher-name.robotframework-pro
2. Check all information displays correctly
3. Test installation from marketplace

### 2. Update Repository
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. Create GitHub Release
1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag: `v1.0.0`
4. Title: `Robot Framework Pro v1.0.0`
5. Description: Copy from CHANGELOG.md
6. Attach the `.vsix` file
7. Click "Publish release"

### 4. Announce
- Share on social media
- Post in Robot Framework community forums
- Update your website/portfolio

## Updating the Extension

### 1. Make Changes
- Update code
- Update tests
- Update documentation

### 2. Update Version
In `package.json`:
```json
{
  "version": "1.1.0"
}
```

### 3. Update CHANGELOG.md
```markdown
## [1.1.0] - 2024-XX-XX
### Added
- New feature description

### Fixed
- Bug fix description

### Changed
- Change description
```

### 4. Publish Update
```bash
# Publish with automatic version bump
vsce publish minor  # 1.0.0 → 1.1.0
# or
vsce publish patch  # 1.0.0 → 1.0.1
# or
vsce publish major  # 1.0.0 → 2.0.0

# Or specify version explicitly
vsce publish 1.1.0
```

### 5. Tag Release
```bash
git tag v1.1.0
git push origin v1.1.0
```

## Versioning Guidelines

Follow Semantic Versioning (semver.org):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
  - Removed features
  - Changed APIs
  - Incompatible changes

- **MINOR** (1.0.0 → 1.1.0): New features
  - New functionality
  - New settings
  - Backward compatible additions

- **PATCH** (1.0.0 → 1.0.1): Bug fixes
  - Bug fixes
  - Performance improvements
  - Documentation updates

## Unpublishing

**Warning**: Only unpublish if absolutely necessary.

```bash
vsce unpublish your-publisher-name.robotframework-pro
```

Or specific version:
```bash
vsce unpublish your-publisher-name.robotframework-pro@1.0.0
```

## Best Practices

### Before Publishing
- [ ] All features work correctly
- [ ] No console errors
- [ ] README is comprehensive
- [ ] CHANGELOG is updated
- [ ] Version number is correct
- [ ] Icon is proper size and format
- [ ] Repository URL is correct
- [ ] License is included
- [ ] Screenshots are included in README
- [ ] Keywords are relevant
- [ ] Categories are appropriate

### Maintenance
- Respond to issues promptly
- Release updates regularly
- Keep dependencies updated
- Monitor marketplace ratings
- Engage with users

### Marketing
- Good README with screenshots
- Clear feature descriptions
- Video demo (optional but recommended)
- Blog post announcement
- Social media sharing
- Community engagement

## Common Issues

### "Publisher not found"
- Ensure publisher is created at marketplace.visualstudio.com
- Use correct publisher ID in package.json
- Login with correct account

### "Icon not found"
- Check path in package.json
- Ensure icon exists at that path
- Icon must be PNG format, 128x128

### "Repository not found"
- Ensure repository is public
- Check URL in package.json
- Push code to repository before publishing

### "Version already exists"
- Increment version number
- Each publish must have unique version
- Cannot republish same version

## Resources

- **VSCE Documentation**: https://github.com/microsoft/vscode-vsce
- **Publishing Extensions**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Marketplace**: https://marketplace.visualstudio.com/
- **Extension Guidelines**: https://code.visualstudio.com/api/references/extension-guidelines
- **Marketplace Publisher**: https://marketplace.visualstudio.com/manage

## Support

For publishing issues:
- VSCE GitHub: https://github.com/microsoft/vscode-vsce/issues
- VS Code Discussions: https://github.com/microsoft/vscode-discussions

## Checklist

Before first publish:
- [ ] Created Microsoft account
- [ ] Created Azure DevOps organization
- [ ] Generated Personal Access Token
- [ ] Created publisher on marketplace
- [ ] Installed VSCE globally
- [ ] Updated package.json with correct publisher
- [ ] Created icon.png (128x128)
- [ ] Added screenshots to README
- [ ] Updated all URLs in package.json
- [ ] Tested extension thoroughly
- [ ] Built VSIX and tested locally
- [ ] Updated CHANGELOG
- [ ] Committed all changes
- [ ] Tagged release

Ready to publish! 🚀

```bash
vsce login your-publisher-name
vsce publish
```
