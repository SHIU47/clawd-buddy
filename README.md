# clawd-buddy

Claude Code 的小 mod：在輸入框上方放一個小機房舞台，橘色像素小吉祥物在裡面生活，下方顯示 context、5 小時額度、本週額度三條進度條。全部在本機繪製，不呼叫模型、不消耗 token。

## 功能

- 舞台：左邊機櫃（燈號閃爍）、中間盆栽、右邊冷卻水塔（冒白煙）
- 平常：48 秒一輪，走去看冷卻水塔 → 修機櫃 → 回中間打盹 → 起床跳一跳
- Claude 工作中：站到中間，依工具拿道具（讀檔→書、改檔→鉛筆、指令→扳手、上網→地球、思考→…）
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
