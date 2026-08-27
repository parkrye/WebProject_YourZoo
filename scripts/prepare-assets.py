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

    print(f"\n완료. 출력: {OUT_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
