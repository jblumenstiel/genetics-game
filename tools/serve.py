"""Local dev server that disables caching, so edited modules always reload.

Usage: python3 tools/serve.py [port]   (serves the project root; default port 8000)
"""

import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The browser fetches many modules at once; the default queue of 5 overflows and resets connections.
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    Server(("", port), NoCacheHandler).serve_forever()
