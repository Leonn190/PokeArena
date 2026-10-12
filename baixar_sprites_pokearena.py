#!/usr/bin/env python3
"""
PokeArena: baixa sprites reais do PMDCollab para as 100 especies compraveis,
mais evolucoes normais (sem Mega), produz public/sprites/manifest.json e
compacta o public completo em PokeArena_public_com_sprites.zip.

Uso (Windows, na raiz do repositorio):
    py baixar_sprites_pokearena.py
Ou:
    py baixar_sprites_pokearena.py "C:\\caminho\\PokeArena"

Usa somente a biblioteca padrao do Python. Necessita de acesso a internet
no computador onde e executado. Respeite a licenca CC BY-NC 4.0 do PMDCollab.
"""
from __future__ import annotations

import concurrent.futures
import json
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

# Ids conforme server/game/pokemon.mjs (100 Pokemon compraveis e 115 evolucoes/formas).
# A inclusao da forma do Urshifu usa caminhos separados, sem qualquer Mega.
IDS = '''0001,0007,0004,0013,0010,0060,0066,0273,0270,0582,0761,0129,0568,0174,0172,0173,0440,0446,0767,0712,0041,0092,0063,0081,0280,0255,0363,0393,0656,0653,0728,0025,0133,0039,0331,0361,0557,0318,0320,0333,0714,0702,0562,0718,0532,0459,0304,0111,0607,0669,0722,0725,0856,0859,0113,0570,0622,0708,0040,0147,0443,0246,0633,0679,0447,0624,0131,0143,0621,0778,0701,0359,0950,0794,0095,0123,0796,0799,0214,0227,0789,0891,0808,0151,0648,0719,0721,0807,0491,0801,0385,0150,0716,0717,0890,0384,0382,0383,0484,0483,0002,0003,0005,0006,0008,0009,0014,0015,0011,0012,0061,0062,0186,0067,0068,0274,0275,0271,0272,0583,0584,0762,0763,0130,0569,0026,0035,0036,0242,0768,0713,0042,0169,0093,0094,0064,0065,0082,0462,0281,0282,0475,0256,0257,0364,0365,0394,0395,0657,0658,0654,0655,0729,0730,0134,0135,0136,0196,0197,0470,0471,0700,0332,0362,0478,0558,0319,0321,0334,0715,0563,0533,0534,0460,0305,0306,0112,0464,0608,0609,0670,0671,0723,0724,0726,0727,0857,0858,0860,0861,0571,0623,0709,0148,0149,0444,0445,0247,0248,0634,0635,0680,0681,0448,0625,0983,0208,0212,0900,0790,0791,0792,0892-dec,0892-flu,0809'''.split(',')

# O prototipo usa estas animacoes, nesta prioridade (server/game/moves.mjs).
WANTED = ('Idle','Walk','Attack','Hurt','Shoot','SpAttack','Special',
          'Charge','Tackle','Rush','Strike','Slash','Cut','Scratch')
SOURCE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/'
UA = 'PokeArena-asset-importer/1.0 (non-commercial fan project; credit PMDCollab)'
print_lock = threading.Lock()


def request(remote: str) -> bytes | None:
    url = SOURCE + urllib.parse.quote(remote, safe='/')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=35) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code not in (429,500,502,503,504):
                return None
        except (TimeoutError, OSError, urllib.error.URLError):
            pass
        time.sleep(1 + (2 ** attempt))
    return None


def source_folder(pokemon_id: str) -> str:
    if pokemon_id == '0892-dec':
        return 'sprite/0892'
    if pokemon_id == '0892-flu':
        return 'sprite/0892/0001'
    return f'sprite/{pokemon_id}'


def valid_existing(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 70:
        return False
    if path.suffix.lower() == '.png':
        with path.open('rb') as f:
            return f.read(8) == b'\x89PNG\r\n\x1a\n'
    return True


def obtain(remote: str, target: Path) -> bool:
    if valid_existing(target):
        return True
    data = request(remote)
    if not data:
        return False
    if target.suffix.lower() == '.png' and not data.startswith(b'\x89PNG\r\n\x1a\n'):
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + '.downloading')
    partial.write_bytes(data)
    partial.replace(target)
    return True


def anim_metadata(xml: bytes) -> dict[str, dict]:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return {}
    anims = {node.findtext('Name'): node for node in root.findall('./Anims/Anim')
             if node.findtext('Name')}

    def resolve(name: str, seen: frozenset[str] = frozenset()):
        if name in seen:
            return None
        entry = anims.get(name)
        if entry is None:
            return None
        copy_of = entry.findtext('CopyOf')
        if copy_of:
            return resolve(copy_of, seen | {name})
        try:
            width, height = int(entry.findtext('FrameWidth') or 0), int(entry.findtext('FrameHeight') or 0)
            durations = [int(item.text) for item in entry.findall('./Durations/Duration')]
            hit_frame = int(entry.findtext('HitFrame') or 0)
        except (ValueError, TypeError):
            return None
        if width < 1 or height < 1 or not durations:
            return None
        return {'width':width, 'height':height, 'durations':durations,
                'hitFrame': hit_frame, 'asset':name}

    return {name:meta for name in WANTED if (meta := resolve(name)) is not None}


def handle(pokemon_id: str, sprite_dir: Path):
    directory = sprite_dir / pokemon_id
    src = source_folder(pokemon_id)
    xml = directory / 'AnimData.xml'
    if not obtain(f'{src}/AnimData.xml',xml):
        return pokemon_id, {}, 'AnimData.xml nao disponivel'
    metadata = anim_metadata(xml.read_bytes())
    downloaded = set()
    present = {}
    for name, meta in metadata.items():
        asset = meta['asset']
        if asset not in downloaded:
            downloaded.add(asset)
            obtain(f'{src}/{asset}-Anim.png',directory / f'{asset}-Anim.png')
        if valid_existing(directory / f'{asset}-Anim.png'):
            present[name] = meta
    # Se faltar Idle, usamos Walk para que o renderer nao deixe o Pokemon invisivel.
    if 'Idle' not in present and 'Walk' in present:
        present['Idle'] = dict(present['Walk'])
    # Os creditos sao distribuidos pelos autores na pasta de cada Pokemon.
    obtain(f'{src}/credits.txt',directory / 'credits.txt')
    if not present:
        return pokemon_id, {}, 'nenhuma animacao compativel disponivel'
    return pokemon_id, present, ''


def main():
    repo = Path(sys.argv[1] if len(sys.argv)>1 else '.').expanduser().resolve()
    public = repo / 'public'
    if not public.is_dir():
        print(f'ERRO: nao achei a pasta public em {repo}. Execute na raiz do PokeArena.')
        sys.exit(2)
    sprites = public / 'sprites'
    sprites.mkdir(exist_ok=True)
    print(f'Pasta: {public}\nTotal de representacoes: {len(IDS)} (100 compraveis + 115 evolucoes/formas).')
    print('Baixando sprites PMDCollab: pode levar alguns minutos.\n')
    manifest = {'version':3, 'pokemon':{}}
    missing = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        tasks = {pool.submit(handle, pokemon_id, sprites):pokemon_id for pokemon_id in IDS}
        for index,future in enumerate(concurrent.futures.as_completed(tasks),1):
            try:
                pokemon_id, entries, issue = future.result()
            except Exception as exc:
                pokemon_id,entries,issue=tasks[future],{},str(exc)
            if entries:
                manifest['pokemon'][pokemon_id] = entries
            else:
                missing.append(f'{pokemon_id}: {issue}')
            with print_lock:
                print(f'[{index:3}/{len(IDS)}] {pokemon_id} - {len(entries)} animacoes'
                      + (f' - {issue}' if issue else ''),flush=True)

    manifest['pokemon'] = dict(sorted(manifest['pokemon'].items()))
    (sprites / 'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (sprites / 'ORIGEM_E_CREDITOS.md').write_text(
        '# Sprites Pokemon Mystery Dungeon - PMDCollab\n\n'
        'Fonte: https://github.com/PMDCollab/SpriteCollab\n\n'
        'Licenca do projeto: **CC BY-NC 4.0** (uso nao comercial e atribuicao).\n'
        'Consulta: https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md\n\n'
        'Os autores/contribuidores de cada sprite estao indicados em `XXXX/credits.txt` '
        'quando fornecidos pelo repositorio. Conserve estes arquivos ao redistribuir.\n\n'
        'Arquivos obtidos de sprites originais e colaborativos. Sem Megaevolucoes.\n',encoding='utf-8')
    report = ('PokeArena - Relatorio de sprites PMDCollab\n'
              f'Pedidos: {len(IDS)}\nCom pelo menos uma animacao: {len(manifest["pokemon"])}\n'
              f'Sem animacao: {len(missing)}\n\n'
              + '\n'.join(missing) + '\n')
    (repo / 'RELATORIO_SPRITES_POKEARENA.txt').write_text(report,encoding='utf-8')
    zip_path = repo / 'PokeArena_public_com_sprites.zip'
    with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as zf:
        for path in sorted(public.rglob('*')):
            if path.is_file() and not path.name.endswith('.downloading'):
                zf.write(path,arcname=path.relative_to(repo).as_posix())
    print('\n'+report)
    print(f'ZIP FINAL CRIADO: {zip_path}')
    print('IMPORTANTE: se houver Pokemon sem assets, o relatorio explicita cada ausencia.')

if __name__=='__main__':
    main()
