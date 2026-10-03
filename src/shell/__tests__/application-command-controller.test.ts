import { describe, expect, it, vi } from 'vitest';
import { ApplicationCommandController } from '../application-command-controller.js';

describe('ApplicationCommandController', () => {
    it('dispatches registered commands and makes obsolete cleanup harmless', () => {
        const controller = new ApplicationCommandController<'file.open' | 'fleet.import'>();
        const original = vi.fn();
        const replacement = vi.fn();
        const cleanup = controller.register('file.open', original);
        controller.execute('fleet.import');
        controller.execute('file.open');
        expect(original).toHaveBeenCalledTimes(1);
        const removeReplacement = controller.register('file.open', replacement);
        cleanup();
        controller.execute('file.open');
        expect(replacement).toHaveBeenCalledTimes(1);
        removeReplacement();
        controller.execute('file.open');
        expect(replacement).toHaveBeenCalledTimes(1);
        expect(original).toHaveBeenCalledTimes(1);
    });
});
