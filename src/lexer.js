const P = require('parsimmon')

const tag = (type) => (value) => ({ type, value })

const Lexer = P.createLanguage({
    TokenSeq: (r) => r.Token.many(),
    Token: (r) => P.alt(
        r.FieldOp.map(tag('FieldOp')),
        r.Assignment.map(tag('Assignment')),
        r.Colon.map(tag('Colon')),
        r.LBrk.map(tag('LBrk')),
        r.RBrk.map(tag('RBrk')),
        r.LCurly.map(tag('LCurly')),
        r.RCurly.map(tag('RCurly')),
        r.LParen.map(tag('LParen')),
        r.RParen.map(tag('RParen')),
        r.At.map(tag('At')),
        r.Dot.map(tag('Dot')),
        P.whitespace.map(tag('Whitespace')),
        r.Comment.map(tag('Comment')),
        r.TaggedString.map(tag('TaggedString')),
        r.QuotedString.map(tag('QuotedString')),
        r.HexNumber.map(tag('HexNumber')),
        r.DecNumber.map(tag('DecNumber')),
        r.Ident.map(tag('Ident'))
    ),
    Comment: (r) => P.seq(r.Semi, r.LineChar),
    LineChar: () => P.regexp(/[^\n]+/),

    TaggedString: (r) => P.seq(r.Tag, r.Ident),

    QuotedString: (r) => P.seq(r.Quote, r.StringChars, r.Quote),
    StringChars: (r) =>
        P.alt(r.QuoteEscape, r.StringChar).many().tie(),

    Quote: () => P.string('"'),
    QuoteEscape: () => P.string('\\"').map(() => '"'),
    StringChar: () => P.regexp(/[^"]/),

    DecNumber: () => P.regexp(/-?[0-9]+(.[0-9]+)?/),
    HexNumber: () => P.regexp(/0x[0-9A-Fa-f]+/),

    Ident: () => P.regexp(/[^\s.:#,;@[\]{}()]+/),

    FieldOp: () => P.string('::'),
    Assignment: () => P.string(':='),
    Colon: () => P.string(':'),
    LBrk: () => P.string('['),
    RBrk: () => P.string(']'),
    LCurly: () => P.string('{'),
    RCurly: () => P.string('}'),
    LParen: () => P.string('('),
    RParen: () => P.string(')'),
    Tag: () => P.string('#'),
    Dot: () => P.string('.'),
    Semi: () => P.string(';'),
    At: () => P.string('@'),
})

const tokenize = (str) => Lexer.TokenSeq.tryParse(str)

module.exports = { tokenize }
