#!/usr/bin/env python3
"""
Simple HTTP server for the Theme Demo App
Run this script to serve the demo application locally
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent.absolute()
PARENT_DIR = BASE_DIR.parent

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.address_string()}] {format % args}")

def main():
    os.chdir(BASE_DIR)

    print("=" * 60)
    print("🎨 Dotfiles Theme Demo App")
    print("=" * 60)
    print(f"\n📍 Serving from: {BASE_DIR}")
    print(f"🌐 Server running at: http://localhost:{PORT}")
    print(f"\n📱 Pages available:")
    print(f"   • Dashboard: http://localhost:{PORT}/index.html")
    print(f"   • Components: http://localhost:{PORT}/pages/components.html")
    print(f"   • Forms: http://localhost:{PORT}/pages/forms.html")
    print(f"   • Settings: http://localhost:{PORT}/pages/settings.html")
    print(f"\n💡 Press Ctrl+C to stop the server\n")
    print("=" * 60)

    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped. Goodbye!")
        sys.exit(0)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"\n❌ Error: Port {PORT} is already in use!")
            print(f"💡 Try a different port or stop the other server.")
        else:
            print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()