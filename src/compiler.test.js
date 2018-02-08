const test = require('tape')
const { compile } = require('./compiler')

test('number literals', (t) => {
    t.equals(compile(['Number', 123]), '123')
    t.equals(compile(['Number', -0.2345]), '-0.2345')

    t.end()
})

test('string literals', (t) => {
    t.equals(compile(['String', 'foo']), `'foo'`)
    t.equals(
        compile(['String', `This "text" has escaped characters`]),
        `'This "text" has escaped characters'`)

    t.end()
})

test('identifier', (t) => {
    t.equals(compile(['Ident', 'foobar']), 'foobar')
    t.equals(compile(['Ident', '++=>']), '_43_43_61_62')
    t.equals(compile(['Ident', '_43']), '_95_52_51')

    // TODO: replace reserved words

    t.end()
})

test('record', (t) => {
    const prog = ['Record', [
        ['Arg', ['Ident', 'bar']],
        ['Arg', ['String', 'baz']],
        ['NamedArg', 'quux', ['Number', 123.45]],
        ['NamedArg', 'snerf', ['Ident', 'snerf']]
    ]]

    t.equals(compile(prog), [
        '{',
        '    0: bar,',
        `    1: 'baz',`,
        `    'quux': 123.45,`,
        `    'snerf': snerf`,
        '}'
    ].join('\n'))
    t.end()
})

test('function call', (t) => {
    const prog = ['FnCall', ['Ident', 'foo'], [
        ['Arg', ['Ident', 'bar']],
        ['Arg', ['String', 'baz']],
        ['NamedArg', 'quux', ['Number', 123.45]],
        ['NamedArg', 'snerf', ['Ident', 'snerf']]
    ]]

    t.equals(compile(prog), [
        `foo({`,
        `    0: bar,`,
        `    1: 'baz',`,
        `    'quux': 123.45,`,
        `    'snerf': snerf`,
        `})`
    ].join('\n'))

    t.end()
})

test('function expression no args', (t) => {
    const prog = ['FnExp', [], [
        ['Ident', 'x']
    ]]
    t.equals(compile(prog), [
        `function () {`,
        `    return x;`,
        `}`
    ].join('\n'))
    t.end()
})

test('function expression with args', (t) => {
    const prog = ['FnExp', [
        ['Arg', ['Ident', 'x']]
    ], [
        ['FnCall', ['Ident', '+'], [
            ['Arg', ['Ident', 'x']],
            ['Arg', ['Number', 1]]
        ]]
    ]]

    // TODO: should this compile to `function (args) { ...args.x ... }` ?
    // TODO: how will shadowing work? are the scope rules close enough
    // that it will work "automatically"?
    t.equals(compile(prog), [
        `function ({ 0: x }) {`,
        `    return _43({`,
        `        0: x,`,
        `        1: 1`,
        `    });`,
        `}`
    ].join('\n'))
    t.end()
})

test('field access', (t) => {
    const prog = ['FieldGet', ['Ident', 'foo'], ['bar', 'baz', 0]]
    t.equals(compile(prog), [
        `CRITTER.getFields(foo, [`,
        `    'bar',`,
        `    'baz',`,
        `    0`,
        `])`
    ].join('\n'))
    t.end()
})

test('bare keyword', (t) => {
    const prog = ['Keyword', null, 'foo', ['Ident', 'bar']]
    t.throws(() => {
        compile(prog)
    })
    t.end()
})

test('single keyword', (t) => {
    const prog = ['FnExp', [], [
        ['Keyword', 'foo', null, ['Ident', 'bar']]
    ]]

    t.equals(compile(prog), [
        `function () {`,
        `    return CRITTER.keyword(foo, bar);`,
        `}`
    ].join('\n'))
    t.end()
})

test('sequence of keywords', (t) => {
    const prog = ['FnExp', [], [
        ['Keyword', 'foo', null, ['Ident', 'bar']],
        ['Keyword', 'baz', null, ['Ident', 'quux']],
        ['Ident', 'snerf']
    ]]

    t.equals(compile(prog), [
        `function () {`,
        `    return CRITTER.keyword(foo, bar, function () {`,
        `        return CRITTER.keyword(baz, quux, function () {`,
        `            return snerf;`,
        `        });`,
        `    });`,
        `}`
    ].join('\n'))
    t.end()
})

test('keyword assignments', (t) => {
    const prog = ['FnExp', [], [
        ['Keyword', 'foo', 'x', ['Ident', 'bar']],
        ['FnCall', ['Ident', 'inc'], [
            ['Arg', ['Ident', 'x']]
        ]]
    ]]

    t.equals(compile(prog), [
        `function () {`,
        `    return CRITTER.keyword(foo, bar, function (x) {`,
        `        return inc({ 0: x });`,
        `    });`,
        `}`
    ].join('\n'))
    t.end()
})

/* block with continuations
; critter
(){
    @def x := 1
    @def y := foo(2)
    x .+ y
}

// AST
['FnExp', [], [
    ['KeywordAssign', 'def', 'x', ['Number', 1]],
    ['KeywordAssign', 'def', 'y',
        ['FnCall', ['Ident', 'foo'], [['Arg', ['Number', 2] ]]]],
    ['FnCall', ['Ident', '+'], [
        ['Arg', ['Ident', 'x']],
        ['Arg', ['Ident', 'y']],
    ]]
]]

// JavaScript

function () {
    return CRITTER.continue(def, 1, (x) =>
        CRITTER.continue(def, foo(2), (y) =>
            _43(x, y)
        ),
    )
}
*/
