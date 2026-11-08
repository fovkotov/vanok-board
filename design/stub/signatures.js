(function () {
  var COLORS = [
    { name: 'pink', hex: '#ff91f8', cast: 0xff91f8 },
    { name: 'blue', hex: '#0c6df4', cast: 0x0c6df4 },
    { name: 'green', hex: '#67c514', cast: 0x67c514 }
  ];
  if (document.documentElement.getAttribute('data-seals') === 'pair') {
    COLORS = [
      { name: 'blue', hex: '#0A1AE9', cast: 0x0a1ae9 },
      { name: 'green', hex: '#8CC88C', cast: 0x8cc88c }
    ];
  }
  var KEY = 'vanok_signatures_v2';
  var POOL_KEY = 'vanok_signature_pool_v2';
  // serve.py answers /api/signatures locally; GitHub Pages is static, so the
  // live site shares one catalog through the Cloudflare worker in worker/.
  var LOCAL_HOST = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var SHARED_API = 'https://vanok-signatures.fovkotov.workers.dev/signatures';
  var API = LOCAL_HOST ? '/api/signatures' : SHARED_API;
  if (LOCAL_HOST) {
    var apiOverride = new URLSearchParams(location.search).get('sigapi');
    if (apiOverride) API = apiOverride;
  }
  var FILE_URL = 'design/stamps/custom-signatures.json';
  var PRESETS = [
    { id: 'preset-folder42-blue', kind: 'stamp', preset: true, text: 'Vanök Regular', src: 'design/stamps/folder-42/blue.png', colorName: 'blue', castHex: 0x0c6df4 },
    { id: 'preset-folder42-pink', kind: 'stamp', preset: true, text: 'Vanök Regular', src: 'design/stamps/folder-42/pink.png', colorName: 'pink', castHex: 0xff91f8 },
    { id: 'preset-folder42-gren', kind: 'apple', preset: true, text: 'Vanök Regular', src: 'design/stamps/folder-42/gren.png', colorName: 'green', castHex: 0x67c514 }
  ];
  if (document.documentElement.getAttribute('data-seals') === 'pair') {
    PRESETS = [
      { id: 'preset-classic-blue', kind: 'stamp', preset: true, text: 'Vanök Regular', src: 'design/stamps/classic/blue.webp', colorName: 'blue', castHex: 0x0a1ae9 },
      { id: 'preset-classic-gren', kind: 'apple', preset: true, text: 'Vanök Regular', src: 'design/stamps/classic/gren.webp', colorName: 'green', castHex: 0x8cc88c }
    ];
    // Extra library defaults for the classic page only. Lab keeps folder-42.
    // These live under templates/ so their blue.webp / gren.webp names stay
    // out of the random click pool (that pool keys off the stock basenames).
    [
      ['blue', 'stamp', 'blue', 0x0a1ae9],
      ['blue-1', 'stamp', 'blue', 0x0a1ae9],
      ['blue-2', 'stamp', 'blue', 0x0a1ae9],
      ['blue-3', 'stamp', 'blue', 0x0a1ae9],
      ['blue-4', 'stamp', 'blue', 0x0a1ae9],
      ['blue-5', 'stamp', 'blue', 0x0a1ae9],
      ['blue-6', 'stamp', 'blue', 0x0a1ae9],
      ['blue-7', 'stamp', 'blue', 0x0a1ae9],
      ['blue-8', 'stamp', 'blue', 0x0a1ae9],
      ['blue-9', 'stamp', 'blue', 0x0a1ae9],
      ['blue-10', 'stamp', 'blue', 0x0a1ae9],
      ['blue-11', 'stamp', 'blue', 0x0a1ae9],
      ['blue-12', 'stamp', 'blue', 0x0a1ae9],
      ['blue-13', 'stamp', 'blue', 0x0a1ae9],
      ['gren', 'apple', 'green', 0x8cc88c],
      ['gren-1', 'apple', 'green', 0x8cc88c],
      ['gren-2', 'apple', 'green', 0x8cc88c],
      ['gren-3', 'apple', 'green', 0x8cc88c],
      ['gren-4', 'apple', 'green', 0x8cc88c],
      ['gren-5', 'apple', 'green', 0x8cc88c],
      ['299gren', 'apple', 'green', 0x8cc88c],
      ['56-gren', 'apple', 'green', 0x8cc88c],
      ['56-gren-1', 'apple', 'green', 0x8cc88c],
      ['56-gren-2', 'apple', 'green', 0x8cc88c]
    ].forEach(function (row) {
      PRESETS.push({
        id: 'preset-classic-tpl-' + row[0],
        kind: row[1],
        preset: true,
        text: 'Vanök Regular',
        src: 'design/stamps/classic/templates/' + row[0] + '.webp',
        colorName: row[2],
        castHex: row[3]
      });
    });
  }
  var REMOVED_IDS = {
    'sig-mvyexo5j-xmsh': 1,
    'sig-mvyeparj-23ga': 1,
    'sig-mvspqm84-28xa': 1,
    'sig-mvyevic1-q47y': 1,
    'sig-mvyet5rf-cvjd': 1,
    'sig-mvjwhluk-rnq4': 1,
    'sig-mvipeu03-ril8': 1,
    'sig-mvipa8wh-qk2b': 1,
    'sig-mvioj76c-6nf4': 1,
    'sig-mvilqgeo-bzqn': 1,
    'sig-mvil8zgt-atu1': 1,
    'sig-mvijbazk-aqoh': 1,
    'sig-mvie2wct-9m0d': 1,
    'sig-mvsoe8zx-x29k': 1,
    'sig-mvliy3q0-h2te': 1,
    'sig-mvlix8p8-vjgh': 1,
    'sig-mvjwzlh2-7pu1': 1,
    'sig-mvjwevaw-74n1': 1,
    'sig-mvpnipgg-dbsd': 1,
    'preset-classic-tpl-gren-6': 1
  };
  var VB = {
    stamp: { w: 326, h: 326 },
    apple: { w: 500, h: 500 }
  };
  // On-screen template only. The apple body is 383.54 wide inside a 500 viewBox;
  // the circle's outer ring is 325.35 inside 326. This scale makes those outer
  // widths match. It does not change export viewBoxes or placed-stamp ink fractions.
  var APPLE_PREVIEW_SCALE = (325.349651 / 326) / (383.541548 / 500);

  // Ink stays inside the bold outer contour. The path is a clip only.
  var INK_CLIP = {
    stamp: { cx: 163.003, cy: 162.999, r: 159.096 },
    apple: 'M326.643 449.445C306.693 455.957 229.763 457.998 203.676 457.998C149.966 457.998 58.5273 361.65 58.5273 236.395C58.5273 148.298 127.477 118.207 159.703 118.207C191.929 118.207 221.232 125.113 247.319 125.113C248.698 125.113 250.107 125.1 251.539 125.074C271.782 124.715 296.658 121.948 307.168 120.517C355.828 113.892 437.158 128.315 441.828 223.937C447.638 342.921 346.593 442.934 326.643 449.445Z',
    appleStem: 'M226.488 39.2298C252.557 62.7219 254.009 99.7169 251.733 125.281C248.115 127.014 246.085 125.974 242.464 125.281C238.346 82.663 235.68 75.1234 203.159 57.6401C201.528 56.7629 201.093 54.6045 202.351 53.2446C207.849 47.3013 213.79 43.2895 223.396 38.7811C224.422 38.2996 225.646 38.4711 226.488 39.2298Z'
  };
  function clipDrawing(ctx, name) {
    if (name === 'stamp') {
      var c = INK_CLIP.stamp;
      ctx.beginPath();
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
      ctx.clip();
      return;
    }
    var path = new Path2D(INK_CLIP.apple);
    path.addPath(new Path2D(INK_CLIP.appleStem));
    ctx.clip(path);
  }
  function clipMarkup(name) {
    if (name === 'stamp') {
      var c = INK_CLIP.stamp;
      return '<clipPath id="sig-ink-clip"><circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/></clipPath>';
    }
    return '<clipPath id="sig-ink-clip"><path d="' + INK_CLIP.apple + '"/><path d="' + INK_CLIP.appleStem + '"/></clipPath>';
  }

  var items = [];
  var pending = null;
  var placed = { stamp: '', apple: '' };
  var kind = 'stamp';
  var colorIndex = document.documentElement.getAttribute('data-seals') === 'pair' ? 0 : 1;
  var texts = { stamp: '', apple: '' };
  var strokes = { stamp: [], apple: [] };
  var photos = { stamp: null, apple: null };
  var photoSources = { stamp: null, apple: null };
  var dither = { bias: -0.31, grain: 633 };
  var drawing = null;
  var photoPointers = [];
  var pinch = null;

  // Seals made before the shared catalog live in vanok_signatures_v1.
  // Read them first; drop the old key only after they are copied into v2.
  function readLegacy() {
    try {
      var raw = localStorage.getItem('vanok_signatures_v1');
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && (item.kind === 'stamp' || item.kind === 'apple') && typeof item.src === 'string' && item.id;
      });
    } catch (err) {
      return [];
    }
  }
  function forgetLegacy() {
    try {
      localStorage.removeItem('vanok_signatures_v1');
      localStorage.removeItem('vanok_signatures_v1_cleared');
      localStorage.removeItem('vanok_signature_pool_v1');
    } catch (err) {}
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(validItem);
    } catch (err) {
      return [];
    }
  }
  function validItem(item) {
    return item && (item.kind === 'stamp' || item.kind === 'apple') && typeof item.src === 'string' && item.id && !REMOVED_IDS[item.id];
  }
  function saveLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
      return true;
    } catch (err) {
      return false;
    }
  }
  function userItems() {
    return items.filter(function (item) { return !item.preset; });
  }
  var STOCK_FILES = {
    'blue.png': 1,
    'pink.png': 1,
    'gren.png': 1,
    'blue.webp': 1,
    'pink.webp': 1,
    'gren.webp': 1
  };
  var adopted = {};
  function fileName(src) {
    return String(src || '').split('/').pop().split('?')[0];
  }
  // Stock click stamps share basenames with the classic template folder.
  // A path under /templates/ is a library default, not a click-pool file.
  function isStockFile(src) {
    if (String(src || '').indexOf('/templates/') !== -1) return false;
    return !!STOCK_FILES[fileName(src)];
  }
  function listedSeal(item) {
    if (!item) return false;
    if (item.colorName === 'yellow') return false;
    var name = fileName(item.src || '');
    if (name === 'apple-281.png' || name === 'apple-282.png' || name === 'apple-283.png') return false;
    if (name === 'apple-03.png' || name === 'stamp-03.png') return false;
    return true;
  }
  function loadAdopted() {
    try {
      var raw = localStorage.getItem(POOL_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return;
      parsed.forEach(function (id) {
        var preset = null;
        for (var i = 0; i < PRESETS.length; i++) {
          if (PRESETS[i].id === id) preset = PRESETS[i];
        }
        if (preset && !isStockFile(preset.src)) adopted[id] = 1;
      });
    } catch (err) {}
  }
  function saveAdopted() {
    var ids = [];
    for (var id in adopted) if (adopted[id]) ids.push(id);
    try { localStorage.setItem(POOL_KEY, JSON.stringify(ids)); } catch (err) {}
  }
  function ensurePooled(item) {
    if (!item || !item.preset) return;
    if (isStockFile(item.src)) return;
    if (adopted[item.id]) return;
    adopted[item.id] = 1;
    saveAdopted();
  }

  var store = {
    pool: function (which) {
      var mine = userItems().filter(function (item) {
        return item.kind === which && listedSeal(item) && !REMOVED_IDS[item.id];
      });
      var extra = PRESETS.filter(function (item) {
        if (REMOVED_IDS[item.id]) return false;
        if (item.kind !== which) return false;
        if (isStockFile(item.src)) return true;
        return adopted[item.id] && listedSeal(item);
      });
      return mine.concat(extra);
    },
    peekNext: function () { return pending; },
    takeNext: function (which) {
      if (!pending || pending.kind !== which) return null;
      var item = pending;
      pending = null;
      return item;
    },
    lastPlaced: function (which) { return placed[which] || ''; },
    rememberPlaced: function (which, id) { placed[which] = id; },
    placeKey: function (item) {
      if (!item) return '';
      if (item.preset && isStockFile(item.src)) return fileName(item.src);
      return item.id || '';
    },
    arm: function (item) { pending = item; },
    // Same list the library shows. Classic clicks draw from this.
    // pool() stays the stock pair so lab and the tool tint do not change.
    catalog: function () { return catalog(); }
  };
  window.VanokSignatures = store;

  var launchers = Array.prototype.slice.call(document.querySelectorAll('.draw-sig-btn, .catalog-entry'));
  var modal = document.createElement('div');
  modal.className = 'sig-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="sig-editor" inert>' +
      '<div class="sig-head"><div class="sig-head-side">' +
        '<button type="button" class="sig-back" aria-label="Back"></button>' +
        '<p class="sig-title">Draw Signature</p>' +
      '</div><button type="button" class="sig-close" aria-label="Close"></button></div>' +
      '<div class="sig-stage">' +
          slideMarkup('stamp', 'design/stub/seal-circle-rings.svg', '0 0 326 326',
            'M297 163 A134 134 0 0 0 29 163 A134 134 0 0 0 296.99 163', '8') +
          slideMarkup('apple', 'design/stub/seal-apple-rings.svg', '0 0 500 500',
            'M266.884 445.246C242.099 446.559 216.543 447.065 203.69 447.065C193.295 447.065 179.66 442.281 164.501 431.951C149.526 421.746 133.912 406.69 119.739 387.644C91.3849 349.543 69.4688 296.394 69.4688 236.416C69.4688 195.565 85.3113 169.004 104.231 152.515C123.581 135.651 146.348 129.148 159.728 129.148C175.121 129.148 189.918 130.797 204.548 132.525C218.94 134.225 233.501 136.052 247.325 136.052C248.773 136.052 250.247 136.039 251.737 136.012C272.584 135.642 297.929 132.814 308.63 131.357C331.484 128.246 361.427 130.223 385.745 143.49C409.281 156.33 428.751 180.338 430.907 224.492C433.658 280.805 411.088 333.238 384.79 372.825C371.69 392.544 357.839 408.806 346.159 420.45C340.681 425.911 335.758 430.278 331.692 433.477L330.891 434.101C328.724 435.77 326.953 436.982 325.593 437.813C324.517 438.471 323.827 438.809 323.481 438.96L323.247 439.053C319.478 440.282 311.984 441.547 301.522 442.657C291.366 443.736 279.277 444.589 266.884 445.246Z',
            '42%') +
      '</div>' +
      '<div class="sig-swatches"></div>' +
      '<div class="sig-bar">' +
        '<button type="button" class="sig-upload"><span class="sig-upload-mark" aria-hidden="true"></span>Upload Image</button>' +
        '<button type="button" class="sig-create">Create Signature<span class="sig-create-mark" aria-hidden="true"></span></button>' +
        '<input class="sig-file" type="file" accept="image/*" tabindex="-1" aria-hidden="true">' +
      '</div>' +
      '<input id="sig-input" class="sig-input" type="text" maxlength="160" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Signature text">' +
    '</div>' +
    '<div class="sig-shapes" inert>' +
      '<div class="sig-head"><div class="sig-head-side">' +
        '<button type="button" class="sig-back" aria-label="Back"></button>' +
        '<p class="sig-title">Choose form</p>' +
      '</div><button type="button" class="sig-close" aria-label="Close"></button></div>' +
      '<button type="button" class="sig-shape" data-kind="stamp" aria-label="Circle"><span class="sig-shape-art" style="-webkit-mask:url(design/stub/seal-circle-rings.svg) center / 100% 100% no-repeat;mask:url(design/stub/seal-circle-rings.svg) center / 100% 100% no-repeat"></span></button>' +
      '<button type="button" class="sig-shape" data-kind="apple" aria-label="Apple"><span class="sig-shape-art" style="-webkit-mask:url(design/stub/seal-apple-rings.svg) center / 100% 100% no-repeat;mask:url(design/stub/seal-apple-rings.svg) center / 100% 100% no-repeat"></span></button>' +
    '</div>' +
    '<div class="sig-library" inert>' +
      '<div class="sig-head">' +
        '<p class="sig-title">Signature Library</p>' +
        '<button type="button" class="sig-close" aria-label="Close"></button>' +
      '</div>' +
      '<div class="sig-grid"></div>' +
    '</div>';
  document.body.appendChild(modal);
  var applePreview = document.createElement('style');
  applePreview.textContent =
    '.sig-slide[data-kind="apple"] .sig-seal{transform:translate(-50%,-50%) scale(' + APPLE_PREVIEW_SCALE + ')}' +
    '.sig-slide[data-kind="apple"] text{font-size:' + (13 * (VB.apple.w / 326) / APPLE_PREVIEW_SCALE) + 'px;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    '.sig-shape[data-kind="apple"] .sig-shape-art{transform:scale(' + APPLE_PREVIEW_SCALE + ');transform-origin:center}';
  document.head.appendChild(applePreview);

  function slideMarkup(name, src, viewBox, path, offset) {
    var mask = 'url(' + src + ') center / 100% 100% no-repeat';
    return '<div class="sig-slide' + (name === 'stamp' ? ' is-on' : '') + '" data-kind="' + name + '">' +
      '<div class="sig-seal">' +
        '<div class="sig-rings" style="-webkit-mask:' + mask + ';mask:' + mask + '"></div>' +
        '<svg viewBox="' + viewBox + '" aria-hidden="true">' +
          '<path id="sig-path-' + name + '" d="' + path + '" fill="none"/>' +
          '<text text-anchor="start" fill="#0c6df4">' +
            '<textPath href="#sig-path-' + name + '" startOffset="' + offset + '">Type Here...</textPath>' +
          '</text>' +
          '<text class="sig-probe" x="0" y="24" fill="transparent" aria-hidden="true">Mg</text>' +
          '<line class="sig-caret" x1="0" y1="-7" x2="0" y2="5" stroke-width="1.4" stroke-linecap="round"></line>' +
        '</svg>' +
      '</div>' +
      '<canvas></canvas>' +
    '</div>';
  }

  var editor = modal.querySelector('.sig-editor');
  var shapes = modal.querySelector('.sig-shapes');
  var library = modal.querySelector('.sig-library');
  var input = modal.querySelector('.sig-input');
  var grid = modal.querySelector('.sig-grid');
  var swatches = modal.querySelector('.sig-swatches');

  COLORS.forEach(function (color, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.style.background = color.hex;
    button.setAttribute('aria-label', color.name);
    if (index === colorIndex) button.className = 'on';
    button.addEventListener('click', function () {
      colorIndex = index;
      paintSwatches();
      applyInk();
    });
    swatches.appendChild(button);
  });

  function paintSwatches() {
    var buttons = swatches.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle('on', i === colorIndex);
  }
  function selectedColor() { return COLORS[colorIndex]; }

  var editing = false;

  function paintText() {
    ['stamp', 'apple'].forEach(function (name) {
      var path = document.getElementById('sig-path-' + name);
      if (!path) return;
      var text = path.parentNode.querySelector('text');
      var node = path.parentNode.querySelector('textPath');
      var value = texts[name];
      var placeholder = !value && !(editing && name === kind);
      node.textContent = placeholder ? 'Type Here...' : (value || '');
      text.setAttribute('fill', selectedColor().hex);
      text.setAttribute('fill-opacity', placeholder ? '0.45' : '1');
    });
  }
  function textWidth(value, fontPx) {
    if (!value) return 0;
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = (fontPx || 13) + 'px Arial, Helvetica, sans-serif';
    return ctx.measureText(value).width;
  }
  function placeCaret() {
    ['stamp', 'apple'].forEach(function (name) {
      var caret = document.querySelector('.sig-slide[data-kind="' + name + '"] .sig-caret');
      if (!caret) return;
      if (!editing || name !== kind) {
        caret.classList.remove('is-on');
        return;
      }
      var path = document.getElementById('sig-path-' + name);
      var value = texts[name] || '';
      var index = input.selectionStart == null ? value.length : input.selectionStart;
      var length = path.getTotalLength();
      var fontPx = 13;
      if (name === 'apple') {
        var caption = path.parentNode.querySelector('text');
        if (caption) fontPx = parseFloat(window.getComputedStyle(caption).fontSize) || fontPx;
      }
      var advance = textWidth(value.slice(0, index), fontPx);
      var raw = pathStart(path) + advance;
      var offset = ((raw % length) + length) % length;
      var point = path.getPointAtLength(offset);
      var ahead = path.getPointAtLength(Math.min(offset + 1, path.getTotalLength()));
      var angle = Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180 / Math.PI;
      caret.setAttribute('transform', 'translate(' + point.x + ' ' + point.y + ') rotate(' + angle + ')');
      caret.setAttribute('stroke', selectedColor().hex);
      caret.classList.add('is-on');
    });
  }
  // iOS Safari shows the keyboard only when the touch lands on a real field:
  // hit-testable (not pointer-events:none), font-size >= 16px, inside the
  // visual viewport, focused by the gesture itself. preventDefault on that
  // touch cancels it. Clip the field to the seal's text band so the canvas
  // still receives drawing hits inside the shape.
  var dismissEdit = false;
  var editingLock = false;
  function ringClip(w, h) {
    var cx = w / 2;
    var cy = h / 2;
    function ellipse(rx, ry, sweep) {
      return 'M ' + (cx - rx).toFixed(2) + ' ' + cy.toFixed(2) +
        ' a ' + rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 1 ' + sweep + ' ' + (2 * rx).toFixed(2) + ' 0' +
        ' a ' + rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 1 ' + sweep + ' ' + (-2 * rx).toFixed(2) + ' 0 Z';
    }
    // Opposite winding so the hole survives evenodd and nonzero.
    return 'path(evenodd, "' + ellipse(152 * w / 326, 152 * h / 326, 1) + ' ' + ellipse(120 * w / 326, 120 * h / 326, 0) + '")';
  }
  function appleClip(rect) {
    var pts = appleHitLoop;
    var half = 18 * (VB.apple.w / 323.17) + (appleInset || 0);
    if (!pts || pts.length < 8) {
      var path = document.getElementById('sig-path-apple');
      var length = path && path.getTotalLength();
      if (!length) return ringClip(rect.width, rect.height);
      var step = Math.max(8, length / 90);
      pts = [];
      for (var d = 0; d < length; d += step) pts.push(path.getPointAtLength(d));
    }
    var sx = rect.width / VB.apple.w;
    var sy = rect.height / VB.apple.h;
    var left = [];
    var right = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var q = pts[(i + 1) % pts.length];
      var dx = q.x - p.x;
      var dy = q.y - p.y;
      var mag = Math.hypot(dx, dy) || 1;
      var nx = -dy / mag * half;
      var ny = dx / mag * half;
      left.push([(p.x + nx) * sx, (p.y + ny) * sy]);
      right.push([(p.x - nx) * sx, (p.y - ny) * sy]);
    }
    var poly = left.concat(right.reverse());
    if (poly.length < 3) return 'none';
    var dAttr = 'M ' + poly[0][0].toFixed(1) + ' ' + poly[0][1].toFixed(1);
    for (var n = 1; n < poly.length; n++) dAttr += ' L ' + poly[n][0].toFixed(1) + ' ' + poly[n][1].toFixed(1);
    return 'path("' + dAttr + ' Z")';
  }
  function armInput() {
    if (modal.hidden || !editor.classList.contains('is-on')) {
      input.style.pointerEvents = 'none';
      input.style.clipPath = '';
      return;
    }
    var seal = modal.querySelector('.sig-slide[data-kind="' + kind + '"] .sig-seal');
    if (!seal) return;
    var rect = seal.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    input.style.pointerEvents = 'auto';
    input.style.opacity = '1';
    input.style.fontSize = '16px';
    input.style.left = rect.left + 'px';
    input.style.top = rect.top + 'px';
    input.style.width = rect.width + 'px';
    input.style.height = rect.height + 'px';
    var clip = kind === 'apple' ? appleClip(rect) : ringClip(rect.width, rect.height);
    input.style.clipPath = clip;
    input.style.webkitClipPath = clip;
    var vv = window.visualViewport;
    if (document.activeElement === input && vv) {
      var bottom = vv.offsetTop + vv.height;
      var overlap = Math.min(rect.bottom, bottom) - Math.max(rect.top, vv.offsetTop);
      if (overlap < 24) {
        input.style.clipPath = 'none';
        input.style.webkitClipPath = 'none';
        input.style.top = (vv.offsetTop + 4) + 'px';
        input.style.left = (vv.offsetLeft + Math.max(0, (vv.width - 48) / 2)) + 'px';
        input.style.width = '48px';
        input.style.height = '24px';
      }
    }
  }
  function pinInput() { armInput(); }
  function trackInput() {
    if (!modal.hidden && editor.classList.contains('is-on')) armInput();
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', trackInput);
    window.visualViewport.addEventListener('scroll', trackInput);
  }
  // Chrome scales SVG font-size px by the viewBox and by the apple seal's
  // CSS scale, so the stylesheet size already matches the circle. Safari
  // does not (text-size-adjust, or the scale applied once too often). Measure
  // a horizontal "Mg" on both seals and correct only the apple.
  function paintedLetterHeight(slide) {
    var probe = slide.querySelector('.sig-probe');
    if (!probe) return 0;
    var boxH = 0;
    var extH = 0;
    try {
      var box = probe.getBoundingClientRect();
      boxH = box.height || 0;
      var ext = probe.getExtentOfChar(0);
      var ctm = probe.getScreenCTM();
      if (ext && ctm && ext.height) extH = ext.height * Math.hypot(ctm.c, ctm.d);
    } catch (err) {}
    if (boxH > 0.5) return boxH;
    return extH;
  }
  function matchAppleLetterHeight() {
    var stampSlide = modal.querySelector('.sig-slide[data-kind="stamp"]');
    var appleSlide = modal.querySelector('.sig-slide[data-kind="apple"]');
    if (!stampSlide || !appleSlide) return null;
    var hidden = [];
    [stampSlide, appleSlide].forEach(function (slide) {
      if (getComputedStyle(slide).display === 'none') {
        slide.style.display = 'block';
        hidden.push(slide);
      }
    });
    var result = null;
    try {
      var nodes = appleSlide.querySelectorAll('text');
      for (var i = 0; i < nodes.length; i++) nodes[i].style.fontSize = '';
      void appleSlide.offsetWidth;
      var stampH = paintedLetterHeight(stampSlide);
      var appleH = paintedLetterHeight(appleSlide);
      var guard = 0;
      while (stampH > 0.5 && appleH > 0.5 && Math.abs(stampH - appleH) / stampH > 0.02 && guard < 4) {
        guard += 1;
        var probe = appleSlide.querySelector('.sig-probe');
        var current = parseFloat(window.getComputedStyle(probe).fontSize) || 0;
        if (!(current > 0)) break;
        var next = current * (stampH / appleH);
        for (var n = 0; n < nodes.length; n++) nodes[n].style.fontSize = next + 'px';
        void appleSlide.offsetWidth;
        var again = paintedLetterHeight(appleSlide);
        if (!(again > 0.5) || Math.abs(again - appleH) < 0.25) break;
        appleH = again;
      }
      result = { stampH: stampH, appleH: appleH };
    } finally {
      hidden.forEach(function (slide) { slide.style.display = ''; });
    }
    return result;
  }
  function enterEdit() {
    var entering = !editing;
    editing = true;
    dismissEdit = false;
    if (entering) {
      editingLock = true;
      var next = texts[kind] || '';
      if (input.value !== next) input.value = next;
      clearTimeout(beginEdit.timer);
      beginEdit.timer = setTimeout(function () { editingLock = false; }, 800);
    }
    paintText();
    var caption = modal.querySelector('.sig-slide[data-kind="' + kind + '"] text');
    if (caption) caption.style.visibility = '';
    placeCaret();
  }
  function beginEdit() {
    enterEdit();
    if (document.activeElement === input) return;
    try { input.focus({ preventScroll: true }); }
    catch (err) { input.focus(); }
  }
  function paintRings() {
    var hex = selectedColor().hex;
    modal.querySelectorAll('.sig-rings').forEach(function (el) { el.style.background = hex; });
  }
  function hexToRgb(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function ditherImage(img) {
    var maxSide = dither.grain;
    var scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
    var w = Math.max(1, Math.round(img.width * scale));
    var h = Math.max(1, Math.round(img.height * scale));
    var sample = document.createElement('canvas');
    sample.width = w;
    sample.height = h;
    var ctx = sample.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;
    var mask = new Uint8Array(w * h);
    var bias = dither.bias;
    for (var i = 0; i < w * h; i++) {
      var o = i * 4;
      var lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) * (data[o + 3] / 255);
      var chance = lum / 255;
      if (bias) chance = Math.min(1, Math.max(0, chance + bias));
      mask[i] = Math.random() < chance ? 1 : 0;
    }
    return { mask: mask, w: w, h: h };
  }
  function tintPhoto(photo, hex) {
    var canvas = document.createElement('canvas');
    canvas.width = photo.w;
    canvas.height = photo.h;
    var ctx = canvas.getContext('2d');
    var image = ctx.createImageData(photo.w, photo.h);
    var rgb = hexToRgb(hex);
    var out = image.data;
    for (var i = 0; i < photo.mask.length; i++) {
      if (!photo.mask[i]) continue;
      var o = i * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    photo.tinted = canvas;
  }
  function placePhoto(name, img) {
    photoSources[name] = img;
    var dithered = ditherImage(img);
    var vb = VB[name];
    var photo = {
      mask: dithered.mask,
      w: dithered.w,
      h: dithered.h,
      userScale: 1,
      cx: vb.w / 2,
      cy: vb.h / 2,
      fit: Math.max(vb.w / dithered.w, vb.h / dithered.h)
    };
    tintPhoto(photo, selectedColor().hex);
    photos[name] = photo;
    redraw(name);
  }
  function reditherPhoto(name) {
    var img = photoSources[name];
    var photo = photos[name];
    if (!img || !photo) return;
    var dithered = ditherImage(img);
    var vb = VB[name];
    photo.mask = dithered.mask;
    photo.w = dithered.w;
    photo.h = dithered.h;
    photo.fit = Math.max(vb.w / dithered.w, vb.h / dithered.h);
    tintPhoto(photo, selectedColor().hex);
    redraw(name);
  }
  function setDither(next) {
    if (next) {
      if (typeof next.bias === 'number' && isFinite(next.bias)) {
        dither.bias = Math.abs(next.bias) < 1e-6 ? 0 : next.bias;
      }
      if (typeof next.grain === 'number' && isFinite(next.grain)) dither.grain = next.grain;
      reditherPhoto('stamp');
      reditherPhoto('apple');
    }
    return { bias: dither.bias, grain: dither.grain };
  }
  store.setDither = setDither;
  function scalePhoto(name, photo, next, anchor) {
    next = Math.max(0.35, Math.min(6, next));
    var k = next / photo.userScale;
    if (anchor) {
      photo.cx = anchor.x - (anchor.x - photo.cx) * k;
      photo.cy = anchor.y - (anchor.y - photo.cy) * k;
    }
    photo.userScale = next;
    redraw(name);
  }
  function drawPhoto(ctx, name) {
    var photo = photos[name];
    if (!photo || !photo.tinted) return;
    var dw = photo.w * photo.fit * photo.userScale;
    var dh = photo.h * photo.fit * photo.userScale;
    ctx.drawImage(photo.tinted, photo.cx - dw / 2, photo.cy - dh / 2, dw, dh);
  }
  function applyInk() {
    var hex = selectedColor().hex;
    ['stamp', 'apple'].forEach(function (name) {
      strokes[name].forEach(function (stroke) { stroke.color = hex; });
      if (photos[name]) tintPhoto(photos[name], hex);
      redraw(name);
    });
    paintText();
    paintRings();
    placeCaret();
  }

  function canvasOf(name) {
    return modal.querySelector('.sig-slide[data-kind="' + name + '"] canvas');
  }
  function redraw(name) {
    var canvas = canvasOf(name);
    var seal = canvas.parentNode.querySelector('.sig-seal');
    var vb = VB[name];
    var ctx = canvas.getContext('2d');
    var canvasRect = canvas.getBoundingClientRect();
    var sealRect = seal.getBoundingClientRect();
    var unit = 2;
    var originX = 0;
    var originY = 0;
    if (canvasRect.width > 2 && sealRect.width > 2) {
      var dpr = 2;
      canvas.width = Math.round(canvasRect.width * dpr);
      canvas.height = Math.round(canvasRect.height * dpr);
      var px = canvas.width / canvasRect.width;
      unit = px * (sealRect.width / vb.w);
      originX = (sealRect.left - canvasRect.left) * px;
      originY = (sealRect.top - canvasRect.top) * (canvas.height / canvasRect.height);
      ctx.setTransform(unit, 0, 0, unit, originX, originY);
      ctx.clearRect(-originX / unit - 20, -originY / unit - 20, canvas.width / unit + 40, canvas.height / unit + 40);
    } else {
      canvas.width = Math.round(vb.w * 2);
      canvas.height = Math.round(vb.h * 2);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, vb.w, vb.h);
    }
    ctx.save();
    clipDrawing(ctx, name);
    drawPhoto(ctx, name);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = name === 'apple' ? 2.6 * (VB.apple.w / 323.17) : 2.6;
    strokes[name].forEach(function (stroke) {
      if (!stroke.points.length) return;
      ctx.strokeStyle = stroke.color;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (var i = 1; i < stroke.points.length - 1; i++) {
        var a = stroke.points[i];
        var b = stroke.points[i + 1];
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      var last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    });
    ctx.restore();
  }
  applyInk();

  function zone(name, point) {
    if (name === 'stamp') {
      var d = Math.hypot(point.x - 163, point.y - 163);
      if (d >= 120 && d < 152) return 'text';
      return 'draw';
    }
    if (nearPath(document.getElementById('sig-path-apple'), point, 18 * (VB.apple.w / 323.17) + appleInset)) return 'text';
    return 'draw';
  }
  function pathStart(path) {
    var node = path.parentNode.querySelector('textPath');
    var offset = node.getAttribute('startOffset') || '0';
    var length = path.getTotalLength();
    if (String(offset).indexOf('%') >= 0) return length * parseFloat(offset) / 100;
    return parseFloat(offset) || 0;
  }
  function nearPath(path, point, maxDist) {
    if (!path) return false;
    var length = path.getTotalLength();
    var best = 1e9;
    for (var d = 0; d <= length; d += 6) {
      var p = path.getPointAtLength(d);
      var dist = Math.hypot(p.x - point.x, p.y - point.y);
      if (dist < best) best = dist;
    }
    return best <= maxDist;
  }
  function pointOf(event, canvas, name) {
    var seal = canvas.parentNode.querySelector('.sig-seal');
    var rect = seal.getBoundingClientRect();
    var vb = VB[name];
    return {
      x: (event.clientX - rect.left) / Math.max(rect.width, 1) * vb.w,
      y: (event.clientY - rect.top) / Math.max(rect.height, 1) * vb.h
    };
  }

  // The apple letters sit on the inner contour and spill onto the stroke.
  // Pull that arc inward by one line of the current type, so the text
  // follows the outline one line away from the edge.
  var appleTextPath = '';
  var appleInset = 0;
  var appleHitLoop = null;
  function appleTextInset() {
    var svg = document.querySelector('.sig-slide[data-kind="apple"] svg');
    if (!svg || !svg.clientWidth) return 0;
    // One line at the 326-wide seal, in viewBox units. A live pixel inset
    // would stay put while the shape grows with the screen.
    return 13 * VB.apple.w / 326;
  }
  function refitAppleText() {
    var path = document.getElementById('sig-path-apple');
    if (!path) return;
    if (!appleTextPath) appleTextPath = path.getAttribute('d');
    var dist = appleTextInset();
    appleInset = dist;
    path.setAttribute('d', appleTextPath);
    if (!dist) {
      appleHitLoop = null;
      matchAppleLetterHeight();
      return;
    }
    var length = path.getTotalLength();
    var step = 4;
    var pts = [];
    for (var d = 0; d < length; d += step) pts.push(path.getPointAtLength(d));
    var cx = 0;
    var cy = 0;
    for (var c = 0; c < pts.length; c++) { cx += pts[c].x; cy += pts[c].y; }
    cx /= pts.length;
    cy /= pts.length;
    var top = 0;
    for (var i = 1; i < pts.length; i++) if (pts[i].y < pts[top].y) top = i;
    var after = pts[(top + 1) % pts.length];
    var toward = (-(after.y - pts[top].y)) * (cx - pts[top].x) + (after.x - pts[top].x) * (cy - pts[top].y);
    var sign = toward >= 0 ? 1 : -1;
    var span = 8;
    var out = [];
    for (var j = 0; j < pts.length; j++) {
      var before = pts[(j - span + pts.length) % pts.length];
      var afterPt = pts[(j + span) % pts.length];
      var dx = afterPt.x - before.x;
      var dy = afterPt.y - before.y;
      var mag = Math.hypot(dx, dy) || 1;
      out.push({
        x: pts[j].x + (-dy / mag) * dist * sign,
        y: pts[j].y + (dx / mag) * dist * sign
      });
    }
    out = dropOffsetLoops(out);
    // Text starts on the upper-left of the top arc. The contour used to end
    // back at the bottom, so a long string piled up there and never climbed
    // the left side. Spin the loop so that start is index 0, then trace it
    // again so the letters can continue all the way around.
    var startAt = Math.round(out.length * 0.42) % out.length;
    var spun = out.slice(startAt).concat(out.slice(0, startAt));
    var chain = [];
    for (var lap = 0; lap < 3; lap++) {
      for (var n = 0; n < spun.length; n++) chain.push(spun[n]);
    }
    var dAttr = 'M' + chain[0].x.toFixed(2) + ' ' + chain[0].y.toFixed(2);
    for (var k = 1; k < chain.length; k++) dAttr += 'L' + chain[k].x.toFixed(2) + ' ' + chain[k].y.toFixed(2);
    path.setAttribute('d', dAttr);
    appleHitLoop = spun;
    var textPath = path.parentNode.querySelector('textPath');
    if (textPath) textPath.setAttribute('startOffset', '0');
    matchAppleLetterHeight();
  }
  function segmentsCross(a, b, c, d) {
    function side(p, q, r) {
      return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    }
    var c1 = side(a, b, c);
    var c2 = side(a, b, d);
    var c3 = side(c, d, a);
    var c4 = side(c, d, b);
    return ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) &&
      ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0));
  }
  // An inward offset folds at the apple's bottom notch. That fold eats the
  // rest of the string, so letters never reach the left side.
  function dropOffsetLoops(pts) {
    var out = pts.slice();
    var guard = 0;
    var changed = true;
    while (changed && guard < 12 && out.length > 8) {
      changed = false;
      guard += 1;
      hunt: for (var i = 0; i < out.length; i++) {
        var a = out[i];
        var b = out[(i + 1) % out.length];
        for (var k = i + 2; k < out.length; k++) {
          if ((k + 1) % out.length === i) continue;
          var c = out[k];
          var d = out[(k + 1) % out.length];
          if (!segmentsCross(a, b, c, d)) continue;
          var forward = k - i;
          var back = out.length - forward;
          if (forward <= back) out.splice(i + 1, forward);
          else out = out.slice(i + 1, k + 1);
          changed = true;
          break hunt;
        }
      }
    }
    return out;
  }
  function showKind(next) {
    var nextKind = next === 'apple' ? 'apple' : 'stamp';
    if (nextKind !== kind) editing = false;
    kind = nextKind;
    modal.querySelectorAll('.sig-slide').forEach(function (slide) {
      slide.classList.toggle('is-on', slide.dataset.kind === kind);
    });
    if (kind === 'apple') refitAppleText();
    else matchAppleLetterHeight();
    input.value = texts[kind] || '';
    paintText();
    placeCaret();
    armInput();
  }
  window.addEventListener('resize', function () {
    if (modal.hidden) return;
    if (kind === 'apple') refitAppleText();
    else matchAppleLetterHeight();
    placeCaret();
    armInput();
  });

  var swipe = null;
  function rememberPointer(event) {
    for (var i = 0; i < photoPointers.length; i++) {
      if (photoPointers[i].id === event.pointerId) {
        photoPointers[i].x = event.clientX;
        photoPointers[i].y = event.clientY;
        return;
      }
    }
    photoPointers.push({ id: event.pointerId, x: event.clientX, y: event.clientY });
  }
  function forgetPointer(id) {
    photoPointers = photoPointers.filter(function (pointer) { return pointer.id !== id; });
    if (photoPointers.length < 2) pinch = null;
  }
  modal.querySelectorAll('.sig-slide canvas').forEach(function (canvas) {
    canvas.addEventListener('pointerdown', function (event) {
      if (!editor.classList.contains('is-on')) return;
      var name = canvas.parentNode.dataset.kind;
      if (name !== kind) return;
      var point = pointOf(event, canvas, name);
      var hit = zone(name, point);
      if (hit === 'text') {
        if (event.pointerType !== 'mouse') {
          swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, name: name, point: point, hit: 'text', moved: false };
          beginEdit();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        beginEdit();
        return;
      }
      rememberPointer(event);
      if (photos[name] && photoPointers.length >= 2) {
        if (drawing) {
          strokes[name].pop();
          drawing = null;
          redraw(name);
        }
        var a = photoPointers[0];
        var b = photoPointers[1];
        pinch = {
          name: name,
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          scale: photos[name].userScale,
          cx: photos[name].cx,
          cy: photos[name].cy,
          mx: (a.x + b.x) / 2,
          my: (a.y + b.y) / 2
        };
        swipe = { id: event.pointerId, name: name, hit: 'pinch', moved: true };
        event.preventDefault();
        return;
      }
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, name: name, point: point, hit: hit, moved: false };
      if (hit === 'draw') {
        drawing = { color: selectedColor().hex, points: [point] };
        strokes[name].push(drawing);
        canvas.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', function (event) {
      rememberPointer(event);
      if (pinch && photos[pinch.name] && photoPointers.length >= 2) {
        var a = photoPointers[0];
        var b = photoPointers[1];
        var photo = photos[pinch.name];
        var dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var next = Math.max(0.35, Math.min(6, pinch.scale * dist / pinch.dist));
        var seal = canvas.parentNode.querySelector('.sig-seal');
        var rect = seal.getBoundingClientRect();
        var vb = VB[pinch.name];
        var mx = (a.x + b.x) / 2;
        var my = (a.y + b.y) / 2;
        photo.userScale = next;
        photo.cx = pinch.cx + (mx - pinch.mx) / Math.max(rect.width, 1) * vb.w;
        photo.cy = pinch.cy + (my - pinch.my) / Math.max(rect.height, 1) * vb.h;
        redraw(pinch.name);
        event.preventDefault();
        return;
      }
      if (!swipe || event.pointerId !== swipe.id) return;
      var dx = event.clientX - swipe.x;
      var dy = event.clientY - swipe.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) swipe.moved = true;
      if (swipe.hit === 'text') return;
      if (drawing && swipe.hit === 'draw') {
        drawing.points.push(pointOf(event, canvas, swipe.name));
        redraw(swipe.name);
      }
      event.preventDefault();
    });
    function finish(event) {
      forgetPointer(event.pointerId);
      if (!swipe || event.pointerId !== swipe.id) return;
      var was = swipe;
      if (was.hit === 'draw' && drawing && drawing.points.length < 2 && !was.moved) {
        strokes[was.name].pop();
        redraw(was.name);
      }
      drawing = null;
      swipe = null;
      if (was.hit === 'text' && !was.moved) beginEdit();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('wheel', function (event) {
      var name = canvas.parentNode.dataset.kind;
      var photo = photos[name];
      if (!photo || !editor.classList.contains('is-on') || name !== kind) return;
      event.preventDefault();
      var point = pointOf(event, canvas, name);
      var next = photo.userScale * Math.exp(-event.deltaY * 0.0012);
      scalePhoto(name, photo, next, point);
    }, { passive: false });
  });

  function syncFromInput() {
    texts[kind] = input.value.slice(0, 160);
    paintText();
    placeCaret();
  }
  input.addEventListener('input', syncFromInput);
  input.addEventListener('keyup', placeCaret);
  input.addEventListener('click', placeCaret);
  input.addEventListener('focus', function () {
    if (!editor.classList.contains('is-on')) return;
    enterEdit();
  });
  input.addEventListener('touchend', function () {
    if (!editor.classList.contains('is-on')) return;
    if (document.activeElement !== input) beginEdit();
  });
  input.addEventListener('blur', function () {
    if (editingLock && !dismissEdit) {
      armInput();
      try { input.focus({ preventScroll: true }); }
      catch (err) { input.focus(); }
      return;
    }
    dismissEdit = false;
    editing = false;
    editingLock = false;
    paintText();
    placeCaret();
  });
  document.addEventListener('pointerdown', function (event) {
    var t = event.target;
    if (t && t.closest && t.closest('.sig-input')) {
      dismissEdit = false;
      return;
    }
    dismissEdit = true;
  }, true);
  document.addEventListener('selectionchange', function () {
    if (document.activeElement === input) placeCaret();
  });
  modal.querySelectorAll('.sig-slide svg text').forEach(function (node) {
    node.style.cursor = 'text';
    node.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse') {
        event.preventDefault();
        event.stopPropagation();
      }
      beginEdit();
    });
  });

  function leaveDraw() {
    editing = false;
    editingLock = false;
    clearTimeout(beginEdit.timer);
    paintText();
    placeCaret();
    try { input.blur(); } catch (err) {}
  }
  function holdLauncher(held) {
    for (var i = 0; i < launchers.length; i++) launchers[i].classList.toggle('is-held', held);
  }
  function motionOff() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  var modalGen = 0;
  function setScreen(name) {
    var map = { library: library, shapes: shapes, editor: editor };
    Object.keys(map).forEach(function (key) {
      var el = map[key];
      var on = key === name;
      el.classList.toggle('is-on', on);
      if (on) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
  }
  function revealModal() {
    modalGen += 1;
    modal.hidden = false;
    holdLauncher(true);
    modal.classList.add('is-open');
  }
  function openEditor(nextKind) {
    leaveDraw();
    setScreen('editor');
    revealModal();
    showKind(nextKind || kind);
    armInput();
    requestAnimationFrame(function () {
      redraw('stamp');
      redraw('apple');
      if (kind === 'apple') refitAppleText();
      else matchAppleLetterHeight();
      placeCaret();
      armInput();
    });
  }
  function openShapes() {
    clearFlight();
    leaveDraw();
    setScreen('shapes');
    revealModal();
  }
  function openLibrary(freshId) {
    var from = null;
    if (freshId) {
      var seal = modal.querySelector('.sig-slide[data-kind="' + kind + '"] .sig-seal');
      if (seal) from = seal.getBoundingClientRect();
    }
    clearFlight();
    leaveDraw();
    setScreen('library');
    revealModal();
    grid.scrollTop = 0;
    renderGrid(freshId, from);
  }
  function closeModal(done) {
    clearFlight();
    leaveDraw();
    holdLauncher(false);
    if (modal.hidden) {
      if (typeof done === 'function') done();
      return;
    }
    var gen = modalGen;
    var settled = false;
    modal.classList.remove('is-open');
    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      modal.removeEventListener('transitionend', onEnd);
      if (gen !== modalGen) return;
      modal.hidden = true;
      if (typeof done === 'function') done();
    }
    var fadeMs = 0;
    try {
      var styles = window.getComputedStyle(modal);
      var props = (styles.transitionProperty || '').split(',');
      var durs = (styles.transitionDuration || '').split(',');
      for (var i = 0; i < props.length; i++) {
        var prop = props[i].trim();
        if (prop !== 'opacity' && prop !== 'all') continue;
        var raw = (durs[i] || durs[0] || '0s').trim();
        var n = parseFloat(raw);
        if (!n) continue;
        fadeMs = Math.max(fadeMs, raw.slice(-2) === 'ms' ? n : n * 1000);
      }
    } catch (err) {}
    if (!fadeMs || motionOff()) {
      finish();
      return;
    }
    var timer = setTimeout(finish, fadeMs + 80);
    function onEnd(event) {
      if (event.target !== modal || event.propertyName !== 'opacity') return;
      finish();
    }
    modal.addEventListener('transitionend', onEnd);
  }
  // Create Signature closes the sheet, then the new seal draws in at the
  // center through the same placeInk path as a click. Library picks still
  // stamp where placeLibrarySeal puts them.
  function stampCreatedSeal(item) {
    ensurePooled(item);
    closeModal(function () {
      var x = (window.innerWidth || 1) * 0.5;
      var y = (window.innerHeight || 1) * 0.5;
      if (typeof window.__vanokPlaceSeal === 'function') window.__vanokPlaceSeal(item, x, y);
    });
  }

  for (var li = 0; li < launchers.length; li++) {
    launchers[li].addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!modal.hidden) return;
      openLibrary();
    });
  }
  function findCatalogItem(id) {
    var list = catalog();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function paintArmed() {
    var armed = pending && pending.id;
    var cards = grid.querySelectorAll('.sig-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('is-armed', !!armed && cards[i].dataset.id === armed);
    }
  }
  function placeLibrarySeal(item) {
    ensurePooled(item);
    closeModal();
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;
    var reach = vh * 0.15 + 24;
    var mx = Math.min(reach, vw * 0.32);
    var my = Math.min(reach, vh * 0.32);
    var x = mx + Math.random() * Math.max(1, vw - mx * 2);
    var y = my + Math.random() * Math.max(1, vh - my * 2);
    if (typeof window.__vanokPlaceSeal === 'function') window.__vanokPlaceSeal(item, x, y);
  }
  grid.addEventListener('click', function (event) {
    if (event.target.closest('.sig-add')) {
      event.preventDefault();
      event.stopPropagation();
      openShapes();
      return;
    }
    var card = event.target.closest('.sig-card');
    if (!card || !card.dataset.id) return;
    event.preventDefault();
    event.stopPropagation();
    var item = findCatalogItem(card.dataset.id);
    if (!item) return;
    placeLibrarySeal(item);
  });
  var flightArt = null;
  var flightHome = null;
  var flightToken = 0;
  var flightTimer = 0;
  var flightWatch = null;
  function restoreFlightArt() {
    var art = flightArt;
    var home = flightHome;
    if (art && flightWatch) art.removeEventListener('transitionend', flightWatch);
    flightWatch = null;
    if (flightTimer) clearTimeout(flightTimer);
    flightTimer = 0;
    if (art) {
      if (home) home.appendChild(art);
      art.style.transition = '';
      art.style.transform = '';
      art.style.left = '';
      art.style.top = '';
      art.style.width = '';
      art.style.height = '';
      art.classList.remove('sig-flight');
    }
    flightArt = null;
    flightHome = null;
    var targets = modal.querySelectorAll('.sig-seal.is-flight-target');
    for (var ti = 0; ti < targets.length; ti++) targets[ti].classList.remove('is-flight-target');
  }
  function clearFlight() {
    flightToken += 1;
    restoreFlightArt();
  }
  function flyToDraw(button) {
    var nextKind = button.dataset.kind === 'apple' ? 'apple' : 'stamp';
    if (motionOff()) {
      openEditor(nextKind);
      return;
    }
    var art = button.querySelector('.sig-shape-art');
    var from = art && art.getBoundingClientRect();
    if (!art || !from || from.width < 2 || from.height < 2) {
      openEditor(nextKind);
      return;
    }
    clearFlight();
    var token = flightToken;
    art.classList.add('sig-flight');
    art.style.left = from.left + 'px';
    art.style.top = from.top + 'px';
    art.style.width = from.width + 'px';
    art.style.height = from.height + 'px';
    art.style.transform = 'translate3d(0,0,0)';
    art.style.transition = 'none';
    modal.appendChild(art);
    flightArt = art;
    flightHome = button;
    openEditor(nextKind);
    var seal = modal.querySelector('.sig-slide[data-kind="' + nextKind + '"] .sig-seal');
    if (!seal) {
      clearFlight();
      return;
    }
    seal.classList.add('is-flight-target');
    var to = seal.getBoundingClientRect();
    if (to.width < 2 || to.height < 2) {
      clearFlight();
      return;
    }
    var dx = to.left - from.left;
    var dy = to.top - from.top;
    var sx = to.width / from.width;
    var sy = to.height / from.height;
    var landed = false;
    var spins = 0;
    function editorShown() {
      return parseFloat(window.getComputedStyle(editor).opacity) >= 0.99;
    }
    function land() {
      if (token !== flightToken || landed) return;
      if (!editorShown() && spins < 45) {
        spins += 1;
        requestAnimationFrame(land);
        return;
      }
      landed = true;
      restoreFlightArt();
    }
    function onMove(event) {
      if (event.target !== art || event.propertyName !== 'transform') return;
      land();
    }
    flightWatch = onMove;
    art.addEventListener('transitionend', onMove);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (token !== flightToken) return;
        art.style.transition = 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1)';
        art.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(' + sx + ',' + sy + ')';
      });
    });
    flightTimer = setTimeout(land, 980);
  }
  modal.querySelectorAll('.sig-shape').forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      flyToDraw(button);
    });
  });
  modal.addEventListener('click', function (event) {
    var control = event.target.closest('.sig-back, .sig-close');
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    if (control.classList.contains('sig-close')) {
      closeModal();
      return;
    }
    if (editor.classList.contains('is-on')) openShapes();
    else if (shapes.classList.contains('is-on')) openLibrary();
    else closeModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.code !== 'Escape' || modal.hidden || !modal.classList.contains('is-open')) return;
    event.preventDefault();
    event.stopPropagation();
    if (editor.classList.contains('is-on')) openShapes();
    else if (shapes.classList.contains('is-on')) openLibrary();
    else closeModal();
  }, true);

  function cardNode(item) {
    var card = document.createElement('div');
    card.className = 'sig-card';
    card.dataset.id = item.id;
    var img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = item.src;
    card.appendChild(img);
    if (pending && pending.id === item.id) card.classList.add('is-armed');
    return card;
  }
  function catalog() {
    var presets = PRESETS.filter(function (item) {
      if (REMOVED_IDS[item.id]) return false;
      if (isStockFile(item.src)) return true;
      return listedSeal(item);
    });
    return userItems().filter(function (item) {
      return listedSeal(item) && !REMOVED_IDS[item.id];
    }).concat(presets);
  }
  function addCard() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sig-card sig-add';
    button.setAttribute('aria-label', 'Create Signature');
    return button;
  }
  function renderGrid(freshId, from) {
    var list = catalog();
    var nodes = [addCard()].concat(list.map(cardNode));
    grid.replaceChildren.apply(grid, nodes);
    if (!freshId || !from || from.width < 1) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var cards = Array.prototype.slice.call(grid.children);
    var fresh = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.id === freshId) fresh = cards[i];
    }
    if (!fresh) return;
    var after = cards.map(function (el) { return el.getBoundingClientRect(); });
    var movers = [];
    cards.forEach(function (el, index) {
      if (el.classList.contains('sig-add')) return;
      var to = after[index];
      var dx = 0;
      var dy = 0;
      var scale = 1;
      if (el === fresh) {
        dx = from.left - to.left;
        dy = from.top - to.top;
        scale = from.width / Math.max(to.width, 1);
      } else if (index > 0) {
        dx = after[index - 1].left - to.left;
        dy = after[index - 1].top - to.top;
      }
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.02) return;
      el.style.transition = 'none';
      el.style.transformOrigin = 'top left';
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
      movers.push(el);
    });
    if (!movers.length) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        function release(el) {
          el.style.transform = '';
          el.style.transition = '';
          el.style.transformOrigin = '';
        }
        function onEnd(event) {
          if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
          event.currentTarget.removeEventListener('transitionend', onEnd);
          release(event.currentTarget);
        }
        movers.forEach(function (el) {
          el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease';
          el.style.transform = 'none';
          el.addEventListener('transitionend', onEnd);
        });
        setTimeout(function () {
          movers.forEach(function (el) {
            el.removeEventListener('transitionend', onEnd);
            release(el);
          });
        }, 500);
      });
    });
  }

  function drawText(ctx, path, text, color) {
    if (!path || !text) return;
    var length = path.getTotalLength();
    if (!length) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '13px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var width = ctx.measureText(text).width;
    var cursor = pathStart(path);
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var w = ctx.measureText(ch).width;
      var mid = (cursor + w / 2) % length;
      var p = path.getPointAtLength(mid);
      var ahead = path.getPointAtLength((mid + 1) % length);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(ahead.y - p.y, ahead.x - p.x));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursor += w;
    }
    ctx.restore();
  }

  var RING_BODY = {
    stamp: "<g id=\"Frame 315\">\n<path id=\"Ellipse 13\" d=\"M310.056 162.998C310.056 244.216 244.216 310.056 162.998 310.056C81.7798 310.056 15.9398 244.216 15.9398 162.998C15.9398 81.7798 81.7798 15.9398 162.998 15.9398C244.216 15.9398 310.056 81.7798 310.056 162.998Z\" stroke-width=\"0.650699\" stroke=\"#0C6DF4\"/>\n\n<path id=\"Ellipse 15\" d=\"M325.675 163C325.675 252.843 252.843 325.675 163 325.675C73.1573 325.675 0.325349 252.843 0.325349 163C0.325349 73.1573 73.1573 0.325349 163 0.325349C252.843 0.325349 325.675 73.1573 325.675 163Z\" stroke-width=\"0.650699\" stroke=\"#0C6DF4\"/>\n<path id=\"Ellipse 14\" d=\"M319.496 162.999C319.496 249.428 249.432 319.492 163.003 319.492C76.5746 319.492 6.5103 249.428 6.5103 162.999C6.5103 76.5707 76.5746 6.5064 163.003 6.5064C249.432 6.5064 319.496 76.5707 319.496 162.999Z\" stroke-width=\"5.20559\" stroke=\"#0C6DF4\"/>\n</g>",
    apple: "<g id=\"apple-3gren\">\n<mask id=\"stroke0_477_961\" fill=\"white\">\n<path d=\"M326.643 449.445C306.693 455.957 229.763 457.998 203.676 457.998C149.966 457.998 58.5273 361.65 58.5273 236.395C58.5273 148.298 127.477 118.207 159.703 118.207C191.929 118.207 221.232 125.113 247.319 125.113C248.698 125.113 250.107 125.1 251.539 125.074C271.782 124.715 296.658 121.948 307.168 120.517C355.828 113.892 437.158 128.315 441.828 223.937C447.638 342.921 346.593 442.934 326.643 449.445Z\"/>\n</mask>\n<path d=\"M203.676 457.998C229.763 457.998 306.693 455.957 326.643 449.445C346.593 442.934 447.638 342.921 441.828 223.937C437.158 128.315 355.828 113.892 307.168 120.517C296.658 121.948 271.782 124.715 251.539 125.074C250.107 125.1 248.698 125.113 247.319 125.113C221.232 125.113 191.929 118.207 159.703 118.207C127.477 118.207 58.5273 148.298 58.5273 236.395C58.5273 361.65 149.966 457.998 203.676 457.998Z\" stroke-width=\"11.6667\" stroke=\"#0C6DF4\" mask=\"url(#stroke0_477_961)\"/>\n<mask id=\"stroke1_477_961\" fill=\"white\">\n<path d=\"M266.884 445.246C242.099 446.559 216.543 447.065 203.69 447.065C193.295 447.065 179.66 442.281 164.501 431.951C149.526 421.746 133.912 406.69 119.739 387.644C91.3849 349.543 69.4688 296.394 69.4688 236.416C69.4688 195.565 85.3113 169.004 104.231 152.515C123.581 135.651 146.348 129.148 159.728 129.148C175.121 129.148 189.918 130.797 204.548 132.525C218.94 134.225 233.501 136.052 247.325 136.052C248.773 136.052 250.247 136.039 251.737 136.012C272.584 135.642 297.929 132.814 308.63 131.357C331.484 128.246 361.427 130.223 385.745 143.49C409.281 156.33 428.751 180.338 430.907 224.492C433.658 280.805 411.088 333.238 384.79 372.825C371.69 392.544 357.839 408.806 346.159 420.45C340.681 425.911 335.758 430.278 331.692 433.477L330.891 434.101C328.724 435.77 326.953 436.982 325.593 437.813C324.517 438.471 323.827 438.809 323.481 438.96L323.247 439.053C319.478 440.282 311.984 441.547 301.522 442.657C291.366 443.736 279.277 444.589 266.884 445.246Z\"/>\n</mask>\n<path d=\"M203.69 447.065C216.543 447.065 242.099 446.559 266.884 445.246C279.277 444.589 291.366 443.736 301.522 442.657C311.984 441.547 319.478 440.282 323.247 439.053L323.481 438.96C323.827 438.809 324.517 438.471 325.593 437.813C326.953 436.982 328.724 435.77 330.891 434.101L331.692 433.477C335.758 430.278 340.681 425.911 346.159 420.45C357.839 408.806 371.69 392.544 384.79 372.825C411.088 333.238 433.658 280.805 430.907 224.492C428.751 180.338 409.281 156.33 385.745 143.49C361.427 130.223 331.484 128.246 308.63 131.357C297.929 132.814 272.584 135.642 251.737 136.012C250.247 136.039 248.773 136.052 247.325 136.052C233.501 136.052 218.94 134.225 204.548 132.525C189.918 130.797 175.121 129.148 159.728 129.148C146.348 129.148 123.581 135.651 104.231 152.515C85.3113 169.004 69.4688 195.565 69.4688 236.416C69.4688 296.394 91.3849 349.543 119.739 387.644C133.912 406.69 149.526 421.746 164.501 431.951C179.66 442.281 193.295 447.065 203.69 447.065Z\" stroke-width=\"2.91666\" stroke=\"#0C6DF4\" mask=\"url(#stroke1_477_961)\"/>\n<mask id=\"stroke2_477_961\" fill=\"white\">\n<path d=\"M226.488 39.2298C252.557 62.7219 254.009 99.7169 251.733 125.281C248.115 127.014 246.085 125.974 242.464 125.281C238.346 82.663 235.68 75.1234 203.159 57.6401C201.528 56.7629 201.093 54.6045 202.351 53.2446C207.849 47.3013 213.79 43.2895 223.396 38.7811C224.422 38.2996 225.646 38.4711 226.488 39.2298Z\"/>\n</mask>\n<path d=\"M251.733 125.281C254.009 99.7169 252.557 62.7219 226.488 39.2298C225.646 38.4711 224.422 38.2996 223.396 38.7811C213.79 43.2895 207.849 47.3013 202.351 53.2446C201.093 54.6045 201.528 56.7629 203.159 57.6401C235.68 75.1234 238.346 82.663 242.464 125.281C246.085 125.974 248.115 127.014 251.733 125.281Z\" stroke-width=\"8.74999\" stroke=\"#0C6DF4\" mask=\"url(#stroke2_477_961)\"/>\n</g>"
  };

  function xmlEscape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function strokeMarkup(name, hex) {
    var marks = '';
    strokes[name].forEach(function (stroke) {
      if (!stroke.points.length) return;
      var d = 'M' + stroke.points[0].x + ' ' + stroke.points[0].y;
      for (var i = 1; i < stroke.points.length - 1; i++) {
        var a = stroke.points[i];
        var b = stroke.points[i + 1];
        d += ' Q' + a.x + ' ' + a.y + ' ' + ((a.x + b.x) / 2) + ' ' + ((a.y + b.y) / 2);
      }
      var last = stroke.points[stroke.points.length - 1];
      d += ' L' + last.x + ' ' + last.y;
      var ink = name === 'apple' ? 2.6 * (VB.apple.w / 323.17) : 2.6;
      marks += '<path d="' + d + '" fill="none" stroke="' + (stroke.color || hex) + '" stroke-width="' + ink + '" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    return marks;
  }

  function exportSeal(name) {
    var vb = VB[name];
    var hex = selectedColor().hex;
    var rings = '<g fill="none" stroke="none">' + (RING_BODY[name] || '').replace(/#0C6DF4/gi, hex) + '</g>';
    var letters = '';
    var value = texts[name] || '';
    if (value) {
      var path = document.getElementById('sig-path-' + name);
      var offset = path.parentNode.querySelector('textPath').getAttribute('startOffset') || '0';
      letters = '<path id="sig-export-path" d="' + xmlEscape(path.getAttribute('d')) + '" fill="none"/>' +
        '<text fill="' + hex + '" text-anchor="start" font-family="Arial, Helvetica, sans-serif" font-size="' + (name === 'apple' ? 13 / APPLE_PREVIEW_SCALE * (VB.apple.w / 326) : 13) + '">' +
        '<textPath href="#sig-export-path" startOffset="' + xmlEscape(offset) + '">' + xmlEscape(value) + '</textPath></text>';
    }
    var picture = '';
    if (photos[name] && photos[name].tinted) {
      var shot = document.createElement('canvas');
      shot.width = Math.round(vb.w * 2);
      shot.height = Math.round(vb.h * 2);
      var shotCtx = shot.getContext('2d');
      shotCtx.setTransform(2, 0, 0, 2, 0, 0);
      shotCtx.save();
      clipDrawing(shotCtx, name);
      drawPhoto(shotCtx, name);
      shotCtx.restore();
      picture = '<image href="' + shot.toDataURL('image/webp', 0.9) + '" x="0" y="0" width="' + vb.w + '" height="' + vb.h + '"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb.w + ' ' + vb.h + '" width="539" height="539" preserveAspectRatio="none">' +
      '<defs>' + clipMarkup(name) + '</defs>' +
      rings + '<g clip-path="url(#sig-ink-clip)">' + picture + strokeMarkup(name, hex) + '</g>' + letters + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function rasterToWebp(url, width, height) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var w = width || img.naturalWidth || 539;
        var h = height || img.naturalHeight || 539;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var out = canvas.toDataURL('image/webp', 0.9);
        if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/png');
        resolve(out.indexOf('data:image/') === 0 ? out : url);
      };
      img.onerror = function () { resolve(url); };
      img.src = url;
    });
  }

  function exportSealWebp(name) {
    var vb = VB[name];
    return rasterToWebp(exportSeal(name), vb.w * 2, vb.h * 2);
  }

  function ensureWebpSrc(item) {
    var src = item && item.src;
    if (typeof src !== 'string') return Promise.resolve(item);
    if (src.indexOf('data:image/webp') === 0) return Promise.resolve(item);
    if (src.indexOf('data:image/png') === 0 || src.indexOf('data:image/jpeg') === 0 || src.indexOf('data:image/svg+xml') === 0) {
      return rasterToWebp(src).then(function (next) {
        if (next && next !== src) item.src = next;
        return item;
      });
    }
    return Promise.resolve(item);
  }

  var fileInput = modal.querySelector('.sig-file');
  modal.querySelector('.sig-upload').addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    fileInput.value = '';
    fileInput.click();
  });
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      placePhoto(kind, img);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  });

  var creatingSeal = false;
  modal.querySelector('.sig-create').addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (creatingSeal) return;
    var color = selectedColor();
    var madeKind = kind;
    var madeText = texts[madeKind];
    creatingSeal = true;
    exportSealWebp(madeKind).then(function (src) {
      creatingSeal = false;
      var item = {
        id: 'sig-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
        kind: madeKind,
        src: src,
        castHex: color.cast,
        colorName: color.name,
        text: madeText,
        createdAt: Date.now(),
        localOnly: true
      };
      items.unshift(item);
      texts[madeKind] = '';
      strokes[madeKind] = [];
      photos[madeKind] = null;
      photoSources[madeKind] = null;
      drawing = null;
      swipe = null;
      editing = false;
      editingLock = false;
      clearTimeout(beginEdit.timer);
      input.value = '';
      redraw(madeKind);
      paintText();
      placeCaret();
      try { input.blur(); } catch (err) {}
      stampCreatedSeal(item);
      setTimeout(function () {
        held[item.id] = item;
        saveLocal();
        postItem(item, true);
      }, 0);
    }, function () {
      creatingSeal = false;
    });
  });
  function trackCustomStampCreate(item) {
    if (!item || item.preset) return;
    if (document.documentElement.getAttribute('data-seals') !== 'pair') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'custom_stamp_create' });
    if (typeof window.gtag === 'function') window.gtag('event', 'custom_stamp_create');
  }

  function isDataSrc(src) {
    return String(src || '').indexOf('data:image/') === 0;
  }
  function isRemoteSrc(src) {
    return /^https?:\/\//.test(String(src || ''));
  }
  // The shared catalog only takes inline images. Seals saved by serve.py point
  // at design/stamps/custom-signatures/*.webp, so inline those first.
  function uploadSrc(item) {
    if (isDataSrc(item.src)) return ensureWebpSrc(item);
    if (isRemoteSrc(item.src)) return Promise.resolve(item);
    return rasterToWebp(item.src).then(function (next) {
      if (isDataSrc(next)) item.src = next;
      return item;
    });
  }
  function forgetItem(id) {
    REMOVED_IDS[id] = 1;
    delete held[id];
    items = items.filter(function (row) { return row.id !== id; });
    saveLocal();
    renderGrid();
  }
  var posting = {};
  function postItem(item, reportCreate) {
    if (posting[item.id]) return posting[item.id];
    var job = uploadSrc(item).then(function () {
      saveLocal();
      if (!isDataSrc(item.src)) return null;
      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    }).then(function (res) {
      if (!res) return null;
      if (res.status === 410) {
        forgetItem(item.id);
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    }).then(function (saved) {
      if (!saved || saved.id !== item.id) return;
      item.localOnly = false;
      if (typeof saved.src === 'string' && saved.src !== item.src) item.src = saved.src;
      saveLocal();
      renderGrid();
      if (reportCreate) trackCustomStampCreate(item);
    }).catch(function () {}).then(function () {
      delete posting[item.id];
    });
    posting[item.id] = job;
    return job;
  }
  var held = {};
  // remote: the shared list when it answered, otherwise only the static file.
  // Anything this device has that the shared list lacks (and was not deleted)
  // was never uploaded, so it goes up now and every device gets the union.
  function applyShared(remote, shared) {
    var next = [];
    var seen = {};
    var upload = [];
    remote.forEach(function (item) {
      if (!validItem(item) || seen[item.id]) return;
      seen[item.id] = 1;
      next.push(item);
    });
    items.concat(Object.keys(held).map(function (id) { return held[id]; })).forEach(function (item) {
      if (!item || item.preset || seen[item.id] || !validItem(item)) return;
      if (shared && isRemoteSrc(item.src) && !held[item.id]) return;
      seen[item.id] = 1;
      next.push(item);
      if (shared && !isRemoteSrc(item.src)) {
        item.localOnly = true;
        upload.push(item);
      }
    });
    next.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    items = next;
    saveLocal();
    renderGrid();
    upload.reduce(function (chain, item) {
      return chain.then(function () { return postItem(item); });
    }, Promise.resolve());
  }
  function readCatalog(res) {
    var type = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || type.indexOf('json') === -1) throw new Error('catalog');
    return res.json();
  }
  function markRemoved(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (id) {
      if (typeof id === 'string' && id) REMOVED_IDS[id] = 1;
    });
  }
  function loadRemoved() {
    return fetch('design/stamps/removed-seals.json', { cache: 'no-store' }).then(readCatalog).then(markRemoved).catch(function () {});
  }
  var loading = null;
  function loadShared() {
    if (loading) return loading;
    var shared = fetch(API, { cache: 'no-store' }).then(readCatalog).then(function (data) {
      var list = Array.isArray(data) ? data : data && data.items;
      if (!Array.isArray(list)) throw new Error('catalog');
      if (data && data.removed) markRemoved(data.removed);
      return list;
    }).catch(function () { return null; });
    var fixed = fetch(FILE_URL, { cache: 'no-store' }).then(readCatalog).catch(function () { return []; });
    loading = Promise.all([shared, fixed]).then(function (parts) {
      var file = Array.isArray(parts[1]) ? parts[1] : [];
      if (parts[0]) applyShared(parts[0].concat(file), true);
      else applyShared(file, false);
    }).catch(function () {}).then(function () {
      loading = null;
    });
    return loading;
  }
  var legacy = readLegacy();
  loadRemoved().then(function () {
    items = loadLocal();
    var seen = {};
    items.forEach(function (item) { if (item && item.id) seen[item.id] = 1; });
    legacy.forEach(function (item) {
      if (seen[item.id] || !validItem(item)) return;
      item.localOnly = true;
      seen[item.id] = 1;
      items.push(item);
    });
    if (saveLocal()) forgetLegacy();
    loadAdopted();
    renderGrid();
    loadShared();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') loadShared();
  });
})();
