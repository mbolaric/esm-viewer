import { describe, expect, it } from 'vitest';

import { decodeTauriConfiguration } from '../tauri-configuration.js';

const window = {
    label: 'primary',
    title: 'Library',
    width: 1000,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    resizable: true,
    fullscreen: false,
    devtools: false,
    create: false,
};
const csp = "default-src 'self'; object-src 'none'";

function configuration(windows: readonly unknown[] = [window], security: unknown = { csp }): unknown {
    return { identifier: 'org.library', productName: 'Library', app: { windows, security } };
}

describe('native configuration policy', () => {
    it('separates product identity from effective window and CSP policy', () => {
        const decoded = decodeTauriConfiguration(configuration(), 'primary');
        expect(decoded.identifier).toBe('org.library');
        expect(decoded.productName).toBe('Library');
        expect(decoded.policy.window).not.toHaveProperty('label');
        expect(decoded.policy.window).not.toHaveProperty('title');
        expect(decoded.policy.window['devtools']).toBe(false);
        expect(decoded.policy.devCsp).toEqual(decoded.policy.csp);
    });

    it('compares CSP directives semantically rather than by whitespace or ordering', () => {
        const first = decodeTauriConfiguration(
            configuration([window], { csp: "script-src 'self' 'strict-dynamic'; object-src 'none'" }),
            'primary',
        );
        const reordered = decodeTauriConfiguration(
            configuration([window], { csp: " object-src 'none' ; script-src 'strict-dynamic'   'self'; " }),
            'primary',
        );
        expect(first.policy).toEqual(reordered.policy);
    });

    it('uses an explicit development CSP and treats null as inheritance', () => {
        const explicit = decodeTauriConfiguration(configuration([window], { csp, devCsp: "default-src 'none'" }), 'primary');
        expect(explicit.policy.devCsp).not.toEqual(explicit.policy.csp);
        expect(decodeTauriConfiguration(configuration([window], { csp, devCsp: null }), 'primary').policy.devCsp).toEqual(
            explicit.policy.csp,
        );
    });

    it('preserves additional window policy fields so they cannot drift unnoticed', () => {
        expect(
            decodeTauriConfiguration(configuration([{ ...window, decorations: false }]), 'primary').policy.window['decorations'],
        ).toBe(false);
    });

    it.each([null, [], {}, { app: null }, { app: { security: {}, windows: null } }])(
        'rejects malformed configuration: %j',
        (value: unknown) => {
            expect(() => decodeTauriConfiguration(value, 'primary')).toThrow(TypeError);
        },
    );

    it('rejects missing or duplicate requested windows and invalid dimensions', () => {
        for (const windows of [[], [window, window], [{ ...window, minHeight: 0 }], [{ ...window, width: Number.NaN }]]) {
            expect(() => decodeTauriConfiguration(configuration(windows), 'primary')).toThrow(TypeError);
        }
        expect(() => decodeTauriConfiguration(configuration(), '')).toThrow(TypeError);
    });

    it('rejects automatic window creation, release devtools and missing explicit flags', () => {
        for (const modified of [
            { ...window, create: true },
            { ...window, devtools: true },
            { ...window, devtools: undefined },
            { ...window, resizable: undefined },
        ]) {
            expect(() => decodeTauriConfiguration(configuration([modified]), 'primary')).toThrow(TypeError);
        }
    });

    it('rejects disabled, empty, duplicate and unsafe production or development CSP', () => {
        for (const invalid of [null, '', ';', `${csp}; default-src 'none'`, `${csp}; script-src 'unsafe-eval'`]) {
            expect(() => decodeTauriConfiguration(configuration([window], { csp: invalid }), 'primary')).toThrow(TypeError);
            if (invalid !== null) {
                expect(() => decodeTauriConfiguration(configuration([window], { csp, devCsp: invalid }), 'primary')).toThrow(
                    TypeError,
                );
            }
        }
    });
});
