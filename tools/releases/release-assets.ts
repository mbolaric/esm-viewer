export interface IReleasePackage {
    readonly id: string;
    readonly suffix: string;
}

export interface IReleaseDownload {
    readonly id: string;
    readonly url: string | null;
}

export interface IReleaseDownloads {
    readonly tag: string;
    readonly url: string;
    readonly packages: readonly IReleaseDownload[];
}

interface IReleaseAsset {
    readonly name: string;
    readonly browser_download_url: string;
    readonly state: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeAsset(value: unknown): IReleaseAsset {
    if (
        !isRecord(value) ||
        typeof value['name'] !== 'string' ||
        typeof value['browser_download_url'] !== 'string' ||
        typeof value['state'] !== 'string'
    ) {
        throw new Error('Release metadata contains an invalid asset.');
    }
    return { name: value['name'], browser_download_url: value['browser_download_url'], state: value['state'] };
}

function repositoryUrl(repository: string): string {
    if (
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
        repository.split('/').some((part) => part === '.' || part === '..')
    ) {
        throw new Error('Release repository must use owner/repository format.');
    }
    return `https://github.com/${repository}`;
}

export function resolveReleaseDownloads(
    value: unknown,
    repository: string,
    packages: readonly IReleasePackage[],
): IReleaseDownloads {
    const base = repositoryUrl(repository);
    if (
        !isRecord(value) ||
        typeof value['tag_name'] !== 'string' ||
        !value['tag_name'].trim() ||
        value['draft'] !== false ||
        value['prerelease'] !== false ||
        typeof value['html_url'] !== 'string' ||
        !Array.isArray(value['assets'])
    ) {
        throw new Error('Expected metadata for a published, stable release.');
    }
    const tag = value['tag_name'];
    const url = `${base}/releases/tag/${encodeURIComponent(tag)}`;
    if (value['html_url'] !== url) {
        throw new Error('Release metadata links to an unexpected repository or tag.');
    }
    const rawAssets: readonly unknown[] = value['assets'];
    const assets = rawAssets.map(decodeAsset);
    const ids = new Set<string>();
    const downloads = packages.map(({ id, suffix }) => {
        if (!id || !suffix || ids.has(id)) {
            throw new Error('Release package selectors must have unique IDs and non-empty suffixes.');
        }
        ids.add(id);
        const matches = assets.filter(
            (asset) =>
                asset.state === 'uploaded' && !/(?:^|[-_.])debug(?:[-_.]|$)/i.test(asset.name) && asset.name.endsWith(suffix),
        );
        if (matches.length > 1) {
            throw new Error(`More than one production asset matches package ${id}.`);
        }
        const asset = matches[0];
        if (!asset) return { id, url: null };
        const expected = `${base}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
        if (asset.browser_download_url !== expected) {
            throw new Error(`Package ${id} has an unexpected download URL.`);
        }
        return { id, url: expected };
    });
    if (!downloads.some((download) => download.url !== null)) {
        throw new Error('The latest release has no matching production installers.');
    }
    return { tag, url, packages: downloads };
}

export async function fetchReleaseDownloads(
    repository: string,
    packages: readonly IReleasePackage[],
    token?: string,
): Promise<IReleaseDownloads> {
    repositoryUrl(repository);
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(token !== undefined && token !== '' ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
        throw new Error(`Cannot resolve the latest release (GitHub HTTP ${String(response.status)}). Retry the website build.`);
    }
    const payload: unknown = await response.json();
    return resolveReleaseDownloads(payload, repository, packages);
}
