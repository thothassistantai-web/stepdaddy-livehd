#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
pkg update -y
pkg install -y python rust clang libcurl openssl nghttp2
python -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel setuptools
pip install -r requirements-termux-backend.txt
