import { invoke } from '@tauri-apps/api/core';

import {
    classifyParseError,
    err,
    isUnknownRecord,
    type IJsonRecord,
    type IParserVuVerificationSourcePaths,
    ok,
    type ParseError,
    type Result,
} from '#contracts';
import type { IParsedDocumentOperation, ITachographParserPort, ParsedDocumentResult } from '#viewer-application';
import type { IntegrityAssessment, IntegrityFailureCode, VerificationGeneration } from '#viewer-domain';
import {
    decodeParserDocument,
    decodeParserNationAlphaCodes,
    decodeParserVerification,
    decodeParserVuVerification,
    isSerializedTachographData,
    isVerifyResult,
    isVuVerifyResult,
    loadErcRootCertificate,
} from '#viewer-parser-client';

function failedOperation(error: ParseError): ParsedDocumentResult {
    return err(error);
}

// The native parse and verification commands answer `{ ok, data, error }`. Returns the payload of a successful answer,
// or null for a failure or any other shape.
function successfulNativeData(response: unknown): { readonly data: unknown } | null {
    if (!isUnknownRecord(response) || response['ok'] !== true) {
        return null;
    }
    const data = response['data'];
    return data === undefined || data === null ? null : { data };
}

// Runs a native verification command. A native failure, a report of the wrong shape and an undecodable report map to
// distinct failure codes.
async function invokeVerification<TReport>(
    command: string,
    args: Record<string, unknown>,
    isReport: (value: unknown) => value is TReport,
    decode: (report: TReport) => IntegrityAssessment | null,
): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
    try {
        const response = successfulNativeData(await invoke<unknown>(command, args));
        if (response === null) {
            return err('verificationFailed');
        }
        if (!isReport(response.data)) {
            return err('decoderContractViolation');
        }
        const assessment = decode(response.data);
        return assessment === null ? err('decoderContractViolation') : ok(assessment);
    } catch {
        return err('internalError');
    }
}

export class TauriTachographParser implements ITachographParserPort {
    public loadErcRootCertificate(generation: VerificationGeneration): Promise<Result<ArrayBuffer, IntegrityFailureCode>> {
        return loadErcRootCertificate(generation).then(
            (certificate) => ok(certificate),
            () => err('internalError'),
        );
    }

    public parse(bytes: Uint8Array): IParsedDocumentOperation {
        const completion: Promise<ParsedDocumentResult> = (async () => {
            try {
                // The bytes go as the raw request body: a JSON number array would inflate a 50 MB file several times.
                const response = successfulNativeData(await invoke<unknown>('parse_ddd_memory', bytes));
                if (response === null) {
                    return failedOperation(classifyParseError('parseFailed'));
                }

                const nationAlphaCodes = await invoke<unknown>('get_supported_nation_alpha_codes');
                const decodedCodes = decodeParserNationAlphaCodes(nationAlphaCodes);
                if (!decodedCodes.ok) {
                    return failedOperation(classifyParseError('decoderContractViolation'));
                }
                if (!isSerializedTachographData(response.data)) {
                    return failedOperation(classifyParseError('decoderContractViolation'));
                }

                const decodedDocument = decodeParserDocument(response.data, decodedCodes.value);
                if (!decodedDocument.ok) {
                    return failedOperation(classifyParseError('decoderContractViolation'));
                }

                return ok(decodedDocument.value);
            } catch {
                return failedOperation(classifyParseError('internalError'));
            }
        })();

        return {
            cancel: () => undefined,
            completion,
        };
    }

    public async verify(
        generation: VerificationGeneration,
        dataFiles: IJsonRecord,
        dataFileSourcePaths: Readonly<Record<string, string>>,
        rootCertificate: ArrayBuffer,
    ): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
        return invokeVerification(
            'verify_document',
            { dataFiles, ercaPk: Array.from(new Uint8Array(rootCertificate)), generation },
            isVerifyResult,
            (report) => {
                const decoded = decodeParserVerification(report, generation, dataFiles, dataFileSourcePaths);
                return decoded.ok ? decoded.value.assessment : null;
            },
        );
    }

    public async verifyVehicleUnit(
        generation: VerificationGeneration,
        memberStateCertificateRaw: readonly number[],
        vuCertificateRaw: readonly number[],
        sourcePaths: IParserVuVerificationSourcePaths,
        dataFiles: readonly unknown[],
        rootCertificate: ArrayBuffer,
    ): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
        return invokeVerification(
            'verify_vu_document',
            {
                dataFiles: dataFiles.length > 0 ? dataFiles : null,
                ercaPk: Array.from(new Uint8Array(rootCertificate)),
                generation,
                memberStateCertificateRaw,
                vuCertificateRaw,
            },
            isVuVerifyResult,
            (report) => {
                const decoded = decodeParserVuVerification(report, generation, sourcePaths);
                return decoded.ok ? decoded.value : null;
            },
        );
    }
}
