import { id, match } from './util'
import { tags } from './parser'
import { quote } from './quote'

export const expand = match({
    Program: ({ body }) =>
        tags.Program(body.map(expandTopLevel)),
    HexNumber: id,
    DecNumber: id,
    QuotedString: id,
    TaggedString: id,
    Ident: id,
    FieldGet: ({ target, key }) =>
        tags.FieldGet(expand(target), key),
    Record: ({ args }) =>
        tags.Record(expandArgs(args)),
    FnCall: ({ callee, args }) =>
        tags.FnCall(expand(callee), expandArgs(args)),
    DotFnCall: ({ callee, headArg, tailArgs }) =>
        tags.FnCall(expand(callee), expandArgs([
            tags.Arg(headArg),
            ...tailArgs,
        ])),
    FnExp: ({ params, body }) => expandDestructuring(
        expandArgs(params),
        body),
    Arg: ({ value }) => tags.Arg(expand(value)),
    NamedArg: ({ key, value }) => tags.NamedArg(key, expand(value)),
    PunArg: ({ value }) => tags.NamedArg(value, tags.Ident(value)),

    Keyword: () => {
        throw new Error('Keyword must be expanded in context of body')
    },
}, ({ type }) => { throw new Error(`Unknown AST node ${type}`) })

const expandTopLevel = match({
    KeywordStatement: ({ keyword, value }) =>
        tags.KeywordStatement(expand(keyword), expand(value)),
    // TODO: destructuring?
    KeywordAssignment: ({ keyword, assignment, value }) =>
        tags.KeywordAssignment(
            expand(keyword), expand(assignment), expand(value)),
}, expand)

// TODO: how can I prevent name collisions here?
// can I have unparseable but legal variable names?
const identNum = (i) => tags.Ident(`_${i}`)

const matchLiteral = (x, binding) => ({
    binding,
    conditions: [
        tags.KeywordStatement(
            tags.Ident('try'),
            tags.FnCall(tags.Ident('=='), [
                tags.Arg(binding),
                tags.Arg(x),
            ])),
    ],
})

const destructure = match({
    Ident: (x) => ({ binding: x, conditions: [] }),
    HexNumber: matchLiteral,
    DecNumber: matchLiteral,
    QuotedString: matchLiteral,
    TaggedString: matchLiteral,
    Record: ({ args }, binding) => ({
        binding,
        conditions: args.reduce((coll, arg, j) => {
            const childBinding = tags.FieldGet(binding, arg.key || j)
            if (arg.value.type === 'Ident') {
                coll.push(
                    tags.KeywordAssignment(
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

function expandArgs (args) {
    const usedNames = {}
    const out = []
    for (const arg of args) {
        const expanded = expand(arg)
        if (usedNames[expanded.key]) {
            throw new Error(`Duplicate key: ${arg.key}`)
        }
        if (arg.key) { usedNames[arg.key] = true }
        out.push(expanded)
    }
    return out
}

function singleExpression (body) {
    const copy = body.slice(0)
    // TODO: don't append [#ok], pass `id` as value
    const init = (copy[copy.length - 1].keyword)
        ? tags.Record([tags.Arg(tags.TaggedString('ok'))])
        : expand(copy.pop())

    return copy.reduceRight((after, bef) => bef.keyword
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
