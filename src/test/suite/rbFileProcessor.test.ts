import * as vscode from 'vscode';
import * as assert from 'assert';
import RubyFileProcessor from '../../main/processors/rubyFileProcessor';

suite('RubyFileProcessor', () => {
    class TestableRubyFileProcessor extends RubyFileProcessor {
        public testTransformTextForI18nOnRuby(text: string) {
            return this.transformTextForI18nOnRuby(text);
        }
    }

    let processor: TestableRubyFileProcessor;
    let mockEditor: vscode.TextEditor;

    setup(() => {
        const document = { uri: vscode.Uri.parse('file.rb'), getText: () => '' } as unknown as vscode.TextDocument;
        mockEditor = { document } as unknown as vscode.TextEditor;
        processor = new TestableRubyFileProcessor(mockEditor);
    });

    test('should extract simple variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnRuby('text with #{foo} #{bar}');

        const expectedMap = new Map([["foo", "foo"], ["bar", "bar"]]);
        const expectedText = "text with %{foo} %{bar}";

        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });

    test('should extract repeat variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnRuby('text with #{foo} #{foo}');
        
        const expectedMap = new Map([["foo", "foo"]]);
        const expectedText = "text with %{foo} %{foo}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });
    
    test('should extract class and methods', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnRuby(
            'text with #{Foo.method(:attribute)} or #{Foo::Bar.method(:attribute)}'
            );
        
        const expectedMap = new Map([
            ["foo_method","Foo.method(:attribute)"],
            ["foo_bar_method", "Foo::Bar.method(:attribute)"]
        ]);
        const expectedText = "text with %{foo_method} or %{foo_bar_method}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });
    
    test('should extract mix variables', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnRuby(
            "#{variable} #{Foo.method(:attribute)} or #{Foo::Bar.method[:attribute]} #{other_variable}"
            );
        
        const expectedMap = new Map([
            ["variable", "variable"],
            ["other_variable", "other_variable"],
            ["foo_method", "Foo.method(:attribute)"],
            ["foo_bar_method","Foo::Bar.method[:attribute]"]
        ]);
        const expectedText = "%{variable} %{foo_method} or %{foo_bar_method} %{other_variable}";
        
        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });
    
    test('should extract weird things', async () => {
        const { transformedText, variablesMap } = processor.testTransformTextForI18nOnRuby(
            "text with #{variable} and #{foo == :bar ? 'lorem' : 'ipsum'}"
            );
        
        const expectedMap = new Map([["variable", "variable"], ["foo_bar_lorem_ipsum", "foo == :bar ? 'lorem' : 'ipsum'"]]);
        const expectedText = "text with %{variable} and %{foo_bar_lorem_ipsum}";

        assert.deepStrictEqual(variablesMap, expectedMap);
        assert.strictEqual(transformedText, expectedText);
    });    
});
