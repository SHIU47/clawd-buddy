export type Mood = 'idle' | 'working' | 'done'

/** 正在用的工具類型：讀檔、寫檔、執行指令、上網；null = 思考中 */
export type Activity = 'read' | 'write' | 'run' | 'web' | null

export type Meter = {
  /** context 已用百分比，0–100；尚無讀數為 null */
  context: number | null
  /** 5 小時額度已用百分比；無讀數為 null */
  fiveHour: number | null
  /** 每週額度已用百分比；無讀數為 null */
  sevenDay: number | null
}

/** 主角從哪走到哪（工作中跑去對應工作站） */
export type Travel = {
  /** 起點 x（格） */
  from: number
  /** 終點 x（格） */
  to: number
  /** 抵達後面向：1 右、-1 左 */
  face: number
  /** 出發時間（$.clock.now 毫秒） */
  at: number
}

/** 一個正在跑的 subagent，畫成一隻小 clawd */
export type Helper = {
  id: string
  activity: Activity
  /** 出現時間（$.clock.now 毫秒） */
  since: number
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': {
      mood: Mood
      meter: Meter
      isHidden: boolean
      outfit: number
      activity: Activity
      travel: Travel
      helpers: Helper[]
    }
  }
}
