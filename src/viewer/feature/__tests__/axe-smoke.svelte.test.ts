import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '#testing';

import AxeSmokeButton from './AxeSmokeButton.svelte';

// Negative fixture proving the axe harness detects accessibility violations.
describe('axe harness smoke check', () => {
    it('detects a button without an accessible name', async () => {
        render(AxeSmokeButton);
        await expect(expectNoAxeViolations(document.body)).rejects.toThrow(/button-name/);
    });
});
