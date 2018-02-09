const escodegen = require('escodegen')
const { pipe, Either, tagConstructors } = require('./util')

const JS = tagConstructors([
    ['Program', 'body'],
    ['Literal', 'value'],
    ['Identifier', 'name'],
    ['UnaryExpression', 'operator', 'argument', 'prefix'],
    ['ObjectExpression', 'properties'],
    ['CallExpression', 'callee', 'arguments'],
    ['FunctionExpression', 'params', 'body'],
    ['BlockStatement', 'body'],
    ['ReturnStatement', 'argument'],
    ['Property', 'kind', 'key', 'value'],
    ['MemberExpression', 'object', 'property', 'computed']
])

const match = (obj, onDefault) => ([type, ...args], index) =>
    obj[type] ? obj[type](args, index) : onDefault(type, args, index)

const oneItem = (f, xs) => xs.length ? [f(xs)] : []

const transform = match({
    Program: ([value]) =>
        JS.Program(oneItem(buildSequence, value)),
    Number: ([value]) =>
        value >= 0
            ? JS.Literal(value)
            : JS.UnaryExpression('-', JS.Literal(-value), true),
    String: ([value]) =>
        JS.Literal(value),
    Ident: ([value]) =>
        ident(value),
    Record: ([args]) =>
        JS.ObjectExpression(args.map(transform)),
    FnCall: ([callee, args]) =>
        JS.CallExpression(transform(callee), [
            JS.ObjectExpression(args.map(transform))
        ]),
    FnExp: ([params, body]) =>
        JS.FunctionExpression(
            oneItem(
                (xs) => JS.ObjectExpression(xs.map(transform)),
                params),
            JS.BlockStatement([
                JS.ReturnStatement(buildSequence(body))
            ])
        ),
    Arg: ([value], index) =>
        JS.Property('init', JS.Literal(index), transform(value)),
    NamedArg: ([key, value]) =>
        JS.Property('init', JS.Literal(key), transform(value)),
    FieldGet: ([target, key]) =>
        runtimeMethod('getFields', [transform(target), JS.Literal(key)]),
    Keyword: () => {
        throw new Error('Keyword must be compiled in function or program context')
    }
}, (type) => {
    throw new Error(`Unknown AST node ${type}`)
})

// converts @keyword blocks into continuation-passing style
const buildSequence = pipe([
    ([head, ...tail]) => [head, tail],
    Either.right,
    Either.filterm(([[type]]) => type === 'Keyword'),
    Either.mapLeft(([head]) => transform(head)),
    Either.fmap(([[_type, keyword, assignment, value], tail]) => [
        ident(keyword),
        transform(value),
        tail.length
            ? JS.FunctionExpression(
                assignment
                    ? [ident(assignment)]
                    : [],
                JS.BlockStatement([
                    JS.ReturnStatement(buildSequence(tail))
                ])
            ) : undefined
    ]),
    Either.fmap((args) => args.filter((x) => x)),
    Either.fmap((args) => runtimeMethod('keyword', args)),
    Either.unwrap
])

const runtimeMethod = (methodName, args) =>
    JS.CallExpression(
        JS.MemberExpression(
            JS.Identifier('CRITTER'),
            JS.Identifier(methodName),
            false
        ),
        args
    )

const reservedJSWords = new Set([
    'null', 'undefined', 'true', 'false',
    'break', 'case', 'catch', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'finally', 'for',
    'function', 'if', 'in', 'instanceof', 'new', 'return',
    'switch', 'this', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with',
    'async', 'await',
    'abstract', 'boolean', 'byte', 'char', 'class',
    'const', 'double', 'enum', 'export', 'extends',
    'final', 'float', 'goto', 'implements', 'import',
    'int', 'interface', 'let', 'long', 'native',
    'package', 'private', 'protected', 'public',
    'short', 'static', 'super', 'synchronized',
    'throws', 'transient', 'volatile', 'yield'
])

const escapeChars = (name) => name.split('')
    .map((ch) => /[A-Za-z]/.test(ch) ? ch : `_${ch.charCodeAt(0)}`)
    .join('')

const escapeReservedWords = (name) => reservedJSWords.has(name)
    ? `_${name}`
    : name

const ident = pipe([escapeChars, escapeReservedWords, JS.Identifier])

const compile = pipe([transform, escodegen.generate])

module.exports = { compile }
