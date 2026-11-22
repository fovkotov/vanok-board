function makeVideo(thumb, preload = false) {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  if (preload) video.preload = 'auto';
  video.src = thumb.dataset.previewVideo;
  return video;
}

export function preparePreviewVideos(plane) {
  const warm = new Map();
  for (const thumb of plane.querySelectorAll('[data-preview-video-preload]')) {
    const video = makeVideo(thumb, true);
    warm.set(thumb, video);
    video.load();
  }

  return (thumb, overlay, className = '') => {
    const preloaded = warm.get(thumb);
    const video = preloaded || makeVideo(thumb);
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
