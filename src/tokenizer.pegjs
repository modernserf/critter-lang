TokenList
= h:Token t:TokenList { return [h].concat(t) }
/ h:Token { return [h] }

Token
= c:LineComment { return ["comment", c, ';' + c] }
/ s:RecordIn    { return ["record_in", s] }
/ s:RecordOut   { return ["record_out", s] }
/ f:FieldName   { return ["field_name", f, f + ": "] }
/ s:String      { return ["string", s, '"' + s + '"'] }
/ n:Number      { return ["number", Number(n), n] }
/ a:Atom        { return ["atom", a, ":" + a] }
/ i:Identifier  { return ["identifier", i] }
/ Dot           { return ["dot", '.'] }
/ s:ScopeIn     { return ["scope_in", s] }
/ s:ScopeOut    { return ["scope_out", s] }
/ ParamIn       { return ["param_in", '(' ] }
/ ParamOut      { return ["param_out", ')'] }
/ s:SP          { return ["sp", s] }
/ s:NL          { return ["newline", s] }

// comments
LineComment
= ';' c:[^\n]+ { return c.join('') }

// functions
Dot
= '.'
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

// identifiers & atoms
Atom
= ":" n:Number { return n }
/ ":" i:Identifier { return i }

Identifier
= h:IdentifierFirstChar t:IdentifierChar* { return h + t.join('') }

IdentifierFirstChar
= [^ \t\n\r:\.\(\)\[\]\{\}0-9]

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
SP "whitespace"
= s:[ \t]+ { return s.join('') }

NL "newline"
= s:[\n\r] { return s }
