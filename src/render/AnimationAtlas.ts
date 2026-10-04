export interface AnimationFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  groundPivot: { x: number; y: number };
}
export interface AnimatedActor {
  referenceBodyHeight: number;
  suggestedHeight: number;
  walkFrameMs: number;
  attackFrameMs: number[];
  impactFrame: number;
  walk: string[];
  attack: string[];
}
export interface AnimationData {
  version: number;
  image: string;
  width: number;
  height: number;
  actors: Record<string, AnimatedActor>;
  frames: Record<string, AnimationFrame>;
}
export interface AnimationPose {
  attackAge: number;
  anticipation: number;
  moving: boolean;
  travel: number;
}
/** Frame choice is visual only. The release frame starts at the existing hit event. */
export function animationFrame(
  actor: AnimatedActor,
  pose: AnimationPose,
): string | undefined {
  if (pose.attackAge >= 0 && pose.attackAge < Infinity) {
    let elapsed = pose.attackAge * 1000;
    for (let i = actor.impactFrame; i < actor.attack.length; i++) {
      if (elapsed < actor.attackFrameMs[i]) return actor.attack[i];
      elapsed -= actor.attackFrameMs[i];
    }
  }
  if (pose.anticipation > 0) {
    return actor.attack[
      Math.min(
        actor.impactFrame - 1,
        Math.floor(pose.anticipation * actor.impactFrame),
      )
    ];
  }
  if (pose.moving && actor.walk.length > 0)
    return actor.walk[
      Math.floor(((pose.travel / 2.3) * 1000) / actor.walkFrameMs) %
        actor.walk.length
    ];
  return undefined;
}
export function validAnimationData(data: AnimationData): boolean {
  if (
    !data ||
    typeof data !== "object" ||
    data.version !== 1 ||
    typeof data.image !== "string" ||
    !data.image ||
    !data.actors ||
    !data.frames ||
    !(data.width > 0) ||
    !(data.height > 0)
  )
    return false;
  return (
    Object.values(data.actors).length > 0 &&
    Object.values(data.actors).every(
      (actor) =>
        actor &&
        typeof actor === "object" &&
        actor.referenceBodyHeight > 0 &&
        actor.suggestedHeight > 0 &&
        actor.walkFrameMs > 0 &&
        Array.isArray(actor.walk) &&
        (actor.walk.length === 0 || actor.walk.length === 4) &&
        Array.isArray(actor.attack) &&
        actor.attack.length === 4 &&
        Number.isInteger(actor.impactFrame) &&
        actor.impactFrame > 0 &&
        actor.impactFrame < 4 &&
        Array.isArray(actor.attackFrameMs) &&
        actor.attackFrameMs.length === 4 &&
        actor.attackFrameMs.every((ms) => ms > 0) &&
        [...actor.walk, ...actor.attack].every((id) => {
          const f = data.frames[id];
          return (
            f &&
            f.w > 0 &&
            f.h > 0 &&
            f.x >= 0 &&
            f.y >= 0 &&
            f.x + f.w <= data.width &&
            f.y + f.h <= data.height &&
            Number.isFinite(f.groundPivot?.x) &&
            Number.isFinite(f.groundPivot?.y)
          );
        }),
    )
  );
}
/** An optional, independently validated multi-frame sheet. Missing art never breaks play. */
export class AnimationAtlas {
  image: HTMLImageElement | null = null;
  data: AnimationData | null = null;
  async load(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      const data = (await response.json()) as AnimationData;
      if (!validAnimationData(data)) return false;
      const image = new Image();
      image.src = new URL(data.image, new URL(url, document.baseURI)).href;
      await image.decode();
      if (
        image.naturalWidth !== data.width ||
        image.naturalHeight !== data.height
      )
        return false;
      this.image = image;
      this.data = data;
      return true;
    } catch {
      return false;
    }
  }
  /** Only approved attack poses are exposed to the live renderer. Walk strips are not enabled. */
  attackFrame(
    actor: string,
    attackAge: number,
    anticipation: number,
    reducedMotion = false,
  ) {
    if (reducedMotion || !this.image) return undefined;
    const definition = this.data?.actors[actor];
    return definition
      ? animationFrame(definition, {
          attackAge,
          anticipation,
          moving: false,
          travel: 0,
        })
      : undefined;
  }
  draw(
    c: CanvasRenderingContext2D,
    actor: string,
    frameId: string,
    height?: number,
  ): boolean {
    const definition = this.data?.actors[actor],
      frame = this.data?.frames[frameId];
    if (!this.image || !definition || !frame) return false;
    if (!definition.attack.includes(frameId)) return false;
    const scale =
      (height ?? definition.suggestedHeight) / definition.referenceBodyHeight;
    // Constant actor-body scale and per-frame ground pivot prevent breathing-size and foot sliding.
    c.drawImage(
      this.image,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -frame.groundPivot.x * scale,
      -frame.groundPivot.y * scale,
      frame.w * scale,
      frame.h * scale,
    );
    return true;
  }
}
