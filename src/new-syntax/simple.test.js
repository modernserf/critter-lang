import { tokenize } from './simple'

const t = new Proxy({}, {
    get: (_, type) => (...value) => ({ type, value }),
})

it('parses terminals', () => {
    expect(tokenize('-123.45'))
        .toEqual([t.DecNum('-123.45')])
    expect(tokenize('0xCAFEBABE'))
        .toEqual([t.HexNum('0xCAFEBABE')])
    expect(tokenize('#quux'))
        .toEqual([t.TaggedStr('quux')])
    expect(tokenize(String.raw`"foo \"bar\" baz"`))
        .toEqual([t.QuotedStr('foo "bar" baz')])
})

it('parses records', () => {
    expect(tokenize('[]'))
        .toEqual([t.Record()])
    expect(tokenize('[foo bar]'))
        .toEqual([t.Record(
            t.Arg(t.Ident('foo')),
            ' ',
            t.Arg(t.Ident('bar'))),
        ])
})
