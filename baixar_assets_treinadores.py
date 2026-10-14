#!/usr/bin/env python3
"""Baixa assets para PokeArena/public sem alterar JS, CSS ou assets existentes.

Instalacao: py -m pip install Pillow
Execucao:  py baixar_assets_treinadores.py
Opcional:  py baixar_assets_treinadores.py --repo C:\\caminho\\PokeArena
           py baixar_assets_treinadores.py --force

Os caminhos do manifest sao relativos ao public/. Em Astro/GitHub Pages, use:
`${import.meta.env.BASE_URL}${caminhoDoManifest}`
"""

from __future__ import annotations

import argparse
from io import BytesIO
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from PIL import Image
except ImportError:
    sys.exit("Instale o Pillow primeiro: py -m pip install Pillow")

PRET = "https://raw.githubusercontent.com/pret/pokeemerald/master/"
SHOWDOWN = "https://play.pokemonshowdown.com/sprites/typeicons/"

# Os oito sprites de overworld abaixo tem nove frames (9 x 16 px),
# conferidos no repositorio original de Pokemon Emerald.
# battle_back existe para os seis primeiros; Archie/Maxie usam um efeito adaptado.
TRAINERS = {
    "red": ("Red", "red.png", "red.png", "red.png"),
    "leaf": ("Leaf", "leaf.png", "leaf.png", "leaf.png"),
    "brendan": ("Brendan", "brendan/walking.png", "brendan.png", "brendan.png"),
    "may": ("May", "may/walking.png", "may.png", "may.png"),
    "wally": ("Wally", "wally.png", "wally.png", "wally.png"),
    "steven": ("Steven", "steven.png", "steven.png", "steven.png"),
    "archie": ("Archie", "team_aqua/archie.png", "aqua_leader_archie.png", None),
    "maxie": ("Maxie", "team_magma/maxie.png", "magma_leader_maxie.png", None),
}

TYPES = (
    "normal", "fire", "water", "electric", "grass", "ice",
    "fighting", "poison", "ground", "flying", "psychic", "bug",
    "rock", "ghost", "dragon", "dark", "steel", "fairy",
)

BALLS = {
    "poke": "poke_ball.png",
    "great": "great_ball.png",
    "ultra": "ultra_ball.png",
    "master": "master_ball.png",
}

# Ordem EXATA de animacao do pret/pokeemerald:
# src/data/object_events/object_event_anims.h, sAnim_GoSouth/North/West/East.
WALK = {
    "down": ((0, 3, 0, 4), False),
    "up": ((1, 5, 1, 6), False),
    "left": ((2, 7, 2, 8), False),
    "right": ((2, 7, 2, 8), True),
}
IDLE = {"down": 0, "up": 1, "left": 2, "right": 2}


def find_repo(arg: str | None) -> Path:
    if arg:
        root = Path(arg).expanduser().resolve()
        if (root / "public").is_dir():
            return root
        sys.exit(f"Nao encontrei public/ em {root}")

    roots = (Path(__file__).resolve().parent, Path.cwd().resolve())
    for base in roots:
        for parent in (base, *base.parents):
            if (parent / "public").is_dir() and (parent / "package.json").is_file():
                return parent
            nested = parent / "PokeArena"
            if (nested / "public").is_dir() and (nested / "package.json").is_file():
                return nested
    sys.exit(
        "Pasta PokeArena nao encontrada. Ponha este .py na raiz do projeto "
        "ou em scripts/, ou use --repo CAMINHO_DA_PASTA_PokeArena"
    )


def png_valid(path: Path) -> bool:
    try:
        with Image.open(path) as im:
            im.verify()
        return True
    except (OSError, ValueError):
        return False


def fetch_png(url: str, destination: Path, force: bool) -> Image.Image:
    if destination.is_file() and not force and png_valid(destination):
        with Image.open(destination) as im:
            print(f"  [cache] {destination.name}")
            return im.convert("RGBA")

    error = None
    for attempt in range(4):
        try:
            req = Request(url, headers={"User-Agent": "PokeArena-asset-collector/1.0"})
            with urlopen(req, timeout=25) as response:
                raw = response.read(8_000_000)
            with Image.open(BytesIO(raw)) as im:
                im.load()  # valida que o download e realmente imagem
                if im.format != "PNG":
                    raise ValueError(f"Esperava PNG, recebi {im.format}")
                rgba = im.convert("RGBA")
            destination.parent.mkdir(parents=True, exist_ok=True)
            # Preservar exatamente o PNG baixado (sem recompressao).
            write_if_changed(destination, raw)
            print(f"  [baixado] {destination.name} ({rgba.width}x{rgba.height})")
            return rgba
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            error = exc
            if attempt != 3:
                time.sleep(0.6 * (attempt + 1))
    raise RuntimeError(f"Falha ao baixar {url}: {error}")


def write_if_changed(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.read_bytes() == data:
        return
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def save_png(image: Image.Image, path: Path) -> None:
    out = BytesIO()
    image.save(out, format="PNG", optimize=True)
    write_if_changed(path, out.getvalue())


def save_gif(frames: list[Image.Image], path: Path, ms: int = 130) -> None:
    """Codifica gif de frames RGBA sem perder o canal alpha de fundo."""
    if not frames:
        return
    # Compartilha a mesma paleta, reservando indice 0 para transparencia.
    # Quantizacao a partir de um atlas evita cores piscando entre os frames.
    w, h = frames[0].size
    if any(f.size != (w, h) for f in frames):
        raise ValueError("Frames GIF precisam ter o mesmo tamanho")

    # Atlas RGB com fundo roxo sentinela ausente da arte. Cores fixas por GIF.
    sample = Image.new("RGB", (w, h * len(frames)), (255, 0, 255))
    for i, frame in enumerate(frames):
        sample.paste(frame.convert("RGB"), (0, h * i), frame.getchannel("A"))
    pal_image = sample.quantize(colors=254, method=Image.Quantize.MEDIANCUT)
    palette = pal_image.getpalette()[:254 * 3]
    # Paleta: 0=transparencia; demais cores quantizadas.
    palette = [255, 0, 255] + palette
    palette += [0] * (768 - len(palette))
    pframes = []
    for frame in frames:
        rgb = Image.new("RGB", frame.size, (255, 0, 255))
        rgb.paste(frame.convert("RGB"), mask=frame.getchannel("A"))
        q = rgb.quantize(palette=pal_image).point(lambda v: v + 1)
        q.putpalette(palette)
        # Pixels alpha=0 => indice 0.
        q.paste(0, mask=frame.getchannel("A").point(lambda x: 255 if x < 128 else 0))
        q.info["transparency"] = 0
        pframes.append(q)
    out = BytesIO()
    pframes[0].save(
        out, format="GIF", save_all=True, append_images=pframes[1:],
        duration=[ms] * len(pframes), loop=0, disposal=2,
        transparency=0, optimize=False,
    )
    write_if_changed(path, out.getvalue())


def webpath(path: Path, public: Path) -> str:
    return path.relative_to(public).as_posix()


def anim_overworld(sheet: Image.Image, folder: Path, public: Path) -> dict:
    if sheet.size != (144, 32):
        raise ValueError(
            f"Overworld inesperado: {sheet.size}, esperado 144x32 "
            "(nove frames de 16x32); fonte pode ter mudado"
        )
    sprites = [sheet.crop((i * 16, 0, (i + 1) * 16, 32)) for i in range(9)]
    files = {"overworld": webpath(folder / "overworld.png", public)}
    for direction, index in IDLE.items():
        idle = sprites[index].transpose(Image.Transpose.FLIP_LEFT_RIGHT) if direction == "right" else sprites[index]
        p = folder / f"idle_{direction}.png"
        save_png(idle, p)
        files[f"idle_{direction}"] = webpath(p, public)
    for direction, (indexes, mirror) in WALK.items():
        frames = [sprites[i] for i in indexes]
        if mirror:
            frames = [im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for im in frames]
        strip = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            strip.alpha_composite(frame, (i * 16, 0))
        p_sheet = folder / f"walk_{direction}_sheet.png"
        p_gif = folder / f"walk_{direction}.gif"
        save_png(strip, p_sheet)
        save_gif(frames, p_gif, 125)
        files[f"walk_{direction}_sheet"] = webpath(p_sheet, public)
        files[f"walk_{direction}"] = webpath(p_gif, public)
    hit = make_hit(sprites[0])
    p_hit = folder / "hit.gif"
    save_gif(hit, p_hit, 95)
    files["hit"] = webpath(p_hit, public)
    return files


def make_hit(idle: Image.Image) -> list[Image.Image]:
    frames = []
    for shift, tinted in ((0, False), (-2, True), (2, True), (-1, False), (1, True), (0, False)):
        canvas = Image.new("RGBA", (24, 32), (0, 0, 0, 0))
        avatar = idle.copy()
        if tinted:
            tint = Image.new("RGBA", avatar.size, (255, 35, 45, 0))
            tint.putalpha(avatar.getchannel("A").point(lambda a: round(a * 0.55)))
            avatar = Image.alpha_composite(avatar, tint)
        canvas.alpha_composite(avatar, (4 + shift, 0))
        frames.append(canvas)
    return frames


def make_original_throw(sheet: Image.Image) -> list[Image.Image]:
    if sheet.width != 64 or sheet.height not in (256, 320):
        raise ValueError(f"Battle back inesperado: {sheet.size}, esperado 64x256/320")
    # As back sprites do jogo sao varios quadros 64x64 na vertical.
    n = sheet.height // 64
    frames = [sheet.crop((0, 64 * i, 64, 64 * (i + 1))) for i in range(n)]
    return [frames[0]] + frames + [frames[-1], frames[0]]


def make_simulated_throw(overworld: Image.Image, ball: Image.Image) -> list[Image.Image]:
    """Fallback para Archie/Maxie: arremesso visual, NAO sprite original de batalha."""
    avatar = overworld.crop((0, 0, 16, 32))
    orb = ball.resize((16, 16), Image.Resampling.NEAREST)
    result = []
    for x, y in ((15, 23), (20, 17), (28, 9), (40, 5), (53, 1), (63, 0)):
        frame = Image.new("RGBA", (80, 48), (0, 0, 0, 0))
        frame.alpha_composite(avatar, (7, 16))
        frame.alpha_composite(orb, (x, y))
        result.append(frame)
    return result


def process_trainer(
    key: str, spec: tuple[str, str, str, str | None],
    root: Path, public: Path, force: bool, poke_ball: Image.Image,
) -> dict:
    name, overworld_name, front_name, back_name = spec
    folder = root / "assets" / "treinadores" / key
    print(f"\n[{name}]")
    overworld_url = PRET + "graphics/object_events/pics/people/" + overworld_name
    world = fetch_png(overworld_url, folder / "overworld.png", force)
    paths = anim_overworld(world, folder, public)

    front_url = PRET + "graphics/trainers/front_pics/" + front_name
    fetch_png(front_url, folder / "battle_front.png", force)
    paths["battle_front"] = webpath(folder / "battle_front.png", public)

    if back_name:
        back_url = PRET + "graphics/trainers/back_pics/" + back_name
        back = fetch_png(back_url, folder / "battle_back_sheet.png", force)
        frames = make_original_throw(back)
        paths["battle_back_sheet"] = webpath(folder / "battle_back_sheet.png", public)
        throw_mode = "original_battle_back_frames"
        throw_origin = back_url
    else:
        frames = make_simulated_throw(world, poke_ball)
        throw_mode = "simulated_with_overworld_and_pokeball"
        throw_origin = overworld_url
    throw_path = folder / "throw.gif"
    save_gif(frames, throw_path, 115)
    paths["throw"] = webpath(throw_path, public)
    print(f"  [gerado] animacoes + spritesheets + hit + throw ({throw_mode})")
    return {
        "name": name,
        "frame_size": [16, 32],
        "walk_sheet": {"frame_width": 16, "frame_height": 32, "frames": 4, "duration_ms": 125},
        "throw_kind": throw_mode,
        "assets": paths,
        "sources": {"overworld": overworld_url, "battle_front": front_url, "throw": throw_origin},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Sprites de treinadores, tipos e pokebolas para o PokeArena")
    ap.add_argument("--repo", help="Caminho para a raiz local do repositorio PokeArena")
    ap.add_argument("--force", action="store_true", help="Baixar PNGs mesmo se ja estiverem presentes")
    args = ap.parse_args()

    repo = find_repo(args.repo)
    public = repo / "public"
    print(f"Projeto: {repo}")
    print("Destino: public/assets/{treinadores,tipos,pokebolas}")
    print("Nao altera arquivos de codigo nem os SVGs existentes.\n")
    errors: list[str] = []
    balls_out = {}
    balls_img = {}
    for ball, origin in BALLS.items():
        url = PRET + "graphics/items/icons/" + origin
        p = public / "assets" / "pokebolas" / (ball + ".png")
        try:
            balls_img[ball] = fetch_png(url, p, args.force)
            balls_out[ball] = {"path": webpath(p, public), "source": url}
        except (RuntimeError, ValueError) as exc:
            errors.append(str(exc))
            print(f"  [ERRO] {exc}")

    types_out = {}
    for tp in TYPES:
        url = SHOWDOWN + tp.capitalize() + ".png"
        p = public / "assets" / "tipos" / (tp + ".png")
        try:
            fetch_png(url, p, args.force)
            types_out[tp] = {"path": webpath(p, public), "source": url}
        except (RuntimeError, ValueError) as exc:
            errors.append(str(exc))
            print(f"  [ERRO] {exc}")

    trainers_out = {}
    if "poke" not in balls_img:
        errors.append("Pokebola basica ausente; impossivel gerar arremesso adaptado.")
    else:
        for key, spec in TRAINERS.items():
            try:
                trainers_out[key] = process_trainer(
                    key, spec, public, public, args.force, balls_img["poke"]
                )
            except (RuntimeError, ValueError, OSError) as exc:
                errors.append(f"{key}: {exc}")
                print(f"  [ERRO] {exc}")

    manifest = {
        "version": 1,
        "paths_relative_to": "public/",
        "astro_usage": "import.meta.env.BASE_URL + path",
        "note": "GIFs e spritesheets PNG sao alternativas de uso; hit e um efeito visual, nao frames originais de dano.",
        "trainers": trainers_out,
        "types": types_out,
        "balls": balls_out,
        "sources_and_rights": {
            "trainers_and_balls": "https://github.com/pret/pokeemerald",
            "type_icons": "https://play.pokemonshowdown.com/sprites/typeicons/",
            "pokemon_rights": "Arte de Pokemon pertence aos respectivos titulares. Repositorios-fonte nao conferem automaticamente licenca comercial.",
        },
    }
    manifest_path = public / "assets" / "treinadores" / "manifest.json"
    write_if_changed(manifest_path, (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    print(f"\nManifest: {manifest_path}")
    print(f"Resumo: {len(trainers_out)}/8 treinadores | {len(types_out)}/18 tipos PNG | {len(balls_out)}/4 pokebolas")
    if errors:
        print(f"\n{len(errors)} erro(s) encontrados:")
        for msg in errors:
            print("  - " + msg)
        return 1
    print("Concluido! Os arquivos estao prontos em public/. Integracao ao jogo fica para outra etapa.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
