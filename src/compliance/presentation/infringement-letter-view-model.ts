import type { ILocalisationService } from '#localization';
import type { OpenedTachographDocument } from '#viewer-application';
import { isUtcTimestamp, type DurationMilliseconds, type UtcTimestamp } from '#tachograph-domain';
import type { IComplianceViewModel, IInfringementViewModel } from './compliance-view-model.js';

type ViewerLocalisationService = ILocalisationService<UtcTimestamp, DurationMilliseconds>;

export interface ICompanyLetterDetails {
    readonly address: string;
    readonly companyName: string;
    readonly managerName: string;
    readonly vatOrRegistration: string;
}

export interface IInfringementLetterItemViewModel {
    readonly allowedValue: string;
    readonly dateTimeDisplay: string;
    readonly excess: string;
    readonly legalReference: string;
    readonly measuredValue: string;
    readonly ruleId: string;
    readonly severity: 'minor' | 'mostSerious' | 'serious' | 'verySerious';
    readonly sourcePointer: string;
    readonly timestamp: UtcTimestamp;
    readonly title: string;
}

export interface IInfringementLetterViewModel {
    readonly auditPeriod: string;
    readonly cardNumber: string;
    readonly company: ICompanyLetterDetails;
    readonly driverExplanation: string;
    readonly driverName: string;
    readonly fileName: string;
    readonly generatedAt: string;
    readonly issuingMemberState: string;
    readonly items: readonly IInfringementLetterItemViewModel[];
    readonly minorCount: number;
    readonly mostSeriousCount: number;
    readonly seriousCount: number;
    readonly totalInfringements: number;
    readonly vehicleRegistration: string | null;
    readonly verySeriousCount: number;
    readonly vin: string | null;
}

// Initial company details default to empty strings; user entry is required before export.
export const DEFAULT_COMPANY_DETAILS: ICompanyLetterDetails = {
    address: '',
    companyName: '',
    managerName: '',
    vatOrRegistration: '',
};

export function createInfringementLetterViewModel(
    document: OpenedTachographDocument,
    complianceViewModel: IComplianceViewModel,
    localisation: ViewerLocalisationService,
    companyOverride?: Partial<ICompanyLetterDetails>,
): IInfringementLetterViewModel {
    let driverName = 'Driver';
    let cardNumber = '—';
    let issuingMemberState = '—';
    let vehicleRegistration: string | null = null;
    let vin: string | null = null;

    if (document.content.documentKind === 'driverCard') {
        const app = document.content.applications[0];
        if (app !== undefined) {
            if (app.identity !== null) {
                const driverIdentity = app.identity;
                driverName = `${driverIdentity.surname ?? ''} ${driverIdentity.firstNames ?? ''}`.trim() || 'Driver';
                cardNumber = driverIdentity.cardNumber;
                issuingMemberState = driverIdentity.issuingMemberState ?? '—';
            }

            if (app.vehicleUses.length > 0) {
                const uniqueRegistrations: string[] = [];
                for (const vehicle of app.vehicleUses) {
                    if (vehicle.registrationNumber !== null && vehicle.registrationNumber.trim().length > 0) {
                        const formattedReg =
                            vehicle.registrationMemberState !== null
                                ? `${vehicle.registrationNumber} (${vehicle.registrationMemberState})`
                                : vehicle.registrationNumber;
                        if (!uniqueRegistrations.includes(formattedReg)) {
                            uniqueRegistrations.push(formattedReg);
                        }
                    }
                }
                if (uniqueRegistrations.length > 0) {
                    vehicleRegistration = uniqueRegistrations.join(', ');
                }

                const latestWithVin = [...app.vehicleUses]
                    .reverse()
                    .find((v) => v.vehicleIdentificationNumber !== null && v.vehicleIdentificationNumber.trim().length > 0);
                if (latestWithVin !== undefined) {
                    vin = latestWithVin.vehicleIdentificationNumber;
                }
            }
        }
    } else {
        const vuIdentity = document.content.identity;
        if (vuIdentity !== null) {
            vehicleRegistration = vuIdentity.registrationNumber;
            issuingMemberState = vuIdentity.registrationMemberState ?? '—';
            vin = vuIdentity.vehicleIdentificationNumber;
        }
    }

    const company: ICompanyLetterDetails = {
        address: companyOverride?.address ?? DEFAULT_COMPANY_DETAILS.address,
        companyName: companyOverride?.companyName ?? DEFAULT_COMPANY_DETAILS.companyName,
        managerName: companyOverride?.managerName ?? DEFAULT_COMPANY_DETAILS.managerName,
        vatOrRegistration: companyOverride?.vatOrRegistration ?? DEFAULT_COMPANY_DETAILS.vatOrRegistration,
    };

    const nowTimestamp = Date.now();
    const generatedAtUtc = isUtcTimestamp(nowTimestamp) ? nowTimestamp : document.source.openedAt;
    const generatedAt = localisation.formatDateTime(generatedAtUtc);

    const items: IInfringementLetterItemViewModel[] = complianceViewModel.infringements.map((inf: IInfringementViewModel) => {
        const timestamp = inf.infringement.recordedAt ?? generatedAtUtc;
        return {
            allowedValue: inf.allowedDisplay,
            // Formatted in configured display time zone.
            dateTimeDisplay: localisation.formatDateTime(timestamp),
            excess: inf.excessDisplay,
            legalReference: inf.legalDisplay,
            measuredValue: inf.measuredDisplay,
            ruleId: inf.id,
            severity: inf.severity,
            sourcePointer: inf.sourcePath,
            timestamp,
            title: inf.title,
        };
    });

    // Severity counts derived from visible filtered items to match letter contents.
    const minorCount = items.filter((item) => item.severity === 'minor').length;
    const mostSeriousCount = items.filter((item) => item.severity === 'mostSerious').length;
    const seriousCount = items.filter((item) => item.severity === 'serious').length;
    const verySeriousCount = items.filter((item) => item.severity === 'verySerious').length;

    let periodStartStr = '—';
    let periodEndStr = '—';
    if (items.length > 0) {
        const firstTs = items[0]?.timestamp ?? generatedAtUtc;
        const lastTs = items[items.length - 1]?.timestamp ?? generatedAtUtc;
        // Formatted in display time zone to match table rows.
        periodStartStr = localisation.formatDateTime(firstTs);
        periodEndStr = localisation.formatDateTime(lastTs);
    }

    const auditPeriod = `${periodStartStr} – ${periodEndStr}`;

    return {
        auditPeriod,
        cardNumber,
        company,
        driverExplanation: '',
        driverName,
        fileName: document.source.displayName,
        generatedAt,
        issuingMemberState,
        items,
        minorCount,
        mostSeriousCount,
        seriousCount,
        totalInfringements: items.length,
        vehicleRegistration,
        verySeriousCount,
        vin,
    };
}
