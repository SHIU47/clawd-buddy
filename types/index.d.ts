export type Mood = 'idle' | 'working' | 'done'

/** 我正在用的工具類型：讀檔、寫檔、執行指令、上網；null = 思考中 */
export type Activity = 'read' | 'write' | 'run' | 'web' | null

export type Meter = {
  /** context 已用百分比，0–100；尚無讀數為 null */
  context: number | null
  /** 5 小時額度已用百分比；無讀數為 null */
  fiveHour: number | null
  /** 每週額度已用百分比；無讀數為 null */
  sevenDay: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': {
      mood: Mood
      meter: Meter
      isHidden: boolean
      outfit: number
      activity: Activity
    }
  }
}
