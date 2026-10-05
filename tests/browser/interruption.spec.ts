import {
  test,
  expect,
  action,
  launch,
  pause,
  resume,
  commander,
  expectWithinViewport,
} from "./helpers";

for (const difficulty of ["easy", "normal", "hard", "brutal"] as const) {
  test(`${difficulty}: focus loss freezes until explicit recovery without spending tactical pauses`, async ({
    page,
  }) => {
    await launch(page, { difficulty });
    if (difficulty === "hard") {
      for (let i = 0; i < 3; i++) {
        await pause(page);
        await resume(page);
      }
    }
    await expect
      .poll(() => page.evaluate(() => window.__FRONTIER__.state.time))
      .toBeGreaterThan(0);
    const allowance = await page.evaluate(
      () => window.__FRONTIER__.state.players[0].stats.pauses,
    );
    // Inject the browser event to cover visible-but-unfocused windows reliably
    // in headless Chrome as well as touch-emulated projects.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.getByRole("dialog", { name: "Battle suspended", exact: true }),
    ).toBeVisible();
    const stopped = await page.evaluate(() => window.__FRONTIER__.state.time);
    await page.waitForTimeout(450);
    expect(await page.evaluate(() => window.__FRONTIER__.state.time)).toBe(
      stopped,
    );
    expect(await page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(
      false,
    );
    expect(
      await page.evaluate(
        () => window.__FRONTIER__.state.players[0].stats.pauses,
      ),
    ).toBe(allowance);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.keyboard.press("Escape");
    await page.keyboard.press("q");
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__FRONTIER__.state.time)).toBe(
      stopped,
    );
    await expectWithinViewport(page, "#suspension-root .dialog");
    await action(page, "resume-app").click();
    await expect(page.locator("#suspension-root .dialog")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__FRONTIER__.state.time))
      .toBeGreaterThan(stopped);
    expect(
      await page.evaluate(
        () => window.__FRONTIER__.state.players[0].stats.pauses,
      ),
    ).toBe(allowance);
  });
}

test("mobile visibility recovery preserves the existing dialog and tactical queue", async ({
  page,
}) => {
  await launch(page, { difficulty: "hard" });
  await pause(page);
  await action(page, "hold").click();
  await action(page, "pause-menu").click();
  const expected = await page.evaluate(() => {
    const s = window.__FRONTIER__.state;
    return {
      time: s.time,
      queue: s.pendingCommands,
      pauses: s.players[0].stats.pauses,
    };
  });
  // Mobile browsers can omit blur. Exercise visibilitychange independently,
  // then pageshow/focus, neither of which is permission to restart gameplay.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(
    page.getByRole("dialog", { name: "Battle suspended", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(350);
  await action(page, "resume-app").click();
  await expect(
    page.getByRole("dialog", { name: "Take a breath", exact: true }),
  ).toBeVisible();
  await action(page, "close-dialog").first().click();
  expect(
    await page.evaluate(() => {
      const s = window.__FRONTIER__.state;
      return {
        time: s.time,
        queue: s.pendingCommands,
        pauses: s.players[0].stats.pauses,
      };
    }),
  ).toEqual(expected);
  expect(await page.evaluate(() => window.__FRONTIER__.state.paused)).toBe(
    true,
  );
});

test("desktop steering is released on interruption and cannot leak into recovery", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop keyboard control regression.");
  await launch(page, { difficulty: "brutal" });
  await page.keyboard.down("d");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!window.__FRONTIER__.state.entities.find(
            (e) => e.team === 0 && e.kind === "commander",
          )?.directControl,
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("d");
  const stopped = await commander(page);
  expect(
    await page.evaluate(
      () =>
        window.__FRONTIER__.state.entities.find(
          (e) => e.team === 0 && e.kind === "commander",
        )?.directControl,
    ),
  ).toBeUndefined();
  await action(page, "resume-app").click();
  await page.waitForTimeout(250);
  expect(await commander(page)).toEqual(stopped);
});

test("touch steering and pointer capture reset when the app is interrupted", async ({
  page,
  isMobile,
  context,
}) => {
  test.skip(!isMobile, "Touch joystick interruption regression.");
  await launch(page, { difficulty: "brutal" });
  const box = (await page.locator("#joystick").boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2 + 29, y: box.y + box.height / 2 }],
  });
  try {
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            !!window.__FRONTIER__.state.entities.find(
              (e) => e.team === 0 && e.kind === "commander",
            )?.directControl,
        ),
      )
      .toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  } finally {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  }
  await expect(page.locator(".joystick-stick")).not.toHaveAttribute(
    "style",
    /translate/,
  );
  const stopped = await commander(page);
  await action(page, "resume-app").click();
  await page.waitForTimeout(250);
  expect(await commander(page)).toEqual(stopped);
});

test("interruption silences audio until the explicit recovery gesture", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalGain = AudioContext.prototype.createGain;
    const originalResume = AudioContext.prototype.resume;
    let master: GainNode | undefined;
    let resumeCalls = 0;
    AudioContext.prototype.createGain = function () {
      const gain = originalGain.call(this);
      master ??= gain;
      return gain;
    };
    AudioContext.prototype.resume = function () {
      resumeCalls++;
      return originalResume.call(this);
    };
    Object.defineProperty(window, "__QA_INTERRUPTION_AUDIO__", {
      value: () => ({ gain: master?.gain.value ?? 0, resumeCalls }),
    });
  });
  const audio = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __QA_INTERRUPTION_AUDIO__(): { gain: number; resumeCalls: number };
        }
      ).__QA_INTERRUPTION_AUDIO__(),
    );
  await launch(page, { difficulty: "brutal" });
  await expect.poll(async () => (await audio()).gain).toBeGreaterThan(0.1);
  const before = (await audio()).resumeCalls;
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await audio()).gain).toBeLessThan(0.01);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.keyboard.press("q");
  expect((await audio()).resumeCalls).toBe(before);
  expect((await audio()).gain).toBeLessThan(0.01);
  await action(page, "resume-app").click();
  await expect.poll(async () => (await audio()).gain).toBeGreaterThan(0.1);
  expect((await audio()).resumeCalls).toBeGreaterThan(before);
});
