const P = require('parsimmon')
const { tagConstructors } = require('./util')

const tagSeq = (tagger) => (init, args) =>
    args.reduce((acc, item) => tagger(acc, item), init)
const spread = (f) => (xs) => f(...xs)

const tags = tagConstructors([
    ['Program', 'body'],
    ['Number', 'value'],
    ['String', 'value'],
    ['Ident', 'value'],
    ['Record', 'args'],
    ['FnCall', 'callee', 'args'],
    ['FnExp', 'params', 'body'],
    ['Arg', 'value'],
    ['NamedArg', 'key', 'value'],
    ['FieldGet', 'target', 'key'],
    ['Keyword', 'keyword', 'assignment', 'value']
])

const Lang = P.createLanguage({
    Program: (r) => r.Body.map(tags.Program),
    Expression: (r) => P.alt(
        r.Keyword,
        r.DotFnCall,
        r.FnCall,
        r.FieldGet,
        r.FnExp,
        r.Record,
        r.Terminal),
    Field: (r) =>
        P.optWhitespace
            .then(r.FieldOp)
            .then(P.alt(r.Number, r.Ident)),
    FieldGet: (r) => P.seqMap(
        P.alt(r.Terminal, r.Record),
        r.Field.atLeast(1),
        tagSeq(tags.FieldGet)),

    Record: (r) =>
        r.LBrk
            .then(P.optWhitespace)
            .then(r.Arg.sepBy(P.whitespace))
            .skip(P.optWhitespace)
            .skip(r.RBrk)
            .map(tags.Record),

    Body: (r) =>
        P.optWhitespace
            .then(r.Expression.sepBy(r.Line))
            .skip(P.optWhitespace),

    // TODO: ([Arg: Ident | DestructureIdent]+){ Body }
    FnExp: (r) =>
        P.alt(
            P.seq(r.FnArgs, r.FnExpBody),
            r.FnExpBody.map((body) => [[], body])
        ).map(spread(tags.FnExp)),
    FnExpBody: (r) =>
        r.LCurly
            .then(r.Body)
            .skip(r.RCurly),

    FnArgs: (r) => r.LParen
        .then(P.optWhitespace)
        .then(r.Arg.sepBy(P.whitespace))
        .skip(P.optWhitespace)
        .skip(r.RParen),
    FnCall: (r) => P.seqMap(
        P.alt(r.FieldGet, r.Terminal, r.Record),
        r.FnArgs.atLeast(1),
        tagSeq(tags.FnCall)),

    DotFnArgs: (r) => P.seq(
        r.Dot.then(P.alt(r.FieldGet, r.Terminal, r.Record)),
        r.FnArgs
    ),
    DotFnCall: (r) => P.seqMap(
        P.alt(r.FnCall, r.FieldGet, r.Terminal, r.Record),
        r.DotFnArgs.atLeast(1),
        (firstArg, seq) => seq.reduce(
            (acc, [ident, restArgs]) =>
                tags.FnCall(ident, [
                    tags.Arg(acc),
                    ...restArgs
                ]),
            firstArg
        )
    ),
    Arg: (r) => P.alt(
        P.seqMap(
            r.Ident.skip(r.Colon).skip(P.whitespace),
            r.Expression,
            tags.NamedArg),
        r.Expression.map(tags.Arg)),

    Keyword: (r) => P.alt(
        r.KeywordAssignment,
        r.KeywordStatement
    ).map(spread(tags.Keyword)),
    KeywordAssignment: (r) => P.seq(
        r.At.then(r.Ident).skip(P.whitespace),
        r.Ident.skip(P.whitespace).skip(r.Assignment).skip(P.whitespace),
        r.Expression
    ),
    KeywordStatement: (r) => P.seq(
        r.At.then(r.Ident).skip(P.whitespace),
        P.index.map(() => null),
        r.Expression
    ),

    // punctuation
    LBrk: () => P.string('['),
    RBrk: () => P.string(']'),
    LCurly: () => P.string('{'),
    RCurly: () => P.string('}'),
    LParen: () => P.string('('),
    RParen: () => P.string(')'),
    Colon: () => P.string(':'),
    Tag: () => P.string('#'),
    FieldOp: () => P.string('::'),
    Dot: () => P.string('.'),
    Line: () => P.seq(P.regex(/( |\t)*/), P.string('\n'), P.optWhitespace),
    At: () => P.string('@'),
    Assignment: () => P.string(':='),

    Terminal: (r) => P.alt(
        r.HexNumber.map(tags.Number),
        r.Number.map(tags.Number),
        r.TaggedString.map(tags.String),
        r.String.map(tags.String),
        r.Ident.map(tags.Ident)),
    Number: () => P.regexp(/-?[0-9]+(.[0-9]+)?/).map(Number),
    HexNumber: () => P.regexp(/0x[0-9A-Fa-f]+/).map(Number),
    TaggedString: (r) =>
        r.Tag
            .then(r.Ident),
    String: (r) =>
        r.Quote
            .then(P.alt(
                r.QuoteEscape,
                P.regexp(/[^"]/))
                .many().map((x) => x.join(''))
                .skip(r.Quote)),
    QuoteEscape: () => P.string('\\"').map(() => '"'),
    Quote: () => P.string('"'),
    Ident: () => P.regexp(/[^\s():[\].{}#]+/)
})

const stripComments = (str) => str.replace(/;.+\n/g, '')
const parse = (text) => Lang.Program.tryParse(stripComments(text))
const expr = (text) => Lang.Expression.tryParse(text)

module.exports = { parse, expr, tags }
