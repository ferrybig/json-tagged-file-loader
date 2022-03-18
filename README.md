# json tagged file loader

This loader allows you to tag files with a json header on top, and it will split the json tag during the processing, before it is attached back later

Example:

`webpack.config.js`

	{
		test: /\.html$/,
		use: [
			{
				loader: 'json-tagged-file-loader',
				options: {
					destructure: true,
					defaultExportName: 'code',
					inputEsModule: false,
					outputEsModule: true,
					schema: {
						type: 'object',
						properties: {
							"date": {
								"type": "string",
								"format": "date"
							},
						},
						required: ["date"],
						additionalProperties: false,
					},
					extras: {
						title: 'detect-title-html',
					},
					loaders: [
						{
							loader: "html-loader",
							options: {
								minimize: true,
								esModule: false,
							},
						},
					],
				}
			},
		],
	},

`folder/test.html`

	{
        "date": "2020-03-15",
    }
	<h1>My blog post</h1>
	<p>More content</p>

Will produce the following module:

	// Module
	var code = "<h1>My blog post</h1> <p>More content</p> ";
	// Exports
	export default code;
	export const date = "2020-03-15";
	export const slug = 'folder/test'
	export const title = 'My blog post'

## TODO

* Add configuration ptions to the slug generator
* Use something better than a regex in the html title detector
* Expand the validation schema with validations for `schema`, `loaders` and `extras`
