import { describe, expect, it, vi } from 'vitest';

import { ToastController } from '../toast-controller.svelte.js';

describe('ToastController', () => {
    it('initializes with empty toasts', () => {
        const controller = new ToastController();
        expect(controller.toasts).toHaveLength(0);
    });

    it('adds a success toast and formats item properties correctly', () => {
        const controller = new ToastController();
        const id = controller.success('Export saved successfully', {
            title: 'Export Complete',
        });

        expect(id).toBeDefined();
        expect(controller.toasts).toHaveLength(1);
        expect(controller.toasts[0]?.message).toBe('Export saved successfully');
        expect(controller.toasts[0]?.title).toBe('Export Complete');
        expect(controller.toasts[0]?.variant).toBe('success');
    });

    it('adds error, warning, and info toasts', () => {
        const controller = new ToastController();
        controller.error('Failed to export');
        controller.warning('Warning message');
        controller.info('Info message');

        expect(controller.toasts).toHaveLength(3);
        expect(controller.toasts[0]?.variant).toBe('error');
        expect(controller.toasts[1]?.variant).toBe('warning');
        expect(controller.toasts[2]?.variant).toBe('info');
    });

    it('dismisses a specific toast by id', () => {
        const controller = new ToastController();
        const id1 = controller.info('Toast 1');
        const id2 = controller.info('Toast 2');

        expect(controller.toasts).toHaveLength(2);
        controller.dismiss(id1);
        expect(controller.toasts).toHaveLength(1);
        expect(controller.toasts[0]?.id).toBe(id2);
    });

    it('clears all toasts on clear()', () => {
        const controller = new ToastController();
        controller.info('Toast 1');
        controller.info('Toast 2');

        expect(controller.toasts).toHaveLength(2);
        controller.clear();
        expect(controller.toasts).toHaveLength(0);
    });

    it('auto-dismisses toasts after durationMs expires', () => {
        vi.useFakeTimers();
        const controller = new ToastController();
        controller.info('Auto dismiss toast', { durationMs: 1000 });

        expect(controller.toasts).toHaveLength(1);
        vi.advanceTimersByTime(1001);
        expect(controller.toasts).toHaveLength(0);
        vi.useRealTimers();
    });
});
