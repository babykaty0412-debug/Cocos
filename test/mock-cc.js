// ─────────────────────────────────────────────────────────────────────────────
// mock-cc.js — 最小化的 Cocos `cc` 模組替身，供無頭邏輯測試使用。
// 只實作 SlotMachine.ts 真正用到的 API；繪圖/動畫做成 no-op 或同步快轉。
// ─────────────────────────────────────────────────────────────────────────────

const createdNodes = [];   // 記錄所有建立過的 Node 名稱（即使之後被 destroy 也留痕）

class Color {
  constructor(r, g, b, a) { this.r = r; this.g = g; this.b = b; this.a = (a === undefined ? 255 : a); }
}
class Vec3 {
  constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
}

class UITransform {
  setContentSize(w, h) { this.width = w; this.height = h; return this; }
}

class Graphics {
  clear() {} fill() {} stroke() {}
  rect() {} roundRect() {} circle() {}
  // fillColor / strokeColor / lineWidth 直接當可寫屬性
}

class Label {
  constructor() { this.string = ''; this.fontSize = 0; this.color = null; this.node = null; }
}
Label.HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
Label.VerticalAlign   = { TOP: 0, CENTER: 1, BOTTOM: 2 };
Label.Overflow        = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };

class Button {
  constructor() { this.transition = 0; this.zoomScale = 1; this.clickEvents = []; this.node = null; }
}
Button.Transition = { NONE: 0, COLOR: 1, SPRITE: 2, SCALE: 3 };

class Mask { constructor() { this.type = 0; this.node = null; } }
Mask.Type = { GRAPHICS_RECT: 0, GRAPHICS_ELLIPSE: 1, GRAPHICS_STENCIL: 2, SPRITE_STENCIL: 3, IMAGE_STENCIL: 4 };

class UIOpacity { constructor() { this.opacity = 255; this.node = null; } }

class EventHandler { constructor() { this.target = null; this.component = ''; this.handler = ''; } }

class Node {
  constructor(name) {
    this.name = name || '';
    this.children = [];
    this._comps = [];
    this.position = new Vec3();
    this.scale = new Vec3(1, 1, 1);
    this.layer = 0;
    this.parent = null;
    createdNodes.push(this.name);
  }
  addChild(c) { this.children.push(c); c.parent = this; }
  setPosition(x, y, z) { this.position = new Vec3(x, y, z); }
  setScale(x, y, z) { this.scale = new Vec3(x, y, z); }
  addComponent(T) { const c = new T(); c.node = this; this._comps.push(c); return c; }
  getComponent(T) { return this._comps.find(c => c instanceof T) || null; }
  getChildByName(n) { return this.children.find(c => c.name === n) || null; }
  destroy() {
    if (this.parent) {
      const i = this.parent.children.indexOf(this);
      if (i >= 0) this.parent.children.splice(i, 1);
    }
  }
}

class Component {
  constructor() { this._onceQ = []; this.node = null; }
  // scheduleOnce 排隊（不立即跑），由測試決定何時 flush，避免 AUTO 無限遞迴
  scheduleOnce(cb) { this._onceQ.push(cb); }
  // schedule 快轉：同步把 callback 跑 (repeat+1) 次
  schedule(cb, interval, repeat) {
    const n = (repeat == null ? 0 : repeat) + 1;
    for (let i = 0; i < n; i++) cb();
  }
  unschedule() {}
}

// tween：鏈式 API，start() 時同步觸發所有 .call() callback（把動畫快轉到結束）
class Tween {
  constructor(target) { this.target = target; this._calls = []; }
  to() { return this; }
  by() { return this; }
  delay() { return this; }
  call(cb) { this._calls.push(cb); return this; }
  union() { return this; }
  repeat() { return this; }
  sequence() { return this; }
  start() { this._calls.forEach(cb => cb()); return this; }
}
function tween(target) { return new Tween(target); }

function randomRangeInt(min, max) { return Math.floor(Math.random() * (max - min)) + min; }

const _decorator = { ccclass: (_name) => (target) => target, property: () => () => {} };

module.exports = {
  cc: {
    _decorator, Component, Label, Button, randomRangeInt,
    Node, UITransform, Color, EventHandler, Graphics,
    Mask, UIOpacity, tween, Vec3,
    // CC3 自訂 transform 會用到（保險起見也提供）
    cclegacy: { _RF: { push() {}, pop() {} } },
    __checkObsolete__: () => {},
    __checkObsoleteInNamespace__: () => {},
  },
  createdNodes,
  classes: { Node, Label, Button, Mask, UIOpacity, Graphics, UITransform },
};
