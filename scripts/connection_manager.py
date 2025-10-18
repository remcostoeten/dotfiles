#!/usr/bin/env python3

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import base64

try:
    import keyring
    KEYRING_AVAILABLE = True
except ImportError:
    KEYRING_AVAILABLE = False

try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

CONNECTIONS_FILE = Path.home() / ".db_connections.json"
SERVICE_NAME = "db_tool_connections"

class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'

class ConnectionManager:
    def __init__(self):
        self.connections_file = CONNECTIONS_FILE
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        if not self.connections_file.exists():
            self.connections_file.write_text(json.dumps({"connections": []}, indent=2))
    
    def _get_encryption_key(self) -> bytes:
        if not CRYPTO_AVAILABLE:
            return b'dummy_key_not_encrypted'
        
        if KEYRING_AVAILABLE:
            try:
                key = keyring.get_password(SERVICE_NAME, "encryption_key")
                if not key:
                    key = Fernet.generate_key().decode()
                    keyring.set_password(SERVICE_NAME, "encryption_key", key)
                return key.encode() if isinstance(key, str) else key
            except Exception:
                pass
        
        stored_key_file = Path.home() / ".db_encryption_key"
        if stored_key_file.exists():
            return stored_key_file.read_bytes()
        key = Fernet.generate_key()
        stored_key_file.write_bytes(key)
        os.chmod(stored_key_file, 0o600)
        return key
    
    def _encrypt_value(self, value: str) -> str:
        if not CRYPTO_AVAILABLE:
            return base64.b64encode(value.encode()).decode()
        key = self._get_encryption_key()
        f = Fernet(key)
        return f.encrypt(value.encode()).decode()
    
    def _decrypt_value(self, encrypted_value: str) -> str:
        if not CRYPTO_AVAILABLE:
            try:
                return base64.b64decode(encrypted_value.encode()).decode()
            except:
                return encrypted_value
        key = self._get_encryption_key()
        f = Fernet(key)
        return f.decrypt(encrypted_value.encode()).decode()
    
    def _load_connections(self) -> Dict:
        try:
            with open(self.connections_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"connections": []}
    
    def _save_connections(self, data: Dict):
        with open(self.connections_file, 'w') as f:
            json.dump(data, f, indent=2)
        os.chmod(self.connections_file, 0o600)
    
    def save_connection(self, name: str, db_type: str, connection_string: str, 
                       description: str = "", tags: List[str] = None) -> Tuple[bool, str]:
        data = self._load_connections()
        
        for conn in data["connections"]:
            if conn["name"] == name:
                return False, f"Connection '{name}' already exists. Use update or choose a different name."
        
        encrypted_conn = self._encrypt_value(connection_string)
        
        new_connection = {
            "name": name,
            "type": db_type,
            "connection_string": encrypted_conn,
            "description": description,
            "tags": tags or [],
            "created_at": datetime.now().isoformat(),
            "last_used": None,
            "use_count": 0
        }
        
        data["connections"].append(new_connection)
        self._save_connections(data)
        
        return True, f"Connection '{name}' saved successfully"
    
    def get_connection(self, name: str) -> Optional[Dict]:
        data = self._load_connections()
        
        for conn in data["connections"]:
            if conn["name"] == name:
                conn["connection_string"] = self._decrypt_value(conn["connection_string"])
                
                conn["last_used"] = datetime.now().isoformat()
                conn["use_count"] += 1
                
                for c in data["connections"]:
                    if c["name"] == name:
                        c["last_used"] = conn["last_used"]
                        c["use_count"] = conn["use_count"]
                        break
                
                self._save_connections(data)
                return conn
        
        return None
    
    def list_connections(self, db_type: Optional[str] = None, 
                        tag: Optional[str] = None) -> List[Dict]:
        data = self._load_connections()
        connections = data["connections"]
        
        if db_type:
            connections = [c for c in connections if c["type"] == db_type]
        
        if tag:
            connections = [c for c in connections if tag in c.get("tags", [])]
        
        return connections
    
    def delete_connection(self, name: str) -> Tuple[bool, str]:
        data = self._load_connections()
        original_count = len(data["connections"])
        
        data["connections"] = [c for c in data["connections"] if c["name"] != name]
        
        if len(data["connections"]) == original_count:
            return False, f"Connection '{name}' not found"
        
        self._save_connections(data)
        return True, f"Connection '{name}' deleted successfully"
    
    def update_connection(self, name: str, **kwargs) -> Tuple[bool, str]:
        data = self._load_connections()
        
        for conn in data["connections"]:
            if conn["name"] == name:
                if "connection_string" in kwargs:
                    conn["connection_string"] = self._encrypt_value(kwargs["connection_string"])
                if "description" in kwargs:
                    conn["description"] = kwargs["description"]
                if "tags" in kwargs:
                    conn["tags"] = kwargs["tags"]
                
                self._save_connections(data)
                return True, f"Connection '{name}' updated successfully"
        
        return False, f"Connection '{name}' not found"
    
    def print_connections_table(self, connections: List[Dict]):
        if not connections:
            print(f"{Colors.YELLOW}No connections found{Colors.RESET}")
            return
        
        print(f"\n{Colors.BOLD}{Colors.CYAN}Saved Connections:{Colors.RESET}\n")
        
        max_name = max(len(c["name"]) for c in connections)
        max_type = max(len(c["type"]) for c in connections)
        max_desc = max((len(c.get("description", "")) for c in connections), default=0)
        max_desc = min(max_desc, 40)
        
        header = f"  {Colors.BOLD}{'Name':<{max_name}}  {'Type':<{max_type}}  {'Description':<{max_desc}}  {'Last Used':<12}  Uses{Colors.RESET}"
        print(header)
        print(f"  {Colors.DIM}{'-' * (max_name + max_type + max_desc + 30)}{Colors.RESET}")
        
        for conn in sorted(connections, key=lambda x: x.get("last_used") or "", reverse=True):
            name_color = Colors.GREEN if conn["type"] == "postgres" else Colors.CYAN
            
            last_used = "never"
            if conn.get("last_used"):
                try:
                    dt = datetime.fromisoformat(conn["last_used"])
                    last_used = dt.strftime("%Y-%m-%d")
                except:
                    pass
            
            desc = conn.get("description", "")[:max_desc]
            use_count = conn.get("use_count", 0)
            
            print(f"  {name_color}{conn['name']:<{max_name}}{Colors.RESET}  "
                  f"{Colors.BLUE}{conn['type']:<{max_type}}{Colors.RESET}  "
                  f"{Colors.DIM}{desc:<{max_desc}}{Colors.RESET}  "
                  f"{Colors.YELLOW}{last_used:<12}{Colors.RESET}  "
                  f"{Colors.WHITE}{use_count}{Colors.RESET}")
            
            if conn.get("tags"):
                tags_str = ", ".join(conn["tags"])
                print(f"    {Colors.DIM}Tags: {tags_str}{Colors.RESET}")
        
        print()

def main():
    import sys
    
    manager = ConnectionManager()
    
    if len(sys.argv) < 2:
        print(f"{Colors.CYAN}Connection Manager{Colors.RESET}")
        print(f"\nUsage: connection_manager.py <command> [args]\n")
        print(f"Commands:")
        print(f"  {Colors.GREEN}save{Colors.RESET} <name> <type> <connection_string> [description]")
        print(f"  {Colors.GREEN}get{Colors.RESET} <name>")
        print(f"  {Colors.GREEN}list{Colors.RESET} [--type postgres|turso] [--tag <tag>]")
        print(f"  {Colors.GREEN}delete{Colors.RESET} <name>")
        print(f"  {Colors.GREEN}update{Colors.RESET} <name> [--conn <string>] [--desc <description>]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "save":
        if len(sys.argv) < 5:
            print(f"{Colors.RED}Usage: save <name> <type> <connection_string> [description]{Colors.RESET}")
            sys.exit(1)
        
        name = sys.argv[2]
        db_type = sys.argv[3]
        conn_str = sys.argv[4]
        desc = sys.argv[5] if len(sys.argv) > 5 else ""
        
        success, message = manager.save_connection(name, db_type, conn_str, desc)
        print(f"{Colors.GREEN if success else Colors.RED}{message}{Colors.RESET}")
    
    elif command == "get":
        if len(sys.argv) < 3:
            print(f"{Colors.RED}Usage: get <name>{Colors.RESET}")
            sys.exit(1)
        
        conn = manager.get_connection(sys.argv[2])
        if conn:
            print(f"{Colors.GREEN}Connection found:{Colors.RESET}")
            print(f"  Type: {Colors.CYAN}{conn['type']}{Colors.RESET}")
            print(f"  Connection: {Colors.YELLOW}{conn['connection_string']}{Colors.RESET}")
        else:
            print(f"{Colors.RED}Connection not found{Colors.RESET}")
    
    elif command == "list":
        db_type = None
        tag = None
        
        for i, arg in enumerate(sys.argv):
            if arg == "--type" and i + 1 < len(sys.argv):
                db_type = sys.argv[i + 1]
            elif arg == "--tag" and i + 1 < len(sys.argv):
                tag = sys.argv[i + 1]
        
        connections = manager.list_connections(db_type, tag)
        manager.print_connections_table(connections)
    
    elif command == "delete":
        if len(sys.argv) < 3:
            print(f"{Colors.RED}Usage: delete <name>{Colors.RESET}")
            sys.exit(1)
        
        success, message = manager.delete_connection(sys.argv[2])
        print(f"{Colors.GREEN if success else Colors.RED}{message}{Colors.RESET}")
    
    else:
        print(f"{Colors.RED}Unknown command: {command}{Colors.RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
