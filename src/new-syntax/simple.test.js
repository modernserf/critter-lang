import { tags as t, tokenize } from './simple'

const parse = (str) => tokenize(str).filter((x) => x.type !== 'Lit')[0]

it('parses terminals', () => {
    expect(parse('-123.45'))
        .toMatchObject(t.DecNum('-123.45'))
    expect(parse('0xCAFEBABE'))
        .toMatchObject(t.HexNum('0xCAFEBABE'))
    expect(parse('#quux'))
        .toMatchObject(t.TaggedStr('quux'))
    expect(parse(String.raw`"foo \"bar\" baz"`))
        .toMatchObject(t.QuotedStr('foo "bar" baz'))
})

it('parses records', () => {
    expect(parse('[]'))
        .toMatchObject(t.Record([]))
    expect(parse('[foo bar]'))
        .toMatchObject(t.Record([
            t.Arg(t.Ident('foo')),
            t.Arg(t.Ident('bar')),
        ]))
    expect(parse('[foo: bar]'))
        .toMatchObject(t.Record([
            t.NamedArg(t.Ident('foo'), t.Ident('bar')),
        ]))
    expect(parse('[foo bar :| rest]'))
        .toMatchObject(t.Record([
            t.Arg(t.Ident('foo')),
            t.Arg(t.Ident('bar')),
            t.RestArgs([
                t.Arg(t.Ident('rest')),
            ]),
        ]))
})

it('parses fn exprs', () => {
    expect(parse('{ foo }'))
        .toMatchObject(t.FnExp([], [t.Ident('foo')]))
    expect(parse('(foo: x){ x }'))
        .toMatchObject(t.FnExp([
            t.NamedArg(t.Ident('foo'), t.Ident('x')),
        ], [
            t.Ident('x'),
        ]))
})

it('parses field access', () => {
    expect(parse('foo::bar'))
        .toMatchObject(t.FieldGet(t.Ident('bar'), t.Ident('foo')))
    expect(parse('foo::bar::baz'))
        .toMatchObject(t.FieldGet(t.Ident('baz'),
            t.FieldGet(t.Ident('bar'), t.Ident('foo'))))
})

it('parses function calls', () => {
    expect(parse('foo(bar: baz)'))
        .toMatchObject(t.FnCall(
            [t.NamedArg(t.Ident('bar'), t.Ident('baz'))],
            t.Ident('foo'),
        ))
})

it('parses fields and fn calls l-to-r with the same precedence', () => {
    expect(parse('foo(x) ::bar::baz()'))
        .toMatchObject(t.FnCall(
            [],
            t.FieldGet(t.Ident('baz'),
                t.FieldGet(t.Ident('bar'),
                    t.FnCall([t.Arg(t.Ident('x'))],
                        t.Ident('foo'))))
        ))
})

it('parses dot fn calls', () => {
    expect(parse('foo.bar'))
        .toMatchObject(t.DotExpr(t.Ident('bar'), t.Ident('foo')))
    expect(parse('foo.bar(baz)'))
})

it('parses operator expressions', () => {
    expect(parse('foo + bar + baz'))
        .toMatchObject(t.OpExpr(
            t.Op('+'),
            t.OpExpr(t.Op('+'), t.Ident('baz'), t.Ident('bar')),
            t.Ident('foo')
        ))
})

it('parses keyword statements', () => {
    expect(parse('@foo bar := baz'))
        .toMatchObject(t.KwAssignment(
            t.Ident('foo'), t.Ident('bar'), t.Ident('baz')
        ))
})
