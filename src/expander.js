import { id, match } from './util'
import { tags } from './parser'
import { quote } from './quote'

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
        tags.FnCall(expand(callee), checkDuplicateNamedArgs(args)),
    DotFnCall: ({ callee, headArg, tailArgs }) =>
        tags.FnCall(expand(callee), checkDuplicateNamedArgs([
            tags.Arg(headArg),
            ...tailArgs,
        ])),
    FnExp: ({ params, body }) => expandDestructuring(
        checkDuplicateNamedArgs(params),
        body),
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

// TODO: how can I prevent name collisions here?
// can I have unparseable but legal variable names?
const identNum = (i) => tags.Ident(`_${i}`)

const matchLiteral = (x, binding) => ({
    binding,
    conditions: [
        tags.Keyword(tags.Ident('try'), null,
            tags.FnCall(tags.Ident('=='), [
                tags.Arg(binding),
                tags.Arg(x),
            ])),
    ],
})

const destructure = match({
    Ident: (x) => ({ binding: x, conditions: [] }),
    Number: matchLiteral,
    String: matchLiteral,
    Record: ({ args }, binding) => ({
        binding,
        conditions: args.reduce((coll, arg, j) => {
            const childBinding = tags.FieldGet(binding, arg.key || j)
            if (arg.value.type === 'Ident') {
                coll.push(
                    tags.Keyword(
                        tags.Ident('let'),
                        arg.value,
                        childBinding,
                    )
                )
            } else {
                const child = destructure(arg.value, childBinding)
                coll.push(...child.conditions)
            }
            return coll
        }, []),
    }),
})

function expandDestructuring (params, body) {
    const bodyWithConditions = []
    const boundParams = []
    for (const [i, param] of params.entries()) {
        const { binding, conditions } = destructure(param.value, identNum(i))
        const nextParam = { ...param, value: binding }
        boundParams.push(nextParam)
        bodyWithConditions.push(...conditions)
    }
    bodyWithConditions.push(...body)

    return tags.FnExp(boundParams, [
        singleExpression(bodyWithConditions),
    ])
}

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
    const copy = body.slice(0)
    // TODO: don't append [#ok], pass `id` as value
    const init = (copy[copy.length - 1].type === 'Keyword')
        ? tags.Record([tags.Arg(tags.String('ok'))])
        : expand(copy.pop())

    return copy.reduceRight((after, bef) => bef.type === 'Keyword'
        ? expandKeyword(bef.keyword, bef.value, after, bef.assignment)
        : expandKeyword(tags.Ident('do'), bef, after),
    init)
}

function expandKeyword (kw, value, next, assignment) {
    return tags.FnCall(expand(kw), [
        tags.Arg(expand(value)),
        tags.Arg(expandDestructuring(
            (assignment ? [tags.Arg(assignment)] : []),
            [next])),
    ].concat(assignment ? [
        tags.NamedArg('assignment', quote(assignment)),
    ] : []))
}
