import { transpile } from './transpiler'

const run = (text) => eval(transpile(text))

it.skip('transpiles literals', () => {
    expect(run('123')).toEqual(123)
    expect(run('#foo')).toEqual('foo')
    expect(run(`[#foo bar: 123]`)).toEqual({0: 'foo', bar: 123})
})

it.skip('transpiles functions', () => {
    expect(run('(x){ [x] }')('foo')).toEqual({ 0: 'foo' })
})
