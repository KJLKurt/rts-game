import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/sim/content";
import { encodeMapCode } from "../src/ui/map-code";
import { selectSetupScale, prepareSetup } from "../src/ui/setup-model";
import {
  readSetupControls,
  renderSetupControls,
  renderSetupSummary,
} from "../src/ui/setup-view";
const form = (values: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    data.set(key, String(value));
  return data;
};
const quick = () =>
  selectSetupScale({ ...DEFAULT_SETTINGS, seed: "SETUP-TEST" }, "quick");

describe("complete skirmish form", () => {
  it("renders presets, bounded rules, every slot field and host actions", () => {
    const html = renderSetupControls(
      selectSetupScale(DEFAULT_SETTINGS, "epic"),
    );
    for (const id of ["quick", "standard", "epic", "custom"])
      expect(html).toContain(`data-id="${id}"`);
    for (const name of [
      "mapSize",
      "populationCap",
      "startingGold",
      "startingWood",
      "gameSpeed",
      "incomeRate",
      "resourceAbundance",
      "terrainRoughness",
      "water",
      "objectiveDensity",
      "weirdness",
      "neutralCamps",
      "playerCount",
      "slot-3-alliance",
      "slot-3-controller",
    ])
      expect(html).toContain(`name="${name}"`);
    for (const action of ["new-seed", "preview-setup", "copy-setup-code"])
      expect(html).toContain(`data-action="${action}"`);
    expect(html).toContain('aria-label="Map seed"');
    expect(html).toContain('maxlength="12000"');
  });
  it("escapes names and seeds rather than interpolating markup", () => {
    const settings = quick();
    settings.seed = "<script>bad</script>";
    settings.slots![0].name = '" onfocus="evil';
    const html = renderSetupControls(settings);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot; onfocus=&quot;evil");
  });
  it("disables v5-only controls while preserving legacy generator selection", () => {
    const html = renderSetupControls(DEFAULT_SETTINGS);
    expect(html).toContain('class="setup-slots" disabled');
    expect(html).toContain('class="setup-camp-control" disabled');
    expect(html).toContain('name="faction"');
    expect(html).toContain("Legacy generator preserved");
  });
  it("reads numeric custom settings without mutating previous data", () => {
    const previous = quick(),
      before = structuredClone(previous);
    const next = readSetupControls(
      form({
        duration: 120,
        mapSize: "colossal",
        startingGold: 1000,
        startingWood: 500,
        gameSpeed: 0.5,
        incomeRate: 2,
        populationCap: 200,
        resourceAbundance: 3,
        terrainRoughness: 1,
        water: 0.7,
        objectiveDensity: 1.5,
        weirdness: 0.4,
        neutralCamps: 1,
      }),
      previous,
    );
    expect(previous).toEqual(before);
    expect(prepareSetup(next)).toMatchObject({
      duration: 120,
      mapSize: "colossal",
      gameSpeed: 0.5,
      populationCap: 200,
      matchScale: "custom",
    });
  });
  it("grows and shrinks indexed slots without changing remaining choices", () => {
    const previous = quick();
    previous.slots![1].name = "Ally";
    previous.slots![1].personality = "economic";
    const grown = readSetupControls(form({ playerCount: 4 }), previous);
    expect(grown.slots).toHaveLength(4);
    expect(grown.slots![1]).toEqual(previous.slots![1]);
    const shrunk = readSetupControls(form({ playerCount: 2 }), grown);
    expect(shrunk.slots).toHaveLength(2);
    expect(shrunk.slots![1].name).toBe("Ally");
  });
  it("retains closed indices and alliance ownership", () => {
    const previous = selectSetupScale(DEFAULT_SETTINGS, "epic");
    const next = readSetupControls(
      form({ "slot-1-controller": "closed", "slot-2-alliance": 0 }),
      previous,
    );
    expect(next.slots![1].controller).toBe("closed");
    expect(next.slots![2].alliance).toBe(0);
    expect(prepareSetup(next).aiPlayers).toBe(3);
  });
  it("keeps population problems visible and refuses launch validation", () => {
    const next = readSetupControls(
      form({ playerCount: 6, populationCap: 150 }),
      quick(),
    );
    expect(renderSetupSummary(next)).toContain("600 total");
    expect(() => prepareSetup(next)).toThrow("600 total");
  });
  it("keeps same-alliance configuration editable but refuses launch", () => {
    const next = readSetupControls(form({ "slot-1-alliance": 0 }), quick());
    expect(renderSetupSummary(next)).toContain("opposing alliances");
    expect(() => prepareSetup(next)).toThrow("opposing alliances");
  });
  it("synchronizes global difficulty into local slot despite stale form value", () => {
    const next = readSetupControls(
      form({ difficulty: "hard", "slot-0-difficulty": "normal" }),
      quick(),
    );
    expect(next.difficulty).toBe("hard");
    expect(next.slots![0].difficulty).toBe("hard");
  });
  it("synchronizes a local slot difficulty back into global rules", () => {
    const next = readSetupControls(
      form({ difficulty: "normal", "slot-0-difficulty": "brutal" }),
      quick(),
    );
    expect(next.difficulty).toBe("brutal");
    expect(next.slots![0].difficulty).toBe("brutal");
  });
  it("synchronizes local faction commander and AI controller", () => {
    const next = readSetupControls(
      form({
        "slot-0-faction": "arcanists",
        "slot-0-commander": "engineer",
        "slot-0-controller": "ai",
      }),
      quick(),
    );
    expect(next).toMatchObject({
      faction: "arcanists",
      commander: "engineer",
      aiControlPlayer: true,
    });
  });
  it("uses every FC5 encoded field instead of stale controls", () => {
    const target = selectSetupScale(
      { ...DEFAULT_SETTINGS, seed: "CODE | 🌲" },
      "epic",
    );
    const next = readSetupControls(
      form({
        seed: encodeMapCode(target, 5),
        duration: 4,
        mapSize: "tiny",
        "slot-1-controller": "closed",
      }),
      quick(),
    );
    expect(next).toEqual({ ...target, customMap: undefined });
  });
  it.each([3, 4] as const)(
    "preserves frozen FC%i inputs and clears incompatible slots/camps",
    (version) => {
      const next = readSetupControls(
        form({
          seed: encodeMapCode(DEFAULT_SETTINGS, version),
          mapGenerationVersion: 5,
          playerCount: 6,
        }),
        selectSetupScale(DEFAULT_SETTINGS, "epic"),
      );
      expect(next.mapGenerationVersion).toBe(version);
      expect(next.slots).toBeUndefined();
      expect(next.neutralCamps).toBe(0);
      expect(next.aiPlayers).toBe(1);
      expect(prepareSetup(next).slots).toBeUndefined();
    },
  );
  it("keeps legacy Custom and player count changes in the selected generator", () => {
    for (const version of [3, 4] as const) {
      const legacy = { ...DEFAULT_SETTINGS, mapGenerationVersion: version };
      expect(selectSetupScale(legacy, "custom").slots).toBeUndefined();
      const next = readSetupControls(form({ playerCount: 3 }), legacy);
      expect(next.mapGenerationVersion).toBe(version);
      expect(next.slots).toBeUndefined();
    }
  });
  it("only creates slot controls after explicit upgrade and clears on downgrade", () => {
    const modern = readSetupControls(
      form({ mapGenerationVersion: 5 }),
      DEFAULT_SETTINGS,
    );
    expect(modern.slots).toHaveLength(2);
    const old = readSetupControls(
      form({ mapGenerationVersion: 4, neutralCamps: 1 }),
      modern,
    );
    expect(old.slots).toBeUndefined();
    expect(old.neutralCamps).toBe(0);
  });
  it("rejects missing numbers, duplicate fields, invalid types and unsupported values atomically", () => {
    const previous = quick(),
      before = structuredClone(previous);
    const fixtures: Record<string, string | number>[] = [
      { duration: "" },
      { duration: "Infinity" },
      { duration: "0x20" },
      { playerCount: 7 },
      { mapGenerationVersion: 6 },
      { biome: "lava" },
      { seed: "x".repeat(81) },
    ];
    for (const values of fixtures)
      expect(() => readSetupControls(form(values), previous)).toThrow();
    const duplicate = form({ seed: "one" });
    duplicate.append("seed", "two");
    expect(() => readSetupControls(duplicate, previous)).toThrow(
      "one text value",
    );
    expect(previous).toEqual(before);
  });
  it("reports accurate real-time pacing and device warnings", () => {
    const settings = {
      ...selectSetupScale(DEFAULT_SETTINGS, "epic"),
      gameSpeed: 0.5,
    };
    const html = renderSetupSummary(settings);
    expect(html).toContain("80 real-minute");
    expect(html).toContain("performance");
    expect(html).toContain("not a smooth-performance guarantee");
    expect(html).toContain("concentrated maximum armies may run slowly");
  });
});
