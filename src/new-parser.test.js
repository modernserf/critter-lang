import { parse, tags } from './new-parser'
const {
    DecNumber, HexNumber, QuotedString, TaggedString, Ident,
    Whitespace, Newline,
    Record, Arg, NamedArg, FieldGet,
    FnCall, FnExp, DotFnCall,
    KeywordStatement, KeywordAssignment,
    RecordWithMissingEnd, UnmatchedRecordEnd,
    FnCallWithMissingEnd, UnmatchedParen,
    FnExpWithMissingEnd, FnHeadWithMissingEnd, UnmatchedCurly,
    AmbiguousSequence,
} = tags

const expr = (str) => parse(str, 'expression')

it('parses a number', () => {
    expect(expr('123'))
        .toMatchObject(DecNumber('123'))
    expect(expr('-123.45'))
        .toMatchObject(DecNumber('-123.45'))
    expect(expr('0xCAFEBABE'))
        .toMatchObject(HexNumber('0xCAFEBABE'))
})

it('parses a quoted string', () => {
    expect(expr('"foo bar baz"'))
        .toMatchObject(QuotedString('foo bar baz'))
    expect(expr('"foo bar \\"quoted\\" baz"'))
        .toMatchObject(QuotedString('foo bar "quoted" baz'))
})

it('parses a tagged string', () => {
    expect(expr('#foo'))
        .toMatchObject(TaggedString('foo'))
})

it('parses an identifier', () => {
    expect(expr('foo'))
        .toMatchObject(Ident('foo'))
    expect(expr('++=>'))
        .toMatchObject(Ident('++=>'))
})

it('parses a valid record', () => {
    expect(expr('[]'))
        .toMatchObject(Record([]))
    expect(expr('[   ]'))
        .toMatchObject(Record([Whitespace('   ')]))
    expect(expr('[1]'))
        .toMatchObject(Record([Arg(DecNumber('1'))]))
    expect(expr('[ 1 ]'))
        .toMatchObject(Record([
            Whitespace(' '),
            Arg(DecNumber('1')),
            Whitespace(' '),
        ]))
    expect(
        expr('[bar ["baz"] 123.45]')).toMatchObject(
        Record([
            Arg(Ident('bar')),
            Whitespace(' '),
            Arg(Record([ Arg(QuotedString('baz')) ])),
            Whitespace(' '),
            Arg(DecNumber('123.45')),
        ])
    )

    expect(
        expr('[bar  "baz" quux: 123.45]')).toMatchObject(
        Record([
            Arg(Ident('bar')),
            Whitespace('  '),
            Arg(QuotedString('baz')),
            Whitespace(' '),
            NamedArg(Ident('quux'), [Whitespace(' '), DecNumber('123.45')]),
        ])
    )
})

it('parses an invalid record', () => {
    expect(expr('[ foo 1'))
        .toMatchObject(RecordWithMissingEnd([
            Whitespace(' '),
            Arg(Ident('foo')),
            Whitespace(' '),
            Arg(DecNumber('1')),
        ]))

    expect(expr(']'))
        .toMatchObject(UnmatchedRecordEnd())
})

it('parses field access on an identifier', () => {
    expect(
        expr('[#foo]::bar::0')).toMatchObject(
        FieldGet(
            FieldGet(
                Record([Arg(TaggedString('foo'))]),
                [Ident('bar')]),
            [DecNumber('0')])
    )
    expect(
        expr('[#foo]   ::bar    ::0')).toMatchObject(
        FieldGet(
            FieldGet(
                Record([Arg(TaggedString('foo'))]),
                [Whitespace('   '), Ident('bar')]),
            [Whitespace('    '), DecNumber('0')])
    )
})

it('parses valid function calls', () => {
    expect(expr('foo()'))
        .toMatchObject(FnCall(Ident('foo'), []))

    expect(expr('foo(bar "baz" 123.45)'))
        .toMatchObject(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Whitespace(' '),
            Arg(QuotedString('baz')),
            Whitespace(' '),
            Arg(DecNumber('123.45')),
        ]))

    expect(expr('foo(bar  "baz"   quux:  123.45)'))
        .toMatchObject(FnCall(Ident('foo'), [
            Arg(Ident('bar')),
            Whitespace('  '),
            Arg(QuotedString('baz')),
            Whitespace('   '),
            NamedArg(Ident('quux'), [Whitespace('  '), DecNumber('123.45')]),
        ]))
})

it('parses an invalid function call', () => {
    expect(expr('foo(bar 1'))
        .toMatchObject(FnCallWithMissingEnd(Ident('foo'), [
            Arg(Ident('bar')),
            Whitespace(' '),
            Arg(DecNumber('1')),
        ]))
    expect(expr('foo(bar)(baz'))
        .toMatchObject(FnCallWithMissingEnd(
            FnCall(Ident('foo'), [Arg(Ident('bar'))]),
            [Arg(Ident('baz'))]
        ))

    expect(expr(')'))
        .toMatchObject(UnmatchedParen())
})

it('parses a valid fn definition', () => {
    expect(expr('{ foo }'))
        .toMatchObject(FnExp([], [
            Whitespace(' '), Ident('foo'), Whitespace(' '),
        ]))
    expect(expr('(x){ x }'))
        .toMatchObject(FnExp([Arg(Ident('x'))], [
            Whitespace(' '), Ident('x'), Whitespace(' '),
        ]))
    expect(expr(`
(x){
    foo
    bar
}`.trim())).toMatchObject(FnExp([Arg(Ident('x'))], [
        Newline(),
        Whitespace('    '), Ident('foo'), Newline(),
        Whitespace('    '), Ident('bar'), Newline(),
    ]))
})

it('parses invalid fn definitions', () => {
    expect(expr('{ foo'))
        .toMatchObject(FnExpWithMissingEnd([], [
            Whitespace(' '), Ident('foo'),
        ]))
    expect(expr('(foo bar'))
        .toMatchObject(FnHeadWithMissingEnd([
            Arg(Ident('foo')),
            Whitespace(' '),
            Arg(Ident('bar')),
        ]))
    expect(expr('}'))
        .toMatchObject(UnmatchedCurly())
    expect(expr(`(x){ x x }`))
        .toMatchObject(FnExp([Arg(Ident('x'))], [
            Whitespace(' '),
            AmbiguousSequence([Ident('x'), Whitespace(' '), Ident('x')]),
            Whitespace(' '),
        ]))
    expect(expr(`(x){ }`))
        .toMatchObject(FnExp([Arg(Ident('x'))], [Whitespace(' ')]))
})

it('parses valid dot fn calls', () => {
    expect(expr(`foo.bar`))
        .toMatchObject(DotFnCall(Ident('bar'), [Ident('foo')], []))
    expect(expr(`foo .bar(baz quux: 10)(#xyzzy)`))
        .toMatchObject(FnCall(
            DotFnCall(Ident('bar'),
                [Ident('foo'), Whitespace(' ')],
                [
                    Arg(Ident('baz')),
                    Whitespace(' '),
                    NamedArg(Ident('quux'),
                        [Whitespace(' '), DecNumber('10')]),
                ]),
            [Arg(TaggedString('xyzzy'))]
        ))
})

it('keyword statement', () => {
    expect(expr('@foo bar(baz)'))
        .toMatchObject(KeywordStatement(Ident('foo'),
            [Whitespace(' '), FnCall(Ident('bar'), [Arg(Ident('baz'))])])
        )
})

it('keyword assignment', () => {
    expect(
        expr('@foo(quux) x := bar(baz)')).toMatchObject(
        KeywordAssignment(
            FnCall(Ident('foo'), [Arg(Ident('quux'))]),
            [Whitespace(' '), Ident('x'), Whitespace(' ')],
            [Whitespace(' '), FnCall(Ident('bar'), [
                Arg(Ident('baz')),
            ])])
    )
})

it('precedence', () => {
    expect(
        expr('@foo::bar(baz).quux::snerf x := xyzzy()')).toMatchObject(
        KeywordAssignment(
            DotFnCall(FieldGet(Ident('quux'), [Ident('snerf')]),
                [FnCall(FieldGet(Ident('foo'), [Ident('bar')]), [
                    Arg(Ident('baz')),
                ])],
                []),
            [Whitespace(' '), Ident('x'), Whitespace(' ')],
            [Whitespace(' '), FnCall(Ident('xyzzy'), [])]
        )
    )
})
