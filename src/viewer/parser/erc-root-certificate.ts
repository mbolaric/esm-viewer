import type { VerificationGeneration } from '#viewer-domain';

import ecPkUrl from './certs/EC_PK.bin?url';
import ecPkGen2Url from './certs/EC_PK_GEN2.bin?url';

const rootCertificateUrls: Readonly<Record<VerificationGeneration, string>> = {
    g1: ecPkUrl,
    g2: ecPkGen2Url,
};

export async function loadErcRootCertificate(generation: VerificationGeneration): Promise<ArrayBuffer> {
    const response = await fetch(rootCertificateUrls[generation]);
    if (!response.ok) {
        throw new Error('Failed to load the ERCA root certificate.');
    }
    return response.arrayBuffer();
}
