import { comp, k, id } from './util'

export class Goal {
    static flatten (value) {
        return (value instanceof Goal) ? value : ok(value)
    }
    constructor (value) {
        this.value = value
    }
    map ([ifOk, ifErr]) {
        this.flatMap([
            comp(ok, ifOk),
            comp(error, ifErr),
        ])
    }
    cond (ifOk, ifErr) {
        return this.flatMap([ifOk, ifErr])
    }
    then (f) {
        return this.cond(f, error)
    }
    else (f) {
        return this.cond(ok, f)
    }
    or (rhs) {
        return this.else(k(rhs))
    }
    and (rhs) {
        return this.then(k(rhs))
    }
    not () {
        return this.cond(error, ok)
    }
    try (f = id) {
        return this.then(comp(Goal.flatten, f))
    }
    guard (f = id) {
        return this.else(comp(Goal.flatten, f))
    }
}
class Ok extends Goal {
    flatMap ([ifOk, _]) {
        return ifOk(this.value)
    }
    get ok () { return true }
}
class Err extends Goal {
    flatMap ([_, ifErr]) {
        return ifErr(this.value)
    }
    get ok () { return false }
}

// goal generators
export const ok = (value) => new Ok(value)
export const error = (err) => new Err(err)

const boolOp = (f, err) => (l, r) =>
    Goal.flatten(l).then((lVal) =>
        Goal.flatten(r).then((rVal) =>
            f(lVal, rVal) ? ok(rVal) : error([err, lVal, rVal])
        ))

export const ops = {
    eq: boolOp((x, y) => x === y, 'not_eq'),
    lt: boolOp((x, y) => x < y, 'not_lt'),
    lte: boolOp((x, y) => x <= y, 'not_lte'),
    gt: boolOp((x, y) => x > y, 'not_gt'),
    gte: boolOp((x, y) => x >= y, 'not_gte'),
}

const parseError = (message, target) => error({ message, target })

export const never = (p) => parseError('never', p)
export const always = ok

export const either = (l, r) => (p) =>
    l(p).else((err) => r(p).else((err2) => error([err, err2])))
export const both = (l, r) => (p) => l(p).then(() => r(p))
export const seq = (l, r) => (p) => l(p).then(r)

export const all = (f) => (p) => f(p).cond(all(f), () => ok(p))

export const plus = (p) => seq(p, all(p))
export const maybe = (p) => either(p, always)
export const not = (f) => (p) => f(p).cond(
    () => parseError('should_not_match', p),
    () => ok(p))

// parser combinators
const parseTarget = (input, result = [], index = 0) =>
    ({ input, result, index })

export const parse = (parser, input) =>
    parser(parseTarget(input)).then((p) => ok(p.result))

export const start = (p) => p.index === 0
    ? ok(p)
    : parseError('expected_start_of_input', p)
export const end = (p) => p.index === p.input.length
    ? ok(p)
    : parseError('expected_end_of_input', p)

const hasInput = (p) => p.index === p.input.length
    ? parseError('unexpected_end_of_input', p)
    : ok(p)

const matchOneUnsafe = (f) => (p) =>
    f(p.input[p.index]).then((res) => ok({
        input: p.input,
        result: p.result.concat([res]),
        index: p.index + 1,
    })).else((err) => parseError(err, p))

export const any = seq(hasInput, matchOneUnsafe(ok))
export const matchOne = (f) => seq(hasInput, matchOneUnsafe(f))
export const notOne = (f) => seq(not(f), any)
export const eq = (val) => matchOne((x) => ops.eq(val, x))

// helper for mutual recursion
export const lazy = (getF, f = null) => (p) => {
    if (f) { return f(p) }
    f = getF()
    return f(p)
}

export const flatMapResult = (parser, flatMapper) => (p) =>
    parser({ ...p, result: [] }).then((nextP) => ok({
        ...nextP,
        result: p.result.concat(flatMapper(nextP.result)),
    }))

export const drop = (f) => flatMapResult(f, () => [])

// high-level + convenience functions
export const alts = (...fs) => (p) =>
    fs.reduce(either)(p).else((errs) => parseError(
        errs.map((err) => err.message),
        p
    ))

export const seqs = (...fs) => fs.reduce(seq)

export const wrappedWith = (body, l, r = null) =>
    seqs(drop(l), body, drop(r || l))

export const sepBy = (content, separator) =>
    seq(content, all(seq(drop(separator), content)))
export const sepBy1 = (content, separator) =>
    seq(content, plus(seq(drop(separator), content)))

// string-specific parsers

const _join = (xs) => xs.join('')

export const chars = (str) => flatMapResult(
    seqs(...Array.from(str).map(eq)),
    _join
)
export const altChars = (str) =>
    alts(...Array.from(str).map(eq))

// ascii codes
export const range = (start, end) => {
    const startCode = start.codePointAt(0)
    const endCode = end.codePointAt(0)
    return matchOne((x) => {
        if (!x.codePointAt) { return error('not_a_char') }
        const c = x.codePointAt(0)
        return c >= startCode && c <= endCode
            ? ok(x)
            : error('out_of_range')
    })
}

export const digit = range('0', '9')
export const uppercase = range('A', 'Z')
export const lowercase = range('a', 'z')
export const letter = either(uppercase, lowercase)
export const whitespace = matchOne((x) =>
    /\s/.test(x) ? ok(x) : error('not_whitespace'))

export const trace = (f) => (p) =>
    f(p).then((nextP) => ok({
        value: nextP.value,
        from: p.index,
        to: nextP.index,
    }))

const lensTarget = (focus) => ({ focus, set: ok })

export const lens = (getter, setter) => (p) =>
    getter(p.focus).then((focus) => ok({
        focus,
        set: (value) => setter(p.focus, value).then(p.set),
    }))
export const view = (focus, lens) => lens(lensTarget(focus))
    .then((p) => ok(p.focus))
export const set = (focus, lens, value) => lens(lensTarget(focus))
    .then((p) => p.set(value))
export const over = (focus, lens, mapper) =>
    lens(lensTarget(focus)).then((p) => p.set(mapper(p.focus)))

export const lensProp = (key) => lens(
    (focus) => key in focus
        ? ok(focus[key])
        : error(['missing_field', key]),
    (focus, value) => ok({ ...focus, [key]: value }),
)

export const iso = (l, r) => ({
    to: lens(l, (_, value) => r(value)),
    from: lens(r, (_, value) => l(value)),
})
