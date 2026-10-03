import type { ITranslationService } from '#localization';

import type { IMessageParams, TranslationKey } from '#i18n-locales';

export class ReactiveTestTranslationService implements ITranslationService<TranslationKey, IMessageParams> {
    #_heading = $state('Open a tachograph file');

    public translate<TMessageKey extends TranslationKey>(
        key: TMessageKey,
        ..._parameters: TMessageKey extends keyof IMessageParams ? [parameters: IMessageParams[TMessageKey]] : []
    ): string {
        if (key === 'welcome.heading') {
            return this.#_heading;
        }
        return key;
    }

    public setHeading(heading: string): void {
        this.#_heading = heading;
    }
}
