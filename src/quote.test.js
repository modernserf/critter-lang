import { expr } from './parser'
import { quote } from './quote'

it('quotes a number', () => {
    expect(quote(expr('123')))
        .toMatchParseResult(expr(`[#Number 123]`))
    expect(quote(expr('0x0F')))
        .toMatchParseResult(expr(`[#Number 0x0F]`))
})

it('quotes a string', () => {
    expect(quote(expr('"foo bar baz"')))
        .toMatchParseResult(expr(`[#String "foo bar baz"]`))
})

it('quotes an ident', () => {
    expect(quote(expr('foobar')))
        .toMatchParseResult(expr(`[#Ident #foobar]`))
})

it('quotes a field access', () => {
    expect(quote(expr('foo::bar')))
        .toMatchParseResult(expr(`[#FieldGet [#Ident #foo] #bar]`))
})

it('quotes a record', () => {
    expect(quote(expr(`[#foo 123 bar: #bar]`)))
        .toMatchParseResult(expr(
            `[#Record [
                [#String #foo]
                [#Number 123]
                bar: [#String #bar]
            ]]`)
        )
})

it('quotes a fn call', () => {
    expect(quote(expr(`foo(bar 123 baz: #baz)`)))
        .toMatchParseResult(expr(
            `[#FnCall [#Ident #foo] [
                [#Ident #bar]
                [#Number 123]
                baz: [#String #baz]
            ]]`)
        )
})

it('quotes a fn def', () => {
    expect(quote(expr(`(x foo: y){ [x y] }`)))
        .toMatchParseResult(expr(
            `[#FnExp
                [[#Ident #x] foo: [#Ident #y]]
                [[#Record [[#Ident #x] [#Ident #y]]]]
            ]`)
        )
})

it('quotes a record', () => {
    expect(quote(expr(`@foo bar`)))
        .toMatchParseResult(expr(`[#Keyword [#Ident #foo] [#Ident #bar]]`))
})

it('quotes a record assignment', () => {
    expect(quote(expr(`@foo x := bar`)))
        .toMatchParseResult(expr(`[#Keyword [#Ident #foo] [#Ident #bar] binding: [#Ident #x]]`))
})
