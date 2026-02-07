#!/usr/bin/env python
"""
Stamm — Single-command startup.

Usage:
    python start.py                          # Start server on port 8000
    python start.py --port 3000              # Custom port
    python start.py --build                  # Rebuild frontend first
    python start.py --ingest path/to/file.ged  # Ingest a GEDCOM then start
"""
import os
import sys
import subprocess
import argparse

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
DIST_DIR = os.path.join(FRONTEND_DIR, "dist")
DB_PATH = os.path.join(ROOT, "data", "ancestry.db")


def build_frontend():
    print("[build] Building frontend...")
    subprocess.check_call(["npm", "run", "build"], cwd=FRONTEND_DIR, shell=True)
    print("[build] Frontend built successfully.\n")


def ingest_file(filepath):
    print("[ingest] Ingesting: {}".format(filepath))
    subprocess.check_call(
        [sys.executable, "-m", "ingestion.cli", "ingest", filepath, "--non-interactive"],
        cwd=ROOT,
    )
    print("[ingest] Done.\n")


def start_server(host, port):
    has_dist = os.path.isdir(os.path.join(DIST_DIR, "assets"))
    has_db = os.path.isfile(DB_PATH)

    if not has_db:
        print("[warn] No database found at {}".format(DB_PATH))
        print("       Run: python -m ingestion.cli ingest <your_file.ged>")
        print()

    if has_dist:
        print("[server] Serving frontend from frontend/dist/")
    else:
        print("[warn] No frontend build found. Run with --build or:")
        print("       cd frontend && npm run build")
        print()

    print("[server] Starting at http://{}:{}".format(host, port))
    print("[server] API docs at http://{}:{}/docs".format(host, port))
    print()

    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        log_level="info",
    )


def main():
    parser = argparse.ArgumentParser(description="Stamm — start the server")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--build", action="store_true", help="Rebuild frontend before starting")
    parser.add_argument("--ingest", metavar="FILE", help="Ingest a GEDCOM file before starting")
    args = parser.parse_args()

    os.chdir(ROOT)
    sys.path.insert(0, ROOT)

    if args.ingest:
        ingest_file(args.ingest)

    if args.build:
        build_frontend()

    start_server(args.host, args.port)


if __name__ == "__main__":
    main()
