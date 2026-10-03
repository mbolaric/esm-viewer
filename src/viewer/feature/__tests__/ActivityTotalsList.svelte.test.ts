import type { IActivityTotalsViewModel, IContinuousDrivingProgressViewModel } from '#viewer-presentation';
import { isDurationMilliseconds, type DurationMilliseconds } from '#viewer-domain';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ActivityTotalsList from '../components/screens/ActivityTotalsList.svelte';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function duration(value: number): DurationMilliseconds {
    if (!isDurationMilliseconds(value)) {
        throw new TypeError('The activity totals duration fixture must be valid.');
    }
    return value;
}

function totals(): IActivityTotalsViewModel {
    return {
        availability: { display: '1h 0m', value: duration(3_600_000) },
        breakOrRest: { display: '0 min', value: duration(0) },
        driving: { display: '3h 0m', value: duration(10_800_000) },
        unknown: { display: '0 min', value: duration(0) },
        work: { display: '2h 0m', value: duration(7_200_000) },
    };
}

function progress(
    percentage: number,
    status: 'danger' | 'normal' | 'warning',
    peakDisplay?: string,
): IContinuousDrivingProgressViewModel {
    return {
        currentContinuousDriving: { display: '4h 0m', value: duration(14_400_000) },
        maxContinuousDrivingLimit: { display: '4h 30m', value: duration(16_200_000) },
        peakContinuousDriving: peakDisplay === undefined ? null : { display: peakDisplay, value: duration(18_000_000) },
        percentage,
        status,
    };
}

describe('ActivityTotalsList', () => {
    it('renders an accessible progress bar when continuous driving accumulates', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(89, 'warning'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const progressbar = screen.getByRole('progressbar', { name: 'Continuous driving' });
        expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
        expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
        expect(progressbar.getAttribute('aria-valuenow')).toBe('89');
        expect(screen.getByText('4h 0m / 4h 30m')).toBeTruthy();
        expect(screen.getByText('45m break required')).toBeTruthy();
    });

    it('renders a danger notice when the continuous driving limit is exceeded', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(100, 'danger'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.getByText('45m break required')).toBeTruthy();
    });

    it('omits the progress bar until driving accumulates', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(0, 'normal'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.queryByRole('progressbar')).toBeNull();
        expect(screen.queryByText('45m break required')).toBeNull();
    });

    it('does not show the break-required note once a valid break has cleared it (VIEWER-02)', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(44, 'normal'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.queryByText('45m break required')).toBeNull();
    });

    it('shows the earlier peak as historical evidence, separately from the live break-required note (VIEWER-02)', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(22, 'normal', '5h 0m'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.queryByText('45m break required')).toBeNull();
        expect(screen.getByText('Reached 5h 0m earlier')).toBeTruthy();
    });

    it('still shows the peak note even when the current clock has dropped back to zero', () => {
        render(
            ActivityTotalsList,
            {
                props: {
                    continuousDriving: progress(0, 'normal', '5h 0m'),
                    totals: totals(),
                },
            },
            createViewerTestRenderOptions(),
        );

        // Historical peak evidence must remain visible.
        expect(screen.getByText('Reached 5h 0m earlier')).toBeTruthy();
    });
});
