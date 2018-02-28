# 🐹 Critter — a small, soft programming language.

Critter is a dynamically-typed functional language that compiles to JavaScript. Critter's purpose is to explore ideas from research languages, both new and old, in the context of a "modern" scripting language.

Critter is pre-alpha software, and its syntax and features are still highly unstable.

# Types & Syntax

Critter has fewer types than most programming languages — only **numbers**, **strings**, **records** and **functions**. Critter also has a highly regular syntax with a handful of unambiguous forms and consistent rules for evaluation. [^](The syntax is somewhat in the spirit of Dylan's D-Expressions, but Critter is not a Lisp and does not use macros.)

## Comments

Critter has line comments delimited with `;` semicolon.

```critter
; this is a comment.
```

## Identifiers

Critter has very loose restrictions on identifiers: any character besides whitespace and the reserved delimiters (`:` `;` `.` `@` `"` `()` `[]` `{}`) are allowed.

```critter
foo bar/baz-quux >=> 💩
```

## Numbers

Critter supports decimal and hex numbers. Decimal numbers can have negative signs, decimal points, and underscores for spacing. Hex numbers can mix upper and lowercase letters.

```critter
-123.45 1_000_00 0xDEADBEEF 0xabad1dea
```

## Strings

Strings in Critter are delimited with `"` double quotes. These can be escaped inside strings with `\"`, but all other characters (e.g. line-breaks) are permitted to be used unescaped.

```critter
"foo bar baz"  "\"Hello,\" he lied."
"This is a
multi-line string."
```

Critter also allows strings without spaces and the reserved delimiters to be written as "hashtags". [^](This is superficially similar to quoting in Lisp or symbols in Ruby, but `#` is just an alternate syntax for strings, not an operator or a distinct type.)

```critter
#foo #bar/baz-quux #>=> #💩
```

## Records

Critter has a single composite data type: the record. Records are delimited with `[]` square brackets. Records can have both positional (zero-indexed) and named fields.

```critter
[#foo 10.5 bar: [x: 1 y: 2]]
```

Record fields can be accessed directly with the `::` operator.

```critter
[#foo 2]::0     ; #foo
[x: 1 y: 2]::x  ; 1
```

## Functions

Critter function definitions use `()` round parentheses for parameters and `{}` curly brackets to delimit the function body. Function parameters follow the same pattern as record fields: both positional and named arguments are permitted. The last expression in a function body is the return value.

```critter
(x y foo: z){ [z x y] }
```

Functions without arguments can be written without the parens:

```critter
{ #foo }
```

Critter supports a few different syntactic forms for calling functions, which fill the roles methods, operators and keywords have in other languages.

```critter
foo([123] bar: 45)
quux()
```

Instead of methods, critter allows functions to be called with `.` dot syntax. Functions that take a single argument don't need trailing parens.

```critter
[123].foo(bar: 45)
[x y z].length
```

Additionally, critter has keyword-style syntax, delimited with the `@` at-sign. Keyword syntax allows nested callback functions to be written as a series of assignments. [^](This is similar to `do` notation in haskell, though it operates on arbitrary functions, not specifically monadic bind / threading.)

```critter
(user){
    @try user.is-signed-in?
    @let x := foo(1)
    @await y := async-foo(2)
    [x y]
}
; is equivalent to:
(user){
    try(user.is-signed-in? {
        let(foo(1) (x){
            await(async-foo(2) (y){
                [x y]
            })
        })
    })
}
```

# Conditions, Control Flow and Error Handling

Critter has no notion of `void` or `undefined`, ie. the absence of a value. Functions always return values, even if they're evaluated for side effects. Anything that would introduce an undefined value, such as calling a function with fewer arguments than expected, or accessing a field that is not present on a record, raises an unrecoverable error.

Critter also has no notion of `null`, ie. a catch-all for missing data or failure. Critter idiomatically uses **result values** -- records structured as `[#ok value]` or `[#error message]` -- to represent success or failure. [^](this is similar to Result/Either types in typed functional languages, as well as {ok, Value} patterns in Erlang.)

Critter has no `throw`/`catch` error handling. Errors are handled through error result values or by terminating the process unconditionally.

Most unusually, Critter has no `true` or `false` booleans. Here, Critter also uses result values. This means that _all_ of Critter's comparison functions have control flow properties similar to short-circuit boolean operators. [^](This is most similar to goal-directed execution in the Icon programming language.)

## Results & Conditions

- ok, error
- cond, then, else
- chained comparison operators
- record traversal
- pattern matching

## Control Flow & Errors

- do, try, guard (unless?)
- defer, returns

```critter
(x){
    @try number(x)
    @returns number
    +(x 10)
}
```

# Parsers

> PSA: If a function accepts a string then it's a parser. Parsers are hard to get right and dangerous to get wrong. Write fewer of them. [D.R. MacIver](https://twitter.com/DRMacIver/status/862642573852258304)

Most scripting languages contain a lot of features for working with strings, but few have any built-in tools for actually parsing strings into structures; they encourage you to stay in unstructured string-land instead of transforming them into structured data.

- parser combinators (like regex operators)
- many work on any function that returns a Result

# Tables & Rules

Most of Critter's peers have types for lists, sets and key-value maps, but Critter offers **tables** for storing and processing relational data and **rules** for declaratively generating data.

- sql-ish select, where, sorted-by ...
- rows one iterator (protocol)

```critter
@let edges := [#from #to].table([
    [#charles #park]
    [#park #downtown]
    [#downtown #south]
])

@let edges := [#from #to].rule((from to){
    edges.and(edges.where([to: from from: to]))
})

@let links := [#from #to].rule((from to){
    or(edges.where([::from ::to])
       and(edges.where([from: from       to: #between.?])
           edges.where([from: #between.? to: to])))
})

links.where([from: #downtown]).rows ; => [
;   [from: #downtown to: #park]
;   [from: #downtown to: #charles]
;   [from: #downtown to: #south]
;]
```

# Processes & State

Critter is a functional language, but it does _not_ require side effects to be threaded into the program's entry point as Haskell or Elm do. Critter idiomatically uses **processes** to encapsulate state and nondeterminism.

- generators, date, random
- logs, actors
- atoms, stores
- `@await x := future`
- `@on message := stream`

# Protocols

Critter has no notions of inheritance or type hierarchies, but it does allow data structures to conform to interfaces and **protocols** via the `proto` field. [^]("proto" as a nod to both "prototypal inheritance" and "protocols.") Records can implement the required, implementation-specific "methods" with functions stored on the appropriate `proto` field.

```critter
@def List = [
    concat: (self right){
        self.match([
            (#cons head tail){
                cons(head List::concat(tail right))
            }
            (#nil){ right }
        ])
    }
    bind: (self fn){
        self.match([
            (#cons head tail){
                List::concat(
                    fn(head)
                    List::bind(tail fn)
                )
            }
            (#nil){ nil }
        ])
    }
    unit: (value){ cons(value nil) }
    empty: { nil }
]

@def concat := method(#concat)
@def bind := method(#bind)
@def unit := static-method(#unit)
@def empty := static-method(#empty)
@def map := (self f){
    self.bind((x){ self.unit(f(x)) })
}
@def filter := (self f){
    self.bind((x){ f(x).cond({ self.unit(x) } { self.empty }) })
}
@def filter-map (self f){
    self.bind((x){ f(x).cond((y){ self.unit(y) } { self.empty }) })
}

@def cons = (head tail){ [#cons head tail proto: List] }
@def nil = [#nil proto: List]
```

# Modules & the Compiler

- script vs module semantics
- modules can only have keywords at the top level, no side effects
- `@module`, `@import` etc
- `@def` for mutually-recursive

# Philosophy

- hard to avoid low-information terms like "simple"
- simple made easy

## Worse is Better

### Simplicity
Critter has a lot of ideas composed from a handful of core types. It follows the principle "It is better to have 100 functions operate on one data structure than 10 functions on 10 data structures." This principle is the core philosophy from which the rest of the design follows.

### Consistency
Critter enables syntactic diversity but largely enforces functional consistency -- e.g. a function call can be written multiple ways, but functions always work the same. In a handful of cases, consistency is sacrificed for simplicity; e.g. with module-level keywords.

### Completeness
Critter is a small language, and eschews a lot of features and idioms that are common in other languages. It features an extensive standard library, but it is largely focused on supporting a functional programming style.

### Correctness
Critter is dynamically typed; there is no "undefined behavior" but it makes few guarantees beyond generating valid JavaScript. Critter makes error handling and type correctness idiomatic, but it doesn't enforce them.
