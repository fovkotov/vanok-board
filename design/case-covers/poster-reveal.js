const PAPER_TEXTURE = new URL('./recycled-paper.webp', import.meta.url).href;

// Project the changing cross-section of a rolled sheet, then paint its bands back to front.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// Use the constructor's unprinted Recycled swatch over both sides of the sheet.
function printOnPaper(image, paper, width, height) {
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  for (const side of [front, back]) {
    side.width = width;
    side.height = height;
  }
  back.getContext('2d').drawImage(paper, 0, 0, width, height);

  const context = front.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  context.globalCompositeOperation = 'multiply';
  context.globalAlpha = .58;
  context.drawImage(back, 0, 0);
  context.globalCompositeOperation = 'destination-in';
  context.globalAlpha = 1;
  context.drawImage(image, 0, 0, width, height);
  return {front, back};
}

function paintRoll(context, sheet, width, height, progress, {horizontal, mirror, double}) {
  const length = horizontal ? width : height;
  const breadth = horizontal ? height : width;
  const textureLength = horizontal ? sheet.front.width : sheet.front.height;
  const bands = 128;
  const opening = smooth(progress);
  const front = double ? .07 + .43 * opening : .13 + .87 * opening;
  const radius = (double ? .028 : .046) + (1 - opening) * .017;
  const release = smooth((progress - .8) / .2);

  function point(t) {
    const axis = double ? Math.abs(t - .5) : t;
    const side = double && t < .5 ? -1 : 1;
    const distance = Math.max(0, axis - front);
    const angle = distance / radius;
    const position = Math.min(axis, front) + radius * Math.sin(angle);
    return {
      position: distance ? t + (position - axis) * side * (1 - release) : t,
      depth: radius * (1 - Math.cos(angle)) * (1 - release),
      light: Math.cos(angle),
    };
  }

  let previous = point(0);
  const strips = [];
  for (let i = 0; i < bands; i++) {
    const next = point((i + 1) / bands);
    strips.push({i, start: previous.position, end: next.position,
      depth: (previous.depth + next.depth) / 2, light: (previous.light + next.light) / 2});
    previous = next;
  }
  strips.sort((a, b) => a.depth - b.depth);
  for (const strip of strips) {
    const start = (mirror ? 1 - strip.start : strip.start) * length;
    const end = (mirror ? 1 - strip.end : strip.end) * length;
    const span = Math.max(.7, Math.abs(end - start) + .6);
    const sourceSpan = textureLength / bands;
    const source = (mirror ? bands - 1 - strip.i : strip.i) * sourceSpan;
    const cross = breadth * (1 + strip.depth * .38);
    const shade = .32 * (1 - strip.light) * (1 - release);
    const image = strip.end < strip.start ? sheet.back : sheet.front;
    context.save();
    if (shade > .02) context.filter = `brightness(${1 - shade})`;
    if (horizontal) {
      context.translate(start, (breadth - cross) / 2);
      context.scale(end >= start ? 1 : -1, 1);
      if (mirror) { context.translate(span, 0); context.scale(-1, 1); }
      context.drawImage(image, source, 0, sourceSpan, image.height, 0, 0, span, cross);
    } else {
      context.translate((breadth - cross) / 2, start);
      context.scale(1, end >= start ? 1 : -1);
      if (mirror) { context.translate(0, span); context.scale(1, -1); }
      context.drawImage(image, 0, source, image.width, sourceSpan, 0, 0, cross, span);
    }
    context.restore();
  }
}

function paintQuarters(context, sheet, width, height, progress, {mirror, flip}) {
  // The side hinge opens first, then the other half folds down.
  const side = Math.PI * (1 - smooth(progress / .58));
  const bottom = Math.PI * (1 - smooth((progress - .42) / .58));
  const halfW = width / 2;
  const halfH = height / 2;
  const sourceW = sheet.front.width / 2;
  const sourceH = sheet.front.height / 2;
  context.save();
  context.translate(mirror ? width : 0, flip ? height : 0);
  context.scale(mirror ? -1 : 1, flip ? -1 : 1);
  for (const row of [0, 1]) {
    for (const column of [0, 1]) {
      const sx = column ? Math.cos(side) : 1;
      const sy = row ? Math.cos(bottom) : 1;
      if (Math.abs(sx * sy) < .003) continue;
      context.save();
      context.translate(column * halfW, row * halfH);
      context.scale(sx * (mirror ? -1 : 1), sy * (flip ? -1 : 1));
      const x = mirror ? -halfW : 0;
      const y = flip ? -halfH : 0;
      const shade = .22 * (2 - sx - sy);
      const image = sx * sy < 0 ? sheet.back : sheet.front;
      context.filter = `brightness(${1 - shade})`;
      context.drawImage(image, (mirror ? 1 - column : column) * sourceW,
        (flip ? 1 - row : row) * sourceH, sourceW, sourceH, x, y, halfW + .35, halfH + .35);
      context.restore();
    }
  }
  context.restore();
}

export function revealPoster(art, source) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    art.src = source;
    return () => {};
  }
  const modes = ['unroll', 'quarters', 'side-scroll'];
  const mode = modes[Math.floor(Math.random() * modes.length)];
  const pose = {
    horizontal: mode === 'side-scroll' || Math.random() < .24,
    mirror: Math.random() < .5,
    flip: Math.random() < .5,
    double: mode === 'side-scroll',
  };
  const tilt = (6 + Math.random() * 8) * (Math.random() < .5 ? -1 : 1);
  const duration = 1050 + Math.random() * 240;
  const texture = new Image();
  let frame = 0;
  let stopped = false;
  function finish() {
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.remove();
    art.style.removeProperty('visibility');
  }

  canvas.className = art.className;
  if (!reducedMotion) canvas.dataset.posterReveal = mode;
  canvas.dataset.paper = 'recycled';
  canvas.setAttribute('aria-hidden', 'true');
  texture.src = source;
  const paper = new Image();
  paper.src = PAPER_TEXTURE;
  Promise.all([texture.decode(), paper.decode()]).then(() => {
    if (stopped || !art.isConnected) return;
    const bounds = art.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 3);
    const scale = Math.min(1, Math.max(
      1024 / Math.max(texture.naturalWidth, texture.naturalHeight),
      Math.min(bounds.width / texture.naturalWidth, bounds.height / texture.naturalHeight) * ratio,
    ));
    canvas.width = Math.max(1, Math.round(texture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(texture.naturalHeight * scale));
    const sheet = printOnPaper(texture, paper, canvas.width, canvas.height);
    art.src = texture.src;
    art.style.visibility = 'hidden';
    art.after(canvas);
    if (reducedMotion) {
      context.drawImage(sheet.front, 0, 0);
      return;
    }
    const started = performance.now();
    function draw(now) {
      const progress = clamp((now - started) / duration);
      if (!canvas.isConnected) {
        finish();
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (progress === 1) {
        delete canvas.dataset.posterReveal;
        canvas.style.removeProperty('transform');
        context.drawImage(sheet.front, 0, 0);
        return;
      }
      canvas.style.transform = `rotate(${tilt * (1 - progress) ** 2}deg)`;
      const paint = mode === 'quarters' ? paintQuarters : paintRoll;
      paint(context, sheet, canvas.width, canvas.height, progress, pose);
      frame = requestAnimationFrame(draw);
    }
    draw(started);
  }).catch(finish);
  return finish;
}
