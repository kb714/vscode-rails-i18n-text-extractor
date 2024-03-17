import * as vscode from 'vscode';
import FileProcessorFactory from './fileProcessorFactory';
import I18nInformationProvider from './ui/I18nInformationProvider';
import ConfigurationWebview from './ui/configurationWebview';
import YamlFiles from './ui/yamlFiles';

export function activate(context: vscode.ExtensionContext) {
	const yamlManager = new YamlFiles(context);

	context.subscriptions.push(vscode.commands.registerCommand('extension.extract', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			// no sé en que casos puede pasar esto, pero otras extensiones hacen lo mismo
			vscode.window.showInformationMessage('No active editor');
			return;
		}

		const filePath = editor.document.uri.fsPath;
		const parts = filePath.split('.');
		const fileExtension = parts[parts.length - 1];

		const processor = FileProcessorFactory.getProcessor(editor, fileExtension);

		if (processor) {
			processor.processText();
			vscode.window.showInformationMessage(`Text processed for ${fileExtension}`);
		} else {
			vscode.window.showInformationMessage('File type not supported for extraction');
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('i18nInformation.configuration', () => {
		const configurationWebview = new ConfigurationWebview(context);
		configurationWebview.showConfiguration();
	}));

    const provider = new I18nInformationProvider(yamlManager, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('i18nInformationWebView', provider));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor && (editor.document.languageId === 'ruby' || editor.document.fileName.endsWith('.erb'))) {
			provider.updateWebview();
		}
	}));
	
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && event.document === activeEditor.document && 
			(activeEditor.document.languageId === 'ruby' || activeEditor.document.fileName.endsWith('.erb'))) {
			provider.updateWebview();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('i18nInformation.refresh', () => {
		provider.yamlManager.refresh();
		provider.updateWebview();
	  }));
}

export function deactivate() { }
