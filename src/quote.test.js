import { expr } from './parser'
import { quote } from './quote'

it('quotes a number', () => {
    expect(quote(expr('123')))
        .toEqual(expr(`[#Number 123]`))
})

it('quotes a string', () => {
    expect(quote(expr('"foo bar baz"')))
        .toEqual(expr(`[#String "foo bar baz"]`))
})

it('quotes an ident', () => {
    expect(quote(expr('foobar')))
        .toEqual(expr(`[#Ident #foobar]`))
})

it('quotes a field access', () => {
    expect(quote(expr('foo::bar')))
        .toEqual(expr(`[#FieldGet [#Ident #foo] #bar]`))
})

it('quotes a record', () => {
    expect(quote(expr(`[#foo 123 bar: #bar]`)))
        .toEqual(expr(
            `[#Record [
                [#String #foo]
                [#Number 123]
                bar: [#String #bar]
            ]]`)
        )
})

it('quotes a fn call', () => {
    expect(quote(expr(`foo(bar 123 baz: #baz)`)))
        .toEqual(expr(
            `[#FnCall [#Ident #foo] [
                [#Ident #bar]
                [#Number 123]
                baz: [#String #baz]
            ]]`)
        )
})

it('quotes a fn def', () => {
    expect(quote(expr(`(x foo: y){ [x y] }`)))
        .toEqual(expr(
            `[#FnExp
                [[#Ident #x] foo: [#Ident #y]]
                [[#Record [[#Ident #x] [#Ident #y]]]]
            ]`)
        )
})

it('quotes a record', () => {
    expect(quote(expr(`@foo bar`)))
        .toEqual(expr(`[#Keyword [#Ident #foo] [#Ident #bar]]`))
})

it('quotes a record assignment', () => {
    expect(quote(expr(`@foo x := bar`)))
        .toEqual(expr(`[#Keyword [#Ident #foo] [#Ident #bar] binding: [#Ident #x]]`))
})
