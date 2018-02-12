import test from 'ava'
const { expr } = require('./parser')
const { quote } = require('./quote')

test('quotes a number', (t) => {
    t.deepEqual(
        quote(expr('123')),
        expr(`[#Number 123]`)
    )
})

test('quotes a string', (t) => {
    t.deepEqual(
        quote(expr('"foo bar baz"')),
        expr(`[#String "foo bar baz"]`)
    )
})

test('quotes an ident', (t) => {
    t.deepEqual(
        quote(expr('foobar')),
        expr(`[#Ident #foobar]`)
    )
})

test('quotes a field access', (t) => {
    t.deepEqual(
        quote(expr('foo::bar')),
        expr(`[#FieldGet [#Ident #foo] #bar]`)
    )
})

test('quotes a record', (t) => {
    t.deepEqual(
        quote(expr(`[#foo 123 bar: #bar]`)),
        expr(`[#Record [
            [#String #foo]
            [#Number 123]
            bar: [#String #bar]
        ]]`)
    )
})

test('quotes a fn call', (t) => {
    t.deepEqual(
        quote(expr(`foo(bar 123 baz: #baz)`)),
        expr(`[#FnCall [#Ident #foo] [
            [#Ident #bar]
            [#Number 123]
            baz: [#String #baz]
        ]]`)
    )
})

test('quotes a fn def', (t) => {
    t.deepEqual(
        quote(expr(`(x foo: y){ [x y] }`)),
        expr(`[#FnExp
            [[#Ident #x] foo: [#Ident #y]]
            [[#Record [[#Ident #x] [#Ident #y]]]]
        ]`)
    )
})

test('quotes a record', (t) => {
    t.deepEqual(
        quote(expr(`@foo bar`)),
        expr(`[#Keyword [#Ident #foo] [#Ident #bar]]`)
    )
})

test('quotes a record assignment', (t) => {
    t.deepEqual(
        quote(expr(`@foo x := bar`)),
        expr(`[#Keyword [#Ident #foo] [#Ident #bar] binding: [#Ident #x]]`)
    )
})
