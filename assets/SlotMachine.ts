import {
    _decorator, Component, Label, Button, randomRangeInt,
    Node, UITransform, Color, EventHandler, Graphics
} from 'cc';
const { ccclass } = _decorator;

const SYMBOLS  = ['7', '★', '♦', '♣', '♥', 'BAR'];
const UI_LAYER = 1 << 25;
const C = (r: number, g: number, b: number, a = 255) => new Color(r, g, b, a);

@ccclass('SlotMachine')
export class SlotMachine extends Component {
    private _reel1!: Label;
    private _reel2!: Label;
    private _reel3!: Label;
    private _resultLabel!: Label;
    private _scoreLabel!: Label;
    private _betLabel!: Label;

    private _spinning  = false;
    private _tickCount = 0;
    private _maxTicks  = 24;
    private _score     = 100;
    private _bet       = 10;

    onLoad() {
        this.scheduleOnce(() => { this._buildUI(); this._updateUI(); }, 0);
    }

    spin() {
        if (this._spinning) return;
        if (this._score < this._bet) {
            this._resultLabel.string = '❌  餘額不足！';
            this._resultLabel.color  = C(230, 70, 70);
            return;
        }
        this._score   -= this._bet;
        this._spinning  = true;
        this._tickCount = 0;
        this._resultLabel.string = '🎰  轉動中…';
        this._resultLabel.color  = C(255, 255, 255);
        this._updateUI();
        this.schedule(this._tick.bind(this), 0.07, this._maxTicks - 1);
    }

    private _tick() {
        this._reel1.string = SYMBOLS[randomRangeInt(0, SYMBOLS.length)];
        this._reel2.string = SYMBOLS[randomRangeInt(0, SYMBOLS.length)];
        this._reel3.string = SYMBOLS[randomRangeInt(0, SYMBOLS.length)];
        if (++this._tickCount >= this._maxTicks) {
            this._spinning = false;
            this._checkWin();
        }
    }

    private _checkWin() {
        const r1 = this._reel1.string, r2 = this._reel2.string, r3 = this._reel3.string;
        if (r1 === r2 && r2 === r3) {
            this._score += this._bet * (r1 === '7' ? 10 : 5);
            this._resultLabel.string = r1 === '7'
                ? '🎉  JACKPOT！  777  🎉'
                : `🎊  三連！ ${r1} ${r2} ${r3}`;
            this._resultLabel.color = C(255, 215, 50);
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            this._score += this._bet * 2;
            this._resultLabel.string = `✨  小贏！ ${r1} ${r2} ${r3}`;
            this._resultLabel.color  = C(78, 215, 175);
        } else {
            this._resultLabel.string = `${r1}  ${r2}  ${r3}  — 再試`;
            this._resultLabel.color  = C(175, 165, 150);
        }
        this._updateUI();
    }

    private _updateUI() {
        if (this._scoreLabel) this._scoreLabel.string = `💰  ${this._score}`;
        if (this._betLabel)   this._betLabel.string   = `押注  ${this._bet}`;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    private _buildUI() {
        const cv = this.node.parent!;

        // Background layers
        this._box(cv, 'Bg',   0,   0, 1280, 720, 0, C(8, 3, 22));
        this._box(cv, 'CBg',  0, -60, 1280, 600, 0, C(16, 7, 48));
        this._city(cv);

        // Machine body
        this._box(cv, 'MGl',  0, 10, 718, 642, 26, C(90, 55, 0, 90));
        this._box(cv, 'MSh',  5,  4, 708, 636, 24, C(3, 1, 8, 210));
        this._box(cv, 'MB',   0, 10, 700, 628, 22, C(38, 14, 80));
        this._brd(cv, 'MBd',  0, 10, 700, 628, 22, C(200, 148, 12), 8);
        this._box(cv, 'MI',   0, 10, 682, 612, 18, C(52, 20, 98));
        this._brd(cv, 'MIBd', 0, 10, 682, 612, 18, C(160, 115, 5), 2);

        // Title banner
        this._box(cv, 'TBg', 0, 278, 604, 76, 12, C(8, 3, 22, 250));
        this._brd(cv, 'TBd', 0, 278, 604, 76, 12, C(255, 215, 50), 3);
        this._lbl(cv, 'TTx', '777   拉 霸 機   777', 0, 278, 38, C(255, 215, 50), true, 594, 72);

        // Decorative bulbs
        this._bulbs(cv, 0, 210, 578, 26);

        // 3 reel windows
        const RY = 52;
        for (const rx of [-192, 0, 192]) {
            this._box(cv, 'RSh', rx + 5, RY - 5, 170, 202, 12, C(2, 1, 8, 200));
            this._box(cv, 'RBg', rx,     RY,     166, 198, 10, C(255, 255, 255));
            this._brd(cv, 'RBd', rx,     RY,     166, 198, 10, C(200, 148, 12), 5);
            this._box(cv, 'RIn', rx,     RY,     154, 186,  7, C(252, 246, 225));
        }

        // Symbol labels — 70pt fits fully inside reel window without corner clipping
        this._reel1 = this._lbl(cv, 'S1', '♦', -192, RY, 70, C(195, 135, 5), true, 150, 186);
        this._reel2 = this._lbl(cv, 'S2', '♦',    0, RY, 70, C(195, 135, 5), true, 150, 186);
        this._reel3 = this._lbl(cv, 'S3', '♦',  192, RY, 70, C(195, 135, 5), true, 150, 186);

        // Result bar
        this._box(cv, 'ResBg', 0, -92, 544, 54, 10, C(12, 5, 30, 220));
        this._brd(cv, 'ResBd', 0, -92, 544, 54, 10, C(200, 148, 12), 2);
        this._resultLabel = this._lbl(cv, 'Res', '— SPIN to play —', 0, -92, 22, C(255, 255, 255), false, 534, 50);

        // Score & bet
        this._scoreLabel = this._lbl(cv, 'Scr', '💰  100', 0, -145, 34, C(80, 225, 80), true, 380, 50);
        this._betLabel   = this._lbl(cv, 'Bet', '押注  10',  0, -185, 20, C(255, 185, 80), false, 240, 34);

        // SPIN button
        this._spinBtn(cv, 0, -235);
    }

    private _city(cv: Node) {
        const n = new Node('City');
        n.layer = UI_LAYER;
        cv.addChild(n);
        n.setPosition(0, -240, 0);
        const uit = n.addComponent(UITransform);
        uit.setContentSize(1280, 240);
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
        for (const [bx, bh, bw] of blds) {
            for (let row = 12; row < bh - 8; row += 16)
                for (let col = 7; col < bw - 7; col += 11)
                    if ((row + col) % 5 !== 0) g.rect(bx - bw / 2 + col, -120 + row, 5, 7);
        }
        g.fill();
    }

    private _spinBtn(cv: Node, x: number, y: number) {
        const W = 382, H = 72;
        this._box(cv, 'BSh', x + 5, y - 5, W, H, 18, C(3, 1, 8, 200));
        const body = this._box(cv, 'BBd', x, y, W, H, 18, C(185, 105, 0));
        this._brd(cv, 'BBr', x, y, W, H, 18, C(255, 215, 50), 4);
        // Sheen
        const sn = new Node('BShn');
        sn.layer = UI_LAYER;
        cv.addChild(sn);
        sn.setPosition(x, y + H / 4, 0);
        const sUIT = sn.addComponent(UITransform);
        sUIT.setContentSize(W - 8, H / 2 - 4);
        const sg = sn.addComponent(Graphics);
        sg.clear();
        sg.fillColor = C(245, 175, 25, 75);
        sg.roundRect(-(W - 8) / 2, -(H / 2 - 4) / 2, W - 8, H / 2 - 4, 14);
        sg.fill();
        this._lbl(cv, 'BTx', 'SPIN  ▶', x, y, 34, C(255, 215, 50), true, W, H);
        const btn      = body.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale  = 1.05;
        const eh       = new EventHandler();
        eh.target      = this.node;
        eh.component   = 'SlotMachine';
        eh.handler     = 'spin';
        btn.clickEvents = [eh];
    }

    private _bulbs(cv: Node, x: number, y: number, w: number, count: number) {
        const n = new Node('Bulbs');
        n.layer = UI_LAYER;
        cv.addChild(n);
        n.setPosition(x, y, 0);
        const uit = n.addComponent(UITransform);
        uit.setContentSize(w, 18);
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
        g.lineWidth   = 1;
        for (let i = 0; i < count; i++) g.circle(-w / 2 + step * (i + 0.5), 0, 7);
        g.stroke();
    }

    // ── Primitives ──────────────────────────────────────────────────────────────

    private _box(p: Node, name: string, x: number, y: number,
                 w: number, h: number, r: number, c: Color): Node {
        const n = new Node(name);
        n.layer = UI_LAYER;
        p.addChild(n);
        n.setPosition(x, y, 0);
        const uit = n.addComponent(UITransform);
        uit.setContentSize(w, h);
        const g = n.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(c.r, c.g, c.b, c.a);
        r > 0 ? g.roundRect(-w / 2, -h / 2, w, h, r) : g.rect(-w / 2, -h / 2, w, h);
        g.fill();
        return n;
    }

    private _brd(p: Node, name: string, x: number, y: number,
                 w: number, h: number, r: number, c: Color, lw: number): Node {
        const n = new Node(name);
        n.layer = UI_LAYER;
        p.addChild(n);
        n.setPosition(x, y, 0);
        const uit = n.addComponent(UITransform);
        uit.setContentSize(w, h);
        const g = n.addComponent(Graphics);
        g.clear();
        g.strokeColor = new Color(c.r, c.g, c.b, c.a);
        g.lineWidth   = lw;
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
        const uit = n.addComponent(UITransform);
        uit.setContentSize(w, h);
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
