import { describe, expect, it } from "vitest";
import {
  createGame,
  issueCommand,
  restoreGame,
  serializeGame,
  spawnEntity,
  stepGame,
  updateFog,
} from "../src/sim";
import type { GameState, ScriptCondition } from "../src/sim/types";
import {
  FRONTIER_CAMPAIGN,
  STORY_CAMPAIGNS,
  validateAuthoredCampaign,
} from "../src/ui/campaigns/authored";
import {
  availableMissionIds,
  completedMissionIds,
  createCampaignSession,
  installMission,
  missionObjectiveProgress,
  restoreCampaignSession,
} from "../src/ui/campaigns/runtime";
import {
  EXPEDITION_NODES,
  chooseExpeditionReward,
  createExpedition,
  expeditionBattle,
  expeditionOptions,
  finishExpeditionBattle,
  restoreExpedition,
  saveExpedition,
  startUnlockedExpedition,
  validateExpedition,
  visitExpeditionNode,
} from "../src/ui/campaigns/expedition";
import {
  ACHIEVEMENT_DEFINITIONS,
  createProfile,
  migrateProfile,
  recordBattleResult,
  selectProfileBanner,
  challengeSettings,
} from "../src/ui/progression/profile";
import {
  achievementGridHTML,
  commandRecordHTML,
} from "../src/ui/progression/view";

/** Controlled fixtures establish exact rule/save semantics, not human-play balance. */
function satisfy(state: GameState, condition: ScriptCondition) {
  switch (condition.type) {
    case "all":
      condition.conditions.forEach((child) => satisfy(state, child));
      break;
    case "any":
      satisfy(state, condition.conditions[0]);
      break;
    case "owned":
      state.map.nodes
        .filter((node) => node.kind === condition.kind)
        .slice(0, condition.count)
        .forEach((node) => (node.owner = condition.team));
      break;
    case "units":
      for (let i = 0; i < condition.count; i++)
        spawnEntity(
          state,
          condition.team,
          "unit",
          condition.unit ?? "swordsman",
          state.map.spawns[condition.team].x + 4,
          state.map.spawns[condition.team].y + 4,
        );
      break;
    case "buildings":
      for (let i = 0; i < condition.count; i++)
        spawnEntity(
          state,
          condition.team,
          "building",
          condition.building ?? "house",
          state.map.spawns[condition.team].x + 4 + i * 2,
          state.map.spawns[condition.team].y + 4,
        );
      break;
    case "stat":
      state.players[condition.team].stats[condition.stat] = condition.amount;
      break;
    case "research":
      state.players[condition.team].research[condition.technology] =
        condition.level;
      break;
    case "teamDefeated":
      state.players[condition.team].defeated = true;
      state.entities
        .filter((entity) => entity.team === condition.team)
        .forEach((entity) => (entity.hp = 0));
      break;
    case "time":
      state.time = condition.seconds;
      state.tick = Math.round(condition.seconds / 0.1);
      break;
    default:
      throw new Error(`Test fixture does not support ${condition.type}`);
  }
}
const quiet = (state: GameState) => {
  state.players.forEach((player) => (player.ai = false));
  state.entities.forEach((entity) => (entity.damage = 0));
};

describe("authored chapter contracts", () => {
  it("validates two complete data-only campaigns with distinct objective sequences", () => {
    expect(STORY_CAMPAIGNS.map(validateAuthoredCampaign)).toEqual([[], []]);
    expect(STORY_CAMPAIGNS.map((campaign) => campaign.missions.length)).toEqual(
      [5, 3],
    );
    expect(
      new Set(
        STORY_CAMPAIGNS.flatMap((campaign) =>
          campaign.missions.map((mission) =>
            JSON.stringify(mission.objectives),
          ),
        ),
      ).size,
    ).toBe(8);
    expect(ACHIEVEMENT_DEFINITIONS).toHaveLength(30);
    expect(new Set(ACHIEVEMENT_DEFINITIONS.map((item) => item.id)).size).toBe(
      30,
    );
  });
  for (const campaign of STORY_CAMPAIGNS)
    for (const mission of campaign.missions) {
      it(`${campaign.id}/${mission.id}: exact required objectives produce a saved, restorable victory`, () => {
        const state = createGame(mission.settings);
        installMission(state, mission);
        quiet(state);
        expect(state.map.validation.valid).toBe(true);
        stepGame(state, 0.1);
        expect(state.winner).toBeNull();
        state.players[0].score = state.scoreTarget * 5;
        stepGame(state, 0.1);
        expect(state.winner).toBeNull();
        for (const objective of mission.objectives.filter(
          (item) => !item.optional,
        ))
          satisfy(state, objective.condition);
        expect(
          missionObjectiveProgress(state, mission)
            .filter((item) => !item.objective.optional)
            .every((item) => item.complete),
        ).toBe(true);
        const restored = restoreGame(serializeGame(state));
        quiet(restored);
        stepGame(restored, 0.2);
        expect(restored.winner).toBe(0);
        expect(
          restored.triggers.find((trigger) => trigger.id === "mission-complete")
            ?.fired,
        ).toBe(true);
      });
      it(`${mission.id}: a lost keep yields defeat and retry starts with fresh triggers`, () => {
        const state = createGame(mission.settings);
        installMission(state, mission);
        quiet(state);
        // Broken Alliance must still lose when our keep falls during its truce.
        stepGame(state, 0.1);
        const keep = state.entities.find(
          (entity) => entity.team === 0 && entity.type === "keep",
        )!;
        keep.hp = 1;
        const siege = spawnEntity(
          state,
          1,
          "unit",
          "siege",
          keep.x + 4,
          keep.y,
        );
        updateFog(state);
        expect(
          issueCommand(state, {
            type: "attack",
            team: 1,
            entityIds: [siege.id],
            targetId: keep.id,
          }).ok,
        ).toBe(true);
        stepGame(state, 0.2);
        expect(state.winner).not.toBeNull();
        expect(state.winner).not.toBe(0);
        const retry = createGame(mission.settings);
        installMission(retry, mission);
        expect(retry.winner).toBeNull();
        expect(retry.triggers.every((trigger) => !trigger.fired)).toBe(true);
        expect(retry.map.tiles).toEqual(createGame(mission.settings).map.tiles);
      });
    }
  it("keeps legacy chapter unlocks and validates serialized chapter identity", () => {
    const profile = migrateProfile({
      campaign: 2,
      campaignProgress: {},
      games: 2,
      wins: 2,
    });
    expect([...completedMissionIds(FRONTIER_CAMPAIGN, profile)]).toEqual([
      "outpost",
      "hold-line",
    ]);
    expect([...availableMissionIds(FRONTIER_CAMPAIGN, profile)]).toContain(
      "broken-alliance",
    );
    expect([...availableMissionIds(FRONTIER_CAMPAIGN, profile)]).not.toContain(
      "ironwatch",
    );
    const session = createCampaignSession(
      FRONTIER_CAMPAIGN.id,
      "outpost",
      "match-123",
    );
    expect(restoreCampaignSession(JSON.parse(JSON.stringify(session)))).toEqual(
      session,
    );
    expect(
      restoreCampaignSession({ ...session, missionId: "missing" }),
    ).toBeNull();
  });
  it("uses mission connections rather than array indices for branching chapter unlocks", () => {
    const branch = structuredClone(FRONTIER_CAMPAIGN);
    branch.id = "branched-story";
    branch.missions[0].next = [branch.missions[3].id];
    const profile = createProfile();
    profile.campaignProgress[branch.id] = 4;
    profile.completedMissions[branch.id] = [branch.missions[0].id];
    const available = availableMissionIds(branch, profile);
    expect(available.has(branch.missions[3].id)).toBe(true);
    expect(available.has(branch.missions[1].id)).toBe(false);
    expect(available.has(branch.missions[4].id)).toBe(false);
  });
});
function opening() {
  return finishExpeditionBattle(
    visitExpeditionNode(createExpedition("BRANCH-TEST"), "foothold"),
    true,
  );
}
function choose(
  run: ReturnType<typeof createExpedition>,
  node: string,
  choice: string,
) {
  return chooseExpeditionReward(visitExpeditionNode(run, node), choice);
}
function win(run: ReturnType<typeof createExpedition>, node: string) {
  return finishExpeditionBattle(visitExpeditionNode(run, node), true);
}

describe("branching expedition", () => {
  it("enforces charter unlocks at the UI entry point", () => {
    expect(() =>
      startUnlockedExpedition(createProfile(), "LOCKED", {
        loadout: "vanguard",
      }),
    ).toThrow(/Earn/);
    expect(
      startUnlockedExpedition(migrateProfile({ campaign: 3 }), "UNLOCKED", {
        loadout: "vanguard",
      }).loadout,
    ).toBe("vanguard");
  });
  it("walks every affordable complete route and every node class without a dead end", () => {
    let endings = 0;
    const kinds = new Set<string>();
    const walk = (run: ReturnType<typeof createExpedition>) => {
      expect(restoreExpedition(saveExpedition(run))).toEqual(run);
      if (run.phase === "completed") {
        endings++;
        expect(run.victories).toBe(4);
        return;
      }
      expect(expeditionOptions(run).length).toBeGreaterThan(0);
      for (const node of expeditionOptions(run)) {
        kinds.add(node.kind);
        const visited = visitExpeditionNode(run, node.id);
        if (visited.phase === "battle")
          walk(finishExpeditionBattle(visited, true));
        else
          for (const choice of node.choices!)
            if ((choice.cost ?? 0) <= visited.crowns)
              walk(chooseExpeditionReward(visited, choice.id));
      }
    };
    walk(createExpedition("EVERY-ROUTE"));
    expect(endings).toBe(1080);
    expect(kinds.size).toBe(7);
  });
  it("defines every promised node class and only valid forward routes", () => {
    expect(validateExpedition()).toEqual([]);
    expect(new Set(EXPEDITION_NODES.map((node) => node.kind))).toEqual(
      new Set(["battle", "elite", "village", "shop", "relic", "event", "boss"]),
    );
    expect(() =>
      visitExpeditionNode(createExpedition("ROUTE"), "citadel"),
    ).toThrow(/route/);
  });
  it("village supplies affect only the player's future battle and survive reload", () => {
    const run = choose(opening(), "haven", "timber"),
      battleRun = visitExpeditionNode(run, "woodland"),
      battle = expeditionBattle(battleRun),
      state = createGame(battle.settings);
    expect(state.players[0].wood).toBe(390);
    expect(state.players[1].wood).toBe(260);
    expect(restoreExpedition(saveExpedition(battleRun))).toEqual(battleRun);
    expect(
      expeditionBattle(restoreExpedition(saveExpedition(battleRun))!),
    ).toEqual(battle);
    expect(restoreGame(serializeGame(state)).players[0].wood).toBe(390);
  });
  it("shops charge crowns once and damage/health rewards change actual entities", () => {
    const run = choose(opening(), "caravan", "steel");
    expect(run.crowns).toBe(60);
    expect(() => chooseExpeditionReward(run, "steel")).toThrow(/current stop/);
    const improved = createGame(
        expeditionBattle(visitExpeditionNode(run, "woodland")).settings,
      ),
      baseline = createGame({ ...improved.settings, modifiers: undefined });
    expect(
      improved.entities.find(
        (entity) => entity.team === 0 && entity.kind === "commander",
      )!.damage,
    ).toBeCloseTo(
      baseline.entities.find(
        (entity) => entity.team === 0 && entity.kind === "commander",
      )!.damage * 1.12,
    );
    expect(
      improved.entities.find(
        (entity) => entity.team === 1 && entity.kind === "commander",
      )!.damage,
    ).toBe(
      baseline.entities.find(
        (entity) => entity.team === 1 && entity.kind === "commander",
      )!.damage,
    );
    expect(
      restoreExpedition({
        ...saveExpedition(run),
        crowns: 100000,
        bonuses: { damage: 999 },
      }),
    ).toEqual(run);
  });
  it("event tradeoffs and both charters have actual, player-only effects", () => {
    const event = choose(opening(), "crossroads", "escort"),
      state = createGame(
        expeditionBattle(visitExpeditionNode(event, "woodland")).settings,
      );
    expect(state.players[0].wood).toBe(230);
    expect(state.players[1].wood).toBe(260);
    const forager = createGame(
      expeditionBattle(
        visitExpeditionNode(
          createExpedition("FORAGER", { loadout: "forager" }),
          "foothold",
        ),
      ).settings,
    );
    expect([forager.players[0].gold, forager.players[0].wood]).toEqual([
      190, 360,
    ]);
    expect([forager.players[1].gold, forager.players[1].wood]).toEqual([
      230, 260,
    ]);
    const vanguard = createGame(
      expeditionBattle(
        visitExpeditionNode(
          createExpedition("VANGUARD", { loadout: "vanguard" }),
          "foothold",
        ),
      ).settings,
    );
    expect(vanguard.settings.modifiers?.players?.[0]).toMatchObject({
      damage: 1.1,
      health: 0.92,
    });
  });
  it("completes a route through elite/relic/shop/boss and preserves all seven save boundaries", () => {
    let run = createExpedition("FULL-RUN");
    for (const [node, choice] of [
      ["foothold", ""],
      ["caravan", "steel"],
      ["redoubt", ""],
      ["relic", "oak"],
      ["iron-gate", ""],
      ["last-shop", "arsenal"],
      ["citadel", ""],
    ]) {
      run = visitExpeditionNode(run, node);
      expect(restoreExpedition(saveExpedition(run))).toEqual(run);
      run = choice
        ? chooseExpeditionReward(run, choice)
        : finishExpeditionBattle(run, true);
      expect(restoreExpedition(saveExpedition(run))).toEqual(run);
    }
    expect(run.phase).toBe("completed");
    expect(run.victories).toBe(4);
    expect(run.journal).toHaveLength(7);
    expect(expeditionOptions(run)).toEqual([]);
    expect(() => finishExpeditionBattle(run, true)).toThrow();
  });
  it("rejects unaffordable choices and forged journals; defeat ends the run", () => {
    let run = choose(opening(), "caravan", "steel");
    run = win(run, "woodland");
    run = choose(run, "refugees", "shelter");
    run = win(run, "ice-road");
    run = visitExpeditionNode(run, "last-shop");
    const emptyPurse = { ...run, crowns: 0 };
    expect(() => chooseExpeditionReward(emptyPurse, "arsenal")).toThrow(
      /crowns/,
    );
    expect(chooseExpeditionReward(emptyPurse, "leave").phase).toBe("route");
    expect(
      restoreExpedition({
        ...saveExpedition(opening()),
        journal: [{ nodeId: "citadel", victory: true }],
      }),
    ).toBeNull();
    const lost = finishExpeditionBattle(
      visitExpeditionNode(choose(opening(), "haven", "healers"), "redoubt"),
      false,
    );
    expect(lost.phase).toBe("defeated");
    expect(restoreExpedition(saveExpedition(lost))).toEqual(lost);
  });
});

describe("persistent record", () => {
  it("records an allied winner as a victory for the local player", () => {
    const state = createGame({
      seed: "ALLIED-RECORD",
      aiPlayers: 2,
      faction: "wildborn",
      commander: "ranger",
    });
    state.players[0].alliance = 7;
    state.players[1].alliance = 7;
    state.players[0].defeated = true;
    state.players[0].stats.commanderDeaths = 1;
    state.winner = 1;
    state.time = 540;
    state.victoryReason = "Your alliance controls the frontier.";
    const result = recordBattleResult(createProfile(), state, {
      matchId: "allied-win",
    });
    expect(result.recorded).toBe(true);
    expect(result.profile.wins).toBe(1);
    expect(result.profile.streak).toBe(1);
    expect(result.profile.fastestVictory).toBe(540);
    expect(result.profile.factionUsage.wildborn.wins).toBe(1);
    expect(result.profile.commanderUsage.ranger.wins).toBe(1);
    expect(result.earned).toContain("first-victory");
    expect(result.earned).not.toContain("survivor");
    expect(result.profile.history[0]).toMatchObject({
      victory: true,
      reason: "Your alliance controls the frontier.",
    });
  });
  it("records final local-alliance defeat while unrelated rivals keep fighting", () => {
    const state = createGame({ seed: "EARLY-ALLIANCE-LOSS", aiPlayers: 3 });
    state.players[0].alliance = 7;
    state.players[1].alliance = 7;
    state.players[0].defeated = true;
    state.players[1].defeated = true;
    state.time = 210;
    expect(state.winner).toBeNull();
    const profile = createProfile();
    profile.streak = 2;
    const result = recordBattleResult(profile, state, {
      matchId: "early-loss",
    });
    expect(result.recorded).toBe(true);
    expect(result.profile.games).toBe(1);
    expect(result.profile.wins).toBe(0);
    expect(result.profile.streak).toBe(0);
    expect(result.profile.fastestVictory).toBeNull();
    expect(result.profile.history[0]).toMatchObject({
      victory: false,
      reason: "Your Command Keep has fallen.",
    });
    state.winner = 2;
    expect(
      recordBattleResult(result.profile, state, { matchId: "early-loss" })
        .recorded,
    ).toBe(false);
  });
  it("does not record a premature loss for a spectator whose allies can still win", () => {
    const state = createGame({ seed: "SPECTATOR-RECORD", aiPlayers: 2 });
    state.players[0].alliance = 7;
    state.players[1].alliance = 7;
    state.players[0].defeated = true;
    const profile = createProfile();
    expect(() =>
      recordBattleResult(profile, state, { matchId: "spectating" }),
    ).toThrow(/unfinished/);
    expect(profile.games).toBe(0);
    state.players[0].defeated = false;
    expect(() =>
      recordBattleResult(profile, state, { matchId: "playing" }),
    ).toThrow(/unfinished/);
  });
  it("records scripted personal defeat even with surviving allies and no global result", () => {
    const state = createGame({
      seed: "SCRIPTED-RECORD-LOSS",
      aiPlayers: 2,
      scriptedVictory: true,
    });
    state.players[0].alliance = 7;
    state.players[1].alliance = 7;
    state.players[0].defeated = true;
    state.time = 180;
    const result = recordBattleResult(createProfile(), state, {
      matchId: "scripted-loss",
      campaignId: "rise-of-the-frontier",
      missionId: "broken-alliance",
      unlocks: ["loadout-vanguard"],
    });
    expect(result.profile.history[0].victory).toBe(false);
    expect(result.profile.games).toBe(1);
    expect(
      result.profile.completedMissions["rise-of-the-frontier"],
    ).toBeUndefined();
    expect(result.profile.choices).not.toContain("loadout-vanguard");
    state.winner = 1;
    expect(
      recordBattleResult(createProfile(), state, {
        matchId: "scripted-ally-win",
      }).profile.wins,
    ).toBe(0);
  });
  it("completes every campaign's unlock chain independently and preserves it through JSON reload", () => {
    let profile = createProfile();
    for (const campaign of STORY_CAMPAIGNS)
      for (const [index, chapter] of campaign.missions.entries()) {
        expect(availableMissionIds(campaign, profile).has(chapter.id)).toBe(
          true,
        );
        const state = createGame(chapter.settings);
        state.winner = 0;
        state.time = 600;
        const result = recordBattleResult(profile, state, {
          matchId: `${campaign.id}-${chapter.id}`,
          campaignId: campaign.id,
          missionId: chapter.id,
          missionIndex: index,
          unlocks: chapter.unlocks,
        });
        profile = migrateProfile(JSON.parse(JSON.stringify(result.profile)));
        for (const unlock of chapter.unlocks)
          expect(profile.choices).toContain(unlock);
        expect(completedMissionIds(campaign, profile).has(chapter.id)).toBe(
          true,
        );
      }
    expect(profile.campaign).toBe(5);
    expect(profile.campaignProgress["ember-road"]).toBe(3);
    expect(profile.achievements.legend.unlocked).toBe(true);
    expect(profile.achievements["ember-road"].unlocked).toBe(true);
    expect(profile.history).toHaveLength(8);
  });
  it("bounds history, retains fastest victories, and resets streaks on loss", () => {
    let profile = createProfile();
    const state = createGame({ seed: "LONG-HISTORY" });
    for (let index = 0; index < 55; index++) {
      state.winner = index === 54 ? 1 : 0;
      state.time = 100 + index;
      profile = recordBattleResult(profile, state, {
        matchId: `history-${index}`,
      }).profile;
    }
    expect(profile.games).toBe(55);
    expect(profile.wins).toBe(54);
    expect(profile.history).toHaveLength(50);
    expect(profile.fastestVictory).toBe(100);
    expect(profile.bestStreak).toBe(54);
    expect(profile.streak).toBe(0);
    expect(profile.history[0].id).toBe("history-54");
    expect(profile.history[49].id).toBe("history-5");
  });
  it("preserves legacy aggregate victories and unlocked dates honestly", () => {
    const profile = migrateProfile({
      version: 1,
      games: 10,
      wins: 7,
      kills: 130,
      seconds: 4000,
      campaign: 5,
      expedition: 1,
      unlocked: ["first-victory", "legend"],
      campaignProgress: {},
    });
    expect(profile.version).toBe(2);
    expect(profile.games).toBe(10);
    expect(profile.kills).toBe(130);
    expect(profile.achievements["first-victory"]).toEqual({
      progress: 1,
      unlocked: true,
      unlockedAt: null,
    });
    expect(profile.choices).toContain("loadout-forager");
    expect(profile.choices).toContain("banner-wayfinder");
    expect(profile.factionUsage.ironhold.games).toBe(0);
  });
  it("records one result once, with resource/usage/history totals and timestamped unlocks", () => {
    const state = createGame({
      seed: "RECORD",
      commander: "ranger",
      faction: "wildborn",
    });
    state.winner = 0;
    state.time = 375;
    state.victoryReason = "Objectives complete";
    state.players[0].stats.goldCollected = 2300;
    state.players[0].stats.kills = 60;
    const context = {
      matchId: "match-one",
      endedAt: "2026-10-04T19:00:00Z",
      campaignId: "rise-of-the-frontier",
      missionId: "outpost",
      missionIndex: 0,
      unlocks: ["banner-founder"],
    };
    const result = recordBattleResult(createProfile(), state, context);
    expect(result.recorded).toBe(true);
    expect(result.earned).toContain("first-victory");
    expect(result.profile.achievements.economist.unlockedAt).toBe(
      "2026-10-04T19:00:00.000Z",
    );
    expect(result.profile.commanderUsage.ranger.wins).toBe(1);
    expect(result.profile.factionUsage.wildborn.games).toBe(1);
    expect(result.profile.totals.goldCollected).toBe(2300);
    expect(result.profile.fastestVictory).toBe(375);
    expect(result.profile.history[0].missionId).toBe("outpost");
    expect(recordBattleResult(result.profile, state, context).recorded).toBe(
      false,
    );
    expect(
      recordBattleResult(result.profile, state, context).profile.games,
    ).toBe(1);
    expect(
      selectProfileBanner(result.profile, "banner-founder").selectedBanner,
    ).toBe("banner-founder");
    expect(() =>
      selectProfileBanner(createProfile(), "banner-legend"),
    ).toThrow();
  });
  it("tracks progress without prematurely revealing hidden achievements", () => {
    const state = createGame({ seed: "PROGRESS" });
    state.winner = 1;
    state.time = 600;
    state.players[0].stats.kills = 45;
    const result = recordBattleResult(createProfile(), state, {
      matchId: "lost-one",
    });
    expect(result.profile.achievements.century.progress).toBe(45);
    expect(result.profile.achievements.century.unlocked).toBe(false);
    expect(achievementGridHTML(result.profile, "challenges")).toContain(
      "Secret achievement",
    );
    expect(achievementGridHTML(result.profile, "challenges")).not.toContain(
      "One Last Breath",
    );
    expect(result.profile.fastestVictory).toBeNull();
    expect(result.profile.streak).toBe(0);
    expect(() => challengeSettings(result.profile, "TEST")).toThrow();
    state.winner = 0;
    state.settings.difficulty = "hard";
    expect(
      challengeSettings(
        recordBattleResult(result.profile, state, { matchId: "hard-one" })
          .profile,
        "TEST",
      ).difficulty,
    ).toBe("brutal");
  });
  it("sanitizes malformed records and safely escapes imported history text", () => {
    const state = createGame({ seed: "ESCAPE" });
    state.winner = 0;
    state.victoryReason = '<img src=x onerror="alert(1)">';
    const result = recordBattleResult(createProfile(), state, {
      matchId: "safe",
    });
    expect(commandRecordHTML(result.profile)).not.toContain("<img src=x");
    const migrated = migrateProfile({
      games: -4,
      wins: Infinity,
      history: [{ id: "x", endedAt: "broken" }],
      factionUsage: { ironhold: { games: -4, wins: 999 } },
      unlocked: ["not-real"],
      choices: ["not-real"],
    });
    expect(migrated.games).toBe(0);
    expect(migrated.history).toEqual([]);
    expect(migrated.unlocked).toEqual([]);
    expect(migrated.factionUsage.ironhold.wins).toBe(0);
  });
});
