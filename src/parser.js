function readUntil (str, matcher) {
    const res = str.match(matcher);
    if (!res) {
        throw new Error(`Looking for "${matcher}", found end of input.`)
    }
    return {
        before: str.substr(0, res.index),
        matched: res[0],
        rest: str.substr(res.index + res[0].length)
    }
}

function comment (state) {
    const { matched, rest } = state
    if (rest.startsWith(';;')) {
        const {before, rest} = readUntil(str.substr(2), "\n")
        s
        return {
            matched: matched.concat([{type: "comment", value: before }]),
            rest
        }
    }
    if (rest.startsWith(';{')) {
        const {before, rest} = readUntil(str.substr(2), "};")
        return {
            matched: matched.concat([{type: "comment", value: before }]),
            rest
        }
    }
    return state
}

function string (state) {
    const { matched, rest } = state
    if (!rest.startsWith('"')) { return state }

    let escaping = false
    const acc = ""
    for (let i = 1; i < rest.length; i++) {
        const char = rest[i]
        if (escaping && char === '"') {
            acc += `"`
            escaping = false
        } else if (escaping && char === '\\') {
            acc += "\\"
            escaping = false
        } else if (escaping) {
            throw new Error(`Unrecognized escape sequence "\\${char}"`)
        } else if (char === '\\') {
            escaping = true
        } else if (char === `"`) {
            return {
                matched: matched.concat({type: "string", value: acc}),
                rest: rest.substr(i + 1),
            }
        } else {
            acc += char
        }
    }
    throw new Error(`Looking for end quote, found end of input.`)
    }
}

function hexNumber (state) {
    const { matched, rest } = state
    if (!rest.startsWith('0x')) { return state }
    const acc = "0x"
    for (let i = 2; i < rest.length; i++) {
        const char = rest[i];
        if (/[0-9a-fA-F]/.test(char)) {
            acc += char
        } else if (/\s/.test(char)) {
            return {
                matched: matched.concat({ type: "number", value: Number(acc) }),
                rest: rest.substr(i),
            }
        } else {
            throw new Error(`Unexpected char`)
        }
    }
    throw new Error('EOF')
}


function tokenize (str) {
    let state = { matched: [], rest: str }
    while (state.rest.length) {
        state = comment(state)
        state = string(state)
    }
    return state.matched
}
