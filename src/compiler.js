const escodegen = require('escodegen')

function transform ([type, value, meta], index) {
    switch (type) {
    case 'Number':
        if (value >= 0) {
            return {
                type: 'Literal',
                value: value
            }
        } else {
            return {
                type: 'UnaryExpression',
                operator: '-',
                prefix: true,
                argument: {
                    type: 'Literal',
                    value: -value
                }
            }
        }
    case 'String':
        return {
            type: 'Literal',
            value: value
        }
    case 'Ident':
        return {
            type: 'Identifier',
            name: mapIdent(value)
        }
    case 'Record':
        return {
            type: 'ObjectExpression',
            properties: value.map(transform)
        }
    case 'FnCall':
        return {
            type: 'CallExpression',
            callee: transform(value),
            arguments: [{
                type: 'ObjectExpression',
                properties: meta.map(transform)
            }]
        }
    case 'FnExp':
        return {
            type: 'FunctionExpression',
            params: value.length ? [{
                type: 'ObjectExpression',
                properties: value.map(transform)
            }] : [],
            body: {
                type: 'BlockStatement',
                body: [{
                    type: 'ReturnStatement',
                    argument: buildSequence(meta)
                }]
            }
        }
    case 'Arg':
        return {
            type: 'Property',
            key: { type: 'Literal', value: index },
            value: transform(value),
            kind: 'init'
        }
    case 'NamedArg':
        return {
            type: 'Property',
            key: { type: 'Literal', value: value },
            value: transform(meta),
            kind: 'init'
        }
    case 'FieldGet':
        return stdlibMethod('getFields', [
            transform(value),
            {
                type: 'ArrayExpression',
                elements: meta.map((key) => ({
                    type: 'Literal',
                    value: key
                }))
            }
        ])
    case 'Keyword':
        throw new Error('Keyword must be compiled in function or module context')
    default:
        throw new Error(`Unknown AST node ${type}`)
    }
}

// converts @keyword blocks into continuation-passing style
function buildSequence ([head, ...tail]) {
    const [type, ident, assignment, value] = head

    if (type !== 'Keyword') {
        return transform(head)
    }

    const args = [
        { type: 'Identifier', name: mapIdent(ident) },
        transform(value)
    ]

    if (tail.length) {
        args.push({
            type: 'FunctionExpression',
            params: assignment
                ? [{ type: 'Identifier', name: mapIdent(assignment) }]
                : [],
            body: {
                type: 'BlockStatement',
                body: [{
                    type: 'ReturnStatement',
                    argument: buildSequence(tail)
                }]
            }
        })
    }

    return stdlibMethod('keyword', args)
}

function stdlibMethod (methodName, args) {
    return {
        type: 'CallExpression',
        callee: {
            type: 'MemberExpression',
            computed: false,
            object: { type: 'Identifier', name: 'CRITTER' },
            property: { type: 'Identifier', name: methodName }
        },
        arguments: args
    }
}

function mapIdent (str) {
    return str.split('')
        .map((ch) => /[A-Za-z]/.test(ch) ? ch : `_${ch.charCodeAt(0)}`)
        .join('')
}

function compile (critterAST) {
    const jsAST = transform(critterAST)
    return escodegen.generate(jsAST)
}

module.exports = { compile }
