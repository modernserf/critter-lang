import { tokenize } from './lexer'
import { tagConstructors } from './util'
import {
    ok, error, matchOne, drop,
    seqs, alts, all, plus, maybe,
    parse as runParser, flatMapResult, lazy,
} from './goal'

export const tags = tagConstructors([
    ['Program', 'body'],

    // terminals
    ['DecNumber', 'value'],
    ['HexNumber', 'value'],
    ['QuotedString', 'value'],
    ['TaggedString', 'value'],
    ['Ident', 'value'],

    // space & non-semantic
    ['Whitespace', 'value'],
    ['Newline'],
    ['Comment', 'value'],

    ['Record', 'args'],
    ['Arg', 'value'],
    ['NamedArg', 'key', 'body'],

    ['FieldGet', 'value', 'field'],

    ['FnExp', 'params', 'body'],
    ['FnCall', 'callee', 'args'],
    ['DotFnCall', 'callee', 'headArg', 'tailArgs'],

    ['KeywordStatement', 'keyword', 'value'],
    ['KeywordAssignment', 'keyword', 'assignment', 'value'],

    // errors
    ['RecordWithMissingEnd', 'args'],
    ['FnCallWithMissingEnd', 'args'],
    ['GroupingWithMissingEnd', 'args'],
    ['FnExpWithMissingEnd', 'params', 'body'],
    ['FnHeadWithMissingEnd', 'params'],
    ['AmbiguousSequence', 'body'],
    ['UnmatchedRecordEnd'],
    ['UnmatchedParen'],
    ['UnmatchedCurly'],
])

// terminals: tokens used directly from lexer
const number = alts(token('HexNumber'), token('DecNumber'))
const string = alts(token('TaggedString'), token('QuotedString'))
const ident = token('Ident')

const terminal = alts(number, string, ident)

// space: tokens without semantic content
const space = alts(token('Newline'), token('Whitespace'), token('Comment'))
const _ = all(space)
const __ = plus(space)

const notLine = alts(token('Whitespace'), token('Comment'))
const line = all(seqs(all(notLine), token('Newline'), all(notLine)))

// unmatched delimeters
const unmatchedRecordEnd = flatMapResult(
    token('RBrk'), () => [tags.UnmatchedRecordEnd()])
const unmatchedParen = flatMapResult(
    token('RParen'), () => [tags.UnmatchedParen()])
const unmatchedCurly = flatMapResult(
    token('RCurly'), () => [tags.UnmatchedCurly()])

const recordExpression = lazy(() => alts(
    baseArgExpression,
    unmatchedParen,
    unmatchedCurly
))
const recordArgs = createArgsFor(recordExpression)

const record = flatMapResult(
    seqs(drop(token('LBrk')), _, recordArgs, _, drop(token('RBrk'))),
    (xs) => [tags.Record(xs)]
)
const recordWithMissingEnd = flatMapResult(
    seqs(drop(token('LBrk')), _, recordArgs),
    (xs) => [tags.RecordWithMissingEnd(xs)]
)

// field access
const nonOperatorExpression = alts(
    record,
    terminal,
)
const field = flatMapResult(
    seqs(_, drop(token('FieldOp')), nonOperatorExpression),
    (xs) => [xs]
)
const fields = flatMapResult(
    seqs(nonOperatorExpression, plus(field)),
    srcReduce(tags.FieldGet)
)

// function calls
const fnCallExpression = lazy(() => alts(
    baseArgExpression,
    unmatchedRecordEnd,
    unmatchedCurly
))
const fnCalleeExpression = alts(fields, record, terminal)
const fnArgs = createArgsFor(fnCallExpression)
const fn = flatMapResult(
    seqs(drop(token('LParen')), _, fnArgs, _, drop(token('RParen'))),
    (xs) => [xs]
)
const fnWithMissingEnd = flatMapResult(
    seqs(drop(token('LParen')), _, fnArgs),
    (xs) => [xs]
)
const fnCall = flatMapResult(
    seqs(fnCalleeExpression, plus(fn)),
    srcReduce((h, t) => tags.FnCall(h, t))
)
const fnCallWithMissingEnd = flatMapResult(
    seqs(
        fnCalleeExpression,
        flatMapResult(all(fn), (xs) => [xs]),
        fnWithMissingEnd
    ),
    ([h, success, failure]) =>
        tags.FnCallWithMissingEnd(
            success.reduce(tags.FnCall, h),
            failure
        ))

const fnBodyExpr = lazy(() => alts(
    bodyArgExpression,
    unmatchedRecordEnd,
    unmatchedParen
))
const ambiguousFnSequence = flatMapResult(
    seqs(fnBodyExpr, notLine, sepBy(fnBodyExpr, notLine)),
    (xs) => tags.AmbiguousSequence(xs)
)
const fnBody = sepBy(alts(ambiguousFnSequence, fnBodyExpr), line)
const wrappedFnBody = flatMapResult(
    seqs(drop(token('LCurly')), _, maybe(fnBody), _, drop(token('RCurly'))),
    (xs) => [xs]
)
const fnBodyMissingEnd = flatMapResult(
    seqs(drop(token('LCurly')), _, maybe(fnBody)),
    (xs) => [xs]
)

const fnExp = alts(
    flatMapResult(seqs(fn, wrappedFnBody), ([h, t]) => tags.FnExp(h, t)),
    flatMapResult(wrappedFnBody, ([body]) => tags.FnExp([], body))
)
const fnExpWithMissingEnd = alts(
    flatMapResult(seqs(fn, fnBodyMissingEnd),
        ([h, t]) => tags.FnExpWithMissingEnd(h, t)),
    flatMapResult(fnBodyMissingEnd,
        ([body]) => tags.FnExpWithMissingEnd([], body))
)
const fnHeadWithMissingEnd = flatMapResult(
    fnWithMissingEnd,
    ([xs]) => tags.FnHeadWithMissingEnd(xs)
)

const dotExpr = alts(
    fnCall,
    fnExp,
    fields,
    record,
    terminal
)
const dotCalleeExpr = alts(
    fields,
    record,
    terminal
)
const dotHead = flatMapResult(seqs(dotExpr, _), (xs) => [xs])
const dotBody = seqs(drop(token('Dot')), dotCalleeExpr, all(fn))
const dotFnCall = flatMapResult(
    seqs(dotHead, dotBody),
    ([head, callee, firstCall = [], ...calls]) =>
        calls.reduce(tags.FnCall, tags.DotFnCall(callee, head, firstCall))
)

const keywordExpression = alts(
    dotFnCall,
    fnCall,
    fnExp,
    fields,
    record,
    terminal
)
const keywordValueExpression = lazy(() => alts(
    baseArgExpression,
    unmatchedRecordEnd,
    unmatchedParen,
    unmatchedCurly,
))
const keyword = seqs(drop(token('At')), keywordExpression)
const keywordStatement = flatMapResult(
    seqs(keyword, __, keywordValueExpression),
    ([kw, ...statement]) => tags.KeywordStatement(kw, statement),
)
const keywordAssignment = flatMapResult(
    seqs(keyword,
        flatMapResult(
            seqs(__, keywordExpression, _, drop(token('Assignment'))),
            (xs) => [xs]
        ),
        __, keywordValueExpression
    ),
    ([kw, assignment, ...value]) =>
        tags.KeywordAssignment(kw, assignment, value)
)

// expression types valid for all arg/body positions
// (e.g. no unmatched delimeters)
const baseArgExpression = alts(
    dotFnCall,
    fnCallWithMissingEnd,
    fnCall,
    fnExp,
    fnExpWithMissingEnd,
    fnHeadWithMissingEnd,
    fields,
    record,
    recordWithMissingEnd,
    terminal,
)

// with line-delimeted keywords
const bodyArgExpression = alts(
    keywordAssignment,
    keywordStatement,
    baseArgExpression,
)

const expression = alts(
    bodyArgExpression,
    unmatchedRecordEnd,
    unmatchedParen,
    unmatchedCurly,
)
const programBody = maybe(sepBy(expression, line))
const program = flatMapResult(programBody, (xs) => tags.Program(xs))

// arguments for records & functions
// TODO: more work for checkArgs
// - verify that namedArg use idents for their contents
function createArgsFor (expr) {
    const namedArg = lazy(() => flatMapResult(
        seqs(expr, drop(token('Colon')), _, expr),
        ([key, ...rest]) => [tags.NamedArg(key, rest)]
    ))
    const indexArg = lazy(() =>
        flatMapResult(expr, ([x]) => [tags.Arg(x)]))

    const arg = alts(namedArg, indexArg)
    return maybe(sepBy(arg, __))
}

// match tokens
function token (type) {
    return matchOne((x) => x.type === type
        ? ok(x)
        : error(['no_match', type]))
}

function srcReduce (tagFn) {
    return (xs) => [xs.reduce(tagFn)]
}

function sepBy (expr, sep) {
    return seqs(expr, all(seqs(sep, expr)))
}

// parsing contexts: single expr, script, module
const contexts = {
    expression,
    program,
}

export const parse = (str, ctx) =>
    runParser(contexts[ctx], tokenize(str)).value[0]
