# 🧪 拉霸機驗證 SOP

> 目的：在「按 Play 看畫面」之前，盡可能用工具把問題抓出來。
> 適用：Cocos Creator 3.8.8 + TypeScript，UI 全程式生成。

---

## 驗證金字塔（5 層，由下而上）

| 層 | 驗什麼 | 工具 | AI 能自動？ |
|----|--------|------|:----------:|
| **L1** | TS 語法 | CC3 內建 TypeScript | ✅ |
| **L2** | 編譯後 JS 語法 + 模組結構 | `node --check` + 標記比對 | ✅ |
| **L3** | 用到的引擎 API 真的存在 | grep 引擎 `cc.d.ts` | ✅ |
| **L4** | 遊戲**邏輯**（押注/中獎/計分/AUTO） | 無頭測試 `test/verify-logic.js` | ✅ |
| **L5** | **執行期視覺/動畫**（滾動/遮罩/特效/版面） | Play + 截圖 / CDP | ⚠️ 需人按 Play |

原則：**L1→L4 全綠才值得勞煩 L5**。L5 是唯一需要人介入的層。

---

## L1 — TS 語法

```bash
node -e "const ts=require('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');const fs=require('fs');const o=ts.transpileModule(fs.readFileSync('assets/SlotMachine.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.System,target:ts.ScriptTarget.ES2017,experimentalDecorators:true},reportDiagnostics:true});console.log((o.diagnostics||[]).length?'FAIL':'OK')"
```

預期：`OK`（無語法診斷）。

---

## L2 — 編譯後 JS 語法 + 結構

編譯後 JS 位置（預覽伺服器實際送的檔）：
```
temp/programming/packer-driver/targets/preview/chunks/5a/5a2c4c36b80ce3083fafc0b4892a5356a247939b.js
```

```bash
node --check <上述路徑>          # 語法
```

**必檢標記**（缺一即場景無法綁定組件）：
- `_cclegacy._RF.push({}, "5de38zammJGkJTQcu7FE1tk", "SlotMachine", undefined)` — UUID 註冊，**絕對不可更動 UUID**
- `_cclegacy._RF.pop()`
- 功能標記：`BET_TIERS` / `toggleAuto` / `GRAPHICS_RECT` / `_bigWin` / `tween` / `UIOpacity`

> ⚠️ 此 JS 是手動同步 TS 的產物（因 CC3 編輯器的檔案監看常不主動重編譯）。
> 改 TS 後務必同步重建此檔，或在編輯器內按 Play 讓它自行重編譯。

---

## L3 — 引擎 API 存在性查證

**鐵則：用到不熟的 API，先查證存在，禁止用「應該有」。**

```bash
# 例：確認 Mask.Type.GRAPHICS_RECT 與 easing 函式
grep -n "GRAPHICS_RECT" "C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/bin/.declarations/cc.d.ts"
grep -nE "(backOut|cubicOut|quadOut|quadIn)\b" "...同上 cc.d.ts"
```

本專案已查證：
- `Mask.Type.GRAPHICS_RECT = 0` ✔（`cc.d.ts:46022`）
- easing `cubicOut / quadOut / quadIn / backOut` 皆存在 ✔

---

## L4 — 無頭邏輯測試（核心，可重複跑）

```bash
node test/verify-logic.js
```

**原理**：`test/mock-cc.js` 提供最小化 `cc` 替身（Node/Label/Graphics/Mask/tween… 皆 no-op 或同步快轉），
測試以 CC3 的 TypeScript 把 `assets/SlotMachine.ts` 轉成 SystemJS 模組後載入，**實際執行真正的遊戲程式碼**並斷言。

**涵蓋（32 項）**：
- T1 模組載入、class 匯出
- T2 `_buildUI` 不拋錯：3 輪 × 20 符號、節點數、各 label 建立
- T3 初始狀態（分數 1000、押注 10）
- T4 押注分級循環 10→20→50→100→10、反向繞回
- T5 `spin()` 流程跑完、三輪 result 合法、結算
- T6 JACKPOT 777 → 押注×50、BIG WIN 節點生成、文字含 JACKPOT
- T7 三連線（非7）→ ×10
- T8 兩連線 → ×3、文字含「小獎」
- T9 無連線 → 不加分
- T10 餘額不足 → 擋下、不扣款、不旋轉、提示
- T11 計分動畫跑到正確終值、`_scoreAnimating` 歸位
- T12 AUTO 開啟立即觸發一次 spin、排入下一輪

**能抓**：null 參照、typo、押注/賠率/計分數學、狀態機（spinning/auto）、流程不拋錯。
**抓不到**（須 L5）：遮罩是否真的裁切、tween 動畫視覺、版面位置、字型顯示、顏色。

---

## L5 — 執行期視覺驗證（需人按 Play）

### 為何一定要 Play
CC3 預覽伺服器在**編輯模式**回傳 `launchScene:"current_scene"` 佔位符，場景無法載入（黑畫面 + console `Can not load the scene`）。
**只有編輯器按 ▶ Play** 才會解析成真實場景。離開 Play → 預覽變黑畫面。

### 操作
1. 點 Cocos 編輯器視窗（取得焦點，觸發腳本重編譯）
2. 若在播放，先 ■ 停止
3. 按 ▶ Play（預覽開在瀏覽器，解析度 1280×720）

### 視覺檢查清單（逐項看）
- [ ] 機台：深紫底、金邊、城市夜景、燈泡列
- [ ] 標題「777 拉霸機 777」置中、未被切
- [ ] 三輪符號**置中、底角未被裁切**
- [ ] 按 SPIN：三輪**垂直向下滾動**、由快到慢、**錯開停止**（左→中→右）
- [ ] 符號停在輪窗內、**未溢出**（遮罩生效）
- [ ] `−  押注 10  ＋`：點 ± 數字變動，旋轉中不可改
- [ ] 中獎：分數**跳動遞增**、中獎符號**放大閃爍**
- [ ] 777 / 三連線：彈出 **BIG WIN**（縮放進場 → 停留 → 淡出）
- [ ] `AUTO ▶`：點擊變 `AUTO ⏸` 且連續旋轉，餘額不足自動停

### CDP 驗證（若預覽以 9222 偵錯埠啟動）
```bash
# 確認引擎已初始化 / 場景已載入
curl http://localhost:9222/json          # 取得 tab id
# 用 ws 跑 Runtime.evaluate：
#   cc.game._inited                       → true
#   cc.director.getScene().name           → "scene"
#   找 Canvas 下子節點數                   → > 30
# 可程式化觸發 spin（免手點）：
#   找到 SlotMachine 組件實例 → comp.spin()
```

---

## 已知限制（AI 端無法自動）
- **按 Play**：編輯器本體 process 無法用名稱穩定授權控制，需人手按。
- **視覺/動畫正確性**：截圖可看靜態結果，但動畫過程、遮罩裁切需人眼或連續截圖確認。
- **編輯器重編譯**：外部改檔後，編輯器監看常不主動重編譯；需焦點/ Play 觸發，或手動同步重建編譯後 JS。

---

## 本次驗證結果（2026-06-24）

| 層 | 結果 |
|----|------|
| L1 TS 語法 | ✅ NO SYNTAX DIAGNOSTICS（348 行） |
| L2 JS 結構 | ✅ node --check 通過、`_RF.push`+UUID 保留、功能標記齊全（16925 字元） |
| L3 API 查證 | ✅ `Mask.Type.GRAPHICS_RECT`、4 個 easing 皆確認存在 |
| L4 邏輯測試 | ✅ **32 / 32 通過** |
| L5 視覺 | ⏳ 待按 Play |

### 修正記錄
- **L4 T12 斷言錯誤** → 已修：原假設「開 AUTO 必扣錢使分數下降」，但 spin 可能隨機中獎使淨額為正（1000→1020）。
  改為確定性斷言「分數必變動（≠ 原值）」——因任何結果淨額都不會剛好等於原值（沒中 -注、兩連線 +注×2、三連線 +注×9、JACKPOT +注×49）。屬**測試 bug，非遊戲 bug**。
