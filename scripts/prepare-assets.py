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
# 작은 틈을 메울 때의 기준(px). 몸에서 떨어져 나온 다리를 몸에 붙이는 데 쓴다.
GAP_CLOSE = 12
# 한 줄의 칸 수로 그럴듯한 범위. 벗어나면 붙었거나 조각난 줄로 본다.
FRAMES_MIN = 4
FRAMES_MAX = 12
# 한 마리로 볼 폭의 상한(기준폭 대비). 달리는 자세는 서 있는 자세보다 넓다 — 말은 164 대 212 다.
SINGLE_SLACK = 1.45
# 본체 대비 이 비율보다 작은 덩어리는 옆 그림에서 스친 조각으로 본다.
DUST_RATIO = 0.03

# 파일명의 층 -> 게임의 서식지
ANIMAL_HABITAT = {"upper": "SKY", "middle": "LAND", "lower": "WATER"}

# 잘라낸 프레임의 최대 높이(px). 화면에서 동물은 100px 안팎이라
# 원본 341px 을 그대로 두면 쓰지도 않을 해상도로 번들만 부푼다.
ANIMAL_MAX_FRAME_H = 220

# WebP 품질. 90 아래로는 털결에 뭉개짐이 눈에 띈다.
ANIMAL_WEBP_QUALITY = 90


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


def runs_of(flags: np.ndarray) -> list[tuple[int, int]]:
    """True 가 이어지는 구간들. 행 밴드와 칸 범위를 찾는 데 모두 쓴다."""
    out: list[tuple[int, int]] = []
    start: int | None = None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        elif not on and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(flags)))
    return out


def close_gaps(spans: list[tuple[int, int]], min_gap: int) -> list[tuple[int, int]]:
    """`min_gap` 보다 좁은 틈은 메워 하나로 본다. 몸에서 떨어져 나온 다리를 붙일 때 쓴다."""
    if not spans:
        return spans
    out = [list(spans[0])]
    for lo, hi in spans[1:]:
        if lo - out[-1][1] < min_gap:
            out[-1][1] = hi
        else:
            out.append([lo, hi])
    return [(lo, hi) for lo, hi in out]


def _spans(band: np.ndarray, min_gap: int = 0) -> list[tuple[int, int]]:
    spans = runs_of(band.any(axis=0))
    return close_gaps(spans, min_gap) if min_gap else spans


def single_width(mask: np.ndarray, rows: list[tuple[int, int]]) -> float:
    """
    이 시트에서 **한 마리가 차지하는 폭**.

    기준 줄은 구간이 그럴듯한 개수(4~12)로 나뉜 줄 중 가장 많이 나뉜 줄이다.
    가장 많이 나뉜 줄을 무작정 고르면 안 된다 — 다리가 몸에서 떨어진 줄은
    구간이 16~17개까지 늘어나고, 그 중앙값은 다리 한 짝의 폭이다
    (실제로 기준폭이 17px 로 잡혀 한 줄이 72칸이 된 적이 있다).
    """
    best: list[tuple[int, int]] = []
    for y0, y1 in rows:
        for spans in (_spans(mask[y0:y1]), _spans(mask[y0:y1], GAP_CLOSE)):
            if FRAMES_MIN <= len(spans) <= FRAMES_MAX and len(spans) > len(best):
                best = spans
    if not best:
        best = max((_spans(mask[y0:y1]) for y0, y1 in rows), key=len, default=[(0, mask.shape[1])])
    return float(np.median([hi - lo for lo, hi in best])) or 1.0


def row_frames(mask: np.ndarray, rows: list[tuple[int, int]], single: float) -> list[int]:
    """
    **줄마다** 프레임이 몇 개인지.

    한 시트 안에서도 줄마다 다르다 — 말은 서 있는 줄이 8칸인데 걷는 줄은 **7칸**이다.
    시트 하나에 한 숫자를 쓰면 그 줄의 말 한 마리가 두 칸으로 쪼개진다.

    구간 하나가 한 마리인지 여러 마리가 붙은 것인지는 폭으로 가른다.
    달리는 자세는 서 있는 자세보다 넓으므로 여유를 둔다 — 말은 164 대 212 다.
    """
    # 모든 구간이 한 마리 폭인 줄은 믿을 만하다. 그런 줄의 최대 개수를 상한으로 삼는다.
    cap = 0
    for y0, y1 in rows:
        for spans in (_spans(mask[y0:y1]), _spans(mask[y0:y1], GAP_CLOSE)):
            if not (FRAMES_MIN <= len(spans) <= FRAMES_MAX):
                continue
            if all(hi - lo <= single * SINGLE_SLACK for lo, hi in spans):
                cap = max(cap, len(spans))

    counts = []
    for y0, y1 in rows:
        total = 0
        for lo, hi in _spans(mask[y0:y1], GAP_CLOSE):
            width = hi - lo
            total += 1 if width <= single * SINGLE_SLACK else max(1, round(width / single))
        counts.append(min(total, cap) if cap else total)
    return counts


def row_layout(band: np.ndarray, count: int) -> tuple[list[tuple[int, int]], np.ndarray]:
    """
    한 줄에서 프레임 `count` 개가 **실제로 놓인 자리**를 찾는다.
    돌려주는 것은 칸 범위와 칸마다의 기준점이다.

    이미지 폭을 `count` 로 나눈 격자를 쓰면 안 된다. 그림은 이미지의 양 끝에 닿지 않고,
    실제 간격도 폭÷칸수가 아니다 — 말의 서 있는 줄은 간격이 186 인데 격자는 192 라
    끝 칸에서 **25px 이나 밀린다.** 그만큼 밀린 자리를 기준으로 잘라 내니
    프레임마다 몸이 좌우로 튀고, 격자 경계가 동물 한복판에 떨어져 오랑우탄이 갈렸다.

    빈 틈만 보고 나눠도 안 된다. 물고기와 악어는 프레임끼리 붙어 있어
    한 줄이 통째로 구간 하나다 (마를린은 8칸이 구간 1개다).

    그래서 **프레임이 등간격이라는 사실**을 쓴다. 간격 `p` 와 첫 경계 `s0` 를 훑어,
    경계 `count-1` 개가 다 같이 잉크에서 가장 멀리 떨어지는 조합을 고른다.
    떨어져 있는 줄에서는 경계가 정확히 틈에 꽂히고,
    붙어 있는 줄에서는 등간격을 지킨 채 가장 얇은 자리로 간다.
    """
    width = band.shape[1]
    ink = band.any(axis=0)
    if count < 2 or not ink.any():
        return [(0, width)], np.array([width / 2.0])

    lo, hi = int(np.argmax(ink)), width - int(np.argmax(ink[::-1]))
    profile = band.sum(axis=0).astype(np.float64)

    # 각 열이 잉크에서 몇 칸 떨어져 있는가. 경계는 이 값이 클수록 좋다.
    clear = ndimage.distance_transform_edt(~ink)

    # 잉크 전체가 `count` 칸에 담기므로 간격은 이 범위를 벗어날 수 없다.
    span = hi - lo
    pitches = np.arange(span / count * 0.75, span / (count - 1) * 1.05 + 1e-9, 0.5)
    seams = np.arange(count - 1)

    best: tuple[tuple[float, float, float], float, float] | None = None
    for pitch in pitches:
        # 첫 경계는 첫 프레임 뒤 어딘가다.
        first = np.arange(lo + pitch * 0.35, lo + pitch * 1.3)
        cuts = np.round(first[:, None] + pitch * seams[None, :]).astype(int)

        # 모든 경계가 잉크 안에 들어와야 한다. 밖으로 밀린 것은 후보가 아니다 —
        # 이걸 막지 않으면 간격을 잔뜩 벌려 경계를 오른쪽 여백으로 밀어내는 답이
        # 그 여백의 여유 거리를 점수로 챙겨 이긴다. 오랑우탄이 그렇게 두 마리씩 잘렸다.
        inside = (cuts[:, 0] > lo) & (cuts[:, -1] < hi)
        if not inside.any():
            continue
        cuts = np.clip(cuts, 1, width - 1)

        room = clear[cuts]
        ink_at = profile[cuts].sum(axis=1)
        # 먼저 **모든** 경계가 틈에 들어갔는지 본다. 하나라도 그림을 밟으면 실격에 가깝다.
        # 다 통과한 것들끼리는 틈 한가운데에 가까운 쪽을, 다 붙어 있으면 얇은 쪽을 고른다.
        rank = np.stack([room.min(axis=1), room.sum(axis=1), -ink_at], axis=1)
        rank[~inside] = -np.inf

        i = int(np.lexsort((rank[:, 2], rank[:, 1], rank[:, 0]))[-1])
        key = (rank[i, 0], rank[i, 1], rank[i, 2])
        if best is None or key > best[0]:
            best = (key, float(first[i]), float(pitch))

    if best is None:
        pitch = span / count
        best = ((0.0, 0.0, 0.0), lo + pitch, pitch)

    _, first, pitch = best
    edges = [0] + [int(round(first + pitch * i)) for i in range(count - 1)] + [width]
    edges = sorted(set(np.clip(edges, 0, width).tolist()))
    while len(edges) < count + 1:
        edges.append(width)

    cells = list(zip(edges, edges[1:]))
    anchors = first + pitch * (np.arange(count) - 0.5)
    return cells, anchors


def drop_dust(piece: np.ndarray) -> np.ndarray:
    """
    칸 안의 아주 작은 조각을 턴다.

    겹쳐 그려져 빈 열이 없는 자리에서는 가장 얇은 열로 가르는데, 그게 부리나
    날개 끝을 스칠 때가 있다. 그러면 옆 그림의 부리 조각이 이 칸에 남는다.
    본체의 몇 %도 안 되는 덩어리는 이 동물의 일부가 아니다 —
    몸에서 떨어져 나온 다리는 이보다 훨씬 크다.
    """
    alpha = piece[..., 3] > 0
    if not alpha.any():
        return piece

    labels, count = ndimage.label(alpha)
    if count <= 1:
        return piece

    sizes = ndimage.sum(alpha, labels, range(1, count + 1))
    floor = max(sizes) * DUST_RATIO
    for i, size in enumerate(sizes, start=1):
        if size < floor:
            piece[labels == i] = 0
    return piece


def prepare_animal(src: Path) -> dict[str, object] | None:
    """
    동물 시트 하나를 게임이 쓰는 규격으로 정리한다.

    순서는 셋이다.
      1. 검은 배경을 지운다
      2. 줄을 찾고, **줄마다** 칸의 실제 범위를 찾는다 (7칸이든 8칸이든 상관없다)
      3. 칸마다 잘라 균등 격자로 다시 짠다

    자를 때 기준점은 가로가 **그 줄 격자의 칸 자리**, 세로가 **그 줄의 발끝**이다.
    둘 다 프레임이 바뀌어도 움직이지 않는 자리라 상대 위치가 그대로 보존된다 —
    칸마다 내용을 가운데로 맞추면 다리를 뻗은 프레임과 모은 프레임의 폭이 달라
    몸통이 좌우로 튄다.
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
    _, width = mask.shape

    rows = runs_of(mask.any(axis=1))
    if not rows:
        print(f"  [건너뜀] {src.name} 내용이 없음")
        return None

    single = single_width(mask, rows)
    frames = row_frames(mask, rows, single)
    layouts = [row_layout(mask[y0:y1], frames[r]) for r, (y0, y1) in enumerate(rows)]
    cells = [c for c, _ in layouts]
    anchors = [a for _, a in layouts]
    cols = max(frames)

    # 칸마다 잉크 상자. 옆 칸의 그림은 범위 밖이라 들어오지 않는다.
    boxes: list[list[tuple[int, int, int, int] | None]] = []
    for r, (y0, y1) in enumerate(rows):
        band = mask[y0:y1]
        row_boxes: list[tuple[int, int, int, int] | None] = []
        for x0, x1 in cells[r]:
            piece = band[:, x0:x1]
            if not piece.any():
                row_boxes.append(None)
                continue
            ys, xs = np.where(piece)
            row_boxes.append((x0 + int(xs.min()), int(ys.min()),
                              x0 + int(xs.max()) + 1, int(ys.max()) + 1))
        boxes.append(row_boxes)

    bottoms = [max((b[3] for b in row if b), default=0) for row in boxes]

    lefts, rights, tops = [], [], []
    for r, row in enumerate(boxes):
        for c, box in enumerate(row):
            if not box:
                continue
            anchor = anchors[r][c]
            lefts.append(box[0] - anchor)
            rights.append(box[2] - anchor)
            tops.append(box[1] - bottoms[r])

    box_left, box_right, box_top = min(lefts), max(rights), min(tops)
    bw, bh = round(box_right - box_left), round(-box_top)

    # `fit` 은 서 있는 줄만 보고 잰다. 봉투는 시그니처 점프까지 감싸느라 커서,
    # 봉투를 기준으로 삼으면 서 있는 동물이 공중에 뜬 것처럼 그려진다.
    idle_tops = [b[1] - bottoms[0] for b in boxes[0] if b] or tops
    idle_top = min(idle_tops)

    scale = min(1.0, ANIMAL_MAX_FRAME_H / bh)
    fw, fh = max(1, round(bw * scale)), max(1, round(bh * scale))

    sheet = Image.new("RGBA", (fw * cols, fh * len(rows)), (0, 0, 0, 0))
    for r, (y0, y1) in enumerate(rows):
        band = rgba[y0:y1]
        for c, (x0, x1) in enumerate(cells[r]):
            left = round(anchors[r][c] + box_left)
            top = bottoms[r] + box_top

            piece = np.zeros((bh, bw, 4), dtype=np.uint8)
            sy0, sy1 = max(0, top), min(band.shape[0], top + bh)
            sx0, sx1 = max(left, x0), min(left + bw, x1)
            if sy1 > sy0 and sx1 > sx0:
                piece[sy0 - top : sy1 - top, sx0 - left : sx1 - left] = band[sy0:sy1, sx0:sx1]

            piece = drop_dust(piece)
            crop = Image.fromarray(piece, mode="RGBA")
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
        "cols": cols,
        "rows": len(rows),
        "frames": frames,
        "fit": round(-idle_top / bh, 4),
        "baseline": 1.0,
        "frameW": fw,
        "frameH": fh,
        "kb": round(out.stat().st_size / 1024),
    }


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
        "  /** 격자 크기. 시트마다 다르다 — 닭과 까마귀와 공작은 7칸이다. */",
        "  readonly cols: number",
        "  readonly rows: number",
        "  /** 줄마다의 실제 프레임 수. 한 시트 안에서도 다르다 — 말은 8/7/8 이다. */",
        "  readonly frames: readonly number[]",
        "}",
        "",
        "export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = [",
    ]
    for i, a in enumerate(animals):
        lines.append(
            f"  {{ id: '{a['id']}', habitat: '{a['habitat']}', src: sheet{i}, "
            f"fit: {a['fit']}, baseline: {a['baseline']}, "
            f"frameW: {a['frameW']}, frameH: {a['frameH']}, "
            f"cols: {a['cols']}, rows: {a['rows']}, frames: {list(a['frames'])} }},"
        )
    lines += ["]", ""]

    ANIMAL_MANIFEST.write_text(chr(10).join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
