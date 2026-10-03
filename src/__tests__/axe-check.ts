import axe from 'axe-core';

// Rules disabled in jsdom due to layout or color calculation limitations.
const jsdomDisabledRules = {
    'color-contrast': { enabled: false },
    'meta-viewport': { enabled: false },
    'target-size': { enabled: false },
} as const;

export async function expectNoAxeViolations(root: Document | HTMLElement): Promise<void> {
    const results = await axe.run(root, {
        rules: jsdomDisabledRules,
        runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
        },
    });

    if (results.violations.length === 0) {
        return;
    }

    const detail = results.violations
        .map((violation) => {
            const nodes = violation.nodes.map((node) => `    ${node.target.join(' ')} — ${node.failureSummary ?? ''}`).join('\n');
            return `  ${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes}`;
        })
        .join('\n');

    throw new Error(`Axe reported ${String(results.violations.length)} WCAG violation(s):\n${detail}`);
}
