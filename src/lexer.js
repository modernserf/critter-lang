const { alt, seq, and, chars, notEq, star, kplus, map, one, maybe, done } = require('./parser-combinators')
const { flatten, comp } = require('./util')

const tag = (type) => (value) => ({ type, value })

const join = (xs) => xs.join('')
const oneRe = (regex) => one((x) => regex.test(x))

const whitespace = kplus(oneRe(/\s/))

const comment = seq([chars(';'), map(star(notEq('\n')), join)])

const hexNumber = map(
    seq([chars('0x'), kplus(oneRe(/[0-9A-Fa-f]/))]),
    comp(join, flatten)
)

const digits = map(kplus(oneRe(/[0-9]/)), join)
const decNumber = map(
    seq([
        maybe(chars('-')),
        digits,
        map(maybe(seq([chars('.'), digits])), flatten),
    ]),
    comp(join, flatten)
)

const ident = map(kplus(oneRe(/[^\s.:#,;@[\]{}()]/)), join)

const tagString = and(chars('#'), ident)
const quote = chars('"')
const quoteEsc = map(chars('\\"'), () => '"')
const notQuote = notEq('"')
const stringChars = map(
    star(alt([quoteEsc, notQuote])),
    join
)
const quotedString = seq([quote, stringChars, quote])

const token = alt([
    map(chars('::'), tag('FieldOp')),
    map(chars(':='), tag('Assignment')),
    map(chars(':'), tag('Colon')),
    map(chars('['), tag('LBrk')),
    map(chars(']'), tag('RBrk')),
    map(chars('{'), tag('LCurly')),
    map(chars('}'), tag('RCurly')),
    map(chars('('), tag('LParen')),
    map(chars(')'), tag('RParen')),
    map(chars('@'), tag('At')),
    map(chars('.'), tag('Dot')),
    map(whitespace, tag('Whitespace')),
    map(comment, tag('Comment')),
    map(hexNumber, tag('HexNumber')),
    map(decNumber, tag('DecNumber')),
    map(tagString, tag('TaggedString')),
    map(quotedString, tag('QuotedString')),
    map(ident, tag('Ident')),
])

const tokenSeq = star(token)

const tokenize = comp(done(tokenSeq), Array.from)

module.exports = { tokenize }
