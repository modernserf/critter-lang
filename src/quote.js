const { tags } = require('./parser')

const record = (args) => tags.Record(
    args.map((arg) => tags.Arg(arg))
)

const quoteArgs = (args) =>
    tags.Record(args.map(({ type, key, value }) => key
        ? ({ type, key, value: quote(value) })
        : ({ type, value: quote(value) })
    ))

function quote (token) {
    const tagName = tags.String(token.type)
    switch (token.type) {
    case 'Number':
        return record([tagName, tags.Number(token.value)])
    case 'String':
        return record([tagName, tags.String(token.value)])
    case 'Ident':
        return record([tagName, tags.String(token.value)])
    case 'FieldGet':
        return record([tagName, quote(token.target), tags.String(token.key)])
    case 'Record':
        return record([tagName, quoteArgs(token.args)])
    case 'FnCall':
        return record([tagName, quote(token.callee), quoteArgs(token.args)])
    case 'FnExp':
        return record([tagName, quoteArgs(token.params),
            record(token.body.map(quote))])
    case 'Keyword':
        return tags.Record([
            tags.Arg(tagName),
            tags.Arg(quote(token.keyword)),
            tags.Arg(quote(token.value)),
            token.assignment
                ? tags.NamedArg('binding', quote(token.assignment))
                : null,
        ].filter((x) => x))
    default:
        throw new Error(`not implemented: ${token.type} `)
    }
}

module.exports = { quote }
