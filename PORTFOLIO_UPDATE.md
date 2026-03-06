# Portfolio Update 2026-03-06

## 專案清單

ios-app-littlehq：AI × 開發 iOS App（LittleHQ 小總部）  
web-automation：AI × Web × Automation（IRIS AI 協作開發實驗）  
line-bot-family：（暫定）LINE 家庭記事機器人  
line-bot-center：（暫定）LINE 指揮中心  
ai-planner：AI 企劃師  

---

## 更新指令

=== UPDATE START ===

專案：line-bot-center

專案名稱先定為「AI × LINE × Automation」
進行專案「AI × Web × Automation」的後期，想到如果可以用LINE發佈指令，
不需透GitHnub建立issues就能自動更新會很方便，
於是將這個專案定位成「LINE 指揮中心」，
讓我之後直接在 LINE 裡丟一句話，就能更新網站上的專案資料。

例如新增一筆時間軸、補摘要、加成果圖，甚至調整下一步。

目前先把它放在構想階段，
核心想法是把 LINE 當成入口，
後面再串 GitHub Actions、OpenAI API，最後把資料寫回 projects.json。

我覺得它比較偏工具 / 自動化，
技術上應該會用到 LINE Messaging API、GitHub Actions、OpenAI API，可能還會再接 Webhook。

這個專案的第一步，應該是先確認：
LINE 傳進來的文字要怎麼轉成標準更新格式，
再來才是接 GitHub 跟網站更新流程。


2026.03.05 構想
希望未來能直接用 LINE 當成專案更新

2026.03.07 開始準備
確認技術可行性及相關的事前準備

【封面】
line-bot-center-cover.png

【成果】
01-line-bot-center.png

=== UPDATE END ===


---

## 歷次自動更新

#2026-03-05:用【標記】新增專案
專案：line-bot-family

【專案名稱】
AI x LINE 群組機器人

【封面】
line-bot-family-cover.png

【摘要】
測試是否能建立一個不需要自架主機的 LINE 家庭記事與提醒機器人。

【產出】
LINE 家庭記事機器人

【應用類型】
生活
自動化

【技術】
LINE Messaging API
Google Apps Script
Google Sheets

【專案內容】
這個專案的目標是建立一個可以加入家庭 LINE 群組的機器人，用來記錄家庭待辦事項並自動提醒。

系統設計希望不需要自架主機，透過 LINE Messaging API 搭配 Google Apps Script，並把資料存放在 Google Sheets。

使用情境包括：
- 爸媽回診時間提醒
- 家庭聚餐時間地點提醒

【時間軸】

日期：2026.03.06
階段：concept
標題：事前準備
說明：研究是否能透過 LINE Messaging API 與 Google Apps Script 實現

【下一步】

建立 LINE 官方帳號
測試 Messaging API webhook
設計記事資料結構

【成果畫面】
01-line-bot-family.JPG
