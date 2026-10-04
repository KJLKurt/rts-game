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
  Cost,
  Entity,
  GameState,
  ProductionItem,
  TechId,
  UnitId,
} from "../sim";
import { escapeText as esc } from "./escape";
import { icon } from "./icons";

const money = (cost: Cost) =>
  `<span class="cost"><span>${icon("gold")}${cost.gold}</span><span>${icon("wood")}${cost.wood}</span></span>`;
const action = (text: string, name: string, id = "", extra = "") =>
  `<button data-action="${name}" data-id="${esc(id)}" ${extra}>${esc(text)}</button>`;
export function productionName(item: ProductionItem, building: Entity): string {
  return item.type === "unit"
    ? UNITS[item.id as UnitId].name
    : item.type === "research"
      ? TECHNOLOGIES[item.id as TechId].name
      : (nextBuildingUpgrade(building)?.name ?? "Building upgrade");
}

export function inspectionHTML(
  state: GameState,
  selection: Iterable<string>,
): string {
  const chosen = new Set(selection),
    entities = state.entities.filter((e) => chosen.has(e.id) && e.hp > 0);
  if (entities.length !== 1)
    return `<div class="inspection"><h3>${entities.length} units selected</h3><p>Tap ground to move this group. Tap an enemy to focus attacks, or a deposit to capture it. Hold keeps the group still; Move lets it follow a safe route.</p><p>Select one soldier or building to inspect its role, statistics, and upgrades.</p></div>`;
  const e = entities[0];
  if (e.kind === "building" && e.type !== "turret") {
    const definition = BUILDINGS[e.type as BuildingId],
      level = buildingLevel(e),
      next = nextBuildingUpgrade(e),
      max = 1 + BUILDING_UPGRADES[e.type as BuildingId].length;
    const construction = e.buildProgress < 1;
    const recruits = definition.recruits
      .map((id) => {
        const u = UNITS[id];
        return `<div class="inspect-action"><span><b>${u.name}</b><small>${u.population} population · ${Math.ceil(u.trainTime / productionRate(e))}s</small>${money(getUnitCost(state, e.team, id))}</span>${action("Train", "recruit", id, construction ? "disabled" : `aria-label="Train ${u.name} here"`)}</div>`;
      })
      .join("");
    const tech = Object.values(TECHNOLOGIES)
      .filter((t) => t.building === e.type)
      .map((t) => {
        const current = state.players[e.team].research[t.id] ?? 0,
          queued = state.entities.some(
            (b) =>
              b.team === e.team &&
              b.queue.some((q) => q.type === "research" && q.id === t.id),
          );
        return `<div class="inspect-action"><span><b>${t.name} · ${current}/${t.maxLevel}</b><small>${esc(t.description)}</small>${current < t.maxLevel ? money(technologyCost(state, e.team, t.id)) : ""}</span>${action(current >= t.maxLevel ? "Complete" : queued ? "Queued" : "Research", "research", t.id, construction || current >= t.maxLevel || queued ? "disabled" : "")}</div>`;
      })
      .join("");
    const queuedUpgrade = e.queue.some((q) => q.type === "buildingUpgrade");
    return `<div class="inspection"><div class="inspect-heading"><div><h3>${definition.name}</h3><p>${esc(definition.description)}</p></div><span class="level-badge">Level ${level}/${max}</span></div><div class="inspect-stats"><span><b>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</b> health</span>${definition.population ? `<span><b>+${buildingPopulation(e)}</b> population</span>` : ""}${e.damage ? `<span><b>${Math.round(e.damage)}</b> damage · ${e.range.toFixed(1)} range</span>` : ""}</div>${construction ? `<p class="construction-progress">Under construction · ${Math.round(e.buildProgress * 100)}% · ${Math.ceil((1 - e.buildProgress) * e.buildTime)}s remaining</p>` : ""}${e.type === "house" ? "<p>Houses give your army room to grow. Troops in training reserve population immediately. Houses do not produce workers.</p>" : e.type === "keep" ? "<p>Your keep provides a small steady supply of gold and wood. Capture deposits for most of your income. Losing this keep ends your battle.</p>" : e.type === "depot" ? `<p>Captured deposits within 7 tiles gain ${35 + (level - 1) * 15}% income. Depot bonuses do not stack; the best nearby depot applies.</p>` : ""}${recruits ? `<h4>Train here</h4><div class="inspect-actions">${recruits}</div><p class="inspect-rally">New troops ${e.rally ? `rally at ${Math.round(e.rally.x)}, ${Math.round(e.rally.y)}` : "join your commander"}. ${action("Set rally point", "set-rally", e.id, construction ? "disabled" : "")}</p>` : ""}${tech ? `<h4>Research for your army</h4><div class="inspect-actions">${tech}</div>` : ""}<h4>Building development</h4><div class="inspect-action"><span><b>${next ? `${next.name} · level ${level + 1}/${max}` : "Fully upgraded"}</b><small>${next ? esc(next.description) : "This building has reached its maximum level."}</small>${next ? money(next.cost) : ""}</span>${next ? action(queuedUpgrade ? "Upgrade queued" : `Upgrade · ${next.time}s`, "upgrade-building", e.id, construction || queuedUpgrade ? "disabled" : "") : ""}</div></div>`;
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
  return `<div class="inspection"><div class="inspect-heading"><div><h3>${definition?.name ?? "Runic Turret"}</h3><p>${esc(definition?.description ?? "Temporary automatic defense.")}</p></div></div><div class="inspect-stats"><span><b>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</b> health</span><span><b>${Math.round(e.damage)}</b> base damage</span><span><b>${e.range.toFixed(1)}</b> base range</span><span><b>${e.armor}</b> base armor</span></div>${counters ? `<p>Strong against ${counters}. Protect vulnerable ranged and support troops with a frontline.</p>` : ""}${e.kind === "commander" ? `<div class="inspect-actions">${COMMANDERS[state.settings.commander].abilities.map((a) => `<article><b>${a.name} · ${a.cooldown}s cooldown</b><p>${esc(a.description)}</p></article>`).join("")}</div><p>Move with the thumbstick or WASD. Tap ground for a pathfinding move order. Nearby enemies are attacked automatically. Commander Mastery research at the keep improves health and cooldowns.</p>` : "<p>Army-wide upgrades are shown in Research. Select this soldier and tap a destination, enemy, or resource to give a specific order.</p>"}</div>`;
}

export function productionHTML(state: GameState, selected?: string): string {
  const buildings = state.entities
    .filter(
      (e) =>
        e.team === 0 && e.kind === "building" && e.hp > 0 && e.queue.length,
    )
    .sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  if (!buildings.length && !state.pendingCommands.length) return "";
  return `<div class="production-list"><h4>Production queues <small>Paid jobs reserve population</small></h4>${buildings
    .map(
      (b) =>
        `<div class="producer"><button class="producer-name" data-action="inspect-building" data-id="${esc(b.id)}">${BUILDINGS[b.type as BuildingId]?.name ?? "Building"} · ${b.queue.length}/12</button><ol>${b.queue
          .map((q, i) => {
            const refund = productionRefund(state, b, q),
              seconds =
                q.remaining /
                (q.type === "buildingUpgrade" ? 1 : productionRate(b));
            return `<li><span class="job-number">${i + 1}</span><div><b>${esc(productionName(q, b))}</b><small>${i === 0 ? `${Math.ceil(seconds)}s remaining` : `${Math.ceil(seconds)}s · waiting`}</small>${i === 0 ? `<progress max="${q.total}" value="${q.total - q.remaining}" aria-label="Production progress"></progress>` : ""}</div>${action("Cancel", "cancel-production", `${b.id}|${q.queueId}`, `aria-label="Cancel ${esc(productionName(q, b))}; refund ${refund.gold} gold and ${refund.wood} wood" title="Refund ${refund.gold} gold and ${refund.wood} wood"`)}</li>`;
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
