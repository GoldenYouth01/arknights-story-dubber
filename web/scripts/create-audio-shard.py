"""Create a public GitHub Pages repository for a story's generated audio."""
import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

WEB = Path(__file__).resolve().parents[1]
OWNER = 'luoul-123'
API = 'https://api.github.com'


def credential():
    result = subprocess.run(['git', 'credential', 'fill'], input='protocol=https\nhost=github.com\n\n',
                            text=True, capture_output=True, check=True)
    values = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    if not values.get('password'):
        raise RuntimeError('GitHub credential is unavailable')
    return values['password']


def request(method, path, token, data=None):
    body = json.dumps(data).encode('utf-8') if data is not None else None
    headers = {'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token,
               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'VoiceOfTerra'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    try:
        with urlopen(Request(API + path, data=body, headers=headers, method=method), timeout=30) as response:
            return response.status, json.loads(response.read() or b'{}')
    except HTTPError as error:
        try:
            message = json.loads(error.read()).get('message', 'GitHub API error')
        except (ValueError, OSError):
            message = 'GitHub API error'
        if error.code == 404 and method == 'GET':
            return 404, {}
        raise RuntimeError(f'GitHub API {method} {path}: {error.code} {message}') from None


def git(*args, cwd):
    subprocess.run(['git', *args], cwd=cwd, check=True)


def main(group_id, repo):
    if not re.fullmatch(r'act[0-9]+side', group_id) or not re.fullmatch(r'vot-audio-[0-9]{8}', repo):
        raise ValueError('Invalid story or shard name')
    catalog = json.loads((WEB / 'pages/catalog.json').read_text('utf-8'))
    group = next((item for item in catalog if item['id'] == group_id), None)
    if not group:
        raise ValueError('Story group missing')
    checkout = WEB / 'work' / repo
    token = credential()
    status, _ = request('GET', f'/repos/{OWNER}/{repo}', token)
    if checkout.exists():
        if status != 200 or not (checkout / '.git').is_dir():
            raise RuntimeError('Existing audio checkout does not match a GitHub repository')
        origin = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=checkout,
                                text=True, capture_output=True, check=True).stdout.strip()
        if origin != f'https://github.com/{OWNER}/{repo}.git':
            raise RuntimeError('Existing audio checkout has an unexpected remote')
    else:
        if status != 404:
            raise RuntimeError('Remote audio shard repository already exists')
        request('POST', '/user/repos', token, {'name': repo, 'private': False,
                                             'description': f'Voice of Terra · {group["title"]} 凯尔希配音分站',
                                             'has_issues': False, 'has_wiki': False})
        checkout.mkdir(parents=True)
        (checkout / '.nojekyll').touch()
        (checkout / 'README.md').write_text(
            f'# Voice of Terra · {group["title"]}配音分站\n\n'
            f'本仓库存放《{group["title"]}》的凯尔希音色 MP3，供[主网页]'
            f'(https://luoul-123.github.io/voice-of-terra-for-arknights/)读取。\n'
            f'音频为非官方同人合成内容；剧情和角色版权归原权利人所有。\n', encoding='utf-8')
        git('init', '-b', 'main', cwd=checkout)
        git('remote', 'add', 'origin', f'https://github.com/{OWNER}/{repo}.git', cwd=checkout)
    author = subprocess.run(['git', 'log', '-1', '--format=%an%n%ae'], cwd=WEB.parent,
                            text=True, capture_output=True, check=True).stdout.splitlines()
    git('config', 'user.name', author[0], cwd=checkout)
    git('config', 'user.email', author[1], cwd=checkout)
    git('add', '.nojekyll', 'README.md', cwd=checkout)
    if subprocess.run(['git', 'rev-parse', '--verify', 'HEAD'], cwd=checkout,
                      capture_output=True).returncode:
        git('commit', '-m', f'Initialize {group["title"]} audio Pages shard', cwd=checkout)
    git('-c', 'http.version=HTTP/1.1', '-c', 'http.proxy=http://127.0.0.1:7897',
        'push', '-u', 'origin', 'main', cwd=checkout)
    pages_status, _ = request('GET', f'/repos/{OWNER}/{repo}/pages', token)
    if pages_status == 404:
        request('POST', f'/repos/{OWNER}/{repo}/pages', token,
                {'source': {'branch': 'main', 'path': '/'}})
    print(f'https://luoul-123.github.io/{repo}/')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('group_id')
    parser.add_argument('repo')
    args = parser.parse_args()
    main(args.group_id, args.repo)
