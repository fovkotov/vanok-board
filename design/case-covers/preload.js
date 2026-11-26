// Only the intro and first case are needed before the loader opens the page.
export async function loadPortfolioMedia(root, introImages, extraImages, report) {
  const cover = root.querySelector('.case-cover');
  const images = new Map();
  for (const image of [...introImages, ...cover.querySelectorAll('img')]) {
    const src = image.dataset.src || image.getAttribute('src');
    if (src) images.set(src, image);
  }
  for (const video of cover.querySelectorAll('video[poster]')) {
    images.set(video.getAttribute('poster'), null);
  }
  for (const url of extraImages) images.set(url, null);

  const jobs = [...images].map(([src, target]) => async () => {
    const image = target || new Image();
    if (!target || image.dataset.src) {
      image.src = src;
      delete image.dataset.src;
    }
    await image.decode();
  });
  const total = jobs.length;
  let done = 0;
  report(0, total);
  await Promise.all(jobs.map(async load => {
    await load();
    report(++done, total);
  }));
}
