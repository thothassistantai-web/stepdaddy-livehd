#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }

REQUIRED_FILES=(
  "StepDaddyLiveHD/backend.py"
  "StepDaddyLiveHD/backend_termux_app.py"
  "StepDaddyLiveHD/step_daddy.py"
  "StepDaddyLiveHD/meta.json"
  "requirements.txt"
  "webui/index.html"
)

RUNTIME_DIRS=(
  ".states"
  "logs"
  "logo-cache"
)

echo "=== StepDaddyLiveHD Mobile Installer ==="
echo ""
echo "Installing Termux packages..."
pkg update -y
pkg install -y python git curl tar gzip ffmpeg procps

if [ ! -d venv ]; then
  python -m venv venv
  ok "Created virtual environment at $PROJECT_DIR/venv"
else
  ok "Reusing existing virtual environment at $PROJECT_DIR/venv"
fi

# shellcheck disable=SC1091
source venv/bin/activate

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
ok "Installed Python dependencies"

for dir in "${RUNTIME_DIRS[@]}"; do
  mkdir -p "$dir"
  ok "Ensured directory: $dir"
done

for file in "${REQUIRED_FILES[@]}"; do
  [ -e "$file" ] || fail "Missing required file: $file"
  ok "Validated required file: $file"
done

if [ -L "$HOME/storage/downloads" ] || [ -d "$HOME/storage/downloads" ]; then
  ok "Shared downloads path available: $HOME/storage/downloads"
else
  warn "Shared downloads path unavailable. Run termux-setup-storage if backups must be written to ~/storage/downloads."
fi

# Validate runtime imports
python - <<'PY'
import importlib
mods = ["fastapi", "httpx", "pydantic", "jinja2", "uvicorn", "websockets"]
missing = []
for mod in mods:
    try:
        importlib.import_module(mod)
    except Exception:
        missing.append(mod)
if missing:
    raise SystemExit(f"Missing runtime imports after install: {', '.join(missing)}")
print("Runtime import validation passed.")
PY

# Create .env.termux from example if it doesn't exist
if [ ! -f .env.termux ]; then
  cp .env.example .env.termux
  ok "Created .env.termux from template (edit to customize)"
fi

TERMUX_BOOT_DIR="$HOME/.termux/boot"
TERMUX_BOOT_SCRIPT="$TERMUX_BOOT_DIR/start-stepdaddy.sh"
mkdir -p "$TERMUX_BOOT_DIR"
cat > "$TERMUX_BOOT_SCRIPT" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$PROJECT_DIR"
export PATH="/data/data/com.termux/files/usr/bin:\$PATH"

termux-wake-lock >/dev/null 2>&1 || true
cd "\$ROOT"
exec bash start.sh
EOF
chmod 755 "$TERMUX_BOOT_SCRIPT"
ok "Installed Termux boot hook at $TERMUX_BOOT_SCRIPT"

ok "Installation completed successfully"
echo ""
echo "Next step: ./start.sh"
