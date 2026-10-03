export type ToastVariant = 'error' | 'info' | 'success' | 'warning';

export interface IToastAction {
    readonly label: string;
    readonly onclick: () => void;
}

export interface IToastItem {
    readonly action?: IToastAction | undefined;
    readonly createdAt: number;
    readonly dismissLabel?: string | undefined;
    readonly dismissible: boolean;
    readonly durationMs: number;
    readonly id: string;
    readonly message: string;
    readonly title?: string | undefined;
    readonly variant: ToastVariant;
}

export interface IToastOptions {
    readonly action?: IToastAction | undefined;
    readonly dismissLabel?: string | undefined;
    readonly dismissible?: boolean | undefined;
    readonly durationMs?: number | undefined;
    readonly title?: string | undefined;
    readonly variant?: ToastVariant | undefined;
}
