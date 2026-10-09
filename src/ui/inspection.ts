import { learningActionAvailable } from "./learning";
import {
  BUILDINGS,
  COMMANDERS,
  TECHNOLOGIES,
  UNITS,
  BUILDING_UPGRADES,
  buildingLevel,
  buildingPopulation,
  nextBuildingUpgrade,
  populationBreakdown,
  productionRate,
  productionRefund,
  technologyCost,
  getEconomyRates,
  getUnitCost,
} from "../sim";
import type {
  BuildingId,
  Entity,
  GameState,
  ProductionItem,
  TechId,
  UnitId,
} from "../sim";
import { escapeText as esc } from "./escape";
import { icon } from "./icons";
import { rallyDestination, orderDescription, selectedOrderDescription } from "./command-guidance";
import { resourceCostHTML } from "./battle-readouts";
import { buildingInspectionAvailability } from "./inspection-availability";
import type { InspectionActionAvailability } from "./inspection-availability";
export { inspectionAvailabilitySignature } from "./inspection-availability";

const availabilityHTML = (status: InspectionActionAvailability) => status.reason
  ? `<small class="availability-reason">${esc(status.reason)}</small>`
  : "";
const availabilityAttributes = (status: InspectionActionAvailability, label: string) =>
  `${status.available ? "" : "disabled"} aria-label="${esc(`${label}${status.reason ? `. ${status.reason}` : ""}`)}"`;
const action = (text: string, name: string, id = "", extra = "") =>
  `<button data-action="${name}" data-id="${esc(id)}" ${extra}>${esc(text)}</button>`;
export function productionName(item: ProductionItem, building: Entity): string {
  return item.type === "unit"
    ? UNITS[item.id as UnitId].name
    : item.type === "research"
      ? TECHNOLOGIES[item.id as TechId].name
      : (nextBuildingUpgrade(building)?.name ?? "Building upgrade");
}

/** Remaining game seconds; building development is never production-rate boosted. */
export function productionRemainingSeconds(
  item: ProductionItem,
  building: Entity,
): number {
  return (
    item.remaining /
    (item.type === "buildingUpgrade" ? 1 : productionRate(building))
  );
}

/** Read the supplied live or projected queues without applying pending commands. */
export function compactProductionSummary(
  state: Pick<GameState, "entities">,
  team = 0,
): { queued: number; nextSeconds: number | null } {
  let queued = 0,
    nextSeconds: number | null = null;
  for (const building of state.entities) {
    if (
      building.team !== team ||
      building.kind !== "building" ||
      building.hp <= 0 ||
      !building.queue.length
    )
      continue;
    queued += building.queue.length;
    // Producers work in parallel, but only the first job in each queue is active.
    const seconds = productionRemainingSeconds(building.queue[0], building);
    nextSeconds = nextSeconds === null ? seconds : Math.min(nextSeconds, seconds);
  }
  return { queued, nextSeconds };
}

/** Mirror the engine's selected-producer / shortest-queue routing for UI estimates. */
export function recruitProducer(
  state: GameState,
  unit: UnitId,
  selectedId?: string,
  team = 0,
) {
  const selected = state.entities.find(
    (e) => e.id === selectedId && e.team === team && e.hp > 0,
  );
  const specific =
    selected &&
    selected.kind === "building" &&
    BUILDINGS[selected.type as BuildingId]?.recruits.includes(unit)
      ? selected.id
      : undefined;
  return state.entities
    .filter(
      (e) =>
        e.team === team &&
        e.kind === "building" &&
        e.hp > 0 &&
        e.buildProgress >= 1 &&
        BUILDINGS[e.type as BuildingId]?.recruits.includes(unit) &&
        (!specific || e.id === specific),
    )
    .sort((a, b) => a.queue.length - b.queue.length)[0];
}
export function trainingSeconds(
  state: GameState,
  unit: UnitId,
  producer: Entity,
) {
  return (
    (UNITS[unit].trainTime *
      (state.players[producer.team].research.logistics ? 0.85 : 1)) /
    productionRate(producer)
  );
}
export function capacityGainText(
  state: GameState,
  amount: number,
  team = 0,
): string {
  const player = state.players[team];
  const gain = Math.max(
    0,
    Math.min(amount, player.maxPopulation - player.populationCap),
  );
  return gain === 0
    ? "Match ceiling reached; no additional capacity"
    : gain < amount
      ? `+${gain} capacity now (match ceiling ${player.maxPopulation})`
      : `+${gain} capacity`;
}
export function constructionProgressText(entity: Entity): string {
  return `Under construction · ${Math.round(entity.buildProgress * 100)}% · ${Math.ceil((1 - entity.buildProgress) * entity.buildTime)}s remaining`;
}
/** Only changing readouts update during construction/combat; action controls stay put. */
export function refreshInspection(
  root: HTMLElement,
  state: GameState,
  selection: Iterable<string>,
) {
  const chosen = new Set(selection);
  const entities = state.entities.filter((e) => chosen.has(e.id) && e.hp > 0);
  const order = root.querySelector("[data-inspect-order]");
  if (order) order.textContent = selectedOrderDescription(state, chosen);
  if (entities.length !== 1) return;
  const entity = entities[0];
  const health = root.querySelector("[data-inspect-health]");
  if (health)
    health.textContent = `${Math.ceil(entity.hp)} / ${Math.ceil(entity.maxHp)}`;
  const construction = root.querySelector("[data-construction-progress]");
  if (construction) construction.textContent = constructionProgressText(entity);
}

export function inspectionHTML(
  state: GameState,
  selection: Iterable<string>,
  learningStep?: number | null,
  selectedTab: "train" | "upgrades" | "info" = "info",
  tacticalQueueFull = state.paused && state.pendingCommands.length >= 60,
): string {
  const chosen = new Set(selection),
    entities = state.entities.filter((e) => chosen.has(e.id) && e.hp > 0);
  if (entities.length !== 1)
    return `<div class="inspection"><h3>${entities.length} units selected</h3><p data-inspect-order>${esc(selectedOrderDescription(state, chosen))}</p><p>Choose Move then a destination, or Attack then an enemy. Tap a deposit then Capture. Capture engages nearby enemies around its target. Hold does not pursue; Move prioritizes its destination.</p><p>Select one soldier or building to inspect its role, statistics, and upgrades.</p></div>`;
  const e = entities[0];
  if (e.kind === "building" && e.type !== "turret") {
    const definition = BUILDINGS[e.type as BuildingId],
      level = buildingLevel(e),
      next = nextBuildingUpgrade(e),
      max = 1 + BUILDING_UPGRADES[e.type as BuildingId].length;
    const construction = e.buildProgress < 1;
    const available = buildingInspectionAvailability(state, e, tacticalQueueFull);
    const recruits = definition.recruits
      .filter((id) => learningActionAvailable(learningStep, "recruit", id))
      .map((id) => {
        const u = UNITS[id], status = available.recruits[id]!;
        return `<div class="inspect-action"><span><b>${u.name}</b><small>${u.population} population · ${Math.ceil(trainingSeconds(state, id, e))}s</small>${resourceCostHTML(getUnitCost(state, e.team, id))}${availabilityHTML(status)}</span>${action("Train", "recruit", id, availabilityAttributes(status, `Train ${u.name} here`))}</div>`;
      })
      .join("");
    const tech = Object.values(TECHNOLOGIES)
      .filter(
        (t) =>
          t.building === e.type &&
          learningActionAvailable(learningStep, "research", t.id),
      )
      .map((t) => {
        const current = state.players[e.team].research[t.id] ?? 0,
          queued = state.entities.some(
            (b) =>
              b.team === e.team &&
              b.queue.some((q) => q.type === "research" && q.id === t.id),
          );
        const status = available.research[t.id]!;
        return `<div class="inspect-action"><span><b>${t.name} · ${current}/${t.maxLevel}</b><small>${esc(t.description)}</small>${current < t.maxLevel ? resourceCostHTML(technologyCost(state, e.team, t.id)) : ""}${availabilityHTML(status)}</span>${action(current >= t.maxLevel ? "Complete" : queued ? "Queued" : "Research", "research", t.id, availabilityAttributes(status, `Research ${t.name} here`))}</div>`;
      })
      .join("");
    const queuedUpgrade = e.queue.some((q) => q.type === "buildingUpgrade");
    const upgradeUnlocked = learningActionAvailable(
      learningStep,
      "upgradeBuilding",
      e.type,
    );
    return `<div class="inspection"><div class="inspect-heading"><div><h3>${definition.name}</h3><p>${e.type === "house" ? `Provides up to ${buildingPopulation(e)} population capacity. Match ceiling: ${state.players[e.team].maxPopulation}.` : esc(definition.description)}</p></div><span class="level-badge">Level ${level}/${max}</span></div><div class="inspect-stats"><span><b data-inspect-health>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</b> health</span>${definition.population ? `<span><b>${buildingPopulation(e)}</b> capacity before match ceiling</span>` : ""}${e.damage ? `<span><b>${Math.round(e.damage)}</b> damage · ${e.range.toFixed(1)} range</span>` : ""}</div>${construction ? `<p class="construction-progress" data-construction-progress>${constructionProgressText(e)}</p>` : ""}${e.type === "house" ? "<p>Houses give your army room to grow. Troops in training reserve population immediately. Houses do not produce workers.</p>" : e.type === "keep" ? "<p>Your keep provides a small steady supply of gold and wood. Capture deposits for most of your income. Losing this keep ends your battle.</p>" : e.type === "depot" ? `<p>Captured deposits within 7 tiles gain ${35 + (level - 1) * 15}% income. Depot bonuses do not stack; the best nearby depot applies.</p>` : ""}<nav class="inspect-tabs" aria-label="Building actions">${[...(recruits ? [["train", "Train"]] : []), ["upgrades", "Upgrades"], ["info", "Info"]].map(([id,name]) => `<button data-action="inspect-tab" data-id="${id}" aria-pressed="${selectedTab === id}" class="${selectedTab === id ? "active" : ""}">${name}</button>`).join("")}</nav>${recruits ? `<section class="inspect-section" ${selectedTab === "train" ? "" : "hidden"}><h4>Train here</h4><div class="inspect-actions">${recruits}</div><p class="inspect-rally">${esc(rallyDestination(e))} ${action("Set rally point", "set-rally", e.id, construction ? "disabled" : "")}</p></section>` : ""}<section class="inspect-section" ${selectedTab === "upgrades" ? "" : "hidden"}>${tech ? `<h4>Research for your army</h4><div class="inspect-actions">${tech}</div>` : ""}<h4>Building development</h4><div class="inspect-action"><span><b>${next ? `${next.name} · level ${level + 1}/${max}` : "Fully upgraded"}</b><small>${next ? (next.population ? `${capacityGainText(state, next.population, e.team)}. +${Math.round(next.health * 100)}% durability.` : esc(next.description)) : "This building has reached its maximum level."}</small>${next ? resourceCostHTML(next.cost) : ""}${next && upgradeUnlocked ? availabilityHTML(available.upgrade) : ""}</span>${next && upgradeUnlocked ? action(queuedUpgrade ? "Upgrade queued" : `Upgrade · ${next.time}s`, "upgrade-building", e.id, availabilityAttributes(available.upgrade, `Upgrade ${definition.name} to ${next.name}`)) : next ? "<small>Building upgrades open later in the guide.</small>" : ""}</div></section><section class="inspect-section" ${selectedTab === "info" ? "" : "hidden"}><p>${esc(definition.description)}</p><p>${definition.recruits.length ? "Select Train to recruit here and choose a fixed rally point. Upgrades shows building development and supported research." : "This building does not train troops. Upgrades shows its supported development."}</p></section></div>`;
  }
  const definition =
    e.kind === "commander"
      ? COMMANDERS[e.type as keyof typeof COMMANDERS]
      : UNITS[e.type as UnitId];
  const counters =
    e.kind === "unit"
      ? Object.entries(UNITS[e.type as UnitId].counter)
          .filter(([, value]) => value > 1)
          .map(([id]) =>
            id === "building"
              ? "buildings"
              : UNITS[id as UnitId].name.toLowerCase(),
          )
          .join(", ")
      : "";
  return `<div class="inspection"><div class="inspect-heading"><div><h3>${definition?.name ?? "Runic Turret"}</h3><p>${esc(definition?.description ?? "Temporary automatic defense.")}</p></div></div><p data-inspect-order>${esc(orderDescription(state, e))}</p><div class="inspect-stats"><span><b data-inspect-health>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</b> health</span><span><b>${Math.round(e.damage)}</b> base damage</span><span><b>${e.range.toFixed(1)}</b> base range</span><span><b>${e.armor}</b> base armor</span></div>${counters ? `<p>Strong against ${counters}. Protect vulnerable ranged and support troops with a frontline.</p>` : ""}${e.kind === "commander" ? `<div class="inspect-actions">${COMMANDERS[state.settings.commander].abilities.map((a) => `<article><b>${a.name} · ${a.cooldown}s cooldown</b><p>${esc(a.description)}</p></article>`).join("")}</div><p>Move with the thumbstick or WASD. Choose Move then a destination for a pathfinding move order. Nearby enemies are attacked automatically. Commander Mastery research at the keep improves health and cooldowns.</p>` : "<p>Army-wide upgrades are shown in Research. Select this soldier, then choose Move or Attack. Select a resource and choose Capture to claim it.</p>"}</div>`;
}

export function productionHTML(state: GameState, selected?: string): string {
  const buildings = state.entities
    .filter(
      (e) =>
        e.team === 0 && e.kind === "building" && e.hp > 0 && e.queue.length,
    )
    .sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  if (!buildings.length && !state.pendingCommands.length) return "";
  return `<div class="production-list"><h4>Production queues <small>Paid jobs · Troops reserve population</small></h4>${buildings
    .map(
      (b) =>
        `<div class="producer" data-live-key="${esc(b.id)}"><button class="producer-name" data-action="inspect-building" data-id="${esc(b.id)}">${BUILDINGS[b.type as BuildingId]?.name ?? "Building"} · ${b.queue.length}/12</button>${b.queue.some((job) => job.type === "unit") ? `<p class="deck-tip producer-rally">${esc(rallyDestination(b))}</p>` : ""}<ol data-live-key="queue-${esc(b.id)}">${b.queue
          .map((q, i) => {
            const refund = productionRefund(state, b, q),
              seconds = productionRemainingSeconds(q, b);
            return `<li data-live-key="${esc(q.queueId ?? String(i))}"><span class="job-number">${i + 1}</span><div><b>${esc(productionName(q, b))}</b><small>${i === 0 ? `${Math.ceil(seconds)}s remaining` : `${Math.ceil(seconds)}s · waiting`}</small><small class="refund-amount">Cancel refund: ${refund.gold} gold · ${refund.wood} wood</small>${i === 0 ? `<progress max="${q.total}" value="${q.total - q.remaining}" aria-label="Production progress"></progress>` : ""}</div>${action("Cancel", "cancel-production", `${b.id}|${q.queueId}`, `aria-label="Cancel ${esc(productionName(q, b))}; refund ${refund.gold} gold and ${refund.wood} wood" title="Refund ${refund.gold} gold and ${refund.wood} wood"`)}</li>`;
          })
          .join("")}</ol></div>`,
    )
    .join(
      "",
    )}${state.paused && state.pendingCommands.length ? `<p class="planned-orders">${state.pendingCommands.length} tactical orders waiting for Resume. Production starts when the battle resumes.</p>` : ""}</div>`;
}

export function economyHTML(state: GameState): string {
  const p = state.players[0],
    pop = populationBreakdown(state),
    rates = getEconomyRates(state);
  const rows = state.map.nodes
    .filter((n) => n.owner === 0 && n.kind !== "relic")
    .map((n) => {
      const withdrawal = rates.withdrawals.find(
          (w) => state.map.nodes[w.nodeIndex].id === n.id,
        ),
        rate = (withdrawal?.amount ?? 0) / 0.1;
      return `<div class="inspect-action"><span><b>${n.kind === "gold" ? "Gold mine" : "Timber camp"}</b><small>${Math.ceil(n.amount)} left · +${rate.toFixed(1)}/s${n.amount <= 0 ? " · depleted" : ""}</small></span>${action("View", "view-resource", n.id)}</div>`;
    })
    .join("");
  return `<div class="economy-overview"><p><b>Gold and wood are your two resources.</b> Your captured mines and timber camps gather them automatically. Move your commander or soldiers onto a deposit and stay until your banner rises. You do not need to recruit workers. Stone is scenery, not a spendable resource.</p><div class="economy-totals"><div>${icon("gold")}<b>${Math.floor(p.gold)} Gold</b><span>+${rates.goldPerSecond.toFixed(1)} / game second</span></div><div>${icon("wood")}<b>${Math.floor(p.wood)} Wood</b><span>+${rates.woodPerSecond.toFixed(1)} / game second</span></div></div><h3>Your income sources</h3>${rows || "<p>No deposits held. Claim a gold mine and timber camp to grow.</p>"}<p class="muted">Your keep also supplies a small stipend. Research Efficient Harvest or build/upgrade a nearby Resource Depot to improve deposit income. A depleted deposit stops paying; capture another.</p><h3>Army capacity</h3><div class="population-breakdown"><span><b>${pop.fielded}</b> in the field</span><span><b>${pop.reserved}</b> in training</span><span><b>${pop.capacity}</b> current capacity</span><span><b>${pop.ceiling}</b> match ceiling</span></div><p>Build a House for +8 capacity, then upgrade it to +12 and +16. Capacity cannot exceed this match’s ceiling. Cavalry and Menders use 2 population; Runebreakers use 3. Your commander does not use population.</p>${action("Open Build", "economy-build")}${action("Find new gold", "find-gold")}${action("Find new timber", "find-wood")}</div>`;
}
