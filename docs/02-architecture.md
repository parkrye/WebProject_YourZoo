# 기술 설계

---

## 1. 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 번들러 | **Vite 5** | 빠른 HMR, 설정 최소 |
| 언어 | **TypeScript (strict)** | 습성/BT 타입이 많아 필수 |
| UI | **React 18 (DOM)** | 팝업·요청서·그림판 등 폼 UI가 많다. canvas 안에서 만들 이유가 없다 |
| 게임 렌더 | **순수 Canvas 2D** | 레이어 7장 + 스프라이트 수십 개 수준. WebGL 불필요 |
| 상태 | **Zustand** | Context+useReducer 대비 리렌더 제어가 쉽고 3KB. canvas 루프에서 `getState()` 직접 호출 가능 |
| 저장 | **localStorage + IndexedDB(idb-keyval)** | 세이브 JSON / 그림 Blob 분리 |
| BT | **자체 구현** (`src/ai/bt`) | 습성 파라미터를 노드에 주입하는 구조라 라이브러리보다 직접 짜는 게 짧다 (~250줄) |

**의존성 총합: react, react-dom, zustand, idb-keyval** — 그 외 런타임 의존성 없음.

---

## 2. 디렉터리 구조

```
src/
├─ main.tsx                    엔트리
├─ App.tsx                     부트스트랩(에셋 로드 → GameRoot)
│
├─ app/
│  ├─ GameRoot.tsx             화면 상태머신 라우팅
│  ├─ Stage.tsx                16:9 letterbox 스케일 컨테이너
│  └─ BootScreen.tsx           로딩 진행률
│
├─ assets/
│  ├─ manifest.ts              ★ 모든 에셋 경로 + 그리드 스펙 (docs/01 의 구현체)
│  ├─ loader.ts                이미지 프리로드 + 진행률
│  ├─ atlas.ts                 그리드 슬라이싱 유틸 (Atlas 클래스)
│  ├─ cutout.ts                플러드필 알파 컷아웃 (폰트/팝업 배경 제거)
│  └─ AssetStore.ts            로드 결과 싱글턴 (HTMLImageElement / Atlas / GlyphTable)
│
├─ core/
│  ├─ ticker.ts                rAF 루프, dt 고정 스텝(1/60) 누산
│  ├─ rng.ts                   mulberry32 시드 난수
│  ├─ math.ts                  clamp / lerp / easing / vec2
│  └─ types.ts                 공용 타입
│
├─ domain/                     ★ 순수 로직. React·Canvas 의존 없음
│  ├─ traits.ts                AnimalTraits, 유형 프리셋, 랜덤 생성
│  ├─ animal.ts                Animal 모델, appeal 계산
│  ├─ enclosure.ts             Enclosure 모델, 바이옴, 로밍 박스
│  ├─ clock.ts                 GameClock (일자/경과초/시간대)
│  ├─ economy.ts               정산 공식, 손님 수 산출
│  └─ orders.ts                NPC 의뢰 생성/판정
│
├─ ai/
│  ├─ bt/
│  │  ├─ types.ts              Status, Node, Blackboard
│  │  ├─ nodes.ts              Sequence/Selector/Parallel/Inverter/Cond/Action/Wait
│  │  └─ index.ts
│  ├─ actions.ts               MoveTo / Wander / Rest / Flee / Approach 액션
│  └─ buildTree.ts             traits → BT 조립
│
├─ sim/
│  ├─ AnimalAgent.ts           동물 1마리의 런타임 상태 + BT tick + 물리
│  ├─ VisitorAgent.ts          손님 1명의 절차적 이동
│  └─ EnclosureSim.ts          우리 1개의 시뮬레이션(동물+손님+프롭)
│
├─ render/
│  ├─ SceneRenderer.ts         레이어 순서 총괄, EnclosureSim 을 그린다
│  ├─ BitmapText.ts            스프라이트 폰트 렌더 (canvas & DOM 양쪽 지원)
│  ├─ NineSlice.ts             팝업 프레임 9-슬라이스
│  └─ animal/
│     ├─ AnimalRenderer.ts     ★ 인터페이스
│     ├─ ProceduralRenderer.ts  단일 비트맵 + 스쿼시/보빙/틸트/플립
│     └─ SheetRenderer.ts       8×3 시트용 (SDK 연동 전까지 스텁)
│
├─ ui/
│  ├─ components/  IconButton · BitmapLabel · Popup · Slider · Tabs
│  ├─ screens/     TitleScreen · ZooScreen · DetailScreen
│  └─ modals/      OptionsModal · StatusModal · RequestModal · DrawModal · PaletteMenu
│
├─ draw/
│  ├─ DrawingCanvas.tsx        그림판 본체
│  ├─ history.ts               undo/redo 스택 (ImageData 스냅샷 + 상한 30)
│  └─ export.ts                트림 → PNG Blob → IndexedDB
│
└─ store/
   ├─ gameStore.ts             Zustand 루트 스토어
   ├─ save.ts                  직렬화/역직렬화 + 스키마 버전
   └─ imageDb.ts               IndexedDB(idb-keyval) 래퍼
```

---

## 3. 핵심 인터페이스

### 3.1 AnimalRenderer — 향후 8×3 스프라이트 시트 대비

지금은 플레이어가 그린 **단일 비트맵**을 절차적으로 변형해 움직인다.
추후 외부 SDK가 그림 1장 → **8프레임 × 3동작(IDLE / MOVE / SIGNATURE)** 시트를 생성해 주면
`SheetRenderer` 로 **교체만** 하면 되도록 처음부터 인터페이스를 분리한다.

```ts
export type AnimalMotion = 'IDLE' | 'MOVE' | 'SIGNATURE'

export interface AnimalRenderState {
  x: number; y: number          // 정규화 좌표
  facing: 1 | -1
  motion: AnimalMotion
  motionTime: number            // 해당 모션 진입 후 경과(초)
  speed01: number               // 현재 속도 / 최대 속도
  scale: number
}

export interface AnimalRenderer {
  draw(ctx: CanvasRenderingContext2D, st: AnimalRenderState, view: ViewBox): void
}
```

- `ProceduralRenderer(bitmap)` — 단일 이미지.
  `IDLE`: 상하 보빙 + 미세 스쿼시. `MOVE`: 진행 방향 틸트 + 큰 보빙 + facing 플립.
  `SIGNATURE`: 점프/회전 등 1회성 강조.
- `SheetRenderer(sheet)` — `8×3` 시트. `motionTime` → `frame = floor(t / frameDur) % 8`.
- `Animal.spriteSheet: SheetMeta | null` 필드를 **지금부터** 데이터 모델에 넣어 둔다.
  값이 있으면 `SheetRenderer`, 없으면 `ProceduralRenderer` 를 팩토리가 선택한다.

> **마이그레이션 비용 ≈ 0.** 시뮬레이션(`AnimalAgent`)은 이미 `motion` 을 상태로 들고 있으므로
> 렌더러 교체만으로 프레임 애니메이션이 붙는다.

### 3.2 Behavior Tree

```
Root : Selector
├─ Sequence  [ IsThreatened?      → Flee ]                    // timidity, 손님 근접
├─ Sequence  [ NeedsRest?         → Rest(dur) ]               // activity 반비례
└─ Selector
   ├─ Sequence [ WantsSocial?     → MoveTo(nearestPeer) ]     // sociability
   ├─ Sequence [ WantsInspect?    → MoveTo(nearestProp) ]     // curiosity
   └─ Wander                                                  // 로밍 박스 내 랜덤 목표
```

- `Blackboard` : `{ self, peers, props, roamBox, visitorsNear, dt, rng }`
- 노드는 `tick(bb): Status ('RUNNING'|'SUCCESS'|'FAILURE')`
- 조건 노드는 **traits 값을 확률 임계로** 사용한다. 예: `WantsSocial = rng() < sociability * 0.02`
  (초당 판정이 아니라 tick당 판정이므로 계수로 조절)
- BT tick 주기는 **10Hz**. 이동 적분은 렌더 프레임(60Hz)에서 수행. 60Hz로 BT를 돌릴 이유가 없다.

### 3.3 시뮬레이션 / 렌더 분리

```
ticker (rAF)
  ├─ accumulator += dt
  ├─ while (acc >= 1/60) { sim.fixedUpdate(1/60); acc -= 1/60 }   // 물리·이동
  ├─ sim.btUpdate()   // 10Hz 내부 타이머
  └─ renderer.draw(ctx, alpha)                                     // 보간 렌더
```

- `EnclosureSim` 은 **비활성 우리도 계속 돌린다** (좌우로 넘겼다 돌아왔을 때 정지해 있으면 어색).
  단, 비활성 우리는 BT를 2Hz 로 낮추고 렌더는 생략.

### 3.4 상태 저장

```ts
interface SaveV1 {
  version: 1
  createdAt: number
  gold: number
  reputation: number
  day: number
  dayElapsed: number              // 0..180
  unlockedEnclosures: BiomeId[]
  animals: AnimalSave[]           // imageId 만 들고, 픽셀은 IndexedDB
  orders: OrderSave[]
  options: { bgm: number; sfx: number }
}
```
- `localStorage['yourzoo.save.v1']` ← JSON
- `IndexedDB store 'yourzoo-images'` ← `imageId → Blob(PNG)`
- 저장 트리거: 자정 정산 / 동물 추가·삭제 / 화면 이탈(`visibilitychange`) / 30초 주기 디바운스

---

## 4. 리스크와 대응

| # | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | **폰트 배경 컷아웃 실패** | 텍스트가 전부 깨짐 (치명) | 플러드필 임계값을 상수로 노출 + 개발용 디버그 페이지(`/dev/font`)에서 즉시 눈으로 검증. 최악의 경우 원본 시트 재가공 요청 |
| R2 | **팝업 시트 컷아웃 실패** | 팝업 프레임 사용 불가 | 1차는 9-슬라이스만 사용해 리스크 자체를 회피 |
| R3 | 그린 동물이 너무 크거나 1픽셀 | 우리가 망가짐 | 저장 시 알파 바운딩박스로 **트림 후 정규화 리사이즈**(긴 변 기준 고정 높이) |
| R4 | 동물 수 증가 시 프레임 드랍 | 체감 저하 | 우리당 동물 상한 12마리. 비활성 우리 렌더 생략. 오프스크린 캐시 |
| R5 | 8×3 SDK 스펙 변경 | 렌더러 재작성 | `AnimalRenderer` 인터페이스로 격리. `SheetMeta` 를 느슨하게(rows/cols/fps 파라미터화) |
| R6 | IndexedDB 미지원/쿼터 초과 | 그림 유실 | 저장 실패 시 경고 팝업 + 세션 메모리 유지. 동물 수 상한으로 총량 제한 |

---

## 5. 코딩 규칙

- SOLID 준수. `domain/` 은 React·Canvas·DOM 을 **import 하지 않는다** (단위 테스트 가능해야 함).
- early return 우선, 깊은 중첩 금지.
- 콜백보다 `async/await`.
- 문자열 4개 이상 연결 / 루프 내 `+=` → 배열 `join` 또는 누적 버퍼.
- 매직 넘버 금지 — 밸런스 수치는 전부 `domain/balance.ts` 한 곳에 모은다.
