"""创建可交付源码包；排除依赖、临时缓存、个人档案数据库和环境密钥。"""

from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {
    "node_modules",
    ".venv",
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}


def files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or any(
            part in EXCLUDED for part in path.relative_to(ROOT).parts
        ):
            continue
        if path.name == ".env" or ".sqlite3" in path.name or path.suffix == ".zip":
            continue
        yield path


if __name__ == "__main__":
    target = ROOT.parent / "lingua-vue-fastapi.zip"
    entries = list(files())
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
        for path in entries:
            archive.write(
                path, "lingua-vue-fastapi/" + path.relative_to(ROOT).as_posix()
            )
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(entries)
    print(
        json.dumps(
            {
                "archive": str(target),
                "files": len(entries),
                "bytes": target.stat().st_size,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            },
            ensure_ascii=False,
        )
    )
