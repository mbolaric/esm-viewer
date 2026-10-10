import { describe, expect, it, vi } from 'vitest';

import { fetchReleaseDownloads, resolveReleaseDownloads } from '../release-assets.js';

const repository = 'example/viewer';
const base = `https://github.com/${repository}`;
const packages = [
    { id: 'windows', suffix: 'x64-setup.exe' },
    { id: 'macos', suffix: 'aarch64.dmg' },
    { id: 'linux', suffix: 'amd64.AppImage' },
];

function asset(name: string, state = 'uploaded'): { name: string; state: string; browser_download_url: string } {
    return { name, state, browser_download_url: `${base}/releases/download/v1.0.0/${encodeURIComponent(name)}` };
}

function release(assets: readonly unknown[]): {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    html_url: string;
    assets: readonly unknown[];
} {
    return { tag_name: 'v1.0.0', draft: false, prerelease: false, html_url: `${base}/releases/tag/v1.0.0`, assets };
}

describe('release installer selection', () => {
    it('resolves exact production packages and excludes debug packages and source archives', () => {
        const result = resolveReleaseDownloads(
            release([
                asset('Viewer_1.0.0_x64-setup.exe'),
                asset('Viewer_debug_x64-setup.exe'),
                asset('Viewer_1.0.0_x64-setup-debug.exe'),
                asset('Viewer_1.0.0_aarch64.dmg'),
                asset('Viewer_1.0.0_amd64.AppImage'),
                asset('source.tar.gz'),
            ]),
            repository,
            packages,
        );
        expect(result.tag).toBe('v1.0.0');
        expect(result.packages).toEqual([
            { id: 'windows', url: `${base}/releases/download/v1.0.0/Viewer_1.0.0_x64-setup.exe` },
            { id: 'macos', url: `${base}/releases/download/v1.0.0/Viewer_1.0.0_aarch64.dmg` },
            { id: 'linux', url: `${base}/releases/download/v1.0.0/Viewer_1.0.0_amd64.AppImage` },
        ]);
    });

    it('marks missing or unfinished packages unavailable without substituting another platform', () => {
        const result = resolveReleaseDownloads(
            release([asset('Viewer_x64-setup.exe'), asset('Viewer_aarch64.dmg', 'new')]),
            repository,
            packages,
        );
        expect(result.packages.slice(1)).toEqual([
            { id: 'macos', url: null },
            { id: 'linux', url: null },
        ]);
    });

    it('rejects malformed, draft and prerelease metadata', () => {
        for (const value of [null, {}, { ...release([]), draft: true }, { ...release([]), prerelease: true }]) {
            expect(() => resolveReleaseDownloads(value, repository, packages)).toThrow('published, stable release');
        }
        expect(() => resolveReleaseDownloads(release([null]), repository, packages)).toThrow('invalid asset');
    });

    it('rejects mismatched repository links and untrusted asset URLs', () => {
        expect(() =>
            resolveReleaseDownloads({ ...release([]), html_url: 'https://other.example/release' }, repository, packages),
        ).toThrow('unexpected repository');
        for (const url of ['javascript:alert(1)', 'https://other.example/installer', `${base}/releases/download/v2/file`]) {
            expect(() =>
                resolveReleaseDownloads(
                    release([{ ...asset('Viewer_x64-setup.exe'), browser_download_url: url }]),
                    repository,
                    packages,
                ),
            ).toThrow('unexpected download URL');
        }
    });

    it('fails clearly when packages are ambiguous or no production installer exists', () => {
        expect(() =>
            resolveReleaseDownloads(release([asset('Viewer_x64-setup.exe'), asset('Other_x64-setup.exe')]), repository, packages),
        ).toThrow('More than one production asset');
        expect(() => resolveReleaseDownloads(release([asset('Viewer_debug_x64-setup.exe')]), repository, packages)).toThrow(
            'no matching production installers',
        );
    });

    it('rejects invalid repositories and duplicate selectors', () => {
        expect(() => resolveReleaseDownloads(release([]), '../invalid', packages)).toThrow('owner/repository');
        expect(() =>
            resolveReleaseDownloads(release([]), repository, [
                { id: 'same', suffix: '.exe' },
                { id: 'same', suffix: '.dmg' },
            ]),
        ).toThrow('unique IDs');
    });
});

describe('release metadata fetch', () => {
    it('uses the latest release endpoint and optional authentication at build time', async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify(release([asset('Viewer_x64-setup.exe')]))));
        vi.stubGlobal('fetch', fetchMock);
        try {
            const result = await fetchReleaseDownloads(repository, packages, 'build-token');
            expect(result.tag).toBe('v1.0.0');
            const call = fetchMock.mock.calls[0];
            expect(call?.[0]).toBe(`https://api.github.com/repos/${repository}/releases/latest`);
            expect(new Headers(call?.[1]?.headers).get('Authorization')).toBe('Bearer build-token');
            expect(call?.[1]?.signal).toBeInstanceOf(AbortSignal);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('reports API failures instead of rendering success-shaped fallback links', async () => {
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 })));
        try {
            await expect(fetchReleaseDownloads(repository, packages)).rejects.toThrow('GitHub HTTP 403');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
