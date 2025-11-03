# Simple Python HTTPS Web Server
# Requires: pip install pyopenssl
# Run with: python https_server.py

import http.server
import ssl
import os
import sys
from pathlib import Path

# Configuration
PORT = 443
WEB_ROOT = Path("./www")
CERT_FILE = "localhost.pem"
KEY_FILE = "localhost.key"

def generate_self_signed_cert():
    """Generate self-signed certificate if it doesn't exist"""
    from cryptography import x509
    from cryptography.x509.name import Name
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
    import datetime
    
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    
    print("Generating self-signed certificate...")
    
    # Generate private key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Generate certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "State"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "City"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Organization"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.DNSName("127.0.0.1"),
        ]),
        critical=False,
    ).sign(key, hashes.SHA256(), default_backend())
    
    # Write private key
    with open(KEY_FILE, "wb") as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    
    # Write certificate
    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    print(f"Certificate generated: {CERT_FILE}")
    print(f"Private key generated: {KEY_FILE}")

class HTTPSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)
    
    def do_GET(self):
        # Default to index.html if root path
        if self.path == '/':
            self.path = '/index.html'
        
        # Security check - prevent path traversal
        requested_path = Path(self.translate_path(self.path))
        web_root = Path(WEB_ROOT).resolve()
        
        try:
            if not requested_path.resolve().is_relative_to(web_root):
                self.send_error(403, "Forbidden")
                return
        except:
            self.send_error(403, "Forbidden")
            return
            
        return super().do_GET()
    
    def log_message(self, format, *args):
        # Custom logging format
        print(f"{self.address_string()} - {self.log_date_time_string()} - {format % args}")

def main():
    # Create web root directory if it doesn't exist
    WEB_ROOT.mkdir(exist_ok=True)
    print(f"Web root directory: {WEB_ROOT.resolve()}")
    
    # Create default index.html if it doesn't exist
    index_file = WEB_ROOT / "index.html"
    if not index_file.exists():
        index_content = """<!DOCTYPE html>
<html>
<head>
    <title>Python HTTPS Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Welcome to Python HTTPS Server</h1>
    <p>Server is running successfully!</p>
    <p>Current time: <span id="time"></span></p>
    <script>
        document.getElementById('time').textContent = new Date().toLocaleString();
    </script>
</body>
</html>"""
        with open(index_file, 'w', encoding='utf-8') as f:
            f.write(index_content)
        print(f"Created default index.html at: {index_file}")
    
    # Generate SSL certificate if needed
    try:
        generate_self_signed_cert()
    except ImportError:
        print("Error: Required packages not installed.")
        print("Install with: pip install pyopenssl cryptography")
        sys.exit(1)
    
    # Create HTTP server with SSL
    httpd = http.server.HTTPServer(('localhost', PORT), HTTPSRequestHandler)
    
    # Wrap socket with SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(CERT_FILE, KEY_FILE)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"HTTPS Server started on https://localhost:{PORT}")
    print("Press Ctrl+C to stop the server")
    print("Note: Browser will warn about self-signed certificate - this is expected")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    except Exception as e:
        print(f"Server error: {e}")

if __name__ == '__main__':
    # Check if running as administrator (required for port 443 on most systems)
    if os.name == 'nt' and not os.environ.get('USERNAME') == 'Administrator':
        print("Warning: On Windows, you may need to run as Administrator for port 443")
    
    main()
