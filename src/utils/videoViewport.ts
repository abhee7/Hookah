export interface VideoViewport {
  width: number; // displayed (cropped-to-fill) video width in px
  height: number; // displayed video height in px
  offsetX: number; // negative when the sides are cropped
  offsetY: number; // negative when the top/bottom are cropped
}

/**
 * The <video> uses `object-fit: cover`, so it is scaled up to fill the window and the
 * overflow is cropped. Landmarks are normalised to the full video frame, so they must be
 * mapped through the same scale + offset to land on the right pixel on screen.
 */
export function getCoverViewport(video: HTMLVideoElement, containerW: number, containerH: number): VideoViewport {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    return { width: containerW, height: containerH, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(containerW / vw, containerH / vh);
  const width = vw * scale;
  const height = vh * scale;
  return {
    width,
    height,
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2
  };
}
