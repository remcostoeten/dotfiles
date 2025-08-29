# Security Documentation

This document tracks security-related changes and best practices for the dotfiles system.

## Security Migration Log

### 2025-08-29: Environment Vault Migration
- **Issue**: Environment vault stored in GitHub secret gist (4a714aede99f6c582875cfbe396d16a1)
- **Problem**: Secret gists are unlisted but accessible to anyone with the URL
- **Solution**: Migrated encrypted environment files to private repository `remcostoeten/dotfiles-meta`
- **Files Migrated**: 
  - `env.vault` (encrypted environment variables)
  - `env.vault.b64` (base64-encoded encrypted environment variables)
  - `sync_metadata.json` (synchronization metadata)
- **Actions Taken**:
  1. Created private repository `remcostoeten/dotfiles-meta`
  2. Transferred all encrypted files to the private repository
  3. Deleted the original secret gist
  4. Verified no hardcoded references to the old gist exist in codebase
- **Impact**: Improved security by using truly private repository instead of unlisted gist

## Security Best Practices

### Environment Variables
- All sensitive environment variables are encrypted using AES-256-CBC with PBKDF2
- Master passwords are never stored in plaintext
- Environment vault is stored in private repository, not public or secret gists
- Backup files include metadata for integrity verification

### Symlink Management  
- All symlinks are tracked in a registry (`utils/links.json`)
- `safe_link` function validates targets before creating symlinks
- Broken symlinks are automatically detected and logged

### File Operations
- `safe_rm` moves files to trash instead of permanent deletion
- All file operations are logged with timestamps
- Critical operations require confirmation

### Access Control
- Private repositories for sensitive configurations
- GitHub CLI authentication required for sync operations
- Local file permissions set to 700 for sensitive directories

## Incident Response

### If Secrets are Exposed
1. Immediately rotate all affected credentials
2. Delete or make private any public repositories/gists
3. Search for hardcoded references in codebase
4. Update documentation with incident details
5. Review and improve access controls

### If Dotfiles are Compromised
1. Run `dotfiles doctor` for health check
2. Restore from known-good backup
3. Re-encrypt environment vault with new password
4. Update all managed symlinks
5. Verify system integrity

## Audit Trail

All security-related changes should be documented in this file with:
- Date and time
- Description of change
- Reason for change  
- Impact assessment
- Verification steps taken
