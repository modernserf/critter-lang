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
