import { expand } from './expander'
import { parse } from './parser'

it('is idempotent on simple values', () => {
    const x = parse('123')
    expect(expand(x)).toMatchParseResult(x)
    const y = parse('#foo')
    expect(expand(y)).toMatchParseResult(y)
    const z = parse('[foo: 1 bar: 2]::bar')
    expect(expand(z)).toMatchParseResult(z)
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
    ).toMatchParseResult(parse(`
        {
            let(1 (x){
                let(2 (y){
                    do(side-effect(x y) {
                        z
                    })
                } assignment: [#Ident #y])
            } assignment: [#Ident #x])
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
    ).toMatchParseResult(expand(parse(`
        (_0 _1 x){
            @try ==(_0 #foo)
            @try ==(_1 1)
            x
        }
    `)))
})

it('destructures function args', () => {
    expect(
        expand(parse(`
            ([l r]){ [r l] }
        `))
    ).toMatchParseResult(expand(parse(`
        (_0){
            @let l := _0::0
            @let r := _0::1
            [r l]
        }
    `)))
})

it('destructures and pattern matches', () => {
    expect(expand(parse(`
        ([#bar x]){ [x x x] }
    `))).toMatchParseResult(expand(parse(`
        (_0){
            @try ==(_0::0 #bar)
            @let x := _0::1
            [x x x]
        }
    `)))
})

it('destructures pun args', () => {
    expect(expand(parse(`
        ([::foo ::bar]){ [bar foo] }
    `))).toMatchParseResult(expand(parse(`
        (_0){
            @let foo := _0::foo
            @let bar := _0::bar
            [bar foo]
        }
    `)))
})

it('expands pun args', () => {
    expect(expand(parse(`
        [::foo ::bar]
    `))).toMatchParseResult(parse(`
        [foo: foo bar: bar]
    `))

    expect(expand(parse(`
        (x ::foo ::bar){ [x foo bar] }
    `))).toMatchParseResult(parse(`
        (x foo: foo bar: bar){ [x foo bar] }
    `))
})
