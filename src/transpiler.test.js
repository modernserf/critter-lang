import fs from 'fs'
import { parse } from './parser'
import { compile } from './compiler'
import { expand } from './expander'
import { pipe } from './util'
const runtimeText = fs.readFileSync('./src/runtime.js')

const transpile = pipe([parse, expand, compile])

it('transpiles number literals', () => {
    expect(transpile('123')).toEqual('123')
})

it('transpiles hello world', () => {
    const program = `
    @import dom := #dom

    ; this is a comment

    @let hello := (name: name){
        [#section [class: #main] [
            [#h1 ["Hello, " name "!"]]
        ]]
    }

    @await dom::ready()

    @do dom::render(
        dom::find(#body)
        [hello [name: "World"]]
    )
    `

    const jsOutput = runtimeText +
        '\n;' +
        transpile(program)

    eval(jsOutput) // eslint-disable-line no-eval
})
