const test = require('tape')
const { expr } = require('./parser')

test('parses a number', (t) => {
    t.deepEquals(
        expr('123'),
        ['Number', 123]
    )
    t.deepEquals(
        expr('-123.45'),
        ['Number', -123.45]
    )
    t.deepEquals(
        expr('0xCAFEBABE'),
        ['Number', 0xCAFEBABE]
    )
    t.end()
})

test('parses a quoted string', (t) => {
    t.deepEquals(
        expr('"foo bar baz"'),
        ['String', 'foo bar baz']
    )
    t.deepEquals(
        expr('"foo bar \\"quoted\\" baz"'),
        ['String', 'foo bar "quoted" baz']
    )
    t.end()
})

test('parses a tagged string', (t) => {
    t.deepEquals(
        expr('#foo'),
        ['String', 'foo']
    )
    t.end()
})

test('parses an identifier', (t) => {
    t.deepEquals(
        expr('foo'),
        ['Ident', 'foo']
    )
    t.deepEquals(
        expr('++=>'),
        ['Ident', '++=>']
    )

    t.throws(() => {
        expr('foo bar')
    })

    t.end()
})

test('parses a fn call', (t) => {
    t.deepEquals(
        expr('foo()'),
        ['FnCall', ['Ident', 'foo'], []]
    )

    t.deepEquals(
        expr('foo(bar "baz" 123.45)'),
        ['FnCall', ['Ident', 'foo'], [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['Arg', ['Number', 123.45]]
        ]]
    )

    t.deepEquals(
        expr('foo(bar "baz" quux: 123.45 snerf: snerf)'),
        ['FnCall', ['Ident', 'foo'], [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['NamedArg', 'quux', ['Number', 123.45]],
            ['NamedArg', 'snerf', ['Ident', 'snerf']]
        ]]
    )
    t.end()
})

test('parses a record', (t) => {
    t.deepEquals(
        expr('[]'),
        ['Record', []]
    )

    t.deepEquals(
        expr('[bar ["baz"] 123.45]'),
        ['Record', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['Record', [
                ['Arg', ['String', 'baz']]
            ]]],
            ['Arg', ['Number', 123.45]]
        ]]
    )

    t.deepEquals(
        expr('[bar "baz" quux: 123.45 snerf: snerf]'),
        ['Record', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['NamedArg', 'quux', ['Number', 123.45]],
            ['NamedArg', 'snerf', ['Ident', 'snerf']]
        ]]
    )
    t.end()
})

test('field access', (t) => {
    t.deepEquals(
        expr('foo::bar::baz::0'),
        ['FieldGet',
            ['FieldGet',
                ['FieldGet', ['Ident', 'foo'], 'bar'],
                'baz'],
            0]
    )
    t.end()
})

test('function call sequence', (t) => {
    t.deepEquals(
        expr('foo()()'),
        ['FnCall',
            ['FnCall', ['Ident', 'foo'], []],
            []
        ]
    )
    t.end()
})

test('function definition, no args', (t) => {
    t.deepEquals(
        expr(`{ x }`),
        ['FnExp', [], [
            ['Ident', 'x']
        ]]
    )
    t.end()
})

test('function definition, with args', (t) => {
    t.deepEquals(
        expr(`(x foo: y){ [x y] }`),
        ['FnExp', [
            ['Arg', ['Ident', 'x']],
            ['NamedArg', 'foo', ['Ident', 'y']]
        ], [
            ['Record', [
                ['Arg', ['Ident', 'x']],
                ['Arg', ['Ident', 'y']]
            ]]
        ]]
    )
    t.end()
})

test.skip('destructuring in function args')
// (x [y foo: z]){ bar(x y z) }

test('dot functions', (t) => {
    t.deepEquals(
        expr(`foo.bar(baz).quux()`),
        ['FnCall', ['Ident', 'quux'], [
            ['Arg', ['FnCall', ['Ident', 'bar'], [
                ['Arg', ['Ident', 'foo']],
                ['Arg', ['Ident', 'baz']]
            ]]]
        ]]
    )
    t.end()
})

test('precedence', (t) => {
    t.deepEquals(
        expr('foo::bar(baz).quux::snerf()'),
        ['FnCall', ['FieldGet', ['Ident', 'quux'], 'snerf'], [
            ['Arg', ['FnCall', ['FieldGet', ['Ident', 'foo'], 'bar'], [
                ['Arg', ['Ident', 'baz']]
            ]]]
        ]]
    )
    t.end()
})

test('keywords', (t) => {
    t.deepEquals(
        expr('@foo bar(baz)'),
        ['Keyword', 'foo', null,
            ['FnCall', ['Ident', 'bar'], [['Arg', ['Ident', 'baz']]]] ]
    )
    t.end()
})
