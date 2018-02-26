import { print } from './pretty-printer'
import { parse } from './parser'
import { pipe } from './util'

const p = pipe([parse, print])

it('prints primitives', () => {
    expect(p(`123`)).toEqual(`123`)
    expect(p(`"foo \\"bar\\" baz"`)).toEqual(`"foo \\"bar\\" baz"`)
    // TODO: preserve alternate formattings
    expect(p(`0x0F`)).toEqual(`15`)
    expect(p(`#foo`)).toEqual('"foo"')
})

it('prints records', () => {
    expect(p(`["foo" bar value: 123]`)).toEqual(`["foo" bar value: 123]`)
    expect(p(`[
        "foo"
        bar
        value: 123
    ]`)).toEqual(`["foo" bar value: 123]`)
})

it('prints function calls', () => {
    expect(p(`foo(bar baz value: 123)`)).toEqual(`foo(bar baz value: 123)`)
    expect(p(`bar.foo(baz value: 123)`)).toEqual(`bar.foo(baz value: 123)`)
})

it('hides parens in dot fn calls with no tail args', () => {
    expect(p(`bar.foo(1).baz()`)).toEqual(`bar.foo(1).baz`)
})

it('prints field access', () => {
    expect(p(`foo::bar::baz::1`)).toEqual(`foo::bar::baz::1`)
})

it('prints keywords', () => {
    expect(p(`@foo bar := baz(quux)`)).toEqual(`@foo bar := baz(quux)`)
})

it('prints function blocks with indentation', () => {
    expect(p(`(foo bar){ (baz){ @do foo() [foo bar baz] } }`)).toEqual(`
(foo bar){
    (baz){
        @do foo()
        [foo bar baz]
    }
}`.trim())
})

it('splits long records into multiple lines', () => {
    expect(p(`[foo.bar.baz.quux(123) "the quick brown fox jumps over the lazy dog" bar::0::1::2::3::4]`)).toEqual(`
[
    foo.bar.baz.quux(123)
    "the quick brown fox jumps over the lazy dog"
    bar::0::1::2::3::4
]
`.trim())
})

it('splits records into multiple lines if they contain other required linebreaks', () => {
    expect(p(`[foo (bar){ [bar] } baz::quux()]`)).toEqual(`
[
    foo
    (bar){
        [bar]
    }
    baz::quux()
]`.trim())
})
