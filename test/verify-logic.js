// ─────────────────────────────────────────────────────────────────────────────
// verify-logic.js — 拉霸機無頭邏輯測試（多 payline 版）
//
// 用 CC3 內建 TypeScript 把 ../assets/SlotMachine.ts 轉成 SystemJS 模組，
// 套上 mock-cc 後載入，實際執行遊戲邏輯並逐項斷言。
//   node test/verify-logic.js
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { cc, createdNodes } = require('./mock-cc');

const CC_TS = 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js';
const TS_SRC = path.join(__dirname, '..', 'assets', 'SlotMachine.ts');

const ts = require(CC_TS);
const transpiled = ts.transpileModule(fs.readFileSync(TS_SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.System, target: ts.ScriptTarget.ES2017, experimentalDecorators: true },
  reportDiagnostics: true,
});
const syntaxDiags = (transpiled.diagnostics || []).filter(d => d.category === 1);
if (syntaxDiags.length) {
  console.log('❌ TS 轉譯語法錯誤：');
  syntaxDiags.forEach(d => console.log('   ' + ts.flattenDiagnosticMessageText(d.messageText, '\n')));
  process.exit(1);
}

let moduleExports = {};
global.System = {
  register(deps, factory) {
    const _export = (name, val) => {
      if (typeof name === 'object') Object.assign(moduleExports, name);
      else moduleExports[name] = val;
      return val;
    };
    const mod = factory(_export, { id: 'SlotMachine' });
    mod.setters.forEach(setter => setter(cc));
    mod.execute();
  },
};
(0, eval)(transpiled.outputText);

const SlotMachine  = moduleExports.SlotMachine;
const evaluateLine = moduleExports.evaluateLine;
const evaluateGrid = moduleExports.evaluateGrid;
const WEIGHTS      = moduleExports.WEIGHTS;
const TRIPLE       = moduleExports.TRIPLE;
const PAIR         = moduleExports.PAIR;

let pass = 0, fail = 0; const fails = [];
function ok(cond, label) { if (cond) { pass++; console.log('  ✅ ' + label); } else { fail++; fails.push(label); console.log('  ❌ ' + label); } }
function eq(a, e, label) { ok(a === e, `${label}  (得到 ${JSON.stringify(a)}，預期 ${JSON.stringify(e)})`); }

function makeGame() {
  const canvas = new cc.Node('Canvas');
  const smNode = new cc.Node('SM');
  canvas.addChild(smNode);
  const g = new SlotMachine();
  g.node = smNode;
  g.onLoad();
  while (g._onceQ.length) g._onceQ.shift()();
  return { g, canvas };
}

// ── 測試 ──────────────────────────────────────────────────────────────────────
console.log('\n【T1】模組 / 匯出');
ok(typeof SlotMachine === 'function', 'SlotMachine class');
ok(typeof evaluateLine === 'function' && typeof evaluateGrid === 'function', 'evaluateLine / evaluateGrid 已匯出');

console.log('\n【T2】_buildUI 結構（3 排 × 24 slot）');
const { g, canvas } = makeGame();
eq(g._reels.length, 3, '3 個轉輪');
ok(g._reels.every(r => r.labels.length === 24), '每輪 24 個 slot label');
ok(g._reels.every(r => Array.isArray(r.rows) && r.rows.length === 3), '每輪 rows 為長度 3');
ok(canvas.children.length > 40, `canvas 子節點 > 40（實際 ${canvas.children.length}）`);

console.log('\n【T3】初始狀態');
eq(g._score, 1000, '初始分數 1000');
eq(g._bet, 10, '初始押注 10');

console.log('\n【T4】押注分級循環');
g.betUp(); eq(g._bet, 20, '→20'); g.betUp(); eq(g._bet, 50, '→50');
g.betUp(); eq(g._bet, 100, '→100'); g.betUp(); eq(g._bet, 10, '循環回 10');
g.betDown(); eq(g._bet, 100, '反向→100'); g._betIdx = 0;

console.log('\n【T5】spin() 流程');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g.spin();
  eq(g._spinning, false, '結算後 spinning=false');
  ok(g._reels.every(r => r.rows.every(v => v >= 0 && v < 6)), '所有 rows 值合法 [0,6)');
}

console.log('\n【T6】evaluateLine 純函式');
eq(evaluateLine(0,0,0).mult, TRIPLE[0], '777 → TRIPLE[0]=60');
eq(evaluateLine(0,0,0).jackpot, true, '777 → jackpot');
eq(evaluateLine(1,1,1).mult, TRIPLE[1], '★★★ → 25');
eq(evaluateLine(0,0,2).mult, PAIR[0], '7,7,◆ → PAIR[0]=3');
eq(evaluateLine(3,3,4).mult, PAIR[3], '♣,♣,♥ → PAIR[3]=1');
eq(evaluateLine(1,2,3).mult, 0, '全不同 → 0');

console.log('\n【T7】evaluateGrid：全 7 → 5 條 JACKPOT 線');
{
  const grid = [[0,0,0],[0,0,0],[0,0,0]];
  const e = evaluateGrid(grid);
  eq(e.totalMult, 5 * 60, '5 線 × ×60 = 300');
  eq(e.wins.length, 5, '5 條中獎線');
  eq(e.jackpot, true, 'jackpot=true');
}

console.log('\n【T8】evaluateGrid：單一斜線 ◆◆◆');
{
  // 拉丁方陣 → 只有 ↗ 斜線（reel0列2,reel1列1,reel2列0）= [2,2,2]
  const grid = [[0,1,2],[1,2,0],[2,0,1]];
  const e = evaluateGrid(grid);
  eq(e.wins.length, 1, '恰 1 條線中獎');
  eq(e.totalMult, TRIPLE[2], '◆◆◆ = ×12');
}

console.log('\n【T9】evaluateGrid：精心設計的無中獎盤');
{
  const grid = [[1,2,3],[4,0,4],[2,4,5]];   // 5 條線皆三者相異
  const e = evaluateGrid(grid);
  eq(e.totalMult, 0, 'totalMult=0');
  eq(e.wins.length, 0, '無中獎線');
}

console.log('\n【T10】_onSpinEnd 計分（win = totalMult × 注/5）');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;                 // bet 10 → 每線 2
  g._reels[0].rows = [0,1,2]; g._reels[1].rows = [1,2,0]; g._reels[2].rows = [2,0,1]; // 單斜線 ◆×12
  g._onSpinEnd();
  eq(g._score, 100 + 12 * (10/5), '分數 = 100 + 12×2 = 124');
}

console.log('\n【T11】_onSpinEnd JACKPOT 盤 + BIG WIN 節點');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 100;
  g._reels[0].rows = [0,0,0]; g._reels[1].rows = [0,0,0]; g._reels[2].rows = [0,0,0];
  const nBefore = createdNodes.length;
  g._onSpinEnd();
  eq(g._score, 100 + 300 * 2, '分數 = 100 + 300×2 = 700');
  ok(g._resultLabel.string.includes('JACKPOT'), '訊息含 JACKPOT');
  ok(createdNodes.slice(nBefore).includes('BigWin'), 'BIG WIN 節點生成');
}

console.log('\n【T12】餘額分支（補幣 / 不足）');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g._betIdx = 0; g._score = 5; g.spin();
  eq(g._score, 1000, '破產自動補滿 1000');
  ok(g._resultLabel.string.includes('補滿'), '提示已補滿');
  const { g: g2 } = makeGame(); g2._onceQ.length = 0;
  g2._betIdx = 3; g2._score = 50; g2.spin();   // 注 100
  eq(g2._score, 50, '不足當前押注 → 不扣款');
  ok(g2._resultLabel.string.includes('餘額不足'), '提示餘額不足');
}

console.log('\n【T13】AUTO 觸發');
{
  const { g } = makeGame(); g._onceQ.length = 0;
  g.toggleAuto();
  eq(g._auto, true, 'AUTO 開');
  eq(g._spinning, false, 'spin 已完成');
  ok(g._onceQ.length >= 1, '已排下一輪（證明 spin 完整跑完）');
}

console.log('\n【T14】RTP 精算（每線窮舉加權 6³）');
{
  const W = WEIGHTS, WSUM = W.reduce((a,b)=>a+b,0);
  const p = W.map(w => w / WSUM);
  let lineRtp = 0, hit = 0;
  for (let a=0;a<6;a++) for (let b=0;b<6;b++) for (let c=0;c<6;c++) {
    const prob = p[a]*p[b]*p[c], m = evaluateLine(a,b,c).mult;
    lineRtp += prob * m; if (m > 0) hit += prob;
  }
  // 5 條線、每線注 = 總注/5 → 總 RTP = 每線 RTP（線性疊加，分子分母同乘 5）
  console.log(`     每線 RTP = ${(lineRtp*100).toFixed(1)}%（= 總 RTP）　單線中獎率 ${(hit*100).toFixed(1)}%`);
  ok(lineRtp > 0.88 && lineRtp < 0.96, `RTP 落在 88~96%（實際 ${(lineRtp*100).toFixed(1)}%）`);
  ok(lineRtp < 1.0, 'RTP < 100%（玩家長期不穩賺）');
}

console.log('\n────────────────────────────────────────');
console.log(`通過 ${pass} / 失敗 ${fail}`);
if (fail) { console.log('失敗：'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log('🎉 全部邏輯測試通過');
