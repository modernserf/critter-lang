const { id, cond, comp, flatten } = require('./util')

const ok = (value, nextInput) => ({ ok: true, value, nextInput })
const err = (...error) => ({ ok: false, error })
const isOk = (res) => res.ok

const one = (f) => (input) =>
    !input.length
        ? err('eof')
        : f(input[0])
            ? ok(input[0], input.slice(1))
            : err('no_match', input[0])

const eq = (value) => one((x) => value === x)
const notEq = (value) => one((x) => value !== x)

const chars = (str) => str.length > 1
    ? seq(Array.from(str).map(eq))
    : eq(str)

const token = (type) => one((x) => type === x.type)

const pushState = (prevState, {value, nextInput}) =>
    ok(prevState.value.concat([value]), nextInput)

const seq = (ps) => (input) => {
    let state = ok([], input)
    for (const p of ps) {
        const res = p(state.nextInput)
        if (!res.ok) { return res }
        state = pushState(state, res)
    }
    return state
}

const alt = (ps) => (input) => {
    for (const p of ps) {
        const res = p(input)
        if (res.ok) { return res }
    }
    return err('no_alts')
}

const many = (p, min = 0, max = Infinity) => (input) => {
    let state = ok([], input)
    let i = 0
    while (state.nextInput.length) {
        if (i > max) { return err('over_max') }
        const res = p(state.nextInput)
        if (!res.ok) { break }
        state = pushState(state, res)
        i++
    }
    if (i < min) { return err('below_min') }

    return state
}

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
        many(map(
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

const lazy = (f, memo = null) => (input) => {
    if (memo) { return memo(input) }
    memo = f()
    return memo(input)
}

const wrapWith = (p, l, r) => map(
    seq([l, p, r || l]),
    ([_, value]) => value
)

module.exports = {
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
}
