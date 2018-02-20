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
    apply: ({ 0: f, 1: args, this: thisArg = null }) => {
        try {
            return ['ok', f.apply(thisArg, args)]
        } catch (e) {
            return ['err', e]
        }
    },
    // call a critter function from JS
    fn: ({ 0: f }) => (...args) => f(args),

    get: ({ 0: obj, 1: key }) => obj[key],
    throw: ({ 0: x }) => { throw new Error(x) },

    'set-prop': ({ 0: obj, 1: key, 2: value }) => {
        obj[key] = value
        return obj
    },
}

const _let = ({ 0: value, 1: next }) => next({ 0: value })
