import { types, checker } from './checker'
import { expr } from './parser'

const check = (str) => checker(expr(str))
const ok = (value) => ({ status: 'ok', value })
const err = (...errors) => ({ status: 'error', errors })

it('typechecks literals', () => {
    expect(check('123'))
        .toEqual(ok(types.Number()))
    expect(check('#foo'))
        .toEqual(ok(types.String()))
    expect(check('[#foo 123]'))
        .toEqual(ok(types.Record([
            types.Field(0, types.String()),
            types.Field(1, types.Number()),
        ])))
})

it('typechecks field access', () => {
    expect(check('[#foo]::0'))
        .toEqual(ok(types.String()))
    expect(check('[foo: 1 bar: "bar"]::foo'))
        .toEqual(ok(types.Number()))
    expect(check('#foo::0'))
        .toEqual(err('cannot_get_field_on', 'String'))
    expect(check('[#foo]::1'))
        .toEqual(err('missing_field', 1))
})

it('fails unknown idents', () => {
    expect(check('foo'))
        .toEqual(err('unknown_ident', 'foo'))
})

it('typechecks fn definitions', () => {
    expect(check('{ #foo }'))
        .toEqual(ok(types.Function([], types.String())))

    const res = check('(x){ x }').value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value)
        .toEqual(res.returns)
})

it('infers types from usage', () => {
    const res = check(`(x){ x::foo }`).value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value.type).toEqual('Product')
    expect(res.params[0].value.members[0].key).toEqual('foo')
})
// expect(check(`(x){ (y z){ [y::0 z::1] }(x x) }`))
//     .toEqual(ok(types.Function({
//         0: types.PartialRecord({
//             0: types.Var(),
//             1: types.Var(),
//         }),
//     }, types.Record({
//         0: types.Var(),
//         1: types.Var(),
//     }))))
// })
