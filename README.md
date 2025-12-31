# 🎰 拉霸機 — Slot Machine

> Cocos Creator 3.8.8 作品集專案

## 功能
- 三輪拉霸機，符號：7 / ★ / ◆ / ♣ / ♥ / BAR
- 押注 / 餘額系統
- 三連 JACKPOT（777 × 10 倍）、三連其他符號（× 5 倍）、二連小贏（× 2 倍）
- 24 格動畫 tick，停止後自動判斷勝負

## 技術
- **引擎**：Cocos Creator 3.8.8 TypeScript
- **UI**：全程式生成（無外部美術資源），Graphics 組件繪製圓角矩形 + 邊框
- **架構**：單一 `SlotMachine.ts` 組件，`_box()` / `_brd()` / `_lbl()` 原始方法

## 畫面設計
| 元素 | 說明 |
|------|------|
| 深紫色機台 | 多層圓角矩形堆疊，金色邊框 |
| 城市夜景背景 | Graphics 程式繪製大樓剪影 + 燈光 |
| 裝飾燈泡列 | 26 顆交替亮暗 |
| 白色轉輪格 | 3 欄 × 金色符號，70pt 字體 |
| SPIN 按鈕 | 漸層金色，Button 組件 scale 效果 |

## 執行方式
1. 用 Cocos Creator 3.8.8 開啟此資料夾
2. 開啟 `assets/scene.scene`
3. 按 ▶ Play 預覽
