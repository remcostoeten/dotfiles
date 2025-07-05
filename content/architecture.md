# Project Architecture Specification

This document defines the standardized folder hierarchy and naming conventions for this project to ensure consistency, maintainability, and ease of navigation.

## Top-Level Directory Structure

The project follows a well-organized structure with clearly defined purposes for each top-level directory:

```
project-root/
├── core/           # Core functionality and shared utilities
├── modules/        # Feature-specific modules and plugins
├── scripts/        # Executable scripts and automation tools
├── configs/        # Configuration files and templates
├── templates/      # Template files for various purposes
├── docs/           # Documentation and specifications
├── tests/          # Test files and testing utilities
├── tools/          # Development tools and utilities
└── ci/             # Continuous integration and deployment configs
```

### Directory Purposes

- **`core/`**: Contains the fundamental building blocks, shared libraries, and common utilities that other parts of the project depend on
- **`modules/`**: Houses feature-specific code, plugins, and modular components that can be independently developed and maintained
- **`scripts/`**: Stores executable scripts for automation, deployment, maintenance, and development workflows
- **`configs/`**: Contains configuration files, environment settings, and configuration templates
- **`templates/`**: Holds template files for code generation, documentation, or configuration scaffolding
- **`docs/`**: Documentation including specifications, guides, API docs, and architectural decisions
- **`tests/`**: All testing-related files including unit tests, integration tests, and test utilities
- **`tools/`**: Development tools, build utilities, and helper applications
- **`ci/`**: Continuous integration pipelines, deployment scripts, and automation workflows

## Shell-Specific Organization

When organizing shell-specific content, use the following structure within relevant directories:

```
shell/
├── bash/           # Bash-specific implementations
├── fish/           # Fish shell-specific implementations
├── zsh/            # Zsh-specific implementations
└── common/         # Shell-agnostic or shared functionality
```

### Examples of Shell Organization

```
scripts/
├── shell/
│   ├── bash/
│   │   ├── setup_environment.sh
│   │   └── backup_dotfiles.sh
│   ├── fish/
│   │   ├── setup_environment.fish
│   │   └── backup_dotfiles.fish
│   └── zsh/
│       ├── setup_environment.zsh
│       └── backup_dotfiles.zsh
└── common/
    └── validate_config.py

tests/
├── shell/
│   ├── bash/
│   │   ├── setup_environment.spec.fish
│   │   └── backup_dotfiles.spec.fish
│   ├── fish/
│   │   ├── setup_environment.spec.fish
│   │   └── backup_dotfiles.spec.fish
│   └── zsh/
│       ├── setup_environment.spec.fish
│       └── backup_dotfiles.spec.fish
```

## Naming Conventions

### Directory Names
- **Format**: `lower-kebab-case`
- **Examples**: 
  - `user-management`
  - `config-parser`
  - `shell-utilities`
  - `test-helpers`

### Executable Scripts
- **Format**: `snake_case` with appropriate file extension
- **Examples**:
  - `setup_environment.sh`
  - `backup_dotfiles.fish`
  - `deploy_application.py`
  - `run_tests.bash`

### Documentation Files
- **Format**: `UpperCamelCase.md`
- **Examples**:
  - `Architecture.md`
  - `InstallationGuide.md`
  - `ApiReference.md`
  - `TroubleshootingGuide.md`

### Test Files
- **Format**: `*.spec.fish` (using Fish shell testing framework)
- **Examples**:
  - `user_management.spec.fish`
  - `config_parser.spec.fish`
  - `deployment_script.spec.fish`
  - `utility_functions.spec.fish`

### Configuration Files
- **Format**: Depends on the configuration type, but generally:
  - YAML/JSON: `lower-kebab-case.yaml` or `lower-kebab-case.json`
  - Shell configs: `snake_case.conf` or `.snake_case_rc`
  - Environment files: `.env.environment_name`
- **Examples**:
  - `database-config.yaml`
  - `app-settings.json`
  - `shell_preferences.conf`
  - `.env.development`

### Template Files
- **Format**: `lower-kebab-case.template.extension`
- **Examples**:
  - `docker-compose.template.yml`
  - `config-file.template.json`
  - `readme.template.md`
  - `script-skeleton.template.sh`

### Source Code Files
- **Format**: `snake_case` with appropriate extension
- **Examples**:
  - `user_manager.py`
  - `config_parser.js`
  - `shell_utilities.sh`
  - `test_helpers.fish`

## Domain-Specific Organization

For projects with multiple domains or feature areas, organize using this pattern:

```
modules/
├── user-management/
│   ├── core/
│   ├── shell/
│   │   ├── bash/
│   │   ├── fish/
│   │   └── zsh/
│   ├── configs/
│   └── tests/
├── system-monitoring/
│   ├── core/
│   ├── shell/
│   │   ├── bash/
│   │   ├── fish/
│   │   └── zsh/
│   ├── configs/
│   └── tests/
```

## File Naming Rules Summary

| File Type | Convention | Example |
|-----------|------------|---------|
| Directories | `lower-kebab-case` | `user-management/` |
| Executable Scripts | `snake_case.ext` | `setup_environment.sh` |
| Documentation | `UpperCamelCase.md` | `InstallationGuide.md` |
| Tests | `*.spec.fish` | `user_manager.spec.fish` |
| Config Files | `lower-kebab-case.ext` | `app-config.yaml` |
| Templates | `lower-kebab-case.template.ext` | `docker.template.yml` |
| Source Code | `snake_case.ext` | `config_parser.py` |

## Enforcement and Tooling

To maintain consistency:

1. **Linting**: Implement file naming linters in CI/CD pipeline
2. **Templates**: Use project templates that follow these conventions
3. **Documentation**: Keep this specification updated and accessible
4. **Code Reviews**: Include naming convention checks in review process
5. **Automation**: Create scripts to validate and fix naming inconsistencies

## Exceptions

Exceptions to these rules should be:
1. Documented in this file with justification
2. Approved through team review process
3. Limited in scope and clearly marked

Common acceptable exceptions:
- Third-party tool requirements (e.g., `Dockerfile`, `README.md`)
- Language-specific conventions (e.g., `package.json` for Node.js)
- System file requirements (e.g., `.gitignore`, `.bashrc`)

---

*This specification should be reviewed and updated as the project evolves. All team members are expected to follow these conventions to maintain code quality and project organization.*
