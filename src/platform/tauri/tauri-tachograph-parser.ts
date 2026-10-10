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
    loadErcRootCertificate,
    type ParserNationAlphaCodes,
} from '#viewer-parser-client';

// The native parse and verification commands answer `{ ok, data, error }`. Returns the payload of a successful answer,
// or null for a failure or any other shape.
function successfulNativeData(response: unknown): { readonly data: unknown } | null {
    if (!isUnknownRecord(response) || response['ok'] !== true) {
        return null;
    }
    const data = response['data'];
    return data === undefined || data === null ? null : { data };
}

// Native failures remain distinct from reports rejected by the decoder.
async function invokeVerification(
    command: string,
    args: Record<string, unknown>,
    decode: (report: unknown) => IntegrityAssessment | null,
): Promise<Result<IntegrityAssessment, IntegrityFailureCode>> {
    try {
        const response = successfulNativeData(await invoke<unknown>(command, args));
        if (response === null) {
            return err('verificationFailed');
        }
        const assessment = decode(response.data);
        return assessment === null ? err('decoderContractViolation') : ok(assessment);
    } catch {
        return err('internalError');
    }
}

export class TauriTachographParser implements ITachographParserPort {
    private _nationAlphaCodes: Promise<Result<ParserNationAlphaCodes, ParseError>> | null = null;

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
                    return err(classifyParseError('parseFailed'));
                }

                const decodedCodes = await this.getNationAlphaCodes();
                if (!decodedCodes.ok) {
                    return decodedCodes;
                }

                const decodedDocument = decodeParserDocument(response.data, decodedCodes.value);
                if (!decodedDocument.ok) {
                    return err(classifyParseError('decoderContractViolation'));
                }

                return ok(decodedDocument.value);
            } catch {
                return err(classifyParseError('internalError'));
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
            (report) => {
                const decoded = decodeParserVuVerification(report, generation, sourcePaths);
                return decoded.ok ? decoded.value : null;
            },
        );
    }

    private async getNationAlphaCodes(): Promise<Result<ParserNationAlphaCodes, ParseError>> {
        this._nationAlphaCodes ??= (async () => {
            try {
                const decoded = decodeParserNationAlphaCodes(await invoke<unknown>('get_supported_nation_alpha_codes'));
                return decoded.ok ? decoded : err(classifyParseError('decoderContractViolation'));
            } catch {
                return err(classifyParseError('internalError'));
            }
        })();

        const request = this._nationAlphaCodes;
        const result = await request;
        if (!result.ok && this._nationAlphaCodes === request) {
            this._nationAlphaCodes = null;
        }
        return result;
    }
}
