const generate = require('@babel/generator').default
const { pipe, Either, tagConstructors, match } = require('./util')

const JS = tagConstructors([
    ['Program', 'body'],
    ['NumericLiteral', 'value'],
    ['StringLiteral', 'value'],
    ['Identifier', 'name'],
    ['UnaryExpression', 'operator', 'argument', 'prefix'],
    ['ObjectExpression', 'properties'],
    ['CallExpression', 'callee', 'arguments'],
    ['FunctionExpression', 'params', 'body'],
    ['ArrowFunctionExpression', 'params', 'body'],
    ['BlockStatement', 'body'],
    ['ReturnStatement', 'argument'],
    ['ObjectProperty', 'key', 'value'],
    ['MemberExpression', 'object', 'property', 'computed']
])

const oneItem = (f, xs) => xs.length ? [f(xs)] : []

const transform = match({
    Program: ({ body }) =>
        JS.Program(oneItem(buildSequence, body)),
    Number: ({ value }) =>
        value >= 0
            ? JS.NumericLiteral(value)
            : JS.UnaryExpression('-', JS.NumericLiteral(-value), true),
    String: ({ value }) =>
        JS.StringLiteral(value),
    Ident: ({ value }) =>
        ident(value),
    Record: ({ args }) =>
        JS.ObjectExpression(args.map(transform)),
    FnCall: ({ callee, args }) =>
        JS.CallExpression(transform(callee), [
            JS.ObjectExpression(args.map(transform))
        ]),
    FnExp: ({ params, body }) =>
        JS.ArrowFunctionExpression(
            oneItem(
                (xs) => JS.ObjectExpression(xs.map(transform)),
                params),
            JS.BlockStatement([
                JS.ReturnStatement(buildSequence(body))
            ])
        ),
    Arg: ({ value }, index) =>
        JS.ObjectProperty(JS.StringLiteral(index), transform(value)),
    NamedArg: ({ key, value }) =>
        JS.ObjectProperty(JS.StringLiteral(key), transform(value)),
    FieldGet: ({ target, key }) =>
        runtimeMethod('getFields', [transform(target), JS.StringLiteral(key)]),
    Keyword: () => {
        throw new Error('Keyword must be compiled in function or program context')
    }
}, (tag) => {
    throw new Error(`Unknown AST node ${tag.type}`)
})

// converts @keyword blocks into continuation-passing style
const buildSequence = pipe([
    ([head, ...tail]) => [head, tail],
    Either.right,
    Either.filterm(([{ type }]) => type === 'Keyword'),
    // if not keyword
    Either.mapLeft(([head]) => transform(head)),
    // otherwise ...
    Either.fmap(([{ keyword, assignment, value }, tail]) => [
        transform(keyword),
        transform(value),
        JS.StringLiteral(assignment),
        tail.length
            ? JS.ArrowFunctionExpression(
                assignment
                    ? [ident(assignment)]
                    : [],
                JS.BlockStatement([
                    JS.ReturnStatement(buildSequence(tail))
                ])
            ) : null
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

const compile = pipe([transform, generate, (x) => x.code])

module.exports = { compile }
