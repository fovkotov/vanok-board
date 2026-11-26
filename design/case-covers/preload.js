// Preload only the assets used by the mounted layout. Identical URLs count once.
const loads = new Map();
const sources = new Map();

export function portfolioMediaSource(src) {
  return sources.get(new URL(src, document.baseURI).href) || src;
}

async function fetchMedia(url, isVideo) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const media = await response.blob();
  if (!media.size) throw new Error('Empty media file');
  const localUrl = URL.createObjectURL(media);
  try {
    if (!isVideo) {
      const image = new Image();
      image.src = localUrl;
      await image.decode();
    }
    sources.set(url, localUrl);
  } catch (error) {
    URL.revokeObjectURL(localUrl);
    throw error;
  }
}

function preload(url, isVideo) {
  if (!loads.has(url)) {
    loads.set(url, fetchMedia(url, isVideo).catch(error => {
      loads.delete(url);
      throw new Error(`Could not load ${url}`, { cause: error });
    }));
  }
  return loads.get(url);
}

export async function loadPortfolioMedia(root, introImages, extras, report) {
  const jobs = new Map();
  const add = (src, isVideo = false) => {
    if (!src) return;
    const url = new URL(src, document.baseURI).href;
    if (!jobs.has(url)) jobs.set(url, () => preload(url, isVideo));
  };
  for (const img of [...introImages, ...root.querySelectorAll('.case img')]) {
    add(img.dataset.src || img.getAttribute('src'));
  }
  for (const item of root.querySelectorAll('.case [data-preview]:not([data-preview-video])')) {
    add(item.dataset.preview);
  }
  for (const item of root.querySelectorAll('.case [data-preview-video]')) {
    add(item.dataset.previewVideo, true);
  }
  for (const video of root.querySelectorAll('.case video')) {
    add(video.getAttribute('poster'));
    add(video.dataset.src || video.getAttribute('src'), true);
  }
  for (const url of extras.images) add(url);
  const queue = [...jobs.values(), ...extras.tasks];
  const total = queue.length;
  let done = 0;
  report(0, total);
  const worker = async () => {
    while (queue.length) {
      await queue.shift()();
      report(++done, total);
    }
  };
  await Promise.all(Array.from({length: Math.min(6, total)}, worker));
}
