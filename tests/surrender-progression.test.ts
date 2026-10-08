import { describe, expect, it, vi } from "vitest";
import { ResultCommit } from "../src/platform/result-commit";
import {
  createGame,
  issueCommand,
  restoreGame,
  serializeGame,
} from "../src/sim";
import {
  hasPlayerSurrendered,
  playerAllianceWon,
  SURRENDER_REASON,
} from "../src/sim/alliances";
import {
  chooseExpeditionReward,
  createExpedition,
  expeditionBattle,
  expeditionOptions,
  finishExpeditionBattle,
  restoreExpedition,
  saveExpedition,
  visitExpeditionNode,
} from "../src/ui/campaigns/expedition";
import {
  expeditionCheckpoint,
  restoreBattleJourney,
  restoreExpeditionCheckpoint,
} from "../src/ui/campaigns/session";
import {
  createProfile,
  migrateProfile,
  recordBattleResult,
} from "../src/ui/progression/profile";

const endedAt = "2026-10-08T20:00:00Z";

function establishedProfile() {
  return migrateProfile({
    games: 4,
    wins: 2,
    streak: 2,
    bestStreak: 2,
    kills: 95,
    totals: { kills: 95 },
    campaign: 1,
    fastestVictory: 200,
    unlocked: ["first-victory"],
    selectedBanner: "banner-founder",
  });
}

function thresholdBattle() {
  const state = createGame({
    seed: "SURRENDER-PROGRESSION",
    difficulty: "hard",
    mapSize: "small",
  });
  state.time = 60;
  state.players[0].stats.kills = 5;
  state.players[0].stats.captures = 1;
  state.players[0].stats.pauses = 1;
  return state;
}

function laterEncounter() {
  let run = finishExpeditionBattle(
    visitExpeditionNode(createExpedition("SURRENDER-ROUTE"), "foothold"),
    true,
  );
  run = chooseExpeditionReward(visitExpeditionNode(run, "haven"), "timber");
  return visitExpeditionNode(run, "woodland");
}

describe("surrender progression", () => {
  it("records one labelled loss and battle stats without granting new achievements or victory rewards", () => {
    const original = establishedProfile();
    const state = thresholdBattle();
    expect(issueCommand(state, { type: "surrender", team: 0 }).ok).toBe(true);
    const context = {
      matchId: "battle:surrender-rewards",
      endedAt,
      campaignId: "rise-of-the-frontier",
      missionId: "hold-line",
      unlocks: ["loadout-forager"],
      expeditionCompleted: true,
    };
    const result = recordBattleResult(original, state, context);
    expect(result.recorded).toBe(true);
    expect(result.earned).toEqual([]);
    expect(result.choices).toEqual([]);
    expect(result.profile).toMatchObject({
      games: original.games + 1,
      wins: original.wins,
      streak: 0,
      bestStreak: original.bestStreak,
      seconds: original.seconds + state.time,
      kills: 100,
      campaign: original.campaign,
      expedition: original.expedition,
      fastestVictory: original.fastestVictory,
      selectedBanner: original.selectedBanner,
    });
    expect(result.profile.completedMissions).toEqual(
      original.completedMissions,
    );
    expect(result.profile.campaignProgress).toEqual(original.campaignProgress);
    expect(result.profile.choices).toEqual(original.choices);
    expect(result.profile.unlocked).toEqual(original.unlocked);
    expect(result.profile.factionUsage[state.settings.faction].wins).toBe(0);
    expect(result.profile.commanderUsage[state.settings.commander].wins).toBe(
      0,
    );
    expect(result.profile.totals.kills).toBe(100);
    expect(result.profile.totals.captures).toBe(1);
    expect(result.profile.history).toHaveLength(1);
    expect(result.profile.history[0]).toMatchObject({
      id: context.matchId,
      victory: false,
      reason: SURRENDER_REASON,
      seconds: state.time,
      stats: { kills: 5, captures: 1 },
    });
    for (const id of ["veteran", "century", "capture", "tactician", "hard"])
      expect(result.profile.achievements[id].unlocked).toBe(false);

    const reloaded = migrateProfile(JSON.parse(JSON.stringify(result.profile)));
    expect(reloaded.unlocked).toEqual(original.unlocked);
    expect(reloaded.choices).toEqual(original.choices);
    const repeated = recordBattleResult(
      reloaded,
      restoreGame(serializeGame(state)),
      context,
    );
    expect(repeated.recorded).toBe(false);
    expect(repeated.earned).toEqual([]);
    expect(repeated.choices).toEqual([]);
    expect(repeated.profile).toEqual(reloaded);
    expect(original.games).toBe(4);
    expect(original.streak).toBe(2);
  });

  it("continues to grant ordinary defeat achievements earned through play", () => {
    const state = thresholdBattle();
    state.winner = 1;
    state.victoryReason = "The rival claimed the relics.";
    const result = recordBattleResult(establishedProfile(), state, {
      matchId: "battle:ordinary-defeat",
      endedAt,
    });
    expect(result.earned).toEqual(
      expect.arrayContaining(["veteran", "century", "capture", "tactician"]),
    );
    expect(result.profile.wins).toBe(2);
    expect(result.profile.history[0].victory).toBe(false);
  });

  it("cannot earn allied victory rewards after conceding with surviving allies", () => {
    const state = createGame({
      seed: "SURRENDER-ALLIED-RECORD",
      mapSize: "small",
      aiPlayers: 2,
    });
    state.players[2].alliance = state.players[0].alliance;
    expect(issueCommand(state, { type: "surrender", team: 0 }).ok).toBe(true);
    // A stale or subsequently assigned global winner never changes the local concession.
    state.winner = 2;
    const result = recordBattleResult(createProfile(), state, {
      matchId: "battle:surrendered-ally",
      endedAt,
    });
    expect(result.profile.games).toBe(1);
    expect(result.profile.wins).toBe(0);
    expect(result.profile.history[0]).toMatchObject({
      victory: false,
      reason: SURRENDER_REASON,
    });
    expect(result.earned).toEqual([]);
  });

  it("ends an expedition without discarding its journal or granting the lost encounter's rewards", () => {
    const run = laterEncounter();
    const before = structuredClone(run);
    const state = createGame(expeditionBattle(run).settings);
    expect(issueCommand(state, { type: "surrender", team: 0 }).ok).toBe(true);
    const defeated = finishExpeditionBattle(run, playerAllianceWon(state));
    expect(run).toEqual(before);
    expect(defeated.phase).toBe("defeated");
    expect(defeated.journal).toEqual([
      ...run.journal,
      { nodeId: "woodland", victory: false },
    ]);
    expect(defeated.crowns).toBe(run.crowns);
    expect(defeated.bonuses).toEqual(run.bonuses);
    expect(defeated.victories).toBe(run.victories);
    expect(defeated.activeNode).toBeNull();
    expect(expeditionOptions(defeated)).toEqual([]);
    expect(restoreExpedition(saveExpedition(defeated))).toEqual(defeated);
    expect(
      restoreExpeditionCheckpoint(expeditionCheckpoint(defeated, null)),
    ).toEqual({ run: defeated, battle: null });
    expect(() => finishExpeditionBattle(defeated, false)).toThrow();
  });
});

function recoveryFixture() {
  const run = laterEncounter();
  const state = createGame(expeditionBattle(run).settings);
  const matchId = "battle:surrender-recovery";
  const liveBattle = {
    version: 2,
    matchId,
    campaignSession: null,
    expedition: saveExpedition(run),
    game: serializeGame(state),
  };
  const originalRoute = expeditionCheckpoint(run, liveBattle);
  const records = new Map<string, unknown>([
    ["battle", liveBattle],
    ["expedition", originalRoute],
  ]);
  let storedProfile = createProfile();
  expect(issueCommand(state, { type: "surrender", team: 0 }).ok).toBe(true);
  const context = { matchId, endedAt, expeditionNode: run.activeNode! };
  const result = recordBattleResult(storedProfile, state, context);
  const defeated = finishExpeditionBattle(run, false);
  const snapshot = {
    battle: { ...liveBattle, game: serializeGame(state) },
    profile: result.profile,
    expedition: expeditionCheckpoint(defeated, null),
  };
  const storage = {
    saveRecord: vi.fn(async (key: string, value: unknown) => {
      records.set(key, structuredClone(value));
    }),
    writeLocal: vi.fn((_key: string, value: unknown) => {
      storedProfile = migrateProfile(structuredClone(value));
      return true;
    }),
    removeRecord: vi.fn(async (key: string) => {
      records.delete(key);
    }),
  };
  return {
    run,
    defeated,
    context,
    originalRoute,
    records,
    snapshot,
    storage,
    profile: () => storedProfile,
  };
}

describe("surrender result recovery", () => {
  it("leaves the previous save and expedition safe if the finished checkpoint cannot be written", async () => {
    const f = recoveryFixture();
    f.storage.saveRecord.mockRejectedValueOnce(new Error("Checkpoint quota"));
    const commit = new ResultCommit(f.snapshot, f.storage);
    await expect(commit.commit()).rejects.toThrow("Checkpoint quota");
    expect(commit.recoverable).toBe(false);
    expect(f.profile().games).toBe(0);
    expect(f.records.get("expedition")).toEqual(f.originalRoute);
    expect(
      hasPlayerSurrendered(
        restoreGame((f.records.get("battle") as typeof f.snapshot.battle).game),
      ),
    ).toBe(false);
    expect(f.storage.removeRecord).not.toHaveBeenCalled();
    await commit.commit();
    expect(f.profile().games).toBe(1);
    expect(f.profile().wins).toBe(0);
    expect(f.records.has("battle")).toBe(false);
    expect(
      restoreExpeditionCheckpoint(f.records.get("expedition"))?.run,
    ).toEqual(f.defeated);
  });

  it.each(["profile", "route", "cleanup"] as const)(
    "reloads a %s failure as the same conceded loss without duplicate rewards or route deletion",
    async (stage) => {
      const f = recoveryFixture();
      if (stage === "profile") f.storage.writeLocal.mockReturnValueOnce(false);
      if (stage === "route") {
        const save = f.storage.saveRecord.getMockImplementation()!;
        f.storage.saveRecord
          .mockImplementationOnce(save)
          .mockRejectedValueOnce(new Error("Route quota"));
      }
      if (stage === "cleanup")
        f.storage.removeRecord.mockRejectedValueOnce(
          new Error("Cleanup quota"),
        );
      const commit = new ResultCommit(f.snapshot, f.storage);
      await expect(commit.commit()).rejects.toThrow();
      expect(commit.recoverable).toBe(true);
      expect(f.profile().games).toBe(stage === "profile" ? 0 : 1);
      expect(f.records.has("expedition")).toBe(true);
      expect(
        f.storage.removeRecord.mock.calls.every(([key]) => key === "battle"),
      ).toBe(true);

      const battle = f.records.get("battle") as typeof f.snapshot.battle;
      const restored = restoreGame(battle.game);
      expect(hasPlayerSurrendered(restored)).toBe(true);
      const journey = restoreBattleJourney(battle, restored, "unused");
      expect(journey.matchId).toBe(f.context.matchId);
      const originalRun = restoreExpedition(journey.expedition)!;
      expect(originalRun).toEqual(f.run);
      const result = recordBattleResult(f.profile(), restored, f.context);
      expect(result.recorded).toBe(stage === "profile");
      expect(result.earned).toEqual([]);
      const defeated = finishExpeditionBattle(
        originalRun,
        playerAllianceWon(restored),
      );
      const retry = new ResultCommit(
        {
          battle,
          profile: result.profile,
          expedition: expeditionCheckpoint(defeated, null),
        },
        f.storage,
      );
      await Promise.all([retry.commit(), retry.commit()]);
      await retry.commit();
      expect(f.profile().games).toBe(1);
      expect(f.profile().wins).toBe(0);
      expect(f.profile().history).toHaveLength(1);
      expect(f.profile().history[0]).toMatchObject({
        id: f.context.matchId,
        victory: false,
        reason: SURRENDER_REASON,
      });
      expect(f.profile().recordedMatchIds).toEqual([f.context.matchId]);
      expect(f.profile().unlocked).toEqual([]);
      expect(f.profile().expedition).toBe(0);
      expect(f.records.has("battle")).toBe(false);
      expect(restoreExpeditionCheckpoint(f.records.get("expedition"))).toEqual({
        run: f.defeated,
        battle: null,
      });
    },
  );
});
