const test = require('tape')
const P = require('./combinators')

test('never', (t) => {
    t.false(P.never.parse([]).ok)
    t.end()
})

test('always', (t) => {
    t.equals(P.always(10).parse([]).value, 10)
    t.equals(P.always(10).parse([1000, 50]).value, 10)
    t.end()
})

test('start', (t) => {
    t.true(P.start.parse([]).ok)
    t.true(P.start.parse([1, 2, 3, 4, 5]).ok)
    t.false(P.start.parse([1, 2, 3, 4, 5], 1).ok)
    t.end()
})

test('end', (t) => {
    t.true(P.end.parse([]).ok)
    t.true(P.end.parse([1, 2, 3], 3).ok)
    t.false(P.end.parse([1, 2, 3]).ok)
    t.end()
})

test('any', (t) => {
    t.true(P.any.parse([1]).ok)
    t.true(P.any.parse(['foo']).ok)
    t.false(P.any.parse([]).ok)
    t.end()
})

test('match', (t) => {
    const p = P.match((x) => x > 10)
    t.deepEquals(
        p.parse([50]),
        { ok: true, value: 50, nextIndex: 1 }
    )
    t.false(p.parse([5]).ok)
    t.end()
})

test('eq', (t) => {
    const p = P.eq('foo')
    t.true(p.parse(['foo', 'bar']).ok)
    t.false(p.parse(['baz']).ok)
    t.end()
})

test('alt', (t) => {
    const p = P.alt(P.eq('foo'), P.eq('bar'))
    t.true(p.parse(['foo', 'bar']).ok)
    t.true(p.parse(['bar', 'foo']).ok)
    t.false(p.parse(['baz']).ok)
    t.end()
})

test('seq', (t) => {
    const p = P.seq(P.eq('foo'), P.eq('bar'))
    t.true(p.parse(['foo', 'bar']).ok)
    t.false(p.parse(['bar', 'foo']).ok)
    t.false(p.parse(['foo']).ok)
    t.end()
})

test('all', (t) => {
    const p = P.all(P.eq('foo'))
    t.deepEquals(
        p.parse(['foo', 'foo', 'bar']),
        { ok: true, value: ['foo', 'foo'], nextIndex: 2 }
    )
    t.deepEquals(
        p.parse(['bar', 'foo']),
        { ok: true, value: [], nextIndex: 0 }
    )
    t.end()
})

test('plus', (t) => {
    const p = P.plus(P.eq('foo'))
    t.deepEquals(
        p.parse(['foo', 'foo', 'bar']),
        { ok: true, value: ['foo', 'foo'], nextIndex: 2 }
    )
    t.false(p.parse(['bar', 'foo']).ok)
    t.end()
})

test('maybe', (t) => {
    const p = P.maybe(P.eq('foo'))
    t.deepEquals(
        p.parse(['foo', 'bar']),
        { ok: true, value: ['foo'], nextIndex: 1 }
    )
    t.deepEquals(
        p.parse(['bar', 'foo']),
        { ok: true, value: [], nextIndex: 0 }
    )
    t.end()
})

test('not', (t) => {
    const p = P.not(P.eq('foo'))
    t.false(p.parse(['foo', 'bar']).ok)
    t.deepEquals(
        p.parse(['bar', 'foo']),
        { ok: true, value: null, nextIndex: 0 }
    )
    t.end()
})

test('some', (t) => {
    const p = P.some(P.any, P.eq('foo'))
    t.deepEquals(
        p.parse(['bar', 'foo', 'bar']),
        { ok: true, value: [['bar'], 'foo'], nextIndex: 2 }
    )
    t.end()
})

test('chars', (t) => {
    const p = P.chars('foo')
    t.true(p.parse(Array.from('foobar')).ok)
    t.false(p.parse(Array.from('FOO')).ok)
    t.end()
})

test('altChars', (t) => {
    const p = P.altChars('abcde')
    t.true(p.parse(['a']).ok)
    t.true(p.parse(['e']).ok)
    t.false(p.parse([]).ok)
    t.false(p.parse(['A']).ok)
    t.end()
})

test('range', (t) => {
    const p = P.range('1', '5')
    t.true(p.parse(['1']).ok)
    t.true(p.parse(['3']).ok)
    t.true(p.parse(['5']).ok)
    t.false(p.parse(['8']).ok)
    t.end()
})
