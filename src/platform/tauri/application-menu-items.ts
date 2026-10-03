import { MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import type { ApplicationMenuItem, IApplicationCommand } from '#shell';

export async function createNativeCommandMenuItem<TCommandId extends string>(
    command: IApplicationCommand<TCommandId>,
    commandItems: Map<TCommandId, MenuItem>,
): Promise<MenuItem> {
    const item = await MenuItem.new({
        ...(command.accelerator === undefined ? {} : { accelerator: command.accelerator }),
        action: command.onexecute,
        enabled: command.enabled,
        id: command.id,
        text: command.label,
    });
    commandItems.set(command.id, item);
    return item;
}

export async function createNativeMenuItems<TCommandId extends string>(
    items: readonly ApplicationMenuItem<TCommandId>[],
    commands: readonly IApplicationCommand<TCommandId>[],
    commandItems: Map<TCommandId, MenuItem>,
): Promise<(MenuItem | PredefinedMenuItem)[]> {
    const resolved: (MenuItem | PredefinedMenuItem)[] = [];
    for (const item of items) {
        if (item === 'separator') {
            resolved.push(await PredefinedMenuItem.new({ item: 'Separator' }));
        } else {
            const command = commands.find((candidate) => candidate.id === item);
            if (command === undefined) {
                throw new TypeError('A native menu references an undefined application command.');
            }
            resolved.push(await createNativeCommandMenuItem(command, commandItems));
        }
    }
    return resolved;
}
