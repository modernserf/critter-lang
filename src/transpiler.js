import fs from 'fs'
import { parse } from './parser'
import { compile } from './compiler'
import { expand } from './expander'
import { pipe } from './util'

const runtime = fs.readFileSync('./src/runtime.js', 'utf8')
const stdlib = fs.readFileSync('./src/stdlib.critter', 'utf8')

const compiledStdlib = runtime + ';\n' +
    pipe([parse, expand, compile])(stdlib)

export const transpile = pipe([
    parse,
    expand,
    compile,
    (js) => compiledStdlib.replace('BEGIN', js),
])
