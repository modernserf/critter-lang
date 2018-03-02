import { tags } from './parser'
import { compile as c } from './compiler'
import { expand } from './expander'
import { pipe } from './util'
const {
    FieldGet, Record, FnExp, FnCall, Arg, NamedArg, Keyword,
    DecNumber: Num, String: Str, Ident,
} = tags

const compile = pipe([expand, c])

it('throws on unknown nodes', () => {
    expect(() => {
        compile({ type: 'Fart' })
    }).toThrow()
})

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

    expect(compile(prog)).toEqual(
        `({ 0: bar, 1: "baz", "quux": 123.45, "snerf": snerf })`
    )
})

it('compiles function calls', () => {
    const prog = FnCall(Ident('foo'), [
        Arg(Ident('bar')),
        Arg(Str('baz')),
        NamedArg('quux', Num(123.45)),
        NamedArg('snerf', Ident('snerf')),
    ])

    expect(compile(prog)).toEqual(
        `foo({ 0: bar, 1: "baz", "quux": 123.45, "snerf": snerf })`)
})

it('compiles function expression with no args', () => {
    const prog = FnExp([], [
        Ident('x'),
    ])
    expect(compile(prog)).toEqual(`() => x`)
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
    expect(compile(prog)).toEqual(
        `({ 0: x }) => _43({ 0: x, 1: 1 })`)
})

it('compiles field access', () => {
    expect(compile(FieldGet(Ident('foo'), 'bar')))
        .toEqual(`foo["bar"]`)
})

it('throws on bare keywords', () => {
    const prog = Keyword(Ident('foo'), null, Ident('bar'))
    expect(() => {
        compile(prog)
    }).toThrow()
})

it('compiles single keywords', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
    ])

    expect(compile(prog)).toEqual(
        `() => foo({ 0: bar, 1: () => ({ 0: "ok" }) })`)
})

it('compiles a sequence of keywords', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), null, Ident('bar')),
        Keyword(Ident('baz'), null, Ident('quux')),
        Ident('snerf'),
    ])

    expect(compile(prog)).toEqual(
        `() => foo({ 0: bar, 1: () => baz({ 0: quux, 1: () => snerf }) })`)
})

it('compiles keyword assignments', () => {
    const prog = FnExp([], [
        Keyword(Ident('foo'), Ident('x'), Ident('bar')),
        FnCall(Ident('inc'), [
            Arg(Ident('x')),
        ]),
    ])

    expect(compile(prog)).toEqual(
        `() => foo({ 0: bar, 1: ({ 0: x }) => inc({ 0: x }), "assignment": ({ 0: "Ident", 1: "x" }) })`)
})
