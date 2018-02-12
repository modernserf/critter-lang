export const pipe = (fns) => (input) => fns.reduce((acc, f) => f(acc), input)
export const comp = (f, g) => (x) => f(g(x))
export const cond = (p, ifTrue, ifFalse) => (x) => p(x) ? ifTrue(x) : ifFalse(x)
export const id = (x) => x
export const spread = (f) => (xs) => f(...xs)

export const Either = {
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

export const tagger = (type, keys) => (...args) =>
    keys.reduce((obj, key, i) =>
        Object.assign(obj, {[key]: args[i]}),
    { type })

export const tagConstructors = (defs) => defs.reduce((obj, [type, ...keys]) =>
    Object.assign(obj, {[type]: tagger(type, keys)}), {})

export const match = (obj, onDefault) => (tag, index) =>
    obj[tag.type] ? obj[tag.type](tag, index) : onDefault(tag, index)

export const flatten = (arr) => [].concat(...arr)
