import { tagConstructors, match } from './util'

const ok = (value) => ({
    status: 'ok',
    value,
    then: (f) => f(value),
})
const err = (...errors) => ({
    status: 'error',
    errors,
    then: () => err(...errors),
})
const update = (input, output) => ({
    status: 'update',
    input,
    output,
    then: () => update(input, output),
})

export const types = tagConstructors([
    ['Number'],
    ['String'],
    ['Record', 'args'],
    // record where the types / presence of some but not all keys are known
    ['PartialRecord', 'args'],
    ['Function', 'params', 'returns'],
    // TODO: partial functions
    ['Sum', 'members'],
    ['Var'],
])

function checkDuplicateKeys (args, scope) {
    const out = {}
    for (const [i, arg] of args.entries()) {
        const key = arg.key || i
        if (key in out) {
            return err('duplicate_key', key)
        } else {
            out[key] = arg.value
        }
    }
    return ok(out)
}

const flatMapValues = (obj, f) => {
    const out = {}
    for (const key in obj) {
        const res = f(obj[key])
        if (res.status !== 'ok') { return res }
        out[key] = res.value
    }
    return ok(out)
}

const checkField = match({
    Record: (target, key) => {
        const result = target.args[key]
        return result ? ok(result) : err('missing_field', key)
    },
    PartialRecord: (target, key) => {
        if (target.args[key]) { return ok(target.args[key]) }
        const res = types.Var()
        const record = types.PartialRecord({ ...target.args, [key]: res })
        return update(target, record)
    },
    Var: (target, key) => {
        const res = types.Var()
        const record = types.PartialRecord({ [key]: res })
        return update(target, record)
    },
}, (target) => {
    return err('cannot_get_field_on', target.type)
})

const check = match({
    Number: () => ok(types.Number()),
    String: () => ok(types.String()),
    Ident: ({ value }, scope) =>
        scope[value] ? ok(scope[value]) : err('unknown_ident', value),
    Record: ({ args }, scope) =>
        checkDuplicateKeys(args, scope).then((args) =>
            flatMapValues(args, (arg) => check(arg, scope))
        ).then((argTypes) =>
            ok(types.Record(argTypes))
        ),
    FieldGet: ({ target, key }, scope) =>
        check(target, scope).then((tgt) =>
            checkField(tgt, key)
        ),
    FnCall: ({ callee, args }, scope) => {
        callee = check(callee, scope)
        if (callee.status !== 'ok') { return callee }
        callee = callee.value
        const argTypes = {}
        for (const [i, arg] of args.entries()) {
            const res = check(arg.value, scope)
            if (res.status !== 'ok') { return res }
            const key = arg.key || i
            if (key in argTypes) {
                return err('duplicate_key', key)
            } else {
                argTypes[key] = res.value
            }
        }
        switch (callee.type) {
        case 'Function': {
            // unification, again
            for (const key in argTypes) {
                if (!callee.params[key]) {
                    return err('unexpected_param', key)
                }
                const res = unify(callee.params[key], argTypes[key])
                if (res.status !== 'ok') { return res }
            }
            return ok(callee.returns)
        }
        default:
            return err('not_a_function', callee.type)
        }
    },
    // TODO: body should be already expanded to a single expression
    FnExp: ({ params, body: [body] }, outerScope) => {
        const scope = { ...outerScope }
        const paramTypes = {}

        const reverseLookup = new Map()

        // TODO: support pattern matching
        for (const [i, p] of params.entries()) {
            const ref = types.Var()
            const name = p.value.value
            scope[name] = ref
            const key = p.key || i
            if (key in paramTypes) {
                return err('duplicate_key', key)
            } else {
                paramTypes[key] = ref
            }
            reverseLookup.set(ref, { name, key })
        }

        // TODO: this is "the same thing" as unification
        // the type checker should look more like a prolog solver
        let res = check(body, scope)
        while (res.status === 'update') {
            if (!reverseLookup.has(res.input)) { return res }
            const { name, key } = reverseLookup.get(res.input)
            scope[name] = res.output
            paramTypes[key] = res.output
            res = check(body, scope)
        }

        if (res.status === 'error') { return res }

        return ok(types.Function(paramTypes, res.value))
    },
}, (tag) => {
    throw new Error(`Unknown AST node ${tag.type}`)
})

function unify (l, r) {
    if (l === r) { return ok(l) }
    if (l.type === 'Var') { return update(l, r) }
    if (r.type === 'Var') { return update(r, l) }

    // TODO: unify partial and total types here

    if (l.type === r.type) {
        // TODO: recurse on record, args here
        return ok(l)
    }
    return err('mismatched_types', l.type, r.type)
}

const rootScope = {}
const clean = (x) => { delete x.then; return x }

export const checker = (ast) => clean(check(ast, rootScope))
