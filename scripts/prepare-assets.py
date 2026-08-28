#!/usr/bin/env python3
"""
원본 에셋을 게임이 바로 쓸 수 있는 형태로 전처리해 src/assets/images/ 에 배치한다.

`public/` 에서 그대로 서빙하던 것을 없애고 여기서 한 번만 처리하는 이유:
  - 알파 채널이 없는 에셋이 섞여 있어 그대로 그리면 검은 사각형이 화면에 찍힌다
  - 그 처리를 런타임 플러드필로 하면 매 실행마다 수백만 픽셀을 훑게 되고,
    임계값을 잘못 잡으면 그림 자체를 갉아먹는다 (실제로 폰트에서 그런 사고가 났다)
  - 번들러가 해시 URL과 캐시를 관리하게 두는 편이 배포에도 낫다

사용법:
    python scripts/prepare-assets.py <원본 디렉터리>

멱등하다. 여러 번 돌려도 결과가 같다.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

# 원본 파일명 -> (출력 경로, 검은 배경 제거 임계 밝기 | None)
#
# 임계값은 **파일마다 다르다.** 배경은 어디나 순수 검정(밝기 0)이지만
# 그림 쪽에서 가장 어두운 부분이 얼마나 어두운지가 다르기 때문이다.
# 손님 시트는 검은 머리카락이 밝기 17 부터 시작해서, 30 으로 잡았더니 머리가 뚫렸다.
LAYOUT: dict[str, tuple[str, int | None]] = {
    "bg_sky_day.png": ("bg/sky-day.png", None),
    "bg_sky_afternoon.png": ("bg/sky-afternoon.png", None),
    "bg_sky_night.png": ("bg/sky-night.png", None),
    "bg_area_field.png": ("bg/area-field.png", None),
    "bg_area_desert.png": ("bg/area-desert.png", None),
    # 상단이 투명해야 하늘이 비치는데 알파가 없다.
    "bg_area_ice.png": ("bg/area-ice.png", 24),
    "bg_forward_fence.png": ("bg/fence.png", None),
    "sprite_icon_font.png": ("sprite/icon-font.png", None),
    "sprite_icon_gui.png": ("sprite/icon-gui.png", None),
    "sprite_ui_popup.png": ("sprite/ui-popup.png", None),
    "sprite_prop_field.png": ("sprite/prop-field.png", None),
    "sprite_prop_desert.png": ("sprite/prop-desert.png", 24),
    "sprite_prop_ice.png": ("sprite/prop-ice.png", None),
    # 검은 머리카락이 밝기 17 부터다. 그보다 확실히 아래로 잡는다.
    "sprite_human_visitor.png": ("sprite/human-visitor.png", 10),
}

# 상점에서 파는 동물 스프라이트. `sprite_animal_{층}_{이름}.png` 규칙으로 들어온다.
#
# 배경은 순수 검정이고 알파 채널이 아예 없다(RGB 모드).
# 임계값 24 부터는 까마귀의 검은 깃털로 플러드필이 새어 들어간다
# (지워진 비율이 85.5% -> 89.2% 로 튄다). 확실히 아래인 16 으로 잡는다.
ANIMAL_PREFIX = "sprite_animal_"
ANIMAL_THRESHOLD = 16
ANIMAL_COLS = 8
ANIMAL_ROWS = 3

# 파일명의 층 -> 게임의 서식지
ANIMAL_HABITAT = {"upper": "SKY", "middle": "LAND", "lower": "WATER"}

# 잘라낸 프레임의 최대 높이(px). 화면에서 동물은 100px 안팎이라
# 원본 341px 을 그대로 두면 쓰지도 않을 해상도로 번들만 부푼다.
ANIMAL_MAX_FRAME_H = 220

# WebP 품질. 90 아래로는 털결에 뭉개짐이 눈에 띈다.
ANIMAL_WEBP_QUALITY = 90

# 창을 얼마나 좁힐지(피치 대비). 0 이면 피치 그대로.
#
# 원본은 그림이 프레임 간격보다 넓게 그려져 이웃과 겹친다. 어떤 직사각형으로 잘라도
# 남의 조각이 조금은 들어온다. 창을 살짝 좁혀 그 조각이 **가운데를 못 지나게** 만들면
# 연결 성분 판정이 걸러 준다.
WINDOW_SHRINK = 0.06


OUT_ROOT = Path("src/assets/images")
AUDIO_OUT = Path("src/assets/audio")

# 오디오는 손댈 게 없다. 있으면 그대로 옮긴다.
AUDIO_FILES = (
    "bgm-title", "bgm-day", "bgm-afternoon", "bgm-night", "bgm-drawing",
    "sting-report", "sting-reward",
)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def cut_black_background(image: Image.Image, threshold: int) -> Image.Image:
    """
    테두리에서 시작하는 플러드필로 **바깥과 연결된** 어두운 영역만 지운다.

    밝기 임계값만 쓰면 캐릭터의 검은 옷이나 눈동자까지 뚫린다.
    스프라이트 내부의 검정은 바깥과 이어져 있지 않으므로 이 방식에서 살아남는다.
    """
    rgb = np.array(image.convert("RGB"), dtype=np.uint8)
    h, w = rgb.shape[:2]
    lum = luminance(rgb.astype(np.float32))

    dark = lum < threshold
    cleared = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(y: int, x: int) -> None:
        if dark[y, x] and not cleared[y, x]:
            cleared[y, x] = True
            queue.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while queue:
        y, x = queue.popleft()
        if y > 0:
            seed(y - 1, x)
        if y < h - 1:
            seed(y + 1, x)
        if x > 0:
            seed(y, x - 1)
        if x < w - 1:
            seed(y, x + 1)

    # 배경으로 판정된 픽셀만 투명하게 만든다. 나머지는 절대 건드리지 않는다.
    #
    # 한때 경계 픽셀의 알파를 밝기에 비례해 낮추는 페더링을 넣었다가
    # **캐릭터 몸이 통째로 반투명해졌다.** 손님 스프라이트는 옷이 대부분 어두워서
    # 외곽 픽셀 거의 전부가 페더링 대상이 됐기 때문이다.
    # 검은 테두리가 1px 남는 편이 몸이 비쳐 보이는 것보다 낫다.
    alpha = np.where(cleared, 0, 255).astype(np.uint8)

    return Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")


def content_bands(mask: np.ndarray, axis: int) -> list[tuple[int, int]]:
    """내용이 있는 구간을 잇달아 찾는다. 프레임 행 경계를 실측할 때 쓴다."""
    projection = mask.any(axis=axis)
    bands: list[tuple[int, int]] = []
    start: int | None = None
    for i, filled in enumerate(projection):
        if filled and start is None:
            start = i
        elif not filled and start is not None:
            bands.append((start, i))
            start = None
    if start is not None:
        bands.append((start, len(projection)))
    return bands


def row_bounds(mask: np.ndarray) -> list[tuple[int, int]]:
    """
    프레임 행의 경계.

    세로는 **균등 분할이 안 된다.** 1024 / 3 이 딱 떨어지지 않는 데다,
    시그니처 동작이 위로 크게 뻗어 앞 행의 몫을 넘어오는 시트가 있다
    (말은 세 번째 행이 672 에서 시작하는데 균등 경계는 683 이다).
    그래서 실제 내용 밴드를 찾고 **밴드 사이 빈 구간의 한가운데**를 경계로 삼는다.

    가로는 반대로 프레임이 서로 닿아 있어 밴드가 붙어 버린다. 거기는 균등 분할이 맞다.
    """
    bands = content_bands(mask, axis=1)
    if len(bands) != ANIMAL_ROWS:
        # 검출이 어긋나면 균등 분할로 되돌린다. 결과가 조금 어긋날지언정 멈추지는 않는다.
        h = mask.shape[0]
        return [(round(h * i / ANIMAL_ROWS), round(h * (i + 1) / ANIMAL_ROWS)) for i in range(ANIMAL_ROWS)]

    edges = [0]
    for (_, prev_end), (next_start, _) in zip(bands, bands[1:]):
        edges.append((prev_end + next_start) // 2)
    edges.append(mask.shape[0])
    return list(zip(edges, edges[1:]))


def centered_window(band: np.ndarray, index: int, pitch: float, window: int, width: int) -> tuple[int, int]:
    """
    프레임 하나가 들어갈 창을 그림의 **무게중심에 맞춰** 잡는다.

    고정 격자로 자르면 그림이 슬롯 한쪽으로 치우쳐 반대편에 이웃이 크게 물린다.
    무게중심에 맞추면 남의 조각이 양 끝으로 밀려나 가운데를 지나지 않고,
    그때부터는 연결 성분 판정이 걸러 준다.
    """
    slot0 = round(pitch * index)
    slot1 = round(pitch * (index + 1))
    profile = band[:, slot0:slot1].sum(axis=0)

    total = profile.sum()
    center = (slot0 + slot1) / 2
    if total > 0:
        center = slot0 + float((np.arange(len(profile)) * profile).sum() / total)

    x0 = int(round(center - window / 2))
    x0 = max(0, min(x0, width - window))
    return x0, x0 + window


def strip_intruders(mask: np.ndarray) -> np.ndarray:
    """
    이웃 프레임에서 넘어온 조각을 지운다.

    원본은 그림이 프레임 간격보다 넓어 칸마다 옆 그림의 앞뒤가 물려 들어온다 —
    상어가 두 마리로 보였다. 창을 무게중심에 맞춰 잡으면 그 조각은 양 끝으로 밀려나므로,
    여기서는 **몸통과 가로로 겹치지 않는 덩어리**를 버린다.
    옆에 떨어져 있는 조각은 이 동물의 일부가 아니다.

    크기로 가르려다 상어 머리를 못 걸렀고, 세로 픽셀 수의 골짜기로 가르려다
    말과 호랑이의 **목을 잘랐다** — 진짜 동물은 목과 허리가 원래 가늘다.
    """
    labels, count = ndimage.label(mask)
    if count <= 1:
        return mask

    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    main_cols = np.where((labels == main).any(axis=0))[0]
    lo, hi = int(main_cols.min()), int(main_cols.max())

    keep = labels == main
    for i in range(1, count + 1):
        if i == main:
            continue
        part = labels == i
        cols = np.where(part.any(axis=0))[0]
        # 몸통이 차지한 가로 구간과 겹치면 이 동물의 일부로 본다.
        if int(cols.min()) <= hi and int(cols.max()) >= lo:
            keep |= part

    return keep


def prepare_animal(src: Path) -> dict[str, object] | None:
    """
    동물 시트 하나를 게임이 쓰는 규격으로 정리한다.

    셀마다 그림 위치가 제각각이라 그대로 쓰면 프레임이 넘어갈 때 덜컹거린다.
    **24칸 전체의 내용을 감싸는 상자 하나**를 구해 모든 칸을 같은 상자로 잘라낸다 —
    칸마다 따로 맞추면 움직임(위아래로 뛰는 동작)까지 같이 지워진다.

    `fit` 과 `baseline` 은 **IDLE 행만 보고** 잰다. 상자는 시그니처 점프까지 감싸느라
    크기 때문에, 상자를 기준으로 삼으면 서 있는 동물이 공중에 뜬 것처럼 그려진다.
    """
    stem = src.stem[len(ANIMAL_PREFIX):]
    layer, _, name = stem.partition("_")
    habitat = ANIMAL_HABITAT.get(layer)
    if habitat is None or not name:
        print(f"  [건너뜀] {src.name} 이름 규칙에 맞지 않음")
        return None

    cut = cut_black_background(Image.open(src), ANIMAL_THRESHOLD)
    rgba = np.array(cut)
    mask = rgba[..., 3] > 0
    h, w = mask.shape

    rows = row_bounds(mask)
    pitch = w / ANIMAL_COLS
    window = round(pitch * (1 - WINDOW_SHRINK))

    # 칸마다 창을 그림의 무게중심에 맞추고, 이웃에서 넘어온 조각을 지운다.
    # 상자를 먼저 재면 남의 주둥이까지 감싸느라 넓어진다.
    cells: list[list[tuple[int, int]]] = []
    for y0, y1 in rows:
        row_cells: list[tuple[int, int]] = []
        for c in range(ANIMAL_COLS):
            x0, x1 = centered_window(mask[y0:y1], c, pitch, window, w)
            cell = mask[y0:y1, x0:x1]
            cleaned = strip_intruders(cell)
            removed = cell & ~cleaned
            if removed.any():
                rgba[y0:y1, x0:x1][removed] = 0
            mask[y0:y1, x0:x1] = cleaned
            row_cells.append((x0, x1))
        cells.append(row_cells)
    cut = Image.fromarray(rgba, mode="RGBA")

    # 칸 안에서의 내용 상자를 전부 겹쳐 하나로 만든다.
    box = None
    idle_box = None
    for r, (y0, y1) in enumerate(rows):
        for x0, x1 in cells[r]:
            cell = mask[y0:y1, x0:x1]
            if not cell.any():
                continue
            ys, xs = np.where(cell)
            local = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
            box = local if box is None else union(box, local)
            if r == 0:
                idle_box = local if idle_box is None else union(idle_box, local)

    if box is None:
        print(f"  [건너뜀] {src.name} 내용이 없음")
        return None
    if idle_box is None:
        idle_box = box

    bw, bh = box[2] - box[0], box[3] - box[1]
    scale = min(1.0, ANIMAL_MAX_FRAME_H / bh)
    fw, fh = max(1, round(bw * scale)), max(1, round(bh * scale))

    sheet = Image.new("RGBA", (fw * ANIMAL_COLS, fh * ANIMAL_ROWS), (0, 0, 0, 0))
    for r, (y0, y1) in enumerate(rows):
        for c, (x0, _) in enumerate(cells[r]):
            crop = cut.crop((x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]))
            if scale < 1.0:
                crop = crop.resize((fw, fh), Image.LANCZOS)
            sheet.paste(crop, (c * fw, r * fh))

    # PNG 로 두면 한 장에 600KB, 22종이면 13MB 다. 사진 같은 렌더라 PNG 가 거의 못 줄인다.
    # WebP 는 알파를 유지하면서 10분의 1 아래로 떨어진다.
    relative = f"animal/{habitat.lower()}-{name}.webp"
    out = OUT_ROOT / relative
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, format="WEBP", quality=ANIMAL_WEBP_QUALITY, method=6)

    return {
        "id": name.upper(),
        "habitat": habitat,
        "file": relative,
        # 서 있는 자세를 기준으로 잰다. 상자는 점프까지 감싸느라 크다.
        "fit": round((idle_box[3] - idle_box[1]) / bh, 4),
        "baseline": round((idle_box[3] - box[1]) / bh, 4),
        "frameW": fw,
        "frameH": fh,
        "kb": round(out.stat().st_size / 1024),
    }


def union(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def alpha_zero_ratio(image: Image.Image) -> float:
    if image.mode != "RGBA":
        return 0.0
    alpha = np.array(image.getchannel("A"))
    return float((alpha == 0).mean() * 100)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1

    source = Path(sys.argv[1])
    if not source.is_dir():
        print(f"원본 디렉터리를 찾을 수 없다: {source}")
        return 1

    for name, (relative, threshold) in LAYOUT.items():
        src = source / name
        if not src.exists():
            print(f"  [건너뜀] {name} 없음")
            continue

        image = Image.open(src)
        before = image.mode
        image = cut_black_background(image, threshold) if threshold else image.convert("RGBA")

        out = OUT_ROOT / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        image.save(out, optimize=True)

        mark = f"컷아웃 <{threshold}" if threshold else "그대로"
        print(f"  {name:26s} {before:5s} -> {relative:24s} [{mark}] alpha0={alpha_zero_ratio(image):.1f}%")

    small = source / SMALL_FONT_SRC
    if small.exists():
        size = prepare_small_font(small)
        if size:
            print(f"  {SMALL_FONT_SRC:26s} -> {SMALL_FONT_OUT:24s} [격자 {size[0]}x{size[1]}]")

    animals = []
    for src in sorted(source.glob(f"{ANIMAL_PREFIX}*.png")):
        entry = prepare_animal(src)
        if entry:
            animals.append(entry)
            print(f"  {src.name:34s} -> {entry['file']:26s} "
                  f"[fit {entry['fit']} base {entry['baseline']}] {entry['kb']}KB")
    if animals:
        write_animal_manifest(animals)
        print(f"  동물 시트 {len(animals)}종 -> {ANIMAL_MANIFEST}")

    print(f"\n완료. 출력: {OUT_ROOT}")
    return 0


# 작은 폰트. 6x6 격자에 a-z, 0-9 가 순서대로 들어 있다.
SMALL_FONT_SRC = "smallfont.png"
SMALL_FONT_OUT = "sprite/icon-font-small.png"
SMALL_FONT_GRID = 6
# 잉크로 칠 알파 하한.
#
# 0 으로 두면 칸 전체에 퍼진 알파 1~5 짜리 잔여까지 잉크로 세어
# 상자가 칸 전체가 되고 여백이 하나도 안 잘린다. 8 을 넘기면 글자 모양만 남는다.
SMALL_FONT_ALPHA = 8
# 칸 순서. 원본 시트에 이 순서로 들어 있다.
SMALL_FONT_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
# 디센더 깊이 (x-하이트 대비). 꼬리가 이만큼 베이스라인 아래로 내려간다.
SMALL_FONT_DESCENDER = 0.32
# 글자 좌우 여백(px). 붙여 놓으면 글자끼리 닿는다.
SMALL_FONT_SIDE_BEARING = 3


def prepare_small_font(src: Path) -> tuple[int, int] | None:
    """
    작은 폰트를 **베이스라인을 맞춰** 균등 격자로 다시 짠다.

    원본은 칸마다 글자 위치가 제각각이다 — `a` 는 바닥에 가깝고 `0` 은 한참 위에 있다.
    그대로 균등 분할하면 글자가 줄 위에서 오르내리고,
    그렇다고 칸마다 잉크 바닥을 맞추면 **디센더(g j p q y)의 꼬리가 베이스라인에 붙는다.**

    그래서 글자마다 잉크 상자를 재고, 디센더인지 아닌지에 따라 놓는 높이를 달리한다.
    결과는 모든 칸이 같은 크기이고 베이스라인이 한 줄로 서는 시트다 —
    거기서부터는 균등 분할이 정확하다.
    """
    image = Image.open(src).convert("RGBA")
    mask = np.array(image.getchannel("A")) > SMALL_FONT_ALPHA
    h, w = mask.shape
    cw, ch = w // SMALL_FONT_GRID, h // SMALL_FONT_GRID

    # 글자마다 잉크 상자를 잰다. 순서는 a-z, 0-9.
    boxes: list[tuple[int, int, int, int] | None] = []
    for r in range(SMALL_FONT_GRID):
        for c in range(SMALL_FONT_GRID):
            cell = mask[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw]
            if not cell.any():
                boxes.append(None)
                continue
            ys, xs = np.where(cell)
            boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

    if all(b is None for b in boxes):
        print(f"  [건너뜀] {src.name} 내용이 없음")
        return None

    # 위로도 아래로도 삐치지 않는 글자들. 이들의 높이가 곧 x-하이트다.
    plain = [SMALL_FONT_CHARS.index(ch) for ch in "acemnorsuvwxz"]
    x_height = int(np.median([boxes[i][3] - boxes[i][1] for i in plain if boxes[i]]))
    depth = max(1, round(x_height * SMALL_FONT_DESCENDER))

    descenders = {SMALL_FONT_CHARS.index(ch) for ch in "gjpqy"}

    ascents = []
    for i, box in enumerate(boxes):
        if not box:
            continue
        height = box[3] - box[1]
        ascents.append(height - depth if i in descenders else height)

    ascent = max(ascents)
    cell_h = ascent + depth
    cell_w = max((b[2] - b[0]) for b in boxes if b) + SMALL_FONT_SIDE_BEARING * 2

    sheet = Image.new(
        "RGBA",
        (cell_w * SMALL_FONT_GRID, cell_h * SMALL_FONT_GRID),
        (0, 0, 0, 0),
    )
    for i, box in enumerate(boxes):
        if not box:
            continue
        r, c = divmod(i, SMALL_FONT_GRID)
        glyph = image.crop(
            (c * cw + box[0], r * ch + box[1], c * cw + box[2], r * ch + box[3])
        )
        height = box[3] - box[1]
        own_ascent = height - depth if i in descenders else height
        x = c * cell_w + (cell_w - glyph.width) // 2
        # 베이스라인은 ascent 자리다. 디센더는 그 아래로 depth 만큼 더 내려간다.
        y = r * cell_h + (ascent - own_ascent)
        sheet.paste(glyph, (x, y))

    out = OUT_ROOT / SMALL_FONT_OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, optimize=True)
    return sheet.size


ANIMAL_MANIFEST = Path("src/assets/animalSheets.ts")


def write_animal_manifest(animals: list[dict[str, object]]) -> None:
    """
    시트 목록을 TS 로 뽑는다.

    Vite 는 정적 import 여야 해시 URL 과 캐시를 관리한다.
    손으로 22줄을 적어 두면 파일이 하나 늘 때마다 어긋나므로 여기서 생성한다.
    """
    lines = [
        "/* 이 파일은 scripts/prepare-assets.py 가 생성한다. 직접 고치지 말 것. */",
        "import type { Habitat } from './manifest'",
        "",
    ]
    for i, a in enumerate(animals):
        lines.append(f"import sheet{i} from './images/{a['file']}'")

    lines += [
        "",
        "export interface AnimalSheetAsset {",
        "  readonly id: string",
        "  readonly habitat: Habitat",
        "  readonly src: string",
        "  /** 프레임 높이 대비 서 있는 자세의 높이 */",
        "  readonly fit: number",
        "  /** 프레임 안에서 발이 놓이는 y (0..1) */",
        "  readonly baseline: number",
        "  /** 칸 하나의 픽셀 크기. 썸네일 비율을 맞출 때 쓴다. */",
        "  readonly frameW: number",
        "  readonly frameH: number",
        "}",
        "",
        "export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = [",
    ]
    for i, a in enumerate(animals):
        lines.append(
            f"  {{ id: '{a['id']}', habitat: '{a['habitat']}', src: sheet{i}, "
            f"fit: {a['fit']}, baseline: {a['baseline']}, "
            f"frameW: {a['frameW']}, frameH: {a['frameH']} }},"
        )
    lines += ["]", ""]

    ANIMAL_MANIFEST.write_text(chr(10).join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
