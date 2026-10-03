import type { IErrorService } from '#error-reporting';
import { ERROR_CODES, isUnknownRecord } from '#contracts';

export type TranslationCatalogue = Readonly<Record<string, string>>;
export type TranslationParameter = number | string;
export type TranslationParameters = Readonly<Record<string, TranslationParameter>>;
export type TranslationParameterMap<TKey extends string> = Readonly<Partial<Record<TKey, TranslationParameters>>>;

import type { ILocaleService } from './locale-service.js';

type EmptyTranslationParameterMap = Readonly<Record<never, never>>;

type TranslationArguments<
    TKey extends string,
    TParameterMap extends TranslationParameterMap<TKey>,
> = TKey extends keyof TParameterMap ? [parameters: TParameterMap[TKey]] : [];

export interface ITranslationService<
    TKey extends string,
    TParameterMap extends TranslationParameterMap<TKey> = EmptyTranslationParameterMap,
> {
    translate<TMessageKey extends TKey>(
        key: TMessageKey,
        ...parameters: TranslationArguments<TMessageKey, TParameterMap>
    ): string;
}

function interpolateMessage(message: string, parameters: unknown): string {
    if (!isUnknownRecord(parameters)) {
        return message;
    }

    let interpolated = message;
    for (const [name, value] of Object.entries(parameters)) {
        if (typeof value === 'number' || typeof value === 'string') {
            interpolated = interpolated.replaceAll(`{${name}}`, String(value));
        }
    }
    return interpolated;
}

function reportMissingKey(key: string, errorService: IErrorService): void {
    void errorService.report({
        code: ERROR_CODES.translationMissingKey,
        context: { key },
        severity: 'error',
        source: 'translation',
    });
}

export function createTranslationService<
    TLocale extends string,
    TKey extends string,
    TParameterMap extends TranslationParameterMap<TKey> = EmptyTranslationParameterMap,
>(
    localeService: ILocaleService<TLocale>,
    catalogues: Readonly<Record<TLocale, TranslationCatalogue>>,
    fallbackLocale: TLocale,
    errorService: IErrorService,
): ITranslationService<TKey, TParameterMap> {
    return {
        translate<TMessageKey extends TKey>(
            key: TMessageKey,
            ...parameters: TranslationArguments<TMessageKey, TParameterMap>
        ): string {
            const currentMessage = catalogues[localeService.locale][key];
            const message = currentMessage ?? catalogues[fallbackLocale][key];

            if (currentMessage === undefined) {
                reportMissingKey(key, errorService);
            }
            if (message === undefined) {
                return key;
            }

            return interpolateMessage(message, parameters[0]);
        },
    };
}
