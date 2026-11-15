"""Cache one catalog story's source text for the static Pages reader."""
import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

WEB = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/cn/gamedata/story/'


def fetch(chapter, target):
    slug = chapter['id'].split('/')[-1]
    url = SOURCE + chapter['id'] + '.txt'
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'VoiceOfTerra'}), timeout=25) as response:
                text = response.read().decode('utf-8-sig')
            if len(text) < 30 or text.lstrip().startswith('<'):
                raise ValueError('Invalid story text: ' + url)
            text = '\n'.join(line.rstrip() for line in text.splitlines()) + '\n'
            (target / (slug + '.txt')).write_text(text, encoding='utf-8')
            return slug, len(text)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def main(group_id):
    catalog = json.loads((WEB / 'pages/catalog.json').read_text('utf-8'))
    group = next((item for item in catalog if item['id'] == group_id), None)
    if not group or not group['chapters']:
        raise ValueError('Story group missing: ' + group_id)
    if any(not chapter['id'].startswith(f'activities/{group_id}/level_') for chapter in group['chapters']):
        raise ValueError('Unexpected chapter path')
    target = WEB / 'pages/public/story' / group_id
    target.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks = [pool.submit(fetch, chapter, target) for chapter in group['chapters']]
        results = [task.result() for task in as_completed(tasks)]
    print(f'{group["title"]}: {len(results)} source files, {sum(size for _, size in results)} characters')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('group_id')
    main(parser.parse_args().group_id)
