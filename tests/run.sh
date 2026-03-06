#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT/tests/test_install.sh"
"$ROOT/tests/test_packages.sh"
"$ROOT/tests/test_set_sudo.sh"
