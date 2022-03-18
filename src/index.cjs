// This file is currently necessary because webpack needs the loader to be a CommonJS module.
// Its only purpose is to serve as a "trampolin" for the actual loader module.
"use strict";

const loaderImport = import("./loader.js");
const schema = require("./options.json");

async function trampolin(...args) {
	this.getOptions(schema);

	const { default: entryPoint } = await loaderImport;

	return entryPoint.call(this, ...args);
}

module.exports = trampolin;
