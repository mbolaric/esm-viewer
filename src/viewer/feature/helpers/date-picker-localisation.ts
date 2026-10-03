import {
    buildDatePickerLocalisation,
    defaultDateFormatForTimeZone,
    translateDatePickerLabels,
    type DateFormatKey,
} from '#localization';
import type { ILocalisationService, ITranslationService } from '#localization';
import type { IDatePickerLabels, IDatePickerLocalisation } from '#ui';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';

import type { IMessageParams, TranslationKey } from '#i18n-locales';
import type { ViewerPreferencesController } from '../controllers/viewer-preferences-controller.svelte.js';

export interface IDatePickerLocalisationContext {
    readonly localisationService: ILocalisationService<UtcTimestamp, DurationMilliseconds>;
    readonly preferencesController: ViewerPreferencesController;
    readonly translationService: ITranslationService<TranslationKey, IMessageParams>;
}

export interface IActivityDatePickerLocalisation {
    readonly labels: IDatePickerLabels;
    readonly localise: IDatePickerLocalisation;
    readonly placeholder: string;
}

function resolvedDateFormat(context: IDatePickerLocalisationContext): Exclude<DateFormatKey, 'auto'> {
    const dateFormat = context.preferencesController.dateFormat;
    return dateFormat === 'auto' ? defaultDateFormatForTimeZone(context.preferencesController.timeZone) : dateFormat;
}

export function createActivityDatePickerLocalisation(context: IDatePickerLocalisationContext): IActivityDatePickerLocalisation {
    const { localisationService, translationService } = context;
    const formatKey = resolvedDateFormat(context);
    const { localise, placeholder } = buildDatePickerLocalisation(localisationService, formatKey);
    return {
        labels: translateDatePickerLabels(translationService),
        localise,
        placeholder,
    };
}
