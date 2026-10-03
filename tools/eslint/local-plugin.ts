import type { ESLint } from 'eslint';

import { noDirectBrandIconImportsRule } from './no-direct-brand-icon-imports.ts';
import { noHardcodedDesignValuesRule } from './no-hardcoded-design-values.ts';
import { noHardcodedUiStringsRule } from './no-hardcoded-ui-strings.ts';
import { noModuleServiceSingletonsRule } from './no-module-service-singletons.ts';
import { noRawIntlRule } from './no-raw-intl.ts';
import { noUiServiceImplementationImportsRule } from './no-ui-service-implementation-imports.ts';
import { noUndefinedI18nKeysRule } from './no-undefined-i18n-keys.ts';
import { noUntranslatedFeedbackRule } from './no-untranslated-feedback.ts';
import { privateControllerStateRule } from './private-controller-state.ts';

export const localPlugin = {
    meta: {
        name: 'strict-application-rules',
        version: '0.0.0',
    },
    rules: {
        'no-direct-brand-icon-imports': noDirectBrandIconImportsRule,
        'no-hardcoded-design-values': noHardcodedDesignValuesRule,
        'no-hardcoded-ui-strings': noHardcodedUiStringsRule,
        'no-module-service-singletons': noModuleServiceSingletonsRule,
        'no-raw-intl': noRawIntlRule,
        'no-ui-service-implementation-imports': noUiServiceImplementationImportsRule,
        'no-undefined-i18n-keys': noUndefinedI18nKeysRule,
        'no-untranslated-feedback': noUntranslatedFeedbackRule,
        'private-controller-state': privateControllerStateRule,
    },
} satisfies ESLint.Plugin;
