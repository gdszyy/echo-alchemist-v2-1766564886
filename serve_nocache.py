#!/usr/bin/env python3
"""无缓存 HTTP 服务器，用于开发调试"""
import http.server
import os

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        pass  # 静默日志

if __name__ == '__main__':
    os.chdir('/home/ubuntu/echo-alchemist-v2-1766564886')
    server = http.server.HTTPServer(('', 8080), NoCacheHTTPRequestHandler)
    print('Serving on port 8080 (no-cache)')
    server.serve_forever()
