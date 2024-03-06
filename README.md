# Rails I18n Extractor

Rails I18n Extractor is a VSCode plugin designed to assist in the internationalization of Ruby on Rails projects. It enables developers to manually select hardcoded strings within their project and replace them with I18n translation keys, streamlining the process of preparing an application for localization. Additionally, the plugin facilitates the generation of corresponding entries in locale YAML files.

## Features

- **Manual Text Selection**: Users can manually select the text that needs to be internationalized.
- **YAML Generation**: Automatically creates or updates locale YAML files with selected strings as I18n translation keys.
- **Custom Key Support**: Offers the ability to specify custom translation keys for the selected strings.
- **packwerk**: This plugin provides support for the [Packwerk](https://github.com/Shopify/packwerk) folder structure.

## Installation

To install the Rails I18n Extractor extension in VSCode:

1. Download the extension `.vsix` file.
2. Open VSCode Extensions
3. Click on "Views and More Actions ..." and select `Install from VSIX`.
4. Choose the downloaded file and restart VSCode.

## Usage

1. Open any Ruby or ERB file in VSCode.
2. Select the hardcoded string you wish to internationalize.
3. Right-click to open the context menu and select the `Extract` option.
4. Follow the prompts to specify a custom translation key if desired. The extension will replace the selected text with the appropriate I18n method call and generate or update the corresponding entry in your locale YAML file.

## Contributing

Contributions to Rails I18n Extractor are warmly welcomed. If you'd like to contribute, please fork the repository and use a feature branch for your development. Pull requests are highly appreciated.

## License

Rails I18n Extractor is made available under the MIT License.
