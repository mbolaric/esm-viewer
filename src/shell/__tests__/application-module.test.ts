import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';

import { collectApplicationContributions, type IApplicationModule } from '../application-module.js';

type WorkspaceId = 'viewer' | 'fleet' | 'probe';
type TestModule = IApplicationModule<WorkspaceId, 'intro' | 'shortcuts', 'general'>;
const content = createRawSnippet(() => ({ render: () => '<p>Contribution</p>' }));
const workspace = createRawSnippet<[boolean]>(() => ({ render: () => '<section>Workspace</section>' }));
const contribution = {
    id: 'fleet',
    icon: 'truck' as const,
    label: 'Fleet',
    content,
    enabled: true,
    onselect: () => undefined,
    onexecute: () => undefined,
    onapply: () => true,
    oncancel: () => undefined,
};

function testModule(id: WorkspaceId): TestModule {
    return { id, icon: 'truck', label: id, workspace };
}

describe('application module composition', () => {
    it('collects independently owned contributions in module order without modifying them', () => {
        const fleet: TestModule = {
            ...testModule('fleet'),
            guide: [{ ...contribution, beforeTab: 'shortcuts' }],
            preferences: [{ ...contribution, targetTab: 'general' }],
            destinations: [contribution],
            commands: [contribution],
        };
        const combined = collectApplicationContributions([testModule('viewer'), fleet]);
        expect(combined.guide).toEqual(fleet.guide);
        expect(combined.preferences).toEqual(fleet.preferences);
        expect(combined.destinations).toEqual(fleet.destinations);
        expect(combined.commands).toEqual(fleet.commands);
        expect(combined.guide[0]).toBe(fleet.guide?.[0]);
        expect(collectApplicationContributions([testModule('viewer')])).toEqual({
            guide: [],
            preferences: [],
            destinations: [],
            commands: [],
        });
    });

    it('rejects duplicate workspace IDs', () => {
        expect(() => collectApplicationContributions([testModule('viewer'), testModule('viewer')])).toThrow(TypeError);
    });

    it('keeps third-module renderers and statuses separate from collected dialog and command contributions', () => {
        const status = createRawSnippet<[WorkspaceId]>(() => ({ render: () => '<span>Status</span>' }));
        const ids: readonly WorkspaceId[] = ['viewer', 'fleet', 'probe'];
        const modules: readonly TestModule[] = ids.map((id) => ({
            ...testModule(id),
            status,
        }));
        expect(collectApplicationContributions(modules)).toEqual({
            guide: [],
            preferences: [],
            destinations: [],
            commands: [],
        });
        expect(modules.map((module) => module.status)).toEqual([status, status, status]);
        expect(modules.map((module) => module.workspace)).toEqual([workspace, workspace, workspace]);
    });

    it.each(['guide', 'preferences', 'destinations', 'commands'] as const)('rejects duplicate %s contribution IDs', (surface) => {
        const module: TestModule = { ...testModule('fleet'), [surface]: [contribution, contribution] };
        expect(() => collectApplicationContributions([module])).toThrow(TypeError);
    });
});
