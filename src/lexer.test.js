const test = require('tape')
const { tokenize } = require('./lexer')

const types = (x) => x.type

test('lexes simple values', (t) => {
    t.deepEquals(
        tokenize('123').map(types),
        ['DecNumber']
    )
    t.deepEquals(
        tokenize('0xCAFEBABE').map(types),
        ['HexNumber']
    )
    t.deepEquals(
        tokenize('"foo bar \\"quoted\\" baz"').map(types),
        ['QuotedString']
    )
    t.deepEquals(
        tokenize('#foo').map(types),
        ['TaggedString']
    )
    t.end()
})
