// Project the changing cross-section of a rolled sheet, then paint its bands back to front.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function paperBack(context, x, y, width, height, shade) {
  const tone = Math.round(255 - 24 * shade);
  context.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
  context.fillRect(x, y, width, height);
}

function paintRoll(context, image, width, height, progress, {horizontal, mirror, double}) {
  const length = horizontal ? width : height;
  const breadth = horizontal ? height : width;
  const textureLength = horizontal ? image.naturalWidth : image.naturalHeight;
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
    const back = strip.end < strip.start;
    context.save();
    if (!back && shade > .02) context.filter = `brightness(${1 - shade})`;
    if (horizontal) {
      context.translate(start, (breadth - cross) / 2);
      context.scale(end >= start ? 1 : -1, 1);
      if (mirror) { context.translate(span, 0); context.scale(-1, 1); }
      if (back) paperBack(context, 0, 0, span, cross, shade);
      else context.drawImage(image, source, 0, sourceSpan, image.naturalHeight, 0, 0, span, cross);
    } else {
      context.translate((breadth - cross) / 2, start);
      context.scale(1, end >= start ? 1 : -1);
      if (mirror) { context.translate(0, span); context.scale(1, -1); }
      if (back) paperBack(context, 0, 0, cross, span, shade);
      else context.drawImage(image, 0, source, image.naturalWidth, sourceSpan, 0, 0, cross, span);
    }
    context.restore();
  }
}

function paintQuarters(context, image, width, height, progress, {mirror, flip}) {
  // The side hinge opens first, then the other half folds down.
  const side = Math.PI * (1 - smooth(progress / .58));
  const bottom = Math.PI * (1 - smooth((progress - .42) / .58));
  const halfW = width / 2;
  const halfH = height / 2;
  const sourceW = image.naturalWidth / 2;
  const sourceH = image.naturalHeight / 2;
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
      if (sx * sy < 0) {
        paperBack(context, x, y, halfW + .35, halfH + .35, shade);
      } else {
        context.filter = `brightness(${1 - shade})`;
        context.drawImage(image, (mirror ? 1 - column : column) * sourceW,
          (flip ? 1 - row : row) * sourceH, sourceW, sourceH, x, y, halfW + .35, halfH + .35);
      }
      context.restore();
    }
  }
  context.restore();
}

export function revealPoster(art, source) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    art.src = source;
    return () => {};
  }
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
  canvas.dataset.posterReveal = mode;
  canvas.setAttribute('aria-hidden', 'true');
  art.style.visibility = 'hidden';
  texture.src = source;
  texture.decode().then(() => {
    if (stopped || !art.isConnected) return;
    const bounds = art.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio, 3);
    const scale = Math.min(1, Math.max(
      1024 / Math.max(texture.naturalWidth, texture.naturalHeight),
      Math.min(bounds.width / texture.naturalWidth, bounds.height / texture.naturalHeight) * ratio,
    ));
    canvas.width = Math.max(1, Math.round(texture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(texture.naturalHeight * scale));
    art.src = texture.src;
    art.after(canvas);
    const started = performance.now();
    function draw(now) {
      const progress = clamp((now - started) / duration);
      if (progress === 1 || !canvas.isConnected) {
        finish();
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.transform = `rotate(${tilt * (1 - progress) ** 2}deg)`;
      const paint = mode === 'quarters' ? paintQuarters : paintRoll;
      paint(context, texture, canvas.width, canvas.height, progress, pose);
      frame = requestAnimationFrame(draw);
    }
    draw(started);
  }).catch(finish);
  return finish;
}
