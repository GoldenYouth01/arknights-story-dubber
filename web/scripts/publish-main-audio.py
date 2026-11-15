"""Resume main story audio publication in release order, cleaning finished shards."""
import json
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
WORK = (WEB / 'work').resolve()
CATALOG = json.loads((WEB / 'pages/catalog.json').read_text('utf-8'))
SHARDS = {
    'main_0': 'vot-audio-20190430',
    'main_1': 'vot-audio-20190430',
    'main_2': 'vot-audio-20190430',
    'main_3': 'vot-audio-20190430',
    'main_4': 'vot-audio-20190430',
    'main_5': 'vot-audio-20190709',
    'main_6': 'vot-audio-20191224',
    'main_7': 'vot-audio-20200501',
}


def group_chapters(group_id):
    return next(group['chapters'] for group in CATALOG if group['id'] == group_id)


def completed(group_id):
    manifest = json.loads((WEB / 'pages/audio-manifest.json').read_text('utf-8'))
    voiced = set(json.loads((WEB / 'pages/voiced-chapters.json').read_text('utf-8')))
    return all(chapter['id'] in voiced and manifest.get(chapter['id'])
               for chapter in group_chapters(group_id))


def retry_readonly(remove, path, _error):
    os.chmod(path, stat.S_IWRITE)
    remove(path)


def clean_shard(shard_name):
    groups = [group for group, name in SHARDS.items() if name == shard_name]
    if not all(completed(group) for group in groups):
        return
    shard = (WORK / shard_name).resolve()
    if shard.parent != WORK or not shard.is_dir():
        return
    if not (shard / '.git').is_dir():
        raise RuntimeError(f'Not an audio checkout: {shard}')
    if subprocess.run(['git', 'status', '--porcelain'], cwd=shard,
                      capture_output=True, text=True, check=True).stdout.strip():
        raise RuntimeError(f'Audio checkout has unpublished files: {shard}')
    shutil.rmtree(shard, onerror=retry_readonly)
    print(f'Local audio checkout removed after publication: {shard_name}', flush=True)


def main():
    for group_id, shard_name in SHARDS.items():
        if not completed(group_id):
            shard = WORK / shard_name
            if not (shard / '.git').is_dir():
                raise RuntimeError(f'Audio checkout missing: {shard}')
            print(f'Publishing {group_id} to {shard_name}', flush=True)
            subprocess.run([sys.executable, 'scripts/publish-audio-sections.py',
                            '--group', group_id, '--shard', shard_name],
                           cwd=WEB, check=True)
        if not completed(group_id):
            raise RuntimeError(f'Incomplete publication: {group_id}')
        lines_file = (WORK / f'pages-lines-{group_id}.json').resolve()
        if lines_file.parent == WORK:
            lines_file.unlink(missing_ok=True)
        if group_id in ('main_4', 'main_5', 'main_6', 'main_7'):
            clean_shard(shard_name)
    print('DONE main_0-main_7', flush=True)


if __name__ == '__main__':
    main()
