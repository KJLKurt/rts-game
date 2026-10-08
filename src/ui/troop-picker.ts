import { COMMANDERS, UNITS } from "../sim/content";
import type { CommanderId, GameState, UnitId } from "../sim/types";
import { escapeText as esc } from "./escape";
import { troopSelectionGroups } from "./troop-selection";

/** Dialog body only. The caller applies each type checkbox's indeterminate property. */
export function troopPickerHTML(
  state: GameState,
  ids: Iterable<string>,
  team = 0,
): string {
  const selected = new Set(ids);
  const groups = troopSelectionGroups(state, selected, team);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const selectedCount = groups.reduce(
    (sum, group) => sum + group.selectedCount,
    0,
  );
  return `<div class="troop-picker">
    <p class="muted troop-picker-help">New recruits stay unselected.</p>
    <div class="troop-picker-toolbar"><button type="button" data-action="troop-select-all">All</button><button type="button" data-action="troop-select-none">None</button><p id="troop-selection-count" role="status" aria-live="polite" aria-atomic="true">${selectedCount} of ${total} troops selected</p></div>
    <div class="troop-picker-body">${
      groups.length
        ? groups
            .map(
              (
                group,
              ) => `<section class="troop-type-group" data-troop-group="${esc(group.typeKey)}">
      <label class="troop-type-row"><input type="checkbox" data-troop-type="${esc(group.typeKey)}"${group.checked ? " checked" : ""}><span>${esc(group.label)}</span><span class="troop-type-count" data-troop-type-count="${esc(group.typeKey)}">${group.selectedCount} / ${group.total} selected</span></label>
      <details class="troop-individuals"><summary>Choose individual troops</summary><div class="troop-unit-list">${group.entities
        .map((entity, index) => {
          const name =
            entity.kind === "commander"
              ? (COMMANDERS[entity.type as CommanderId]?.name ?? "Commander")
              : (UNITS[entity.type as UnitId]?.name ?? entity.type);
          const maximum = Math.max(1, Math.ceil(entity.maxHp));
          const health = Math.max(0, Math.min(maximum, Math.ceil(entity.hp)));
          return `<label class="troop-unit-row"><input type="checkbox" data-troop-id="${esc(entity.id)}"${selected.has(entity.id) ? " checked" : ""}><span>${esc(name)} ${index + 1}</span><span class="troop-unit-health">${health} / ${maximum} HP</span></label>`;
        })
        .join("")}</div></details>
    </section>`,
            )
            .join("")
        : '<p class="muted troop-picker-empty">No troops are available. Your commander may be recovering.</p>'
    }</div>
    <footer class="troop-picker-footer"><button type="button" data-action="close-dialog">Cancel</button><button type="button" class="primary" data-action="troop-select-apply">Apply</button></footer>
  </div>`;
}
