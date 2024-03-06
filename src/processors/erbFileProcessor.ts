import * as vscode from 'vscode';
import FileProcessor from './fileProcessor';

export default class ERBFileProcessor extends FileProcessor {

    constructor(editor: vscode.TextEditor, userInput: string) {
        super(editor, userInput);
    }

    processText(): void {
        // por implementar ~(˘▾˘~)
    }
}
