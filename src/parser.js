const P = require('parsimmon')

const Lang = P.createLanguage({
    Program: (r) => r.Body.map(tagWith('Program')),
    Expression: (r) => P.alt(
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
        tagSeqWith('FieldGet')),

    Record: (r) =>
        r.LBrk
            .then(P.optWhitespace)
            .then(r.Arg.sepBy(P.whitespace))
            .skip(P.optWhitespace)
            .skip(r.RBrk)
            .map(tagWith('Record')),

    Body: (r) =>
        P.optWhitespace
            .then(r.Expression.sepBy(r.Line))
            .skip(P.optWhitespace),

    FnExp: (r) => P.alt(
        P.seqMap(r.FnArgs, r.FnExpBody, tagWith('FnExp')),
        r.FnExpBody.map((body) => ['FnExp', [], body])
    ),
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
        tagSeqWith('FnCall')),

    DotFnArgs: (r) => P.seqMap(
        r.Dot.then(P.alt(r.FieldGet, r.Terminal, r.Record)),
        r.FnArgs,
        (ident, restArgs) => ({ ident, restArgs })
    ),
    DotFnCall: (r) => P.seqMap(
        P.alt(r.FnCall, r.FieldGet, r.Terminal, r.Record),
        r.DotFnArgs.atLeast(1),
        (firstArg, seq) => seq.reduce(
            (acc, { ident, restArgs }) =>
                ['FnCall', ident, [
                    ['Arg', acc],
                    ...restArgs
                ]],
            firstArg
        )
    ),
    Arg: (r) => P.alt(
        P.seqMap(
            r.Ident.skip(r.Colon).skip(P.whitespace),
            r.Expression,
            tagWith('NamedArg')),
        r.Expression.map(tagWith('Arg'))),

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
    Line: () => P.seq(P.optWhitespace, P.string('\n'), P.optWhitespace),

    Terminal: (r) => P.alt(
        r.HexNumber.map(tagWith('Number')),
        r.Number.map(tagWith('Number')),
        r.TaggedString.map(tagWith('String')),
        r.String.map(tagWith('String')),
        r.Ident.map(tagWith('Ident'))),
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
    Ident: () => P.regexp(/[^\s():[\].{}]+/)
})

function parse (text) {
    return Lang.Program.tryParse(text)
}

function expr (text) {
    return Lang.Expression.tryParse(text)
}

function tagWith (tag) {
    return (...args) => [tag, ...args]
}

function tagSeqWith (tag) {
    return (root, args) =>
        args.reduce((acc, item) => [tag, acc, item], root)
}

module.exports = { parse, expr }
