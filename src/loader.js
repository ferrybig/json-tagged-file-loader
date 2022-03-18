import path from 'path';
import { runLoaders } from "loader-runner";
import { validate } from "schema-utils";

function doRunLoaders(opts) {
	return new Promise((resolve, reject) => {
		try {
			runLoaders(opts, (err, stats) => {
				if(err) {
					reject(err);
				} else {
					resolve(stats);
				}
			})
		} catch(e) {
			reject(e);
		}
	})
}

function writeExport(esModule, key, value) {
	if (esModule) {
		return `export ${key == null ? 'default' : `const ${key} =`} ${value};\n`;
	} else {
		return `module.exports${key == null ? '' : `.${key}`} = ${value};\n`;
	}
}
function writeImport(esModule, variable, from) {
	if (esModule) {
		return `import ${variable} from ${JSON.stringify(from)};\n`;
	} else {
		return `const ${variable} = require(${JSON.stringify(from)});\n`;
	}
}

function breakApart(buffer) {
	let done = false;
	let quote = false;
	let escape = 2;
	let indent = 0;
	let i;
	for (i = 0; i < buffer.length && !done; i++) {
		const c = buffer[i];
		if (escape > 0) {
			escape--;
		}
		switch(c) {
			case '[':
			case "{":
				if (!quote) {
					indent++;
				}
				break;
			case ']':
			case "}":
				//console.log('seen' + c + ' indent before ' + indent)
				if (!quote) {
					indent--;
					if (indent < 0) {
						throw new Error("Corrupted json tag found on top of markdown file");
					}
					if (indent === 0) {
						done = true;
					}
				}
				break;
			case "\\":
				if (escape === 0) {
					escape = 2;
				} else {
					escape = 0;
				}
				break;
			case "\"":
				if (!escape) {
					quote != quote;
				}
				break;
		}
	}
	if (done) {
		return {
			json: JSON.parse(buffer.substring(0, i)),
			md: buffer.substring(i),
		}
	} else {
		throw new Error("Markdown file is not tagged with a markdown tag!");
	}
}
/**
 *
 * @param {string} content Content of the resource file
 * @param {object} [map] SourceMap data consumable by https://github.com/mozilla/source-map
 * @param {any} [meta] Meta data, could be anything
 * @returns string
 */
export default async function taggedMarkdownLoader(buffer, map, meta) {
	const {
		loaders,
		destructure,
		defaultExportName = 'code',
		inputEsModule = true,
		outputEsModule = true,
		validationErrorsAsWarnings = false,
		extras = {},
		schema: parsedSchema,
	} = this.getOptions();

	const { json, md } = breakApart(buffer);
	try {
		validate(parsedSchema, json, { name: this.resource });
	} catch(e) {
		if (validationErrorsAsWarnings) {
			this.emitWarning(e);
		} else {
			this.emitError(e);
		}
	}

	function getCurrentLoader(loaderContext, index = loaderContext.loaderIndex) {
		if (
			loaders &&
			loaders.length &&
			index < loaders.length &&
			index >= 0 &&
			loaders[index]
		) {
			return loaders[index];
		}
		return null;
	}
	const loaderContext = {
		version: 2,
		getOptions: schema => {
			const loader = getCurrentLoader(loaderContext);

			let { options } = loader;

			if (typeof options === "string") {
				if (options.startsWith("{") && options.endsWith("}")) {
					try {
						options = parseJson(options);
					} catch (e) {
						throw new Error(`Cannot parse string options: ${e.message}`);
					}
				} else {
					options = querystring.parse(options, "&", "=", {
						maxKeys: 0
					});
				}
			}

			if (options === null || options === undefined) {
				options = {};
			}

			if (schema) {
				let name = "Loader";
				let baseDataPath = "options";
				let match;
				if (schema.title && (match = /^(.+) (.+)$/.exec(schema.title))) {
					[, name, baseDataPath] = match;
				}
				validate(schema, options, {
					name,
					baseDataPath
				});
			}

			return options;
		},
		emitWarning: warning => this.emitWarning(warning),
		emitError: error => this.emitError(error),
		getLogger: name => this.getLogger(name),
		resolve: (context, request, callback) => this.resolve(context, request, callback),
		getResolve: (options) => getResolve(options),
		emitFile: (name, content, sourceMap, assetInfo) => this.emitFile(name, content, sourceMap, assetInfo),
		addBuildDependency: dep => this.addBuildDependency(dep),
		mode: "production",
	};

	const result = await doRunLoaders({
		resource: this.resource,
		loaders,
		context: loaderContext,
		readResource: (file, cb) => file === this.resourcePath ? cb(null, md) : cb(new Error(`Path not supported by virtual file system: ${file}`)),
	});

	const split = this.resource.split(path.sep);
	const index = split[split.length - 1] === 'index.md' ? split.length - 3 : split.length - 2;
	//console.log(split, index)
	const slug = `${split[index].toLowerCase().replace(/[^a-z0-9]+/, '-')}/${split[index + 1].toLowerCase().replace(/[^a-z0-9]+/, '-').replace(/\.md$/, '')}`
	let text = result.result[0];
	if (!inputEsModule && outputEsModule) {
		text = text.replace(new RegExp(`module\.exports = ${defaultExportName};\n*$`, 'm'), `export default ${defaultExportName}\n`);
	}
	if (inputEsModule && !outputEsModule) {
		text = text.replace(new RegExp(`export default ${defaultExportName};\n*$`, 'm'), `module.exports = ${defaultExportName};\n`);
	}
	if (destructure !== false) {
		for (const [key, value] of Object.entries(json)) {
			text += writeExport(outputEsModule, key, JSON.stringify(value));
		}
	} else {
		text += writeExport(outputEsModule, typeof destructure === 'string' ? destructure : 'metadata', JSON.stringify(json));
	}
	text += writeExport(outputEsModule, 'slug', JSON.stringify(slug));
	for(const [key, value] of Object.entries(extras)) {
		if (value === 'detect-title-html') {
			text += writeImport(outputEsModule, `__PARSE_TITLE_HTML_${key}_`, 'json-tagged-file-loader/src/detectTitleHtml.cjs')
			text += writeExport(outputEsModule, key, `__PARSE_TITLE_HTML_${key}_(${defaultExportName}, ${JSON.stringify({ defaultValue: slug})})`);
		}
	}
	
	//console.log(text);
	return text;
}
