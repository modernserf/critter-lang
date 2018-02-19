import fs from 'fs'
import { parse } from './parser'
import { compile } from './compiler'
import { expand } from './expander'
import { pipe } from './util'

const runtime = fs.readFileSync('./src/runtime.js')
const stdlib = fs.readFileSync('./src/stdlib.critter')

export const transpile = pipe([
    (text) => stdlib + '\n\n' + text,
    parse,
    expand,
    compile,
    (js) => runtime + ';\n' + js,
])
