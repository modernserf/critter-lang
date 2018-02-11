const { tags } = require('./parser')
const { match } = require('./util')

const record = (args) =>
    tags.Record(args.map((arg) => tags.Arg(arg)))

const tagged = (token, ...body) =>
    record([tags.String(token.type)].concat(body))

// when quoting, do not quote arg tags
// [#Record [[#Arg [#Ident #foo]] [#NamedArg #bar [#Ident #bar]]]] =>
// [#Record [[#Ident #foo] bar: [#Ident #bar]]]
const quoteArgs = (args) =>
    tags.Record(args.map(({ type, key, value }) => key
        ? ({ type, key, value: quote(value) })
        : ({ type, value: quote(value) })
    ))

const quote = match({
    Number: (token) => tagged(token, tags.Number(token.value)),
    String: (token) => tagged(token, tags.String(token.value)),
    Ident: (token) => tagged(token, tags.String(token.value)),
    FieldGet: (token) =>
        tagged(token, quote(token.target), tags.String(token.key)),
    Record: (token) => tagged(token, quoteArgs(token.args)),
    FnCall: (token) =>
        tagged(token, quote(token.callee), quoteArgs(token.args)),
    FnExp: (token) =>
        tagged(token, quoteArgs(token.params), record(token.body.map(quote))),
    Keyword: (token) => tags.Record([
        tags.Arg(tags.String(token.type)),
        tags.Arg(quote(token.keyword)),
        tags.Arg(quote(token.value)),
        token.assignment
            ? tags.NamedArg('binding', quote(token.assignment))
            : null,
    ].filter((x) => x)),
}, (token) => {
    throw new Error(`not implemented: ${token.type} `)
})

module.exports = { quote }
