import { tags } from './parser'
import { match } from './util'

const record = (args) =>
    tags.Record(args.map((arg) => tags.Arg(arg)))

const lit = (type) => ({ type })
const tagged = (token, ...body) =>
    record([tags.TaggedString(token.type)].concat(body))

// when quoting, do not quote arg tags
// [#Record [[#Arg [#Ident #foo]] [#NamedArg #bar [#Ident #bar]]]] =>
// [#Record [[#Ident #foo] bar: [#Ident #bar]]]
const quoteArgs = (args) =>
    tags.Record(args.map(({ type, key, value }) => key
        ? ({ type, key, value: quote(value) })
        : ({ type, value: quote(value) })
    ))

export const quote = match({
    DecNumber: (token) =>
        tagged(lit('Number'), tags.DecNumber(token.value)),
    HexNumber: (token) =>
        tagged(lit('Number'), tags.HexNumber(token.value)),
    TaggedString: (token) =>
        tagged(lit('String'), tags.TaggedString(token.value)),
    QuotedString: (token) =>
        tagged(lit('String'), tags.QuotedString(token.value)),
    Ident: (token) => tagged(token, tags.TaggedString(token.value)),
    FieldGet: (token) =>
        tagged(token, quote(token.target), tags.TaggedString(token.key)),
    Record: (token) => tagged(token, quoteArgs(token.args)),
    FnCall: (token) =>
        tagged(token, quote(token.callee), quoteArgs(token.args)),
    FnExp: (token) =>
        tagged(token, quoteArgs(token.params), record(token.body.map(quote))),
    KeywordStatement: (token) => tags.Record([
        tags.Arg(tags.TaggedString('Keyword')),
        tags.Arg(quote(token.keyword)),
        tags.Arg(quote(token.value)),
    ]),
    KeywordAssignment: (token) => tags.Record([
        tags.Arg(tags.TaggedString('Keyword')),
        tags.Arg(quote(token.keyword)),
        tags.Arg(quote(token.value)),
        tags.NamedArg('binding', quote(token.assignment)),
    ].filter((x) => x)),
}, (token) => {
    throw new Error(`not implemented: ${token.type} `)
})
