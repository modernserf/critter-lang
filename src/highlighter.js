var tokenizer = require('./tokenizer');

function span(type, value) {
    return `<span class="syntax-${type}">${value}</span>`
}

function getHighlightedHTML (text) {
    const parsed = tokenizer.parse(text);
    return parsed.map(([type, value, raw]) => {
        switch(type) {
        case 'newline':
            return '<br/>';
        case 'field_name':
        case 'string':
        case 'comment':
        case 'number':
        case 'hashtag':
        case 'keyword':
            return span(type, raw)
        case 'identifier':
            return span(type, value)
        default:
            return raw || value
        }
    }).join('');
}

function trimBlock(str) {
    const indent = str.length - str.trimLeft().length;
    if (indent === 0) { return str; }
    const lines = str.split('\n').map((line) => line.substr(indent - 1));
    return lines.join('\n').trim();
}

window.addEventListener('DOMContentLoaded', () => {
    const nodes = Array.from(document.querySelectorAll('[data-critter-lang]'))
    nodes.forEach((node) => {
        const html = getHighlightedHTML(trimBlock(node.textContent))
        node.innerHTML = html
    })
})
