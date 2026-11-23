// clawd-buddy：輸入框上方的小機房舞台，橘色像素小吉祥物在裡面生活。
// 全部在本機畫，不呼叫模型、不吃 token。
//
// 舞台：左邊機櫃（燈號閃爍）、中間盆栽、右邊冷卻水塔（冒白煙）
// 平常（48 秒一輪）：走去看冷卻水塔 → 走去修機櫃 → 回中間打盹（Zzz）→ 起床跳一跳
// 我在工作：站到中間，依工具拿道具（讀檔→書、改檔→鉛筆、指令→扳手、上網→地球、思考→…），機櫃燈號加速
// 回覆完成：閃星星，自動換下一套裝扮（8 套）
// context ≥ 80%：頭上冒汗
// 下方三條進度條：context、5 小時額度、本週額度
// /clawd：隱藏／顯示

import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit, SessionContextUsage } from 'claude-code'

import type { Activity, Meter, Mood } from '../types'

const mood = atom({ plugin: 'clawd-buddy', key: 'mood' } as const, 'idle' as Mood)
const activity = atom({ plugin: 'clawd-buddy', key: 'activity' } as const, null as Activity)
const meter = atom({ plugin: 'clawd-buddy', key: 'meter' } as const, {
  context: null,
  fiveHour: null,
  sevenDay: null,
} as Meter)
const isHidden = atom({ plugin: 'clawd-buddy', key: 'isHidden' } as const, false)
const outfit = atom({ plugin: 'clawd-buddy', key: 'outfit' } as const, 0)

// ---------- 調色盤 ----------
const C = {
  body: '#D97757',
  bodyHi: '#E58E6F',
  bodyLo: '#B85F42',
  cheek: '#F2A08A',
  ink: '#1F1F1F',
  gold: '#F5D547',
  goldLt: '#FFF3B0',
  rack: '#3C424B',
  rackIn: '#262A30',
  tower: '#A3AFBB',
  towerLo: '#7D8995',
  steam: '#C9D0D6',
  pot: '#B5654A',
  leaf: '#5BA35B',
  leafLt: '#7CC47C',
  ground: '#808080',
}

const px = (x: number, y: number, w = 1, h = 1, fill = C.body, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

// ---------- 裝扮（每次回覆完成自動換下一套） ----------
const OUTFIT_COUNT = 8
const HIDES_EYES = new Set([1, 5]) // 墨鏡、護目鏡會蓋住眼睛

function accessory(n: number): string {
  switch (n) {
    case 1: // 墨鏡
      return px(4, 6, 4, 2, C.ink) + px(10, 6, 4, 2, C.ink) + px(8, 6, 2, 1, C.ink) + px(5, 6, 1, 1, '#555')
    case 2: // 牛仔帽
      return px(2, 3, 14, 1, '#8B5E3C') + px(5, 1, 8, 2, '#A0703F') + px(5, 2, 8, 1, '#6B4428')
    case 3: // 巫師帽
      return (
        px(3, 3, 12, 1, '#2E5BD8') + px(6, 2, 6, 1, '#3A6BF0') + px(7, 1, 4, 1, '#3A6BF0') +
        px(8, 0, 2, 1, '#3A6BF0') + px(7, 2, 1, 1, C.gold) + px(10, 1, 1, 1, C.gold)
      )
    case 4: // 工地安全帽
      return px(5, 1, 8, 1, '#F2C230') + px(4, 2, 10, 1, '#F2C230') + px(2, 3, 14, 1, '#D9A91E') + px(8, 1, 2, 1, '#FFE07A')
    case 5: // 實驗護目鏡
      return px(3, 5, 12, 1, '#3A3A3A') + px(5, 5, 3, 3, '#9AD0F0') + px(10, 5, 3, 3, '#9AD0F0') + px(5, 5, 1, 1, '#E6F5FF') + px(10, 5, 1, 1, '#E6F5FF')
    case 6: // 耳機
      return px(4, 2, 10, 1, '#333') + px(3, 3, 1, 2, '#333') + px(14, 3, 1, 2, '#333') + px(2, 5, 2, 3, '#E05A5A') + px(14, 5, 2, 3, '#E05A5A')
    case 7: // 派對帽
      return px(8, 0, 2, 1, '#E05AA8') + px(7, 1, 4, 1, '#5AB0E0') + px(6, 2, 6, 1, '#E05AA8') + px(5, 3, 8, 1, '#5AB0E0') + px(8, -1, 2, 1, C.gold)
    default:
      return ''
  }
}

/** 手上的道具（畫在身體右側） */
function prop(a: Activity): string {
  switch (a) {
    case 'read': // 書
      return px(17, 5, 5, 5, '#3A6BC8') + px(18, 6, 3, 3, '#FFFFFF') + px(19, 6, 1, 3, '#3A6BC8') + px(18, 7, 1, 1, '#9AA8C0') + px(20, 7, 1, 1, '#9AA8C0')
    case 'write': // 鉛筆
      return px(20, 4, 1, 1, '#F28AA0') + px(19, 5, 1, 1, C.gold) + px(18, 6, 1, 1, C.gold) + px(17, 7, 1, 1, '#3A3A3A')
    case 'run': // 扳手
      return px(19, 4, 3, 1, '#A8B0B8') + px(19, 5, 1, 1, '#A8B0B8') + px(21, 5, 1, 1, '#A8B0B8') + px(20, 6, 1, 3, '#A8B0B8')
    case 'web': // 地球
      return px(18, 5, 3, 3, '#3A8DDE') + px(19, 4, 1, 1, '#3A8DDE') + px(19, 8, 1, 1, '#3A8DDE') + px(17, 6, 1, 1, '#3A8DDE') + px(21, 6, 1, 1, '#3A8DDE') + px(19, 6, 1, 1, '#5BC27A')
    default: // 思考中：頭旁三個點
      return `<g class="dots">${px(18, 3, 1, 1, '#B8B8B8')}${px(20, 2, 1, 1, '#B8B8B8')}${px(22, 1, 1, 1, '#B8B8B8')}</g>`
  }
}

/** 小吉祥物本體，區域座標約 0..18 × 0..13（腳底在 y=13） */
function clawd(opts: { eyes: 'happy' | 'open' | 'timeline'; fit: number; sweaty: boolean }): string {
  const { eyes, fit, sweaty } = opts
  const happy =
    px(5, 7, 1, 1, C.ink) + px(6, 6, 1, 1, C.ink) + px(7, 7, 1, 1, C.ink) +
    px(10, 7, 1, 1, C.ink) + px(11, 6, 1, 1, C.ink) + px(12, 7, 1, 1, C.ink)
  const open = `<g class="blink">${px(6, 6, 1, 2, C.ink)}${px(11, 6, 1, 2, C.ink)}</g>`
  const closed = px(5, 7, 3, 1, C.ink) + px(10, 7, 3, 1, C.ink)
  let eyePx = ''
  if (!HIDES_EYES.has(fit)) {
    if (eyes === 'happy') eyePx = happy
    else if (eyes === 'open') eyePx = open
    else eyePx = `<g class="tl tl-awake">${happy}</g><g class="tl tl-nap">${closed}</g>`
  }
  const body =
    px(4, 4, 10, 1, C.bodyHi) + // 頂排亮面
    px(3, 5, 12, 5) +
    px(4, 10, 10, 1, C.bodyLo) + // 底排陰影
    px(3, 9, 1, 1, C.bodyLo) + px(14, 9, 1, 1, C.bodyLo) +
    px(1, 6, 2, 3) + px(1, 8, 2, 1, C.bodyLo) + // 左手
    px(15, 6, 2, 3) + px(15, 8, 2, 1, C.bodyLo) + // 右手
    px(4, 8, 1, 1, C.cheek) + px(13, 8, 1, 1, C.cheek) // 腮紅
  const legs =
    `<g class="la">${px(4, 11, 1, 2, C.bodyLo)}${px(11, 11, 1, 2, C.bodyLo)}</g>` +
    `<g class="lb">${px(6, 11, 1, 2, C.bodyLo)}${px(13, 11, 1, 2, C.bodyLo)}</g>`
  const sweat = sweaty ? `<g class="drip">${px(16, 2, 1, 1, '#7EC8F2')}${px(16, 3, 1, 1, '#7EC8F2')}</g>` : ''
  return legs + `<g class="bob">${body}${eyePx}${accessory(fit)}</g>` + sweat
}

// ---------- 舞台 ----------
const W = 200 // 舞台寬（格）
const H = 17 // 舞台高（格）
const GROUND = 15 // 地面 y
const U = 5 // 1 格 = 5 px（實際會依面板寬度等比縮放）
const MY = GROUND - 13 // 小吉祥物的 y 位移（腳底踩地）

function scenery(fastLeds: boolean): string {
  // 機櫃（左）
  const leds = [4, 7, 10, 13]
    .map(
      (y, i) =>
        `<g class="led" style="animation-delay:${(i * 0.37).toFixed(2)}s">${px(7, y, 1, 1, '#5BE37A')}</g>` +
        `<g class="led" style="animation-delay:${(i * 0.53 + 0.2).toFixed(2)}s">${px(9, y, 1, 1, i % 2 ? '#4AA8FF' : '#5BE37A')}</g>` +
        px(11, y, 4, 1, '#3A3F46'),
    )
    .join('')
  const rack = px(4, 2, 13, 13, C.rack) + px(5, 3, 11, 11, C.rackIn) + leds + px(4, 14, 13, 1, '#2A2E34')
  // 盆栽（中）
  const plant =
    px(118, 12, 5, 3, C.pot) + px(117, 12, 7, 1, '#C77757') +
    px(120, 8, 1, 4, C.leaf) + px(118, 9, 2, 1, C.leafLt) + px(117, 10, 1, 1, C.leaf) +
    px(121, 9, 2, 1, C.leafLt) + px(123, 8, 1, 1, C.leaf)
  // 冷卻水塔（右）
  const tower =
    px(178, 7, 17, 8, C.tower) + px(177, 6, 19, 1, C.towerLo) +
    px(179, 9, 15, 1, C.towerLo) + px(179, 11, 15, 1, C.towerLo) + px(179, 13, 15, 1, C.towerLo) +
    px(182, 4, 9, 2, C.towerLo) + px(183, 3, 7, 1, '#6B7682')
  const steam =
    `<g class="steam">${px(184, 1, 2, 1, C.steam)}${px(186, 0, 2, 1, C.steam)}</g>` +
    `<g class="steam" style="animation-delay:1s">${px(187, 1, 2, 1, C.steam)}${px(185, 0, 1, 1, C.steam)}</g>`
  const floor =
    px(0, GROUND, W, 0.35, C.ground, ' opacity=".35"') +
    Array.from({ length: 20 }, (_, i) => px(i * 10 + 3, GROUND + 1, 3, 0.3, C.ground, ' opacity=".18"')).join('')
  return floor + rack + plant + tower + steam + (fastLeds ? '<style>.led{animation-duration:.35s}</style>' : '')
}

// 生活時間軸（48 秒一輪），[百分比, x, 面向 1 右 / -1 左]
const T = 48
const ROUTE: Array<[number, number, number]> = [
  [0, 86, 1],
  [12.08, 156, 1], // 走到冷卻水塔前
  [20.42, 156, 1], // 抬頭看
  [20.5, 156, -1],
  [44.38, 18, -1], // 走到機櫃前
  [56.88, 18, -1], // 修機櫃
  [56.96, 18, 1],
  [68.75, 86, 1], // 回中間
  [100, 86, 1], // 打盹、起床
]
const at = (x: number, s: number) => `transform:translate(${x + 9}px,${MY}px) scale(${s},1) translate(-9px,0)`

const TIMELINE_CSS =
  `.tl{animation-duration:${T}s;animation-iteration-count:infinite;animation-delay:var(--d)}` +
  `.route{animation-name:route;animation-timing-function:linear}` +
  `@keyframes route{${ROUTE.map(([p, x, s]) => `${p}%{${at(x, s)}}`).join('')}}` +
  // 修機櫃時拿扳手、冒火花
  `.tl-fix{animation-name:fix}@keyframes fix{0%,44.3%{opacity:0}44.4%,56.8%{opacity:1}56.9%,100%{opacity:0}}` +
  // 打盹：閉眼、Zzz、身體沉一點；起床後跳兩下
  `.tl-nap,.tl-zzz{animation-name:nap}@keyframes nap{0%,68.7%{opacity:0}68.8%,89.5%{opacity:1}89.6%,100%{opacity:0}}` +
  `.tl-awake{animation-name:awake}@keyframes awake{0%,68.7%{opacity:1}68.8%,89.5%{opacity:0}89.6%,100%{opacity:1}}` +
  `.tl-life{animation-name:life}@keyframes life{0%,68.7%{transform:translateY(0)}69%,89.5%{transform:translateY(1px)}90%{transform:translateY(0)}91%{transform:translateY(-2px)}92%{transform:translateY(0)}93%{transform:translateY(-2px)}94%,100%{transform:translateY(0)}}`

const BASE_CSS = `
  .bob{animation:bob 2.4s ease-in-out infinite}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.5px)}}
  .la{animation:step .5s steps(1) infinite}
  .lb{animation:step .5s steps(1) infinite .25s}
  @keyframes step{0%{transform:translateY(0)}50%{transform:translateY(-0.6px)}}
  .blink{animation:blink 3s steps(1) infinite}
  @keyframes blink{0%,92%{opacity:1}93%,100%{opacity:0}}
  .drip{animation:drip 1.2s ease-in infinite}
  @keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(2px);opacity:0}}
  .dots{animation:dots 1.2s steps(3) infinite}
  @keyframes dots{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}
  .spark{animation:spark .6s steps(1) 5}
  @keyframes spark{0%{opacity:1}50%{opacity:0}}
  .hop{animation:hop .9s ease-out infinite}
  @keyframes hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-1.5px)}}
  .led{animation:led 1.6s steps(1) infinite}
  @keyframes led{0%,70%{opacity:1}71%,100%{opacity:.25}}
  .steam{animation:steam 2s ease-out infinite}
  @keyframes steam{0%{transform:translateY(2px);opacity:0}30%{opacity:.9}100%{transform:translateY(-1px);opacity:0}}
  .zz{animation:zz 2.4s ease-out infinite}
  @keyframes zz{0%{transform:translate(0,1px);opacity:0}30%{opacity:1}100%{transform:translate(1px,-2px);opacity:0}}`

const svgWrap = (inner: string, extraCss: string, delay = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * U}" height="${H * U}" ` +
  `shape-rendering="crispEdges" style="--d:-${delay}s">` +
  `<style>${BASE_CSS}${extraCss}</style>${inner}</svg>`

const Z = (x: number, y: number, c = '#7F93A8') =>
  px(x, y, 4, 1, c) + px(x + 2, y + 1, 1, 1, c) + px(x + 1, y + 2, 1, 1, c) + px(x, y + 3, 4, 1, c)

function stageSvg(m: Mood, a: Activity, fit: number, sweaty: boolean): string {
  if (m === 'working') {
    return svgWrap(
      scenery(true) +
        `<g transform="translate(86,${MY})"><g class="hop">${clawd({ eyes: 'open', fit, sweaty })}${prop(a)}</g></g>`,
      '',
    )
  }
  // idle / done：照時間軸生活。每次重畫從時間軸上隨機一點開始
  const delay = Math.round(Math.random() * T)
  const spark =
    m === 'done'
      ? `<g class="spark">${px(-1, 1, 1, 1, C.gold)}${px(18, 0, 1, 1, C.gold)}${px(0, 0, 1, 1, C.goldLt)}${px(19, 3, 1, 1, C.goldLt)}</g>`
      : ''
  const wrench = `<g class="tl tl-fix">${prop('run')}<g class="spark" style="animation-iteration-count:infinite">${px(22, 3, 1, 1, C.gold)}</g></g>`
  const zzz = `<g class="tl tl-zzz"><g class="zz">${Z(17, 2)}</g><g class="zz" style="animation-delay:1.2s">${Z(22, -2)}</g></g>`
  return svgWrap(
    scenery(false) +
      `<g class="tl route"><g class="tl tl-life">${clawd({ eyes: 'timeline', fit, sweaty })}${wrench}${spark}</g>${zzz}</g>`,
    TIMELINE_CSS,
    delay,
  )
}

// ---------- 用量 ----------
const pick = (limits: SessionRateLimit[], kind: string) =>
  limits.find(l => l.kind === kind)?.percentUsed ?? null

const toMeter = (context: SessionContextUsage, limits: SessionRateLimit[]): Meter => ({
  context: context.percent ?? null,
  fiveHour: pick(limits, 'five_hour'),
  sevenDay: pick(limits, 'seven_day'),
})

const tone = (v: number) => (v >= 80 ? '#E5484D' : v >= 60 ? '#E8A23B' : C.body)

function activityOf(tool: string): Activity {
  if (/^(Read|Grep|Glob|NotebookRead)$/.test(tool)) return 'read'
  if (/^(Edit|Write|NotebookEdit)$/.test(tool)) return 'write'
  if (/^(Bash|PowerShell)$/.test(tool)) return 'run'
  if (/^(WebSearch|WebFetch)$/.test(tool) || tool.startsWith('mcp__')) return 'web'
  return null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'clawd', description: '顯示／隱藏輸入框上方的小吉祥物' })
    try {
      const u = await $.session.usage()
      await update($, meter, () => toMeter(u.context, u.rateLimits))
    } catch {
      // 尚無讀數就先空著，等 session.measure 推送
    }
    return next(e)
  })

  on('command.run', { command: 'clawd' }, async $ => {
    const now = await read($, isHidden)
    await update($, isHidden, () => !now)
    return { text: now ? '小吉祥物出來了。' : '小吉祥物先躲起來了，再輸入 /clawd 叫它回來。' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, meter, () => toMeter(e.context, e.rateLimits))
    return next(e)
  })

  // 這兩個事件會擋在使用者送出訊息／Claude 呼叫工具之前：小吉祥物出錯也一律放行
  on('prompt.submit', async ($, e, next) => {
    await (async () => {
      await update($, mood, () => 'working' as Mood)
      await update($, activity, () => null as Activity)
    })().catch(() => undefined) // 忽略：不影響正常使用
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await (async () => {
      const a = activityOf(e.tool)
      if ((await read($, activity)) !== a) await update($, activity, () => a)
    })().catch(() => undefined) // 忽略：不影響正常使用
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, mood, () => 'done' as Mood)
    await update($, activity, () => null as Activity)
    await update($, outfit, n => (n + 1) % OUTFIT_COUNT) // 每次回覆完成自動換裝
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const m = await read($, mood)
    const a = await read($, activity)
    const u = await read($, meter)
    const fit = (await read($, outfit)) % OUTFIT_COUNT
    const ui = $.ui.resolve(e)
    const { Box, Text, Progress } = ui
    const sweaty = (u.context ?? 0) >= 80

    const gauge = (label: string, v: number | null) => (
      <Box key={label} flexDirection="column" flexGrow={1} flexShrink={1}>
        {v === null ? (
          <Text dimColor>{label}　—</Text>
        ) : (
          <Progress label={label} value={v} max={100} valueText={`${Math.round(v)}%`} color={tone(v)} />
        )}
      </Box>
    )
    const gauges = (
      <Box flexDirection="row" gap={2} width="100%">
        {gauge('Context', u.context)}
        {gauge('5 小時額度', u.fiveHour)}
        {gauge('本週額度', u.sevenDay)}
      </Box>
    )

    // 終端機沒有 Svg，只顯示用量
    if (!('Svg' in ui)) return gauges
    const { Svg } = ui

    return (
      <Box flexDirection="column" gap={1} width="100%">
        <Svg source={stageSvg(m, a, fit, sweaty)} alt={m === 'working' ? '小吉祥物正在忙' : '小吉祥物在機房裡閒晃'} />
        {gauges}
      </Box>
    )
  })
}
