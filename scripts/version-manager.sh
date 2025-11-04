#!/bin/bash
# Version Management Script for Dotfiles
# Usage: ./scripts/version-manager.sh [bump|current|tag|release] [major|minor|patch]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"
PACKAGE_JSON="$ROOT_DIR/opentui-setup/package.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current version
get_current_version() {
    if [ -f "$VERSION_FILE" ]; then
        cat "$VERSION_FILE" | tr -d ' \n'
    elif [ -f "$PACKAGE_JSON" ]; then
        grep -o '"version": "[^"]*"' "$PACKAGE_JSON" | cut -d'"' -f4
    else
        echo "0.0.0"
    fi
}

# Bump version
bump_version() {
    local current_version=$(get_current_version)
    local bump_type=$1

    if [ -z "$bump_type" ]; then
        echo -e "${RED}Error: Bump type required (major|minor|patch)${NC}"
        exit 1
    fi

    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}

    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            echo -e "${RED}Error: Invalid bump type. Use: major|minor|patch${NC}"
            exit 1
            ;;
    esac

    local new_version="$major.$minor.$patch"
    echo "$new_version"
}

# Update version in files
update_version() {
    local version=$1

    # Update VERSION file
    echo "$version" > "$VERSION_FILE"
    echo -e "${GREEN}✓ Updated VERSION file${NC}"

    # Update package.json if it exists
    if [ -f "$PACKAGE_JSON" ]; then
        if command -v jq &> /dev/null; then
            jq ".version = \"$version\"" "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp" && mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
        else
            # Fallback to sed if jq is not available
            sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$version\"/" "$PACKAGE_JSON"
        fi
        echo -e "${GREEN}✓ Updated package.json${NC}"
    fi

    # Update index.html version display (if exists)
    if [ -f "$ROOT_DIR/index.html" ]; then
        # This will be handled by the version fetching script, but we can add a meta tag
        echo -e "${BLUE}ℹ  index.html will fetch version from package.json${NC}"
    fi
}

# Create git tag
create_tag() {
    local version=$1
    local message=${2:-"Release v$version"}

    if [ -z "$version" ]; then
        version=$(get_current_version)
    fi

    echo -e "${YELLOW}Creating git tag v$version...${NC}"

    if git rev-parse "v$version" >/dev/null 2>&1; then
        echo -e "${RED}Error: Tag v$version already exists${NC}"
        exit 1
    fi

    git tag -a "v$version" -m "$message"
    echo -e "${GREEN}✓ Created tag v$version${NC}"
    echo -e "${BLUE}ℹ  Push with: git push origin v$version${NC}"
}

# Full release process
create_release() {
    local bump_type=$1
    local current_version=$(get_current_version)
    local new_version=$(bump_version "$bump_type")

    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Dotfiles Release Process${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════${NC}"
    echo -e "Current version: ${GREEN}$current_version${NC}"
    echo -e "New version:     ${GREEN}$new_version${NC}"
    echo ""

    read -p "Continue with release? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Release cancelled${NC}"
        exit 0
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}⚠  Warning: You have uncommitted changes${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    # Update version
    update_version "$new_version"

    # Commit version changes
    git add "$VERSION_FILE"
    [ -f "$PACKAGE_JSON" ] && git add "$PACKAGE_JSON"
    git commit -m "chore: bump version to $new_version" || true

    # Create tag
    create_tag "$new_version" "Release v$new_version"

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Release v$new_version created successfully!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Next steps:"
    echo -e "  1. Review changes: ${BLUE}git log${NC}"
    echo -e "  2. Push commits:   ${BLUE}git push${NC}"
    echo -e "  3. Push tag:       ${BLUE}git push origin v$new_version${NC}"
    echo -e "  4. Create release: ${BLUE}gh release create v$new_version${NC}"
}

# Main command handler
case "${1:-}" in
    current)
        echo "$(get_current_version)"
        ;;
    bump)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Bump type required (major|minor|patch)${NC}"
            exit 1
        fi
        new_version=$(bump_version "$2")
        echo "$new_version"
        ;;
    update)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Version required${NC}"
            exit 1
        fi
        update_version "$2"
        ;;
    tag)
        create_tag "${2:-}"
        ;;
    release)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Bump type required (major|minor|patch)${NC}"
            echo -e "Usage: $0 release [major|minor|patch]${NC}"
            exit 1
        fi
        create_release "$2"
        ;;
    *)
        echo -e "${BLUE}Dotfiles Version Manager${NC}"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  current              Show current version"
        echo "  bump [type]         Calculate new version (major|minor|patch)"
        echo "  update [version]     Update version in all files"
        echo "  tag [version]       Create git tag (uses current version if not specified)"
        echo "  release [type]       Full release: bump, update, commit, tag"
        echo ""
        echo "Examples:"
        echo "  $0 current"
        echo "  $0 bump patch"
        echo "  $0 release minor"
        echo ""
        exit 1
        ;;
esac
