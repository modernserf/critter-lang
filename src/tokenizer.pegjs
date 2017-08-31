ExpressionList
= h:Expression SP t:ExpressionList { return [h, ...t] }
/ h:Expression { return  [h] }

Expression
= r:Record      { return ["record"].concat(r) }
/ f:Function    { return f }
/ s:String      { return ["string", s] }
/ n:Number      { return ["number", Number(n)] }
/ a:Hashtag     { return ["hashtag", a] }
/ i:Identifier  { return ["identifier", i] }


// functions
Function
= ScopeIn p:Params SP e:ExpressionList _ ScopeOut { return ['function', p].concat(e) }
/ ScopeIn _ e:ExpressionList _ ScopeOut { return ['function', null].concat(e) }

Params
= ParamIn _ p:RecordBody _ ParamOut { return p }

// records
Record
= RecordIn _ r:RecordBody _ RecordOut { return r }

RecordBody
= h:Field SP t:RecordBody { return [h, ...t] }
/ h:Field { return [h] }

Field
= n:FieldName _ e:Expression { return ['field', n, e] }
/ e:Expression { return ['field', null, e] }

// non-evaluating
_
= OptSP LineComment OptSP
/ OptSP

SP
= [ \t\n\r]+ _

OptSP
= [ \t\n\r]*

// tokenizer (for syntax highlighting)
TokenList
= h:Token t:TokenList { return [h].concat(t) }
/ h:Token { return [h] }

Token
= c:LineComment { return ["comment", c, ';' + c] }
/ s:RecordIn    { return ["record_in", s] }
/ s:RecordOut   { return ["record_out", s] }
/ f:FieldName   { return ["field_name", f, f + ": "] }
/ f:FieldAccess { return ["field_access", f]}
/ s:String      { return ["string", s, '"' + s + '"'] }
/ n:Number      { return ["number", Number(n), n] }
/ a:Hashtag     { return ["hashtag", a, "#" + a] }
/ k:Keyword     { return ["keyword", k, '@' + k] }
/ i:Identifier  { return ["identifier", i] }
/ Dot           { return ["dot", '.'] }
/ Assignment    { return ["assignment", ' := ']}
/ s:ScopeIn     { return ["scope_in", s] }
/ s:ScopeOut    { return ["scope_out", s] }
/ ParamIn       { return ["param_in", '(' ] }
/ ParamOut      { return ["param_out", ')'] }
/ s:Space       { return ["sp", s] }
/ s:NL          { return ["newline", s] }

// comments
LineComment
= ';' c:[^\n]+ { return c.join('') }

// functions
Dot
= '.'
Assignment
= ' := '
ScopeIn
= '{'
ScopeOut
= '}'
ParamIn
= '('
ParamOut
= ')'

// records
RecordIn
= '['

RecordOut
= ']'

FieldName
= i:Identifier ': ' { return i }

FieldAccess
= ':'

Keyword
= "@" i:Identifier { return i }

// identifiers & hashtags
Hashtag
= "#" n:Number { return n }
/ "#" i:Identifier { return i }

Identifier
= h:IdentifierFirstChar t:IdentifierChar* { return h + t.join('') }

IdentifierFirstChar
= [^ \t\n\r:\.\(\)\[\]\{\}0-9#@]

IdentifierChar
= [^ \t\n\r:\.\(\)\[\]\{\}]

// Numbers
Number
= n:HexNumber { return [].concat(...n).join('') }
/ n:DecNumber { return [].concat(...n).join('') }

HexNumber
= '0x' HexDigit+

DecNumber
= '-'? Digit+ '.' Digit+
/ '-'? Digit+

HexDigit
= [0-9a-fA-F]

Digit
= [0-9]

// Strings
String
= '"' chars:StringChar+ '"' { return chars.join('') }

StringChar
= EscapedQuote
/ Char

EscapedQuote
= '\\"' { return '"' }

Char
= [^"]

// Whitespace
Space
= s:[ \t]+ { return s.join('') }

NL "newline"
= s:[\n\r] { return s }
