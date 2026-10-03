import type { ApplicationCommandState } from '#contracts';

export interface IApplicationCommandStateTarget {
    update(state: ApplicationCommandState): boolean;
}
