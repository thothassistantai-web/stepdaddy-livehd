#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
pkg update -y
pkg install -y python rust clang libcurl openssl nghttp2 redis
python -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel setuptools
pip install -r requirements.txt
# lock reflex to project baseline
pip install "reflex==0.8.13" "fastapi==0.118.0" "curl-cffi==0.13.0" "httpx[http2]==0.28.1" "python-dateutil==2.9.0"
