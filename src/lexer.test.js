import test from 'ava'
const { tokenize } = require('./lexer')

const tag = (type, value) => ({ type, value })

test('lexes simple values', (t) => {
    t.deepEqual(
        tokenize('-123.45'),
        [tag('DecNumber', '-123.45')]
    )
    t.deepEqual(
        tokenize('0xCAFEBABE'),
        [tag('HexNumber', '0xCAFEBABE')]
    )
    t.deepEqual(
        tokenize('"foo bar \\"quoted\\" baz"'),
        [tag('QuotedString', ['"', 'foo bar "quoted" baz', '"'])]
    )
    t.deepEqual(
        tokenize('#foo'),
        [tag('TaggedString', ['#', 'foo'])]
    )
})
