import {
    ok, error, ops, either, parse, never, any, matchOne, eq, not, both,
    alts, seqs, start, end, all, flatMapResult, wrappedWith, sepBy,
    view, set, lensProp, over,
} from './goal'

describe('running goals', () => {
    it('runs `seqs` like a pipeline', () => {
        const res = seqs(
            (x) => ok(x + 1),
            (x) => ok(x * 2),
            (x) => ops.lt(10, x).else(() => ok(10)),
        )
        expect(res(20).value).toEqual(42)
        expect(res(3).value).toEqual(10)
    })

    it('runs `either` like a conditional', () => {
        const res = either(
            (x) => ops.eq(x % 2, 0).then(() => ok('even')),
            () => ok('odd')
        )
        expect(res(5).value).toEqual('odd')
        expect(res(4).value).toEqual('even')
    })

    // NOTE: this is somewhat ungainly.
    // is there a compelling case for an explicit "fail-to-this-point"
    it('simulates commitment by wrapping failure in success', () => {
        const res = (value) => [
            (x) => ops.eq(x % 2, 0).then(() => ok('even')),
            (x) => ops.lt(10, x).then(() =>
                ok(ops.eq(x % 3, 0)
                    .then(() => ok('big odd 3'))
                    .else(() => error('failed odd'))
                )),
            (x) => ok('small odd'),
        ].reduce(either)(value).try()

        expect(res(2).value).toEqual('even')
        expect(res(99).value).toEqual('big odd 3')
        expect(res(7).value).toEqual('small odd')
        expect(res(17).value).toEqual('failed odd')
    })

    it('runs `all` like a while loop', () => {
        const res = all(seqs(
            // while 100 >= x
            (x) => ops.gte(100, x),
            // double x
            (x) => ok(x * 2),
        ))(ok(1))
        expect(res.value).toEqual(128)
    })
})

describe('parser combinators', () => {
    it('never', () => {
        expect(parse(never, []).value.message).toEqual('never')
    })

    it('any', () => {
        expect(parse(any, [1]).value).toEqual([1])
    })
    it('matchOne', () => {
        const gt = (r) => (l) => l > r ? ok(`${l} > ${r}`) : error(`${l} <= ${r}`)
        expect(parse(matchOne(gt(10)), [50]).value).toEqual(['50 > 10'])
        expect(parse(matchOne(gt(10)), [5]).value.message).toEqual('5 <= 10')
    })
    it('eq', () => {
        expect(parse(eq(10), [10]).value).toEqual([10])
        expect(parse(eq(20), [10]).value.message).toEqual(['not_eq', 20, 10])
    })
    it('alts', () => {
        const parser = alts(eq(10), eq(20))
        expect(parse(parser, [10]).value).toEqual([10])
        expect(parse(parser, [20]).value).toEqual([20])
        expect(parse(parser, [15]).value.message)
            .toEqual([['not_eq', 10, 15], ['not_eq', 20, 15]])
    })
    it('seqs', () => {
        const parser = seqs(eq(10), eq(20))
        expect(parse(parser, [10, 20]).value).toEqual([10, 20])
        expect(parse(parser, [20, 10]).value.message).toEqual(['not_eq', 10, 20])
        expect(parse(parser, [10, 10]).value.message).toEqual(['not_eq', 20, 10])
        expect(parse(parser, [10]).value.message).toEqual('unexpected_end_of_input')
    })
    it('start', () => {
        expect(parse(start, [10, 20]).value).toEqual([])
        expect(parse(seqs(eq(10), start), [10, 20]).value.message)
            .toEqual('expected_start_of_input')
    })
    it('end', () => {
        expect(parse(end, []).value).toEqual([])
        expect(parse(end, [10]).value.message).toEqual('expected_end_of_input')
        expect(parse(seqs(eq(10), end), [10]).value).toEqual([10])
    })
    it('all', () => {
        const parser = all(matchOne((x) => x > 10 ? ok(x) : error(`${x} <= 10`)))
        expect(parse(parser, [100, 50, 20, 10, 5]).value).toEqual([100, 50, 20])
        expect(parse(parser, [1, 2, 3, 4, 5]).value).toEqual([])
    })
    it('wrappedWith', () => {
        const letter = matchOne((x) =>
            /[A-Za-z]/.test(x) ? ok(x) : error(['not_a_letter', x])
        )
        const parser = wrappedWith(all(letter), eq('('), eq(')'))
        expect(parse(parser, Array.from('(foo) 123')).value)
            .toEqual(['f', 'o', 'o'])
        expect(parse(parser, Array.from('() 123')).value)
            .toEqual([])
        expect(parse(parser, Array.from('(123) foo')).value.message)
            .toEqual(['not_eq', ')', '1'])
    })
    it('sepBy', () => {
        const notComma = flatMapResult(
            all(seqs(not(eq(',')), any)),
            (xs) => xs.join(''))
        const parser = sepBy(notComma, eq(','))
        expect(parse(parser, Array.from('foo,bar,baz')).value).toEqual(['foo', 'bar', 'baz'])
        expect(parse(parser, Array.from('foo bar baz')).value).toEqual(['foo bar baz'])
    })
})

describe('lenses', () => {
    it('uses lenses', () => {
        const x = { foo: { bar: { baz: 2 } } }
        const foo = lensProp('foo')
        expect(view(x, foo).value).toEqual({ bar: { baz: 2 } })
        expect(set(x, foo, { bar: 3 }).value).toEqual({ foo: { bar: 3 } })
    })

    it('seq lenses', () => {
        const x = { foo: { bar: { baz: 2 } } }
        const p = seqs(lensProp('foo'), lensProp('bar'))
        expect(view(x, p).value).toEqual({ baz: 2 })
        expect(set(x, p, { baz: 3 }).value).toEqual({ foo: { bar: { baz: 3 } } })
    })

    it('sets either foo or bar', () => {
        const inc = (x) => x + 1
        const p = either(lensProp('foo'), lensProp('bar'))
        expect(over({ foo: 1, bar: 2 }, p, inc).value)
            .toEqual({ foo: 2, bar: 2 })
        expect(over({ bar: 2 }, p, inc).value)
            .toEqual({ bar: 3 })
        expect(over({ baz: 2 }, p, inc).value)
            .toEqual([['missing_field', 'foo'], ['missing_field', 'bar']])
    })

    it('sets bar if foo lens succeeds', () => {
        const inc = (x) => x + 1
        const p = both(lensProp('foo'), lensProp('bar'))
        expect(over({ foo: 1, bar: 2 }, p, inc).value)
            .toEqual({ foo: 1, bar: 3 })
        expect(over({ bar: 2 }, p, inc).value)
            .toEqual(['missing_field', 'foo'])
    })
})
