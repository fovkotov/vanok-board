// Project the changing cross-section of a rolled sheet, then paint its bands back to front.
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// The constructor's Glossy stock has a smooth tooth and a broad, soft clearcoat.
function coatPrint(image, width, height) {
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const context = sheet.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const tooth = document.createElement('canvas');
  tooth.width = tooth.height = 144;
  const grain = tooth.getContext('2d');
  const pixels = grain.createImageData(tooth.width, tooth.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const variation = Math.random() - .5;
    pixels.data.fill(variation < 0 ? 0 : 255, i, i + 3);
    pixels.data[i + 3] = Math.round(Math.abs(variation) * 18);
  }
  grain.putImageData(pixels, 0, 0);
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = context.createPattern(tooth, 'repeat');
  context.fillRect(0, 0, width, height);
  return sheet;
}

function glossHighlight(context, x, y, width, height, strength) {
  if (strength < .008) return;
  context.filter = 'none';
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = `rgba(255, 255, 255, ${strength})`;
  context.fillRect(x, y, width, height);
}

function paintFlat(context, sheet) {
  const {width, height} = sheet;
  context.drawImage(sheet, 0, 0);
  context.save();
  context.globalCompositeOperation = 'source-atop';
  const reflection = context.createLinearGradient(0, 0, width, height);
  reflection.addColorStop(0, 'transparent');
  reflection.addColorStop(.24, 'rgba(255,255,255,.10)');
  reflection.addColorStop(.42, 'rgba(255,255,255,.025)');
  reflection.addColorStop(.7, 'transparent');
  context.fillStyle = reflection;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function paperBack(context, x, y, width, height, shade) {
  const tone = Math.round(255 - 24 * shade);
  context.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
  context.fillRect(x, y, width, height);
}

function paintRoll(context, image, width, height, progress, {horizontal, mirror, double}) {
  const length = horizontal ? width : height;
  const breadth = horizontal ? height : width;
  const textureLength = horizontal ? image.width : image.height;
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
    const reflection = .25 * Math.exp(-((strip.light - .72) ** 2) / .033) * (1 - release);
    const back = strip.end < strip.start;
    context.save();
    if (!back && shade > .02) context.filter = `brightness(${1 - shade})`;
    if (horizontal) {
      context.translate(start, (breadth - cross) / 2);
      context.scale(end >= start ? 1 : -1, 1);
      if (mirror) { context.translate(span, 0); context.scale(-1, 1); }
      if (back) paperBack(context, 0, 0, span, cross, shade);
      else {
        context.drawImage(image, source, 0, sourceSpan, image.height, 0, 0, span, cross);
        glossHighlight(context, 0, 0, span, cross, reflection);
      }
    } else {
      context.translate((breadth - cross) / 2, start);
      context.scale(1, end >= start ? 1 : -1);
      if (mirror) { context.translate(0, span); context.scale(1, -1); }
      if (back) paperBack(context, 0, 0, cross, span, shade);
      else {
        context.drawImage(image, 0, source, image.width, sourceSpan, 0, 0, cross, span);
        glossHighlight(context, 0, 0, cross, span, reflection);
      }
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
  const sourceW = image.width / 2;
  const sourceH = image.height / 2;
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
        const reflection = .23 * Math.exp(-((Math.abs(sx * sy) - .67) ** 2) / .048);
        glossHighlight(context, x, y, halfW + .35, halfH + .35, reflection);
      }
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
  canvas.dataset.paper = 'glossy';
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
    const sheet = coatPrint(texture, canvas.width, canvas.height);
    art.src = texture.src;
    art.after(canvas);
    if (reducedMotion) {
      paintFlat(context, sheet);
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
        paintFlat(context, sheet);
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
