# clawd-buddy

Claude Code 的小 mod：在輸入框上方放一個像素「小工作室」，橘色小吉祥物在裡面生活；Claude 工作時會跑到對應的工作站，每個 subagent 會變出一隻小幫手。下方顯示 context、5 小時額度、本週額度三條進度條。全部在本機繪製，不呼叫模型、不消耗 token。

## 功能

- 工作室：書櫃、白板、電腦桌、窗戶＋望遠鏡（天色跟著電腦時間：白天／黃昏／夜晚）、懶骨頭沙發、掛鐘（真實時間）
- 平常：48 秒一輪，打電腦 → 窗邊看看 → 沙發打盹 → 白板寫字 → 書櫃翻書
- Claude 工作中：從目前位置走到對應工作站（讀檔→書櫃、改檔→白板、指令／思考→電腦桌、上網→窗邊）
- 每個 subagent：多一隻小 clawd，依它自己用的工具跑到工作站，同一站會排隊；結束就消失（最多畫 4 隻）
- 回覆完成：閃星星，並自動換下一套裝扮（共 8 套）
- context ≥ 80%：頭上冒汗；進度條 60% 以上變橘、80% 以上變紅
- `/clawd`：隱藏／顯示

## 安裝

在 Claude Code 的輸入框輸入：

```
/plugin install clawd-buddy --marketplace SHIU47/clawd-buddy
```

出現 `Add marketplace?` 時輸入 `y`，範圍選 user（每個專案都會載入）。

從終端機安裝：

```
claude plugin install clawd-buddy --marketplace SHIU47/clawd-buddy
```

私人 repo 需要這台電腦已經能用 git 存取 GitHub（例如曾經 `git push` 過）。

## 更新與移除

- 更新：`/plugin` → 選 clawd-buddy 的 marketplace → Update
- 移除：`/plugin uninstall clawd-buddy`

## 授權

MIT
