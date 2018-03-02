import { tokenize } from './lexer'

const tag = (type, value) => ({ type, value })

it('lexes simple values', () => {
    expect(tokenize('-123.45'))
        .toMatchObject([tag('DecNumber', -123.45)])
    expect(tokenize('0xCAFEBABE'))
        .toMatchObject([tag('HexNumber', 0xCAFEBABE)])
    expect(tokenize('"foo bar \\"quoted\\" baz"'))
        .toMatchObject([tag('QuotedString', 'foo bar "quoted" baz')])
    expect(tokenize('#foo'))
        .toMatchObject([tag('TaggedString', 'foo')])
    expect(tokenize('bar'))
        .toMatchObject([tag('Ident', 'bar')])
})

it('allows underscores in numbers', () => {
    expect(tokenize('1_000_000.00'))
        .toMatchObject([tag('DecNumber', 1000000)])
})
