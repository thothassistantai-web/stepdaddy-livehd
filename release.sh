#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
version_file="$repo_root/VERSION"
version="$(tr -d '[:space:]' < "$version_file")"

if [[ -z "${version}" ]]; then
  echo "VERSION is empty" >&2
  exit 1
fi

archive_dir="$repo_root/release"
mkdir -p "$archive_dir"

name="stepdaddy-live-hd-mobile-${version}"

# Build from tracked files using git archive if in a git repo, fallback to tar
if git -C "$repo_root" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$repo_root" archive --format=tar.gz --prefix="${name}/" -o "${archive_dir}/${name}.tar.gz" HEAD
  git -C "$repo_root" archive --format=zip --prefix="${name}/" -o "${archive_dir}/${name}.zip" HEAD
else
  # Fallback: just tar the directory excluding unwanted paths
  tar czf "${archive_dir}/${name}.tar.gz" \
    --exclude='.git' \
    --exclude='venv' \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='release' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    -C "$(dirname "$repo_root")" \
    --transform "s|^$(basename "$repo_root")|${name}|" \
    "$(basename "$repo_root")"
  (cd "$(dirname "$repo_root")" && zip -rq "${archive_dir}/${name}.zip" "$(basename "$repo_root")" \
    --exclude "$(basename "$repo_root")/.git/*" \
    --exclude "$(basename "$repo_root")/venv/*" \
    --exclude "$(basename "$repo_root")/.venv/*" \
    --exclude "$(basename "$repo_root")/__pycache__/*" \
    --exclude "$(basename "$repo_root")/release/*" \
    --exclude "$(basename "$repo_root")/*.pyc" \
    --exclude "$(basename "$repo_root")/.DS_Store")
fi

cat <<EOF
Created:
  ${archive_dir}/${name}.tar.gz
  ${archive_dir}/${name}.zip
EOF
