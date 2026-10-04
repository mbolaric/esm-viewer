import type { ApplicationCommand, NativeWindowCommand } from '#contracts';

export const applicationEn = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'About ESM Viewer',
    'command.application.exportLogs': 'Export error log…',
    'command.application.preferences': 'Preferences…',
    'command.application.quit': 'Quit',
    'command.application.userGuide': 'User guide…',
    'command.edit.copy': 'Copy',
    'command.edit.cut': 'Cut',
    'command.edit.paste': 'Paste',
    'command.edit.redo': 'Redo',
    'command.edit.selectAll': 'Select All',
    'command.edit.undo': 'Undo',
    'command.file.close': 'Close document',
    'command.file.export': 'Export…',
    'command.file.open': 'Open file…',
    'command.view.commandPalette': 'Command palette…',
    'command.view.fullscreen': 'Full Screen',
    'dialog.tachographFiles': 'Tachograph files',
    'menu.edit': 'Edit',
    'menu.file': 'File',
    'menu.help': 'Help',
    'menu.view': 'View',
    'menu.window': 'Window',
} as const;

export type ApplicationTranslationKey = keyof typeof applicationEn;

export const applicationDe = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'Über ESM Viewer',
    'command.application.exportLogs': 'Fehlerprotokoll exportieren…',
    'command.application.preferences': 'Einstellungen…',
    'command.application.quit': 'Beenden',
    'command.application.userGuide': 'Benutzerhandbuch…',
    'command.edit.copy': 'Kopieren',
    'command.edit.cut': 'Ausschneiden',
    'command.edit.paste': 'Einfügen',
    'command.edit.redo': 'Wiederholen',
    'command.edit.selectAll': 'Alles auswählen',
    'command.edit.undo': 'Rückgängig',
    'command.file.close': 'Dokument schließen',
    'command.file.export': 'Exportieren…',
    'command.file.open': 'Datei öffnen…',
    'command.view.commandPalette': 'Befehlspalette…',
    'command.view.fullscreen': 'Vollbild',
    'dialog.tachographFiles': 'Tachographendateien',
    'menu.edit': 'Bearbeiten',
    'menu.file': 'Datei',
    'menu.help': 'Hilfe',
    'menu.view': 'Ansicht',
    'menu.window': 'Fenster',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export const applicationFr = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'À propos d’ESM Viewer',
    'command.application.exportLogs': 'Exporter le journal d’erreurs…',
    'command.application.preferences': 'Préférences…',
    'command.application.quit': 'Quitter',
    'command.application.userGuide': 'Guide de l’utilisateur…',
    'command.edit.copy': 'Copier',
    'command.edit.cut': 'Couper',
    'command.edit.paste': 'Coller',
    'command.edit.redo': 'Rétablir',
    'command.edit.selectAll': 'Tout sélectionner',
    'command.edit.undo': 'Annuler l’action',
    'command.file.close': 'Fermer le document',
    'command.file.export': 'Exporter…',
    'command.file.open': 'Ouvrir un fichier…',
    'command.view.commandPalette': 'Palette de commandes',
    'command.view.fullscreen': 'Plein écran',
    'dialog.tachographFiles': 'Fichiers de tachygraphe',
    'menu.edit': 'Édition',
    'menu.file': 'Fichier',
    'menu.help': 'Aide',
    'menu.view': 'Affichage',
    'menu.window': 'Fenêtre',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export const applicationIt = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'Informazioni su ESM Viewer',
    'command.application.exportLogs': 'Esporta registro errori…',
    'command.application.preferences': 'Preferenze…',
    'command.application.quit': 'Esci',
    'command.application.userGuide': 'Guida utente…',
    'command.edit.copy': 'Copia',
    'command.edit.cut': 'Taglia',
    'command.edit.paste': 'Incolla',
    'command.edit.redo': 'Ripeti',
    'command.edit.selectAll': 'Seleziona tutto',
    'command.edit.undo': 'Annulla azione',
    'command.file.close': 'Chiudi documento',
    'command.file.export': 'Esporta…',
    'command.file.open': 'Apri file…',
    'command.view.commandPalette': 'Tavolozza comandi',
    'command.view.fullscreen': 'Schermo intero',
    'dialog.tachographFiles': 'File del tachigrafo',
    'menu.edit': 'Modifica',
    'menu.file': 'File',
    'menu.help': 'Aiuto',
    'menu.view': 'Visualizza',
    'menu.window': 'Finestra',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export const applicationPl = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'O ESM Viewer',
    'command.application.exportLogs': 'Eksportuj dziennik błędów…',
    'command.application.preferences': 'Preferencje…',
    'command.application.quit': 'Zakończ',
    'command.application.userGuide': 'Przewodnik użytkownika…',
    'command.edit.copy': 'Kopiuj',
    'command.edit.cut': 'Wycinaj',
    'command.edit.paste': 'Wklej',
    'command.edit.redo': 'Ponów',
    'command.edit.selectAll': 'Zaznacz wszystko',
    'command.edit.undo': 'Cofnij',
    'command.file.close': 'Zamknij dokument',
    'command.file.export': 'Eksportuj…',
    'command.file.open': 'Otwórz plik…',
    'command.view.commandPalette': 'Paleta poleceń',
    'command.view.fullscreen': 'Pełny ekran',
    'dialog.tachographFiles': 'Pliki tachografu',
    'menu.edit': 'Edycja',
    'menu.file': 'Plik',
    'menu.help': 'Pomoc',
    'menu.view': 'Widok',
    'menu.window': 'Okno',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export const applicationEs = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'Acerca de ESM Viewer',
    'command.application.exportLogs': 'Exportar registro de errores…',
    'command.application.preferences': 'Preferencias…',
    'command.application.quit': 'Salir',
    'command.application.userGuide': 'Guía del usuario…',
    'command.edit.copy': 'Copiar',
    'command.edit.cut': 'Cortar',
    'command.edit.paste': 'Pegar',
    'command.edit.redo': 'Rehacer',
    'command.edit.selectAll': 'Seleccionar todo',
    'command.edit.undo': 'Deshacer',
    'command.file.close': 'Cerrar documento',
    'command.file.export': 'Exportar…',
    'command.file.open': 'Abrir archivo…',
    'command.view.commandPalette': 'Paleta de comandos',
    'command.view.fullscreen': 'Pantalla completa',
    'dialog.tachographFiles': 'Archivos de tacógrafo',
    'menu.edit': 'Editar',
    'menu.file': 'Archivo',
    'menu.help': 'Ayuda',
    'menu.view': 'Ver',
    'menu.window': 'Ventana',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export const applicationHr = {
    'application.name': 'ESM Viewer',
    'command.application.about': 'O aplikaciji ESM Viewer',
    'command.application.exportLogs': 'Izvezi zapisnik pogrešaka…',
    'command.application.preferences': 'Postavke…',
    'command.application.quit': 'Zatvori aplikaciju',
    'command.application.userGuide': 'Korisnički vodič…',
    'command.edit.copy': 'Kopiraj',
    'command.edit.cut': 'Izreži',
    'command.edit.paste': 'Zalijepi',
    'command.edit.redo': 'Ponovi',
    'command.edit.selectAll': 'Odaberi sve',
    'command.edit.undo': 'Poništi',
    'command.file.close': 'Zatvori dokument',
    'command.file.export': 'Izvezi…',
    'command.file.open': 'Otvori datoteku…',
    'command.view.commandPalette': 'Paleta naredbi',
    'command.view.fullscreen': 'Cijeli zaslon',
    'dialog.tachographFiles': 'Datoteke tahografa',
    'menu.edit': 'Uređivanje',
    'menu.file': 'Datoteka',
    'menu.help': 'Pomoć',
    'menu.view': 'Prikaz',
    'menu.window': 'Prozor',
} as const satisfies Readonly<Record<ApplicationTranslationKey, string>>;

export function resolveApplicationCatalogue(locale: string): Readonly<Record<ApplicationTranslationKey, string>> {
    switch (locale) {
        case 'de':
            return applicationDe;
        case 'fr':
            return applicationFr;
        case 'it':
            return applicationIt;
        case 'pl':
            return applicationPl;
        case 'es':
            return applicationEs;
        case 'hr':
            return applicationHr;
        default:
            return applicationEn;
    }
}

export interface IApplicationCommandDefinition {
    readonly accelerator?: string;
    readonly label: string;
}

export interface IApplicationCommandTranslation {
    translate(key: ApplicationTranslationKey): string;
}

export function resolveApplicationCommandDefinition(
    command: ApplicationCommand | NativeWindowCommand,
    translation: IApplicationCommandTranslation,
): IApplicationCommandDefinition {
    switch (command) {
        case 'application.about':
            return {
                label: translation.translate('command.application.about'),
            };
        case 'application.exportLogs':
            return {
                label: translation.translate('command.application.exportLogs'),
            };
        case 'application.preferences':
            return {
                accelerator: 'CommandOrControl+,',
                label: translation.translate('command.application.preferences'),
            };
        case 'application.quit':
            return {
                accelerator: 'CommandOrControl+Q',
                label: translation.translate('command.application.quit'),
            };
        case 'application.userGuide':
            return {
                accelerator: 'F1',
                label: translation.translate('command.application.userGuide'),
            };
        case 'file.close':
            return {
                accelerator: 'CommandOrControl+W',
                label: translation.translate('command.file.close'),
            };
        case 'file.export':
            return {
                accelerator: 'CommandOrControl+Shift+E',
                label: translation.translate('command.file.export'),
            };
        case 'file.open':
            return {
                accelerator: 'CommandOrControl+O',
                label: translation.translate('command.file.open'),
            };
        case 'view.fullscreen':
            return {
                accelerator: 'F11',
                label: translation.translate('command.view.fullscreen'),
            };
        case 'view.commandPalette':
            return {
                accelerator: 'CommandOrControl+K',
                label: translation.translate('command.view.commandPalette'),
            };
    }
}
