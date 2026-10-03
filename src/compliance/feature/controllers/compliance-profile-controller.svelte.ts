import { BUILTIN_RULE_PROFILES, EU_561_2006_STANDARD, type IRuleProfile } from '#compliance';

const defaultProfile: IRuleProfile = BUILTIN_RULE_PROFILES[0] ?? EU_561_2006_STANDARD;

// Shared app-wide rule profile selection controller to keep compliance findings consistent across screens.
export class ComplianceProfileController {
    #_selectedProfile = $state<IRuleProfile>(defaultProfile);

    public get selectedProfile(): IRuleProfile {
        return this.#_selectedProfile;
    }

    public selectProfile(profileId: string): boolean {
        const found = BUILTIN_RULE_PROFILES.find((profile) => profile.profileId === profileId);
        if (found === undefined) {
            return false;
        }
        this.#_selectedProfile = found;
        return true;
    }
}
