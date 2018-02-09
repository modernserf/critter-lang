/* eslint-disable no-unused-vars */
const CRITTER = {
    getFields: (obj, key) => {
        if (key in obj) { return obj[key] }
        throw new Error(`KeyError: ${key}`)
    },
    keyword: (fn, value, next) => {
        const res = fn({ 0: value })
        if (next) { next(res) }
    }
}

const _dom = {
    ready: () => {},
    render: ({ 1: {0: f, 1: args} }) => console.log(f(args)),
    find: () => {}
}

const _import = (_path) => {
    return _dom
}

const _let = ({ 0: x }) => x

const _do = () => {}

const _await = () => {}

const toJSArray = (obj) => {
    const arr = []
    for (const key in obj) {
        arr[key] = obj[key]
    }
    return arr
}

const log = (args) => {
    console.log(toJSArray(args))
}
