import type { Point } from "../sim/types";
import type { PlannedConstruction } from "../ui/queued-construction";
import { TILE_H, TILE_W, type Ctx } from "./art";
import type { ScreenRect } from "./troop-summary";

export const QUEUED_CONSTRUCTION_STYLE = {
  color: "#edc36b",
  underStroke: "#182a30",
  textColor: "#ffe6ad",
  font: "600 11px system-ui, sans-serif",
  lineWidth: 2,
  underWidth: 4,
  dash: [6, 5] as const,
};

export interface PlannedConstructionMarker {
  x: number;
  y: number;
  rx: number;
  ry: number;
  label?: ScreenRect & { text: string };
}

interface PlannedConstructionView {
  zoom: number;
  width: number;
  height: number;
  project: (x: number, y: number) => Point;
  visible: (x: number, y: number) => boolean;
  measureLabel: (text: string) => number;
  obstacles?: readonly ScreenRect[];
}

/** Ground-only presentation geometry. No entities, selection IDs or hit areas are created. */
export function plannedConstructionMarkers(
  plans: readonly PlannedConstruction[],
  view: PlannedConstructionView,
): PlannedConstructionMarker[] {
  if (!Number.isFinite(view.zoom) || view.zoom <= 0) return [];
  const markers: PlannedConstructionMarker[] = [];
  const labels: ScreenRect[] = [...(view.obstacles ?? [])];
  for (const plan of plans) {
    if (![plan.x, plan.y, plan.size].every(Number.isFinite) || plan.size <= 0 || !view.visible(plan.x, plan.y)) continue;
    const { x, y } = view.project(plan.x, plan.y);
    // Match the active placement's world-space diamond, without scaling line weight or text.
    const rx = plan.size * TILE_W * view.zoom, ry = plan.size * TILE_H * view.zoom;
    if (!Number.isFinite(x + y + rx + ry) || x + rx < -4 || x - rx > view.width + 4 || y + ry < -4 || y - ry > view.height + 4) continue;
    const marker: PlannedConstructionMarker = { x, y, rx, ry };
    const name = plan.name.length > 20 ? `${plan.name.slice(0, 19)}…` : plan.name;
    const text = `Queued ${name}`;
    const width = view.measureLabel(text) + 8;
    const label = { text, x: x - width / 2, y: y + ry + 4, w: width, h: 16 };
    const collides = labels.some(r => label.x < r.x + r.w + 4 && label.x + label.w + 4 > r.x && label.y < r.y + r.h + 4 && label.y + label.h + 4 > r.y);
    // Never squash labels at wide zoom or stack unreadable text over another badge/control.
    if (label.x >= 4 && label.x + width <= view.width - 4 && label.y >= 4 && label.y + label.h <= view.height - 4 && !collides) {
      marker.label = label;
      labels.push(label);
    }
    markers.push(marker);
  }
  return markers;
}

/** Static, cheap Canvas paths in CSS pixels for every quality/motion setting. */
export function drawPlannedConstructionMarkers(c: Ctx, markers: readonly PlannedConstructionMarker[]): void {
  if (!markers.length) return;
  const style = QUEUED_CONSTRUCTION_STYLE;
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  c.setLineDash([...style.dash]);
  c.lineDashOffset = 0;
  for (const { x, y, rx, ry } of markers) {
    c.beginPath();
    c.moveTo(x, y - ry);
    c.lineTo(x + rx, y);
    c.lineTo(x, y + ry);
    c.lineTo(x - rx, y);
    c.closePath();
    c.strokeStyle = style.underStroke;
    c.lineWidth = style.underWidth;
    c.stroke();
    c.strokeStyle = style.color;
    c.lineWidth = style.lineWidth;
    c.stroke();
  }
  c.setLineDash([]);
  c.font = style.font;
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const { label } of markers) {
    if (!label) continue;
    const x = label.x + label.w / 2, y = label.y + label.h / 2;
    c.lineWidth = 3;
    c.strokeStyle = style.underStroke;
    c.strokeText(label.text, x, y);
    c.fillStyle = style.textColor;
    c.fillText(label.text, x, y);
  }
  c.restore();
}
