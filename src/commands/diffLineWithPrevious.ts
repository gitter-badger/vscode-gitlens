'use strict';
import { commands, TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCommand, Commands } from './common';
import { BuiltInCommands } from '../constants';
import { GitCommit, GitService, GitUri } from '../gitService';
import { Logger } from '../logger';
import * as path from 'path';

export class DiffLineWithPreviousCommand extends ActiveEditorCommand {

    constructor(private git: GitService) {
        super(Commands.DiffLineWithPrevious);
    }

    async execute(editor: TextEditor): Promise<any>;
    async execute(editor: TextEditor, uri: Uri): Promise<any>;
    async execute(editor: TextEditor, uri?: Uri, commit?: GitCommit, line?: number): Promise<any> {
        if (!(uri instanceof Uri)) {
            if (!editor || !editor.document) return undefined;
            uri = editor.document.uri;
        }

        const gitUri = await GitUri.fromUri(uri, this.git);
        line = line || (editor && editor.selection.active.line) || gitUri.offset;

        if (!commit || GitService.isUncommitted(commit.sha)) {
            if (editor && editor.document && editor.document.isDirty) return undefined;

            const blameline = line - gitUri.offset;
            if (blameline < 0) return undefined;

            try {
                const blame = await this.git.getBlameForLine(gitUri, blameline);
                if (!blame) return window.showWarningMessage(`Unable to open compare. File is probably not under source control`);

                commit = blame.commit;

                // If we don't have a sha or the current commit matches the blame, show the previous
                if (!gitUri.sha || gitUri.sha === commit.sha) {
                    return commands.executeCommand(Commands.DiffWithPrevious, new GitUri(uri, commit), undefined, line);
                }

                // If the line is uncommitted, find the previous commit and treat it as a DiffWithWorking
                if (commit.isUncommitted) {
                    uri = commit.uri;
                    commit = new GitCommit(commit.type, commit.repoPath, commit.previousSha, commit.previousFileName, commit.author, commit.date, commit.message);
                    line = (blame.line.line + 1) + gitUri.offset;
                    return commands.executeCommand(Commands.DiffWithWorking, uri, commit, line);
                }
            }
            catch (ex) {
                Logger.error(ex, 'DiffWithPreviousLineCommand', `getBlameForLine(${blameline})`);
                return window.showErrorMessage(`Unable to open compare. See output channel for more details`);
            }
        }

        try {
            const [rhs, lhs] = await Promise.all([
                this.git.getVersionedFile(gitUri.repoPath, gitUri.fsPath, gitUri.sha),
                this.git.getVersionedFile(commit.repoPath, commit.uri.fsPath, commit.sha)
            ]);
            await commands.executeCommand(BuiltInCommands.Diff, Uri.file(lhs), Uri.file(rhs), `${path.basename(commit.uri.fsPath)} (${commit.shortSha}) ↔ ${path.basename(gitUri.fsPath)} (${gitUri.shortSha})`);
            // TODO: Figure out how to focus the left pane
            return await commands.executeCommand(BuiltInCommands.RevealLine, { lineNumber: line, at: 'center' });
        }
        catch (ex) {
            Logger.error(ex, 'DiffWithPreviousLineCommand', 'getVersionedFile');
            return window.showErrorMessage(`Unable to open compare. See output channel for more details`);
        }
    }
}