import { tagConstructors, match } from './util'

const ok = (value, scope) => ({
    status: 'ok',
    value,
    scope,
    then: (f) => f(value, scope),
    map: (f) => ok(f(value), scope),
    catch () { return this },
})
const err = (...errors) => ({
    status: 'error',
    errors,
    then () { return this },
    map () { return this },
    catch: (f) => f(errors),
})

export const types = tagConstructors([
    ['Number'],
    ['String'],
    ['Record', 'members'],
    ['Function', 'params', 'returns'],

    ['Field', 'key', 'value'],
    ['Product', 'members'],
    ['Sum', 'members'],
])

const traverse = (xs, scope, f) => xs.reduce(
    (chain, x, i) => chain.then((acc, scope) =>
        f(x, i, scope).map((x) => {
            acc.push(x)
            return acc
        })
    ), ok([], scope))

const traverseArgs = (args, prevScope) =>
    traverse(args, prevScope, ({ key, value }, i, scope) =>
        check(value, scope)
            .map((value) => types.Field(key || i, value)))

const check = match({
    HexNumber: (_, scope) => ok(types.Number(), scope),
    DecNumber: (_, scope) => ok(types.Number(), scope),
    String: (_, scope) => ok(types.String(), scope),

    Ident: ({ value }, scope) =>
        scope[value]
            ? ok(scope[value], scope)
            : err('unknown_ident', value),

    Record: ({ args }, prevScope) =>
        traverseArgs(args, prevScope).map((fields) =>
            types.Record(fields)),

    FieldGet: ({ target, key }, prevScope) => {
        return check(target, prevScope).then((tgt, scope) => {
            if (['Number', 'String', 'Function'].includes(tgt.type)) {
                return err('cannot_get_field_on', tgt.type)
            }

            const val = Symbol('field_get')
            const nextScope = unify(
                types.Product([types.Field(key, val)]),
                tgt,
                scope)
            return nextScope
                ? ok(lookup(nextScope, val), nextScope)
                : err('missing_field', key)
        })
    },

    FnCall: ({ callee, args }, scope) =>
        check(callee, scope).then((callee, scope) =>
            traverseArgs(args, scope)
                .map((args) => ({ callee, args }))
        ).then(({ callee, args }, scope) => {
            const val = Symbol('fn_call')
            const nextScope = unify(
                callee,
                types.Function(args, val),
                scope)
            return nextScope
                ? ok(lookup(nextScope, val), nextScope)
                : err('fail_fn_call')
        }),

    // TODO: body should be single expr, not lines
    FnExp: ({ params, body: [body] }, parentScope) => {
        const fields = params.map(({ value: { value }, key }, i) =>
            [key || i, value, Symbol(value)])

        const scope = fields.reduce(
            (s, [key, value, sym]) => set(s, value, sym),
            parentScope)

        return check(body, scope).then((b, scope) => {
            const val = Symbol('fn_exp')
            scope = unify(val, b, scope)
            const paramsBody = fields.map(([key, _, sym]) =>
                types.Field(key, lookup(scope, sym)))
            return ok(types.Function(paramsBody, lookup(scope, val)), scope)
        })
    },
}, (tag) => {
    throw new Error(`Unknown AST node ${tag.type}`)
})

const sym = (x) => typeof x === 'symbol'

function lookup (scope, item) {
    if (sym(item) && scope[item]) {
        return lookup(scope, scope[item])
    }
    return item
}

function set (scope, key, value) {
    return { ...scope, [key]: value }
}

function unify (l, r, scope) {
    l = lookup(scope, l)
    r = lookup(scope, r)
    if (l === r) { return scope }
    if (sym(l)) { return set(scope, l, r) }
    if (sym(r)) { return set(scope, r, l) }

    if (l.type === r.type) {
        switch (l.type) {
        case 'Field':
            if (l.key !== r.key) { return null }
            return unify(l.value, r.value, scope)
        case 'Record': {
            if (l.members.length !== r.members.length) { return null }
            for (let key in l.members) {
                scope = unify(l.members[key], r.members[key], scope)
                if (!scope) { return null }
            }
            return scope
        }
        case 'Function': {
            scope = unify(l.returns, r.returns, scope)
            if (!scope) { return null }
            if (l.params.length !== r.params.length) { return null }
            for (let key in l.params) {
                scope = unify(l.params[key], r.params[key], scope)
                if (!scope) { return null }
            }
            return scope
        }
        case 'Product': {
            for (let key in l.members) {
                const nextScope = unify(l.members[key], r.members[key], scope)
                if (nextScope) {
                    scope = nextScope
                } else {
                    // TODO: this really doesnt seem right
                    r.members.push(l.members[key])
                }
            }
            for (let key in r.members) {
                const nextScope = unify(l.members[key], r.members[key], scope)
                if (nextScope) {
                    scope = nextScope
                } else {
                    l.members.push(r.members[key])
                }
            }
            return scope
        }
        }

        return scope
    }
    if (l.type === 'Record') { return unifyRecord(l, r, scope) }
    if (r.type === 'Record') { return unifyRecord(r, l, scope) }

    return null
}

// TODO: this is On^2
function hasField (record, field, scope) {
    for (const f of record.members) {
        const nextScope = unify(f, field, scope)
        if (nextScope) { return nextScope }
    }
    return null
}

function unifyRecord (record, other, scope) {
    if (other.type !== 'Product') { return null }
    for (const field of other.members) {
        scope = hasField(record, field, scope)
        if (!scope) { return null }
    }
    return scope
}

const rootScope = {}

export const checker = (ast) => check(ast, rootScope)
