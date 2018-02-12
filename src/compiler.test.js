import test from 'ava'
const { tags } = require('./parser')
const { compile } = require('./compiler')
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    Number: Num, String: Str, Ident,
} = tags

test('number literals', (t) => {
    t.is(compile(Num(123)), '123')
    t.is(compile(Num(-0.2345)), '-0.2345')
})

test('string literals', (t) => {
    t.is(compile(Str('foo')), `"foo"`)
    t.is(
        compile(Str(`This "text" has escaped characters`)),
        `"This \\"text\\" has escaped characters"`)
})

test('identifier', (t) => {
    t.is(compile(Ident('foobar')), 'foobar')
    t.is(compile(Ident('++=>')), '_43_43_61_62')
    t.is(compile(Ident('_43')), '_95_52_51')
    t.is(compile(Ident('var')), '_var')
})

test('record', (t) => {
    const prog = Record([
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf')),
    ])

    t.is(compile(prog), [
        '{',
        '  0: bar,',
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        '}',
    ].join('\n'))
})

test('function call', (t) => {
    const prog = FnCall(Ident('foo'), [
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf')),
    ])

    t.is(compile(prog), [
        `foo({`,
        `  0: bar,`,
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        `})`,
    ].join('\n'))
})

test('function expression no args', (t) => {
    const prog = FnExp([], [
        Ident('x'),
    ])
    t.is(compile(prog), [
        `() => {`,
        `  return x;`,
        `}`,
    ].join('\n'))
})

test('function expression with args', (t) => {
    const prog = FnExp([
        Arg(Ident('x')),
    ], [
        FnCall(Ident('+'), [
            Arg(Ident('x')),
            Arg(Num(1)),
        ]),
    ])

    // TODO: how will shadowing work? are the scope rules close enough
    // that it will work "automatically"?
    t.is(compile(prog), [
        `({`,
        `  0: x`,
        `}) => {`,
        `  return _43({`,
        `    0: x,`,
        `    1: 1`,
        `  });`,
        `}`,
    ].join('\n'))
})

test('field access', (t) => {
    t.is(compile(FieldGet(Ident('foo'), 'bar')), [
        `CRITTER.getFields(foo, "bar")`,
    ].join('\n'))
})

test('bare keyword', (t) => {
    const prog = Keyword(Ident('foo'), null, Ident('bar'))
    t.throws(() => {
        compile(prog)
    })
})

test('single keyword', (t) => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
    ])

    t.is(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar, null);`,
        `}`,
    ].join('\n'))
})

test('sequence of keywords', (t) => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
        Keyword(Ident('baz'), null, Ident('quux')),
        Ident('snerf'),
    ])

    t.is(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar, null, () => {`,
        `    return CRITTER.keyword(baz, quux, null, () => {`,
        `      return snerf;`,
        `    });`,
        `  });`,
        `}`,
    ].join('\n'))
})

test('keyword assignments', (t) => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), Ident('x'), Ident('bar')),
        FnCall(Ident('inc'), [
            Arg(Ident('x')),
        ]),
    ])

    t.is(compile(prog), [
        `() => {`,
        `  return CRITTER.keyword(foo, bar, {`,
        `    0: "Ident",`,
        `    1: "x"`,
        `  }, x => {`,
        `    return inc({`,
        `      0: x`,
        `    });`,
        `  });`,
        `}`,
    ].join('\n'))
})
