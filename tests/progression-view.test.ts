import { describe, expect, it } from "vitest";
import { createGame, issueCommand } from "../src/sim";
import {
  createProfile,
  migrateProfile,
  recordBattleResult,
  type ProfileV2,
} from "../src/ui/progression/profile";
import { achievementGridHTML } from "../src/ui/progression/view";

const pendingExplanation =
  "Progress recorded. Awarded after you finish another battle without surrender.";

function watchfulCard(profile: ProfileV2) {
  const card = achievementGridHTML(profile, "milestones")
    .match(/<article\b[\s\S]*?<\/article>/g)
    ?.find((article) => article.includes("<h3>Watchful Commander</h3>"));
  expect(card).toBeDefined();
  return card!;
}

describe("achievement pending explanation", () => {
  it("keeps achievements below their target in progress", () => {
    const profile = migrateProfile({ seconds: 3599.9 });
    const card = watchfulCard(profile);
    expect(card).toContain("3,599 / 3,600");
    expect(card).not.toContain("achievement-pending");
    expect(card).not.toContain(" · earned");
  });

  it.each([3600, 3601])(
    "explains a visible unearned achievement at %i progress without awarding it",
    (progress) => {
      const profile = createProfile();
      profile.achievements.hour = {
        progress,
        unlocked: false,
        unlockedAt: null,
      };
      const before = structuredClone(profile);
      const card = watchfulCard(profile);
      expect(card).toContain(pendingExplanation);
      expect(card).not.toContain(" · earned");
      expect(card).not.toContain("achievement-date");
      expect(profile).toEqual(before);
    },
  );

  it.each(["2026-10-09T05:00:00.000Z", null])(
    "preserves earned achievement presentation with date %s",
    (unlockedAt) => {
      const profile = migrateProfile({
        achievements: {
          hour: { progress: 3600, unlocked: true, unlockedAt },
        },
      });
      const card = watchfulCard(profile);
      expect(card).toContain(" · earned");
      expect(card).toContain(
        unlockedAt
          ? "Earned Oct 9, 2026 (UTC)"
          : "Earned before detailed records began",
      );
      expect(card).not.toContain(pendingExplanation);
    },
  );

  it("keeps hidden achievements secret even when recorded progress reaches the target", () => {
    const profile = migrateProfile({
      achievements: {
        "last-banner": { progress: 1, unlocked: false, unlockedAt: null },
      },
    });
    const html = achievementGridHTML(profile, "challenges");
    expect(html).toContain("Secret achievement");
    expect(html).not.toContain("One Last Breath");
    expect(html).not.toContain("at most 10% health");
    expect(html).not.toContain(pendingExplanation);
  });

  it("removes the pending note when an ordinary defeat awards surrendered progress", () => {
    // Controlled result fixtures verify presentation against the existing policy.
    const surrender = createGame({ seed: "PENDING-ACHIEVEMENT" });
    surrender.time = 3600;
    expect(issueCommand(surrender, { type: "surrender", team: 0 }).ok).toBe(true);
    const pending = recordBattleResult(createProfile(), surrender, {
      matchId: "pending:surrender",
      endedAt: "2026-10-09T04:00:00Z",
    });
    expect(pending.earned).toEqual([]);
    expect(watchfulCard(pending.profile)).toContain(pendingExplanation);

    const reloaded = migrateProfile(JSON.parse(JSON.stringify(pending.profile)));
    expect(watchfulCard(reloaded)).toContain(pendingExplanation);
    const defeat = createGame({ seed: "PENDING-ORDINARY-DEFEAT" });
    defeat.winner = 1;
    defeat.time = 30;
    defeat.victoryReason = "Your Command Keep has fallen.";
    const earned = recordBattleResult(reloaded, defeat, {
      matchId: "pending:ordinary-defeat",
      endedAt: "2026-10-09T05:00:00Z",
    });
    expect(earned.earned).toContain("hour");
    expect(earned.profile.wins).toBe(0);
    expect(watchfulCard(earned.profile)).toContain(" · earned");
    expect(watchfulCard(earned.profile)).not.toContain(pendingExplanation);
  });
});
