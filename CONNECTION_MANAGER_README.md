# Connection Manager

Save and manage database connections for PostgreSQL and Turso with encrypted storage.

## Features

- 💾 **Save Connections** - Store connection strings securely
- 🔐 **Encrypted Storage** - Connections encrypted with Fernet (or base64 fallback)
- 🏷️ **Tags & Descriptions** - Organize connections with metadata
- 📊 **Usage Tracking** - See when connections were last used
- ⚡ **Quick Connect** - Connect instantly with saved credentials
- 🐘 **PostgreSQL Support** - Full PostgreSQL connection management
- 🚀 **Turso Support** - Turso database connection support

## Usage

### Save a Connection

**Interactive:**
```bash
db connections
# Select option 2 to save
```

**Command Line:**
```bash
# PostgreSQL
db save production postgres "postgresql://user:pass@host:5432/db" "Production DB"

# Turso
db save my-turso turso "libsql://my-db.turso.io?authToken=token" "My Turso DB"
```

### List Connections

```bash
db connections
# Select option 1

# Or directly
python3 scripts/connection_manager.py list

# Filter by type
python3 scripts/connection_manager.py list --type postgres
python3 scripts/connection_manager.py list --type turso
```

### Connect to Saved Connection

**Quick connect:**
```bash
db connect production
```

**Interactive:**
```bash
db connections
# Select option 3
```

This automatically:
- Loads the connection string
- For PostgreSQL: Sets `DATABASE_URL` env var and launches postgres manager
- For Turso: Sets `TURSO_DATABASE_URL` env var for use with turso tools

### Delete a Connection

```bash
db connections
# Select option 4
# Type connection name
# Confirm with 'yes'
```

## Connection Storage

Connections are stored in `~/.db_connections.json` with encrypted connection strings.

### Example Storage Format

```json
{
  "connections": [
    {
      "name": "production",
      "type": "postgres",
      "connection_string": "gAAAAABh...",
      "description": "Production PostgreSQL",
      "tags": ["prod", "important"],
      "created_at": "2025-01-18T10:30:00",
      "last_used": "2025-01-18T12:45:00",
      "use_count": 5
    }
  ]
}
```

## Encryption

### With cryptography Package (Recommended)

If `cryptography` and `keyring` are installed:
- Uses Fernet symmetric encryption
- Stores encryption key in system keyring
- Falls back to `~/.db_encryption_key` file if keyring unavailable

```bash
pip install cryptography keyring
```

### Without cryptography (Fallback)

If `cryptography` not installed:
- Uses base64 encoding (not true encryption)
- File permissions set to 600 (user-only)
- Still provides basic obfuscation

**Note:** For production use, install `cryptography` for proper encryption.

## Security Considerations

1. **File Permissions**: Connection file is automatically set to `600` (user-only access)
2. **Encryption Key**: Stored securely in system keyring when available
3. **Base64 Fallback**: Not cryptographically secure, just obfuscation
4. **Environment Variables**: Connection strings exposed in env when connecting

### Best Practices

- Install `cryptography` and `keyring` for production use
- Don't commit `.db_connections.json` to version control
- Use SSH tunnels for remote database connections
- Rotate credentials periodically
- Use read-only credentials when possible

## Examples

### Save PostgreSQL Connections

```bash
# Local development
db save local-dev postgres "postgresql://postgres:pass@localhost:5432/myapp" "Local dev DB"

# Supabase
db save supabase postgres "postgresql://postgres.[PROJECT].supabase.co:5432/postgres?password=[PASSWORD]" "Supabase project"

# Neon
db save neon postgres "postgresql://user@ep-123.us-east-2.aws.neon.tech/main" "Neon serverless"

# Railway
db save railway postgres "postgresql://postgres:pass@containers-us-west-1.railway.app:5432/railway" "Railway DB"
```

### Save Turso Connections

```bash
# Development
db save turso-dev turso "libsql://my-db-dev.turso.io?authToken=ey..." "Dev Turso DB"

# Production  
db save turso-prod turso "libsql://my-db-prod.turso.io?authToken=ey..." "Prod Turso DB"
```

### Quick Workflow

```bash
# Save once
db save staging postgres "postgresql://user:pass@staging.example.com:5432/db"

# Connect anytime
db connect staging
# Automatically launches postgres manager with connection loaded
```

## Connection Manager API

For programmatic use:

```python
from connection_manager import ConnectionManager

manager = ConnectionManager()

# Save connection
manager.save_connection(
    name="my-db",
    db_type="postgres",
    connection_string="postgresql://...",
    description="My database",
    tags=["dev", "local"]
)

# Get connection
conn = manager.get_connection("my-db")
print(conn["connection_string"])  # Decrypted

# List connections
connections = manager.list_connections(db_type="postgres")

# Delete connection
manager.delete_connection("my-db")
```

## Troubleshooting

### "Connection manager not available"

Install dependencies:
```bash
pip install cryptography keyring
```

Or the connection manager will work with base64 fallback (less secure).

### Encryption Key Issues

If you get Fernet decryption errors after reinstalling:
```bash
rm ~/.db_encryption_key
# Connections will need to be re-saved
```

### File Permissions

If connection file is created with wrong permissions:
```bash
chmod 600 ~/.db_connections.json
```

## Integration with Other Tools

### With psql

```bash
# Get connection string
conn=$(python3 scripts/connection_manager.py get production | grep Connection | awk '{print $2}')
psql "$conn"
```

### With Environment Variables

```bash
# Load into environment
export DATABASE_URL=$(python3 scripts/connection_manager.py get prod | grep Connection | awk '{print $2}')

# Use with any tool
drizzle-kit push
prisma migrate dev
```

## Coming Soon

- [ ] Import from `.env` files
- [ ] Export to various formats (JSON, YAML, .env)
- [ ] Connection testing before save
- [ ] SSH tunnel configuration
- [ ] Connection groups/profiles
- [ ] Backup/restore connections
