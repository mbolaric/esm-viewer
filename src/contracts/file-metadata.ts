import { err, ok, type Result } from './result.js';
import { hasExactKeys, isUnknownRecord } from './unknown-value.js';

declare const fileDisplayNameBrand: unique symbol;
declare const sha256DigestBrand: unique symbol;

export type FileDisplayName = string & {
    readonly [fileDisplayNameBrand]: 'FileDisplayName';
};

export type Sha256Digest = string & {
    readonly [sha256DigestBrand]: 'Sha256Digest';
};

export interface IFileMetadata {
    readonly byteLength: number;
    readonly displayName: FileDisplayName;
    readonly sha256: Sha256Digest;
}

export type FileMetadataDecodeError = 'invalidFileMetadata';

export function isFileDisplayName(value: unknown): value is FileDisplayName {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 256 &&
        !value.includes('\0') &&
        !value.includes('/') &&
        !value.includes('\\')
    );
}

export function isSha256Digest(value: unknown): value is Sha256Digest {
    return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

export function decodeFileMetadata(value: unknown): Result<IFileMetadata, FileMetadataDecodeError> {
    if (!isUnknownRecord(value) || !hasExactKeys(value, ['byteLength', 'displayName', 'sha256'])) {
        return err('invalidFileMetadata');
    }

    const byteLength = value['byteLength'];
    const displayName = value['displayName'];
    const sha256 = value['sha256'];

    if (
        typeof byteLength !== 'number' ||
        !Number.isSafeInteger(byteLength) ||
        byteLength < 0 ||
        !isFileDisplayName(displayName) ||
        !isSha256Digest(sha256)
    ) {
        return err('invalidFileMetadata');
    }

    return ok({
        byteLength,
        displayName,
        sha256,
    });
}
