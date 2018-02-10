const test = require('tape')
const { expr } = require('./parser')
const { quote } = require('./quote')

test('quotes a number', (t) => {
    t.deepEquals(
        quote(expr('123')),
        expr(`[#Number 123]`)
    )
    t.end()
})

test('quotes a string', (t) => {
    t.deepEquals(
        quote(expr('"foo bar baz"')),
        expr(`[#String "foo bar baz"]`)
    )
    t.end()
})

test('quotes an ident', (t) => {
    t.deepEquals(
        quote(expr('foobar')),
        expr(`[#Ident #foobar]`)
    )
    t.end()
})

test('quotes a field access', (t) => {
    t.deepEquals(
        quote(expr('foo::bar')),
        expr(`[#FieldGet [#Ident #foo] #bar]`)
    )
    t.end()
})

test('quotes a record', (t) => {
    t.deepEquals(
        quote(expr(`[#foo 123 bar: #bar]`)),
        expr(`[#Record [
            [#String #foo]
            [#Number 123]
            bar: [#String #bar]
        ]]`)
    )
    t.end()
})

test('quotes a fn call', (t) => {
    t.deepEquals(
        quote(expr(`foo(bar 123 baz: #baz)`)),
        expr(`[#FnCall [#Ident #foo] [
            [#Ident #bar]
            [#Number 123]
            baz: [#String #baz]
        ]]`)
    )
    t.end()
})

test('quotes a fn def', (t) => {
    t.deepEquals(
        quote(expr(`(x foo: y){ [x y] }`)),
        // why does this take so long to parse?
        expr(`[#FnExp
            [[#Ident #x] foo: [#Ident #y]]
            [[#Record [[#Ident #x] [#Ident #y]]]]
        ]`)
    )
    t.end()
})

test('quotes a record', (t) => {
    t.deepEquals(
        quote(expr(`@foo bar`)),
        expr(`[#Keyword [#Ident #foo] [#Ident #bar]]`)
    )
    t.end()
})

test('quotes a record assignment', (t) => {
    t.deepEquals(
        quote(expr(`@foo x := bar`)),
        expr(`[#Keyword [#Ident #foo] [#Ident #bar] binding: #x]`)
    )
    t.end()
})
