const test = require('tape')
const P = require('parsimmon')

const Lang = P.createLanguage({
    Program: (r) => P.alt(
        r.Expression
    ).map(tagWith('Program')),
    Expression: (r) => P.alt(
        r.FieldGet,
        r.PlainExpression),
    PlainExpression: (r) => P.alt(
        r.Record,
        r.FnCall,
        r.Token),
    FieldGet: (r) => P.seqMap(
        r.PlainExpression,
        P.optWhitespace
            .then(r.FieldOp)
            .then(P.alt(r.Number, r.Ident))
            .atLeast(1),
        tagWith('FieldGet')),
    FieldOp: () => P.string('::'),
    Record: (r) =>
        r.LBrk
            .then(P.optWhitespace)
            .then(r.Arg.sepBy(P.whitespace))
            .skip(P.optWhitespace)
            .skip(r.RBrk)
            .map(tagWith('Record')),
    FnCall: (r) => P.seqMap(
        r.Ident, // TODO: this should be any expression, including another FnCall
        r.LParen
            .then(P.optWhitespace)
            .then(r.Arg.sepBy(P.whitespace))
            .skip(P.optWhitespace)
            .skip(r.RParen),
        tagWith('FnCall')),
    Arg: (r) => P.alt(
        P.seqMap(
            r.Ident.skip(r.Colon).skip(P.whitespace),
            r.Expression,
            tagWith('NamedArg')),
        r.Expression.map(tagWith('Arg'))),
    LBrk: () => P.string('['),
    RBrk: () => P.string(']'),
    LParen: () => P.string('('),
    RParen: () => P.string(')'),
    Colon: () => P.string(':'),
    Token: (r) => P.alt(
        r.HexNumber.map(tagWith('Number')),
        r.Number.map(tagWith('Number')),
        r.String.map(tagWith('String')),
        r.Ident.map(tagWith('Ident'))),
    Number: () => P.regexp(/-?[0-9]+(.[0-9]+)?/).map(Number),
    HexNumber: () => P.regexp(/0x[0-9A-Fa-f]+/).map(Number),
    String: (r) =>
        r.Quote
            .then(P.alt(
                r.QuoteEscape,
                P.regexp(/[^"]/))
                .many().map((x) => x.join(''))
                .skip(r.Quote)),
    QuoteEscape: () => P.string('\\"').map(() => '"'),
    Quote: () => P.string('"'),
    Ident: () => P.regexp(/[^\s():[\]]+/)
})

function parse (text) {
    return Lang.Program.tryParse(text)
}

function tagWith (tag) {
    return (...args) => [tag, ...args]
}

test('parses a number', (t) => {
    t.deepEquals(
        parse('123'),
        ['Program', ['Number', 123]]
    )
    t.deepEquals(
        parse('-123.45'),
        ['Program', ['Number', -123.45]]
    )
    t.deepEquals(
        parse('0xCAFEBABE'),
        ['Program', ['Number', 0xCAFEBABE]]
    )
    t.end()
})

test('parses a quoted string', (t) => {
    t.deepEquals(
        parse('"foo bar baz"'),
        ['Program', ['String', 'foo bar baz']]
    )
    t.deepEquals(
        parse('"foo bar \\"quoted\\" baz"'),
        ['Program', ['String', 'foo bar "quoted" baz']]
    )
    t.end()
})

test('parses an identifier', (t) => {
    t.deepEquals(
        parse('foo'),
        ['Program', ['Ident', 'foo']]
    )
    t.deepEquals(
        parse('++=>'),
        ['Program', ['Ident', '++=>']]
    )

    t.throws(() => {
        parse('foo bar')
    })

    t.end()
})

test('parses a fn call', (t) => {
    t.deepEquals(
        parse('foo()'),
        ['Program', ['FnCall', 'foo', []]]
    )

    t.deepEquals(
        parse('foo(bar "baz" 123.45)'),
        ['Program', ['FnCall', 'foo', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['Arg', ['Number', 123.45]]
        ]]]
    )

    t.deepEquals(
        parse('foo(bar "baz" quux: 123.45 snerf: snerf)'),
        ['Program', ['FnCall', 'foo', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['NamedArg', 'quux', ['Number', 123.45]],
            ['NamedArg', 'snerf', ['Ident', 'snerf']]
        ]]]
    )
    t.end()
})

test('parses a record', (t) => {
    t.deepEquals(
        parse('[]'),
        ['Program', ['Record', []]]
    )

    t.deepEquals(
        parse('[bar ["baz"] 123.45]'),
        ['Program', ['Record', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['Record', [
                ['Arg', ['String', 'baz']]
            ]]],
            ['Arg', ['Number', 123.45]]
        ]]]
    )

    t.deepEquals(
        parse('[bar "baz" quux: 123.45 snerf: snerf]'),
        ['Program', ['Record', [
            ['Arg', ['Ident', 'bar']],
            ['Arg', ['String', 'baz']],
            ['NamedArg', 'quux', ['Number', 123.45]],
            ['NamedArg', 'snerf', ['Ident', 'snerf']]
        ]]]
    )
    t.end()
})

test('field access', (t) => {
    t.deepEquals(
        parse('foo::bar::baz::0'),
        ['Program',
            ['FieldGet', ['Ident', 'foo'], ['bar', 'baz', 0]]]
    )
    t.end()
})
