"""Serve the design gallery without stale HTML, scripts, or artwork caches."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class GalleryHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5180)
    args = parser.parse_args()
    handler = partial(GalleryHandler, directory=str(Path(__file__).resolve().parent))
    print(f'Gallery listening on 0.0.0.0:{args.port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', args.port), handler).serve_forever()
