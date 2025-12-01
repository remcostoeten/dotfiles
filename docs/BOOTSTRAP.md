# Bootstrap Setup Guide

This guide explains what you need before running the bootstrap script on a fresh machine.

## TL;DR

**What you need:**
- Internet connection
- GitHub authentication (for private `env-private` repo)

**Quick setup:**
```bash
# Option 1: Use GitHub CLI (recommended)
sudo apt install gh -y && gh auth login

# Option 2: Use Personal Access Token (will be prompted)
# Create token at: https://github.com/settings/tokens

# Then run bootstrap
curl -fsSL https://raw.githubusercontent.com/remcostoeten/dotfiles/main/bootstrap.sh | bash
```

**What it does:**
1. Installs Git & Bun
2. Clones dotfiles repo
3. Clones env-private (needs auth)
4. Restores SSH keys
5. Prompts to run main setup

That's it! The bootstrap handles everything needed before the main setup script.

## Prerequisites

### Absolutely Required

1. **Internet Connection** - The script needs to download repositories and tools
2. **GitHub Authentication** - Required for the private `env-private` repository

### GitHub Authentication Options

The main dotfiles repository is **public** and requires no authentication. However, the `env-private` repository is **private** and requires authentication.

You have three options:

#### Option 1: GitHub CLI (Recommended)

Install and authenticate with GitHub CLI before running bootstrap:

```bash
# Install GitHub CLI (Ubuntu/Debian)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh -y

# Authenticate
gh auth login
```

**Benefits:**
- Handles authentication automatically
- Works seamlessly with git operations
- Secure token management

#### Option 2: Personal Access Token (PAT)

1. Create a Personal Access Token:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo` (for private repositories)
   - Copy the token

2. When the bootstrap script prompts for credentials (during git submodule initialization):
   
   You'll see a prompt like:
   ```
   Username for 'https://github.com': 
   Password for 'https://your-username@github.com': 
   ```
   
   Enter:
   - **Username**: Your GitHub username (e.g., `remcostoeten`)
   - **Password**: Your Personal Access Token (paste the token you copied, **not** your GitHub account password)
   
   **Important:** The password field will not show characters as you type (this is normal for security). Just paste your token and press Enter.
   
   **Example:**
   ```
   Username for 'https://github.com': remcostoeten
   Password for 'https://remcostoeten@github.com': ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

#### Option 3: SSH Keys (Advanced)

If you already have SSH keys set up and they're added to your GitHub account:

1. Ensure your SSH keys are in `~/.ssh/`
2. The bootstrap script will detect them and may be able to use SSH URLs

**Note:** This is less common since the `.gitmodules` file uses HTTPS URLs by default.

## What Gets Installed Automatically

The bootstrap script will automatically install:

- ✅ **Git** (if not present)
- ✅ **Bun** runtime (required for setup scripts)

Everything else is handled by the main setup script.

## Running Bootstrap

Once you have GitHub authentication set up:

```bash
curl -fsSL https://raw.githubusercontent.com/remcostoeten/dotfiles/main/bootstrap.sh | bash
```

The script will:
1. Check prerequisites (internet, GitHub auth)
2. Install Git if needed
3. Clone the dotfiles repository
4. Initialize git submodules (including env-private)
5. Restore SSH keys from env-private
6. Install Bun
7. Prompt to run the main setup script

## Troubleshooting

### "Authentication failed for env-private"

**Solution:** Make sure you're authenticated with GitHub:
- Run `gh auth login` if using GitHub CLI
- Or have a Personal Access Token ready when prompted

### "Failed to initialize some submodules"

**Solution:** This usually means authentication failed. The script will offer to:
- Let you manually enter the repository URL
- Skip and continue (you can clone env-private later)

### "No SSH keys found in env-private"

**Solution:** This is normal if:
- You're setting up a machine for the first time
- SSH keys haven't been backed up to env-private yet

You can backup SSH keys later with:
```bash
ssh-sync backup
```

## What If I Skip env-private?

You can continue the bootstrap without env-private, but:
- SSH keys won't be automatically restored
- Private environment variables won't be available
- You'll need to manually set up SSH keys and environment variables

You can always clone env-private later:
```bash
cd ~/.config/dotfiles
git submodule update --init env-private
```

