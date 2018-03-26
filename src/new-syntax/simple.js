const Language = createLanguage({
    Program: (p) =>
        seq(_, p.Block, _),
    Block: (p) => alt(
        seq(p.Statement, ___, p.Block),
        p.Statement,
        p.OpExpr
    ),
    Statement: (p) => alt(
        seq(t`@`, p.DotExpr, __, p.Binding, __, t`:=`, p.OpExpr),
        seq(t`@`, p.DotExpr, __, p.OpExpr),
    ),
    OpExpr: (p) =>
        seq(p.DotExpr, seq(__, p.Op, __, p.OpExpr).star()),
    DotCalls: (p) =>
        seq(_, t`.`, p.Ident, p.Call.star()),
    DotExpr: (p) =>
        seq(p.Expr, p.Call.star(), p.DotCalls.star()),
    Call: (p) => alt(
        seq(t`(`, _, p.Arg.sepBy(__), _, t`)`),
        seq(_, t`::`, p.Key)
    ),
    Expr: (p) => alt(
        seq(t`(`, _, p.Binding.sepBy(__), _, t`){`, _, p.Block, _, t`}`),
        seq(t`{`, _, p.Block, _, t`}`),
        seq(t`[`.drop(), _, p.Arg.sepBy(__), _, t`]`.drop()).tag('Record'),
        seq(t`(`, p.Op, t`)`),
        seq(t`(`, _, p.OpExpr, _, t`)`),
        p.Str,
        p.Num,
        p.Ident
    ),
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
        seq(p.Key, t`:`, __, p.OpExpr).tag('NamedArg'),
        t`:|`.tag('RestArgs'),
        p.OpExpr.tag('Arg')
    ),
    BindArg: (p) => alt(
        seq(p.Key, t`:`, __, p.Binding),
        seq(t`::`, p.Ident),
        t`:|`,
        p.Binding
    ),
    Key: (p) => alt(
        p.Num,
        p.Ident
    ),
    SpecialChars: () =>
        a`:."#@[](){} `.notOne(),
    Op: (p) =>
        seq(a`^~!$%&*-+=|\/?<>,`, p.SpecialChars.star()).join(),
    IdentStr: (p) =>
        seq(regex(/[A-Za-z]/), p.SpecialChars.star()).join(),
    Ident: (p) =>
        p.IdentStr.tag('Ident'),
    Str: (p) => alt(
        seq(t`#`.drop(), p.IdentStr).tag('TaggedStr'),
        seq(t`"`.drop(),
            alt(t`\"`.flatMap(() => [`"`]), regex(/[^"]/)).star(),
            t`"`.drop()
        ).join().tag('QuotedStr')
    ),
    Num: () => alt(
        seq(t`0x`, regex(/[a-fA-F0-9_]/).plus()).join().tag('HexNum'),
        seq(t`-`.maybe(),
            regex(/[0-9_]/).plus(),
            seq(t`.`, regex(/[0-9_]/).plus()).maybe()
        ).join().tag('DecNum'),
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
    tag (type) {
        return this.flatMap((value) => [{ type, value }])
    }
    join (j = '') {
        return this.flatMap((value) => value.join(j))
    }
    drop () {
        return this.flatMap(() => [])
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

export function tokenize (str) {
    const state = { input: Array.from(str), index: 0, result: [] }
    return Language().Program.parse(state)
        .then(({ result }) => ok(result)).unwrap()
}

function t (strings) { return chars(strings.raw[0]) }
function a (strings) { return altChars(strings.raw[0]) }

const Line = regex(/\n/).join()
const Comment = seq(t`;`.drop(), Line.notOne().star()).join().tag('Comment')
const Whitespace = regex(/\s/).join()
const __ = alt(Comment, Whitespace, Line).plus()
const _ = alt(Comment, Whitespace, Line).star()
const ___ = seq(alt(Whitespace, Comment).star(), Line, _)
