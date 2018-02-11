const pipe = (fns) => (input) => fns.reduce((acc, f) => f(acc), input)
const comp = (f, g) => (x) => f(g(x))
const cond = (p, ifTrue, ifFalse) => (x) => p(x) ? ifTrue(x) : ifFalse(x)
const id = (x) => x

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

// parser combinators

const one = (f) => (input) => {
    if (!input.length) {
        return { ok: false, error: ['eof'] }
    }
    return f(input[0])
        ? { ok: true, value: input[0], nextInput: input.slice(1) }
        : { ok: false, error: ['no_match', input[0]] }
}

const eq = (value) => one((x) => value === x)
const notEq = (value) => one((x) => value !== x)

const chars = (str) => str.length > 1
    ? seq(Array.from(str).map(eq))
    : eq(str)

const token = (type) => one((x) => type === x.type)

const seq = (ps) => (input) => {
    const state = { ok: true, value: [], nextInput: input }
    for (const p of ps) {
        const res = p(state.nextInput)
        if (!res.ok) { return res }
        state.value.push(res.value)
        state.nextInput = res.nextInput
    }
    return state
}

const alt = (ps) => (input) => {
    for (const p of ps) {
        const res = p(input)
        if (res.ok) { return res }
    }
    return { ok: false, error: ['no_alts'] }
}

const map = (p, f) => (input) => {
    const res = p(input)
    return res.ok ? { ...res, value: f(res.value) } : res
}

const many = (p, min = 0, max = Infinity) => (input) => {
    const state = { ok: true, value: [], nextInput: input }
    let i = 0
    while (state.nextInput.length) {
        if (i > max) {
            return { ok: false, error: ['over_max'] }
        }
        const res = p(state.nextInput)
        if (!res.ok) { break }
        state.value.push(res.value)
        state.nextInput = res.nextInput
        i++
    }
    if (i < min) {
        return { ok: false, error: ['below_min'] }
    }

    return state
}

const maybe = (p) => (input) => {
    const res = p(input)
    return res.ok
        ? { ...res, value: [res.value] }
        : { ok: true, value: [], nextInput: input }
}

const sepBy = (p, other) => map(
    seq([
        p,
        many(map(
            seq([other, p]),
            ([_, pVal]) => pVal
        )),
    ]),
    ([first, rest]) => [first, ...rest]
)

const flatten = (arr) => [].concat(...arr)
const spreadMaybe = (p) => map(maybe(p), flatten)
const maybeSepBy = (p, other) => spreadMaybe(sepBy(p, other))

const done = (p) => (input) => {
    const res = p(input)
    if (!res.ok) { throw new Error(res.error.join()) }
    if (res.nextInput.length) {
        throw new Error('missing_eof')
    }
    return res.value
}

const lazy = (f) => {
    let memo = null
    return (input) => {
        if (memo) { return memo(input) }
        memo = f()
        return memo(input)
    }
}

const wrapWith = (p, l, r) => map(
    seq([l, p, r || l]),
    ([_, value]) => value
)

module.exports = {
    pipe,
    comp,
    Either,
    tagConstructors,
    match,
    token,
    seq,
    alt,
    map,
    many,
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
    flatten,
}
