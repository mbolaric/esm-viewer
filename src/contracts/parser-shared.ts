export type ParserDataFileSourcePaths = Readonly<Record<string, string>>;

export type ParserOutputVariant = 'cardGen1' | 'cardGen2' | 'vuGen1' | 'vuGen2';

export interface IParserVuVerificationSourcePaths {
    readonly dataFileSourcePaths?: ParserDataFileSourcePaths;
    readonly memberStateCertificate: string;
    readonly vuCertificate: string;
}
