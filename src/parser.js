import { tokenize } from './lexer'
import { tagConstructors, spread } from './util'
import * as P from './combinators'

const tagSeq = (tagger) => (init, args) =>
    args.reduce((acc, item) => tagger(acc, item), init)

// TODO: propagate indexes for pretty-printing

export const tags = tagConstructors([
    ['Program', 'body'],
    ['DecNumber', 'value'],
    ['HexNumber', 'value'],
    ['QuotedString', 'value'],
    ['TaggedString', 'value'],
    ['Ident', 'value'],
    ['FieldGet', 'target', 'key'],
    ['Record', 'args'],
    ['DotFnCall', 'callee', 'headArg', 'tailArgs'],
    ['FnCall', 'callee', 'args'],
    ['FnExp', 'params', 'body'],
    ['Arg', 'value'],
    ['NamedArg', 'key', 'value'],
    ['PunArg', 'value'],
    ['KeywordStatement', 'keyword', 'value'],
    ['KeywordAssignment', 'keyword', 'assignment', 'value'],
])

// match tokens
const token = (type) => P.match((x) => x.type === type)

// terminals: tokens used directly from lexer
const number = P.alt(token('HexNumber'), token('DecNumber'))
    .map((x) => ({ ...x, value: Number(x.value.replace(/_/g, '')) }))
const string = P.alt(token('TaggedString'), token('QuotedString'))
const ident = token('Ident')
const terminal = P.alt(number, string, ident)

// space: tokens without semantic content
const space = P.alt(token('Whitespace'), token('Comment'), token('Newline'))
const _ = P.all(space)
const __ = P.plus(space)

// utilities for building argument lists
const doublePad = (p) => P.wrapped(P.sepBy(p, __), _)
const punArg = P.seq(token('FieldOp'), ident)
    .map(([_, key]) => tags.PunArg(key.value))
const createArgsFor = (expr) => {
    const namedArg = P.seq(ident, token('Colon'), _, expr)
        .map(([i, _, __, value]) => tags.NamedArg(i.value, value))
    const indexArg = expr.map(tags.Arg)
    return doublePad(P.alt(namedArg, indexArg, punArg))
}
const args = P.lazy(() => createArgsFor(expression))

// records
const record = P.wrapped(args, token('LBrk'), token('RBrk')).map(tags.Record)

// field access
const field = P.seq(
    _, token('FieldOp'), P.alt(number, ident)
).map((x) => x[2].value)
const fieldGet = P.seq(
    P.alt(record, terminal), P.plus(field)
).map(spread(tagSeq(tags.FieldGet)))

// binding (includes destructuring)
// pattern-match on identifiers, primitives,
// and records composed of bindings
const bindArgs = P.lazy(() => createArgsFor(binding))
const bindRecord = P.wrapped(bindArgs, token('LBrk'), token('RBrk'))
const binding = P.alt(
    bindRecord.map(tags.Record),
    terminal,
)

// function definitions
const fnParams = P.wrapped(bindArgs, token('LParen'), token('RParen'))
const fnBody = P.lazy(() =>
    P.wrapped(body, token('LCurly'), token('RCurly')))
const fnExp = P.alt(
    P.seq(fnParams, fnBody).map(spread(tags.FnExp)),
    fnBody.map((body) => tags.FnExp([], body))
)

// function calls
const fnArgs = P.wrapped(args, token('LParen'), token('RParen'))
const fnCall = P.seq(
    P.alt(fnExp, fieldGet, record, terminal),
    P.plus(fnArgs)
).map(spread(tagSeq(tags.FnCall)))

// dot function calls
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

// keyword function calls
const kwHead = P.lazy(() => P.wrapped(expression, token('At'), __))
const keywordStatement = P.lazy(() => P.seq(
    kwHead,
    expression
).map(([keyword, value]) => tags.KeywordStatement(keyword, value)))
const keywordAssignment = P.lazy(() => P.seq(
    kwHead,
    binding,
    P.wrapped(token('Assignment'), __),
    expression,
).map(([kw, bind, _, value]) => tags.KeywordAssignment(kw, bind, value)))

// expressions
const expression = P.alt(
    keywordAssignment,
    keywordStatement,
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
