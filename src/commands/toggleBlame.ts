'use strict';
import { TextEditor, TextEditorEdit, Uri, window } from 'vscode';
import { BlameAnnotationController } from '../blameAnnotationController';
import { Commands, EditorCommand } from './common';
import { Logger } from '../logger';

export class ToggleBlameCommand extends EditorCommand {

    constructor(private annotationController: BlameAnnotationController) {
        super(Commands.ToggleBlame);
    }

    async execute(editor: TextEditor, edit: TextEditorEdit, uri?: Uri, sha?: string): Promise<any> {
        if (editor && editor.document && editor.document.isDirty) return undefined;

        try {
            if (sha) {
                return this.annotationController.toggleBlameAnnotation(editor, sha);
            }

            return this.annotationController.toggleBlameAnnotation(editor, editor.selection.active.line);
        }
        catch (ex) {
            Logger.error(ex, 'ToggleBlameCommand');
            return window.showErrorMessage(`Unable to show blame annotations. See output channel for more details`);
        }
    }
}