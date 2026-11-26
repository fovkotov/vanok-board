function makeVideo(source, preload = false) {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  if (preload) video.preload = 'auto';
  video.src = source;
  return video;
}

export function preparePreviewVideos(plane, eager = true) {
  const warm = new Map();
  for (const thumb of eager ? plane.querySelectorAll('[data-preview-video-preload]') : []) {
    const video = makeVideo(thumb.dataset.previewVideo, true);
    warm.set(thumb, video);
    video.load();
  }

  return (thumb, overlay, className = '') => {
    const preloaded = warm.get(thumb);
    const source = thumb.dataset.previewVideo;
    const video = preloaded || makeVideo(source);
    video.className = className;
    const reveal = () => video.style.removeProperty('visibility');
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.style.visibility = 'hidden';
      video.addEventListener('loadeddata', reveal, {once: true});
    } else {
      reveal();
    }
    overlay.replaceChildren(video);
    video.play().catch(() => {});
    return () => {
      video.removeEventListener('loadeddata', reveal);
      video.pause();
    };
  };
}
