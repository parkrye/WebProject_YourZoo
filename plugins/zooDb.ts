import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Connect, Plugin, ViteDevServer, PreviewServer } from 'vite'

/**
 * 동물원 공개 저장소.
 *
 * 정적 서버 옆에 미들웨어 하나만 얹어 `db/` 폴더를 DB 로 쓴다.
 * 재미로 돌리는 서버라 인증도 스키마 검증도 없다 — 대신 **경로 조작만은 막는다.**
 * 아이디가 그대로 파일명이 되므로 `..` 이 섞이면 레포 밖에 파일을 쓴다.
 */
const ROOT = 'db'
const ZOOS = join(ROOT, 'zoos')
const IMAGES = join(ROOT, 'images')

/** 업로드 한 건의 상한. 동물 12마리 그림이 넉넉히 들어간다. */
const MAX_BODY_BYTES = 24 * 1024 * 1024

/** 파일명으로 쓸 수 있는 아이디인가. 대문자와 숫자뿐이라 경로 구분자가 낄 자리가 없다. */
const SAFE_ID = /^[A-Z0-9]{2,32}$/

interface ZooDoc {
  userId: string
  zooName: string
  reputation: number
  day: number
  unlocked: string[]
  animals: unknown[]
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

const handle: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname.replace(/\/+$/, '')

  if (path === '/zoos' && req.method === 'GET') return void search(url, res)
  if (path === '/zoos/random' && req.method === 'GET') return void random(url, res)

  const match = /^\/zoos\/([^/]+)$/.exec(path)
  if (match) {
    const id = decodeURIComponent(match[1] ?? '')
    if (!SAFE_ID.test(id)) return void send(res, 400, { error: 'BAD ID' })
    if (req.method === 'GET') return void readZoo(id, res)
    if (req.method === 'PUT') return void writeZoo(id, req, res)
  }

  const image = /^\/images\/([^/]+)$/.exec(path)
  if (image && req.method === 'GET') return void readImage(image[1] ?? '', res)

  next()
}

// ─────────────────────────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────────────────────────

function search(url: URL, res: ServerResponse): void {
  const q = (url.searchParams.get('q') ?? '').trim().toUpperCase()
  const exclude = url.searchParams.get('exclude') ?? ''

  // 아이디로도 동물원 이름으로도 찾는다. 둘 중 뭘 들고 왔는지 유저는 신경 쓸 필요 없다.
  const hits = allZoos()
    .filter((zoo) => zoo.userId !== exclude)
    .filter((zoo) => q === '' || zoo.userId.includes(q) || zoo.zooName.toUpperCase().includes(q))
    .map(summary)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20)

  send(res, 200, { zoos: hits })
}

function random(url: URL, res: ServerResponse): void {
  const exclude = url.searchParams.get('exclude') ?? ''
  const others = allZoos().filter((zoo) => zoo.userId !== exclude)
  // 저장된 동물원이 자기 것뿐이면 갈 데가 없다. 빈 목록이 아니라 실패로 알린다.
  if (others.length === 0) return void send(res, 404, { error: 'NO OTHER ZOOS' })

  const pick = others[Math.floor(Math.random() * others.length)] as ZooDoc
  send(res, 200, pick)
}

function readZoo(id: string, res: ServerResponse): void {
  const doc = loadZoo(id)
  if (!doc) return void send(res, 404, { error: 'NOT FOUND' })
  send(res, 200, doc)
}

function writeZoo(id: string, req: IncomingMessage, res: ServerResponse): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as ZooDoc & { images?: Record<string, string> }

      // 그림은 JSON 안에 base64 로 들어온다. 동물 12마리면 1MB 를 넘어서
      // 문서에 그대로 두면 검색 한 번에 그걸 다 읽는다. 파일로 떼어 낸다.
      for (const [imageId, dataUrl] of Object.entries(body.images ?? {})) {
        if (!SAFE_IMAGE_ID.test(imageId)) continue
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        writeFileSync(join(IMAGES, `${imageId}.png`), Buffer.from(base64, 'base64'))
      }
      delete body.images

      const doc: ZooDoc = { ...body, userId: id, updatedAt: Date.now() }
      writeFileSync(join(ZOOS, `${id}.json`), JSON.stringify(doc), 'utf8')
      send(res, 200, { ok: true })
    })
    .catch((e: unknown) => send(res, 400, { error: e instanceof Error ? e.message : 'BAD BODY' }))
}

function readImage(name: string, res: ServerResponse): void {
  const id = name.replace(/\.png$/, '')
  if (!SAFE_IMAGE_ID.test(id)) return void send(res, 400, { error: 'BAD ID' })

  const file = join(IMAGES, `${id}.png`)
  if (!existsSync(file)) return void send(res, 404, { error: 'NOT FOUND' })

  res.statusCode = 200
  res.setHeader('Content-Type', 'image/png')
  // 그림은 한 번 올라가면 바뀌지 않는다. id 가 곧 내용이다.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.end(readFileSync(file))
}

// ─────────────────────────────────────────────────────────────
// 저장소
// ─────────────────────────────────────────────────────────────

/** 그림 id 는 UUID 이거나 거기에 접미사가 붙은 형태다. 경로 구분자는 허용하지 않는다. */
const SAFE_IMAGE_ID = /^[A-Za-z0-9_-]{4,80}$/

function ensureDirs(): void {
  for (const dir of [ROOT, ZOOS, IMAGES]) {
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

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // 상한이 없으면 잘못된 요청 하나로 메모리가 통째로 넘어간다.
      if (size > MAX_BODY_BYTES) {
        reject(new Error('TOO LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
