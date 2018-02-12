import test from 'ava'
const { expr, tags } = require('./parser')
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    Number: Num, String: Str, Ident,
} = tags

test('parses a number', (t) => {
    t.deepEqual(
        expr('123'),
        Num(123)
    )
    t.deepEqual(
        expr('-123.45'),
        Num(-123.45)
    )
    t.deepEqual(
        expr('0xCAFEBABE'),
        Num(0xCAFEBABE)
    )
})

test('parses a quoted string', (t) => {
    t.deepEqual(
        expr('"foo bar baz"'),
        Str('foo bar baz')
    )
    t.deepEqual(
        expr('"foo bar \\"quoted\\" baz"'),
        Str('foo bar "quoted" baz')
    )
})

test('parses a tagged string', (t) => {
    t.deepEqual(
        expr('#foo'),
        Str('foo')
    )
})

test('parses an identifier', (t) => {
    t.deepEqual(
        expr('foo'),
        Ident('foo')
    )
    t.deepEqual(
        expr('++=>'),
        Ident('++=>')
    )

    t.is(expr('foo bar'), null)
})

test('parses a record', (t) => {
    t.deepEqual(
        expr('[]'),
        Record([])
    )

    t.deepEqual(
        expr('[bar ["baz"] 123.45]'),
        Record([
            Arg(Ident('bar')),
            Arg(Record([ Arg(Str('baz')) ])),
            Arg(Num(123.45)),
        ])
    )

    t.deepEqual(
        expr('[bar "baz" quux: 123.45 snerf: snerf]'),
        Record([
            Arg(Ident('bar')),
            Arg(Str('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
    )
})

test('field access', (t) => {
    t.deepEqual(
        expr('foo::bar::baz::0'),
        FieldGet(
            FieldGet(
                FieldGet(Ident('foo'), 'bar'),
                'baz'),
            0)
    )
})

test('parses a fn call', (t) => {
    t.deepEqual(
        expr('foo()'),
        FnCall(Ident('foo'), [])
    )

    t.deepEqual(
        expr('foo(bar "baz" 123.45)'),
        FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(Str('baz')),
            Arg(Num(123.45)),
        ])
    )

    t.deepEqual(
        expr('foo(bar "baz" quux: 123.45 snerf: snerf)'),
        FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Arg(Str('baz')),
            NamedArg('quux', Num(123.45)),
            NamedArg('snerf', Ident('snerf')),
        ])
    )
})

test('function call sequence', (t) => {
    t.deepEqual(
        expr('foo()()'),
        FnCall(
            FnCall(Ident('foo'), []),
            [])
    )
})

test('function definition, no args', (t) => {
    t.deepEqual(
        expr(`{ x }`),
        FnExp([], [
            Ident('x'),
        ])
    )
})

test('function definition, with args', (t) => {
    t.deepEqual(
        expr(`(x foo: y){ [x y] }`),
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

test('function definition, punned named arg', (t) => {
    t.deepEqual(
        expr(`(x ::foo){ [x foo] }`),
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

test.todo('destructuring in function args')
// (x [y foo: z]){ bar(x y z) }

test('dot functions', (t) => {
    t.deepEqual(
        expr(`foo.bar(baz).quux`),
        FnCall(Ident('quux'), [
            Arg(FnCall(Ident('bar'), [
                Arg(Ident('foo')),
                Arg(Ident('baz')),
            ])),
        ])
    )
})

test('keywords', (t) => {
    t.deepEqual(
        expr('@foo bar(baz)'),
        Keyword(Ident('foo'), null,
            FnCall(Ident('bar'), [Arg(Ident('baz'))]))
    )
})

test('keyword assignment', (t) => {
    t.deepEqual(
        expr('@foo(quux) x := bar(baz)'),
        Keyword(
            FnCall(Ident('foo'), [Arg(Ident('quux'))]),
            Ident('x'),
            FnCall(Ident('bar'), [
                Arg(Ident('baz')),
            ]))
    )
})

test('precedence', (t) => {
    t.deepEqual(
        expr('@foo::bar(baz).quux::snerf() x := xyzzy()'),
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
