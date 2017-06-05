Program
= _? e:ExprList _? { return e }

ExprList
= h:Expr _ t:ExprList { return [h].concat(t) }
/ h:Expr { return [h] }

Expr
= String
/ Number
/ Atom
/ Identifier

Identifier
= h:IdentifierChar t:AtomChar+ { return ["identifier",h + t.join('')] }

IdentifierChar
= [^ \t\n\r:\.\(\)\[\]\{\}0-9]

Atom
= ':' a:AtomChar+ { return ["atom", a.join('')] }

AtomChar
= [^ \t\n\r:\.\(\)\[\]\{\}]

Number
= n:HexNumber { return ["number", Number([].concat(...n).join(''))] }
/ n:DecNumber { return ["number", Number([].concat(...n).join(''))] }

HexNumber
= '0x' HexDigit+

DecNumber
= '-'? Digit+ '.' Digit+
/ '-'? Digit+

HexDigit
  = [0-9a-fA-F]

Digit
  = [0-9]

String
  = '"' chars:StringChar+ '"' { return ["string", chars.join('')] }

StringChar
  = EscapedQuote
  / Char

EscapedQuote
  = '\\"' { return '"' }

Char
  = [^"]

_ "whitespace"
  = [ \t\n\r]* { return null }
