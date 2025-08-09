#!/usr/bin/env fish

# Helper registration for git-commit script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for git-commit script
create_helper "git-commit" \
    "Advanced Git Commit Helper" \
    "Standardized git commit with conventional commit support and automation" \
    "usage|USAGE|commit|[type]|[message]|Create conventional commits with automation" \
    "examples|EXAMPLES|Interactive commit:commit|Quick commit:commit feat 'add new feature'|Auto-stage commit:commit fix 'resolve bug' -a" \
    "features|FEATURES|Conventional commit types|Interactive commit builder|Auto-staging support|Branch validation|Pre-commit hooks" \
    "types|COMMIT TYPES|feat:New feature|fix:Bug fix|docs:Documentation|style:Code style|refactor:Code refactoring|test:Tests|chore:Maintenance"
