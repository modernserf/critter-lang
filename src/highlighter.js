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
        case 'atom':
        case 'comment':
        case 'number':
        case 'identifier':
            return span(type, raw || value)
        default:
            return raw || value
        }
    }).join('');
}

window.addEventListener('DOMContentLoaded', () => {
    const nodes = Array.from(document.querySelectorAll('[data-critter-lang]'))
    nodes.forEach((node) => {
        const html = getHighlightedHTML(node.textContent.trim())
        node.innerHTML = html
    })
})
