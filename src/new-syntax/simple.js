import { tagConstructors } from '../util'

export const tags = tagConstructors([
    ['Program', 'value'],
    ['KwAssignment', 'keyword', 'binding', 'value'],
    ['KwStatement', 'keyword', 'value'],

    ['OpExpr', 'operator', 'right', 'left'],
    ['DotExpr', 'callee', 'left'],

    ['FnCall', 'args', 'target'],
    ['FieldGet', 'key', 'target'],

    ['FnExp', 'params', 'body'],

    ['Record', 'args'],

    ['NamedArg', 'key', 'value'],
    ['RestArgs', 'args'],
    ['PunArg', 'value'],
    ['Arg', 'value'],

    ['Op', 'value'],
    ['Ident', 'value'],
    ['TaggedStr', 'value'],
    ['QuotedStr', 'value'],
    ['HexNum', 'value'],
    ['DecNum', 'value'],
])

export const Language = createLanguage({
    Program: (p) =>
        seq(_, p.Block.collect(), _, end).tag(tags.Program),
    Block: (p) => alt(
        seq(p.Statement, ___, p.Block),
        p.Statement,
        p.OpExpr
    ),
    Statement: (p) => alt(
        seq(t`@`, p.DotExpr, __, p.Binding, __, t`:=`, __, p.OpExpr)
            .tag(tags.KwAssignment),
        seq(t`@`, p.DotExpr, __, p.OpExpr).tag(tags.KwStatement),
    ),
    // enforce single operator in lint phase
    OpExpr: (p) =>
        seq(p.DotExpr,
            seq(__, p.Op, __, p.OpExpr).tag(tags.OpExpr).star()
        ).fold((left, expr) => ({ ...expr, left })),
    DotExpr: (p) =>
        seq(p.CallExpr,
            seq(_, t`.`, p.DotExpr).tag(tags.DotExpr).star()
        ).fold((left, expr) => ({ ...expr, left })),
    CallExpr: (p) =>
        seq(p.Expr, p.Call.star())
            .fold((target, expr) => ({ ...expr, target })),
    Call: (p) => alt(
        seq(t`(`, _, p.Arg.sepBy(__).collect(), _, t`)`).tag(tags.FnCall),
        seq(_, t`::`, p.Key).tag(tags.FieldGet)
    ),
    Expr: (p) => alt(
        seq(p.FnHead, p.FnBody).tag(tags.FnExp),
        p.FnBody.tag((body) => tags.FnExp([], body)),
        seq(t`[`, _, p.Arg.sepBy(__).collect(), _, t`]`).tag(tags.Record),
        seq(t`(`, p.Op, t`)`),
        seq(t`(`, _, p.OpExpr, _, t`)`),
        p.Str,
        p.Num,
        p.Ident
    ),
    FnHead: (p) => seq(t`(`, _, p.BindArg.sepBy(__).collect(), _, t`)`),
    FnBody: (p) => seq(t`{`, _, p.Block.collect(), _, t`}`),
    Binding: (p) => alt(
        seq(t`[`, _, p.BindArg.sepBy(__), _, t`]`),
        seq(t`(`, p.Op, t`)`),
        seq(t`_`, p.Key.maybe()),
        p.Str,
        p.Num,
        p.Ident
    ),
    // enforce unique keys in lint phase
    Arg: (p) => alt(
        seq(p.Key, t`:`, __, p.OpExpr).tag(tags.NamedArg),
        seq(t`:|`, __, p.Arg.sepBy(__).collect()).tag(tags.RestArgs),
        p.OpExpr.tag(tags.Arg)
    ),
    BindArg: (p) => alt(
        seq(p.Key, t`:`, __, p.Binding).tag(tags.NamedArg),
        seq(t`::`, p.Ident).tag(tags.PunArg),
        seq(t`:|`, __, p.BindArg.sepBy(__).collect()).tag(tags.RestArgs),
        p.Binding.tag(tags.Arg)
    ),
    Key: (p) => alt(
        p.Num,
        p.Ident
    ),
    SpecialChars: () =>
        a`:."#@[](){} `.notOne(),
    Op: (p) =>
        seq(a`^~!$%&*-+=|\/?<>,`, p.SpecialChars.star()).join().tag(tags.Op),
    IdentStr: (p) =>
        seq(regex(/[A-Za-z]/), p.SpecialChars.star()).join(),
    Ident: (p) =>
        p.IdentStr.tag(tags.Ident),
    Str: (p) => alt(
        seq(t`#`, p.IdentStr).tag(tags.TaggedStr),
        seq(t`"`,
            alt(c`\"`.flatMap(() => [`"`]), regex(/[^"]/)).star().join(),
            t`"`
        ).tag(tags.QuotedStr)
    ),
    Num: () => alt(
        seq(c`0x`, regex(/[a-fA-F0-9_]/).plus()).join().tag(tags.HexNum),
        seq(c`-`.maybe(),
            regex(/[0-9_]/).plus(),
            seq(c`.`, regex(/[0-9_]/).plus()).maybe()
        ).join().tag(tags.DecNum),
    ),
})

const ok = (value) => ({
    ok: true,
    value,
    then: (f) => f(value),
    else: () => ok(value),
    unwrap: () => value,
})

const error = (value) => ({
    ok: false,
    value,
    then: () => error(value),
    else: (f) => f(value),
    unwrap: () => { throw new Error(value) },
})

class Parser {
    constructor (parse) {
        this.parse = parse
    }
    seq (next) {
        return new Parser((state) =>
            this.parse(state).then((nextState) =>
                next.parse(nextState)))
    }
    alt (next) {
        return new Parser((state) =>
            this.parse(state).else(() => next.parse(state)))
    }
    star () {
        return new Parser((state) => {
            while (true) {
                const res = this.parse(state)
                if (!res.ok) { return ok(state) }
                state = res.value
            }
        })
    }
    plus () {
        return this.seq(this.star())
    }
    maybe () {
        return this.alt(new Parser((state) => ok(state)))
    }
    sepBy (other) {
        return this.seq(other.seq(this).star()).maybe()
    }
    notOne () {
        return new Parser((state) => state.index >= state.input.length
            ? error('end_of_input')
            : this.parse(state).ok
                ? error('should_not_match')
                : add(state, state.input[state.index]))
    }
    flatMap (f) {
        return new Parser((state) =>
            this.parse({ ...state, result: [] }).then((next) => ok({
                ...next,
                result: state.result.concat(f(next.result)),
            }))
        )
    }
    collect () {
        return this.flatMap((xs) => [xs])
    }
    tag (fn) {
        return this.flatMap((value) => {
            const notLit = (x) => x.type !== 'Lit'
            const semanticValues = value.filter(notLit)
                .map((x) => Array.isArray(x) ? x.filter(notLit) : x)
            const obj = fn(...semanticValues)
            obj.rawValue = value
            return obj
        })
    }
    lit () {
        return this.flatMap((value) => [{ type: 'Lit', rawValue: value }])
    }
    join (j = '') {
        return this.flatMap((value) => value.join(j))
    }
    fold (f) {
        return this.flatMap(([h, ...t]) =>
            [t.reduce((l, r) => ({
                ...f(l, r),
                rawValue: l.rawValue.concat(r.rawValue),
            }), h)])
    }
}

const add = ({ input, index, result }, value) =>
    ok({ input, index: index + 1, result: result.concat(value) })
const seq = (x, ...xs) => xs.length ? xs.reduce((l, r) => l.seq(r), x) : x
const alt = (x, ...xs) => xs.length ? xs.reduce((l, r) => l.alt(r), x) : x
const test = (f) => new Parser(({ input, index, result }) =>
    index >= input.length
        ? error('end_of_input')
        : f(input[index])
            ? add({ input, index, result }, input[index])
            : error('no_match'))
const end = new Parser(({ input, index, result }) =>
    index >= input.length
        ? ok({ input, index, result })
        : error('expected_end_of_input'))

const regex = (re) => test((value) => re.test(value))
const char = (ch) => test((value) => value === ch)
const chars = (chars) => seq(...Array.from(chars).map(char))
const altChars = (chars) => alt(...Array.from(chars).map(char))

function createLanguage (defs) {
    return () =>
        Object.keys(defs).reduce((l, key) => {
            let memo = null
            l[key] = new Parser((state) => {
                if (memo) { return memo.parse(state) }
                memo = defs[key](l)
                return memo.parse(state)
            })
            return l
        }, {})
}

export function parse (str) {
    const state = { input: Array.from(str), index: 0, result: [] }
    return Language().Program.parse(state)
        .then(({ result }) => ok(result[0])).unwrap()
}

function c (strings) { return chars(strings.raw[0]).join() }
function t (strings) { return chars(strings.raw[0]).join().lit() }
function a (strings) { return altChars(strings.raw[0]) }

const Line = regex(/\n/).join()
const Comment = seq(t`;`, Line.notOne().star()).join().tag('Comment')
const Whitespace = regex(/\s/).join()
const __ = alt(Comment, Whitespace, Line).plus().lit()
const _ = alt(Comment, Whitespace, Line).star().lit()
const ___ = seq(alt(Whitespace, Comment).star(), Line, _).lit()

export function print (tag) {
    if (typeof tag === 'string') { return escape(tag) }
    if (Array.isArray(tag)) { return tag.map(print).join('') }
    const { type, rawValue } = tag
    if (type === 'Lit') { return print(rawValue) }
    return `<span class='language-${type}'>${print(rawValue)}</span>`
}

const esc = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
function escape (str) {
    return Array.from(str).map((ch) => esc[ch] || ch).join('')
}
