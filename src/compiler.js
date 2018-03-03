import { pipe, match } from './util'

export const compile = match({
    Program: ({ body }) => body.map(compileBody).join(';\n'),
    HexNumber: ({ value }) => value.toString(),
    DecNumber: ({ value }) => value.toString(),
    TaggedString: ({ value }) => quote(value),
    QuotedString: ({ value }) => quote(value),
    Ident: ({ value }) => ident(value),
    Record: ({ args }) => obj(args),
    FnCall: ({ callee, args }) =>
        `${compile(callee)}${obj(args)}`,
    FnExp: ({ params, body }) => {
        const head = params.length ? obj(params) : `()`
        const tail = body.length ? compile(body[0]) : `{}`
        return `${head} => ${tail}`
    },
    Arg: ({ value }, index) =>
        `${index}: ${compile(value)}`,
    NamedArg: ({ key, value }) =>
        `${quote(key)}: ${compile(value)}`,
    FieldGet: ({ target, key }) =>
        `${compile(target)}[${
            typeof key === 'string' ? quote(key) : key
        }]`,
    KeywordStatement: () => {
        throw new Error('Keyword not supported, compiler expects expanded AST')
    },
    DotFnCall: () => {
        throw new Error('DotFnCall not supported, compiler expects expanded AST')
    },
}, (tag) => {
    throw new Error(`Unknown AST node ${tag.type}`)
})

const compileBody = match({
    KeywordStatement: ({ keyword, value }) =>
        `${compile(keyword)}({ 0: ${compile(value)} })`,
    KeywordAssignment: ({ keyword, assignment, value }) =>
        `const ${compile(assignment)} = ${
            compile(keyword)}({ 0: ${compile(value)} })`,
}, compile)

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
    'throws', 'transient', 'volatile', 'yield',
])

const escapeChars = (name) => name.split('')
    .map((ch) => /[A-Za-z]/.test(ch) ? ch : `_${ch.charCodeAt(0)}`)
    .join('')

const escapeReservedWords = (name) => reservedJSWords.has(name)
    ? `_${name}`
    : name

const ident = pipe([escapeChars, escapeReservedWords])

const quote = (s) => `"${s.replace(/"/g, `\\"`).replace(/\n/g, `\\n`)}"`

const obj = (fields) => `({ ${fields.map(compile).join(', ')} })`
