# Environment Secrets

This directory contains environment variables that are specific to your local setup and should not be committed to version control.

## Usage

1.  **Create your secret files**: For each `.sh.example` file in this directory, create a corresponding `.sh` file (e.g., `gemini.sh` from `gemini.sh.example`).
2.  **Fill in your values**: Edit the newly created `.sh` files and replace the placeholder values with your actual secrets (e.g., API keys, tokens, etc.).

## Git Ignore

This directory contains its own `.gitignore` file that ensures all `.sh` files (your actual secrets) are ignored by Git, while allowing the `.sh.example` files and this `README.md` to be tracked.

**Do NOT commit your `.sh` files to Git!**
