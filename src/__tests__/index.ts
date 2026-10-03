// Shared repository test-support entry.
export { createLocalisationServiceFake, type ILocalisationFakeOptions } from './localisation-test-fake.js';
export { expectNoAxeViolations } from './axe-check.js';
export {
    createCapturingIntervalTimelineRuntimeLoader,
    createCapturingTimeSeriesRuntimeLoader,
    VisibleIntersectionObserver,
} from './time-series-chart-test-helpers.js';
export {
    fixtureActivityInterval,
    fixtureCardNumber,
    fixtureDriverIdentity,
    fixtureIdentityName,
    fixtureIssuingMemberState,
    fixtureJsonPointer,
    fixtureSingleDriverCrew,
    fixtureSourceReference,
    fixtureUtcTimestamp,
    fixtureVehicleIdentificationNumber,
    fixtureVehicleIdentity,
    fixtureVehicleRegistrationNumber,
} from './fixtures.js';
export {
    createViewerTestRenderOptions,
    createViewerTestRenderOptionsWithContext,
    type IViewerTestRenderOptions,
} from '../viewer/feature/__tests__/viewer-test-render.js';
export { expectInvalid, expectOk } from './result-assertions.js';
