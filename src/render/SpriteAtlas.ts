export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  anchorX?: number;
  anchorY?: number;
}
export interface SpriteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function spriteBounds(
  frame: AtlasFrame,
  width: number,
  height?: number,
): SpriteBounds {
  const h = height ?? (width * frame.h) / frame.w,
    w = height === undefined ? width : (h * frame.w) / frame.h;
  const ax = frame.anchorX ?? 0.5,
    ay = frame.anchorY ?? 0.92;
  return {
    x: -w * (ax > 1 ? ax / frame.w : ax),
    y: -h * (ay > 1 ? ay / frame.h : ay),
    width: w,
    height: h,
  };
}
export interface AtlasData {
  image: string;
  frames: Record<string, AtlasFrame>;
}
/** Optional supplied artwork. Procedural originals remain available while loading and offline. */
export class SpriteAtlas {
  image: HTMLImageElement | null = null;
  frames: Record<string, AtlasFrame> = {};
  ready = false;
  private hitMask:
    | {
        data: Uint8Array;
        width: number;
        height: number;
        scaleX: number;
        scaleY: number;
      }
    | null
    | undefined;
  async load(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      const data = (await response.json()) as AtlasData;
      const image = new Image();
      image.src = new URL(data.image, new URL(url, document.baseURI)).href;
      await image.decode();
      this.image = image;
      this.frames = data.frames;
      this.ready = true;
      this.hitMask = undefined;
      return true;
    } catch {
      return false;
    }
  }
  draw(
    c: CanvasRenderingContext2D,
    name: string,
    width: number,
    height?: number,
  ): boolean {
    const f = this.frames[name];
    if (!this.ready || !this.image || !f) return false;
    const bounds = spriteBounds(f, width, height);
    c.drawImage(
      this.image,
      f.x,
      f.y,
      f.w,
      f.h,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
    return true;
  }
  bounds(
    name: string,
    width: number,
    height?: number,
  ): SpriteBounds | undefined {
    const frame = this.frames[name];
    return this.ready && this.image && frame
      ? spriteBounds(frame, width, height)
      : undefined;
  }
  /** Match rendered alpha, expanded by a modest touch tolerance; never sample GPU pixels per tap. */
  hitTest(
    name: string,
    width: number,
    height: number | undefined,
    x: number,
    y: number,
    padding = 0,
  ): boolean {
    const frame = this.frames[name],
      bounds = this.bounds(name, width, height);
    if (!frame || !bounds) return false;
    if (
      x < bounds.x - padding ||
      y < bounds.y - padding ||
      x > bounds.x + bounds.width + padding ||
      y > bounds.y + bounds.height + padding
    )
      return false;
    const mask = this.getHitMask();
    if (!mask) return true; // Canvas readback may be unavailable; the registered bounds remain usable.
    const sx =
        (frame.x + ((x - bounds.x) / bounds.width) * frame.w) * mask.scaleX,
      sy = (frame.y + ((y - bounds.y) / bounds.height) * frame.h) * mask.scaleY;
    const rx = Math.max(1, ((padding * frame.w) / bounds.width) * mask.scaleX),
      ry = Math.max(1, ((padding * frame.h) / bounds.height) * mask.scaleY);
    const left = Math.max(0, Math.floor(frame.x * mask.scaleX)),
      right = Math.min(
        mask.width - 1,
        Math.ceil((frame.x + frame.w) * mask.scaleX) - 1,
      );
    const top = Math.max(0, Math.floor(frame.y * mask.scaleY)),
      bottom = Math.min(
        mask.height - 1,
        Math.ceil((frame.y + frame.h) * mask.scaleY) - 1,
      );
    for (
      let py = Math.max(top, Math.floor(sy - ry));
      py <= Math.min(bottom, Math.ceil(sy + ry));
      py++
    )
      for (
        let px = Math.max(left, Math.floor(sx - rx));
        px <= Math.min(right, Math.ceil(sx + rx));
        px++
      ) {
        if (
          ((px - sx) / rx) ** 2 + ((py - sy) / ry) ** 2 <= 1.3 &&
          mask.data[py * mask.width + px] > 24
        )
          return true;
      }
    return false;
  }
  private getHitMask() {
    if (this.hitMask !== undefined) return this.hitMask;
    this.hitMask = null;
    try {
      if (!this.image || !this.image.naturalWidth || !this.image.naturalHeight)
        return null;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(this.image.naturalWidth / 4);
      canvas.height = Math.ceil(this.image.naturalHeight / 4);
      const c = canvas.getContext("2d", { willReadFrequently: true });
      if (!c) return null;
      c.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      const rgba = c.getImageData(0, 0, canvas.width, canvas.height).data,
        data = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3];
      this.hitMask = {
        data,
        width: canvas.width,
        height: canvas.height,
        scaleX: canvas.width / this.image.naturalWidth,
        scaleY: canvas.height / this.image.naturalHeight,
      };
    } catch {
      /* Preserve generous pivot-aware selection when canvas readback is unsupported. */
    }
    return this.hitMask;
  }
}
