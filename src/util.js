export const pipe = (fns) => (input) => fns.reduce((acc, f) => f(acc), input)
export const id = (x) => x
export const spread = (f) => (xs) => f(...xs)

export const tagger = (type, keys) => (...args) =>
    keys.reduce((obj, key, i) =>
        Object.assign(obj, {[key]: args[i]}),
    { type })

export const tagConstructors = (defs) => defs.reduce((obj, [type, ...keys]) =>
    Object.assign(obj, {[type]: tagger(type, keys)}), {})

export const match = (obj, onDefault) => (tag, ...args) =>
    obj[tag.type] ? obj[tag.type](tag, ...args) : onDefault(tag, ...args)

export const flatten = (arr) => [].concat(...arr)
