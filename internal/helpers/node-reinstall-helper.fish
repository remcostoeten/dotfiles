#!/usr/bin/env fish

# Helper registration for node-reinstall script using the central factory
source (dirname (status --current-filename))/../helper-factory.fish

# Register helper for node-reinstall script
create_helper "node-reinstall" \
    "Node.js Complete Reinstaller" \
    "Complete Node.js dependency reinstallation - clean and fresh install" \
    "usage|USAGE|reinstallnode|[manager]|Remove and reinstall all dependencies" \
    "examples|EXAMPLES|Default reinstall:reinstallnode|Use specific manager:reinstallnode pnpm" \
    "features|FEATURES|Complete dependency cleanup|Fresh package installation|Multiple package manager support|Automatic manager detection" \
    "commands|COMMANDS|reinstallnode:Clean and reinstall with detected manager|reinstallnode [manager]:Use specific package manager"
