export interface ITauriConfiguration {
    readonly identifier: string;
    readonly productName: string;
    readonly policy: {
        readonly window: Readonly<Record<string, unknown>>;
        readonly csp: readonly string[];
        readonly devCsp: readonly string[];
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) {
        throw new TypeError('A native configuration section must be an object.');
    }
    return value;
}

function requireString(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError('Native configuration identity and CSP fields must be non-empty strings.');
    }
    return value;
}

function cspPolicy(value: unknown): readonly string[] {
    const directives = requireString(value)
        .split(';')
        .map((directive) => directive.trim())
        .filter(Boolean);
    if (directives.length === 0) {
        throw new TypeError('Native CSP must declare at least one directive.');
    }
    const names = new Set<string>();
    return directives
        .map((directive) => {
            const [name, ...sources] = directive.split(/\s+/u);
            if (name === undefined || names.has(name) || sources.includes("'unsafe-eval'")) {
                throw new TypeError('Native CSP directives must be unique and must not allow unsafe evaluation.');
            }
            names.add(name);
            return [name, ...sources.sort()].join(' ');
        })
        .sort();
}

export function decodeTauriConfiguration(value: unknown, windowLabel: string): ITauriConfiguration {
    const config = requireRecord(value);
    const app = requireRecord(config['app']);
    const security = requireRecord(app['security']);
    const rawWindows = app['windows'];
    if (!Array.isArray(rawWindows)) {
        throw new TypeError('Native configuration must declare its windows.');
    }
    const windows: readonly unknown[] = rawWindows;
    const matching = windows.map(requireRecord).filter((window) => window['label'] === windowLabel);
    const main = matching[0];
    if (windowLabel.length === 0 || matching.length !== 1 || main === undefined) {
        throw new TypeError('Native configuration must declare exactly one requested window.');
    }
    for (const name of ['width', 'height', 'minWidth', 'minHeight']) {
        const dimension = main[name];
        if (typeof dimension !== 'number' || !Number.isFinite(dimension) || dimension <= 0) {
            throw new TypeError(`Native window ${name} must be an explicit positive dimension.`);
        }
    }
    if (typeof main['resizable'] !== 'boolean' || typeof main['fullscreen'] !== 'boolean') {
        throw new TypeError('Native configuration must declare its resize and fullscreen policy.');
    }
    if (main['devtools'] !== false || main['create'] !== false) {
        throw new TypeError('Native window configuration must disable devtools and automatic window creation.');
    }
    const { label: _label, title: _title, ...window } = main;
    const csp = cspPolicy(security['csp']);
    return {
        identifier: requireString(config['identifier']),
        productName: requireString(config['productName']),
        policy: {
            window,
            csp,
            devCsp: security['devCsp'] === undefined || security['devCsp'] === null ? csp : cspPolicy(security['devCsp']),
        },
    };
}
