"""Remove a local audio shard only after every section has been published."""

import argparse
import json
import os
import re
import shutil
import stat
import time
from pathlib import Path


WEB = Path(__file__).resolve().parents[1]
WORK = (WEB / "work").resolve()


def retry_readonly(remove, path, _error):
    """Git marks some Windows checkout objects read-only."""
    os.chmod(path, stat.S_IWRITE)
    remove(path)


def main(group_id: str, shard_name: str) -> None:
    if not re.fullmatch(r"act\d+side", group_id):
        raise ValueError("Invalid story group")
    if not re.fullmatch(r"vot-audio-\d{8}", shard_name):
        raise ValueError("Invalid audio shard")

    log_path = WORK / f"publish-{group_id}.log"
    shard = (WORK / shard_name).resolve()
    lines_file = (WORK / f"pages-lines-{group_id}.json").resolve()
    if shard.parent != WORK or lines_file.parent != WORK:
        raise ValueError("Cleanup targets must stay directly inside web/work")

    catalog = json.loads((WEB / "pages/catalog.json").read_text("utf-8"))
    group = next(item for item in catalog if item["id"] == group_id)
    expected = [item["id"] for item in group["chapters"]]
    completion = f"DONE {group_id} {len(expected)} sections"
    while True:
        if log_path.exists():
            log = log_path.read_text("utf-8", errors="replace")
            if re.search(rf"\bFAILED\b", log):
                raise RuntimeError("Publisher failed; local audio was retained")
            if completion in log:
                break
        time.sleep(30)

    manifest = json.loads((WEB / "pages/audio-manifest.json").read_text("utf-8"))
    voiced = json.loads((WEB / "pages/voiced-chapters.json").read_text("utf-8"))
    if any(key not in voiced or not manifest.get(key) for key in expected):
        raise RuntimeError("Some sections are not in the published audio manifest")
    site = f"https://luoul-123.github.io/{shard_name}/"
    sites = json.loads((WEB / "pages/audio-sites.json").read_text("utf-8"))
    if sites["prefixes"].get(f"activities/{group_id}/") != site:
        raise RuntimeError("Audio shard URL does not match the published configuration")

    if shard.is_dir():
        shutil.rmtree(shard, onerror=retry_readonly)
    if lines_file.is_file():
        lines_file.unlink()
    print(f"Published {len(expected)} sections; local shard and generated line list removed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", required=True)
    parser.add_argument("--shard", required=True)
    args = parser.parse_args()
    main(args.group, args.shard)
