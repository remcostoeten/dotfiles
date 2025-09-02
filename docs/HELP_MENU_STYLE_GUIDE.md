# Help Menu Style Guide 🎨

This document defines the consistent styling and color scheme for help menus across all dotfiles scripts.

## Color Scheme

### Primary Colors
- **Cyan (`echo.cyan`)**: Command names, options, arguments
- **Purple (`echo.purple`)**: Section headers, categories
- **Green (`echo.success`)**: Examples with checkmarks, success messages
- **Yellow (`echo.warning`)**: Warnings, notes
- **Red (`echo.error`)**: Errors, problems
- **Blue (`echo.info`)**: Tips, additional information

### Icons and Emojis
- **⚡**: Commands/Actions
- **🔧**: Tools/Scripts
- **📦**: Modules/Packages
- **🔗**: Links/Connections
- **🛠️**: Options/Configuration
- **✨**: Examples/Demonstrations
- **📋**: Lists/Categories
- **📊**: Status/Information
- **🚀**: Quick Actions/Shortcuts
- **💡**: Tips/Information
- **📖**: Documentation/References
- **✓**: Success/Examples
- **⚠**: Warnings
- **✗**: Errors

## Structure Template

```bash
function script_help() { # 🎨 Enhanced help menu
    echo.header "🔧 Script Title"
    echo
    echo.cyan "Usage: script-name <command> [options]"
    echo
    echo.purple "⚡ Commands:"
    echo "  $(echo.cyan 'command1')     Description of command1"
    echo "  $(echo.cyan 'command2')     Description of command2"
    echo "  $(echo.cyan 'help')         Show this help"
    echo
    echo.purple "🛠️ Options:"
    echo "  $(echo.cyan '-h, --help')      Show this help"
    echo "  $(echo.cyan '-v, --verbose')   Verbose output"
    echo "  $(echo.cyan '-q, --quiet')     Quiet mode"
    echo
    echo.purple "✨ Examples:"
    echo.success "  ✓ script-name command1 arg1    # Basic usage"
    echo.success "  ✓ script-name --verbose         # Verbose mode"
    echo.success "  ✓ script-name help              # Show help"
    echo
    echo.info "💡 For more information, see: dotfiles help script-name"
    echo
}
```

## Section Guidelines

### Header
- Use `echo.header` with an appropriate emoji and title
- Keep titles concise but descriptive
- Format: `echo.header "🔧 Tool Name"`

### Usage Line
- Always use cyan for the usage pattern
- Format: `echo.cyan "Usage: command <required> [optional]"`

### Commands Section
- Use purple header with ⚡ emoji: `echo.purple "⚡ Commands:"`
- Wrap command names in `$(echo.cyan 'command')`
- Align descriptions consistently
- Format: `echo "  $(echo.cyan 'command')     Description"`

### Options Section
- Use purple header with 🛠️ emoji: `echo.purple "🛠️ Options:"`
- Wrap options in `$(echo.cyan '-o, --option')`
- Include short and long forms when applicable
- Format: `echo "  $(echo.cyan '-h, --help')      Description"`

### Examples Section
- Use purple header with ✨ emoji: `echo.purple "✨ Examples:"`
- Use `echo.success` with ✓ checkmarks
- Include brief inline comments with #
- Format: `echo.success "  ✓ command example    # What it does"`

### Information/Tips
- Use `echo.info` with 💡 emoji
- Provide helpful context or next steps
- Format: `echo.info "💡 Helpful tip or additional information"`

## Best Practices

### DO ✅
- Use consistent emoji icons for section types
- Align text and descriptions properly
- Include practical, real-world examples
- Use brief, clear descriptions
- End with helpful tips or references
- Include the `# 🎨 Enhanced help menu` comment

### DON'T ❌
- Mix different emoji styles within the same script
- Use overly long descriptions that wrap lines
- Forget to use colors for command names
- Skip examples section
- Use inconsistent spacing or alignment

## Color Function Reference

### Available Functions
```bash
echo.header "Text"     # Blue header with borders
echo.cyan "Text"       # Cyan text
echo.purple "Text"     # Purple text  
echo.success "Text"    # Green text with ✓
echo.warning "Text"    # Yellow text with ⚠
echo.error "Text"      # Red text with ✗
echo.info "Text"       # Blue text with ℹ
echo.debug "Text"      # Purple debug (if DOTFILES_DEBUG=1)
```

### Inline Color Usage
For inline colored text within echo statements:
```bash
echo "  $(echo.cyan 'command')     Description text"
echo "Regular text $(echo.cyan 'colored part') more text"
```

## Template Variants

### Simple Script Help
```bash
function script_help() { # 🎨 Enhanced help menu
    echo.header "🛠️ Script Name"
    echo
    echo.cyan "Usage: script-name [options] <args>"
    echo
    echo.purple "🔧 Options:"
    echo "  $(echo.cyan '-h, --help')     Show this help"
    echo "  $(echo.cyan '-v, --verbose')  Verbose output"
    echo
    echo.purple "✨ Examples:"
    echo.success "  ✓ script-name input.txt    # Process file"
    echo.success "  ✓ script-name --verbose    # Verbose mode"
    echo
    echo.info "💡 This script is part of the dotfiles system"
}
```

### Complex Tool Help
```bash
function tool_help() { # 🎨 Enhanced help menu
    echo.header "🔧 Complex Tool Name"
    echo
    echo.cyan "Usage: tool-name <command> [options] <args>"
    echo
    echo.purple "⚡ Commands:"
    echo "  $(echo.cyan 'create')    Create something new"
    echo "  $(echo.cyan 'list')      List existing items"
    echo "  $(echo.cyan 'delete')    Remove an item"
    echo "  $(echo.cyan 'help')      Show this help"
    echo
    echo.purple "🛠️ Global Options:"
    echo "  $(echo.cyan '-h, --help')      Show help"
    echo "  $(echo.cyan '-v, --verbose')   Verbose output"
    echo "  $(echo.cyan '-q, --quiet')     Quiet mode"
    echo "  $(echo.cyan '--dry-run')       Preview changes"
    echo
    echo.purple "✨ Examples:"
    echo.success "  ✓ tool-name create item1           # Create new item"
    echo.success "  ✓ tool-name list --verbose         # List with details"
    echo.success "  ✓ tool-name delete item1 --dry-run # Preview deletion"
    echo
    echo.info "💡 Use 'tool-name <command> --help' for command-specific help"
    echo.info "📖 Documentation: dotfiles help tool-name"
}
```

## Implementation Checklist

When creating or updating a help function:

- [ ] Add `# 🎨 Enhanced help menu` comment to function declaration
- [ ] Use `echo.header` with appropriate emoji for title
- [ ] Include cyan usage line
- [ ] Use purple section headers with emojis
- [ ] Wrap all command/option names in `$(echo.cyan 'text')`
- [ ] Include examples section with `echo.success` and ✓ marks
- [ ] Add helpful tip with `echo.info` and 💡 emoji
- [ ] Ensure consistent spacing and alignment
- [ ] Test the help output for readability

## Color Utility Script

Use the `dotfiles-help-colorizer` utility to automatically enhance existing help functions:

```bash
# Preview changes
dotfiles-help-colorizer --dry-run script-name

# Apply with backup
dotfiles-help-colorizer --backup script-name

# Generate template
dotfiles-help-colorizer --template > new-help.sh
```

This ensures consistency across all dotfiles scripts while maintaining the aesthetic and functional design principles.
