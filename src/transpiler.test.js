import { transpile } from './transpiler'

const run = (text) => eval(transpile(text))

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
        @let foo := 1
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
