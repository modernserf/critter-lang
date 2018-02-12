(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// parser results

const ok = (value, nextIndex) => ({ ok: true, value, nextIndex })
const err = (...errors) => ({ ok: false, errors })

// parsers
const _first = ([x]) => x
const _withIndex = (match, _, __, index) => ({ match, index })
class Parser {
    constructor (parseFn) {
        this._parseFn = parseFn
    }
    parse (input, index = 0) {
        return this._parseFn(input, index)
    }
    parseAll (input) {
        const res = seq(this, end).map(_first).parse(input, 0)
        return res.ok ? res.value : null
    }
    findMatches (input, startAt = 0) {
        const p = some(any, this.map(_withIndex)).map(_second)
        const results = []

        while (true) {
            const res = p.parse(input, startAt)
            if (!res.ok) {
                return results
            }
            results.push(res.value)
            if (startAt === res.value.index) {
                throw new Error('`findMatches` cannot be used on a parser that does not consume input')
            }
            startAt = res.value.index
        }
    }
    map (f) {
        return new Parser((input, index) => {
            const res = this.parse(input, index)
            return res.ok
                ? ok(f(res.value, res, input, index), res.nextIndex)
                : res
        })
    }
    mapError (f) {
        return new Parser((input, index) => {
            const res = this.parse(input, index)
            return res.ok
                ? res
                : err(...f(res.errors, input, index))
        })
    }
}

class MemoParser extends Parser {
    constructor (parseFn) {
        super(parseFn)
        this._memo = new Map()
    }
    parse (input, index = 0) {
        if (this._memo.has(input) && this._memo.get(input).has(index)) {
            return this._memo.get(input).get(index)
        }
        if (!this._memo.has(input)) {
            this._memo.set(input, new Map())
        }
        const res = this._parseFn(input, index)
        this._memo.get(input).set(index, res)
        return res
    }
}

// never matches
const never = new Parser((_, index) => err('never_matches', index))

// always matches, returns same value, does not consume input
const always = (value) => new Parser((_, index) => ok(value, index))

// matches the start of input (regex ^)
const start = new Parser((_, index) =>
    index === 0
        ? ok(null, index)
        : err('expected_start_of_input', index))
// matches the end of input (regex $)
const end = new Parser((input, index) =>
    index === input.length
        ? ok(null, index)
        : err('expected_end_of_input', index))

// matches any one token (regex .)
const any = new Parser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : ok(input[index], index + 1)
)

// matches if input[index] exists && matchFn(input[index]) is truthy
const match = (matchFn) => new MemoParser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : matchFn(input[index])
            ? ok(input[index], index + 1)
            : err('no_match', input[index], index)
)

const eq = (value) =>
    match((x) => x === value)
        .mapError((_, val, index) => ['expected_value', value, val, index])

// matches if any of ps matches (regex |)
// TODO: concatenate with other "alt" parsers
const alt = (...ps) => new MemoParser((input, index) => {
    for (const p of ps) {
        const res = p.parse(input, index)
        if (res.ok) { return res }
    }
    return err('no_alts', input[index], index)
})

// matches if sequence of ps match
// TODO: concatenate with other "seq" parsers
// TODO: check if sum of lengths is possible
const seq = (...ps) => new MemoParser((input, index) => {
    const output = []
    for (const p of ps) {
        const res = p.parse(input, index)
        if (!res.ok) { return res }
        index = res.nextIndex
        output.push(res.value)
    }
    return ok(output, index)
})

// matches sequence of p (regex *)
// p must consume input
const all = (p) => new MemoParser((input, index) => {
    const output = []
    while (true) {
        const res = p.parse(input, index)
        if (!res.ok) {
            return ok(output, index)
        }
        if (index === res.nextIndex) {
            throw new Error('`all` cannot be used with a parser that does not consume input')
        }
        index = res.nextIndex
        output.push(res.value)
    }
})

// matches at least one p (regex +)
// p must consume input
const _consSeq = ([h, t]) => [h].concat(t)
const plus = (p) => seq(p, all(p))
    .map(_consSeq)

// matches 0 or 1 p (regex ?)
// yielding [] or [value]
const _nothing = always([])
const _just = (x) => [x]
const maybe = (p) => alt(p.map(_just), _nothing)

// matches if p does not match
// does not consume input
const not = (p) => new Parser((input, index) =>
    p.parse(input, index).ok
        ? err('should_not_match', index)
        : ok(null, index)
)

// non-greedy match sequence of p, followed by q (regex *?)
// p must consume input
const some = (p, q) => seq(
    all(seq(not(q), p).map(_second)),
    q
)

// matches any one token that ps do not match (regex [^ ])
const _second = ([_, x]) => x
const notOneOf = (...ps) => seq(not(alt(...ps)), any).map(_second)

// matches zero or more `content`, separated by `separator`
// yields array of matches for `content`
const _concatSeq = ([h, t]) => h.concat(t)
const sepBy = (content, separator) => seq(
    maybe(content),
    all(seq(separator, content).map(_second))
).map(_concatSeq)

// as above, but matches 1 or more `content`
const sepBy1 = (content, separator) => seq(
    content,
    all(seq(separator, content))
).map(_consSeq)

// matches `content` wrapped with left or left + right
// yields match for content
const wrapped = (content, left, right) =>
    seq(left, content, right || left).map(_second)

// string-specific parsers

const _join = (xs) => xs.join('')
const _matchChar = (ch) => match((x) => x === ch)

// match a substring
const chars = (str) => seq(
    ...Array.from(str).map(_matchChar)
).map(_join)
// match a char within the string
const altChars = (str) => alt(
    ...Array.from(str).map(_matchChar)
)

// ASCII codes
const range = (start, end) => {
    const startCode = start.codePointAt(0)
    const endCode = end.codePointAt(0)
    return match((x) => {
        if (!x.codePointAt) { return false }
        const c = x.codePointAt(0)
        return c >= startCode && c <= endCode
    })
}

const digit = range('0', '9')
const uppercase = range('A', 'Z')
const lowercase = range('a', 'z')
const letter = alt(uppercase, lowercase)
const whitespace = match((x) => /\s/.test(x))

// helper for mutual recursion
const lazy = (f, memo = null) => new Parser((input, index) => {
    if (memo) { return memo.parse(input, index) }
    memo = f()
    return memo.parse(input, index)
})

module.exports = { Parser, MemoParser, never, always, start, end, any, match, eq, alt, seq, all, some, plus, maybe, not, notOneOf, sepBy, sepBy1, wrapped, chars, altChars, range, digit, uppercase, lowercase, letter, whitespace, lazy }

},{}],2:[function(require,module,exports){
import { tokenize } from './lexer'
import { flatten } from './util'

const join = (s) => Array.isArray(s) ? flatten(s).join('') : s

const highlight = (text) =>
    tokenize(text).map(({ type, value }) =>
        `<span class="syntax-${type}">${join(value)}</span>`).join('')

function trimBlock (str) {
    const indent = str.length - str.trimLeft().length
    if (indent === 0) { return str }
    const lines = str.split('\n').map((line) => line.substr(indent - 1))
    return lines.join('\n').trim()
}

window.addEventListener('DOMContentLoaded', () => {
    const nodes = Array.from(document.querySelectorAll('[data-critter-lang]'))
    nodes.forEach((node) => {
        const html = highlight(trimBlock(node.textContent))
        node.innerHTML = html
    })
})

},{"./lexer":3,"./util":4}],3:[function(require,module,exports){
const P = require('./combinators')
import { flatten } from './util'

const tag = (type) => (value) => ({ type, value })

const join = (xs) => xs.join('')

const whitespace = P.plus(P.whitespace)

const comment = P.seq(
    P.chars(';'),
    P.all(P.notOneOf(P.chars(''))).map(join)
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

const tokenize = (str) => tokenSeq.parseAll(Array.from(str))

module.exports = { tokenize }

},{"./combinators":1,"./util":4}],4:[function(require,module,exports){
const pipe = (fns) => (input) => fns.reduce((acc, f) => f(acc), input)
const comp = (f, g) => (x) => f(g(x))
const cond = (p, ifTrue, ifFalse) => (x) => p(x) ? ifTrue(x) : ifFalse(x)
const id = (x) => x
const spread = (f) => (xs) => f(...xs)

const Either = {
    left: (x) => ['left', x],
    right: (x) => ['right', x],
    isLeft: ([tag]) => tag === 'left',
    unwrap: ([_tag, value]) => value,
    bind: (f) => cond(Either.isLeft, id, comp(f, Either.unwrap)),
    bindLeft: (f) => cond(Either.isLeft, comp(f, Either.unwrap), id),

    fmap: (f) => Either.bind(comp(Either.right, f)),
    mapLeft: (f) => Either.bindLeft(comp(Either.left, f)),
    filterm: (p) => Either.bind(cond(p, Either.right, Either.left)),
    guard: (isLeft, mapLeft) => Either.bind(cond(isLeft,
        comp(Either.left, mapLeft),
        Either.right)),
}

const tagger = (type, keys) => (...args) =>
    keys.reduce((obj, key, i) =>
        Object.assign(obj, {[key]: args[i]}),
    { type })

const tagConstructors = (defs) => defs.reduce((obj, [type, ...keys]) =>
    Object.assign(obj, {[type]: tagger(type, keys)}), {})

const match = (obj, onDefault) => (tag, index) =>
    obj[tag.type] ? obj[tag.type](tag, index) : onDefault(tag, index)

const flatten = (arr) => [].concat(...arr)

module.exports = {
    pipe,
    comp,
    cond,
    id,
    Either,
    tagConstructors,
    match,
    flatten,
    spread,
}

},{}]},{},[2]);
