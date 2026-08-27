# 로드맵

각 마일스톤은 **논리적 단위**이며 완료 시 커밋한다.

---

## M0 — 문서 · 스캐폴딩  ← *이번 작업 범위*

- [x] 요구사항 분석, 에셋 실측
- [x] `docs/00-overview.md` · `01-assets.md` · `02-architecture.md` · `03-roadmap.md`
- [x] Vite + React + TS 프로젝트 초기화, `strict` 설정
- [x] 디렉터리 스캐폴딩
- [x] `assets/manifest.ts` — 에셋 경로 + 그리드 스펙 상수화
- [x] `assets/loader.ts` · `atlas.ts` · `cutout.ts` · `gridDetect.ts` · `AssetStore.ts`
- [x] `render/BitmapText.ts` — 스프라이트 폰트 + 글리프 메트릭 자동 측정
- [x] `app/Stage.tsx` — 16:9 letterbox 스케일

- [x] `dev/AssetInspector.tsx` — `?dev=assets` 검증 페이지

> **검증 게이트 통과.** 헤드리스 브라우저로 실제 확인함.
> 이 과정에서 문서에 없던 사실 3가지를 발견해 반영했다 — docs/01-assets.md §1.3, §2.0 참조.
> 1. 손님·사막프롭 시트에 알파 채널이 없다 (검은 배경이 그대로 찍힘)
> 2. 균등 그리드가 실제 그림 경계와 맞지 않는다 (아이콘 잔상, 폰트 베이스라인 붕괴)
> 3. 밴드 분리를 임계값으로 맞추면 얇은 획 글자가 쪼개진다 (`X` → `VWX`)

---

## M1 — 수직 슬라이스  ← *이번 작업 범위*

**TITLE → ZOO 화면이 실제로 돌아간다.**

- [x] `core/ticker.ts` 고정 스텝 루프
- [x] `store/gameStore.ts` 최소 상태 (screen / gold / reputation / clock / 현재 우리)
- [x] `domain/clock.ts` — 1일 180초, 시간대 전환
- [x] `render/SceneRenderer.ts` — 레이어 0·1·5·6 (하늘 / 바이옴 / 손님 / 펜스)
- [x] `sim/VisitorAgent.ts` — 명성 비례 손님 수, 절차적 보빙 이동
- [x] `ui/screens/TitleScreen` — 게임 시작 / 옵션
- [x] `ui/screens/ZooScreen` — 좌우 우리 전환, HUD(`DAY 1 · 09:20`), 하단 버튼 바
- [x] `ui/modals/OptionsModal` — 볼륨 슬라이더 2개(BGM/SFX)
- [x] `ui/components/IconButton` · `BitmapLabel` · `Popup(9-slice)`

> **완료 판정**: 타이틀에서 시작 → 초원 우리가 보이고, 손님이 펜스 너머에 서 있고,
> 시간이 흘러 낮→저녁→밤으로 하늘이 바뀌고, ◀▶ 로 우리를 넘길 수 있다.

---

## M2 — 그림판 + 동물 생성  ← *완료*

- [x] `draw/DrawingCanvas` — 연필(6색) / 지우개 / 모두 지우기 / undo·redo / 완성 / 닫기
- [x] `draw/history.ts` — **스트로크 커맨드 리스트 + 재생** (초안의 ImageData 스냅샷에서 변경, docs/02 §3.4)
- [x] `ui/components/PaletteMenu` — 연필 아이콘 6색 팝오버
- [x] `draw/export.ts` — 알파 트림 → 긴 변 256 정규화 → PNG Blob
- [x] `store/imageDb.ts` — IndexedDB(idb-keyval) 저장/로드
- [x] `ui/components/BitmapInput` — 스프라이트 폰트 입력 필드 (A-Z/0-9 자동 정규화)
- [x] `ui/components/Tabs` — 요청서 탭
- [x] `RequestModal` **TAB: NEW** — 이름 · 그림 · TYPE/CUSTOM/RANDOM 습성 설정 · 제출
- [x] `domain/traits.ts` · `domain/animal.ts` · appeal 계산
- [x] `gameStore` 확장 — `animals`, `addAnimal`(비용 차감 + 정원 검사)

> **완료 판정**: 요청서에서 이름을 쓰고 그림을 그려 제출하면 소지금이 50 줄고
> 운영 현황의 `ANIMALS` 가 늘어난다. 그림은 IndexedDB 에 PNG 로 남는다.
> 헤드리스 브라우저로 전 과정(그리기 → 팔레트 → undo/redo → 완성 → 제출) 확인 완료.

### 이 과정에서 고친 UI 문제
1. 팝업 제목이 프레임 상단 발바닥 엠블럼과 겹쳤다 → 제목·닫기를 **종이 영역 안**으로 이동
2. 내용이 프레임 나무 부분을 침범했다 → `.popup-content` 에 `overflow: hidden`, 컬럼에 스크롤
3. CUSTOM 모드에서 제출 버튼이 스크롤 밖으로 밀렸다 → footer 를 그리드 밖 고정 영역으로
4. 팔레트 팝오버가 팝업 오른쪽 경계에서 잘렸다 → 왼쪽으로 열도록 변경
5. `key.slice(0, 6)` 라벨이 `ACTIVI` `SOCIAB` 로 잘렸다 → `TRAIT_LABELS` 명시 축약어

---

## M3 — 동물 AI (BT) + 배치  ← *완료*

- [x] `ai/bt` 코어 — Sequence(기억 유지) / Selector(우선순위, 기억 없음) / Inverter / Condition / Action
- [x] `ai/actions.ts` · `ai/buildTree.ts` — 조건 노드가 traits 를 확률 임계로 읽는다
- [x] `ai/types.ts` — `AgentView` 로 `ai/` ↔ `sim/` 순환 import 차단
- [x] `sim/AnimalAgent.ts` — BT 10Hz, 이동 적분 60Hz, 프롭 회피, 로밍 박스 구속
- [x] `sim/EnclosureSim.ts` — 우리 3개 상시 시뮬레이션 (비활성은 BT 2Hz)
- [x] `sim/props.ts` — 바이옴 고정 시드 배치, 겹침 방지
- [x] `sim/imageCache.ts` — 그림 Blob → ImageBitmap 캐시
- [x] `render/animal/` — `AnimalRenderer` 인터페이스 + `ProceduralRenderer` + `SheetRenderer`(대기)
- [x] `SceneRenderer` 레이어 2·3·4 — 프롭과 동물을 합쳐 y 오름차순 정렬

> **완료 판정**: 서식지가 다른 동물 3마리(BEAST/FISH/BIRD)를 만들면 각자 하늘·땅·물
> 영역에서만 돌아다니고, 프롭을 피하며, 시간이 지나면 위치가 바뀐다. 헤드리스 확인 완료.

### 튜닝한 값
- `SKY` 로밍 y0 `0.04 → 0.10` — HUD 텍스트와 겹쳤다
- `WATER` 로밍 y0 `0.72 → 0.75` — 물가 잔디에 걸쳤다
- 손님 `높이 0.26 → 0.32`, `기준선 0.83 → 0.82` — 프레임 검출로 스프라이트가
  타이트해지면서 머리가 펜스 난간 아래로 내려가 우리 화면에서 완전히 가려졌다

### 폰트 외곽선 수정 (M0 회귀)
컷아웃 후 경계 1px 를 알파 150 으로 깎는 "페더링"이 **글자의 어두운 외곽선 자체를**
반투명하게 만들어 테두리가 갉아먹힌 것처럼 보였다. 배경만 투명하면 되므로 페더링을 제거하고,
잉크 판정 알파를 `24 → 6` 으로 낮추고, 검출 프레임에 2px 여백을 줬다.
분할 시 경계 컬럼을 버리던 것도 앞쪽 밴드에 포함시켰다.
→ 36자 중 33자가 잉크 손실 0. `V` `W` `X` 는 원본에서 획이 맞닿아 있어 경계를 공유한다.

---

## M4 — 상세 보기 · 운영 현황 · 경제

- [ ] `DetailScreen` — 펜스 하강 트윈, 커서/손바닥(팬), 확대/축소
- [ ] `StatusModal` — 소지금 · 명성 · 일일 수지 · 동물 수
- [ ] `domain/economy.ts` 자정 정산
- [ ] 우리 해금 (DESERT 500G / ICE 1500G)
- [ ] `store/save.ts` 세이브/로드

---

## M5 — 의뢰 · 마감

- [ ] `domain/orders.ts` + `RequestModal` **TAB: ORDERS**
- [ ] 사운드(BGM/SFX) 연결, 옵션 볼륨 실동작
- [ ] `SheetRenderer` 활성화 (외부 SDK 8×3 시트 연동)
- [ ] 밸런스 조정, 성능 프로파일링

---

## 우선순위 근거

M0 의 **폰트 컷아웃**과 M1 의 **레이어 합성**이 이 프로젝트의 두 급소다.
둘 다 에셋 자체의 제약에서 오는 리스크이고, 실패하면 대체 에셋이 필요해진다.
따라서 게임 로직(M2~)보다 **먼저** 검증한다.
