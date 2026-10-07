import { readFileSync } from 'fs'
import { randomInt, timingSafeEqual, createHash } from 'crypto'
import os from 'os'
import path from 'path'

// DB 복원용 일회용 인증번호(OTP). 슬랙으로 보내고 5분 안에 한 번만 쓸 수 있음.
// PM2 단일 프로세스라 메모리에 보관 (라우트 번들이 달라도 공유되도록 globalThis 사용)
const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_INTERVAL_MS = 60 * 1000
const MAX_ATTEMPTS = 5

interface PendingOtp { hash: Buffer; expiresAt: number; issuedAt: number; attempts: number }
const store = globalThis as unknown as { __restoreOtp?: PendingOtp | null }

const sha = (s: string) => createHash('sha256').update(s).digest()

// 슬랙 Incoming Webhook URL: 환경변수 SLACK_WEBHOOK_URL, 없으면 서버의 ~/stock-history/.slack-webhook-url
// (배포 시 GitHub Secret SLACK_WEBHOOK_URL 로 이 파일을 만듦 — deploy.yml)
export function getSlackWebhookUrl(): string | null {
  if (process.env.SLACK_WEBHOOK_URL) return process.env.SLACK_WEBHOOK_URL
  try {
    return readFileSync(path.join(os.homedir(), 'stock-history', '.slack-webhook-url'), 'utf8').trim() || null
  } catch {
    return null
  }
}

export type IssueResult =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: 'not-configured' | 'too-soon' | 'send-failed'; retryAfterSec?: number }

export async function issueRestoreOtp(): Promise<IssueResult> {
  const webhook = getSlackWebhookUrl()
  if (!webhook) return { ok: false, reason: 'not-configured' }

  const now = Date.now()
  const prev = store.__restoreOtp
  if (prev && now - prev.issuedAt < RESEND_INTERVAL_MS) {
    return { ok: false, reason: 'too-soon', retryAfterSec: Math.ceil((RESEND_INTERVAL_MS - (now - prev.issuedAt)) / 1000) }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiresAt = now + OTP_TTL_MS
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[매매일지] DB 복원 인증번호: *${code}*\n5분 동안 한 번만 쓸 수 있어요. 직접 요청하지 않았다면 무시하세요.` }),
    })
    if (!res.ok) return { ok: false, reason: 'send-failed' }
  } catch {
    return { ok: false, reason: 'send-failed' }
  }
  // 새 번호를 보내면 이전 번호는 무효
  store.__restoreOtp = { hash: sha(code), expiresAt, issuedAt: now, attempts: 0 }
  return { ok: true, expiresAt }
}

export function verifyRestoreOtp(input: unknown): 'ok' | 'missing' | 'expired' | 'wrong' {
  const p = store.__restoreOtp
  if (!p) return 'missing'
  if (Date.now() > p.expiresAt) {
    store.__restoreOtp = null
    return 'expired'
  }
  if (typeof input !== 'string' || !timingSafeEqual(sha(input.trim()), p.hash)) {
    p.attempts++
    if (p.attempts >= MAX_ATTEMPTS) store.__restoreOtp = null
    return 'wrong'
  }
  store.__restoreOtp = null // 일회용
  return 'ok'
}
