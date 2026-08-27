# 사운드

**에셋 도착. 연결 완료.** 원본은 `<원본 디렉터리>/audio/` 에 두고
`scripts/prepare-assets.py` 가 `src/assets/audio/` 로 옮긴다.

## 재생 규칙

`src/audio/AudioManager.ts` 와 `useGameAudio.ts` 가 담당한다.

| 상황 | 곡 |
|---|---|
| 타이틀 · 이름 짓기 | `bgm-title` |
| 우리 화면 (시간대 따라) | `bgm-day` / `bgm-afternoon` / `bgm-night` |
| 그림판 | `bgm-drawing` — **다른 무엇보다 우선한다.** 그리는 중에 곡이 바뀌면 집중이 끊긴다 |
| 자정 정산 팝업 | `sting-report` |
| 의뢰 완료 | `sting-reward` |
| 버튼 클릭 | `click-normal` — 전역 pointerdown 한 곳에서 낸다 |
| 비활성 버튼 · 잘못된 드롭 | `click-wrong` |

### 환경음

`ambient-birds` / `ambient-rain` / `ambient-steam`.
**배경음이 아니라 가끔 스치는 소리다.**

```
22~55초 침묵 → 3.5초 페이드인 → 20~45초 재생 → 3.5초 페이드아웃 → 반복
```

볼륨은 효과음의 22%. 계속 깔리면 BGM 과 뭉개지고 금세 질린다.
후보는 우리마다 다르되 겹치게 뒀다 — 사막에서 새소리가 나면 장소가 읽히지 않고,
하나로 고정하면 금세 예측된다.

| 우리 | 후보 |
|---|---|
| `FIELD` | BIRDS · RAIN |
| `DESERT` | STEAM · BIRDS |
| `ICE` | RAIN · STEAM |

곡 전환은 0.9초 크로스페이드다. 하루가 180초뿐이라 시간대마다 뚝 끊기면 특히 거슬린다.

브라우저는 사용자가 화면을 한 번 건드리기 전까지 소리를 막는다.
그래서 첫 재생 요청은 보류해 두었다가 첫 입력에 되살린다 —
그러지 않으면 타이틀 BGM 이 조용히 실패하고 아무도 이유를 모른다.

---

## 아래는 이 에셋을 만들 때 쓴 요청서다 (교체·추가 시 참고)

## 공통 사양

- 형식 **OGG Vorbis** (용량 대비 품질). 폴백이 필요하면 MP3 동시 제공
- 샘플레이트 44.1kHz, 모노/스테레오 무관
- BGM은 **이음매 없는 루프**. 앞뒤 무음 없이 자르고 꼬리를 머리에 물릴 것
- 라우드니스 -16 LUFS 안팎, 트루피크 -1dBTP
- 게임 톤: 손그림 동화풍 2D 동물원. 밝고 아기자기하되 유치하지 않게

## BGM 5종

| 파일 | 길이 | 쓰이는 곳 |
|---|---|---|
| `bgm-title.ogg` | 40~60s 루프 | 타이틀, 이름 짓기 |
| `bgm-day.ogg` | 60~90s 루프 | 우리 화면 낮 (0~80초) |
| `bgm-afternoon.ogg` | 60~90s 루프 | 저녁 (80~130초) |
| `bgm-night.ogg` | 60~90s 루프 | 밤 (130~180초) |
| `bgm-drawing.ogg` | 60~90s 루프 | 그림판 |

세 시간대 곡은 **같은 주제 선율의 변주**로 만들어 달라. 하루가 180초뿐이라
곡이 완전히 바뀌면 전환이 산만하다. 편성과 템포만 달라지고 멜로디는 이어지는 편이 좋다.

## 스팅어 2종

| 파일 | 길이 | 쓰이는 곳 |
|---|---|---|
| `sting-report.ogg` | 2~3s | 자정 정산 팝업 |
| `sting-reward.ogg` | 2~3s | 의뢰 완료, 동물 도착 |

---

## 생성 프롬프트

### bgm-title

> Warm, welcoming main-theme loop for a hand-drawn 2D zoo management game. Gentle
> acoustic ensemble: nylon-string guitar arpeggios, soft marimba, light pizzicato
> strings, a single warm flute carrying the melody. Mid-tempo, around 92 BPM, major
> key, 6/8 lilt. Feels like standing at the gate of a small countryside zoo on a
> bright morning — hopeful, a little nostalgic, inviting rather than triumphant. No
> drums beyond a soft shaker and light hand percussion. No brass, no synths, no
> vocals. Keep the arrangement sparse so it never tires on repeat. Seamless loop of
> 48 seconds with no silence at either end; the final bar must flow directly into
> the first. Clean, uncluttered mix with plenty of air.

### bgm-day

> Bright, easygoing background loop for the daytime zoo view in a hand-drawn 2D
> game. Same melodic theme as the title track but lighter and more playful. Lead on
> marimba and glockenspiel, warm nylon guitar underneath, soft upright bass, brushed
> snare and shaker keeping a relaxed groove. Around 100 BPM, major key. Sunny,
> unhurried, the feeling of visitors strolling past enclosures. This plays for long
> stretches, so keep it low-key and repetitive-friendly: no dramatic swells, no
> sudden hits, nothing that pulls attention from the screen. No vocals, no brass,
> no synths. Seamless loop of 72 seconds, trimmed with zero silence so the tail
> joins the head cleanly.

### bgm-afternoon

> Golden-hour variation of a hand-drawn 2D zoo game theme. Same melody as the
> daytime track, now slower and warmer — around 84 BPM. Lead moves from marimba to
> a mellow flugelhorn-like woodwind or soft clarinet; add gentle vibraphone,
> fingerpicked nylon guitar, warm upright bass. Percussion thins to brushes and a
> soft shaker. Major key with occasional mellow seventh chords. Evokes late
> afternoon light, long shadows, the day winding down but not yet over. Calm and
> contented, never melancholy. No vocals, no brass section, no synths. Seamless
> loop of 72 seconds with no silence at either end.

### bgm-night

> Quiet nighttime variation of a hand-drawn 2D zoo game theme. Same melody as the
> daytime track, now sparse and hushed — around 70 BPM. Lead on soft music box or
> celesta, with a low sustained pad from bowed strings, occasional harp-like guitar
> harmonics, and a distant low woodwind. Almost no percussion; perhaps a very soft
> heartbeat-like pulse. Major key with a gentle lullaby feel. Evokes a sleeping zoo
> under starlight — peaceful and safe, not eerie or tense. Leave plenty of space
> between phrases. No vocals, no brass, no synths beyond a warm pad. Seamless loop
> of 72 seconds with no silence at either end.

### bgm-drawing

> Curious, focused background loop for a drawing/creation screen in a hand-drawn 2D
> zoo game. Light and slightly whimsical: plucked ukulele or nylon guitar, playful
> pizzicato strings, soft woodblock and triangle accents, a wandering clarinet
> melody that never quite resolves. Around 96 BPM, major key with playful
> chromatic passing notes. Should feel like tinkering at a workbench — creative,
> patient, gently amused. The player may sit here for several minutes, so keep it
> unobtrusive with no build-ups or climaxes. No vocals, no drums beyond light
> percussion, no synths. Seamless loop of 64 seconds with no silence at either end.

### sting-report

> Short musical sting for a daily results screen in a hand-drawn 2D zoo game. Two
> and a half seconds. A gentle ascending marimba and glockenspiel figure resolving
> to a warm major chord on nylon guitar and soft strings, with a light shaker
> flourish. Satisfying and calm — a day well finished, not a jackpot. Should sit
> naturally over the same acoustic palette as the game's background music. No
> vocals, no brass fanfare, no synths. Clean tail that fades to silence by the end;
> no reverb wash lingering past three seconds.

### sting-reward

> Short celebratory sting for completing a request in a hand-drawn 2D zoo game.
> Two seconds. A bright rising glockenspiel and marimba run capped by a small
> triangle shimmer and a warm plucked guitar chord. Cheerful and light — a pat on
> the back, not a fanfare. Acoustic palette matching the game's background music.
> No vocals, no brass, no synths. Clean tail fading fully to silence within two and
> a half seconds.
