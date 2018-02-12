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
