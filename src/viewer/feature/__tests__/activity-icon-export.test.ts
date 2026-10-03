import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import type { ActivityKind } from '#viewer-domain';

import { isUnknownRecord } from '#contracts';
import { ACTIVITY_KINDS } from '#viewer-domain';
import { activityIconNodes, activityIconSvg } from '../helpers/activity-visual.js';

// Lucide file behind each activity icon in the UI registry (src/ui/icon).
const lucideIconFiles = {
    availability: 'hourglass.svelte',
    breakOrRest: 'bed.svelte',
    driving: 'circle-gauge.svelte',
    unknown: 'circle-question-mark.svelte',
    work: 'hammer.svelte',
} as const satisfies Readonly<Record<ActivityKind, string>>;

type LucideNode = readonly [string, Readonly<Record<string, string>>];

function isLucideNode(value: unknown): value is LucideNode {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'string' &&
        typeof value[1] === 'object' &&
        value[1] !== null
    );
}

// Renders the installed library's icon geometry the way the export embeds it.
function installedIconMarkup(fileName: string): string {
    const require = createRequire(import.meta.url);
    const path = require.resolve(`@lucide/svelte/icons/${fileName.replace('.svelte', '')}`);
    const source = readFileSync(path.endsWith('.svelte') ? path : path.replace(/\.js$/u, '.svelte'), 'utf8');
    const literal = /const iconData = (\{.*\});/u.exec(source)?.[1];
    if (literal === undefined) {
        throw new TypeError(`No icon node found in ${fileName}.`);
    }
    const iconData: unknown = JSON.parse(literal);
    const nodes: unknown = isUnknownRecord(iconData) ? iconData['node'] : undefined;
    if (!Array.isArray(nodes) || !nodes.every(isLucideNode)) {
        throw new TypeError(`Unexpected icon node shape in ${fileName}.`);
    }
    return nodes
        .map(
            ([tag, attributes]) =>
                `<${tag}${Object.entries(attributes)
                    .map(([name, value]) => ` ${name}="${value}"`)
                    .join('')}/>`,
        )
        .join('');
}

describe('exported activity icons', () => {
    it.each(ACTIVITY_KINDS)('match the installed Lucide geometry for %s', (activity) => {
        expect(activityIconNodes[activity]).toBe(installedIconMarkup(lucideIconFiles[activity]));
    });

    it('embeds the geometry in a decorative inline SVG', () => {
        const svg = activityIconSvg('driving');

        expect(svg.startsWith('<svg class="activity-icon"')).toBe(true);
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain(activityIconNodes.driving);
    });
});
