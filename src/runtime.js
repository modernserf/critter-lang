/* eslint-disable no-unused-vars */
let _global
if (typeof window !== 'undefined') {
    _global = window
} else {
    _global = global
}

// TODO: write type annotations for all these
const JS = {
    null: null,
    true: true,
    false: false,
    undefined: undefined,
    Array: ({ 0: obj }) => {
        const arr = []
        for (const key in obj) {
            arr[key] = obj[key]
        }
        return arr
    },
    global: _global,
    log: (args) => console.log(JS.Array({ 0: args })),
    '==': ({ 0: x, 1: y }) => x == y, // eslint-disable-line eqeqeq
    '===': ({ 0: x, 1: y }) => x === y,
    '!=': ({ 0: x, 1: y }) => x != y, // eslint-disable-line eqeqeq
    '!==': ({ 0: x, 1: y }) => x !== y,
    '<': ({ 0: x, 1: y }) => x < y,
    '<=': ({ 0: x, 1: y }) => x <= y,
    '>': ({ 0: x, 1: y }) => x > y,
    '>=': ({ 0: x, 1: y }) => x >= y,

    '+': ({ 0: x, 1: y }) => x + y,
    '-': ({ 0: x, 1: y }) => x - y,
    '*': ({ 0: x, 1: y }) => x * y,
    '/': ({ 0: x, 1: y }) => x / y,
    '%': ({ 0: x, 1: y }) => x % y,

    '&&': ({ 0: x, 1: y }) => x && y,
    '||': ({ 0: x, 1: y }) => x || y,
    '!': ({ 0: x }) => !x,
    '?': ({ 0: x, 1: y, 2: z }) => x ? y : z,

    // TODO: bitwise operators

    typeof: ({ 0: x }) => typeof x,
    new: ({ 0: X, 1: args }) => new X(...JS.Array(args)),
    in: ({ 0: key, 1: obj }) => key in obj,

    // call a JS function from critter
    apply: ({ 0: f, 1: args, this: thisArg = null }) =>
        f.apply(thisArg, JS.Array({ 0: args })),
    // call a critter function from JS
    fn: ({ 0: f }) => (...args) => f(args),

    get: ({ 0: obj, 1: key }) => obj[key],
    throw: ({ 0: x }) => { throw new Error(x) },

    'set-prop': ({ 0: obj, 1: key, 2: value }) => {
        obj[key] = value
        return obj
    },
    deepEqual: ({ 0: l, 1: r }) => {
        if (l === r) { return true }
        if (!l || !r) { return false }
        const keys = Object.keys(l)
        if (keys.length !== Object.keys(r).length) { return false }
        for (let i = 0; i <= keys.length; i++) {
            const key = keys[i]
            if (!JS.deepEqual(l[key], r[key])) { return false }
        }
        return true
    },
}

const def = ({ 0: value }) => value
const _let = ({ 0: value, 1: next }) => next({ 0: value })
const letrec = ({ 0: value, 1: next }) => {
    const recur = (args) => value({ 0: recur })(args)
    return next({ 0: recur })
}

const applied = ({ 0: fn }) => (args) => fn(args)
