import * as vscode from 'vscode';
import FileProcessor from './processors/fileProcessor';
import RubyFileProcessor from './processors/rubyFileProcessor';
import ERBFileProcessor from './processors/erbFileProcessor';

export default class FileProcessorFactory {
    static getProcessor(editor: vscode.TextEditor, fileExtension: string): FileProcessor | null {
        // acá registrar mas formatos
        switch (fileExtension) {
            case 'rb':
                return new RubyFileProcessor(editor);
            case 'erb':
                return new ERBFileProcessor(editor);
            default:
                return null;
        }
    }
}
