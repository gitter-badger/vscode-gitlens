'use strict';
import { commands, Position, Range, TextEditor, TextEditorEdit, Uri, window } from 'vscode';
import { Commands, EditorCommand } from './common';
import { BuiltInCommands } from '../constants';
import { GitService, GitUri } from '../gitService';
import { Logger } from '../logger';

export class ShowFileHistoryCommand extends EditorCommand {

    constructor(private git: GitService) {
        super(Commands.ShowFileHistory);
    }

    async execute(editor: TextEditor, edit: TextEditorEdit, uri?: Uri, position?: Position, sha?: string, line?: number) {
        if (!(uri instanceof Uri)) {
            if (!editor.document) return undefined;
            uri = editor.document.uri;
        }

        if (position == null) {
            // If the command is executed manually -- treat it as a click on the root lens (i.e. show blame for the whole file)
            position = editor.document.validateRange(new Range(0, 0, 0, 1000000)).start;
        }

        const gitUri = await GitUri.fromUri(uri, this.git);

        try {
            const locations = await this.git.getLogLocations(gitUri, sha, line);
            if (!locations) return window.showWarningMessage(`Unable to show file history. File is probably not under source control`);

            return commands.executeCommand(BuiltInCommands.ShowReferences, uri, position, locations);
        }
        catch (ex) {
            Logger.error(ex, 'ShowFileHistoryCommand', 'getLogLocations');
            return window.showErrorMessage(`Unable to show file history. See output channel for more details`);
        }
    }
}