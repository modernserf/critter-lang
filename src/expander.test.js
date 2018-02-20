import { expand } from './expander'
import { parse } from './parser'

it('is idempotent on simple values', () => {
    const x = parse('123')
    expect(expand(x)).toEqual(x)
    const y = parse('#foo')
    expect(expand(y)).toEqual(y)
    const z = parse('[foo: 1 bar: 2]::bar')
    expect(expand(z)).toEqual(z)
})

it('throws on duplicate fields', () => {
    expect(() => {
        expand(parse('[foo: 1 foo: 2]'))
    }).toThrow()
})

it('expands sequences into callbacks', () => {
    expect(
        expand(parse(`
            {
                @let x := 1
                @let y := 2
                side-effect(x y)
                z
            }
        `))
    ).toEqual(parse(`
        {
            let(1 (x){
                let(2 (y){
                    do(side-effect(x y) {
                        z
                    })
                })
            })
        }
    `))
})

it('expands pattern-matching function args into try blocks', () => {
    expect(
        expand(parse(`
            (#foo 1 x){
                x
            }
        `))
    ).toEqual(parse(`
        (_0 _1 x){
            try(==(_0 #foo) {
                try(==(_1 1) {
                    x
                })
            })
        }
    `))
})

it('destructures function args', () => {
    expect(
        expand(parse(`
            ([l r]){ [r l] }
        `))
    ).toEqual(parse(`
        (_0){
            let(_0::0 (l){
                let(_0::1 (r){
                    [r l]
                })
            })
        }
    `))
})

it('destructures and pattern matches', () => {
    expect(expand(parse(`
        ([#bar x]){ [x x x] }
    `))).toEqual(expand(parse(`
        (_0){
            @try ==(_0::0 #bar)
            @let x := _0::1
            [x x x]
        }
    `)))
})
