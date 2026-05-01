# 📋 專案狀態與交接文件（PROJECT STATUS / HANDOFF）

> 這份文件讓任何人（或新的開發 session）能完整接手本專案。最後更新：專案已完成主要開發，可展示。

---

## 1. 專案概觀
- **是什麼**：Cocos Creator 3.8.8 拉霸機（slot machine），前端工程師作品集。
- **特色**：UI 全程式生成（`Graphics` 繪製），零美術資源；多 payline + 加權賠率 + 完整動態效果。
- **狀態**：✅ 主要開發完成、已驗證、已部署上線、文檔齊全。

**連結**
- 原始碼：https://github.com/babykaty0412-debug/Cocos （公開）
- 線上試玩（真 Cocos 引擎）：https://babykaty0412-debug.github.io/Cocos/
- 分支：`master` = 原始碼；`gh-pages` = 已部署的真引擎 web build

---

## 2. 已完成功能
- 真實轉輪滾動（`Mask` 裁切 + 垂直 strip + `tween` cubicOut 減速，三輪錯開停止）
- **3×3 盤面 + 5 條 payline**（上/中/下 + 2 斜線）
- 加權轉輪（7 最稀有，權重 `2/3/5/6/6/4`）
- 彩色符號、分數滾動、中獎閃爍、連線高亮、BIG WIN、AUTO、破產補幣、跑馬燈燈泡
- 賠率表 + 操作提示行

## 3. 賠率 / RTP（核心數值）
- **RTP = 94.24%**（雙重驗證：解析法窮舉 + 蒙地卡羅 300 萬局一致）
- 每線注 = 總注 ÷ 5；5 線加總後總 RTP = 單線 RTP（期望值線性）
- 賠率表：777 ×60、★★★ ×25、BAR×3 ×15、◆◆◆ ×12、♣♣♣/♥♥♥ ×8、7 對 ×3、BAR 對 ×2、其他對 ×1
- **已知簡化**：每格獨立加權抽樣，**非真實捲軸帶（reel strip）**。RTP 平均值一樣、但波動度/手感不同（面試主動講出＝加分）
- ⚠️ **顯示待優化**：結果寫「共 ×N」，但實得 = N × (注/5)，玩家易誤會（建議改成直接顯示「+實得金額」）

## 4. 架構 / 關鍵檔案
- `assets/SlotMachine.ts` — 主組件（單檔，全程式生成 UI）
  - 純函式 `evaluateLine(a,b,c)` / `evaluateGrid(grid)`（無 cc 相依、可單測、已 `export`）
  - 可重用原語 `_box()`(fill) / `_brd()`(stroke) / `_lbl()`(label) / `_button()`
- `test/verify-logic.js` + `test/mock-cc.js` — **無頭邏輯測試（41 項 + RTP 精算）**：用 CC3 內建 tsc 把 TS 轉 SystemJS，套 mock 的 cc 載入真實程式碼跑斷言。`node test/verify-logic.js`
- `docs/VERIFICATION_SOP.md` — 5 層驗證金字塔
- `web-demo/index.html` — HTML 複製版（離線單檔、含 WebAudio 音效）

## 5. CC3 3.8.8 開發踩雷（已驗證，接手必讀）
1. **預覽只在 Play 模式運作**：Edit 模式 `settings.js` 回 `launchScene:"current_scene"` → 黑畫面。必須按 ▶ Play。
2. **`Graphics` 一定要先 `g.clear()`** 再 draw，否則整個 component 不渲染。
3. **每個 Graphics node 只做一次 fill 或 stroke**（拆成獨立 node）。
4. **動態建立的 node 必設 `node.layer = 1 << 25`**（UI_LAYER）。
5. **`Mask.Type.GRAPHICS_RECT`** 用於轉輪視窗裁切（已在真引擎驗證）。
6. **headless 桌面截 WebGL 會黑** → 用 CDP `Page.captureScreenshot` 才抓得到真實畫面。

## 6. Build / 部署流程（免按 Play，可自動）
1. 關閉 CC3 編輯器（單實例會把 `--build` 轉發給開著的編輯器 → 等於沒 build）
2. `CocosCreator.exe --project <專案> --build "platform=web-desktop;debug=true"`，輪詢 `build/web-desktop/index.html`
3. **每次 build 後要重套**：`application.js` 的 `this.showFPS=true→false`（關 profiler 面板）＋ 覆寫 `style.css` 成深色精緻外框（`.header{display:none}` + 深色 radial-gradient body）
4. 本地伺服 `python -m http.server` → headless Chrome（`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --remote-debugging-port=9222`）+ CDP 驗證
5. 部署：orphan `gh-pages` 分支 → `cp build/web-desktop/* .` + `touch .nojekyll` → force-push。GitHub Pages Source = gh-pages/(root)

## 7. 可能的下一步（Roadmap）
- [ ] 結果顯示改成「+實得金額」（最不易誤會，優先）
- [ ] 改成真實**捲軸帶（reel strip）**模型（更擬真、有「差一點中」效果）
- [ ] Cocos 版音效（需編輯器匯入 .wav/.mp3 資產）
- [ ] 用 prefab / Widget 重構（展示編輯器工作流 + 響應式排版）
- [ ] 多語系、更多 payline、免費遊戲/倍數關卡等

---

## 8. 新 session 如何接手
1. `git clone https://github.com/babykaty0412-debug/Cocos.git`
2. 讀本檔 + `README.md` + `docs/VERIFICATION_SOP.md`
3. 裝 Cocos Creator 3.8.8 → 開專案 → ▶ Play；`node test/verify-logic.js` 應 41/41
4. 要改遊戲 → 改 `assets/SlotMachine.ts`；要重新上線 → 照第 6 節部署流程
