import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Connect, Plugin, ViteDevServer, PreviewServer } from 'vite'

/**
 * 동물원 서버.
 *
 * 정적 서버 옆에 미들웨어 하나만 얹어 `db/` 폴더를 DB 로 쓴다. 프로세스도 포트도 하나다.
 *
 * 개인용이라 대단한 방어는 하지 않지만 **공짜로 막을 수 있는 것은 막는다.**
 * 비밀번호 원문 저장, 경로 조작, 무제한 대입, 무제한 본문 — 이 넷은 넣는 데
 * 몇 줄이면 되고 빠뜨렸을 때 대가가 크다.
 *
 * ## 규격
 *
 * 모든 응답은 같은 봉투를 쓴다.
 *   성공 `{ ok: true, ... }`
 *   실패 `{ ok: false, code, message }`
 * `code` 는 기계가 보고 `message` 는 화면에 그대로 띄운다(영문 대문자 — 폰트 제약).
 *
 * | 메서드 | 경로 | 인증 | 하는 일 |
 * |---|---|---|---|
 * | POST | `/api/v1/auth/signup` | — | 계정 생성 |
 * | POST | `/api/v1/auth/login` | — | 로그인, 토큰 발급 |
 * | GET | `/api/v1/saves/:id` | 토큰 | 클라우드 세이브 읽기 |
 * | PUT | `/api/v1/saves/:id` | 토큰 | 클라우드 세이브 쓰기 |
 * | GET | `/api/v1/zoos` | — | 검색 |
 * | GET | `/api/v1/zoos/random` | — | 본인 제외 랜덤 |
 * | GET | `/api/v1/zoos/:id` | — | 동물원 한 채 |
 * | PUT | `/api/v1/zoos/:id` | 계정이면 토큰 | 공개 |
 * | GET | `/api/v1/images/:id` | — | 그림 |
 */
const ROOT = 'db'
const ZOOS = join(ROOT, 'zoos')
const IMAGES = join(ROOT, 'images')
const ACCOUNTS = join(ROOT, 'accounts')
const SAVES = join(ROOT, 'saves')

const API_PREFIX = '/v1'

// ─────────────────────────────────────────────────────────────
// 한계값
//
// 상한이 없는 입력은 전부 언젠가 서버를 넘어뜨린다.
// 넉넉하되 유한하게 잡는다.
// ─────────────────────────────────────────────────────────────

/** 본문 상한. 동물 12마리 그림이 넉넉히 들어간다. */
const MAX_BODY_BYTES = 24 * 1024 * 1024
/** 그림 한 장의 상한. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_IMAGES = 120
const MAX_ANIMALS = 60
const MAX_PROPS = 120
const MAX_NAME = 32

/** 파일명이 되는 아이디. 대문자와 숫자뿐이라 경로 구분자가 낄 자리가 없다. */
const SAFE_ID = /^[A-Z0-9]{2,32}$/
/** 가입할 때 고를 수 있는 아이디. 화면에도 뜨므로 폰트에 있는 글자로 제한한다. */
const SIGNUP_ID = /^[A-Z0-9]{4,16}$/
/** 그림 id 는 UUID 이거나 거기에 접미사가 붙은 형태다. */
const SAFE_IMAGE_ID = /^[A-Za-z0-9_-]{4,80}$/

const MIN_PASSWORD = 4
const MAX_PASSWORD = 72

/** 토큰 수명. 지나면 다시 로그인해야 한다. */
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** 로그인 대입 제한. 4자리 비밀번호를 허용하는 이상 이건 있어야 한다. */
const AUTH_WINDOW_MS = 5 * 60 * 1000
const AUTH_MAX_ATTEMPTS = 10

// ─────────────────────────────────────────────────────────────
// 자료 모양
// ─────────────────────────────────────────────────────────────

/**
 * 계정 하나.
 *
 * 비밀번호는 절대 그대로 두지 않는다 — 재미로 돌리는 서버라도 사람들은
 * 어디서든 쓰던 비밀번호를 넣는다. scrypt 로 소금을 쳐서 해시만 남긴다.
 */
interface Account {
  userId: string
  salt: string
  hash: string
  token: string
  tokenIssuedAt: number
  createdAt: number
}

interface ZooDoc {
  userId: string
  zooName: string
  reputation: number
  day: number
  unlocked: string[]
  /** 주인이 우리에 붙인 이름. 없으면 클라이언트가 기본 이름을 쓴다. */
  enclosureNames: Record<string, string>
  /** 우리마다의 정원. */
  capacity: Record<string, number>
  animals: unknown[]
  props: unknown[]
  updatedAt: number
}

export function zooDb(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer): void => {
    ensureDirs()
    server.middlewares.use('/api', handle)
  }

  return {
    name: 'yourzoo-db',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// ─────────────────────────────────────────────────────────────
// 라우팅
// ─────────────────────────────────────────────────────────────

const handle: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '')

  // 버전 없는 경로는 받지 않는다. 규격을 바꿀 때 옛 클라이언트가 조용히 깨지는 걸 막는다.
  if (!path.startsWith(API_PREFIX)) {
    if (path.startsWith('/')) return void fail(res, 404, 'NOT_FOUND', 'UNKNOWN ENDPOINT')
    return next()
  }
  const route = path.slice(API_PREFIX.length)

  // 브라우저가 응답을 다른 타입으로 넘겨짚지 못하게 한다. 캐시도 남기지 않는다.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')

  if (route === '/auth/signup' && req.method === 'POST') return void signup(req, res)
  if (route === '/auth/login' && req.method === 'POST') return void login(req, res)

  const save = /^\/saves\/([^/]+)$/.exec(route)
  if (save) {
    const id = decodeURIComponent(save[1] ?? '')
    if (!SAFE_ID.test(id)) return void fail(res, 400, 'BAD_ID', 'BAD ID')
    if (req.method === 'GET') return void readSave(id, req, res)
    if (req.method === 'PUT') return void writeSave(id, req, res)
    return void fail(res, 405, 'BAD_METHOD', 'METHOD NOT ALLOWED')
  }

  if (route === '/zoos' && req.method === 'GET') return void search(url, res)
  if (route === '/zoos/random' && req.method === 'GET') return void random(url, res)

  const zoo = /^\/zoos\/([^/]+)$/.exec(route)
  if (zoo) {
    const id = decodeURIComponent(zoo[1] ?? '')
    if (!SAFE_ID.test(id)) return void fail(res, 400, 'BAD_ID', 'BAD ID')
    if (req.method === 'GET') return void readZoo(id, res)
    if (req.method === 'PUT') return void writeZoo(id, req, res)
    return void fail(res, 405, 'BAD_METHOD', 'METHOD NOT ALLOWED')
  }

  const image = /^\/images\/([^/]+)$/.exec(route)
  if (image && req.method === 'GET') return void readImage(image[1] ?? '', res)

  fail(res, 404, 'NOT_FOUND', 'UNKNOWN ENDPOINT')
}

// ─────────────────────────────────────────────────────────────
// 계정
// ─────────────────────────────────────────────────────────────

function signup(req: IncomingMessage, res: ServerResponse): void {
  void readJson(req, res).then((body) => {
    if (!body) return

    const userId = text(body.userId).toUpperCase()
    const password = text(body.password)

    if (!SIGNUP_ID.test(userId)) {
      return fail(res, 400, 'BAD_ID', 'ID MUST BE 4 TO 16 LETTERS OR DIGITS')
    }
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return fail(res, 400, 'BAD_PASSWORD', 'PASSWORD MUST BE 4 CHARS OR MORE')
    }
    if (existsSync(accountFile(userId))) {
      return fail(res, 409, 'ID_TAKEN', 'ID ALREADY TAKEN')
    }

    const salt = randomBytes(16).toString('hex')
    const now = Date.now()
    const account: Account = {
      userId,
      salt,
      hash: derive(password, salt),
      token: randomBytes(32).toString('hex'),
      tokenIssuedAt: now,
      createdAt: now,
    }
    ensureDirs()
    writeFileSync(accountFile(userId), JSON.stringify(account), 'utf8')
    ok(res, { userId, token: account.token })
  })
}

function login(req: IncomingMessage, res: ServerResponse): void {
  void readJson(req, res).then((body) => {
    if (!body) return

    const userId = text(body.userId).toUpperCase()
    const password = text(body.password)

    if (throttled(clientKey(req, userId))) {
      return fail(res, 429, 'TOO_MANY', 'TOO MANY TRIES  WAIT A FEW MINUTES')
    }

    const account = loadAccount(userId)
    // 아이디가 없는 것과 비밀번호가 틀린 것을 구분해 알리지 않는다.
    // 어느 아이디가 존재하는지 떠보는 통로가 된다.
    if (!account || !verify(password, account)) {
      return fail(res, 401, 'BAD_CREDENTIALS', 'WRONG ID OR PASSWORD')
    }

    // 로그인할 때마다 새로 발급한다. 예전 기기의 토큰은 그대로 끊긴다.
    account.token = randomBytes(32).toString('hex')
    account.tokenIssuedAt = Date.now()
    writeFileSync(accountFile(userId), JSON.stringify(account), 'utf8')
    forget(clientKey(req, userId))

    ok(res, { userId, token: account.token, hasSave: existsSync(saveFile(userId)) })
  })
}

/** scrypt 기본값(N=16384)이면 한 번에 수십 밀리초다. 개인 서버에는 충분히 비싸다. */
function derive(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString('hex')
}

function verify(password: string, account: Account): boolean {
  return sameSecret(derive(password, account.salt), account.hash)
}

/** 길이가 다르면 timingSafeEqual 이 던진다. 먼저 확인하고, 그다음은 시간을 흘리지 않는다. */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function loadAccount(userId: string): Account | null {
  try {
    return JSON.parse(readFileSync(accountFile(userId), 'utf8')) as Account
  } catch {
    return null
  }
}

const accountFile = (userId: string): string => join(ACCOUNTS, `${userId}.json`)
const saveFile = (userId: string): string => join(SAVES, `${userId}.json`)

/**
 * 이 요청이 그 아이디의 주인인가.
 *
 * 계정이 없는 아이디(비회원)는 누구의 것도 아니므로 그냥 통과시킨다 —
 * 비회원 아이디는 무작위 7자리라 남이 맞힐 일이 없고, 막아 봐야 지킬 게 없다.
 */
function authorized(userId: string, req: IncomingMessage): boolean {
  const account = loadAccount(userId)
  if (!account) return true

  if (Date.now() - account.tokenIssuedAt > TOKEN_MAX_AGE_MS) return false
  const token = req.headers['x-zoo-token']
  return typeof token === 'string' && sameSecret(token, account.token)
}

// ─────────────────────────────────────────────────────────────
// 대입 제한
//
// 메모리에만 둔다. 서버를 다시 켜면 풀리지만, 그건 공격자도 못 노리는 타이밍이다.
// ─────────────────────────────────────────────────────────────

const attempts = new Map<string, { count: number; until: number }>()

function clientKey(req: IncomingMessage, userId: string): string {
  const ip = req.socket.remoteAddress ?? 'unknown'
  return `${ip}|${userId}`
}

function throttled(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.until) {
    attempts.set(key, { count: 1, until: now + AUTH_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > AUTH_MAX_ATTEMPTS
}

function forget(key: string): void {
  attempts.delete(key)
}

// ─────────────────────────────────────────────────────────────
// 세이브 (계정 전용)
// ─────────────────────────────────────────────────────────────

function readSave(userId: string, req: IncomingMessage, res: ServerResponse): void {
  if (!authorized(userId, req)) return void fail(res, 403, 'FORBIDDEN', 'NOT YOUR SAVE')
  try {
    const raw = readFileSync(saveFile(userId), 'utf8')
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(`{"ok":true,"save":${raw}}`)
  } catch {
    fail(res, 404, 'NO_SAVE', 'NO SAVE')
  }
}

function writeSave(userId: string, req: IncomingMessage, res: ServerResponse): void {
  if (!authorized(userId, req)) return void fail(res, 403, 'FORBIDDEN', 'NOT YOUR SAVE')

  void readJson(req, res).then((body) => {
    if (!body) return
    if (!storeImages(body.images, res)) return
    delete body.images

    if (!Array.isArray(body.animals) || body.animals.length > MAX_ANIMALS) {
      return fail(res, 400, 'BAD_SAVE', 'BAD SAVE')
    }
    ensureDirs()
    writeFileSync(saveFile(userId), JSON.stringify(body), 'utf8')
    ok(res, {})
  })
}

// ─────────────────────────────────────────────────────────────
// 동물원
// ─────────────────────────────────────────────────────────────

function search(url: URL, res: ServerResponse): void {
  const q = text(url.searchParams.get('q')).trim().toUpperCase().slice(0, MAX_NAME)
  const exclude = text(url.searchParams.get('exclude'))

  // 아이디로도 동물원 이름으로도 찾는다. 둘 중 뭘 들고 왔는지 유저는 신경 쓸 필요 없다.
  const zoos = allZoos()
    .filter((zoo) => zoo.userId !== exclude)
    .filter((zoo) => q === '' || zoo.userId.includes(q) || zoo.zooName.toUpperCase().includes(q))
    .map(summary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20)

  ok(res, { zoos })
}

function random(url: URL, res: ServerResponse): void {
  const exclude = text(url.searchParams.get('exclude'))
  const others = allZoos().filter((zoo) => zoo.userId !== exclude)
  // 저장된 동물원이 자기 것뿐이면 갈 데가 없다. 빈 목록이 아니라 실패로 알린다.
  if (others.length === 0) return void fail(res, 404, 'NO_OTHER_ZOOS', 'NO OTHER ZOOS')

  ok(res, { zoo: others[Math.floor(Math.random() * others.length)] })
}

function readZoo(id: string, res: ServerResponse): void {
  const zoo = loadZoo(id)
  if (!zoo) return void fail(res, 404, 'NOT_FOUND', 'ZOO IS GONE')
  ok(res, { zoo })
}

function writeZoo(id: string, req: IncomingMessage, res: ServerResponse): void {
  // 계정이 있는 아이디는 주인만 덮어쓸 수 있다.
  if (!authorized(id, req)) return void fail(res, 403, 'FORBIDDEN', 'NOT YOUR ZOO')

  void readJson(req, res).then((body) => {
    if (!body) return
    if (!storeImages(body.images, res)) return
    delete body.images

    const doc = asZooDoc(id, body)
    if (!doc) return void fail(res, 400, 'BAD_ZOO', 'BAD ZOO DATA')

    ensureDirs()
    writeFileSync(join(ZOOS, `${id}.json`), JSON.stringify(doc), 'utf8')
    ok(res, {})
  })
}

/**
 * 들어온 것을 문서로 받아들일지 정한다.
 *
 * 검증 없이 그대로 쓰면 누구든 수십 MB 짜리 이름 하나로 검색 전체를 느리게 만들 수 있다.
 * 모양이 어긋나면 고쳐 쓰지 않고 거절한다 — 반쯤 맞는 데이터가 제일 다루기 어렵다.
 */
function asZooDoc(userId: string, body: Record<string, unknown>): ZooDoc | null {
  const animals = body.animals
  const props = body.props ?? []
  const unlocked = body.unlocked

  if (!Array.isArray(animals) || animals.length > MAX_ANIMALS) return null
  if (!Array.isArray(props) || props.length > MAX_PROPS) return null
  if (!Array.isArray(unlocked) || unlocked.length > 8) return null

  return {
    userId,
    zooName: text(body.zooName).slice(0, MAX_NAME),
    reputation: count(body.reputation),
    day: count(body.day),
    unlocked: unlocked.map((u) => text(u).slice(0, MAX_NAME)),
    enclosureNames: nameMap(body.enclosureNames),
    capacity: countMap(body.capacity),
    animals,
    props,
    updatedAt: Date.now(),
  }
}

/** 우리 수만큼의 작은 표. 키도 값도 길이를 자른다 — 통째로 믿을 이유가 없다. */
const MAX_MAP_ENTRIES = 8

function nameMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, name] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_MAP_ENTRIES) break
    out[text(key).slice(0, MAX_NAME)] = text(name).slice(0, MAX_NAME)
  }
  return out
}

function countMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!value || typeof value !== 'object') return out
  for (const [key, n] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_MAP_ENTRIES) break
    out[text(key).slice(0, MAX_NAME)] = count(n)
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 그림
// ─────────────────────────────────────────────────────────────

function readImage(name: string, res: ServerResponse): void {
  const id = name.replace(/\.png$/, '')
  if (!SAFE_IMAGE_ID.test(id)) return void fail(res, 400, 'BAD_ID', 'BAD ID')

  const file = join(IMAGES, `${id}.png`)
  if (!existsSync(file)) return void fail(res, 404, 'NOT_FOUND', 'NO IMAGE')

  res.statusCode = 200
  res.setHeader('Content-Type', 'image/png')
  // 그림은 한 번 올라가면 바뀌지 않는다. id 가 곧 내용이다.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(readFileSync(file))
}

/**
 * 그림은 JSON 안에 base64 로 들어온다. 동물 12마리면 1MB 를 넘어서
 * 문서에 그대로 두면 검색 한 번에 그걸 다 읽는다. 파일로 떼어 낸다.
 *
 * 실패하면 응답까지 마치고 `false` 를 준다 — 호출한 쪽이 이어서 쓰지 않도록.
 */
function storeImages(value: unknown, res: ServerResponse): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object') {
    fail(res, 400, 'BAD_IMAGES', 'BAD IMAGES')
    return false
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_IMAGES) {
    fail(res, 413, 'TOO_MANY_IMAGES', 'TOO MANY IMAGES')
    return false
  }

  ensureDirs()
  for (const [imageId, dataUrl] of entries) {
    if (!SAFE_IMAGE_ID.test(imageId)) continue
    if (typeof dataUrl !== 'string') continue
    // PNG 만 받는다. 다른 타입을 png 로 저장하면 브라우저가 뭘 할지 알 수 없다.
    if (!dataUrl.startsWith('data:image/png;base64,')) continue

    const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) continue
    if (!isPng(buffer)) continue

    writeFileSync(join(IMAGES, `${imageId}.png`), buffer)
  }
  return true
}

/** PNG 시그니처. 확장자만 믿으면 아무거나 올라온다. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const isPng = (buffer: Buffer): boolean => buffer.subarray(0, 8).equals(PNG_MAGIC)

// ─────────────────────────────────────────────────────────────
// 저장소
// ─────────────────────────────────────────────────────────────

function ensureDirs(): void {
  for (const dir of [ROOT, ZOOS, IMAGES, ACCOUNTS, SAVES]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

function allZoos(): ZooDoc[] {
  ensureDirs()
  const docs: ZooDoc[] = []
  for (const file of readdirSync(ZOOS)) {
    if (!file.endsWith('.json')) continue
    const doc = parse(join(ZOOS, file))
    if (doc) docs.push(doc)
  }
  return docs
}

function loadZoo(id: string): ZooDoc | null {
  ensureDirs()
  return parse(join(ZOOS, `${id}.json`))
}

function parse(file: string): ZooDoc | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as ZooDoc
  } catch {
    // 쓰는 도중에 읽었거나 손으로 건드려 깨진 파일. 하나 때문에 목록 전체가 죽으면 안 된다.
    return null
  }
}

/** 목록에 필요한 만큼만. 동물 배열까지 실어 보내면 검색 한 번이 수 MB 가 된다. */
function summary(zoo: ZooDoc) {
  return {
    userId: zoo.userId,
    zooName: zoo.zooName,
    reputation: zoo.reputation,
    day: zoo.day,
    animalCount: Array.isArray(zoo.animals) ? zoo.animals.length : 0,
    updatedAt: zoo.updatedAt,
  }
}

// ─────────────────────────────────────────────────────────────
// http 잡일
// ─────────────────────────────────────────────────────────────

type ServerResponse = Parameters<Connect.NextHandleFunction>[1]
type IncomingMessage = Parameters<Connect.NextHandleFunction>[0]

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

function ok(res: ServerResponse, body: Record<string, unknown>): void {
  send(res, 200, { ok: true, ...body })
}

function fail(res: ServerResponse, status: number, code: string, message: string): void {
  send(res, status, { ok: false, code, message })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/**
 * 본문을 JSON 으로 읽는다. 실패하면 응답까지 마치고 `null` 을 준다.
 *
 * `Content-Type` 을 확인하는 건 형식 때문만이 아니다 — 이걸 요구하면
 * 폼 전송으로 위장한 교차 출처 요청이 프리플라이트에 걸린다.
 */
async function readJson(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<Record<string, unknown> | null> {
  const type = req.headers['content-type'] ?? ''
  if (!type.includes('application/json')) {
    fail(res, 415, 'BAD_CONTENT_TYPE', 'EXPECTED JSON')
    return null
  }

  try {
    const parsed: unknown = JSON.parse(await readBody(req))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      fail(res, 400, 'BAD_BODY', 'BAD REQUEST')
      return null
    }
    return parsed as Record<string, unknown>
  } catch (e) {
    const tooLarge = e instanceof Error && e.message === 'TOO_LARGE'
    if (tooLarge) fail(res, 413, 'TOO_LARGE', 'REQUEST TOO LARGE')
    else fail(res, 400, 'BAD_BODY', 'BAD REQUEST')
    return null
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // 상한이 없으면 잘못된 요청 하나로 메모리가 통째로 넘어간다.
      if (size > MAX_BODY_BYTES) {
        reject(new Error('TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
