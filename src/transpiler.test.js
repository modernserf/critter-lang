const fs = require('fs')
const test = require('tape')
const { parse } = require('./parser')
const { compile } = require('./compiler')
const runtimeText = fs.readFileSync('./src/runtime.js')

const compose = (f, g) => (x) => f(g(x))

const transpile = compose(compile, parse)

test('number literals', (t) => {
    t.equals(transpile('123'), '123')
    t.end()
})

test('hello world', (t) => {
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

    console.log(jsOutput)

    eval(jsOutput)

    t.end()
})
