// clawd-buddy：輸入框上方的「小工作室」舞台，橘色像素小吉祥物在裡面生活。
// 全部在本機畫，不呼叫模型、不吃 token。
//
// 工作室：書櫃、白板、電腦桌、窗戶＋望遠鏡（天色跟著電腦時間）、懶骨頭沙發、掛鐘（真實時間）
// 平常（48 秒一輪）：打電腦 → 窗邊看看 → 沙發打盹 → 白板寫字 → 書櫃翻書
// 工作中：跑到對應工作站（讀檔→書櫃、改檔→白板、指令／思考→電腦桌、上網→窗邊）
// 每個 subagent：多一隻小 clawd，依它自己用的工具跑到工作站；結束就消失
// 回覆完成：閃星星、自動換下一套裝扮（8 套）
// context ≥ 80%：頭上冒汗；下方三條進度條：context、5 小時額度、本週額度
// /clawd：隱藏／顯示

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, SessionContextUsage } from 'claude-code'

import type { Activity, Helper, Meter, Mood, Travel } from '../types'

const mood = atom({ plugin: 'clawd-buddy', key: 'mood' } as const, 'idle' as Mood)
const activity = atom({ plugin: 'clawd-buddy', key: 'activity' } as const, null as Activity)
const meter = atom({ plugin: 'clawd-buddy', key: 'meter' } as const, {
  context: null,
  fiveHour: null,
  sevenDay: null,
} as Meter)
const isHidden = atom({ plugin: 'clawd-buddy', key: 'isHidden' } as const, false)
const outfit = atom({ plugin: 'clawd-buddy', key: 'outfit' } as const, 0)
const travel = atom({ plugin: 'clawd-buddy', key: 'travel' } as const, { from: 82, to: 82, face: 1, at: 0 } as Travel)
const helpers = atom({ plugin: 'clawd-buddy', key: 'helpers' } as const, [] as Helper[])

// ---------- 調色盤 ----------
const C = {
  body: '#D97757',
  bodyHi: '#E58E6F',
  bodyLo: '#B85F42',
  cheek: '#F2A08A',
  ink: '#1F1F1F',
  gold: '#F5D547',
  goldLt: '#FFF3B0',
  wood: '#A0703F',
  woodLo: '#7A5230',
  frame: '#9AA3AD',
  ground: '#808080',
}

const px = (x: number, y: number, w = 1, h = 1, fill = C.body, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

// ---------- 裝扮 ----------
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

/** 手上的道具（畫在身體右側；面向左時會跟著翻到左側，朝向工作站） */
function prop(a: Activity): string {
  switch (a) {
    case 'read': // 書
      return px(17, 5, 5, 5, '#3A6BC8') + px(18, 6, 3, 3, '#FFFFFF') + px(19, 6, 1, 3, '#3A6BC8') + px(18, 7, 1, 1, '#9AA8C0') + px(20, 7, 1, 1, '#9AA8C0')
    case 'write': // 白板筆
      return px(21, 3, 1, 1, '#2E5BD8') + px(20, 4, 1, 1, '#E8E8E8') + px(19, 5, 1, 1, '#E8E8E8') + px(18, 6, 1, 1, '#2E5BD8')
    case 'run': // 敲鍵盤的手（小火花）
      return `<g class="type">${px(17, 8, 2, 1, C.bodyLo)}${px(20, 7, 1, 1, C.gold)}</g>`
    case 'web': // 地球
      return px(18, 5, 3, 3, '#3A8DDE') + px(19, 4, 1, 1, '#3A8DDE') + px(19, 8, 1, 1, '#3A8DDE') + px(17, 6, 1, 1, '#3A8DDE') + px(21, 6, 1, 1, '#3A8DDE') + px(19, 6, 1, 1, '#5BC27A')
    default: // 思考中：頭旁三個點
      return `<g class="dots">${px(18, 3, 1, 1, '#B8B8B8')}${px(20, 2, 1, 1, '#B8B8B8')}${px(22, 1, 1, 1, '#B8B8B8')}</g>`
  }
}

type EyeMode = 'happy' | 'open' | 'timeline'

/** 小吉祥物本體，區域座標約 0..18 × 0..13（腳底在 y=13） */
function clawd(eyes: EyeMode, fit: number, sweaty: boolean): string {
  const happy =
    px(5, 7, 1, 1, C.ink) + px(6, 6, 1, 1, C.ink) + px(7, 7, 1, 1, C.ink) +
    px(10, 7, 1, 1, C.ink) + px(11, 6, 1, 1, C.ink) + px(12, 7, 1, 1, C.ink)
  const open = `<g class="blink">${px(6, 6, 1, 2, C.ink)}${px(11, 6, 1, 2, C.ink)}</g>`
  const closed = px(5, 7, 3, 1, C.ink) + px(10, 7, 3, 1, C.ink)
  let eyePx = ''
  if (!HIDES_EYES.has(fit)) {
    if (eyes === 'happy') eyePx = happy
    else if (eyes === 'open') eyePx = open
    else eyePx = `<g class="tl w-awake">${happy}</g><g class="tl w-nap">${closed}</g>`
  }
  const body =
    px(4, 4, 10, 1, C.bodyHi) +
    px(3, 5, 12, 5) +
    px(4, 10, 10, 1, C.bodyLo) +
    px(3, 9, 1, 1, C.bodyLo) + px(14, 9, 1, 1, C.bodyLo) +
    px(1, 6, 2, 3) + px(1, 8, 2, 1, C.bodyLo) +
    px(15, 6, 2, 3) + px(15, 8, 2, 1, C.bodyLo) +
    px(4, 8, 1, 1, C.cheek) + px(13, 8, 1, 1, C.cheek)
  const legs =
    `<g class="la">${px(4, 11, 1, 2, C.bodyLo)}${px(11, 11, 1, 2, C.bodyLo)}</g>` +
    `<g class="lb">${px(6, 11, 1, 2, C.bodyLo)}${px(13, 11, 1, 2, C.bodyLo)}</g>`
  const sweat = sweaty ? `<g class="drip">${px(16, 2, 1, 1, '#7EC8F2')}${px(16, 3, 1, 1, '#7EC8F2')}</g>` : ''
  return legs + `<g class="bob">${body}${eyePx}${accessory(fit)}</g>` + sweat
}

// ---------- 舞台 ----------
const W = 200
const H = 17
const GROUND = 15
const U = 5
const MY = GROUND - 13
const SPEED = 16 // 走路速度（格／秒）

/** 工作站：小吉祥物站的位置與面向 */
const SPOT: Record<'read' | 'write' | 'run' | 'web' | 'think', { x: number; face: number }> = {
  read: { x: 20, face: -1 }, // 書櫃
  write: { x: 64, face: -1 }, // 白板
  run: { x: 82, face: 1 }, // 電腦桌
  think: { x: 82, face: 1 }, // 電腦桌前想事情
  web: { x: 132, face: 1 }, // 窗邊
}
const spotOf = (a: Activity) => SPOT[a ?? 'think']

function sky(hour: number): string {
  // 窗戶 x150..168, y2..9
  const day = hour >= 6 && hour < 16
  const dusk = hour >= 16 && hour < 18
  const fill = day ? '#9AD6F5' : dusk ? '#F4B183' : '#22305A'
  let deco = ''
  if (day) deco = px(153, 4, 4, 1, '#FFFFFF') + px(154, 3, 2, 1, '#FFFFFF') + px(161, 6, 3, 1, '#FFFFFF') + px(165, 3, 2, 2, '#FFE07A')
  else if (dusk) deco = px(162, 6, 3, 2, '#FF8A5B') + px(153, 4, 3, 1, '#FCD9B8')
  else deco = px(164, 3, 2, 2, '#F5F0C8') + px(165, 3, 1, 1, '#22305A') + `<g class="twinkle">${px(153, 3, 1, 1, '#FFFFFF')}${px(158, 6, 1, 1, '#FFFFFF')}</g>${px(156, 4, 1, 1, '#C8D0FF')}`
  return px(150, 2, 19, 8, C.frame) + px(151, 3, 17, 6, fill) + deco + px(159, 3, 1, 6, C.frame) + px(151, 5, 17, 0.5, C.frame)
}

function clock(date: Date): string {
  // 掛鐘：中心 (31,4.5)
  const cx = 31
  const cy = 4.5
  const h = ((date.getHours() % 12) + date.getMinutes() / 60) * 30
  const m = date.getMinutes() * 6
  const hand = (deg: number, len: number, w: number) => {
    const r = ((deg - 90) * Math.PI) / 180
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(r) * len).toFixed(2)}" y2="${(cy + Math.sin(r) * len).toFixed(2)}" stroke="${C.ink}" stroke-width="${w}" stroke-linecap="round"/>`
  }
  return (
    `<circle cx="${cx}" cy="${cy}" r="3" fill="#FFFDF5" stroke="${C.woodLo}" stroke-width=".6"/>` +
    hand(h, 1.5, 0.5) + hand(m, 2.3, 0.35) + `<circle cx="${cx}" cy="${cy}" r=".35" fill="${C.ink}"/>`
  )
}

function scenery(date: Date, busyScreen: boolean): string {
  const floor =
    px(0, GROUND, W, 0.35, C.ground, ' opacity=".35"') +
    Array.from({ length: 20 }, (_, i) => px(i * 10 + 3, GROUND + 1, 3, 0.3, C.ground, ' opacity=".18"')).join('')
  // 書櫃 x4..17
  const bookColors = ['#D9534F', '#3A6BC8', '#5BA35B', '#F2C230', '#8E6FBF', '#E58E6F']
  const books = [4, 8, 12]
    .map((y, row) =>
      Array.from({ length: 5 }, (_, i) => px(6 + i * 2, y + (i % 2), 1.6, 3 - (i % 2), bookColors[(i + row * 2) % bookColors.length]!)).join(''),
    )
    .join('')
  const shelf = px(4, 2, 14, 13, C.wood) + px(5, 3, 12, 11, '#5E3F22') + px(5, 7, 12, 1, C.wood) + px(5, 11, 12, 1, C.wood) + books
  // 白板 x44..62
  const board =
    px(44, 3, 19, 9, C.frame) + px(45, 4, 17, 7, '#F7F7F2') +
    `<polyline points="47,9 50,7 53,8 56,5 59,6" fill="none" stroke="#3A6BC8" stroke-width=".5"/>` +
    px(47, 5, 4, 0.5, '#D9534F') + px(47, 6.2, 3, 0.5, '#9AA3AD') +
    px(46, 12, 1, 3, C.frame) + px(60, 12, 1, 3, C.frame) + px(50, 11, 6, 0.6, '#C0C6CC')
  // 電腦桌 x100..122
  const desk =
    px(100, 10, 23, 1, C.wood) + px(101, 11, 1, 4, C.woodLo) + px(121, 11, 1, 4, C.woodLo) + px(112, 11, 8, 3, C.woodLo) + px(113, 12, 6, 0.5, '#C9A27A') +
    px(105, 3, 12, 6, '#3C424B') + `<g class="${busyScreen ? 'screen busy' : 'screen'}">${px(106, 4, 10, 4, '#4A90D9')}</g>` +
    px(107, 5, 5, 0.5, '#CFE6FF') + px(107, 6.3, 3, 0.5, '#CFE6FF') + px(110, 9, 2, 1, '#3C424B') + px(106, 9.6, 9, 0.4, '#5A6068') +
    px(119, 8, 2, 2, '#FFFFFF') + px(121, 8.5, 0.6, 1, '#FFFFFF') + `<g class="steam">${px(119.5, 6.5, 0.6, 1, '#C9D0D6')}</g>` // 咖啡杯
  // 盆栽
  const plant =
    px(138, 12, 5, 3, '#B5654A') + px(137, 12, 7, 1, '#C77757') +
    px(140, 8, 1, 4, '#5BA35B') + px(138, 9, 2, 1, '#7CC47C') + px(137, 10, 1, 1, '#5BA35B') + px(141, 9, 2, 1, '#7CC47C') + px(143, 8, 1, 1, '#5BA35B')
  // 望遠鏡
  const scope = px(152, 12, 1, 3, '#555') + px(154, 12, 1, 3, '#555') + px(153, 11, 1, 1, '#555') + px(151, 9, 5, 2, '#6B7682') + px(156, 9, 1, 1, '#A3AFBB')
  // 懶骨頭沙發 x178..196
  const sofa = px(179, 11, 17, 4, '#8E6FBF') + px(178, 12, 19, 3, '#8E6FBF') + px(181, 10, 13, 1, '#A88BD6') + px(185, 12, 6, 1, '#A88BD6') + px(182, 9, 5, 2, '#F2C230')
  return floor + shelf + clock(date) + board + desk + plant + sky(date.getHours()) + scope + sofa
}

// 平常的生活時間軸（48 秒一輪）：[秒, x, 面向]
const T = 48
const ROUTE_S: Array<[number, number, number]> = [
  [0, 82, 1], [5, 82, 1], // 打電腦
  [8.125, 132, 1], [12.125, 132, 1], // 窗邊看看
  [14.875, 176, 1], [25.375, 176, 1], // 沙發打盹、起床
  [25.4, 176, -1],
  [32.375, 64, -1], [36.375, 64, -1], // 白板寫字
  [39.125, 20, -1], [44.125, 20, -1], // 書櫃翻書
  [44.15, 20, 1],
  [48, 82, 1],
]
const pct = (s: number) => +((s / T) * 100).toFixed(3)

/** 時間軸在 phase 秒時的位置（用來讓主角從目前位置出發去工作站） */
function routeX(phase: number): number {
  for (let i = 1; i < ROUTE_S.length; i++) {
    const [t1, x1] = ROUTE_S[i]!
    const [t0, x0] = ROUTE_S[i - 1]!
    if (phase <= t1) return x0 + ((x1 - x0) * (phase - t0)) / Math.max(t1 - t0, 1e-6)
  }
  return ROUTE_S[0]![1]
}

/** 在時間軸某段顯示（opacity 1），其他時間隱藏 */
function windowKf(name: string, a: number, b: number): string {
  const A = pct(a)
  const B = pct(b)
  const on = a === 0 ? `0%,${B}%{opacity:1}` : `0%,${(A - 0.05).toFixed(3)}%{opacity:0}${A}%,${B}%{opacity:1}`
  return `@keyframes ${name}{${on}${(B + 0.05).toFixed(3)}%,100%{opacity:0}}`
}
const NAP: [number, number] = [14.875, 23.375]
const at = (x: number, s: number) => `transform:translate(${x + 9}px,${MY}px) scale(${s},1) translate(-9px,0)`

const TIMELINE_CSS =
  `.tl{animation-duration:${T}s;animation-iteration-count:infinite;animation-delay:var(--d)}` +
  `.route{animation-name:route;animation-timing-function:linear}` +
  `@keyframes route{${ROUTE_S.map(([s, x, f]) => `${pct(s)}%{${at(x, f)}}`).join('')}}` +
  `.w-run{animation-name:wrun}${windowKf('wrun', 0, 5)}` +
  `.w-web{animation-name:wweb}${windowKf('wweb', 8.125, 12.125)}` +
  `.w-nap{animation-name:wnap}${windowKf('wnap', NAP[0], NAP[1])}` +
  `.w-awake{animation-name:wawake}@keyframes wawake{0%,${pct(NAP[0]) - 0.05}%{opacity:1}${pct(NAP[0])}%,${pct(NAP[1])}%{opacity:0}${pct(NAP[1]) + 0.05}%,100%{opacity:1}}` +
  `.w-write{animation-name:wwrite}${windowKf('wwrite', 32.375, 36.375)}` +
  `.w-read{animation-name:wread}${windowKf('wread', 39.125, 44.125)}` +
  // 打盹時坐在沙發上（往上 2 格），起床跳兩下
  `.w-life{animation-name:wlife}@keyframes wlife{0%,${pct(NAP[0]) - 0.1}%{transform:translateY(0)}${pct(NAP[0])}%,${pct(NAP[1])}%{transform:translateY(-2px)}` +
  `${pct(NAP[1] + 0.5)}%{transform:translateY(0)}${pct(NAP[1] + 0.9)}%{transform:translateY(-2px)}${pct(NAP[1] + 1.3)}%{transform:translateY(0)}${pct(NAP[1] + 1.7)}%{transform:translateY(-2px)}${pct(NAP[1] + 2)}%,100%{transform:translateY(0)}}`

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
  .type{animation:type .3s steps(1) infinite}
  @keyframes type{0%{transform:translateY(0)}50%{transform:translateY(-0.7px)}}
  .spark{animation:spark .6s steps(1) 5}
  @keyframes spark{0%{opacity:1}50%{opacity:0}}
  .hop{animation:hop .9s ease-out infinite}
  @keyframes hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-1.2px)}}
  .screen{animation:scr 2.4s steps(1) infinite}
  .screen.busy{animation-duration:.4s}
  @keyframes scr{0%,80%{opacity:1}81%,100%{opacity:.75}}
  .steam{animation:steam 2s ease-out infinite}
  @keyframes steam{0%{transform:translateY(1px);opacity:0}30%{opacity:.9}100%{transform:translateY(-1.5px);opacity:0}}
  .twinkle{animation:tw 1.8s steps(1) infinite}
  @keyframes tw{0%,60%{opacity:1}61%,100%{opacity:.2}}
  .zz{animation:zz 2.4s ease-out infinite}
  @keyframes zz{0%{transform:translate(0,1px);opacity:0}30%{opacity:1}100%{transform:translate(1px,-2px);opacity:0}}
  .pop{animation:pop .4s ease-out 1 both}
  @keyframes pop{0%{opacity:0;transform:translateY(-3px)}100%{opacity:1;transform:translateY(0)}}`

const Z = (x: number, y: number, c = '#7F93A8') =>
  px(x, y, 4, 1, c) + px(x + 2, y + 1, 1, 1, c) + px(x + 1, y + 2, 1, 1, c) + px(x, y + 3, 4, 1, c)

/** 平常照時間軸生活的一隻（主角或小幫手） */
function liveClawd(fit: number, sweaty: boolean, delay: number, extra = '', sm = false): string {
  const tools =
    `<g class="tl w-run">${prop('run')}</g>` +
    `<g class="tl w-web">${prop('web')}</g>` +
    `<g class="tl w-write">${prop('write')}</g>` +
    `<g class="tl w-read">${prop('read')}</g>`
  const zzz = `<g class="tl w-nap"><g class="zz">${Z(17, 0)}</g><g class="zz" style="animation-delay:1.2s">${Z(22, -3)}</g></g>`
  return (
    `<g style="--d:-${delay.toFixed(2)}s"><g class="tl route">` +
    shrink(`<g class="tl w-life">${clawd('timeline', fit, sweaty)}${tools}${extra}</g>${zzz}`, sm) +
    `</g></g>`
  )
}

/** 工作中：從 from 走到工作站，抵達後拿道具做事 */
function workingClawd(tr: Travel, a: Activity, fit: number, sweaty: boolean, elapsed: number, id: string, sm = false): string {
  const dist = Math.abs(tr.to - tr.from)
  const dur = Math.max(dist / SPEED, 0.01)
  const dir = tr.to >= tr.from ? 1 : -1
  const css =
    `.mv-${id}{animation:mv-${id} ${dur.toFixed(2)}s linear 1 both;animation-delay:-${Math.min(elapsed, dur).toFixed(2)}s}` +
    `@keyframes mv-${id}{0%{${at(tr.from, dir)}}99.9%{${at(tr.to, dir)}}100%{${at(tr.to, tr.face)}}}` +
    `.ar-${id}{animation:ar-${id} ${dur.toFixed(2)}s steps(1) 1 both;animation-delay:-${Math.min(elapsed, dur).toFixed(2)}s}` +
    `@keyframes ar-${id}{0%{opacity:0}100%{opacity:1}}`
  return `<style>${css}</style><g class="mv-${id}">${shrink(`<g class="hop">${clawd('open', fit, sweaty)}<g class="ar-${id}">${prop(a)}</g></g>`, sm)}</g>`
}

/** 小幫手（subagent）：只縮小身體 0.7 倍（以自己為中心、腳底仍踩地），位置不縮 */
function shrink(inner: string, sm: boolean): string {
  return sm ? `<g transform="translate(2.7,3.9) scale(.7)">${inner}</g>` : inner
}

type Scene = {
  mood: Mood
  activity: Activity
  fit: number
  sweaty: boolean
  now: number
  date: Date
  travel: Travel
  helpers: Helper[]
}

const MAX_HELPERS = 4

function stageSvg(s: Scene): string {
  const phase = (s.now / 1000) % T
  const busy = s.mood === 'working' || s.helpers.length > 0
  let actors = ''

  // 小幫手（畫在主角後面）。同一工作站有人就往後排隊，不會擠進家具裡
  const queue = new Map<number, number>()
  if (s.mood === 'working') queue.set(spotOf(s.activity).x, 1)
  s.helpers.slice(0, MAX_HELPERS).forEach((h, i) => {
    const fit = (s.fit + 3 + i * 2) % OUTFIT_COUNT
    const pop = s.now - h.since < 600 ? ' class="pop"' : ''
    if (h.activity === null) {
      // 還沒用工具：照自己的節奏閒晃
      actors += `<g${pop}>${liveClawd(fit, false, (phase + (i + 1) * 11) % T, "", true)}</g>`
    } else {
      const sp = spotOf(h.activity)
      const k = queue.get(sp.x) ?? 0
      queue.set(sp.x, k + 1)
      const x = sp.x - sp.face * 13 * k
      const tr: Travel = { from: x, to: x, face: sp.face, at: 0 }
      actors += `<g${pop}>${workingClawd(tr, h.activity, fit, false, 1, `h${i}`, true)}</g>`
    }
  })

  // 主角
  if (s.mood === 'working') {
    actors += workingClawd(s.travel, s.activity, s.fit, s.sweaty, (s.now - s.travel.at) / 1000, 'me')
  } else {
    const spark =
      s.mood === 'done'
        ? `<g class="spark">${px(-1, 1, 1, 1, C.gold)}${px(18, 0, 1, 1, C.gold)}${px(0, 0, 1, 1, C.goldLt)}${px(19, 3, 1, 1, C.goldLt)}</g>`
        : ''
    actors += liveClawd(s.fit, s.sweaty, phase, spark)
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * U}" height="${H * U}" shape-rendering="crispEdges">` +
    `<style>${BASE_CSS}${TIMELINE_CSS}</style>` +
    scenery(s.date, busy) + actors +
    `</svg>`
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

const HELPER_MAX_AGE = 60 * 60 * 1000 // 超過 1 小時沒收到結束通知的小幫手自動清掉

/** 主角改去 a 的工作站：起點 = 目前所在位置 */
async function goTo($: EngineInterface, a: Activity) {
  const now = await $.clock.now()
  const m = await read($, mood)
  const tr = await read($, travel)
  let cur: number
  if (m === 'working') {
    const dur = Math.abs(tr.to - tr.from) / SPEED
    const t = Math.min((now - tr.at) / 1000 / Math.max(dur, 1e-6), 1)
    cur = tr.from + (tr.to - tr.from) * t
  } else {
    cur = routeX((now / 1000) % T)
  }
  const sp = spotOf(a)
  await update($, travel, () => ({ from: Math.round(cur), to: sp.x, face: sp.face, at: now }))
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

  // 以下會擋在使用者送出訊息／呼叫工具／啟動 subagent 之前：小吉祥物出錯也一律放行
  on('prompt.submit', async ($, e, next) => {
    await (async () => {
      await goTo($, null)
      await update($, mood, () => 'working' as Mood)
      await update($, activity, () => null as Activity)
    })().catch(() => undefined)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await (async () => {
      const a = activityOf(e.tool)
      if (e.agentId) {
        // subagent 的工具：只動那隻小幫手
        const id = e.agentId
        const list = await read($, helpers)
        if (list.some(h => h.id === id && h.activity !== a)) {
          await update($, helpers, l => l.map(h => (h.id === id ? { ...h, activity: a } : h)))
        }
        return
      }
      if ((await read($, activity)) !== a) {
        await goTo($, a)
        await update($, activity, () => a)
      }
    })().catch(() => undefined)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    await (async () => {
      if (r.deny === undefined && r.agentId) {
        const id = r.agentId
        const now = await $.clock.now()
        await update($, helpers, l => [...l.filter(h => h.id !== id && now - h.since < HELPER_MAX_AGE), { id, activity: null, since: now }])
      }
    })().catch(() => undefined)
    return r
  })

  on('agent.report', async ($, e, next) => {
    await update($, helpers, l => l.filter(h => h.id !== e.agentId)).catch(() => undefined)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, mood, () => 'done' as Mood)
    await update($, activity, () => null as Activity)
    await update($, outfit, n => (n + 1) % OUTFIT_COUNT)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const now = await $.clock.now()
    const m = await read($, mood)
    const a = await read($, activity)
    const u = await read($, meter)
    const fit = (await read($, outfit)) % OUTFIT_COUNT
    const tr = await read($, travel)
    const hs = (await read($, helpers)).filter(h => now - h.since < HELPER_MAX_AGE)
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

    if (!('Svg' in ui)) return gauges
    const { Svg } = ui

    const svg = stageSvg({ mood: m, activity: a, fit, sweaty, now, date: new Date(now), travel: tr, helpers: hs })
    const alt =
      (m === 'working' ? '小吉祥物正在忙' : '小吉祥物在工作室裡生活') + (hs.length ? `，還有 ${hs.length} 隻小幫手` : '')
    return (
      <Box flexDirection="column" gap={1} width="100%">
        <Svg source={svg} alt={alt} />
        {hs.length > MAX_HELPERS ? <Text dimColor>另外還有 {hs.length - MAX_HELPERS} 隻小幫手在忙</Text> : null}
        {gauges}
      </Box>
    )
  })
}
