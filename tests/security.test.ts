import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_SETTINGS, generateMap, restoreGame, serializeGame, validateMap } from '../src/sim';
import { MAX_MAP_JSON_BYTES, parseBoundedJSON, validateDataSafety, validateMapStructure, validateTriggers } from '../src/sim/validation';
import { escapeText } from '../src/ui/escape';
import { CAMPAIGNS } from '../src/ui/content';

const mapFixture = () => generateMap({ ...DEFAULT_SETTINGS, mapSize: 'tiny', seed: 'SAFE-IMPORT' });
const trigger = (action: unknown = { type: 'dialogue', text: 'A plain message.' }) => ({ id: 'safe-trigger', when: { type: 'time', seconds: 0 }, actions: [action] });

describe('bounded, data-only JSON imports', () => {
    it.each(['__proto__', 'constructor', 'prototype'])('rejects nested %s property keys without changing prototypes', key => {
        const source = `{"outer":[{"${key}":{"polluted":true}}]}`;
        expect(() => parseBoundedJSON(source)).toThrow(/forbidden property/);
        expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    });
    it('rejects escaped prototype keys, excessive depth and oversized UTF-8 payloads', () => {
        expect(() => parseBoundedJSON('{"\\u005f_proto__":{}}')).toThrow(/forbidden property/);
        expect(() => parseBoundedJSON('['.repeat(26) + '0' + ']'.repeat(26))).toThrow(/depth/);
        expect(() => parseBoundedJSON('"123456"', 7)).toThrow(/size limit/);
        expect(() => parseBoundedJSON('"éé"', 5)).toThrow(/size limit/);
        expect(() => parseBoundedJSON(' '.repeat(MAX_MAP_JSON_BYTES + 1), MAX_MAP_JSON_BYTES)).toThrow(/size limit/);
    });
    it('rejects cycles, functions and accessors without executing them', () => {
        let executed = false;
        const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { executed = true; return 1; } });
        expect(validateDataSafety(accessor)).not.toEqual([]);
        expect(executed).toBe(false);
        expect(validateDataSafety({ run: () => { executed = true; } })).not.toEqual([]);
        expect(executed).toBe(false);
        const cyclic: Record<string, unknown> = {}; cyclic.next = cyclic;
        expect(validateDataSafety(cyclic)).not.toEqual([]);
        expect(validateDataSafety({ values: Array(100).fill(1) }, 50)).not.toEqual([]);
    });
    it('keeps literal strings intact instead of interpreting markup or code', () => {
        const text = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
        expect(parseBoundedJSON(JSON.stringify({ text }))).toEqual({ text });
        expect(parseBoundedJSON('{"nested":[null,true,0,"constructor"]}')).toEqual({ nested: [null, true, 0, 'constructor'] });
    });
});

describe('bounded map structure', () => {
    it('accepts generated versions and historical campaign maps', () => {
        for (const version of [3, 4] as const)
            expect(validateMapStructure(generateMap({ ...DEFAULT_SETTINGS, mapGenerationVersion: version }))).toEqual([]);
        for (const mission of CAMPAIGNS.flatMap(campaign => campaign.missions))
            expect(validateMapStructure(createGame(mission.settings).map), mission.id).toEqual([]);
    });
    it('rejects dimensions, collection counts and metadata before gameplay allocations', () => {
        for (const patch of [
            { width: 161 }, { width: 16.5 }, { height: Infinity }, { seed: 'x'.repeat(81) },
            { biome: 'constructor' }, { version: 99 }, { spawns: Array(7).fill({ x: 6.5, y: 6.5 }) },
            { nodes: Array(513).fill(mapFixture().nodes[0]) }, { script: 'alert(1)' },
        ]) {
            const map = { ...mapFixture(), ...patch };
            expect(validateMapStructure(map), JSON.stringify(patch).slice(0, 100)).not.toEqual([]);
        }
    });
    it('rejects duplicate node IDs, string ownership, off-map nodes, and script-like fields', () => {
        for (const patch of [{ id: 'node-1' }, { owner: '0' }, { captureTeam: '0' }, { x: 999 }, { onCapture: 'alert(1)' }]) {
            const map = mapFixture(); Object.assign(map.nodes[0], patch);
            expect(validateMapStructure(map)).not.toEqual([]);
        }
        const map = mapFixture();
        Object.assign(map.nodes[0], JSON.parse('{"__proto__":{"polluted":true}}'));
        expect(validateMapStructure(map)).not.toEqual([]);
    });
    it('does not mutate rejected data or valid map payloads', () => {
        const map = mapFixture(), serialized = JSON.stringify(map);
        expect(validateMapStructure(parseBoundedJSON(serialized, MAX_MAP_JSON_BYTES))).toEqual([]);
        expect(JSON.stringify(map)).toBe(serialized);
    });
    it('enforces the guard through map validation and custom-game creation', () => {
        const map = mapFixture();
        map.spawns = Array(7).fill(map.spawns[0]);
        expect(validateMap(map).valid).toBe(false);
        expect(() => createGame({ customMap: map })).toThrow(/Invalid map/);
        const malicious = JSON.parse(JSON.stringify(mapFixture()).replace('"seed":', '"__proto__":{},"seed":'));
        expect(() => createGame({ customMap: malicious })).toThrow(/forbidden property/);
    });
});

describe('declarative mission safety', () => {
    it('rejects unsupported conditions/actions and executable extension fields', () => {
        for (const payload of [
            { ...trigger(), when: { type: 'script', source: 'alert(1)' } },
            trigger({ type: 'script', source: 'alert(1)' }),
            { ...trigger(), script: 'alert(1)' },
            { ...trigger(), when: { type: 'time', seconds: 0, evaluate: 'alert(1)' } },
            trigger({ type: 'dialogue', text: 'Hi', run: 'alert(1)' }),
        ]) expect(validateTriggers([payload])).not.toEqual([]);
    });
    it('bounds triggers, per-trigger actions, total spawns and text length', () => {
        expect(validateTriggers(Array.from({ length: 129 }, (_, i) => ({ ...trigger(), id: `trigger-${i}` })))).not.toEqual([]);
        expect(validateTriggers([{ ...trigger(), actions: Array(33).fill({ type: 'reveal', team: 0 }) }])).not.toEqual([]);
        expect(validateTriggers([trigger({ type: 'dialogue', text: 'x'.repeat(4001) })])).not.toEqual([]);
        expect(validateTriggers([{ ...trigger(), actions: Array(3).fill({ type: 'spawn', team: 0, unit: 'archer', count: 1000, x: 5, y: 5 }) }])).not.toEqual([]);
    });
    it('preserves literal dialogue text as data and rejects unsafe property keys', () => {
        const text = '<img src=x onerror="alert(1)">';
        expect(validateTriggers([trigger({ type: 'dialogue', text })])).toEqual([]);
        const malicious = JSON.parse(JSON.stringify([trigger()]).replace('"text":', '"__proto__":{},"text":'));
        expect(validateTriggers(malicious)).not.toEqual([]);
    });
    it('rejects unsupported actions through the real save restore boundary', () => {
        const save = JSON.parse(serializeGame(createGame()));
        save.triggers = [trigger({ type: 'script', source: 'alert(1)' })];
        expect(() => restoreGame(save)).toThrow(/mission triggers/);
    });
    it('rejects prototype fields through both string and object save restore routes', () => {
        const source = serializeGame(createGame()).replace('"settings":{', '"settings":{"constructor":{"prototype":{"polluted":true}},');
        expect(() => restoreGame(source)).toThrow(/save/);
        expect(() => restoreGame(JSON.parse(source))).toThrow(/save/);
        expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    });
});

describe('untrusted visible text escaping', () => {
    it('escapes map names/seeds and campaign text in text and quoted-attribute contexts', () => {
        const payload = '\"><img src=x onerror=alert(1)>&\' <script>alert(2)</script>';
        const escaped = escapeText(payload);
        expect(escaped).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&amp;&#39; &lt;script&gt;alert(2)&lt;/script&gt;');
        expect(escaped).not.toMatch(/[<>"']/);
    });
});
