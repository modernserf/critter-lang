import { id, match } from './util'
import { tags } from './parser'

export const expand = match({
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
        ? tags.Record([tags.Arg(tags.String('ok'))])
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
