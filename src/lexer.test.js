const test = require('tape')
const { tokenize } = require('./lexer')

const tag = (type, value) => ({ type, value })

test('lexes simple values', (t) => {
    t.deepEquals(
        tokenize('-123.45'),
        [tag('DecNumber', '-123.45')]
    )
    t.deepEquals(
        tokenize('0xCAFEBABE'),
        [tag('HexNumber', '0xCAFEBABE')]
    )
    t.deepEquals(
        tokenize('"foo bar \\"quoted\\" baz"'),
        [tag('QuotedString', ['"', 'foo bar "quoted" baz', '"'])]
    )
    t.deepEquals(
        tokenize('#foo'),
        [tag('TaggedString', ['#', 'foo'])]
    )
    t.end()
})
