# 🔐 Environment Variables & Secrets Management System

A secure and unified approach to managing environment variables, secrets, and OAuth tokens in your dotfiles system.

## 🎯 **System Overview**

This system provides **one comprehensive security module** for all sensitive data:

1. **🔐 Environment Manager** - Encrypts and stores environment variables, secrets, API keys, passwords, and OAuth tokens

## 📁 **File Structure**

```
~/.config/dotfiles/
├── bin/
│   ├── dotfiles-env             # Environment variables & secrets manager
│   └── dotfiles-env-sync        # Sync across machines
└── utils/
    └── env.json                 # Encrypted environment database
```

## 🔐 **Environment Manager (`dotfiles env`)**

Encrypts and stores environment variables, secrets, API keys, passwords, and OAuth tokens.

### **Features**
- **AES-256 encryption** with PBKDF2 key derivation
- **Multiple variable types** (api, password, token, database, oauth, etc.)
- **OAuth key pair generation** (RSA, EC, Ed25519)
- **Automatic export** to environment variables
- **Backup and restore** functionality
- **Interactive clipboard support**

### **Usage**

```bash
# Store a secret/environment variable
dotfiles env set GITHUB_TOKEN "your_token" api

# Retrieve a value
dotfiles env get GITHUB_TOKEN

# List all variables
dotfiles env list

# Export to environment
dotfiles env export

# Generate random values
dotfiles env generate DB_PASSWORD 64 database

# Generate OAuth key pairs
dotfiles env generate-oauth GITHUB_OAUTH rsa 4096 "GitHub OAuth App"
```


## 🚀 **Integration with Main System**

The environment manager is integrated into the main `dotfiles` command:

```bash
# Environment variable management
dotfiles env set API_KEY "value" api
dotfiles env export

# OAuth key pair generation
dotfiles env generate-oauth APP_OAUTH rsa 2048 "App OAuth"
```

## 🔒 **Security Features**

### **Environment Manager**
- ✅ **AES-256 encryption** - Military-grade security
- ✅ **Secure key storage** - Separate encryption keys
- ✅ **File permissions** - Restrictive access (600)
- ✅ **Private key encryption** - Never stored in plain text
- ✅ **Public key export** - Safe for environment variables
- ✅ **Key generation** - Cryptographically secure

## 📋 **Workflow Examples**

### **Managing API Keys**

```bash
# 1. Store API key securely
dotfiles env set SERVICE_API_KEY "your_key" api

# 2. Export to environment
dotfiles env export

# 3. Use in your scripts
echo $SERVICE_API_KEY
```

### **Setting Up OAuth App**

```bash
# 1. Generate key pair
dotfiles env generate-oauth GITHUB_OAUTH rsa 4096 "GitHub OAuth App"

# 2. Export variables
dotfiles env export

# 3. Use public key in your app
echo $GITHUB_OAUTH_PUBLIC_KEY
```

## 🧹 **Clean Configuration**

Your `cfg` file automatically loads environment variables:

```bash
# Export encrypted environment variables and secrets
dotfiles env export 2>/dev/null || true
```

## 🎯 **Best Practices**

1. **Store all sensitive data encrypted** with the environment manager
2. **Generate OAuth keys** with the `generate-oauth` command
3. **Regular backups** of encrypted database
4. **Never commit** plain text secrets or private keys

## 🔧 **Customization**

The environment manager can be customized:

- **Environment manager**: Adjust encryption settings in `configs/env.conf`
- **Key generation**: Customize OAuth key generation parameters

## 🚨 **Migration from Old System**

If you have existing environment variables in another system:

```bash
# Import from environment file
dotfiles env import ~/.env

# Import from backup file
dotfiles env import ~/old-env.txt
```

## 🎉 **Benefits**

- **🔒 Secure**: No plain text secrets anywhere
- **📦 Unified**: Single system for all environment variables and secrets
- **🔄 Flexible**: Easy to add/remove variables
- **📱 Accessible**: Simple commands for common tasks
- **💾 Version Safe**: Can be committed to git safely
- **🛡️ Professional**: Enterprise-level security practices

---

**Your sensitive data is now secure and properly managed!** 🎊

