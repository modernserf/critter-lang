import { types, checker } from './checker'
import { expr } from './parser'

const check = (str) => checker(expr(str))

it('typechecks literals', () => {
    check('123').then((val) =>
        expect(val).toEqual(types.Number()))
    check('#foo').then((val) =>
        expect(val).toEqual(types.String()))
    check('[#foo 123]').then((val) =>
        expect(val).toEqual(types.Record([
            types.Field(0, types.String()),
            types.Field(1, types.Number()),
        ])))
})

it('typechecks field access', () => {
    check('[#foo]::0').then((val) =>
        expect(val).toEqual(types.String()))
    check('[foo: 1 bar: "bar"]::foo').then((val) =>
        expect(val).toEqual(types.Number()))
    check('#foo::0').catch((err) =>
        expect(err).toEqual(['cannot_get_field_on', 'String']))
    check('[#foo]::1').catch((err) =>
        expect(err).toEqual(['missing_field', 1]))
})

it('fails unknown idents', () => {
    check('foo').catch((err) =>
        expect(err).toEqual(['unknown_ident', 'foo']))
})

it('typechecks fn definitions', () => {
    check('{ #foo }').then((val) =>
        expect(val).toEqual(types.Function([], types.String())))

    const res = check('(x){ x }').value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value)
        .toEqual(res.returns)
})

it('infers types from field access', () => {
    const res = check(`(x){ [x::foo x::bar] }`).value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value.type).toEqual('Product')
    expect(res.params[0].value.members[0].key).toEqual('foo')
    expect(res.params[0].value.members[1].key).toEqual('bar')
})

it('infers types from function calls', () => {
    const res = check(`(x){ (y){ [y::foo y::bar] }(x) }`).value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value.type).toEqual('Product')
    expect(res.params[0].value.members[0].key).toEqual('foo')
    expect(res.params[0].value.members[1].key).toEqual('bar')
    expect(res.returns.type).toEqual('Record')
    expect(res.returns.members.length).toEqual(2)
})

it('tracks functions as values', () => {
    const res = check(`(x){
        (f){
            f(x x)
        }((a b){ [a::foo b::bar] })
    }`).value
    expect(res.type).toEqual('Function')
    expect(res.params[0].value.type).toEqual('Product')
    expect(res.params[0].value.members[0].key).toEqual('foo')
    expect(res.params[0].value.members[1].key).toEqual('bar')
    expect(res.returns.type).toEqual('Record')
    expect(res.returns.members.length).toEqual(2)
})
