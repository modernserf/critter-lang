import { match } from './util'

const tab = `    `
const maxWidth = 80

const quote = (s) => `"${s.replace(/"/g, `\\"`)}"`

// TODO: more sophisticated splits
// needs to know about structure, the current indent level
// split between
// - dot fn calls
// - between args
// - field ::s

const indent = (text) => tab + text.replace(/\n/g, `\n${tab}`)

const needsSplit = (xs) => {
    let remaining = maxWidth
    for (const x of xs) {
        if (x.match(/\n/)) { return true }
        remaining -= x.length
        if (remaining <= 0) { return true }
    }
    return false
}

const printArgs = (args) => {
    const text = args.map(print)
    return needsSplit(text)
        ? `\n${text.map(indent).join('\n')}\n`
        : text.join(' ')
}

export const print = match({
    Program: ({ body }) => body.map(print).join('\n'),
    // TODO: preserve alternate formattings
    // e.g. hex numbers, tag strings
    Number: ({ value }) => value.toString(),
    String: ({ value }) => quote(value),
    Ident: ({ value }) => value,
    Record: ({ args }) => `[${printArgs(args)}]`,
    FnCall: ({ callee, args }) => `${print(callee)}(${printArgs(args)})`,
    FieldGet: ({ target, key }) => `${print(target)}::${key}`,
    FnExp: ({ params, body }) => [
        `(${printArgs(params)}){`,
        ...body.map((line) => indent(print(line))),
        `}`,
    ].join('\n'),
    NamedArg: ({ key, value }) => `${key}: ${print(value)}`,
    Arg: ({ value }) => print(value),
    Keyword: ({ keyword, assignment, value }) => assignment
        ? `@${print(keyword)} ${print(assignment)} := ${print(value)}`
        : `@${print(keyword)} ${print(value)}`,
    DotFnCall: ({ callee, headArg, tailArgs }) => tailArgs.length
        ? `${print(headArg)}.${print(callee)}(${printArgs(tailArgs)})`
        : `${print(headArg)}.${print(callee)}`,
}, (tag) => {
    throw new Error(`Unknown AST node ${tag.type}`)
})
