import {
    seqs, alts, all, plus, maybe, notOne, drop, wrappedWith,
    chars, altChars, range, digit, whitespace, parse,
    flatMapResult,
} from './goal'

const comment = seqs(
    drop(chars(';')),
    all(notOne(chars('\n')))
)

const hexLower = range('A', 'F')
const hexUpper = range('a', 'f')
const hexNumber = seqs(
    chars('0x'),
    plus(alts(digit, hexLower, hexUpper))
)

const decDigits = seqs(
    digit,
    all(alts(chars('_'), digit))
)
const decNumber = seqs(
    maybe(chars('-')),
    decDigits,
    maybe(seqs(chars('.'), decDigits))
)

const specialChars = altChars('.:#,;@[]{}()]"')
const ident = plus(notOne(alts(whitespace, specialChars)))

const tagString = seqs(
    drop(chars('#')),
    ident
)

const quote = chars('"')
const quoteEsc = flatMapResult(chars('\\"'), () => ['"'])
const notQuote = notOne(quote)
const stringChars = all(alts(quoteEsc, notQuote))
const quotedString = wrappedWith(stringChars, quote)

const token = alts(
    tag('FieldOp', chars('::')),
    tag('Assignment', chars(':=')),
    tag('Colon', chars(':')),
    tag('Comma', chars(',')),
    tag('LBrk', chars('[')),
    tag('RBrk', chars(']')),
    tag('LCurly', chars('{')),
    tag('RCurly', chars('}')),
    tag('LParen', chars('(')),
    tag('RParen', chars(')')),
    tag('At', chars('@')),
    tag('Dot', chars('.')),
    tag('Whitespace', plus(chars(' '))),
    tag('Newline', chars('\n')),
    tag('Comment', comment),
    tag('HexNumber', hexNumber),
    tag('DecNumber', decNumber),
    tag('TaggedString', tagString),
    tag('QuotedString', quotedString),
    tag('Ident', ident),
)

const tokenSeq = all(token)

export const tokenize = (str) => parse(tokenSeq, Array.from(str)).value

function tag (type, f) {
    return flatMapResult(f, (xs) => [{ type, value: xs.join('') }])
}
