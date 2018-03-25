import { match, tagConstructors } from './util'
import { tags } from './new-parser'

const errorTags = tagConstructors([
    ['EmptyFnExp', 'params', 'body'],
    ['DuplicateNamedArg', 'key', 'value'],
    ['ExtraExpression', 'value'],
    ['InvalidType', 'value'],
    ['InvalidBinding', 'value'],
])

export const validate = match({
    Record: ({ args }) => tags.Record(checkArgDuplicateNames(args)),
    FieldGet: ({ value, field }) => tags.FieldGet(
        validTypes(value, ['FieldGet', 'Record', 'Ident']),
        field.map((f) => validTypes(f, ['DecNumber', 'Ident']))
    ),
    Arg: ({ value }) => tags.Arg(validate(value)),
    NamedArg: ({ key, value }) => tags.NamedArg(
        validTypes(key, ['DecNumber', 'Ident']),
        validate(value)
    ),
    FnExp: ({ params, body }) => {
        const ps = checkArgDuplicateNames(params).map(validBinding)
        const bs = body.map(validate)
        return hasExpression(bs)
            ? tags.FnExp(ps, bs)
            : tags.EmptyFnExp(ps, bs)
    },
}, (tag) => tag)

const whitespace = ['Whitespace', 'Newline', 'Comment']
function validTypes (types, expr) {
        // only invalidate once
        if (expr.type === 'InvalidType') { return expr }
        if (whitespace.includes(expr.type) ||
            validTypes.includes(expr.type)) {
            return validate(expr)
        } else {
            return errorTags.InvalidType(expr)
        }
    }


function checkArgDuplicateNames (args) {
    return [...function * () {
        const usedNames = {}
        for (let arg of args.map(validate)) {
            if (arg.key.value) {
                const key = arg.key.value
                if (usedNames[key]) {
                    yield errorTags.DuplicateNamedArg(arg.key, arg.value)
                } else {
                    usedNames[key] = true
                    yield arg
                }
            } else {
                yield arg
            }
        }
    }]
}

function hasBinding ()
