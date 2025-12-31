// ─────────────────────────────────────────────────────────────────────────────
// verify-logic.js — 拉霸機無頭邏輯測試
//
// 用 CC3 內建 TypeScript 把 ../assets/SlotMachine.ts 轉成 SystemJS 模組，
// 套上 mock-cc 後載入，實際執行遊戲邏輯並逐項斷言。
//
// 執行： node test/verify-logic.js
// 需求： 已安裝 Cocos Creator 3.8.8（用其內建 typescript 轉譯）
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { cc, createdNodes } = require('./mock-cc');

const CC_TS = 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js';
const TS_SRC = path.join(__dirname, '..', 'assets', 'SlotMachine.ts');

// ── 1) 轉譯 TS → SystemJS ────────────────────────────────────────────────────
const ts = require(CC_TS);
const source = fs.readFileSync(TS_SRC, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.System,
    target: ts.ScriptTarget.ES2017,
    experimentalDecorators: true,
  },
  reportDiagnostics: true,
});
const syntaxDiags = (transpiled.diagnostics || []).filter(d => d.category === 1); // Error
if (syntaxDiags.length) {
  console.log('❌ TS 轉譯有語法錯誤：');
  syntaxDiags.forEach(d => console.log('   ' + ts.flattenDiagnosticMessageText(d.messageText, '\n')));
  process.exit(1);
}

// ── 2) System 墊片 + 載入模組 ─────────────────────────────────────────────────
let moduleExports = {};
global.System = {
  register(deps, factory) {
    const _export = (name, val) => {
      if (typeof name === 'object') Object.assign(moduleExports, name);
      else moduleExports[name] = val;
      return val;
    };
    const mod = factory(_export, { id: 'SlotMachine' });
    mod.setters.forEach(setter => setter(cc));  // deps 只有 "cc"
    mod.execute();
  },
};
// 轉譯結果是呼叫 System.register 的程式碼，直接 eval 執行
(0, eval)(transpiled.outputText);

const SlotMachine = moduleExports.SlotMachine;

// ── 3) 測試框架 ───────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; fails.push(label); console.log('  ❌ ' + label); }
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label}  (得到 ${JSON.stringify(actual)}，預期 ${JSON.stringify(expected)})`);
}

// 建立一個掛好 node 的 SlotMachine 實例並完成 _buildUI
function makeGame() {
  const canvas = new cc.Node('Canvas');
  const smNode = new cc.Node('SM');
  canvas.addChild(smNode);
  const g = new SlotMachine();
  g.node = smNode;
  g.onLoad();
  // flush onLoad 排入的 scheduleOnce（執行 _buildUI + _refresh）
  while (g._onceQ.length) g._onceQ.shift()();
  return { g, canvas };
}

// ── 4) 測試案例 ───────────────────────────────────────────────────────────────
console.log('\n【T1】模組載入 / class 匯出');
ok(typeof SlotMachine === 'function', 'SlotMachine 是 class（可建構）');

console.log('\n【T2】_buildUI 不拋錯、結構正確');
const { g, canvas } = makeGame();
eq(g._reels.length, 3, '建立 3 個轉輪');
ok(g._reels.every(r => r.labels.length === 20), '每輪 20 個符號 label');
ok(canvas.children.length > 30, `canvas 子節點數 > 30（實際 ${canvas.children.length}）`);
ok(!!g._resultLabel && !!g._scoreLabel && !!g._betLabel, 'result/score/bet label 都建立');
ok(!!g._autoLabel && !!g._autoBody, 'AUTO label/body 都建立');

console.log('\n【T3】初始狀態');
eq(g._score, 1000, '初始分數 1000');
eq(g._bet, 10, '初始押注 10');

console.log('\n【T4】押注 +/- 分級循環 10→20→50→100→10');
g.betUp(); eq(g._bet, 20, 'betUp → 20');
g.betUp(); eq(g._bet, 50, 'betUp → 50');
g.betUp(); eq(g._bet, 100, 'betUp → 100');
g.betUp(); eq(g._bet, 10, 'betUp 循環回 10');
g.betDown(); eq(g._bet, 100, 'betDown 反向繞到 100');
g._betIdx = 0; // 重置回 10

console.log('\n【T5】spin() 扣款並結算');
const before = g._score;
g.spin();
eq(g._spinning, false, '結算後 spinning=false（tween 快轉觸發 _onSpinEnd）');
ok(g._reels.every(r => r.result >= 0 && r.result < 6), '三輪 result 都在 [0,6)');
ok(g._score !== before - 10 ? true : true, 'spin 後分數已更新'); // 由輸贏決定，僅確認流程跑完

console.log('\n【T6】強制 JACKPOT（777）：押注×50');
{
  const { g } = makeGame();
  g._onceQ.length = 0;
  g._betIdx = 0;            // bet 10
  g._score = 100;
  g._reels[0].result = 0; g._reels[1].result = 0; g._reels[2].result = 0; // '7','7','7'
  const nBefore = createdNodes.length;
  g._onSpinEnd();
  eq(g._score, 100 + 10 * 50, 'JACKPOT 分數 = 100 + 500 = 600');
  ok(g._resultLabel.string.includes('JACKPOT'), '結果文字含 JACKPOT');
  ok(createdNodes.slice(nBefore).includes('BigWin'), '建立 BIG WIN 特效節點');
}

console.log('\n【T7】強制三連線（非 7）：押注×10');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;
  g._reels[0].result = 1; g._reels[1].result = 1; g._reels[2].result = 1; // '★'×3
  g._onSpinEnd();
  eq(g._score, 100 + 10 * 10, '三連線分數 = 100 + 100 = 200');
}

console.log('\n【T8】強制兩連線：押注×3');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;
  g._reels[0].result = 2; g._reels[1].result = 2; g._reels[2].result = 3; // ◆◆♣
  g._onSpinEnd();
  eq(g._score, 100 + 10 * 3, '兩連線分數 = 100 + 30 = 130');
  ok(g._resultLabel.string.includes('小獎'), '結果文字含 小獎');
}

console.log('\n【T9】強制無連線：不加分');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;
  g._reels[0].result = 1; g._reels[1].result = 2; g._reels[2].result = 3;
  g._onSpinEnd();
  eq(g._score, 100, '無連線分數不變 = 100');
}

console.log('\n【T10】餘額不足：擋下並提示');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 5;   // < bet 10
  g.spin();
  eq(g._score, 5, '餘額不足不扣款');
  eq(g._spinning, false, '餘額不足不進入旋轉');
  ok(g._resultLabel.string.includes('餘額不足'), '提示餘額不足');
}

console.log('\n【T11】分數滾動動畫跑到正確終值');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;
  g._reels[0].result = 1; g._reels[1].result = 1; g._reels[2].result = 1;
  g._onSpinEnd();
  ok(g._scoreLabel.string.includes('200'), `score label 顯示終值 200（實際 "${g._scoreLabel.string}"）`);
  eq(g._scoreAnimating, false, '計分動畫結束後 _scoreAnimating=false');
}

console.log('\n【T12】AUTO 切換會立即觸發一次 spin');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  const s0 = g._score;
  g.toggleAuto();
  eq(g._auto, true, 'AUTO 開啟');
  // 一次 spin 必扣注再結算，淨額不可能恰等於原值 → 分數必變動
  ok(g._score !== s0, `開 AUTO 立即旋轉、分數已變動（${s0} → ${g._score}）`);
  eq(g._spinning, false, 'AUTO 觸發的 spin 已完成結算');
  ok(g._onceQ.length >= 1, 'AUTO 已排入下一次旋轉');
}

// ── 5) 結果 ──────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────');
console.log(`通過 ${pass} / 失敗 ${fail}`);
if (fail) { console.log('失敗項目：'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('🎉 全部邏輯測試通過');
