import { id, match } from './util'
import { tags, parse } from './parser'

const expand = match({
    Program: ({ body }) =>
        tags.Program([singleExpression(body)]),
    Number: id,
    String: id,
    Ident: id,
    FieldGet: ({ target, key }) =>
        tags.FieldGet(expand(target), key),
    Record: ({ args }) =>
        tags.Record(checkDuplicateNamedArgs(args)),
    FnCall: ({ callee, args }) =>
        tags.FnCall(callee, checkDuplicateNamedArgs(args)),
    FnExp: ({ params, body }) =>
        tags.FnExp(checkDuplicateNamedArgs(params), [singleExpression(body)]),
    Arg: () => {
        throw new Error('Arg must be expanded in context of args')
    },
    NamedArg: () => {
        throw new Error('NamedArg must be expanded in context of args')
    },
    Keyword: () => {
        throw new Error('Keyword must be expanded in context of body')
    },
}, ({ type }) => { throw new Error(`Unknown AST node ${type}`) })

function checkDuplicateNamedArgs (args) {
    const usedNames = {}
    const out = []
    for (const arg of args) {
        if (arg.key) {
            if (usedNames[arg.key]) {
                // ngl this is way more convenient than monadic error handling
                throw new Error(`Duplicate key: ${arg.key}`)
            }
            usedNames[arg.key] = true
        }
        out.push({ ...arg, value: expand(arg.value) })
    }
    return out
}

function singleExpression (body) {
    const rev = body.slice(0).reverse()
    const init = (rev[0].type === 'Keyword')
        ? tags.FnExp([], [])
        : expand(rev.shift())

    return rev.reduce((after, bef) => bef.type === 'Keyword'
        ? expandKeyword(bef.keyword, bef.value, after, bef.assignment)
        : expandKeyword(tags.Ident('do'), bef, after),
    init)
}

function expandKeyword (kw, value, next, assignment) {
    return tags.FnCall(expand(kw), [
        tags.Arg(expand(value)),
        tags.Arg(tags.FnExp(
            (assignment ? [tags.Arg(assignment)] : []),
            [next])),
    ])
}

it('is idempotent on simple values', () => {
    const x = parse('123')
    expect(expand(x)).toEqual(x)
    const y = parse('#foo')
    expect(expand(y)).toEqual(y)
    const z = parse('[foo: 1 bar: 2]::bar')
    expect(expand(z)).toEqual(z)
})

it('throws on duplicate fields', () => {
    expect(() => {
        expand(parse('[foo: 1 foo: 2]'))
    }).toThrow()
})

it('expands sequences into callbacks', () => {
    expect(
        expand(parse(`
            {
                @let x := 1
                @let y := 2
                side-effect(x y)
                z
            }
        `))
    ).toEqual(parse(`
        {
            let(1 (x){
                let(2 (y){
                    do(side-effect(x y) {
                        z
                    })
                })
            })
        }
    `))
})
