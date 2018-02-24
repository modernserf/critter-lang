import * as P from './combinators'

it('never', () => {
    expect((P.never.parse([]).ok)).toBe(false)
})

it('always', () => {
    expect(P.always(10).parse([]).value).toEqual(10)
    expect(P.always(10).parse([1000, 50]).value).toEqual(10)
})

it('start', () => {
    expect((P.start.parse([]).ok)).toBe(true)
    expect((P.start.parse([1, 2, 3, 4, 5]).ok)).toBe(true)
    expect((P.start.parse([1, 2, 3, 4, 5], 1).ok)).toBe(false)
})

it('end', () => {
    expect((P.end.parse([]).ok)).toBe(true)
    expect((P.end.parse([1, 2, 3], 3).ok)).toBe(true)
    expect((P.end.parse([1, 2, 3]).ok)).toBe(false)
})

it('any', () => {
    expect((P.any.parse([1]).ok)).toBe(true)
    expect((P.any.parse(['foo']).ok)).toBe(true)
    expect((P.any.parse([]).ok)).toBe(false)
})

it('match', () => {
    const p = P.match((x) => x > 10)
    expect(p.parse([50]))
        .toEqual({ ok: true, value: 50, nextIndex: 1 })
    expect((p.parse([5]).ok)).toBe(false)
})

it('eq', () => {
    const p = P.eq('foo')
    expect((p.parse(['foo', 'bar']).ok)).toBe(true)
    expect((p.parse(['baz']).ok)).toBe(false)
})

it('alt', () => {
    const p = P.alt(P.eq('foo'), P.eq('bar'))
    expect((p.parse(['foo', 'bar']).ok)).toBe(true)
    expect((p.parse(['bar', 'foo']).ok)).toBe(true)
    expect((p.parse(['baz']).ok)).toBe(false)
})

it('seq', () => {
    const p = P.seq(P.eq('foo'), P.eq('bar'))
    expect((p.parse(['foo', 'bar']).ok)).toBe(true)
    expect((p.parse(['bar', 'foo']).ok)).toBe(false)
    expect((p.parse(['foo']).ok)).toBe(false)
})

it('all', () => {
    const p = P.all(P.eq('foo'))
    expect(p.parse(['foo', 'foo', 'bar']))
        .toEqual({ ok: true, value: ['foo', 'foo'], nextIndex: 2 })
    expect(p.parse(['bar', 'foo']))
        .toEqual({ ok: true, value: [], nextIndex: 0 })
})

it('plus', () => {
    const p = P.plus(P.eq('foo'))
    expect(p.parse(['foo', 'foo', 'bar']))
        .toEqual({ ok: true, value: ['foo', 'foo'], nextIndex: 2 })
    expect((p.parse(['bar', 'foo']).ok)).toBe(false)
})

it('maybe', () => {
    const p = P.maybe(P.eq('foo'))
    expect(p.parse(['foo', 'bar']))
        .toEqual({ ok: true, value: ['foo'], nextIndex: 1 })
    expect(p.parse(['bar', 'foo']))
        .toEqual({ ok: true, value: [], nextIndex: 0 })
})

it('not', () => {
    const p = P.not(P.eq('foo'))
    expect((p.parse(['foo', 'bar']).ok)).toBe(false)
    expect(p.parse(['bar', 'foo']))
        .toEqual({ ok: true, value: null, nextIndex: 0 })
})

it('some', () => {
    const p = P.some(P.any, P.eq('foo'))
    expect(p.parse(['bar', 'foo', 'bar']))
        .toEqual({ ok: true, value: [['bar'], 'foo'], nextIndex: 2 })
})

it('chars', () => {
    const p = P.chars('foo')
    expect((p.parse(Array.from('foobar')).ok)).toBe(true)
    expect((p.parse(Array.from('FOO')).ok)).toBe(false)
})

it('altChars', () => {
    const p = P.altChars('abcde')
    expect((p.parse(['a']).ok)).toBe(true)
    expect((p.parse(['e']).ok)).toBe(true)
    expect((p.parse([]).ok)).toBe(false)
    expect((p.parse(['A']).ok)).toBe(false)
})

it('range', () => {
    const p = P.range('1', '5')
    expect((p.parse(['1']).ok)).toBe(true)
    expect((p.parse(['3']).ok)).toBe(true)
    expect((p.parse(['5']).ok)).toBe(true)
    expect((p.parse(['8']).ok)).toBe(false)
})

it('sepBy', () => {
    const p = P.sepBy(P.digit, P.chars(','))
    expect(p.parse(Array.from('1,2,3,4,5')).value)
        .toEqual(['1', '2', '3', '4', '5'])
    expect(p.parse(['1']).value).toEqual(['1'])
    expect(p.parse([]).value).toEqual([])

    const q = P.sepBy1(P.digit, P.chars(','))
    expect(q.parse(Array.from('1,2,3,4,5')).value)
        .toEqual(['1', '2', '3', '4', '5'])
    expect(q.parse(['1']).value).toEqual(['1'])
    expect(q.parse([]).ok).toBe(false)
})
