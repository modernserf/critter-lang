import { expr, tags } from './parser'
const {
    FieldGet, Record, FnExp, FnCall, DotFnCall, Arg, NamedArg, Keyword,
    DecNumber: Num, HexNumber, QuotedString, TaggedString: Str, Ident,
} = tags

it('parses a number', () => {
    expect(expr('123'))
        .toMatchObject(Num(123))
    expect(expr('-123.45'))
        .toMatchObject(Num(-123.45))
    expect(expr('0xCAFEBABE'))
        .toMatchObject(HexNumber(0xCAFEBABE))
})

it('parses a quoted string', () => {
    expect(expr('"foo bar baz"'))
        .toMatchObject(QuotedString('foo bar baz'))
    expect(expr('"foo bar \\"quoted\\" baz"'))
        .toMatchObject(QuotedString('foo bar "quoted" baz'))
})

it('parses a tagged string', () => {
    expect(expr('#foo'))
        .toMatchObject(Str('foo'))
})

it('parses an identifier', () => {
    expect(expr('foo'))
        .toMatchObject(Ident('foo'))
    expect(expr('++=>'))
        .toMatchObject(Ident('++=>'))
})

it('parses a record', () => {
    expect(expr('[]'))
        .toMatchObject(Record([]))

    expect(
        expr('[bar ["baz"] 123.45]')).toMatchObject(
        Record([
            Arg(Ident('bar')),
            Arg(Record([ Arg(QuotedString('baz')) ])),
            Arg(Num(123.45)),
        ])
    )

    expect(
        expr('[bar "baz" quux: 123.45 snerf: snerf]')).toMatchObject(
        Record([
            Arg(Ident('bar')),
            Arg(QuotedString('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
    )
})

it('parses field access', () => {
    expect(
        expr('foo::bar::baz::0')).toMatchObject(
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
    ).toMatchObject(
        FieldGet(
            Record([Arg(Str('foo'))]),
            0
        )
    )
})

it('parses a fn call', () => {
    expect(expr('foo()'))
        .toMatchObject(FnCall(Ident('foo'), []))

    expect(expr('foo(bar "baz" 123.45)'))
        .toMatchObject(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(QuotedString('baz')),
            Arg(Num(123.45)),
        ])
        )

    expect(expr('foo(bar "baz" quux: 123.45 snerf: snerf)'))
        .toMatchObject(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(QuotedString('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
        )
})

it('function call sequence', () => {
    expect(
        expr('foo()()')).toMatchObject(
        FnCall(
            FnCall(Ident('foo'), []),
            [])
    )
})

it('function definition, no args', () => {
    expect(
        expr(`{ x }`)).toMatchObject(
        FnExp([], [
            Ident('x'),
        ])
    )
})

it('function definition, with args', () => {
    expect(
        expr(`(x foo: y){ [x y] }`)).toMatchObject(
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
        expr(`(x ::foo){ [x foo] }`)).toMatchObject(
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
    ).toMatchObject(
        FnCall(
            FnExp([Arg(Ident('x'))], [Ident('x')]),
            [Arg(Num(1))]
        )
    )
})

it('destructures function args', () => {
    // const args = (xs) => Object.entries(xs)
    //     .map(([k,v]) => typeof k === "number" ? Arg(v) : NamedArg(k, v))
    //
    expect(
        expr(`([foo bar]){ [bar foo] }`)
    ).toMatchObject(
        FnExp([Arg(Record([Arg(Ident('foo')), Arg(Ident('bar'))]))], [
            Record([Arg(Ident('bar')), Arg(Ident('foo'))]),
        ])
    )
})

it('dot functions', () => {
    expect(expr(`foo.bar(baz).quux`))
        .toMatchObject(DotFnCall(Ident('quux'),
            DotFnCall(Ident('bar'),
                Ident('foo'),
                [Arg(Ident('baz'))]),
            []
        ))
})

it('keywords', () => {
    expect(expr('@foo bar(baz)'))
        .toMatchObject(Keyword(Ident('foo'), null,
            FnCall(Ident('bar'), [Arg(Ident('baz'))]))
        )
})

it('keyword assignment', () => {
    expect(
        expr('@foo(quux) x := bar(baz)')).toMatchObject(
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
        expr('@foo::bar(baz).quux::snerf x := xyzzy()')).toMatchObject(
        Keyword(
            DotFnCall(FieldGet(Ident('quux'), 'snerf'),
                FnCall(FieldGet(Ident('foo'), 'bar'), [
                    Arg(Ident('baz')),
                ]),
                []),
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
    ).toMatchObject(
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

it('parses the flat-ok definition', () => {
    const dot = (callee, head, ...tail) => DotFnCall(callee, head, tail.map(Arg))
    const f = (callee, ...args) => FnCall(callee, args.map(Arg))

    expect(
        expr(`@let flat-ok := (m){
                m.get(0).cond((key){
                    ref-equal?(key #ok)
                        .or(ref-equal?(key #error))
                        .else({ ok(m) })
                } {
                    ok(m)
                })
            }`)
    ).toMatchObject(
        Keyword(Ident('let'), Ident('flat-ok'), FnExp([
            Arg(Ident('m')),
        ], [
            dot(
                Ident('cond'),
                dot(Ident('get'), Ident('m'), Num(0)),
                FnExp([Arg(Ident('key'))], [
                    dot(
                        Ident('else'),
                        dot(
                            Ident('or'),
                            f(Ident('ref-equal?'), Ident('key'), Str('ok')),
                            f(Ident('ref-equal?'), Ident('key'), Str('error'))
                        ),
                        FnExp([], [
                            f(Ident('ok'), Ident('m')),
                        ])
                    ),
                ]),
                FnExp([], [
                    f(Ident('ok'), Ident('m')),
                ])
            ),
        ]))
    )
})

it('parses chained calls on dots', () => {
    expect(expr(`foo(1).bar(2).baz(3)(4 5)`)).toBeTruthy()
})
