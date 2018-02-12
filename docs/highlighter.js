(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const { tokenize } = require('./lexer')
const { flatten } = require('./util')

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

},{"./lexer":2,"./util":4}],2:[function(require,module,exports){
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

},{"./parser-combinators":3,"./util":4}],3:[function(require,module,exports){
const { id, cond, comp, flatten, spread } = require('./util')

const ok = (value, nextInput) => ({ ok: true, value, nextInput })
const err = (...error) => ({ ok: false, error })
const isOk = (res) => res.ok

const one = (f) => (input) =>
    !input.length
        ? err('eof')
        : f(input[0])
            ? ok(input[0], input.slice(1))
            : err('no_match', input[0])

const always = (value) => (input) => ok(value, input)
const any = one(() => true)
const never = (input) => err('never_matches')

const not = (p) => (input) => cond(isOk,
    () => err('expected_not', input[0]),
    () => ok(null, input),
)(p(input))

const or = (p1, p2) => (input) => cond(isOk,
    id,
    () => p2(input)
)(p1(input))

const and = (p1, p2) => (input) => cond(isOk,
    ({ value, nextInput }) =>
        map(p2, (nextVal) => [value, nextVal])(nextInput),
    id
)(p1(input))

const cons = (head, tail) => [head, ...tail]

const pushState = (prevState, {value, nextInput}) =>
    ok(prevState.value.concat([value]), nextInput)

const _star = (p, state) =>
    cond(isOk,
        (res) => _star(p, pushState(state, res)),
        () => state
    )(p(state.nextInput))

const star = (p) => (input) =>
    _star(p, ok([], input))

const kplus = (p) => map(and(p, star(p)), spread(cons))

const eq = (value) => one((x) => value === x)
const notEq = (value) => one((x) => value !== x)

const chars = (str) => str.length > 1
    ? seq(Array.from(str).map(eq))
    : eq(str)

const token = (type) => one((x) => type === x.type)

const append = (x, y) => x.concat([y])

const seq = (ps) =>
    ps.reduce((l, r) =>
        map(and(l, r), spread(append)),
    always([]))

const alt = (ps) =>
    or(ps.reduce(or), () => err('no_alts'))

const map = (p, f) => (input) =>
    cond(isOk,
        ({ value, nextInput }) => ok(f(value), nextInput),
        id
    )(p(input))

const maybe = (p) => (input) =>
    cond(isOk,
        ({ value, nextInput }) => ok([value], nextInput),
        (res) => ok([], input)
    )(p(input))

const sepBy = (p, other) => map(
    seq([
        p,
        star(map(
            seq([other, p]),
            ([_, pVal]) => pVal
        )),
    ]),
    ([first, rest]) => [first, ...rest]
)

const spreadMaybe = (p) => map(maybe(p), flatten)
const maybeSepBy = (p, other) => spreadMaybe(sepBy(p, other))

const eof = (input) => !input.length ? ok(null, []) : err('missing_eof')
const unwrap = cond(isOk,
    ({ value }) => value,
    ({ error }) => { throw new Error(error.join()) }
)

const done = (p) => comp(
    unwrap,
    map(seq([p, eof]), ([x]) => x)
)

const lazy = (f, memo = null) =>
    (input) => // eslint-disable-line no-return-assign
        memo ? memo(input) : (memo = f(), memo(input))

const wrapWith = (p, l, r) => map(
    seq([l, p, r || l]),
    ([_, value]) => value
)

module.exports = {
    any,
    always,
    never,
    not,
    or,
    and,
    star,
    kplus,
    token,
    seq,
    alt,
    map,
    maybe,
    sepBy,
    maybeSepBy,
    done,
    lazy,
    wrapWith,
    spreadMaybe,
    chars,
    notEq,
    one,
}

},{"./util":4}],4:[function(require,module,exports){
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

},{}]},{},[1]);
