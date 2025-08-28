# 🔐 Secrets & Token Management System

A secure approach to managing sensitive data and OAuth tokens in your dotfiles system.

## 🎯 **System Overview**

This system provides **two security-focused modules** for sensitive data:

1. **🔐 Secrets Manager** - Encrypts and stores sensitive data (API keys, passwords)
2. **🔑 OAuth Tokens Manager** - Handles public/private key pairs for OAuth

## 📁 **File Structure**

```
~/.config/dotfiles/
├── bin/
│   ├── dotfiles-secrets         # Encrypted secrets manager
│   └── dotfiles-tokens          # OAuth tokens manager
└── utils/
    ├── secrets.json             # Encrypted secrets database
    └── tokens.json              # Encrypted OAuth tokens database
```

## 🔐 **Secrets Manager (`dotfiles secrets`)**

Encrypts and stores sensitive data like API keys and passwords.

### **Features**
- **AES-256 encryption** with PBKDF2 key derivation
- **Multiple secret types** (api, password, token, database, etc.)
- **Automatic export** to environment variables
- **Backup and restore** functionality

### **Usage**

```bash
# Store a secret
dotfiles secrets set GITHUB_TOKEN "your_token" api

# Retrieve a secret
dotfiles secrets get GITHUB_TOKEN

# List all secrets
dotfiles secrets list

# Export to environment
dotfiles secrets export

# Generate random secrets
dotfiles secrets generate DB_PASSWORD 64 database
```

## 🔑 **OAuth Tokens Manager (`dotfiles tokens`)**

Manages OAuth applications with public/private key pairs.

### **Features**
- **Key pair generation** (RSA, EC, Ed25519)
- **Encrypted private key storage**
- **Public key export** to environment
- **Descriptive metadata** for each token

### **Usage**

```bash
# Generate new key pair
dotfiles tokens generate GITHUB_OAUTH rsa 4096 "GitHub OAuth App"

# Store existing key pair
dotfiles tokens set GITHUB_OAUTH oauth "public_key" "private_key" "GitHub OAuth"

# View token details
dotfiles tokens get GITHUB_OAUTH

# Export public keys
dotfiles tokens export

# List all tokens
dotfiles tokens list
```

## 🚀 **Integration with Main System**

Both modules are integrated into the main `dotfiles` command:

```bash
# Secrets management
dotfiles secrets set API_KEY "value" api
dotfiles secrets export

# OAuth tokens management
dotfiles tokens generate APP_OAUTH rsa 2048 "App OAuth"
dotfiles tokens export
```

## 🔒 **Security Features**

### **Secrets Manager**
- ✅ **AES-256 encryption** - Military-grade security
- ✅ **Secure key storage** - Separate encryption keys
- ✅ **File permissions** - Restrictive access (600)

### **OAuth Tokens**
- ✅ **Private key encryption** - Never stored in plain text
- ✅ **Public key export** - Safe for environment variables
- ✅ **Key generation** - Cryptographically secure

## 📋 **Workflow Examples**

### **Managing API Keys**

```bash
# 1. Store API key securely
dotfiles secrets set SERVICE_API_KEY "your_key" api

# 2. Export to environment
dotfiles secrets export

# 3. Use in your scripts
echo $SERVICE_API_KEY
```

### **Setting Up OAuth App**

```bash
# 1. Generate key pair
dotfiles tokens generate GITHUB_OAUTH rsa 4096 "GitHub OAuth App"

# 2. Export public key
dotfiles tokens export

# 3. Use public key in your app
echo $GITHUB_OAUTH_PUBLIC_KEY
```

## 🧹 **Clean Configuration**

Your `cfg` file automatically loads secrets and tokens:

```bash
# Export encrypted secrets to environment
dotfiles secrets export 2>/dev/null || true

# Export OAuth public keys to environment
dotfiles tokens export 2>/dev/null || true
```

## 🎯 **Best Practices**

1. **Store all sensitive data encrypted** with the secrets manager
2. **Generate OAuth keys** with the tokens manager
3. **Regular backups** of encrypted databases
4. **Never commit** plain text secrets or private keys

## 🔧 **Customization**

Each module can be customized:

- **Secrets manager**: Adjust encryption settings in `configs/secrets.conf`
- **OAuth tokens**: Customize key generation parameters

## 🚨 **Migration from Old System**

If you have existing secrets in another system:

```bash
# Import from environment file
dotfiles secrets import ~/.env

# Import from backup file
dotfiles secrets import ~/old-secrets.txt
```

## 🎉 **Benefits**

- **🔒 Secure**: No plain text secrets anywhere
- **📦 Modular**: Independent secret and token management
- **🔄 Flexible**: Easy to add/remove secrets
- **📱 Accessible**: Simple commands for common tasks
- **💾 Version Safe**: Can be committed to git safely
- **🛡️ Professional**: Enterprise-level security practices

---

**Your sensitive data is now secure and properly managed!** 🎊

