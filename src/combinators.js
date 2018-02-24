// parser results

const ok = (value, nextIndex) => ({ ok: true, value, nextIndex })
const err = (...errors) => ({ ok: false, errors })

// parsers
const _first = ([x]) => x
const _withIndex = (match, _, __, index) => ({ match, index })
export class Parser {
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

export class MemoParser extends Parser {
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
export const never = new Parser((_, index) => err('never_matches', index))

// always matches, returns same value, does not consume input
export const always = (value) => new Parser((_, index) => ok(value, index))

// matches the start of input (regex ^)
export const start = new Parser((_, index) =>
    index === 0
        ? ok(null, index)
        : err('expected_start_of_input', index))
// matches the end of input (regex $)
export const end = new Parser((input, index) =>
    index === input.length
        ? ok(null, index)
        : err('expected_end_of_input', index))

// matches any one token (regex .)
export const any = new Parser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : ok(input[index], index + 1)
)

// matches if input[index] exists && matchFn(input[index]) is truthy
export const match = (matchFn) => new MemoParser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : matchFn(input[index])
            ? ok(input[index], index + 1)
            : err('no_match', input[index], index)
)

export const eq = (value) =>
    match((x) => x === value)
        .mapError((_, val, index) => ['expected_value', value, val, index])

// matches if any of ps matches (regex | )
class AltParser extends MemoParser {
    constructor (parsers) {
        super((input, index) => this._parseAlts(input, index))
        this._setAlts(parsers)
    }
    _setAlts (parsers) {
        this._alts = parsers.reduce(
            (ps, p) => p._alts ? ps.concat(p._alts) : ps.concat([p]),
            [])
    }
    _parseAlts (input, index) {
        for (const p of this._alts) {
            const res = p.parse(input, index)
            if (res.ok) { return res }
        }
        return err('no_alts', input[index], index)
    }
}

export const alt = (...ps) => new AltParser(ps)

// matches if sequence of ps match
// TODO: concatenate with other "seq" parsers?
// how would you preserve the return shape?
// TODO: check if sum of lengths is possible
export const seq = (...ps) => new MemoParser((input, index) => {
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
export const all = (p) => new MemoParser((input, index) => {
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
export const plus = (p) => seq(p, all(p))
    .map(_consSeq)

// matches 0 or 1 p (regex ?)
// yielding [] or [value]
const _nothing = always([])
const _just = (x) => [x]
export const maybe = (p) => alt(p.map(_just), _nothing)

// matches if p does not match
// does not consume input
export const not = (p) => new Parser((input, index) =>
    p.parse(input, index).ok
        ? err('should_not_match', index)
        : ok(null, index)
)

// non-greedy match sequence of p, followed by q (regex *?)
// p must consume input
export const some = (p, q) => seq(
    all(seq(not(q), p).map(_second)),
    q
)

// matches any one token that ps do not match (regex [^ ])
const _second = ([_, x]) => x
export const notOneOf = (...ps) => seq(not(alt(...ps)), any).map(_second)

// matches zero or more `content`, separated by `separator`
// yields array of matches for `content`
const _concatSeq = ([h, t]) => h.concat(t)
export const sepBy = (content, separator) => seq(
    maybe(content),
    all(seq(separator, content).map(_second))
).map(_concatSeq)

// as above, but matches 1 or more `content`
export const sepBy1 = (content, separator) => seq(
    content,
    all(seq(separator, content).map(_second))
).map(_consSeq)

// matches `content` wrapped with left or left + right
// yields match for content
export const wrapped = (content, left, right) =>
    seq(left, content, right || left).map(_second)

// string-specific parsers

const _join = (xs) => xs.join('')
const _matchChar = (ch) => match((x) => x === ch)

// match a substring
export const chars = (str) => seq(
    ...Array.from(str).map(_matchChar)
).map(_join)
// match a char within the string
export const altChars = (str) => alt(
    ...Array.from(str).map(_matchChar)
)

// ASCII codes
export const range = (start, end) => {
    const startCode = start.codePointAt(0)
    const endCode = end.codePointAt(0)
    return match((x) => {
        if (!x.codePointAt) { return false }
        const c = x.codePointAt(0)
        return c >= startCode && c <= endCode
    })
}

export const digit = range('0', '9')
export const uppercase = range('A', 'Z')
export const lowercase = range('a', 'z')
export const letter = alt(uppercase, lowercase)
export const whitespace = match((x) => /\s/.test(x))

// helper for mutual recursion
export const lazy = (f, memo = null) => new Parser((input, index) => {
    if (memo) { return memo.parse(input, index) }
    memo = f()
    return memo.parse(input, index)
})
