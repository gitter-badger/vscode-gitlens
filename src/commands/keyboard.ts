'use strict';
import { commands, Disposable, QuickPickItem } from 'vscode';
import { CommandContext, setCommandContext } from './common';
import { CommandQuickPickItem, OpenFileCommandQuickPickItem } from '../quickPicks';
import { Logger } from '../logger';

const keyNoopCommand = Object.create(null) as QuickPickItem;
export { keyNoopCommand as KeyNoopCommand };

export declare type Keys = 'left' | 'right' | ',' | '.';
export const keys: Keys[] = [
    'left',
    'right',
    ',',
    '.'
];

export declare type KeyMapping = { [id: string]: (QuickPickItem | (() => Promise<QuickPickItem>)) };
let mappings: KeyMapping[] = [];

let _instance: Keyboard;

export class KeyboardScope extends Disposable {

    constructor(private mapping: KeyMapping) {
        super(() => this.dispose());

        for (const key in mapping) {
            mapping[key] = mapping[key] || keyNoopCommand;
        }
    }

    async dispose() {
        const index = mappings.indexOf(this.mapping);
        Logger.log('KeyboardScope.dispose', mappings.length, index);
        if (index === (mappings.length - 1)) {
            mappings.pop();
            await this.updateKeyCommandsContext(mappings[mappings.length - 1]);
        }
        else {
            mappings.splice(index, 1);
        }
    }

    async begin() {
        mappings.push(this.mapping);
        await this.updateKeyCommandsContext(this.mapping);
        return this;
    }

    async clearKeyCommand(key: Keys) {
        const mapping = mappings[mappings.length - 1];
        if (mapping !== this.mapping || !mapping[key]) return;

        Logger.log('KeyboardScope.clearKeyCommand', mappings.length, key);
        mapping[key] = undefined;
        await setCommandContext(`${CommandContext.Key}:${key}`, false);
    }

    async setKeyCommand(key: Keys, command: QuickPickItem | (() => Promise<QuickPickItem>)) {
        const mapping = mappings[mappings.length - 1];
        if (mapping !== this.mapping) return;

        Logger.log('KeyboardScope.setKeyCommand', mappings.length, key, !!mapping[key]);

        if (!mapping[key]) {
            mapping[key] = command;
            await setCommandContext(`${CommandContext.Key}:${key}`, true);
        }
        else {
            mapping[key] = command;
        }
    }

    private async updateKeyCommandsContext(mapping: KeyMapping) {
        const promises = [];
        for (const key of keys) {
            promises.push(setCommandContext(`${CommandContext.Key}:${key}`, !!(mapping && mapping[key])));
        }
        await Promise.all(promises);
    }
}

export class Keyboard extends Disposable {

    static get instance(): Keyboard {
        return _instance;
    }

    private _disposable: Disposable;

    constructor() {
        super(() => this.dispose());

        const subscriptions: Disposable[] = [];

        for (const key of keys) {
            subscriptions.push(commands.registerCommand(`gitlens.key.${key}`, () => this.execute(key), this));
        }

        this._disposable = Disposable.from(...subscriptions);

        _instance = this;
    }

    dispose() {
        this._disposable && this._disposable.dispose();
    }

    async beginScope(mapping?: KeyMapping): Promise<KeyboardScope> {
        Logger.log('Keyboard.beginScope', mappings.length);
        return await new KeyboardScope(mapping ? Object.assign(Object.create(null), mapping) : Object.create(null)).begin();
    }

    async execute(key: Keys): Promise<{}> {
        if (!mappings.length) return undefined;

        try {
            const mapping = mappings[mappings.length - 1];

            let command = mapping[key] as CommandQuickPickItem | (() => Promise<CommandQuickPickItem>);
            if (typeof command === 'function') {
                command = await command();
            }
            if (!command || !(command instanceof CommandQuickPickItem)) return undefined;

            Logger.log('Keyboard.execute', key);

            if (command instanceof OpenFileCommandQuickPickItem) {
                // Have to open this pinned right now, because vscode doesn't have a way to open a unpinned, but unfocused editor
                return await command.execute(true);
            }

            return await command.execute();
        }
        catch (ex) {
            Logger.error(ex, 'Keyboard.execute');
            return undefined;
        }
    }
}