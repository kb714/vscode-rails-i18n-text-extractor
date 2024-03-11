import * as vscode from 'vscode';



export default class I18nInformationProvider implements vscode.WebviewViewProvider {
	constructor(public yamlManager: any, context: vscode.ExtensionContext) {
		this._context = context;
	}
	private _context: vscode.ExtensionContext;
	private webviewView?: vscode.WebviewView;

	public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): void | Thenable<void> {
		this.webviewView = webviewView;
		webviewView.webview.options = { enableScripts: true };

		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'goToDefinition') {
				const { position } = message;
				if (vscode.window.activeTextEditor) {
					const editor = vscode.window.activeTextEditor;
					// esto lo podemos hacer dinamico, 6 para que el cursos quede en la t de I18n.t
					const newPosition = new vscode.Position(position.line, position.character + 6);
					const newSelection = new vscode.Selection(newPosition, newPosition);
					editor.selection = newSelection;
					await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
					editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenter);
				}
			}
		}, undefined, this._context.subscriptions);

		this.updateWebview();
	}

	public async updateWebview() {
		if (this.webviewView) {
			const editor = vscode.window.activeTextEditor;
			if (editor && (editor.document.languageId === 'ruby' || editor.document.fileName.endsWith('.erb'))) {
				this.webviewView.webview.html = this.getHtmlForWebview(true, "");
				await this.yamlManager.waitForLoad();
				const keys = this.extractI18nKeys(editor.document);
				const tableRows = await this.generateTableRows(keys);
				this.webviewView.webview.html = this.getHtmlForWebview(false, tableRows);
			} else {
				this.webviewView.webview.html = this.getHtmlForWebview(false, "");
			}
		}
	}

	private extractI18nKeys(document: vscode.TextDocument): { key: string, position: vscode.Position }[] {
		const text = document.getText();
		const i18nRegex = /I18n\.t\(['"`](.*?)['"`]\)/g;
		let match;
		const keysWithPosition: { key: string, position: vscode.Position }[] = [];

		while ((match = i18nRegex.exec(text)) !== null) {
			if (match[1]) {
				// Guardamos también la posición para hacer un goToDefinition
				// quizás podríamos hacer algo mas, como ir a la definición del yml
				const position = document.positionAt(match.index);
				keysWithPosition.push({ key: match[1], position });
			}
		}

		return keysWithPosition;
	}

	private async generateTableRows(keys: { key: string; position: vscode.Position }[]): Promise<string> {
		const rowsPromises = keys.map(async ({ key, position }) => {
			const fullKey = "es.".concat(key);
			const unscapedValue = await this.yamlManager.findKey(fullKey)
			let value;
			if(unscapedValue) {
				value = this.escapeHtml(unscapedValue)
			} else {
				value = '<span style="color: var(--vscode-editorOverviewRuler-warningForeground)">not found</span>';
			}
			const positionString = JSON.stringify({ line: position.line, character: position.character });
			return `<vscode-data-grid-row>
				<vscode-data-grid-cell grid-column="1">${key}</vscode-data-grid-cell>
				<vscode-data-grid-cell grid-column="2">${value}</vscode-data-grid-cell>
				<vscode-data-grid-cell grid-column="3">
					<vscode-button appearance="icon" onclick="goToDefinition('${positionString.replace(/"/g, '&quot;')}')">
						<i class="codicon codicon-code"></i>
					</vscode-button>
				</vscode-data-grid-cell>
			</vscode-data-grid-row>`;
		});

		const rows = await Promise.all(rowsPromises);
		return rows.join('');
	}

	private getHtmlForWebview(showProgress: boolean, rows: string) {
		const toolkitUri = this.webviewView?.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'));
		const codiconsUri = this.webviewView?.webview?.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
		let bodyContent = showProgress ?
			`<div style="display: flex; justify-content: center; align-items: center; height: 100%; margin-top: 20px">
					<vscode-progress-ring></vscode-progress-ring>
				</div>`
			: `<vscode-data-grid generate-header="sticky">
				<vscode-data-grid-row row-type="sticky-header">
					<vscode-data-grid-cell cell-type="columnheader" grid-column="1">Key</vscode-data-grid-cell>
					<vscode-data-grid-cell cell-type="columnheader" grid-column="2">Value</vscode-data-grid-cell>
				</vscode-data-grid-row>
				${rows}
			</vscode-data-grid>`;
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link href="${codiconsUri}" rel="stylesheet" />
			<script type="module" src="${toolkitUri}"></script>
		</head>
		<body>
			${bodyContent}
			<script>
				const vscode = acquireVsCodeApi();
				function goToDefinition(positionString) {
					const position = JSON.parse(positionString);
					vscode.postMessage({ command: 'goToDefinition', position });
				}
			</script>
		</body>
		</html>`;
	}

	private escapeHtml(value: string) {
		return value
		  .replace(/&/g, "&amp;")
		  .replace(/</g, "&lt;")
		  .replace(/>/g, "&gt;")
		  .replace(/"/g, "&quot;")
		  .replace(/'/g, "&#39;");
	  }
}
