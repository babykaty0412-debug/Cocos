import {
    _decorator, Component, Label, Button, randomRangeInt,
    Node, UITransform, Color, EventHandler, Graphics,
    Mask, UIOpacity, tween, Vec3
} from 'cc';
const { ccclass } = _decorator;

export const SYMBOLS = ['7', '★', '◆', '♣', '♥', 'BAR'];
//                       7  ★  ◆  ♣  ♥  BAR   —— 7 最稀有
export const WEIGHTS = [2, 3, 5, 6, 6, 4];
export const TRIPLE  = [60, 25, 12, 8, 8, 15];   // 三連線倍率（依稀有度）
export const PAIR    = [3, 1, 1, 1, 1, 2];        // 兩連線倍率（7對×3、BAR對×2、其餘回本）
const BET_TIERS = [10, 20, 50, 100];
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);

const UI_LAYER  = 1 << 25;
const SYM_H     = 186;
const STRIP_LEN = 20;
const LAND_SLOT = STRIP_LEN - 2;
const C = (r: number, g: number, b: number, a = 255) => new Color(r, g, b, a);

// 每個符號的顏色（賭場風配色）
const SYM_COLOR = [
    C(255, 77, 77), C(255, 210, 58), C(77, 182, 255),
    C(87, 224, 138), C(255, 93, 143), C(192, 139, 255)
];

export interface WinResult { mult: number; jackpot: boolean; kind: 'triple' | 'pair' | 'none'; line: number[]; }

// ── 純邏輯（無 cc 相依，可單獨測試）───────────────────────────────────────────
export function evaluate(a: number, b: number, c: number): WinResult {
    if (a === b && b === c) return { mult: TRIPLE[a], jackpot: a === 0, kind: 'triple', line: [0, 1, 2] };
    if (a === b) return { mult: PAIR[a], jackpot: false, kind: 'pair', line: [0, 1] };
    if (b === c) return { mult: PAIR[b], jackpot: false, kind: 'pair', line: [1, 2] };
    if (a === c) return { mult: PAIR[a], jackpot: false, kind: 'pair', line: [0, 2] };
    return { mult: 0, jackpot: false, kind: 'none', line: [] };
}

interface Reel { strip: Node; labels: Label[]; result: number; }

@ccclass('SlotMachine')
export class SlotMachine extends Component {
    private _reels: Reel[] = [];
    private _resultLabel!: Label;
    private _scoreLabel!: Label;
    private _betLabel!: Label;
    private _autoLabel!: Label;
    private _autoBody!: Node;

    private _spinning       = false;
    private _scoreAnimating = false;
    private _score          = 1000;
    private _betIdx         = 0;
    private _auto           = false;
    private _cv!: Node;

    private get _bet() { return BET_TIERS[this._betIdx]; }

    onLoad() {
        this.scheduleOnce(() => { this._buildUI(); this._refresh(); }, 0);
    }

    private _pick(): number {
        let r = randomRangeInt(0, WSUM);
        for (let i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i]; if (r < 0) return i; }
        return WEIGHTS.length - 1;
    }

    spin() {
        if (this._spinning) return;
        if (this._score < this._bet) {
            if (this._score < BET_TIERS[0]) {     // 完全破產 → 自動補幣
                this._score = 1000;
                this._setResult('已補滿 1000 分，再來！', C(120, 255, 150));
                this._auto = false; this._syncAuto(); this._refresh();
                return;
            }
            this._setResult('餘額不足，請降低押注', C(235, 95, 95));
            this._auto = false; this._syncAuto();
            return;
        }
        this._spinning = true;
        this._score   -= this._bet;
        this._setResult('轉動中…', C(255, 255, 255));
        this._refresh();

        const dur = [1.0, 1.35, 1.7];
        for (let r = 0; r < 3; r++) {
            const reel = this._reels[r];
            const prevIdx = reel.result;
            reel.result = this._pick();
            for (let k = 0; k < STRIP_LEN; k++) {
                const idx = k === LAND_SLOT ? reel.result : this._pick();
                reel.labels[k].string = SYMBOLS[idx];
                reel.labels[k].color  = SYM_COLOR[idx];
                reel.labels[k].node.setScale(1, 1, 1);
            }
            // 重置前保留「目前顯示的符號」於起點，避免重啟跳幀
            reel.labels[0].string = SYMBOLS[prevIdx];
            reel.labels[0].color  = SYM_COLOR[prevIdx];
            reel.strip.setPosition(0, 0, 0);
            const t = tween(reel.strip).to(dur[r], { position: new Vec3(0, -LAND_SLOT * SYM_H, 0) }, { easing: 'cubicOut' });
            if (r === 2) t.call(() => this._onSpinEnd());
            t.start();
        }
    }

    private _onSpinEnd() {
        this._spinning = false;
        const a = this._reels[0].result, b = this._reels[1].result, c = this._reels[2].result;
        const e = evaluate(a, b, c);
        const win = this._bet * e.mult;

        if (e.kind === 'triple') {
            this._setResult(e.jackpot ? '🎉 JACKPOT！ 777  ×60 🎉' : `🎊 ${SYMBOLS[a]} 三連線　×${e.mult}`, C(255, 215, 50));
            this._flashWin(e.line);
            this._bigWin(win, e.jackpot);
        } else if (e.kind === 'pair') {
            this._setResult(`✨ 兩連線　×${e.mult}`, C(90, 230, 165));
            this._flashWin(e.line);
        } else {
            this._setResult('再接再厲 🍀', C(185, 172, 155));
        }

        if (win > 0) { const from = this._score; this._score += win; this._animateScore(from, this._score); }
        this._refresh();

        if (this._auto) this.scheduleOnce(() => { if (this._auto && !this._spinning) this.spin(); }, 1.2);
    }

    betDown() { if (!this._spinning) { this._betIdx = (this._betIdx + BET_TIERS.length - 1) % BET_TIERS.length; this._refresh(); } }
    betUp()   { if (!this._spinning) { this._betIdx = (this._betIdx + 1) % BET_TIERS.length; this._refresh(); } }

    toggleAuto() {
        this._auto = !this._auto;
        this._syncAuto();
        if (this._auto && !this._spinning) this.spin();
    }

    private _syncAuto() {
        if (!this._autoLabel) return;
        this._autoLabel.string = this._auto ? 'AUTO ⏸' : 'AUTO ▶';
        this._autoLabel.color  = this._auto ? C(20, 20, 20) : C(255, 238, 150);
        this._tint(this._autoBody, this._auto ? C(255, 205, 50) : C(120, 70, 0));
    }

    private _setResult(text: string, color: Color) {
        this._resultLabel.string = text;
        this._resultLabel.color  = color;
    }

    private _refresh() {
        if (this._betLabel) this._betLabel.string = `押注  ${this._bet}`;
        if (this._scoreLabel && !this._scoreAnimating) this._scoreLabel.string = `💰  ${this._score}`;
    }

    private _animateScore(from: number, to: number) {
        this._scoreAnimating = true;
        const steps = 24;
        let i = 0;
        this._scoreLabel.string = `💰  ${from}`;
        this.schedule(() => {
            i++;
            const v = i >= steps ? to : Math.round(from + (to - from) * i / steps);
            this._scoreLabel.string = `💰  ${v}`;
            if (i >= steps) this._scoreAnimating = false;
        }, 0.025, steps - 1);
    }

    private _flashWin(idxs: number[]) {
        for (const i of idxs) {
            const lbl = this._reels[i].labels[LAND_SLOT];
            tween(lbl.node)
                .to(0.16, { scale: new Vec3(1.34, 1.34, 1) }, { easing: 'quadOut' })
                .to(0.16, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
                .union().repeat(3)
                .start();
        }
    }

    private _bigWin(amount: number, jackpot: boolean) {
        const lay = new Node('BigWin');
        lay.layer = UI_LAYER;
        this._cv.addChild(lay);
        lay.setPosition(0, 40, 0);
        lay.setScale(0.4, 0.4, 1);
        const op = lay.addComponent(UIOpacity);
        op.opacity = 0;

        this._box(lay, 'BWbg', 0,  0, 580, 230, 26, C(10, 4, 30, 240));
        this._brd(lay, 'BWbd', 0,  0, 580, 230, 26, C(255, 215, 50), 6);
        this._lbl(lay, 'BWt', jackpot ? '★ JACKPOT ★' : 'BIG WIN', 0,  48, 64, C(255, 215, 50), true, 560, 96);
        this._lbl(lay, 'BWa', `+ ${amount}`, 0, -46, 50, C(120, 255, 150), true, 560, 76);

        tween(op).to(0.25, { opacity: 255 }).delay(1.4).to(0.45, { opacity: 0 }).call(() => lay.destroy()).start();
        tween(lay).to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    private _buildUI() {
        const cv = this._cv = this.node.parent!;

        this._box(cv, 'Bg',  0,   0, 1280, 720, 0, C(8, 3, 22));
        this._box(cv, 'CBg', 0, -60, 1280, 600, 0, C(16, 7, 48));
        this._city(cv);

        this._box(cv, 'MGl',  0, 10, 718, 642, 26, C(90, 55, 0, 90));
        this._box(cv, 'MSh',  5,  4, 708, 636, 24, C(3, 1, 8, 210));
        this._box(cv, 'MB',   0, 10, 700, 628, 22, C(38, 14, 80));
        this._brd(cv, 'MBd',  0, 10, 700, 628, 22, C(200, 148, 12), 8);
        this._box(cv, 'MI',   0, 10, 682, 612, 18, C(52, 20, 98));
        this._brd(cv, 'MIBd', 0, 10, 682, 612, 18, C(160, 115, 5), 2);

        this._box(cv, 'TBg', 0, 278, 604, 76, 12, C(8, 3, 22, 250));
        this._brd(cv, 'TBd', 0, 278, 604, 76, 12, C(255, 215, 50), 3);
        this._lbl(cv, 'TTx', '777   拉 霸 機   777', 0, 278, 38, C(255, 215, 50), true, 594, 72);

        this._bulbs(cv, 0, 210, 578, 26);

        for (const rx of [-192, 0, 192]) this._buildReel(rx, 52);

        this._box(cv, 'ResBg', 0, -86, 544, 50, 10, C(12, 5, 30, 220));
        this._brd(cv, 'ResBd', 0, -86, 544, 50, 10, C(200, 148, 12), 2);
        this._resultLabel = this._lbl(cv, 'Res', '— 按 SPIN 開始 —', 0, -86, 22, C(255, 255, 255), false, 534, 46);

        this._scoreLabel = this._lbl(cv, 'Scr', '💰  1000', 0, -132, 36, C(90, 230, 90), true, 420, 50);

        this._button('Minus', -150, -180, 60, 52, '−', 40, C(120, 70, 0), 'betDown');
        this._box(cv, 'BetBg', 0, -180, 168, 50, 10, C(8, 3, 22, 220));
        this._brd(cv, 'BetBd', 0, -180, 168, 50, 10, C(200, 148, 12), 2);
        this._betLabel = this._lbl(cv, 'Bet', '押注  10', 0, -180, 22, C(255, 195, 90), true, 158, 46);
        this._button('Plus', 150, -180, 60, 52, '＋', 36, C(120, 70, 0), 'betUp');

        this._spinBtn(cv, -92, -240);
        const auto = this._button('Auto', 150, -240, 156, 66, 'AUTO ▶', 28, C(120, 70, 0), 'toggleAuto');
        this._autoBody  = auto.body;
        this._autoLabel = auto.label;
    }

    private _buildReel(rx: number, RY: number) {
        this._box(this._cv, 'RSh', rx + 5, RY - 5, 170, 202, 12, C(2, 1, 8, 200));
        this._box(this._cv, 'RBg', rx,     RY,     166, 198, 10, C(255, 255, 255));
        this._brd(this._cv, 'RBd', rx,     RY,     166, 198, 10, C(200, 148, 12), 5);
        this._box(this._cv, 'RIn', rx,     RY,     154, 186,  7, C(252, 246, 225));

        const mask = new Node('RMask');
        mask.layer = UI_LAYER;
        this._cv.addChild(mask);
        mask.setPosition(rx, RY, 0);
        mask.addComponent(UITransform).setContentSize(150, 182);
        mask.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;

        const strip = new Node('RStrip');
        strip.layer = UI_LAYER;
        mask.addChild(strip);
        strip.setPosition(0, 0, 0);
        strip.addComponent(UITransform).setContentSize(150, STRIP_LEN * SYM_H);

        const labels: Label[] = [];
        for (let k = 0; k < STRIP_LEN; k++) {
            const idx = this._pick();
            labels.push(this._lbl(strip, 'S' + k, SYMBOLS[idx], 0, k * SYM_H, 70, SYM_COLOR[idx], true, 150, SYM_H));
        }
        labels[0].string = '◆';
        labels[0].color  = SYM_COLOR[2];
        this._reels.push({ strip, labels, result: 2 });
    }

    private _city(cv: Node) {
        const n = new Node('City');
        n.layer = UI_LAYER;
        cv.addChild(n);
        n.setPosition(0, -240, 0);
        n.addComponent(UITransform).setContentSize(1280, 240);
        const g = n.addComponent(Graphics);
        g.clear();
        const blds = [
            [-575,112,72],[-490,92,52],[-408,132,72],[-312,82,62],
            [-232,152,82],[-132,102,62],[-36,122,72],[68,92,52],
            [148,142,82],[258,72,62],[342,122,72],[442,102,52],[514,138,72]
        ];
        g.fillColor = C(26, 10, 62);
        for (const [bx, bh, bw] of blds) g.rect(bx - bw / 2, -120, bw, bh);
        g.fill();
        g.fillColor = C(255, 195, 35, 65);
        for (const [bx, bh, bw] of blds)
            for (let row = 12; row < bh - 8; row += 16)
                for (let col = 7; col < bw - 7; col += 11)
                    if ((row + col) % 5 !== 0) g.rect(bx - bw / 2 + col, -120 + row, 5, 7);
        g.fill();
    }

    private _spinBtn(cv: Node, x: number, y: number) {
        const W = 240, H = 66;
        this._box(cv, 'BSh', x + 5, y - 5, W, H, 18, C(3, 1, 8, 200));
        const body = this._box(cv, 'BBd', x, y, W, H, 18, C(210, 120, 0));
        this._brd(cv, 'BBr', x, y, W, H, 18, C(255, 215, 50), 4);
        const sn = new Node('BShn');
        sn.layer = UI_LAYER;
        cv.addChild(sn);
        sn.setPosition(x, y + H / 4, 0);
        sn.addComponent(UITransform).setContentSize(W - 10, H / 2 - 4);
        const sg = sn.addComponent(Graphics);
        sg.clear();
        sg.fillColor = C(245, 175, 25, 75);
        sg.roundRect(-(W - 10) / 2, -(H / 2 - 4) / 2, W - 10, H / 2 - 4, 14);
        sg.fill();
        this._lbl(cv, 'BTx', 'SPIN  ▶', x, y, 32, C(255, 238, 150), true, W, H);
        const btn = body.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale  = 1.06;
        const eh = new EventHandler();
        eh.target = this.node; eh.component = 'SlotMachine'; eh.handler = 'spin';
        btn.clickEvents = [eh];
    }

    private _bulbs(cv: Node, x: number, y: number, w: number, count: number) {
        const n = new Node('Bulbs');
        n.layer = UI_LAYER;
        cv.addChild(n);
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, 18);
        const g = n.addComponent(Graphics);
        g.clear();
        const step = w / count;
        g.fillColor = C(255, 238, 60);
        for (let i = 0; i < count; i += 2) g.circle(-w / 2 + step * (i + 0.5), 0, 7);
        g.fill();
        g.fillColor = C(78, 58, 14);
        for (let i = 1; i < count; i += 2) g.circle(-w / 2 + step * (i + 0.5), 0, 7);
        g.fill();
        g.strokeColor = C(195, 160, 20);
        g.lineWidth = 1;
        for (let i = 0; i < count; i++) g.circle(-w / 2 + step * (i + 0.5), 0, 7);
        g.stroke();
    }

    private _button(name: string, x: number, y: number, w: number, h: number,
                    text: string, fs: number, base: Color, handler: string): { body: Node, label: Label } {
        this._box(this._cv, name + 'Sh', x + 4, y - 4, w, h, 14, C(3, 1, 8, 190));
        const body = this._box(this._cv, name + 'Bd', x, y, w, h, 14, base);
        this._brd(this._cv, name + 'Br', x, y, w, h, 14, C(255, 215, 50), 3);
        const label = this._lbl(this._cv, name + 'Tx', text, x, y, fs, C(255, 238, 150), true, w, h);
        const btn = body.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale  = 1.08;
        const eh = new EventHandler();
        eh.target = this.node; eh.component = 'SlotMachine'; eh.handler = handler;
        btn.clickEvents = [eh];
        return { body, label };
    }

    private _tint(node: Node, c: Color) {
        const g = node.getComponent(Graphics);
        if (!g) return;
        const uit = node.getComponent(UITransform)!;
        const w = uit.width, h = uit.height;
        g.clear();
        g.fillColor = c;
        g.roundRect(-w / 2, -h / 2, w, h, 14);
        g.fill();
    }

    private _box(p: Node, name: string, x: number, y: number, w: number, h: number, r: number, c: Color): Node {
        const n = new Node(name);
        n.layer = UI_LAYER;
        p.addChild(n);
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        const g = n.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(c.r, c.g, c.b, c.a);
        r > 0 ? g.roundRect(-w / 2, -h / 2, w, h, r) : g.rect(-w / 2, -h / 2, w, h);
        g.fill();
        return n;
    }

    private _brd(p: Node, name: string, x: number, y: number, w: number, h: number, r: number, c: Color, lw: number): Node {
        const n = new Node(name);
        n.layer = UI_LAYER;
        p.addChild(n);
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        const g = n.addComponent(Graphics);
        g.clear();
        g.strokeColor = new Color(c.r, c.g, c.b, c.a);
        g.lineWidth = lw;
        r > 0 ? g.roundRect(-w / 2, -h / 2, w, h, r) : g.rect(-w / 2, -h / 2, w, h);
        g.stroke();
        return n;
    }

    private _lbl(p: Node, name: string, text: string, x: number, y: number,
                 fs: number, c: Color, bold: boolean, w: number, h: number): Label {
        const n = new Node(name);
        n.layer = UI_LAYER;
        p.addChild(n);
        n.setPosition(x, y, 0);
        n.addComponent(UITransform).setContentSize(w, h);
        const lbl = n.addComponent(Label);
        lbl.string          = text;
        lbl.fontSize        = fs;
        lbl.useSystemFont   = true;
        lbl.isBold          = bold;
        lbl.color           = new Color(c.r, c.g, c.b, c.a);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign   = Label.VerticalAlign.CENTER;
        lbl.overflow        = Label.Overflow.NONE;
        return lbl;
    }
}
