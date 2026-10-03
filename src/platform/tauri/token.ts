import { isReopenToken, isSourceToken, type ReopenToken, type SourceToken } from '#contracts';

// Generates opaque session-only branded tokens.
function createRandomToken<TToken extends string>(guard: (value: string) => value is TToken, kind: string): TToken {
    const token = globalThis.crypto.randomUUID();
    if (!guard(token)) {
        throw new TypeError(`The generated ${kind} token is invalid.`);
    }

    return token;
}

export function createRandomReopenToken(): ReopenToken {
    return createRandomToken(isReopenToken, 'reopen');
}

export function createRandomSourceToken(): SourceToken {
    return createRandomToken(isSourceToken, 'source');
}
