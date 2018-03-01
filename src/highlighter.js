import { tokenize } from './lexer'
import { flatten } from './util'

const join = (s) => Array.isArray(s) ? flatten(s).join('') : s

const highlight = (text) =>
    tokenize(text).map(({ type, value }) =>
        `<span class="syntax-${type}">${join(value)}</span>`).join('')

function trimBlock (str) {
    const indent = str.length - str.trimLeft().length
    if (indent === 0) { return str }
    const lines = str.split('\n').map((line) => line.substr(indent - 1))
    return lines.join('\n').trim()
}

window.addEventListener('DOMContentLoaded', () => {
    const nodes = Array.from(document.querySelectorAll('code.language-critter'))
    nodes.forEach((node) => {
        const html = highlight(trimBlock(node.textContent))
        node.innerHTML = html
    })
})
