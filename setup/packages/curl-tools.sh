#!/bin/bash

# Tools installed via curl scripts
declare -a CURL_TOOLS=(
    "bun:https://bun.sh/install:bun"
    "starship:https://starship.rs/install.sh:starship"
    "nvm:https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh:nvm"
    "pnpm:https://get.pnpm.io/install.sh:pnpm"
    "turso:https://get.tur.so/install.sh:turso"
    "uvx:https://astral.sh/uv/install.sh:uvx"
    "vercel:https://vercel.com/cli.sh:vercel"
    "netlify:https://cli.netlify.com/install.sh:netlify"
)
