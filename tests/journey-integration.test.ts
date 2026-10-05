import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createGame, serializeGame, restoreGame, stepGame } from "../src/sim";
import {
  CAMPAIGN,
  CAMPAIGNS,
  ACHIEVEMENTS,
  validateCampaign,
} from "../src/ui/content";
import {
  createCampaignSession,
  installMission,
} from "../src/ui/campaigns/runtime";
import {
  createExpedition,
  visitExpeditionNode,
  expeditionBattle,
  saveExpedition,
  finishExpeditionBattle,
  chooseExpeditionReward,
} from "../src/ui/campaigns/expedition";
import {
  expeditionCheckpoint,
  restoreExpeditionCheckpoint,
  restoreBattleJourney,
} from "../src/ui/campaigns/session";
import {
  campaignCardsHTML,
  missionCardsHTML,
  missionBriefingHTML,
  missionObjectivesHTML,
  expeditionHTML,
} from "../src/ui/campaigns/view";
import {
  migrateProfile,
  recordBattleResult,
} from "../src/ui/progression/profile";
import { commandRecordHTML } from "../src/ui/progression/view";
const matchId = "battle:integration";
function campaignFixture() {
  const chapter = CAMPAIGN.missions[0],
    state = createGame(chapter.settings);
  installMission(state, chapter);
  const record = {
    version: 2,
    matchId,
    campaignSession: createCampaignSession(CAMPAIGN.id, chapter.id, matchId),
    expedition: null,
    game: serializeGame(state),
  };
  return { state, record };
}
function expeditionFixture() {
  const run = visitExpeditionNode(createExpedition("JOURNEY"), "foothold");
  const state = createGame(expeditionBattle(run).settings);
  const record = {
    version: 2,
    matchId,
    campaignSession: null,
    expedition: saveExpedition(run),
    game: serializeGame(state),
  };
  return { run, state, record };
}
describe("public authored content and rendered journeys", () => {
  it("uses one shared eight-chapter, two-campaign facade and 30 achievements", () => {
    expect(CAMPAIGNS.map(validateCampaign)).toEqual([[], []]);
    expect(CAMPAIGNS.flatMap((c) => c.missions)).toHaveLength(8);
    expect(ACHIEVEMENTS).toHaveLength(30);
    const profile = migrateProfile(null);
    expect(campaignCardsHTML(CAMPAIGNS, profile)).toContain("The Ember Road");
    expect(missionCardsHTML(CAMPAIGN, profile)).toContain("disabled");
  });
  it("puts actual mission goals in its briefing and objective checklist", () => {
    const { state } = campaignFixture(),
      chapter = CAMPAIGN.missions[0];
    for (const objective of chapter.objectives) {
      expect(missionBriefingHTML(chapter)).toContain(objective.title);
      expect(missionObjectivesHTML(state, chapter)).toContain(objective.title);
    }
  });
  it("renders route, choice, battle and outcome actions from the saved run phase", () => {
    const { run } = expeditionFixture(),
      profile = migrateProfile(null);
    expect(expeditionHTML(null, profile)).toContain("expedition-start");
    expect(expeditionHTML(run, profile)).toContain("expedition-resume");
    const route = finishExpeditionBattle(run, true);
    expect(expeditionHTML(route, profile)).toContain("expedition-node");
    const shop = visitExpeditionNode(route, "caravan");
    expect(expeditionHTML(shop, profile)).toContain("70 crowns");
    expect(expeditionHTML(shop, profile)).toContain("expedition-choice");
    expect(
      expeditionHTML(chooseExpeditionReward(shop, "steel"), profile),
    ).toContain("Save route");
    expect(
      expeditionHTML(finishExpeditionBattle(run, false), profile),
    ).toContain("expedition-new");
  });
  it("renders categories, hidden goals, earned choices, usage and history", () => {
    const html = commandRecordHTML(migrateProfile(null));
    for (const text of [
      "record-category",
      "Secret achievement",
      "Earned choices",
      "Faction use",
      "Commander use",
      "Recent battles",
    ])
      expect(html).toContain(text);
  });
});
describe("campaign save identity and expedition checkpoints", () => {
  it("keeps fired chapter triggers and stable match identity through restore", () => {
    const { state, record } = campaignFixture();
    stepGame(state, 5);
    const restored = restoreGame(serializeGame(state));
    expect(restoreBattleJourney(record, restored, "unused")).toMatchObject({
      matchId,
      campaign: { missionId: "outpost" },
    });
    expect(restored.triggers.find((t) => t.id === "welcome")?.fired).toBe(true);
    expect(() => installMission(restored, CAMPAIGN.missions[0])).toThrow(
      /fresh battle/,
    );
  });
  it.each(["bad-match", "bad-chapter", "bad-seed", "missing-trigger"])(
    "rejects mismatched campaign metadata: %s",
    (field) => {
      const { state, record } = campaignFixture();
      if (field === "bad-match") record.campaignSession.matchId = "another";
      if (field === "bad-chapter")
        record.campaignSession.missionId = "not-a-chapter";
      if (field === "bad-seed") state.settings.seed = "OTHER";
      if (field === "missing-trigger") state.triggers = [];
      expect(() => restoreBattleJourney(record, state, "legacy")).toThrow();
    },
  );
  it("resumes legacy engine saves without installing new chapter objectives", () => {
    const { state } = campaignFixture(),
      before = serializeGame(state);
    expect(
      restoreBattleJourney(
        { version: 1, missionIndex: 0 },
        state,
        "legacy:123",
      ),
    ).toEqual({ matchId: "legacy:123", campaign: null, expedition: null });
    expect(serializeGame(state)).toBe(before);
  });
  it("stores an independent checkpoint and reconstructs expedition rewards from its journal", () => {
    const { run, record } = expeditionFixture(),
      checkpoint = expeditionCheckpoint(run, record);
    (checkpoint.run as any).crowns = 999999;
    (checkpoint.run as any).bonuses = { damage: 999 };
    const restored = restoreExpeditionCheckpoint(checkpoint)!;
    expect(restored.run).toEqual(run);
    expect(restored.battle).toEqual(record);
  });
  it("never reuses an earlier encounter checkpoint after advancing the route", () => {
    const { run, record } = expeditionFixture(),
      route = finishExpeditionBattle(run, true);
    expect(
      restoreExpeditionCheckpoint(expeditionCheckpoint(route, record)),
    ).toEqual({ run: route, battle: null });
    const next = visitExpeditionNode(
      chooseExpeditionReward(visitExpeditionNode(route, "haven"), "grain"),
      "woodland",
    );
    expect(
      restoreExpeditionCheckpoint(expeditionCheckpoint(next, record)),
    ).toEqual({ run: next, battle: null });
  });
  it("keeps a valid route when its encounter checkpoint is damaged", () => {
    const { run, record } = expeditionFixture();
    expect(
      restoreExpeditionCheckpoint(
        expeditionCheckpoint(run, { ...record, game: "{bad" }),
      ),
    ).toEqual({ run, battle: null });
    expect(
      restoreExpeditionCheckpoint({
        version: 1,
        run: { version: 1, journal: [{ nodeId: "citadel", victory: true }] },
      }),
    ).toBeNull();
  });
  it("rejects combined campaign and expedition metadata", () => {
    const { state, record } = campaignFixture();
    expect(() =>
      restoreBattleJourney(
        { ...record, expedition: saveExpedition(expeditionFixture().run) },
        state,
        "legacy",
      ),
    ).toThrow();
  });
});
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("v2 profile storage migration", () => {
  it("preserves legacy wins/unlocks and reloads nested and nullable v2 fields", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const { loadProfile, writeLocal } = await import("../src/platform/storage");
    writeLocal("profile", {
      version: 1,
      games: 4,
      wins: 3,
      campaign: 2,
      unlocked: ["first-victory"],
    });
    const legacy = loadProfile();
    expect(legacy.version).toBe(2);
    expect(legacy.completedMissions[CAMPAIGN.id]).toEqual([
      "outpost",
      "hold-line",
    ]);
    expect(legacy.achievements["first-victory"].unlockedAt).toBeNull();
    const state = createGame();
    state.winner = 0;
    state.time = 42;
    const result = recordBattleResult(legacy, state, {
      matchId,
      endedAt: "2026-10-04T21:00:00Z",
    });
    writeLocal("profile", result.profile);
    expect(loadProfile()).toEqual(result.profile);
    expect(loadProfile().fastestVictory).toBe(42);
    expect(loadProfile().history[0].id).toBe(matchId);
  });
  it("falls back safely on blocked or corrupted profile storage", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "{bad" });
    const { loadProfile } = await import("../src/platform/storage");
    expect(loadProfile().version).toBe(2);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
    });
    expect(loadProfile().games).toBe(0);
  });
});
