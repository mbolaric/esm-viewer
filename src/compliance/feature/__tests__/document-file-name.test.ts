import { describe, expect, it } from 'vitest';

import { suggestedDocumentFileName } from '../helpers/document-file-name.js';

describe('suggestedDocumentFileName', () => {
    it('keeps letters in any script and replaces separators and reserved characters', () => {
        expect(suggestedDocumentFileName('Zaświadczenie_UE', 'Müller-Schmidt, Hans / Šimić', 'Kierowca', '.pdf')).toBe(
            'Zaświadczenie_UE_Müller-Schmidt__Hans___Šimić.pdf',
        );
    });

    it('uses the translated fallback when the driver name is empty', () => {
        expect(suggestedDocumentFileName('Infringement_Letter', '  ', 'Unnamed_driver', '.html')).toBe(
            'Infringement_Letter_Unnamed_driver.html',
        );
    });
});
