function decodeEntities(encodedString) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}

module.exports = function detectTitle(html, {
	defaultValue = null,
	limit = 1024,
}) {
	const match = html.substring(0, limit).match(/<h[1-6](?: [^=>]+(?:=[^=>]+))*?>(.*?)<\/h[1-6]>/m);
	if (!match) {
		return defaultValue;
	}
	return decodeEntities(match[1]);
}
