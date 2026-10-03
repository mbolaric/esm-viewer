export {
    decodeParserDocument,
    isSerializedTachographData,
    type ParserDocumentDecodeError,
} from './decoders/parser-document-decoder.js';
export {
    decodeParserNationAlphaCodes,
    type ParserNationAlphaCodes,
    type ParserNationAlphaCodesDecodeError,
} from './normalizers/parser-value-normalizer.js';
export {
    decodeParserVerification,
    isVerifyResult,
    type IParserVerificationEvidence,
    type ParserVerificationDecodeError,
} from './decoders/parser-verification-decoder.js';
export {
    decodeParserVuVerification,
    isVuVerifyResult,
    type ParserVuVerificationDecodeError,
} from './decoders/parser-vu-verification-decoder.js';
export { loadErcRootCertificate } from './erc-root-certificate.js';
export type { SerializedTachographData, VerifyResult, VuVerifyResult } from './generated/esm_parser.js';
