import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, List, Optional

# Resolves to backend/logs/ regardless of working directory
LOG_DIR  = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "app.log"

LOG_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging() -> logging.Logger:
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()
    root.addHandler(file_handler)
    root.addHandler(console_handler)

    return logging.getLogger("app")


def read_logs(lines: int = 100, level: Optional[str] = None) -> List[Dict]:
    if not LOG_FILE.exists():
        return []
    try:
        with open(str(LOG_FILE), "r", encoding="utf-8") as f:
            all_lines = f.readlines()
        recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
        entries = []
        for line in recent:
            line = line.strip()
            if not line:
                continue
            entry = _parse(line)
            if entry and (not level or entry["level"] == level.upper()):
                entries.append(entry)
        return entries
    except Exception as e:
        return [{"timestamp": "", "level": "ERROR", "logger": "system", "message": str(e)}]


def _parse(line: str) -> Optional[Dict]:
    try:
        parts = line.split(" | ", 3)
        if len(parts) >= 4:
            return {"timestamp": parts[0], "level": parts[1].strip(), "logger": parts[2], "message": parts[3]}
        if len(parts) == 3:
            return {"timestamp": parts[0], "level": parts[1].strip(), "logger": "unknown", "message": parts[2]}
        return {"timestamp": "", "level": "INFO", "logger": "unknown", "message": line}
    except Exception:
        return None


def get_log_stats() -> Dict:
    if not LOG_FILE.exists():
        return {"file_size_human": "0 B", "total_lines": 0}
    size = LOG_FILE.stat().st_size
    with open(str(LOG_FILE), "r", encoding="utf-8") as f:
        total = sum(1 for _ in f)
    if size < 1024:
        human = f"{size} B"
    elif size < 1024 * 1024:
        human = f"{size / 1024:.1f} KB"
    else:
        human = f"{size / (1024 * 1024):.1f} MB"
    return {"file_size_human": human, "total_lines": total}
