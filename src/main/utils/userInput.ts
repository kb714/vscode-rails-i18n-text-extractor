import * as vscode from 'vscode';

export default class UserInput {
  static async requestYmlKey(): Promise<string | undefined> {
    const userInput = await vscode.window.showInputBox({
      placeHolder: "yml key",
      prompt: "Enter the Key to be used for extraction, without spaces or special characters.",
      validateInput: text => {
        return text.trim().length === 0 ? 'You must enter a value' : null;
      }
    });

    return userInput;
  }
}
