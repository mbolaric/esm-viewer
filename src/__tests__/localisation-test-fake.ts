import type { DateFormatKey, ILocalisationService } from '#localization';
import type { DurationMilliseconds, UtcTimestamp } from '#viewer-domain';

export interface ILocalisationFakeOptions {
    readonly dateFormat?: Exclude<DateFormatKey, 'auto'>;
    readonly locale?: string;
    readonly timeZone?: string;
}

export function createLocalisationServiceFake(
    options: ILocalisationFakeOptions = {},
): ILocalisationService<UtcTimestamp, DurationMilliseconds> {
    const dateFormat = options.dateFormat ?? 'ddMMyyyy';
    const locale = options.locale ?? 'en';
    const timeZone = options.timeZone ?? 'UTC';
    return {
        dateFormat,
        locale,
        timeZone,
        formatDate: (value) => `date:${timeZone}:${String(value)}`,
        formatDateTime: (value) => `date-time:${timeZone}:${String(value)}`,
        formatDuration: (value) => `duration:${String(value)}`,
        formatMonthLabel: (value) => `month:${String(value)}`,
        formatMonthShortLabel: (value) => `month-short:${String(value)}`,
        formatNumber: (value) => `number:${String(value)}`,
        formatUtcDate: (value) => `utc-date:${String(value)}`,
        formatUtcTime: (value) => `utc-time:${String(value)}`,
        formatWeekdayLabels: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
}
