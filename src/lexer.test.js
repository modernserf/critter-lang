import { tokenize } from './lexer'

const tag = (type, value) => ({ type, value })

it('lexes simple values', () => {
    expect(tokenize('-123.45'))
        .toEqual([tag('DecNumber', '-123.45')])
    expect(tokenize('0xCAFEBABE'))
        .toEqual([tag('HexNumber', '0xCAFEBABE')])
    expect(tokenize('"foo bar \\"quoted\\" baz"'))
        .toEqual([tag('QuotedString', ['"', 'foo bar "quoted" baz', '"'])])
    expect(tokenize('#foo'))
        .toEqual([tag('TaggedString', ['#', 'foo'])])
})
