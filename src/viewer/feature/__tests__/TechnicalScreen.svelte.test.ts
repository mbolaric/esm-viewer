import {
    createCardChipTechnicalData,
    createCardControlActivityTechnicalRecord,
    createSourceReference,
    createSpecificConditionTechnicalRecord,
    createVehicleUnitCalibrationTechnicalRecord,
    createVehicleUnitIdentificationTechnicalRecord,
    isJsonPointer,
    isTechnicalHexIdentifier,
    isUtcTimestamp,
    isVehicleIdentificationNumber,
    type ISourceReference,
    type TechnicalHexIdentifier,
    type UtcTimestamp,
    type VehicleIdentificationNumber,
} from '#viewer-domain';
import type {
    ITechnicalFieldViewModel,
    ITechnicalRecordViewModel,
    ITechnicalSectionViewModel,
    TechnicalFieldKey,
} from '#viewer-presentation';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TechnicalScreen from '../components/screens/TechnicalScreen.svelte';
import { createDocumentScopedValue } from '../controllers/document-scoped-value.svelte.js';
import { createViewerTestRenderOptions } from './viewer-test-render.js';

afterEach(() => {
    cleanup();
});

function source(path: string): ISourceReference<'g2v2', 'driverCard'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The technical screen source must be valid.');
    }
    return createSourceReference('driverCard', 'g2v2', path);
}

function vehicleSource(path: string): ISourceReference<'g2v2', 'vehicleUnit'> {
    if (!isJsonPointer(path)) {
        throw new TypeError('The Vehicle Unit technical screen source must be valid.');
    }
    return createSourceReference('vehicleUnit', 'g2v2', path);
}

function timestamp(value: number): UtcTimestamp {
    if (!isUtcTimestamp(value)) {
        throw new TypeError('The technical screen fixture timestamp must be valid.');
    }
    return value;
}

function hexIdentifier(value: string, byteLength: number): TechnicalHexIdentifier {
    if (!isTechnicalHexIdentifier(value, byteLength)) {
        throw new TypeError('The technical screen fixture identifier must be valid.');
    }
    return value;
}

function vehicleIdentificationNumber(value: string): VehicleIdentificationNumber {
    if (!isVehicleIdentificationNumber(value)) {
        throw new TypeError('The technical screen fixture VIN must be valid.');
    }
    return value;
}

function displayField(key: TechnicalFieldKey, display: string | null, copyValue: string | null = null): ITechnicalFieldViewModel {
    return {
        key,
        value: {
            code: copyValue !== null,
            copyValue,
            display,
            kind: 'display',
        },
    };
}

function viewModel(): ITechnicalSectionViewModel {
    const chipRecord = createCardChipTechnicalData({
        manufacturingReference: hexIdentifier('12345678', 4),
        serialNumber: hexIdentifier('DEADBEEF', 4),
        source: source('/cardChipIdentification'),
    });
    const controlRecord = createCardControlActivityTechnicalRecord({
        controlCard: null,
        controlledAt: timestamp(Date.UTC(2026, 5, 18, 10)),
        controlType: 'cardDownloaded',
        downloadPeriodBegin: null,
        downloadPeriodEnd: null,
        registrationMemberState: null,
        registrationNumber: null,
        source: source('/controlActivityData'),
    });
    if (controlRecord === null) {
        throw new TypeError('The technical screen fixture control record must be valid.');
    }
    const conditionRecord = createSpecificConditionTechnicalRecord({
        conditionType: 'outOfScopeBegin',
        enteredAt: timestamp(Date.UTC(2026, 5, 18, 10)),
        source: source('/specificConditions/specificConditionRecords/0'),
    });
    const chip: ITechnicalRecordViewModel = {
        category: 'identification',
        fields: [
            displayField('chipSerialNumber', 'DEADBEEF', 'DEADBEEF'),
            displayField('chipManufacturingReference', '12345678', '12345678'),
        ],
        generation: 'g2v2',
        kind: 'chip',
        record: chipRecord,
        recordedAt: null,
        recordedAtTimestamp: null,
        source: source('/cardChipIdentification'),
    };
    const control: ITechnicalRecordViewModel = {
        category: 'operational',
        fields: [
            {
                key: 'controlType',
                value: {
                    kind: 'controlType',
                    value: 'cardDownloaded',
                },
            },
            {
                key: 'controlCardType',
                value: {
                    kind: 'cardType',
                    value: 'controlCard',
                },
            },
            displayField('vehicleRegistrationNumber', 'TEST-123', 'TEST-123'),
        ],
        generation: 'g2v2',
        kind: 'controlActivity',
        record: controlRecord,
        recordedAt: '18 Jun 2026, 10:00',
        recordedAtTimestamp: timestamp(Date.UTC(2026, 5, 18, 10)),
        source: source('/controlActivityData'),
    };
    const condition: ITechnicalRecordViewModel = {
        category: 'operational',
        fields: [
            {
                key: 'specificConditionType',
                value: {
                    kind: 'specificConditionType',
                    value: 'outOfScopeBegin',
                },
            },
        ],
        generation: 'g2v2',
        kind: 'specificCondition',
        record: conditionRecord,
        recordedAt: null,
        recordedAtTimestamp: null,
        source: source('/specificConditions/specificConditionRecords/0'),
    };

    return {
        documentKind: 'driverCard',
        identificationRecords: [chip],
        locale: 'en',
        operationalRecords: [control, condition],
        timeZone: 'Europe/Berlin',
        totalCount: {
            display: '3',
            value: 3,
        },
    };
}

describe('TechnicalScreen', () => {
    it('renders indexed identification and operational evidence with working actions', async () => {
        const copy = vi.fn(() => Promise.resolve(true));
        const openSource = vi.fn();
        render(
            TechnicalScreen,
            {
                props: {
                    documentKind: 'driverCard',
                    filterText: createDocumentScopedValue(''),
                    oncopy: copy,
                    onopensource: openSource,
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: viewModel(),
                },
            },
            createViewerTestRenderOptions(),
        );

        const heading = screen.getByRole('heading', {
            level: 1,
            name: 'Technical card evidence',
        });
        expect(document.activeElement).toBe(heading);
        const sectionIndex = screen.getByRole('navigation', {
            name: 'Technical evidence sections',
        });
        expect(
            within(sectionIndex).getByRole('link', {
                name: 'Card and application identification',
            }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('heading', {
                    level: 2,
                    name: 'Card and application identification',
                })
                .closest('section')
                ?.classList.contains('technical-identification'),
        ).toBe(true);
        expect(
            screen
                .getByText('Integrated-circuit chip identification')
                .closest('article')
                ?.parentElement?.classList.contains('technical-identification-records'),
        ).toBe(true);
        expect(screen.getByText('DEADBEEF')).toBeTruthy();

        const table = screen.getByRole('table', {
            name: 'Recorded card downloads, current use, controls, and specific conditions',
        });
        expect(table.classList.contains('wide')).toBe(true);
        expect(table.querySelector('.evidence-details')?.classList.contains('dense')).toBe(true);
        expect(within(table).getByText('Card downloaded')).toBeTruthy();
        expect(within(table).getByText('Control card')).toBeTruthy();
        expect(within(table).getByText('Out-of-scope period started')).toBeTruthy();
        expect(within(table).getByText('Not recorded')).toBeTruthy();

        const copyButton = screen.getByRole('button', {
            name: 'Copy value: Chip serial number',
        });
        expect(copyButton.classList.contains('compact')).toBe(true);
        expect(copyButton.classList.contains('icon-only')).toBe(true);
        expect(copyButton.getAttribute('data-tooltip')).toBe('Copy value');
        expect(copyButton.querySelector('svg')).not.toBeNull();
        await fireEvent.click(copyButton);
        await waitFor(() => {
            expect(copy).toHaveBeenCalledWith('DEADBEEF');
        });
        expect(screen.getByText('Value copied to the clipboard.')).toBeTruthy();

        await fireEvent.click(
            within(table).getByRole('button', {
                name: 'Open in Raw Data: /controlActivityData',
            }),
        );
        expect(openSource).toHaveBeenCalledWith(source('/controlActivityData').path);
    });

    it('sorts the recorded-time column chronologically instead of by formatted text', async () => {
        function conditionRow(enteredAt: UtcTimestamp, display: string, path: string): ITechnicalRecordViewModel {
            return {
                category: 'operational',
                fields: [displayField('specificConditionType', 'Out-of-scope period started')],
                generation: 'g2v2',
                kind: 'specificCondition',
                record: createSpecificConditionTechnicalRecord({
                    conditionType: 'outOfScopeBegin',
                    enteredAt,
                    source: source(path),
                }),
                recordedAt: display,
                recordedAtTimestamp: enteredAt,
                source: source(path),
            };
        }
        render(
            TechnicalScreen,
            {
                props: {
                    documentKind: 'driverCard',
                    filterText: createDocumentScopedValue(''),
                    oncopy: vi.fn(() => Promise.resolve(true)),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: {
                        ...viewModel(),
                        identificationRecords: [],
                        // Provided newest first, so a text sort and a chronological sort disagree in both directions.
                        operationalRecords: [
                            conditionRow(timestamp(Date.UTC(2026, 5, 18, 10)), '18 Jun 2026, 10:00', '/specificConditions/2026'),
                            conditionRow(timestamp(Date.UTC(2025, 11, 31, 23)), '31 Dec 2025, 23:00', '/specificConditions/2025'),
                        ],
                    },
                },
            },
            createViewerTestRenderOptions(),
        );
        const table = screen.getByRole('table', {
            name: 'Recorded card downloads, current use, controls, and specific conditions',
        });
        const sortButton = within(table).getByRole('button', { name: 'Recorded time' });

        await fireEvent.click(sortButton);
        const ascendingRows = within(table).getAllByRole('row').slice(1);
        expect(ascendingRows[0]?.textContent).toContain('31 Dec 2025');
        expect(ascendingRows[1]?.textContent).toContain('18 Jun 2026');

        await fireEvent.click(sortButton);
        const descendingRows = within(table).getAllByRole('row').slice(1);
        expect(descendingRows[0]?.textContent).toContain('18 Jun 2026');
        expect(descendingRows[1]?.textContent).toContain('31 Dec 2025');
    });

    it('renders explicit empty and presentation-error states', async () => {
        const commonProps = {
            documentKind: 'driverCard' as const,
            filterText: createDocumentScopedValue(''),
            oncopy: vi.fn(() => Promise.resolve(true)),
            onopensource: vi.fn(),
            onselectrecord: vi.fn(),
            selectedRecord: null,
        };
        const rendered = render(
            TechnicalScreen,
            {
                props: {
                    ...commonProps,
                    viewModel: {
                        ...viewModel(),
                        identificationRecords: [],
                        operationalRecords: [],
                    },
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(screen.getByText('No card or application identification data was decoded.')).toBeTruthy();
        expect(screen.getByText('No download, usage, control, or condition records were decoded.')).toBeTruthy();

        await rendered.rerender({
            ...commonProps,
            viewModel: null,
        });
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Technical evidence unavailable',
            }),
        ).toBeTruthy();
    });

    it('renders Vehicle Unit identification, calibration purpose, and explicit limitations', () => {
        const identificationRecord = createVehicleUnitIdentificationTechnicalRecord({
            ability: null,
            approvalNumber: 'APPROVAL',
            manufacturerAddress: 'Synthetic address',
            manufacturerName: 'Synthetic VU',
            manufacturedAt: timestamp(Date.UTC(2026, 5, 18, 10)),
            partNumber: 'VU-2000',
            serialNumber: {
                manufacturerCode: 2,
                monthYear: '0626',
                serialNumber: 1,
                type: 1,
            },
            softwareInstalledAt: timestamp(Date.UTC(2026, 5, 18, 10)),
            softwareVersion: '1.0',
            source: vehicleSource('/transferResParams/1/data/Calibration/identification'),
            vehicleUnitGeneration: null,
        });
        const calibrationRecord = createVehicleUnitCalibrationTechnicalRecord({
            authorisedSpeedKilometresPerHour: 90,
            calibratedAt: timestamp(Date.UTC(2026, 5, 18, 10)),
            kConstantPulsesPerKilometre: 4100,
            lTyreCircumferenceMillimetres: 2200,
            newOdometer: null,
            nextCalibrationAt: null,
            oldOdometer: null,
            previousTime: null,
            purpose: 'periodicInspection',
            registrationMemberState: null,
            registrationNumber: null,
            source: vehicleSource('/transferResParams/1/data/Calibration/vuCalibrationRecordArray/records/0'),
            tyreSize: '225/75 R16',
            vehicleIdentificationNumber: vehicleIdentificationNumber('WVWZZZ1JZXW000001'),
            wVehicleCharacteristicPulsesPerKilometre: 4100,
            workshopAddress: 'Synthetic address',
            workshopCard: null,
            workshopCardExpiryAt: null,
            workshopName: 'Synthetic workshop',
        });
        const identification: ITechnicalRecordViewModel = {
            category: 'identification',
            fields: [displayField('manufacturerName', 'Synthetic VU'), displayField('partNumber', 'VU-2000', 'VU-2000')],
            generation: 'g2v2',
            kind: 'vehicleUnitIdentification',
            record: identificationRecord,
            recordedAt: null,
            recordedAtTimestamp: null,
            source: vehicleSource('/transferResParams/1/data/Calibration/identification'),
        };
        const calibration: ITechnicalRecordViewModel = {
            category: 'operational',
            fields: [
                {
                    key: 'calibrationPurpose',
                    value: {
                        kind: 'calibrationPurpose',
                        value: 'periodicInspection',
                    },
                },
                displayField('vehicleIdentificationNumber', 'WVWZZZ1JZXW000001', 'WVWZZZ1JZXW000001'),
            ],
            generation: 'g2v2',
            kind: 'vehicleUnitCalibration',
            record: calibrationRecord,
            recordedAt: '18 Jun 2026, 10:00',
            recordedAtTimestamp: timestamp(Date.UTC(2026, 5, 18, 10)),
            source: vehicleSource('/transferResParams/1/data/Calibration/vuCalibrationRecordArray/records/0'),
        };

        render(
            TechnicalScreen,
            {
                props: {
                    documentKind: 'vehicleUnit',
                    filterText: createDocumentScopedValue(''),
                    oncopy: vi.fn(() => Promise.resolve(true)),
                    onopensource: vi.fn(),
                    onselectrecord: vi.fn(),
                    selectedRecord: null,
                    viewModel: {
                        documentKind: 'vehicleUnit',
                        identificationRecords: [identification],
                        locale: 'en',
                        operationalRecords: [calibration],
                        timeZone: 'Europe/Berlin',
                        totalCount: {
                            display: '2',
                            value: 2,
                        },
                    },
                },
            },
            createViewerTestRenderOptions(),
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Vehicle Unit technical evidence',
            }),
        ).toBeTruthy();
        expect(screen.getByText('Synthetic VU')).toBeTruthy();
        expect(screen.getByText('Periodic inspection')).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Additional technical containers',
            }),
        ).toBeTruthy();
        expect(screen.getByText(/Sensor pairing, company locks, time adjustments, embedded-card downloads/u)).toBeTruthy();
    });
});
