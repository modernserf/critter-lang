import { expr, tags } from './parser'
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    Number: Num, String: Str, Ident,
} = tags

it('parses a number', () => {
    expect(expr('123'))
        .toEqual(Num(123))
    expect(expr('-123.45'))
        .toEqual(Num(-123.45))
    expect(expr('0xCAFEBABE'))
        .toEqual(Num(0xCAFEBABE))
})

it('parses a quoted string', () => {
    expect(expr('"foo bar baz"'))
        .toEqual(Str('foo bar baz'))
    expect(expr('"foo bar \\"quoted\\" baz"'))
        .toEqual(Str('foo bar "quoted" baz'))
})

it('parses a tagged string', () => {
    expect(expr('#foo'))
        .toEqual(Str('foo'))
})

it('parses an identifier', () => {
    expect(expr('foo'))
        .toEqual(Ident('foo'))
    expect(expr('++=>'))
        .toEqual(Ident('++=>'))

    expect(expr('foo bar'))
        .toEqual(null)
})

it('parses a record', () => {
    expect(expr('[]'))
        .toEqual(Record([]))

    expect(
        expr('[bar ["baz"] 123.45]')).toEqual(
        Record([
            Arg(Ident('bar')),
            Arg(Record([ Arg(Str('baz')) ])),
            Arg(Num(123.45)),
        ])
    )

    expect(
        expr('[bar "baz" quux: 123.45 snerf: snerf]')).toEqual(
        Record([
            Arg(Ident('bar')),
            Arg(Str('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
    )
})

it('parses field access', () => {
    expect(
        expr('foo::bar::baz::0')).toEqual(
        FieldGet(
            FieldGet(
                FieldGet(Ident('foo'), 'bar'),
                'baz'),
            0)
    )
})

it('parses field access on a record literal', () => {
    expect(
        expr('[#foo]::0')
    ).toEqual(
        FieldGet(
            Record([Arg(Str('foo'))]),
            0
        )
    )
})

it('parses a fn call', () => {
    expect(expr('foo()'))
        .toEqual(FnCall(Ident('foo'), []))

    expect(expr('foo(bar "baz" 123.45)'))
        .toEqual(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(Str('baz')),
            Arg(Num(123.45)),
        ])
        )

    expect(expr('foo(bar "baz" quux: 123.45 snerf: snerf)'))
        .toEqual(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(Str('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
        )
})

it('function call sequence', () => {
    expect(
        expr('foo()()')).toEqual(
        FnCall(
            FnCall(Ident('foo'), []),
            [])
    )
})

it('function definition, no args', () => {
    expect(
        expr(`{ x }`)).toEqual(
        FnExp([], [
            Ident('x'),
        ])
    )
})

it('function definition, with args', () => {
    expect(
        expr(`(x foo: y){ [x y] }`)).toEqual(
        FnExp([
            Arg(Ident('x')),
            NamedArg('foo', Ident('y')),
        ], [
            Record([
                Arg(Ident('x')),
                Arg(Ident('y')),
            ]),
        ])
    )
})

it('function definition, punned named arg', () => {
    expect(
        expr(`(x ::foo){ [x foo] }`)).toEqual(
        FnExp([
            Arg(Ident('x')),
            NamedArg('foo', Ident('foo')),
        ], [
            Record([
                Arg(Ident('x')),
                Arg(Ident('foo')),
            ]),
        ])
    )
})

it('parses an iife', () => {
    expect(
        expr(`(x){ x }(1)`)
    ).toEqual(
        FnCall(
            FnExp([Arg(Ident('x'))], [Ident('x')]),
            [Arg(Num(1))]
        )
    )
})

it('destructuring in function args')
// (x [y foo: z]){ bar(x y z) }

it('dot functions', () => {
    expect(expr(`foo.bar(baz).quux`))
        .toEqual(FnCall(Ident('quux'), [
            Arg(FnCall(Ident('bar'), [
                Arg(Ident('foo')),
                Arg(Ident('baz')),
            ])),
        ])
        )
})

it('keywords', () => {
    expect(expr('@foo bar(baz)'))
        .toEqual(Keyword(Ident('foo'), null,
            FnCall(Ident('bar'), [Arg(Ident('baz'))]))
        )
})

it('keyword assignment', () => {
    expect(
        expr('@foo(quux) x := bar(baz)')).toEqual(
        Keyword(
            FnCall(Ident('foo'), [Arg(Ident('quux'))]),
            Ident('x'),
            FnCall(Ident('bar'), [
                Arg(Ident('baz')),
            ]))
    )
})

it('precedence', () => {
    expect(
        expr('@foo::bar(baz).quux::snerf() x := xyzzy()')).toEqual(
        Keyword(
            FnCall(FieldGet(Ident('quux'), 'snerf'), [
                Arg(FnCall(FieldGet(Ident('foo'), 'bar'), [
                    Arg(Ident('baz')),
                ])),
            ]),
            Ident('x'),
            FnCall(Ident('xyzzy'), [])
        )
    )
})

it('parses deeply nested let bindings', () => {
    expect(
        expr(`(x){
            (f){
                f(x x)
            }((a b){ [a::foo b::bar] })
        }`)
    ).toEqual(
        FnExp([Arg(Ident('x'))], [
            FnCall(
                FnExp([Arg(Ident('f'))], [
                    FnCall(Ident('f'), [Arg(Ident('x')), Arg(Ident('x'))]),
                ]), [Arg(
                    FnExp([Arg(Ident('a')), Arg(Ident('b'))], [
                        Record([
                            Arg(FieldGet(Ident('a'), 'foo')),
                            Arg(FieldGet(Ident('b'), 'bar')),
                        ]),
                    ])
                )]),
        ])
    )
})
