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
        return ident(value)
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
            { type: 'Literal', value: meta }
        ])
    case 'Program':
        return {
            type: 'Program',
            body: value.length
                ? [buildSequence(value)]
                : []
        }
    case 'Keyword':
        throw new Error('Keyword must be compiled in function or program context')
    default:
        throw new Error(`Unknown AST node ${type}`)
    }
}

// converts @keyword blocks into continuation-passing style
function buildSequence ([head, ...tail]) {
    const [type, keyword, assignment, value] = head

    if (type !== 'Keyword') {
        return transform(head)
    }

    const args = [
        ident(keyword),
        transform(value)
    ]

    if (tail.length) {
        args.push({
            type: 'FunctionExpression',
            params: assignment
                ? [ident(assignment)]
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

const reservedJSWords = new Set([
    'null', 'undefined', 'true', 'false',
    'break', 'case', 'catch', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'finally', 'for',
    'function', 'if', 'in', 'instanceof', 'new', 'return',
    'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with',
    'abstract', 'boolean', 'byte', 'char', 'class',
    'const', 'double', 'enum', 'export', 'extends',
    'final', 'float', 'goto', 'implements', 'import',
    'int', 'interface', 'let', 'long', 'native',
    'package', 'private', 'protected', 'public',
    'short', 'static', 'super', 'synchronized',
    'throws', 'transient', 'volatile', 'yield'
])

function ident (name) {
    const escapedName = name.split('')
        .map((ch) => /[A-Za-z]/.test(ch) ? ch : `_${ch.charCodeAt(0)}`)
        .join('')

    const withReserved = reservedJSWords.has(escapedName)
        ? `_${escapedName}`
        : escapedName

    return {
        type: 'Identifier',
        name: withReserved
    }
}

function compile (critterAST) {
    const jsAST = transform(critterAST)
    return escodegen.generate(jsAST)
}

module.exports = { compile }
