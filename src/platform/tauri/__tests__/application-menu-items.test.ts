import type { MenuItem } from '@tauri-apps/api/menu';
import { describe, expect, it, vi } from 'vitest';
import { createNativeMenuItems } from '../application-menu-items.js';

interface IMenuOptions {
    readonly id: string;
    readonly text: string;
    readonly accelerator?: string;
    readonly enabled: boolean;
    readonly action: () => void;
}

const native = vi.hoisted(() => ({
    command: vi.fn((options: IMenuOptions) => Promise.resolve(options)),
    separator: vi.fn(() => Promise.resolve({ kind: 'separator' })),
}));

vi.mock('@tauri-apps/api/menu', () => ({
    MenuItem: { new: native.command },
    PredefinedMenuItem: { new: native.separator },
}));

describe('native command contribution rendering', () => {
    it('renders arbitrary typed module commands using their labels, state, shortcuts and callbacks', async () => {
        const execute = vi.fn();
        const items = new Map<'archive.import', MenuItem>();
        const rendered = await createNativeMenuItems(
            ['archive.import', 'separator'],
            [{ id: 'archive.import', label: 'Import archive', enabled: false, accelerator: 'CmdOrCtrl+I', onexecute: execute }],
            items,
        );
        expect(rendered).toHaveLength(2);
        expect(items.has('archive.import')).toBe(true);
        const options = native.command.mock.lastCall?.[0];
        expect(options).toMatchObject({
            id: 'archive.import',
            text: 'Import archive',
            enabled: false,
            accelerator: 'CmdOrCtrl+I',
        });
        options?.action();
        expect(execute).toHaveBeenCalledOnce();
    });

    it('rejects menu references to commands absent from the host catalogue', async () => {
        await expect(createNativeMenuItems(['archive.missing'], [], new Map())).rejects.toThrow(TypeError);
    });
});
