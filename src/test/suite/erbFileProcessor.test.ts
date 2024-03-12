import * as vscode from 'vscode';
import * as assert from 'assert';
import ERBFileProcessor from '../../main/processors/erbFileProcessor';

suite('ERBFileProcessor', () => {
    class TestableERBFileProcessor extends ERBFileProcessor {
        public testTransformTextForI18nOnHTML(text: string) {
            return this.transformTextForI18nOnHTML(text);
        }
    }

    let processor: TestableERBFileProcessor;
    let mockEditor: vscode.TextEditor;

    setup(() => {
        const document = { uri: vscode.Uri.parse('file.erb'), getText: () => '' } as unknown as vscode.TextDocument;
        mockEditor = { document } as unknown as vscode.TextEditor;
        processor = new TestableERBFileProcessor(mockEditor);
    });
    
    test('should extract common variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnHTML(
            'text with <%= variable %>'
            );
        
        const expectedMap = new Map([["variable", "variable"]]);
        const expectedText = "text with %{variable}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });

    test('should extract repeat variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnHTML(
            'text with <%= variable %> and <%= variable %>'
            );
        
        const expectedMap = new Map([["variable", "variable"]]);
        const expectedText = "text with %{variable} and %{variable}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });

    test('should extract multiple common variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnHTML(
            'text with <%= variable %>, <%= foo %> and <%= bar %>'
            );
        
        const expectedMap = new Map([
            ["variable", "variable"],
            ["foo", "foo"],
            ["bar", "bar"]
        ]);
        const expectedText = "text with %{variable}, %{foo} and %{bar}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });

    test('should extract common variables in HTML', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnHTML(
            '<div class="something">text with <%= variable %>, <%= foo %> and <%= bar %></div>'
            );
        
        const expectedMap = new Map([
            ["variable", "variable"],
            ["foo", "foo"],
            ["bar", "bar"]
        ]);
        const expectedText = '<div class="something">text with %{variable}, %{foo} and %{bar}</div>';
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });

    test('should extract mix variables in HTML', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnHTML(`
            <div class="foo" data-title="<%= title %>" style="<%= something_else == :attr ? 'text_one' : 'text_two' %>">
                <%= variable %> <p><%= Foo.method(:attribute) %></p> or 
                <%= Foo::Bar.method[:attribute] %> <%= other_variable %>"
            </div>
            `);
        
        const expectedMap = new Map([
            ["title", "title"],
            ["something_else_attr_text_one_text_two", "something_else == :attr ? 'text_one' : 'text_two'"],
            ["variable", "variable"],
            ["foo_method", "Foo.method(:attribute)"],
            ["foo_bar_method", "Foo::Bar.method[:attribute]"],
            ["other_variable", "other_variable"]
        ]);
        const expectedText = `
            <div class="foo" data-title="%{title}" style="%{something_else_attr_text_one_text_two}">
                %{variable} <p>%{foo_method}</p> or 
                %{foo_bar_method} %{other_variable}"
            </div>
            `;
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });
});
