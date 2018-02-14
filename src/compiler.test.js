import { tags } from './parser'
import { compile } from './compiler'
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    Number: Num, String: Str, Ident,
} = tags

it('compiles number literals', () => {
    expect(compile(Num(123)))
        .toEqual('123')
    expect(compile(Num(-0.2345)))
        .toEqual('-0.2345')
})

it('compiles string literals', () => {
    expect(compile(Str('foo')))
        .toEqual(`"foo"`)
    expect(compile(Str(`This "text" has escaped characters`)))
        .toEqual(`"This \\"text\\" has escaped characters"`)
})

it('compiles identifiers', () => {
    expect(compile(Ident('foobar')))
        .toEqual('foobar')
    expect(compile(Ident('++=>')))
        .toEqual('_43_43_61_62')
    expect(compile(Ident('_43')))
        .toEqual('_95_52_51')
    expect(compile(Ident('var')))
        .toEqual('_var')
})

it('compiles records', () => {
    const prog = Record([
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf')),
    ])

    expect(compile(prog)).toEqual([
        '{',
        '  0: bar,',
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        '}',
    ].join('\n'))
})

it('compiles function calls', () => {
    const prog = FnCall(Ident('foo'), [
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf')),
    ])

    expect(compile(prog)).toEqual([
        `foo({`,
        `  0: bar,`,
        `  1: "baz",`,
        `  "quux": 123.45,`,
        `  "snerf": snerf`,
        `})`,
    ].join('\n'))
})

it('compiles function expression with no args', () => {
    const prog = FnExp([], [
        Ident('x'),
    ])
    expect(compile(prog)).toEqual([
        `() => {`,
        `  return x;`,
        `}`,
    ].join('\n'))
})

it('compiles function expression with args', () => {
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
    expect(compile(prog)).toEqual([
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

it('compiles field access', () => {
    expect(compile(FieldGet(Ident('foo'), 'bar')))
        .toEqual(`foo["bar"]`)
})

it('compiles bare keywords', () => {
    const prog = Keyword(Ident('foo'), null, Ident('bar'))
    expect(() => {
        compile(prog)
    }).toThrow()
})

it('compiles single keywords', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
    ])

    expect(compile(prog)).toEqual([
        `() => {`,
        `  return CRITTER.keyword(foo, bar, null);`,
        `}`,
    ].join('\n'))
})

it('compiles a sequence of keywords', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
        Keyword(Ident('baz'), null, Ident('quux')),
        Ident('snerf'),
    ])

    expect(compile(prog)).toEqual([
        `() => {`,
        `  return CRITTER.keyword(foo, bar, null, () => {`,
        `    return CRITTER.keyword(baz, quux, null, () => {`,
        `      return snerf;`,
        `    });`,
        `  });`,
        `}`,
    ].join('\n'))
})

it('compiles keyword assignments', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), Ident('x'), Ident('bar')),
        FnCall(Ident('inc'), [
            Arg(Ident('x')),
        ]),
    ])

    expect(compile(prog)).toEqual([
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
