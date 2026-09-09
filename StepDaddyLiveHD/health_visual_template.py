"""Visual health dashboard HTML for /health/visual.

Recovered via bytecode loader after accidental rsync --delete removed the .py source.
"""
from __future__ import annotations

import marshal
from pathlib import Path

_PYC = Path(__file__).resolve().parent / "__pycache__" / "health_visual_template.recovered.pyc"
if not _PYC.is_file():
    _PYC = Path(__file__).resolve().parent / "__pycache__" / "health_visual_template.cpython-312.pyc"
if not _PYC.is_file():
    raise ImportError(f"Missing recovered health_visual_template bytecode under {Path(__file__).parent / '__pycache__'}")

exec(marshal.loads(_PYC.read_bytes()[16:]), globals())
