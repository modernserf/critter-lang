const test = require('tape')
const { tags } = require('./parser')
const { compile } = require('./compiler')
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    Number: Num, String: Str, Ident
} = tags

test('number literals', (t) => {
    t.equals(compile(Num(123)), '123')
    t.equals(compile(Num(-0.2345)), '-0.2345')

    t.end()
})

test('string literals', (t) => {
    t.equals(compile(Str('foo')), `"foo"`)
    t.equals(
        compile(Str(`This "text" has escaped characters`)),
        `"This \\"text\\" has escaped characters"`)

    t.end()
})

test('identifier', (t) => {
    t.equals(compile(Ident('foobar')), 'foobar')
    t.equals(compile(Ident('++=>')), '_43_43_61_62')
    t.equals(compile(Ident('_43')), '_95_52_51')
    t.equals(compile(Ident('var')), '_var')

    t.end()
})

test('record', (t) => {
    const prog = Record([
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf'))
    ])

    t.equals(compile(prog), [
        '{',
        '  0: bar,',
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        '}'
    ].join('\n'))
    t.end()
})

test('function call', (t) => {
    const prog = FnCall(Ident('foo'), [
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf'))
    ])

    t.equals(compile(prog), [
        `foo({`,
        `  0: bar,`,
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        `})`
    ].join('\n'))

    t.end()
})

test('function expression no args', (t) => {
    const prog = FnExp([], [
        Ident('x')
    ])
    t.equals(compile(prog), [
        `() => {`,
        `  return x;`,
        `}`
    ].join('\n'))
    t.end()
})

test('function expression with args', (t) => {
    const prog = FnExp([
        Arg(Ident('x'))
    ], [
        FnCall(Ident('+'), [
            Arg(Ident('x')),
            Arg(Num(1))
        ])
    ])

    // TODO: how will shadowing work? are the scope rules close enough
    // that it will work "automatically"?
    t.equals(compile(prog), [
        `({`,
        `  0: x`,
        `}) => {`,
        `  return _43({`,
        `    0: x,`,
        `    1: 1`,
        `  });`,
        `}`
    ].join('\n'))
    t.end()
})

test('field access', (t) => {
    t.equals(compile(FieldGet(Ident('foo'), 'bar')), [
        `CRITTER.getFields(foo, "bar")`
    ].join('\n'))
    t.end()
})

test('bare keyword', (t) => {
    const prog = Keyword('foo', null, Ident('bar'))
    t.throws(() => {
        compile(prog)
    })
    t.end()
})

test('single keyword', (t) => {
    const prog = FnExp([], [
        Keyword('foo', null, Ident('bar'))
    ])

    t.equals(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar);`,
        `}`
    ].join('\n'))
    t.end()
})

test('sequence of keywords', (t) => {
    const prog = FnExp([], [
        Keyword('foo', null, Ident('bar')),
        Keyword('baz', null, Ident('quux')),
        Ident('snerf')
    ])

    t.equals(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar, () => {`,
        `    return CRITTER.keyword(baz, quux, () => {`,
        `      return snerf;`,
        `    });`,
        `  });`,
        `}`
    ].join('\n'))
    t.end()
})

test('keyword assignments', (t) => {
    const prog = FnExp([], [
        Keyword('foo', 'x', Ident('bar')),
        FnCall(Ident('inc'), [
            Arg(Ident('x'))
        ])
    ])

    t.equals(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar, x => {`,
        `    return inc({`,
        `      0: x`,
        `    });`,
        `  });`,
        `}`
    ].join('\n'))
    t.end()
})
