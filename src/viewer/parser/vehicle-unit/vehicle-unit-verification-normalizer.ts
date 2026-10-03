import type { IVuVerificationApplication } from '#viewer-application';
import type { JsonPointer, TachographGeneration } from '#viewer-domain';

import { createJsonPointer } from '../json-pointer.js';
import type { ParserVehicleUnitTransferParameter } from '../decoders/parser-result-types.js';
import type { VUFileData } from '../generated/esm_parser.js';

// Extracts raw certificate byte arrays, data files, and source pointers for VU verification.
export function normalizeVehicleUnitVerification(
    transferResParams: readonly ParserVehicleUnitTransferParameter[],
    generation: TachographGeneration,
    dataFiles?: readonly VUFileData[],
): IVuVerificationApplication | null {
    for (const [index, parameter] of transferResParams.entries()) {
        const data = parameter.data;
        if (typeof data !== 'object' || !('Control' in data)) {
            continue;
        }

        const control = data.Control;
        const isGen1Shape = 'memberStateCertificate' in control;
        const memberStateCertificateField = isGen1Shape ? 'memberStateCertificate' : 'memberStateCertificateRaw';
        const vuCertificateField = isGen1Shape ? 'vuCertificate' : 'vuCertificateRaw';

        const dataFileSourcePaths: Record<string, JsonPointer> = {};
        const safeDataFiles = dataFiles ?? [];
        for (const [fileIndex, file] of safeDataFiles.entries()) {
            const pointer = createJsonPointer(['dataFiles', fileIndex]);
            dataFileSourcePaths[`${file.trepId}.${String(file.position)}`] = pointer;
            if (!(file.trepId in dataFileSourcePaths)) {
                dataFileSourcePaths[file.trepId] = pointer;
            }
        }

        return {
            dataFiles: safeDataFiles,
            dataFileSourcePaths,
            generation: generation === 'g1' ? 'g1' : 'g2',
            memberStateCertificateRaw: isGen1Shape ? control.memberStateCertificate : control.memberStateCertificateRaw,
            memberStateCertificateSourcePath: createJsonPointer([
                'transferResParams',
                index,
                'data',
                'Control',
                memberStateCertificateField,
            ]),
            vuCertificateRaw: isGen1Shape ? control.vuCertificate : control.vuCertificateRaw,
            vuCertificateSourcePath: createJsonPointer(['transferResParams', index, 'data', 'Control', vuCertificateField]),
        };
    }

    return null;
}
