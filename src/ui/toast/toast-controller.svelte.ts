import { SvelteMap } from 'svelte/reactivity';

import type { IToastItem, IToastOptions, ToastVariant } from './toast-types.js';

const DEFAULT_TOAST_DURATION_MS = 4000;
const MAX_CONCURRENT_TOASTS = 5;

export class ToastController {
    #_toasts = $state<readonly IToastItem[]>([]);
    #_timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
    #_counter = 0;

    public get toasts(): readonly IToastItem[] {
        return this.#_toasts;
    }

    public show(message: string, options: IToastOptions = {}): string {
        this.#_counter += 1;
        const id = `toast-${String(Date.now())}-${String(this.#_counter)}`;
        const durationMs = options.durationMs ?? DEFAULT_TOAST_DURATION_MS;
        const dismissible = options.dismissible ?? true;
        const variant: ToastVariant = options.variant ?? 'info';

        const toast: IToastItem = {
            action: options.action,
            createdAt: Date.now(),
            dismissLabel: options.dismissLabel,
            dismissible,
            durationMs,
            id,
            message,
            title: options.title,
            variant,
        };

        const updated = [...this.#_toasts, toast];
        if (updated.length > MAX_CONCURRENT_TOASTS) {
            const evicted = updated.shift();
            if (evicted !== undefined) {
                this.clearTimer(evicted.id);
            }
        }
        this.#_toasts = updated;

        if (durationMs > 0) {
            const timer = setTimeout(() => {
                this.dismiss(id);
            }, durationMs);
            this.#_timers.set(id, timer);
        }

        return id;
    }

    public success(message: string, options?: Omit<IToastOptions, 'variant'>): string {
        return this.show(message, { ...options, variant: 'success' });
    }

    public error(message: string, options?: Omit<IToastOptions, 'variant'>): string {
        return this.show(message, { ...options, variant: 'error' });
    }

    public warning(message: string, options?: Omit<IToastOptions, 'variant'>): string {
        return this.show(message, { ...options, variant: 'warning' });
    }

    public info(message: string, options?: Omit<IToastOptions, 'variant'>): string {
        return this.show(message, { ...options, variant: 'info' });
    }

    public dismiss(id: string): void {
        this.clearTimer(id);
        this.#_toasts = this.#_toasts.filter((t) => t.id !== id);
    }

    public clear(): void {
        for (const timer of this.#_timers.values()) {
            clearTimeout(timer);
        }
        this.#_timers.clear();
        this.#_toasts = [];
    }

    public dispose(): void {
        this.clear();
    }

    private clearTimer(id: string): void {
        const timer = this.#_timers.get(id);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.#_timers.delete(id);
        }
    }
}
