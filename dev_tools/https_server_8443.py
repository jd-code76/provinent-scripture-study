# Simple Python HTTPS Web Server for Provinent Scripture Study
# Requires: pip install pyopenssl
# Run with: python https_server.py

import http.server
import ssl
import os
import sys
from pathlib import Path
import datetime

# Configuration - Changed from 443 to 8443 to avoid permission issues
PORT = 8443
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

    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return

    print("Generating self-signed certificate...")

    # Generate private key
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    # Generate certificate - using timezone-aware datetime
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "State"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "City"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Provinent Scripture Study"),
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
        datetime.datetime.now(datetime.UTC)
    ).not_valid_after(
        datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=365)
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
        # Security check - prevent path traversal first
        requested_path = Path(self.translate_path(self.path))
        web_root = Path(WEB_ROOT).resolve()

        try:
            if not requested_path.resolve().is_relative_to(web_root):
                self.send_error(403, "Forbidden")
                return
        except:
            self.send_error(403, "Forbidden")
            return

        # Check if the requested file exists
        original_path = self.path
        file_path = WEB_ROOT / original_path.lstrip('/')

        # If the file doesn't exist, serve index.html for SPA routing
        if not file_path.exists() or file_path.is_dir():
            # For SPA: serve index.html for any non-existent file path
            # but only if it looks like a SPA route (not a static file extension)
            path_parts = original_path.split('.')
            if len(path_parts) > 1:
                # This has a file extension, check if it's a static file type
                file_ext = path_parts[-1].lower()
                static_extensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg',
                                   'ttf', 'woff', 'woff2', 'pdf', 'json', 'xml', 'txt']
                if file_ext in static_extensions:
                    # This is a static file that should exist but doesn't - 404
                    self.send_error(404, "File not found")
                    return

            # Serve index.html for SPA routes
            self.path = '/index.html'

        return super().do_GET()

    def log_message(self, format, *args):
        # Custom logging format to show SPA routing
        print(f"{self.address_string()} - {self.log_date_time_string()} - {format % args}")

def main():
    # Create web root directory if it doesn't exist
    WEB_ROOT.mkdir(exist_ok=True)
    print(f"Web root directory: {WEB_ROOT.resolve()}")

    # Generate SSL certificate if needed
    try:
        generate_self_signed_cert()
    except ImportError:
        print("Error: Required packages not installed.")
        print("Install with: pip install pyopenssl cryptography")
        sys.exit(1)

    # Create HTTP server with SSL - fixed to use 8443
    try:
        httpd = http.server.HTTPServer(('localhost', PORT), HTTPSRequestHandler)
    except PermissionError:
        print(f"Error: Permission denied for port {PORT}.")
        print(f"Try using a different port (like 8443) or run with sudo if using port < 1024.")
        sys.exit(1)

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
    main()
