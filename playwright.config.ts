import {defineConfig, devices} from '@playwright/test';

/** Run against the production build: Vite dev deliberately does not register a worker. */
const external = process.env.FRONTIER_TEST_URL;
const continuation = !!process.env.CI && process.env.GITHUB_REF_NAME === 'qa-browser-check' && process.env.FRONTIER_FULL_BROWSER_QA !== '1';
const remainingTitles: Record<string,string[]> = {
  "desktop": [
    "native Breach queues once, survives save reload, then strikes the intended structure",
    "keyboard Breach queues once, survives save reload, then strikes the intended structure",
    "all three Engineer controls remain distinct native targets with large text and expanded panels"
  ],
  "phone-landscape": [
    "Charge targets a visible hostile instead of a closer allied troop",
    "Thorn Trap targets a visible hostile instead of a closer allied troop",
    "Windstep evades the hostile rather than moving toward it to evade an ally",
    "Runic Turret is placed toward the hostile instead of toward an allied troop",
    "allies do not override the normal fallback when the hostile is hidden by fog",
    "maximum-zoom Focus exposes every commander body and health bar above the existing HUD",
    "large-text framing survives native held Focus and real commander movement",
    "default-zoom Focus exposes commanders and health with native field guide content retained",
    "Select Commander reveals ranger at default zoom with expanded recruitment and field guide",
    "Select Commander reveals warlord at default zoom with expanded recruitment and field guide",
    "Select Commander reveals engineer at default zoom with expanded recruitment and field guide",
    "Engineer siege button explains missing structures without spending cooldown or a paused order",
    "native Breach queues once, survives save reload, then strikes the intended structure",
    "keyboard Breach queues once, survives save reload, then strikes the intended structure",
    "all three Engineer controls remain distinct native targets with large text and expanded panels",
    "native Attack targeting directs Breach to a farther structure instead of the nearest one",
    "ordinary field-guide close and expanded map have separate hit targets",
    "Rush Engineer abilities stay above expanded and collapsed command panels and receive clicks",
    "Rush status growth relocates controls without needing a resize or panel toggle"
  ],
  "phone-portrait": [
    "native Breach queues once, survives save reload, then strikes the intended structure",
    "all three Engineer controls remain distinct native targets with large text and expanded panels",
    "native Attack targeting directs Breach to a farther structure instead of the nearest one",
    "ordinary field-guide close and expanded map have separate hit targets",
    "Rush Engineer abilities stay above expanded and collapsed command panels and receive clicks",
    "Rush status growth relocates controls without needing a resize or panel toggle"
  ],
  "pwa": [
    "production manifest, icons, worker and precache remain within repository scope",
    "after install, offline reload supports saved battle, new game, campaign, and editor",
    "an update waits for consent, saves the battle, then restarts safely",
    "an update waits for a finished result commit and reloads its command record once"
  ]
};
const escapeRegex = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export default defineConfig({
  testDir: './tests/browser',
  timeout: 35_000,
  expect: {timeout: 8_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: continuation ? 0 : process.env.CI ? 1 : 0,
  maxFailures: continuation ? 4 : process.env.CI ? 6 : 0,
  // Canvas-heavy games should not spawn one browser per reported host CPU.
  workers: process.env.FRONTIER_TEST_WORKERS ? Math.max(1, Number(process.env.FRONTIER_TEST_WORKERS)) : 2,
  reporter: [['list'], ['html', {open: 'never', outputFolder: 'playwright-report'}], ['json', {outputFile:'playwright-report/engineer-continuation.json'}]],
  use: {
    baseURL: external || 'http://127.0.0.1:4181/rts-game/',
    trace: continuation ? 'off' : 'on-first-retry', screenshot: 'only-on-failure', video: 'off',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {},
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-portrait', use: {...devices['Pixel 7'], viewport: {width: 390, height: 844}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'phone-landscape', use: {...devices['Pixel 7'], viewport: {width: 844, height: 390}}, testIgnore: /pwa\.spec\.ts/},
    {name: 'pwa', use: {...devices['Desktop Chrome']}, testMatch: /pwa\.spec\.ts/},
  ].filter(project => !continuation || project.name in remainingTitles).map(project => continuation ? {...project, grep: new RegExp('(?:'+remainingTitles[project.name].map(escapeRegex).join('|')+')$')} : project),
  webServer: external ? undefined : {
    command: 'npm run build && node tests/browser/serve-production.mjs',
    url: 'http://127.0.0.1:4181/rts-game/',
    reuseExistingServer: false, timeout: 120_000,
  },
});
