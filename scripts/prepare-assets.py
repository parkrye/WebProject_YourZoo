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

# 원본 파일명 -> (출력 경로, 검은 배경 제거 여부)
LAYOUT: dict[str, tuple[str, bool]] = {
    "bg_sky_day.png": ("bg/sky-day.png", False),
    "bg_sky_afternoon.png": ("bg/sky-afternoon.png", False),
    "bg_sky_night.png": ("bg/sky-night.png", False),
    "bg_area_field.png": ("bg/area-field.png", False),
    "bg_area_desert.png": ("bg/area-desert.png", False),
    # 상단이 투명해야 하늘이 비치는데 알파가 없다.
    "bg_area_ice.png": ("bg/area-ice.png", True),
    "bg_forward_fence.png": ("bg/fence.png", False),
    "sprite_icon_font.png": ("sprite/icon-font.png", False),
    "sprite_icon_gui.png": ("sprite/icon-gui.png", False),
    "sprite_ui_popup.png": ("sprite/ui-popup.png", False),
    "sprite_prop_field.png": ("sprite/prop-field.png", False),
    "sprite_prop_desert.png": ("sprite/prop-desert.png", True),
    "sprite_prop_ice.png": ("sprite/prop-ice.png", False),
    "sprite_human_visitor.png": ("sprite/human-visitor.png", True),
}

OUT_ROOT = Path("src/assets/images")

# 이 밝기 미만이면 배경 후보. 캐릭터의 검은 옷보다는 어둡고 배경보다는 밝게 잡는다.
DARK_THRESHOLD = 34
# 경계 픽셀의 알파를 밝기에 비례해 낮추는 구간. 검은 테두리가 남는 걸 막는다.
FEATHER_RANGE = DARK_THRESHOLD * 3


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def cut_black_background(image: Image.Image) -> Image.Image:
    """
    테두리에서 시작하는 플러드필로 **바깥과 연결된** 어두운 영역만 지운다.

    밝기 임계값만 쓰면 캐릭터의 검은 옷이나 눈동자까지 뚫린다.
    스프라이트 내부의 검정은 바깥과 이어져 있지 않으므로 이 방식에서 살아남는다.
    """
    rgb = np.array(image.convert("RGB"), dtype=np.uint8)
    h, w = rgb.shape[:2]
    lum = luminance(rgb.astype(np.float32))

    dark = lum < DARK_THRESHOLD
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

    alpha = np.where(cleared, 0, 255).astype(np.uint8)

    # 지워진 영역과 맞닿은 어두운 픽셀은 배경이 섞인 안티에일리어싱 경계다.
    # 밝기에 비례해 알파를 낮추면 검은 테두리가 사라진다.
    neighbours = np.zeros((h, w), dtype=bool)
    neighbours[1:, :] |= cleared[:-1, :]
    neighbours[:-1, :] |= cleared[1:, :]
    neighbours[:, 1:] |= cleared[:, :-1]
    neighbours[:, :-1] |= cleared[:, 1:]

    edge = neighbours & ~cleared & (lum < FEATHER_RANGE)
    ramp = np.clip(lum / FEATHER_RANGE * 255, 0, 255).astype(np.uint8)
    alpha[edge] = ramp[edge]

    return Image.fromarray(np.dstack([rgb, alpha]), mode="RGBA")


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

    for name, (relative, needs_cut) in LAYOUT.items():
        src = source / name
        if not src.exists():
            print(f"  [건너뜀] {name} 없음")
            continue

        image = Image.open(src)
        before = image.mode
        image = cut_black_background(image) if needs_cut else image.convert("RGBA")

        out = OUT_ROOT / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        image.save(out, optimize=True)

        mark = "컷아웃" if needs_cut else "그대로"
        print(f"  {name:26s} {before:5s} -> {relative:24s} [{mark}] alpha0={alpha_zero_ratio(image):.1f}%")

    print(f"\n완료. 출력: {OUT_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
