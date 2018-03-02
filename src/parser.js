import { tokenize } from './lexer'
import { tagConstructors, spread } from './util'
import * as P from './combinators'

const tagSeq = (tagger) => (init, args) =>
    args.reduce((acc, item) => tagger(acc, item), init)

// TODO: propagate indexes for pretty-printing

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
).map((x) => x.value)

const string = P.alt(
    token('TaggedString'), token('QuotedString')
).map((x) => x.value)

const ident = token('Ident')

const terminal = P.alt(
    number.map(tags.Number),
    string.map(tags.String),
    ident
)

const space = P.alt(token('Whitespace'), token('Comment'))

const _ = P.all(space)
const __ = P.plus(space)
const doublePad = (p) => P.wrapped(P.sepBy(p, __), _)

const createArgsFor = (expr) => {
    const namedArg = P.seq(ident, token('Colon'), _, expr)
        .map(([i, _, __, value]) => tags.NamedArg(i.value, value))
    const indexArg = expr.map(tags.Arg)
    return P.alt(namedArg, indexArg)
}
const arg = P.lazy(() => createArgsFor(expression))

const record = P.wrapped(doublePad(arg), token('LBrk'), token('RBrk'))
    .map(tags.Record)

const field = P.seq(
    _, token('FieldOp'), P.alt(number, ident.map((x) => x.value))
).map((x) => x[2])

const fieldGet = P.seq(
    P.alt(record, terminal), P.plus(field)
).map(spread(tagSeq(tags.FieldGet)))

// binding (includes destructuring)
// pattern-match on identifiers, primitives,
// and records composed of bindings
// includes punning of `[foo: foo]` as `[::foo]`
// TODO: expand "punning" in expander, not here
const _bindArg = P.lazy(() => createArgsFor(binding))
const punArg = P.seq(token('FieldOp'), ident.map((x) => x.value))
    .map(([_, key]) => tags.NamedArg(key, tags.Ident(key)))
const bindArg = P.alt(_bindArg, punArg)

const bindRecord = P.wrapped(doublePad(bindArg), token('LBrk'), token('RBrk'))

const binding = P.alt(
    bindRecord.map(tags.Record),
    number.map(tags.Number),
    string.map(tags.String),
    ident
)

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
    _,
    token('Dot'),
    P.alt(fieldGet, record, terminal),
    P.all(fnArgs)
).map(([_, __, callee, [call, ...restCalls]]) =>
    [callee, call || [], restCalls])

const dotFnCall = P.seq(
    P.alt(fnCall, fieldGet, record, terminal),
    P.plus(dotArgs)
).map(([firstArg, seq]) => seq.reduce(
    (acc, [callee, call, restCalls]) =>
        tagSeq(tags.FnCall)(
            tags.DotFnCall(callee, acc, call),
            restCalls
        ),
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
