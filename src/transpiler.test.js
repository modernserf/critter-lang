import { transpile } from './transpiler'

const run = (text) => eval(transpile(text)) // eslint-disable-line no-eval

it('transpiles literals', () => {
    expect(run('123')).toEqual(123)
    expect(run('#foo')).toEqual('foo')
    expect(run(`[#foo bar: 123]`)).toEqual({0: 'foo', bar: 123})
})

it('calls functions', () => {
    expect(run('(x){ [x] }')({ 0: 'foo' })).toEqual(run('[#foo]'))
})

it('binds values', () => {
    expect(run(`
        @def foo := 1
        [foo]
    `)).toEqual(run(`[1]`))
})

it('accesses the JS runtime', () => {
    expect(run(`JS::null`)).toEqual(null)
    expect(run(`JS::Array([1 2 3])`)).toEqual([1, 2, 3])
    expect(run(`JS::===(#foo #foo)`)).toEqual(true)
})

it('throws errors', () => {
    expect(() => {
        run(`die("a custom message")`)
    }).toThrow(new Error('a custom message'))
})

it('has conditionals', () => {
    expect(run(`ok(3).cond((val){ val } { #error })`)).toEqual(3)
})

it('has "safe" field access', () => {
    expect(run(`[#foo #bar].get(0)`))
        .toEqual(run(`ok(#foo)`))
})

it('has the @try construct', () => {
    expect(run(`
        @def f := {
            @let x := #bar
            @try value := ok(#foo)
            x
        }
        f()
    `)).toEqual(run(`ok(#bar)`))

    expect(run(`
        @def f := {
            @let x := #bar
            @try value := error(#foo)
            x
        }
        f()
    `)).toEqual(run(`error(#foo)`))

    expect(run(`
        @def f := {
            @let x := #bar
            @try value := ok(#foo)
            error(value)
        }
        f()
    `)).toEqual(run(`error(#foo)`))
})

it('has fn interop', () => {
    const res = run(`JS::fn((x y){ [x y] })`)('foo', 'bar')
    expect(res).toEqual(run(`[#foo #bar]`))
})

it('has folds', () => {
    expect(run(`
        [1 2 3].fold((l r){ [head: r tail: l] } [])
    `)).toEqual(run(`[head: 3 tail: [head: 2 tail: [head: 1 tail: []]]]`))
})

it('has keys', () => {
    expect(run(`
        @def x := [#foo #bar baz: #baz]
        x.keys.chain((_ key){ x.get(key) } ok(#init))
    `)).toEqual(run(`ok(#baz)`))
})

it('has structural equality', () => {
    expect(run(`==(#foo #foo)`))
        .toEqual(run(`ok(#foo)`))
    expect(run(`==([#foo 1] [#foo 1])`))
        .toEqual(run(`ok([#foo 1])`))
    expect(run(`==([#foo [#bar [#baz 1]]] [#foo [#bar [#baz 1]]])`))
        .toEqual(run(`ok([#foo [#bar [#baz 1]]])`))
})

it('has pattern matching', () => {
    expect(run(`[#foo 3].match([
        ; doesn't match format
        ([#bar x]){ ok([x]) }
        ; fails in body
        ([#foo x]){ x.==(2).then({ ok([x x]) }) }
        ; succeeds
        ([#foo x]){ ok([x x x]) }
        ; should not occur
        { ok(#default-value) }
    ])`)).toEqual(run(`ok([3 3 3])`))
})
