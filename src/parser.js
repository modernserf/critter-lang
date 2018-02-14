import { tokenize } from './lexer'
import { tagConstructors, spread, flatten } from './util'
import * as P from './combinators'

const tagSeq = (tagger) => (init, args) =>
    args.reduce((acc, item) => tagger(acc, item), init)

// TODO: preserve whitespace, comments,
// original number/string format for pretty-printing?

export const tags = tagConstructors([
    ['Program', 'body'],
    ['Number', 'value'],
    ['String', 'value'],
    ['Ident', 'value'],
    ['FieldGet', 'target', 'key'],
    ['Record', 'args'],
    ['DotFnCall', 'callee', 'headArg', 'tailArgs'],
    ['FnCall', 'callee', 'args'],
    ['FnExp', 'params', 'body'],
    ['Arg', 'value'],
    ['NamedArg', 'key', 'value'],
    ['Keyword', 'keyword', 'assignment', 'value'],
])

const token = (type) => P.match((x) => x.type === type)

const number = P.alt(
    token('HexNumber'), token('DecNumber')
).map((x) => Number(x.value))

const string = P.alt(
    token('TaggedString'), token('QuotedString')
).map((x) => x.value[1])

const ident = token('Ident').map((x) => x.value)

const terminal = P.alt(
    number.map(tags.Number),
    string.map(tags.String),
    ident.map(tags.Ident)
)

const space = P.alt(token('Whitespace'), token('Comment'))

const _ = P.all(space)
const __ = P.plus(space)
const doublePad = (p) => P.wrapped(P.sepBy(p, __), _)

const namedArg = P.lazy(() =>
    P.seq(ident, token('Colon'), _, expression)
        .map(([key, _, __, value]) => tags.NamedArg(key, value))
)
const indexArg = P.lazy(() => expression.map(tags.Arg))
const arg = P.alt(namedArg, indexArg)

const record = P.wrapped(doublePad(arg), token('LBrk'), token('RBrk'))
    .map(tags.Record)

const field = P.seq(
    _, token('FieldOp'), P.alt(number, ident)
).map((x) => x[2])

const fieldGet = P.seq(
    P.alt(record, terminal), P.plus(field)
).map(spread(tagSeq(tags.FieldGet)))

// TODO: destructuring
const binding = P.alt(
    ident.map(tags.Ident)
)

const namedBindArg = P.seq(ident, token('Colon'), _, binding)
    .map(([key, _, __, value]) => tags.NamedArg(key, value))

const punArg = P.seq(token('FieldOp'), ident)
    .map(([_, key]) => tags.NamedArg(key, tags.Ident(key)))

const indexBindArg = binding.map(tags.Arg)
const bindArg = P.alt(namedBindArg, punArg, indexBindArg)

const fnParams = P.wrapped(
    doublePad(bindArg),
    token('LParen'),
    token('RParen')
)

const fnBody = P.lazy(() =>
    P.wrapped(body, token('LCurly'), token('RCurly')))

const fnExp = P.alt(
    P.seq(fnParams, fnBody).map(spread(tags.FnExp)),
    fnBody.map((body) => tags.FnExp([], body))
)

const fnArgs = P.wrapped(
    doublePad(arg),
    token('LParen'),
    token('RParen'))

const fnCall = P.seq(
    P.alt(fnExp, fieldGet, record, terminal),
    P.plus(fnArgs)
).map(spread(tagSeq(tags.FnCall)))

const dotArgs = P.seq(
    token('Dot'),
    P.alt(fieldGet, record, terminal),
    P.maybe(fnArgs).map(flatten),
)

const dotFnCall = P.seq(
    P.alt(fnCall, fieldGet, record, terminal),
    P.plus(dotArgs)
).map(([firstArg, seq]) => seq.reduce(
    (acc, [_, ident, restArgs]) =>
        tags.DotFnCall(ident, acc, restArgs),
    firstArg
))

const keywordStatement = P.lazy(() => P.seq(
    P.wrapped(expression, token('At'), __),
    expression
).map(([keyword, value]) => tags.Keyword(keyword, null, value)))

const keywordBinding = P.lazy(() => P.seq(
    P.wrapped(expression, token('At'), __),
    binding,
    P.wrapped(token('Assignment'), __),
    expression,
).map(([kw, bind, _, value]) => tags.Keyword(kw, bind, value)))

const keyword = P.alt(keywordBinding, keywordStatement)

const expression = P.alt(
    keyword,
    dotFnCall,
    fnCall,
    fnExp,
    fieldGet,
    record,
    terminal,
)

const body = doublePad(expression)

const program = body.map(tags.Program)

export const expr = (str) => expression.parseAll(tokenize(str))
export const parse = (str) => program.parseAll(tokenize(str))
