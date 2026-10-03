import type { ICompanyLetterDetails, IInfringementLetterViewModel } from './infringement-letter-view-model.js';

export interface IInfringementLetterDraft {
    readonly company: ICompanyLetterDetails;
    readonly driverExplanation: string;
}

// Synchronously builds the editable draft; persisted company details win over the document prefill.
export function createInitialInfringementLetterDraft(
    model: IInfringementLetterViewModel,
    persistedCompany: ICompanyLetterDetails | null,
): IInfringementLetterDraft {
    return {
        company: {
            address: persistedCompany?.address ?? model.company.address,
            companyName: persistedCompany?.companyName ?? model.company.companyName,
            managerName: persistedCompany?.managerName ?? model.company.managerName,
            vatOrRegistration: persistedCompany?.vatOrRegistration ?? model.company.vatOrRegistration,
        },
        driverExplanation: model.driverExplanation,
    };
}

// Merges user draft edits into the base letter view model for preview, print, or export.
export function createInfringementLetterExportModel(
    model: IInfringementLetterViewModel,
    draft: IInfringementLetterDraft,
): IInfringementLetterViewModel {
    return {
        ...model,
        company: draft.company,
        driverExplanation: draft.driverExplanation,
    };
}
