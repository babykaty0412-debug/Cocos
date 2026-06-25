System.register("chunks:///_virtual/main", ['./SlotMachine.ts'], function () {
  return {
    setters: [null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/SlotMachine.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, _createClass, cclegacy, _decorator, Color, randomRangeInt, tween, Vec3, Node, UIOpacity, UITransform, Mask, Graphics, Button, EventHandler, Label, Component;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      randomRangeInt = module.randomRangeInt;
      tween = module.tween;
      Vec3 = module.Vec3;
      Node = module.Node;
      UIOpacity = module.UIOpacity;
      UITransform = module.UITransform;
      Mask = module.Mask;
      Graphics = module.Graphics;
      Button = module.Button;
      EventHandler = module.EventHandler;
      Label = module.Label;
      Component = module.Component;
    }],
    execute: function () {
      exports({
        evaluateGrid: evaluateGrid,
        evaluateLine: evaluateLine
      });
      var _dec, _class;
      cclegacy._RF.push({}, "5de38zammJGkJTQcu7FE1tk", "SlotMachine", undefined);
      var ccclass = _decorator.ccclass;
      var SYMBOLS = exports('SYMBOLS', ['7', '★', '◆', '♣', '♥', 'BAR']);
      var WEIGHTS = exports('WEIGHTS', [2, 3, 5, 6, 6, 4]); // 7 最稀有
      var TRIPLE = exports('TRIPLE', [60, 25, 12, 8, 8, 15]); // 三連線倍率
      var PAIR = exports('PAIR', [3, 1, 1, 1, 1, 2]); // 兩連線倍率
      // 5 條連線：每條 = [reel0 的列, reel1 的列, reel2 的列]（列 0=上 1=中 2=下）
      var PAYLINES = exports('PAYLINES', [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]]);
      var BET_TIERS = [10, 20, 50, 100];
      var WSUM = WEIGHTS.reduce(function (a, b) {
        return a + b;
      }, 0);
      var UI_LAYER = 1 << 25;
      var ROW_H = 60; // 每列高（3 列一窗 = 180）
      var STRIP_LEN = 24;
      var LAND = STRIP_LEN - 2; // 落點中列 slot；可見列 = LAND-1,LAND,LAND+1
      var C = function C(r, g, b, a) {
        if (a === void 0) {
          a = 255;
        }
        return new Color(r, g, b, a);
      };
      var SYM_COLOR = [C(255, 77, 77), C(255, 210, 58), C(77, 182, 255), C(87, 224, 138), C(255, 93, 143), C(192, 139, 255)];
      // ── 純邏輯（無 cc 相依，可單測）─────────────────────────────────────────────
      function evaluateLine(a, b, c) {
        if (a === b && b === c) return {
          mult: TRIPLE[a],
          jackpot: a === 0,
          kind: 'triple'
        };
        if (a === b || b === c || a === c) {
          var s = a === b ? a : b === c ? b : a;
          return {
            mult: PAIR[s],
            jackpot: false,
            kind: 'pair'
          };
        }
        return {
          mult: 0,
          jackpot: false,
          kind: 'none'
        };
      }

      // grid[reel][row] → 統計 5 條連線
      function evaluateGrid(grid) {
        var totalMult = 0,
          jackpot = false;
        var wins = [];
        for (var li = 0; li < PAYLINES.length; li++) {
          var pl = PAYLINES[li];
          var r = evaluateLine(grid[0][pl[0]], grid[1][pl[1]], grid[2][pl[2]]);
          if (r.mult > 0) {
            totalMult += r.mult;
            if (r.jackpot) jackpot = true;
            wins.push({
              line: li,
              mult: r.mult,
              cells: [[0, pl[0]], [1, pl[1]], [2, pl[2]]]
            });
          }
        }
        return {
          totalMult: totalMult,
          jackpot: jackpot,
          wins: wins
        };
      }
      var SlotMachine = exports('SlotMachine', (_dec = ccclass('SlotMachine'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(SlotMachine, _Component);
        function SlotMachine() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this._reels = [];
          _this._resultLabel = void 0;
          _this._scoreLabel = void 0;
          _this._betLabel = void 0;
          _this._autoLabel = void 0;
          _this._autoBody = void 0;
          _this._spinning = false;
          _this._scoreAnimating = false;
          _this._score = 1000;
          _this._betIdx = 0;
          _this._auto = false;
          _this._cv = void 0;
          _this._bulbG = void 0;
          _this._bulbN = 0;
          _this._bulbW = 0;
          _this._bulbStep = 0;
          _this._bulbPhase = 0;
          return _this;
        }
        var _proto = SlotMachine.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          this.scheduleOnce(function () {
            _this2._buildUI();
            _this2._refresh();
          }, 0);
        };
        _proto._pick = function _pick() {
          var r = randomRangeInt(0, WSUM);
          for (var i = 0; i < WEIGHTS.length; i++) {
            r -= WEIGHTS[i];
            if (r < 0) return i;
          }
          return WEIGHTS.length - 1;
        };
        _proto.spin = function spin() {
          var _this3 = this;
          if (this._spinning) return;
          if (this._score < this._bet) {
            if (this._score < BET_TIERS[0]) {
              this._score = 1000;
              this._setResult('已補滿 1000 分，再來！', C(120, 255, 150));
              this._auto = false;
              this._syncAuto();
              this._refresh();
              return;
            }
            this._setResult('餘額不足，請降低押注', C(235, 95, 95));
            this._auto = false;
            this._syncAuto();
            return;
          }
          this._spinning = true;
          this._score -= this._bet;
          this._setResult('轉動中…', C(255, 255, 255));
          this._refresh();
          var dur = [1.0, 1.35, 1.7];
          for (var r = 0; r < 3; r++) {
            var reel = this._reels[r];
            var prev = reel.rows;
            var nu = [this._pick(), this._pick(), this._pick()];
            reel.rows = nu;
            for (var k = 0; k < STRIP_LEN; k++) {
              var idx = this._pick();
              reel.labels[k].string = SYMBOLS[idx];
              reel.labels[k].color = SYM_COLOR[idx];
              reel.labels[k].node.setScale(1, 1, 1);
            }
            // 起點（strip.y=ROW_H 顯示 slot 0,1,2）填上一輪結果 → 不跳幀
            for (var rw = 0; rw < 3; rw++) {
              reel.labels[rw].string = SYMBOLS[prev[rw]];
              reel.labels[rw].color = SYM_COLOR[prev[rw]];
            }
            // 落點（strip.y=LAND*ROW_H 顯示 slot LAND-1,LAND,LAND+1）填本輪結果
            for (var _rw = 0; _rw < 3; _rw++) {
              var _idx = nu[_rw];
              reel.labels[LAND - 1 + _rw].string = SYMBOLS[_idx];
              reel.labels[LAND - 1 + _rw].color = SYM_COLOR[_idx];
            }
            reel.strip.setPosition(0, ROW_H, 0);
            var t = tween(reel.strip).to(dur[r], {
              position: new Vec3(0, LAND * ROW_H, 0)
            }, {
              easing: 'cubicOut'
            });
            if (r === 2) t.call(function () {
              return _this3._onSpinEnd();
            });
            t.start();
          }
        };
        _proto._onSpinEnd = function _onSpinEnd() {
          var _this4 = this;
          this._spinning = false;
          var grid = [this._reels[0].rows, this._reels[1].rows, this._reels[2].rows];
          var e = evaluateGrid(grid);
          var win = e.totalMult * (this._bet / 5);
          if (e.wins.length > 0) {
            if (e.jackpot) this._setResult('🎉 JACKPOT！ 777 🎉　共 ×' + e.totalMult, C(255, 215, 50));else this._setResult('✨ ' + e.wins.length + ' 條連線　共 ×' + e.totalMult, C(90, 230, 165));
            this._flashCells(e.wins);
            if (e.jackpot || e.totalMult >= 20) this._bigWin(win, e.jackpot);
          } else {
            this._setResult('再接再厲 🍀', C(185, 172, 155));
          }
          if (win > 0) {
            var from = this._score;
            this._score += win;
            this._animateScore(from, this._score);
          }
          this._refresh();
          if (this._auto) this.scheduleOnce(function () {
            if (_this4._auto && !_this4._spinning) _this4.spin();
          }, 1.2);
        };
        _proto.betDown = function betDown() {
          if (!this._spinning) {
            this._betIdx = (this._betIdx + BET_TIERS.length - 1) % BET_TIERS.length;
            this._refresh();
          }
        };
        _proto.betUp = function betUp() {
          if (!this._spinning) {
            this._betIdx = (this._betIdx + 1) % BET_TIERS.length;
            this._refresh();
          }
        };
        _proto.toggleAuto = function toggleAuto() {
          this._auto = !this._auto;
          this._syncAuto();
          if (this._auto && !this._spinning) this.spin();
        };
        _proto._syncAuto = function _syncAuto() {
          if (!this._autoLabel) return;
          this._autoLabel.string = this._auto ? 'AUTO ⏸' : 'AUTO ▶';
          this._autoLabel.color = this._auto ? C(20, 20, 20) : C(255, 238, 150);
          this._tint(this._autoBody, this._auto ? C(255, 205, 50) : C(120, 70, 0));
        };
        _proto._setResult = function _setResult(text, color) {
          this._resultLabel.string = text;
          this._resultLabel.color = color;
        };
        _proto._refresh = function _refresh() {
          if (this._betLabel) this._betLabel.string = "\u62BC\u6CE8 " + this._bet + "\uFF085\u7DDA\uFF09";
          if (this._scoreLabel && !this._scoreAnimating) this._scoreLabel.string = "\uD83D\uDCB0  " + this._score;
        };
        _proto._animateScore = function _animateScore(from, to) {
          var _this5 = this;
          this._scoreAnimating = true;
          var steps = 24;
          var i = 0;
          this._scoreLabel.string = "\uD83D\uDCB0  " + from;
          this.schedule(function () {
            i++;
            var v = i >= steps ? to : Math.round(from + (to - from) * i / steps);
            _this5._scoreLabel.string = "\uD83D\uDCB0  " + v;
            if (i >= steps) _this5._scoreAnimating = false;
          }, 0.025, steps - 1);
        };
        _proto._flashCells = function _flashCells(wins) {
          var seen = {};
          for (var _iterator = _createForOfIteratorHelperLoose(wins), _step; !(_step = _iterator()).done;) {
            var w = _step.value;
            for (var _iterator2 = _createForOfIteratorHelperLoose(w.cells), _step2; !(_step2 = _iterator2()).done;) {
              var cell = _step2.value;
              var key = cell[0] + '-' + cell[1];
              if (seen[key]) continue;
              seen[key] = true;
              var lbl = this._reels[cell[0]].labels[LAND - 1 + cell[1]];
              tween(lbl.node).to(0.15, {
                scale: new Vec3(1.3, 1.3, 1)
              }, {
                easing: 'quadOut'
              }).to(0.15, {
                scale: new Vec3(1, 1, 1)
              }, {
                easing: 'quadIn'
              }).union().repeat(3).start();
            }
          }
        };
        _proto._bigWin = function _bigWin(amount, jackpot) {
          var lay = new Node('BigWin');
          lay.layer = UI_LAYER;
          this._cv.addChild(lay);
          lay.setPosition(0, 40, 0);
          lay.setScale(0.4, 0.4, 1);
          var op = lay.addComponent(UIOpacity);
          op.opacity = 0;
          this._box(lay, 'BWbg', 0, 0, 580, 230, 26, C(10, 4, 30, 240));
          this._brd(lay, 'BWbd', 0, 0, 580, 230, 26, C(255, 215, 50), 6);
          this._lbl(lay, 'BWt', jackpot ? '★ JACKPOT ★' : 'BIG WIN', 0, 48, 64, C(255, 215, 50), true, 560, 96);
          this._lbl(lay, 'BWa', "+ " + amount, 0, -46, 50, C(120, 255, 150), true, 560, 76);
          tween(op).to(0.25, {
            opacity: 255
          }).delay(1.4).to(0.45, {
            opacity: 0
          }).call(function () {
            return lay.destroy();
          }).start();
          tween(lay).to(0.4, {
            scale: new Vec3(1, 1, 1)
          }, {
            easing: 'backOut'
          }).start();
        };
        _proto._buildUI = function _buildUI() {
          var _this6 = this;
          var cv = this._cv = this.node.parent;
          this._box(cv, 'Bg', 0, 0, 1280, 720, 0, C(8, 3, 22));
          this._box(cv, 'CBg', 0, -60, 1280, 600, 0, C(16, 7, 48));
          this._city(cv);
          this._box(cv, 'MGl', 0, 10, 718, 642, 26, C(90, 55, 0, 90));
          this._box(cv, 'MSh', 5, 4, 708, 636, 24, C(3, 1, 8, 210));
          this._box(cv, 'MB', 0, 10, 700, 628, 22, C(38, 14, 80));
          this._brd(cv, 'MBd', 0, 10, 700, 628, 22, C(200, 148, 12), 8);
          this._box(cv, 'MI', 0, 10, 682, 612, 18, C(52, 20, 98));
          this._brd(cv, 'MIBd', 0, 10, 682, 612, 18, C(160, 115, 5), 2);
          this._box(cv, 'TBg', 0, 286, 604, 64, 12, C(8, 3, 22, 250));
          this._brd(cv, 'TBd', 0, 286, 604, 64, 12, C(255, 215, 50), 3);
          this._lbl(cv, 'TTx', '777   拉 霸 機   777', 0, 286, 35, C(255, 215, 50), true, 594, 60);
          this._bulbs(cv, 0, 240, 578, 26);
          for (var _i = 0, _arr = [-192, 0, 192]; _i < _arr.length; _i++) {
            var rx = _arr[_i];
            this._buildReel(rx, 96);
          }

          // 賠率表
          this._lbl(cv, 'Pay', '777 ×60　·　三連線 ×8–25　·　兩連線 ×1–3　·　5 條線　·　RTP 94%', 0, -18, 14, C(222, 200, 142), false, 672, 22);
          this._box(cv, 'ResBg', 0, -58, 560, 40, 10, C(12, 5, 30, 220));
          this._brd(cv, 'ResBd', 0, -58, 560, 40, 10, C(200, 148, 12), 2);
          this._resultLabel = this._lbl(cv, 'Res', '— 按 SPIN 開始（5 條連線）—', 0, -58, 21, C(255, 255, 255), false, 550, 36);
          this._scoreLabel = this._lbl(cv, 'Scr', '💰  1000', 0, -104, 34, C(90, 230, 90), true, 420, 46);
          this._button('Minus', -150, -154, 56, 46, '−', 38, C(120, 70, 0), 'betDown');
          this._box(cv, 'BetBg', 0, -154, 188, 46, 10, C(8, 3, 22, 220));
          this._brd(cv, 'BetBd', 0, -154, 188, 46, 10, C(200, 148, 12), 2);
          this._betLabel = this._lbl(cv, 'Bet', '押注 10（5線）', 0, -154, 20, C(255, 195, 90), true, 178, 42);
          this._button('Plus', 150, -154, 56, 46, '＋', 34, C(120, 70, 0), 'betUp');
          this._spinBtn(cv, -94, -222);
          var auto = this._button('Auto', 152, -222, 152, 60, 'AUTO ▶', 28, C(120, 70, 0), 'toggleAuto');
          this._autoBody = auto.body;
          this._autoLabel = auto.label;

          // 底部操作提示
          this._lbl(cv, 'Hint', '5 條連線：上 / 中 / 下 / ↘ / ↗　　點 SPIN ▶ 開始', 0, -280, 14, C(150, 135, 205), false, 660, 22);

          // 跑馬燈閃爍（idle 動態效果）
          this.schedule(function () {
            return _this6._blinkBulbs();
          }, 0.5);
        };
        _proto._buildReel = function _buildReel(rx, RY) {
          var WIN_H = ROW_H * 3; // 180
          this._box(this._cv, 'RSh', rx + 5, RY - 5, 168, WIN_H + 16, 12, C(2, 1, 8, 200));
          this._box(this._cv, 'RBg', rx, RY, 164, WIN_H + 12, 10, C(255, 255, 255));
          this._brd(this._cv, 'RBd', rx, RY, 164, WIN_H + 12, 10, C(200, 148, 12), 5);
          this._box(this._cv, 'RIn', rx, RY, 152, WIN_H + 2, 7, C(252, 246, 225));
          var mask = new Node('RMask');
          mask.layer = UI_LAYER;
          this._cv.addChild(mask);
          mask.setPosition(rx, RY, 0);
          mask.addComponent(UITransform).setContentSize(150, WIN_H);
          mask.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
          var strip = new Node('RStrip');
          strip.layer = UI_LAYER;
          mask.addChild(strip);
          strip.addComponent(UITransform).setContentSize(150, STRIP_LEN * ROW_H);
          var labels = [];
          for (var k = 0; k < STRIP_LEN; k++) {
            var idx = this._pick();
            labels.push(this._lbl(strip, 'S' + k, SYMBOLS[idx], 0, -k * ROW_H, 40, SYM_COLOR[idx], true, 150, ROW_H));
          }
          for (var rw = 0; rw < 3; rw++) {
            labels[LAND - 1 + rw].string = '◆';
            labels[LAND - 1 + rw].color = SYM_COLOR[2];
          }
          strip.setPosition(0, LAND * ROW_H, 0);
          this._reels.push({
            strip: strip,
            labels: labels,
            rows: [2, 2, 2]
          });

          // 列分隔線（畫在遮罩之上 → 後加為後續子節點）
          this._box(this._cv, 'RL1', rx, RY + ROW_H / 2, 150, 2, 0, C(150, 110, 10, 130));
          this._box(this._cv, 'RL2', rx, RY - ROW_H / 2, 150, 2, 0, C(150, 110, 10, 130));
        };
        _proto._city = function _city(cv) {
          var n = new Node('City');
          n.layer = UI_LAYER;
          cv.addChild(n);
          n.setPosition(0, -240, 0);
          n.addComponent(UITransform).setContentSize(1280, 240);
          var g = n.addComponent(Graphics);
          g.clear();
          var blds = [[-575, 112, 72], [-490, 92, 52], [-408, 132, 72], [-312, 82, 62], [-232, 152, 82], [-132, 102, 62], [-36, 122, 72], [68, 92, 52], [148, 142, 82], [258, 72, 62], [342, 122, 72], [442, 102, 52], [514, 138, 72]];
          g.fillColor = C(26, 10, 62);
          for (var _i2 = 0, _blds = blds; _i2 < _blds.length; _i2++) {
            var _blds$_i = _blds[_i2],
              bx = _blds$_i[0],
              bh = _blds$_i[1],
              bw = _blds$_i[2];
            g.rect(bx - bw / 2, -120, bw, bh);
          }
          g.fill();
          g.fillColor = C(255, 195, 35, 65);
          for (var _i3 = 0, _blds2 = blds; _i3 < _blds2.length; _i3++) {
            var _blds2$_i = _blds2[_i3],
              _bx = _blds2$_i[0],
              _bh = _blds2$_i[1],
              _bw = _blds2$_i[2];
            for (var row = 12; row < _bh - 8; row += 16) for (var col = 7; col < _bw - 7; col += 11) if ((row + col) % 5 !== 0) g.rect(_bx - _bw / 2 + col, -120 + row, 5, 7);
          }
          g.fill();
        };
        _proto._spinBtn = function _spinBtn(cv, x, y) {
          var W = 240,
            H = 60;
          this._box(cv, 'BSh', x + 5, y - 5, W, H, 18, C(3, 1, 8, 200));
          var body = this._box(cv, 'BBd', x, y, W, H, 18, C(210, 120, 0));
          this._brd(cv, 'BBr', x, y, W, H, 18, C(255, 215, 50), 4);
          this._lbl(cv, 'BTx', 'SPIN  ▶', x, y, 32, C(255, 238, 150), true, W, H);
          var btn = body.addComponent(Button);
          btn.transition = Button.Transition.SCALE;
          btn.zoomScale = 1.06;
          var eh = new EventHandler();
          eh.target = this.node;
          eh.component = 'SlotMachine';
          eh.handler = 'spin';
          btn.clickEvents = [eh];
        };
        _proto._bulbs = function _bulbs(cv, x, y, w, count) {
          var n = new Node('Bulbs');
          n.layer = UI_LAYER;
          cv.addChild(n);
          n.setPosition(x, y, 0);
          n.addComponent(UITransform).setContentSize(w, 18);
          this._bulbG = n.addComponent(Graphics);
          this._bulbN = count;
          this._bulbW = w;
          this._bulbStep = w / count;
          this._drawBulbs();
        };
        _proto._drawBulbs = function _drawBulbs() {
          var g = this._bulbG,
            w = this._bulbW,
            n = this._bulbN,
            step = this._bulbStep,
            ph = this._bulbPhase;
          g.clear();
          g.fillColor = C(255, 238, 60); // 亮燈（跑馬燈相位）
          for (var i = 0; i < n; i++) if ((i + ph) % 2 === 0) g.circle(-w / 2 + step * (i + 0.5), 0, 7);
          g.fill();
          g.fillColor = C(78, 58, 14); // 暗燈
          for (var _i4 = 0; _i4 < n; _i4++) if ((_i4 + ph) % 2 !== 0) g.circle(-w / 2 + step * (_i4 + 0.5), 0, 7);
          g.fill();
          g.strokeColor = C(195, 160, 20); // 燈框
          g.lineWidth = 1;
          for (var _i5 = 0; _i5 < n; _i5++) g.circle(-w / 2 + step * (_i5 + 0.5), 0, 7);
          g.stroke();
        };
        _proto._blinkBulbs = function _blinkBulbs() {
          this._bulbPhase ^= 1;
          this._drawBulbs();
        };
        _proto._button = function _button(name, x, y, w, h, text, fs, base, handler) {
          this._box(this._cv, name + 'Sh', x + 4, y - 4, w, h, 14, C(3, 1, 8, 190));
          var body = this._box(this._cv, name + 'Bd', x, y, w, h, 14, base);
          this._brd(this._cv, name + 'Br', x, y, w, h, 14, C(255, 215, 50), 3);
          var label = this._lbl(this._cv, name + 'Tx', text, x, y, fs, C(255, 238, 150), true, w, h);
          var btn = body.addComponent(Button);
          btn.transition = Button.Transition.SCALE;
          btn.zoomScale = 1.08;
          var eh = new EventHandler();
          eh.target = this.node;
          eh.component = 'SlotMachine';
          eh.handler = handler;
          btn.clickEvents = [eh];
          return {
            body: body,
            label: label
          };
        };
        _proto._tint = function _tint(node, c) {
          var g = node.getComponent(Graphics);
          if (!g) return;
          var uit = node.getComponent(UITransform);
          var w = uit.width,
            h = uit.height;
          g.clear();
          g.fillColor = c;
          g.roundRect(-w / 2, -h / 2, w, h, 14);
          g.fill();
        };
        _proto._box = function _box(p, name, x, y, w, h, r, c) {
          var n = new Node(name);
          n.layer = UI_LAYER;
          p.addChild(n);
          n.setPosition(x, y, 0);
          n.addComponent(UITransform).setContentSize(w, h);
          var g = n.addComponent(Graphics);
          g.clear();
          g.fillColor = new Color(c.r, c.g, c.b, c.a);
          r > 0 ? g.roundRect(-w / 2, -h / 2, w, h, r) : g.rect(-w / 2, -h / 2, w, h);
          g.fill();
          return n;
        };
        _proto._brd = function _brd(p, name, x, y, w, h, r, c, lw) {
          var n = new Node(name);
          n.layer = UI_LAYER;
          p.addChild(n);
          n.setPosition(x, y, 0);
          n.addComponent(UITransform).setContentSize(w, h);
          var g = n.addComponent(Graphics);
          g.clear();
          g.strokeColor = new Color(c.r, c.g, c.b, c.a);
          g.lineWidth = lw;
          r > 0 ? g.roundRect(-w / 2, -h / 2, w, h, r) : g.rect(-w / 2, -h / 2, w, h);
          g.stroke();
          return n;
        };
        _proto._lbl = function _lbl(p, name, text, x, y, fs, c, bold, w, h) {
          var n = new Node(name);
          n.layer = UI_LAYER;
          p.addChild(n);
          n.setPosition(x, y, 0);
          n.addComponent(UITransform).setContentSize(w, h);
          var lbl = n.addComponent(Label);
          lbl.string = text;
          lbl.fontSize = fs;
          lbl.useSystemFont = true;
          lbl.isBold = bold;
          lbl.color = new Color(c.r, c.g, c.b, c.a);
          lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
          lbl.verticalAlign = Label.VerticalAlign.CENTER;
          lbl.overflow = Label.Overflow.NONE;
          return lbl;
        };
        _createClass(SlotMachine, [{
          key: "_bet",
          get: function get() {
            return BET_TIERS[this._betIdx];
          }
        }]);
        return SlotMachine;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});