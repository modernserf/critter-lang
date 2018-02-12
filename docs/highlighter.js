(function () {
'use strict';

// parser results

const ok = (value, nextIndex) => ({ ok: true, value, nextIndex });
const err = (...errors) => ({ ok: false, errors });

// parsers
const _first = ([x]) => x;
const _withIndex = (match, _, __, index) => ({ match, index });
class Parser {
    constructor (parseFn) {
        this._parseFn = parseFn;
    }
    parse (input, index = 0) {
        return this._parseFn(input, index)
    }
    parseAll (input) {
        const res = seq(this, end).map(_first).parse(input, 0);
        return res.ok ? res.value : null
    }
    findMatches (input, startAt = 0) {
        const p = some(any, this.map(_withIndex)).map(_second);
        const results = [];

        while (true) {
            const res = p.parse(input, startAt);
            if (!res.ok) {
                return results
            }
            results.push(res.value);
            if (startAt === res.value.index) {
                throw new Error('`findMatches` cannot be used on a parser that does not consume input')
            }
            startAt = res.value.index;
        }
    }
    map (f) {
        return new Parser((input, index) => {
            const res = this.parse(input, index);
            return res.ok
                ? ok(f(res.value, res, input, index), res.nextIndex)
                : res
        })
    }
    mapError (f) {
        return new Parser((input, index) => {
            const res = this.parse(input, index);
            return res.ok
                ? res
                : err(...f(res.errors, input, index))
        })
    }
}

class MemoParser extends Parser {
    constructor (parseFn) {
        super(parseFn);
        this._memo = new Map();
    }
    parse (input, index = 0) {
        if (this._memo.has(input) && this._memo.get(input).has(index)) {
            return this._memo.get(input).get(index)
        }
        if (!this._memo.has(input)) {
            this._memo.set(input, new Map());
        }
        const res = this._parseFn(input, index);
        this._memo.get(input).set(index, res);
        return res
    }
}

// never matches


// always matches, returns same value, does not consume input
const always = (value) => new Parser((_, index) => ok(value, index));

// matches the start of input (regex ^)

// matches the end of input (regex $)
const end = new Parser((input, index) =>
    index === input.length
        ? ok(null, index)
        : err('expected_end_of_input', index));

// matches any one token (regex .)
const any = new Parser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : ok(input[index], index + 1)
);

// matches if input[index] exists && matchFn(input[index]) is truthy
const match = (matchFn) => new MemoParser((input, index) =>
    index >= input.length
        ? err('unexpected_end_of_input', index)
        : matchFn(input[index])
            ? ok(input[index], index + 1)
            : err('no_match', input[index], index)
);



// matches if any of ps matches (regex |)
// TODO: concatenate with other "alt" parsers
const alt = (...ps) => new MemoParser((input, index) => {
    for (const p of ps) {
        const res = p.parse(input, index);
        if (res.ok) { return res }
    }
    return err('no_alts', input[index], index)
});

// matches if sequence of ps match
// TODO: concatenate with other "seq" parsers
// TODO: check if sum of lengths is possible
const seq = (...ps) => new MemoParser((input, index) => {
    const output = [];
    for (const p of ps) {
        const res = p.parse(input, index);
        if (!res.ok) { return res }
        index = res.nextIndex;
        output.push(res.value);
    }
    return ok(output, index)
});

// matches sequence of p (regex *)
// p must consume input
const all = (p) => new MemoParser((input, index) => {
    const output = [];
    while (true) {
        const res = p.parse(input, index);
        if (!res.ok) {
            return ok(output, index)
        }
        if (index === res.nextIndex) {
            throw new Error('`all` cannot be used with a parser that does not consume input')
        }
        index = res.nextIndex;
        output.push(res.value);
    }
});

// matches at least one p (regex +)
// p must consume input
const _consSeq = ([h, t]) => [h].concat(t);
const plus = (p) => seq(p, all(p))
    .map(_consSeq);

// matches 0 or 1 p (regex ?)
// yielding [] or [value]
const _nothing = always([]);
const _just = (x) => [x];
const maybe = (p) => alt(p.map(_just), _nothing);

// matches if p does not match
// does not consume input
const not = (p) => new Parser((input, index) =>
    p.parse(input, index).ok
        ? err('should_not_match', index)
        : ok(null, index)
);

// non-greedy match sequence of p, followed by q (regex *?)
// p must consume input
const some = (p, q) => seq(
    all(seq(not(q), p).map(_second)),
    q
);

// matches any one token that ps do not match (regex [^ ])
const _second = ([_, x]) => x;
const notOneOf = (...ps) => seq(not(alt(...ps)), any).map(_second);



// as above, but matches 1 or more `content`


// matches `content` wrapped with left or left + right
// yields match for content


// string-specific parsers

const _join = (xs) => xs.join('');
const _matchChar = (ch) => match((x) => x === ch);

// match a substring
const chars = (str) => seq(
    ...Array.from(str).map(_matchChar)
).map(_join);
// match a char within the string
const altChars = (str) => alt(
    ...Array.from(str).map(_matchChar)
);

// ASCII codes
const range = (start, end) => {
    const startCode = start.codePointAt(0);
    const endCode = end.codePointAt(0);
    return match((x) => {
        if (!x.codePointAt) { return false }
        const c = x.codePointAt(0);
        return c >= startCode && c <= endCode
    })
};

const digit = range('0', '9');
const uppercase = range('A', 'Z');
const lowercase = range('a', 'z');
const letter = alt(uppercase, lowercase);
const whitespace = match((x) => /\s/.test(x));

// helper for mutual recursion

const flatten = (arr) => [].concat(...arr);

const tag = (type) => (value) => ({ type, value });

const join = (xs) => xs.join('');

const whitespace$1 = plus(whitespace);

const comment = seq(
    chars(';'),
    all(notOneOf(chars(''))).map(join)
);

const hexNumber = seq(
    chars('0x'),
    plus(alt(digit, range('A', 'F'), range('a', 'f'))).map(join)
).map(join);

const digits = plus(digit).map(join);
const decNumber = seq(
    maybe(chars('-')),
    digits,
    maybe(seq(chars('.'), digits)).map(flatten)
).map(flatten)
    .map(join);

const ident = plus(notOneOf(
    whitespace,
    altChars('.:#,;@[]{}()]"')
)).map(join);

const tagString = seq(chars('#'), ident);

const quote = chars('"');
const quoteEsc = chars('\\"').map(() => '"');
const notQuote = notOneOf(quote);
const stringChars = all(alt(quoteEsc, notQuote)).map(join);
const quotedString = seq(quote, stringChars, quote);

const token = alt(
    chars('::').map(tag('FieldOp')),
    chars(':=').map(tag('Assignment')),
    chars(':').map(tag('Colon')),
    chars('[').map(tag('LBrk')),
    chars(']').map(tag('RBrk')),
    chars('{').map(tag('LCurly')),
    chars('}').map(tag('RCurly')),
    chars('(').map(tag('LParen')),
    chars(')').map(tag('RParen')),
    chars('@').map(tag('At')),
    chars('.').map(tag('Dot')),
    whitespace$1.map(tag('Whitespace')),
    comment.map(tag('Comment')),
    hexNumber.map(tag('HexNumber')),
    decNumber.map(tag('DecNumber')),
    tagString.map(tag('TaggedString')),
    quotedString.map(tag('QuotedString')),
    ident.map(tag('Ident')),
);

const tokenSeq = all(token);

const tokenize = (str) => tokenSeq.parseAll(Array.from(str));

const join$1 = (s) => Array.isArray(s) ? flatten(s).join('') : s;

const highlight = (text) =>
    tokenize(text).map(({ type, value }) =>
        `<span class="syntax-${type}">${join$1(value)}</span>`).join('');

function trimBlock (str) {
    const indent = str.length - str.trimLeft().length;
    if (indent === 0) { return str }
    const lines = str.split('\n').map((line) => line.substr(indent - 1));
    return lines.join('\n').trim()
}

window.addEventListener('DOMContentLoaded', () => {
    const nodes = Array.from(document.querySelectorAll('[data-critter-lang]'));
    nodes.forEach((node) => {
        const html = highlight(trimBlock(node.textContent));
        node.innerHTML = html;
    });
});

}());
