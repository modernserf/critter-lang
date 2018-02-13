import * as P from './combinators'
import { flatten } from './util'

const tag = (type) => (value) => ({ type, value })

const join = (xs) => xs.join('')

const whitespace = P.plus(P.whitespace)

const comment = P.seq(
    P.chars(';'),
    P.all(P.notOneOf(P.chars('\n'))).map(join)
)

const hexNumber = P.seq(
    P.chars('0x'),
    P.plus(P.alt(P.digit, P.range('A', 'F'), P.range('a', 'f'))).map(join)
).map(join)

const digits = P.plus(P.digit).map(join)
const decNumber = P.seq(
    P.maybe(P.chars('-')),
    digits,
    P.maybe(P.seq(P.chars('.'), digits)).map(flatten)
).map(flatten)
    .map(join)

const ident = P.plus(P.notOneOf(
    P.whitespace,
    P.altChars('.:#,;@[]{}()]"')
)).map(join)

const tagString = P.seq(P.chars('#'), ident)

const quote = P.chars('"')
const quoteEsc = P.chars('\\"').map(() => '"')
const notQuote = P.notOneOf(quote)
const stringChars = P.all(P.alt(quoteEsc, notQuote)).map(join)
const quotedString = P.seq(quote, stringChars, quote)

const token = P.alt(
    P.chars('::').map(tag('FieldOp')),
    P.chars(':=').map(tag('Assignment')),
    P.chars(':').map(tag('Colon')),
    P.chars('[').map(tag('LBrk')),
    P.chars(']').map(tag('RBrk')),
    P.chars('{').map(tag('LCurly')),
    P.chars('}').map(tag('RCurly')),
    P.chars('(').map(tag('LParen')),
    P.chars(')').map(tag('RParen')),
    P.chars('@').map(tag('At')),
    P.chars('.').map(tag('Dot')),
    whitespace.map(tag('Whitespace')),
    comment.map(tag('Comment')),
    hexNumber.map(tag('HexNumber')),
    decNumber.map(tag('DecNumber')),
    tagString.map(tag('TaggedString')),
    quotedString.map(tag('QuotedString')),
    ident.map(tag('Ident')),
)

const tokenSeq = P.all(token)

export const tokenize = (str) => tokenSeq.parseAll(Array.from(str))
