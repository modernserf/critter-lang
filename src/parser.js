const { tokenize } = require('./lexer')
const {
    tagConstructors, token, seq, alt, map, done, lazy, many,
    maybeSepBy, wrapWith, spreadMaybe,
} = require('./util')

const tagSeq = (tagger) => (init, args) =>
    args.reduce((acc, item) => tagger(acc, item), init)
const spread = (f) => (xs) => f(...xs)

const tags = tagConstructors([
    ['Program', 'body'],
    ['Number', 'value'],
    ['String', 'value'],
    ['Ident', 'value'],
    ['FieldGet', 'target', 'key'],
    ['Record', 'args'],
    ['FnCall', 'callee', 'args'],
    ['FnExp', 'params', 'body'],
    ['Arg', 'value'],
    ['NamedArg', 'key', 'value'],
    ['Keyword', 'keyword', 'assignment', 'value'],
])

const number = map(
    alt([token('HexNumber'), token('DecNumber')]),
    ({ value }) => Number(value))

const string = map(
    alt([token('TaggedString'), token('QuotedString')]),
    ({ value: [_, value] }) => value
)

const ident = map(token('Ident'), ({ value }) => value)

const terminal = alt([
    map(number, tags.Number),
    map(string, tags.String),
    map(ident, tags.Ident),
])

const space = alt([
    token('Whitespace'),
    token('Comment'),
])

const _ = many(space)
const __ = many(space, 1)

const namedArg = lazy(() => map(
    seq([token('Ident'), token('Colon'), _, expression]),
    ([{ value }, _, __, expr]) => tags.NamedArg(value, expr)
))

const indexArg = lazy(() => map(expression, tags.Arg))

const arg = alt([namedArg, indexArg])

const record = map(
    wrapWith(
        wrapWith(maybeSepBy(arg, __), _),
        token('LBrk'),
        token('RBrk')),
    tags.Record
)

const field = map(
    seq([_, token('FieldOp'), alt([number, ident])]),
    ([_, __, key]) => key
)

const fieldGet = map(
    seq([alt([record, terminal]), many(field, 1)]),
    spread(tagSeq(tags.FieldGet))
)

const fnArgs = wrapWith(
    wrapWith(maybeSepBy(arg, __), _),
    token('LParen'),
    token('RParen'))

const fnCall = map(
    seq([
        alt([fieldGet, record, terminal]),
        many(fnArgs, 1),
    ]),
    spread(tagSeq(tags.FnCall)))

const fnBody = lazy(() =>
    wrapWith(body, token('LCurly'), token('RCurly')))

// TODO: destructuring
const binding = alt([
    map(ident, tags.Ident),
])

const namedBindArg = map(
    seq([token('Ident'), token('Colon'), _, binding]),
    ([{ value }, _, __, expr]) => tags.NamedArg(value, expr))
const indexBindArg = map(binding, tags.Arg)
const bindArg = alt([namedBindArg, indexBindArg])

const fnParams = wrapWith(
    wrapWith(maybeSepBy(bindArg, __), _),
    token('LParen'),
    token('RParen')
)

const fnExp = alt([
    map(seq([fnParams, fnBody]), spread(tags.FnExp)),
    map(fnBody, (body) => tags.FnExp([], body)),
])

const dotArgs = seq([
    token('Dot'),
    alt([fieldGet, record, terminal]),
    spreadMaybe(fnArgs),
])

const dotFnCall = map(
    seq([
        alt([fnCall, fieldGet, record, terminal]),
        many(dotArgs, 1),
    ]),
    ([firstArg, seq]) => seq.reduce(
        (acc, [_, ident, restArgs]) =>
            tags.FnCall(ident, [
                tags.Arg(acc),
                ...restArgs,
            ]),
        firstArg
    )
)

const keywordStatement = lazy(() => map(
    seq([
        token('At'),
        expression,
        __,
        expression,
    ]),
    ([_, keyword, __, value]) => tags.Keyword(keyword, null, value)
))

const keywordBinding = lazy(() => map(
    seq([
        token('At'),
        expression,
        __,
        binding,
        __,
        token('Assignment'),
        __,
        expression,
    ]),
    (args) => tags.Keyword(args[1], args[3], args[7])
))

const keyword = alt([keywordBinding, keywordStatement])

const expression = alt([
    keyword,
    record,
    fnExp,
    map(number, tags.Number),
    map(string, tags.String),
    dotFnCall,
    fnCall,
    fieldGet,
    map(ident, tags.Ident),
])

const body = wrapWith(maybeSepBy(expression, __), _)

const program = map(body, tags.Program)

const expr = (str) => done(expression)(tokenize(str))
const parse = (str) => done(program)(tokenize(str))

module.exports = { parse, expr, tags }
