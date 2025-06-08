const syntax = `
# Thoroughly Fixed LL(1) SQL Grammar

# Entry point
Query -> [Statement]

# Main statement types - each starts with a unique keyword
Statement -> SELECT [SelectRest] | INSERT [InsertRest] | UPDATE [UpdateRest] | DELETE [DeleteRest] | CREATE [CreateRest] | DROP [DropRest]

# SELECT statements
SelectRest -> [SelectList] [FromClause] [WhereClause] [GroupByClause] [HavingClause] [OrderByClause] [LimitClause]

SelectList -> [SelectItem] [SelectTail]
SelectTail -> , [SelectItem] [SelectTail] | e

# SelectItem - * is unique, everything else goes through ArithExpr
SelectItem -> * | [ArithExpr] [Alias]
Alias -> AS [Identifier] | e

# FROM clause
FromClause -> FROM [TableExpr] | e
TableExpr -> [TablePrimary] [JoinChain]
TablePrimary -> [Identifier] [TableRefChain] [TableAlias] | ( [SelectRest] ) [TableAlias]
TableRefChain -> . [Identifier] [TableRefChain] | e
TableAlias -> [Identifier] | e
JoinChain -> [JoinClause] [JoinChain] | e
JoinClause -> [JoinType] JOIN [TablePrimary] ON [BoolExpr]
JoinType -> INNER | LEFT | RIGHT | FULL [OuterOpt] | e
OuterOpt -> OUTER | e

# WHERE clause
WhereClause -> WHERE [BoolExpr] | e

# GROUP BY and HAVING
GroupByClause -> GROUP BY [ColumnRef] [GroupByTail] | e
GroupByTail -> , [ColumnRef] [GroupByTail] | e
HavingClause -> HAVING [BoolExpr] | e

# ORDER BY
OrderByClause -> ORDER BY [OrderItem] [OrderByTail] | e
OrderByTail -> , [OrderItem] [OrderByTail] | e
OrderItem -> [ColumnRef] [SortOrder]
SortOrder -> ASC | DESC | e

# LIMIT
LimitClause -> LIMIT [Number] [OffsetClause] | e
OffsetClause -> OFFSET [Number] | e

# INSERT statements
InsertRest -> INTO [Identifier] [InsertBody]
# Fixed: Each alternative has distinct FIRST set
InsertBody -> ( [ColumnList] ) [InsertValues] | VALUES [ValuesList] | SELECT [SelectRest]
ColumnList -> [Identifier] [ColumnTail]
ColumnTail -> , [Identifier] [ColumnTail] | e
InsertValues -> VALUES [ValuesList] | SELECT [SelectRest]
ValuesList -> ( [ValueList] ) [ValuesRest]
ValueList -> [Value] [ValueTail]
ValueTail -> , [Value] [ValueTail] | e
ValuesRest -> , ( [ValueList] ) [ValuesRest] | e

# UPDATE statements
UpdateRest -> [Identifier] SET [AssignmentList] [WhereClause]
AssignmentList -> [Assignment] [AssignmentTail]
AssignmentTail -> , [Assignment] [AssignmentTail] | e
Assignment -> [Identifier] = [ArithExpr]

# DELETE statements
DeleteRest -> FROM [Identifier] [WhereClause]

# CREATE statements
CreateRest -> TABLE [Identifier] ( [ColumnDefList] )
ColumnDefList -> [ColumnDef] [ColumnDefTail]
ColumnDefTail -> , [ColumnDef] [ColumnDefTail] | e
ColumnDef -> [Identifier] [DataType] [ConstraintList]
DataType -> INT | INTEGER | VARCHAR ( [Number] ) | TEXT | BOOLEAN | DATE | TIMESTAMP | DECIMAL ( [Number] , [Number] )
ConstraintList -> [Constraint] [ConstraintList] | e
Constraint -> NOT NULL | PRIMARY KEY | UNIQUE | DEFAULT [Value]

# DROP statements
DropRest -> TABLE [Identifier] | INDEX [Identifier]

# Boolean expressions - FIXED to eliminate ( ambiguity
BoolExpr -> [BoolTerm] [OrTail]
OrTail -> OR [BoolTerm] [OrTail] | e
BoolTerm -> [BoolFactor] [AndTail]
AndTail -> AND [BoolFactor] [AndTail] | e
BoolFactor -> NOT [BoolFactor] | [BoolAtom]

# FIXED: Eliminated the ( ambiguity - all parentheses handled through ArithExpr
BoolAtom -> [ArithExpr] [BoolSuffix]
BoolSuffix -> [CompOp] [ArithExpr] | IN ( [ValueList] ) | LIKE [String] | IS [NullTest] | e

CompOp -> = | != | <> | < | <= | > | >=
NullTest -> NULL | NOT NULL

# Arithmetic expressions - FIXED to handle parentheses properly
ArithExpr -> [Term] [AddTail]
AddTail -> [AddOp] [Term] [AddTail] | e
Term -> [Factor] [MulTail]
MulTail -> [MulOp] [Factor] [MulTail] | e

# FIXED: Separated parenthesized expressions from other factors
Factor -> [AtomicFactor] | ( [ArithExpr] )

# AtomicFactor contains all non-parenthesized factors
AtomicFactor -> [Number] | [String] | [Boolean] | NULL | [Identifier] [IdentRest]
IdentRest -> . [Identifier] | ( [ArgList] ) | e
ArgList -> [ArithExpr] [ArgTail] | e
ArgTail -> , [ArithExpr] [ArgTail] | e

AddOp -> + | -
MulOp -> * | / | %

# Column references
ColumnRef -> [Identifier] [DotIdent]
DotIdent -> . [Identifier] | e

# Basic elements
Value -> [Number] | [String] | [Boolean] | NULL
Identifier -> symbol
Number -> number  
String -> string
Boolean -> TRUE | FALSE
`;

const input = `
select 1 as test
from stuff.table.table2 a
where a.id = 0
-- select 1 as test
-- from test b, test_test a
-- where a.id = 0;
`

function parseGrammarSyntax() {
  const lines = syntax.split('\n');
  const grammars = [];
  const productions = {};

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (line.trim() === '') continue;
    let [lhs, rhs] = line.split('->');
    lhs = lhs.trim();
    rhs = rhs.trim();
    
    if (productions[lhs] === undefined) {
      productions[lhs] = grammars.length;
      grammars.push({ name: lhs, rules: [] });
    }

    let rules = rhs.split('|');
    for (let i = 0; i < rules.length; i++) {
      let rule = rules[i];
      let statement = tokenize(rule).map(s => s = s.trim()).filter(s => s !== '').map(s => s === 'e' ? '' : s);
      grammars[productions[lhs]].rules.push(statement);
    }
  }

  for (let i = 0; i < grammars.length; i++) {
    let rules = grammars[i].rules;
    for (let j = 0; j < rules.length; j++) {
      let rule = rules[j];
      rules[j] = rule.map(s => {
        if (s.startsWith('[') && s.endsWith(']')) {
          s = s.slice(1, -1);
          if (productions[s] !== undefined) {
            s = productions[s];
          }
        }
        return s;
      });
    }
  }

  return [grammars, productions];
}

function tokenize(input) {
  input = input.split('\n').filter(s => s.startsWith('--') === false).join('\n');
  let regex = /\[[a-zA-Z_][a-zA-Z0-9_]*\]|[a-zA-Z_][a-zA-Z0-9_]*|\\w+|--.*|[\S]/g;
  let tokens = input.match(regex);
  return tokens;
}

function unwrapSet(set) {
  const result = new Set();
  const seen = new Set();

  function helper(current) {
    if (seen.has(current)) return;
    seen.add(current);

    for (const item of current) {
      if (typeof item === 'string') {
        result.add(item);
      } else if (item instanceof Set) {
        helper(item);
      }
    }
  }

  helper(set);
  return result;
}

/**
 * 
 * @param {Array} grammar An array of productions where each production is an object with a name and a rules array\
 * e.g. [{ name: 'S', rules: [[1, 'b'], [2, 'd']] }]
 * @param {Object} productions A map of production names to indices\
 * e.g. { S: 0, B: 1, C: 2 }
 */
function ll1toStackMachine(grammar, productions) {
  // Caching to prevent infinite recursion and improve performance
  let cacheFirst = Array(grammar.length);
  let cacheNextProd = Array(grammar.length);
  for (let i = 0; i < cacheFirst.length; i++) {
    cacheFirst[i] = Array(grammar[i].rules.length);
  }

  function getRuleEnumerater(productionIdx) {
    return Array(grammar[productionIdx].rules.length).fill(0).map((_, i) => [productionIdx, i]);
  }

  function getFirstProduction(productionIdx) {
    for (let [prodI, ruleI] of getRuleEnumerater(productionIdx)) {
      getFirst(prodI, ruleI);
    }
  }

  function getFirst(productionIdx, ruleIdx) {
    if (cacheFirst[productionIdx][ruleIdx] === undefined) {
      cacheFirst[productionIdx][ruleIdx] = new Set();
    } else return;
    
    const set = cacheFirst[productionIdx][ruleIdx];
    const production = grammar[productionIdx];
    const rule = production.rules[ruleIdx];
    const first = rule[0];

    // If the first element is a terminal, add it to the set and return
    if (typeof first === 'string') {
      // Add to this rule
      if (first === '') {
        for (let prod of cacheNextProd[productionIdx]) {
          // Skip recursive productions
          if (prod === productionIdx) continue;
          
          // Terminal
          if (typeof prod === 'string') {
            set.add(prod);
            continue;
          }

          getFirstProduction(prod);

          // Add to this rule
          for (let [prodI, ruleI] of getRuleEnumerater(prod)) {
            set.add(cacheFirst[prodI][ruleI]);
          }
        }
      } else {
        set.add(first);
      }
      return;
    }

    // If the first element is a non-terminal, find the first of the non-terminal
    if (typeof first === 'number') {
      getFirstProduction(first);
      
      // Add to this rule
      for (let [prodI, ruleI] of getRuleEnumerater(first)) {
        set.add(cacheFirst[prodI][ruleI]);
      }
    }
  }

  function getFirstProductions() {
    // Go in reverse order because terminals are likely to be at the end
    for (let i = grammar.length - 1; i >= 0; i--) {
      getFirstProduction(i);
    }

    // Unwrap nested sets
    for (let i = 0; i < cacheFirst.length; i++) {
      for (let j = 0; j < cacheFirst[i].length; j++) {
        cacheFirst[i][j] = unwrapSet(cacheFirst[i][j]);
      }
    }
  }

  function getNextProductions(productionIdx) {
    // Check cache
    if (cacheNextProd[productionIdx] !== undefined) return;
    let set = new Set();
    cacheNextProd[productionIdx] = set;
    if (productionIdx === 0) set.add('$');
    for (let i = grammar.length - 1; i >= 0; i--) {
      let production = grammar[i];
      let rules = production.rules;
      for (let j = 0; j < rules.length; j++) {
        let rule = rules[j];
        for (let k = 0; k < rule.length; k++) {
          let element = rule[k];
          if (element === productionIdx) {
            let nextElement = rule[k + 1];
            if (nextElement === undefined) {
              getNextProductions(i);
              
              for (let prod of cacheNextProd[i]) {
                set.add(prod);
              }
            } else {
              set.add(nextElement);
            }
          }
        }
      }
    }
  }

  function computeNextProductions() {
    for (let i = grammar.length - 1; i >= 0; i--) {
      getNextProductions(i);
    }
  }

  function validateFirst() {
    // For each production ensure that all rule sets:
    // 1. Are non-empty
    // 2. Disjoint
    // 3. Don't contain epsilon
    // 4. Don't contain any numbers
    // 5. Don't contain any strings

    for (let i = 0; i < grammar.length; i++) {
      let production = cacheFirst[i];
      if (production === undefined) throw "Error: First set not computed for production " + grammar[i].name;
      for (let j = 0; j < production.length; j++) {
        let rule = production[j];
        if (rule.size === 0) throw "Error: First set for production " + grammar[i].name + " in rule " + (j + 1) + " is empty";
        for (let element of rule) {
          if (element === '') throw "Error: First set for production " + grammar[i].name + " contains epsilon";
          if (typeof element === 'number') throw "Error: First set for production " + grammar[i].name + " contains non-terminal";
        }
      }

      // Intersect all rule sets
      if (production.length === 1) continue; // Only one rule
      let intersection = new Set(production[0]);
      for (let j = 1; j < production.length; j++) {
        intersection = intersection.intersection(production[j]);
      }
      if (intersection.size !== 0) throw "Error: Ambiguous starting symbol for production " + grammar[i].name
        + ": " + Array.from(intersection).join(', ');
    }
  }

  computeNextProductions();
  getFirstProductions();
  validateFirst();

  // Construct the parsing table
  let parsingTable = Array(Object.keys(productions).length);
  
  for (let i = 0; i < parsingTable.length; i++) {
    parsingTable[i] = {};
  }

  for (let i = 0; i < cacheFirst.length; i++) {
    for (let j = 0; j < cacheFirst[i].length; j++) {
      let startingSymbols = cacheFirst[i][j];
      for (let element of startingSymbols) {
        parsingTable[i][element] = grammar[i].rules[j];
      }
    }
  }

  let stackMachine = new StackMachine();
  for (let i = 0; i < parsingTable.length; i++) {
    let production = grammar[i];
    for (let terminal in parsingTable[i]) {
      let rule = parsingTable[i][terminal];
      stackMachine.addTransition(terminal, `[${production.name}]`, rule.map(element => {
        if (typeof element === 'number') {
          return `[${grammar[element].name}]`;
        } else {
          return element;
        }
      }));
    }
  }

  // print(stackMachine.transitions)

  return stackMachine;
}

class StackMachine {
  constructor() {
    this.transitions = {};
  }

  processTokens(tokens) {
    let isSymbol = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    let isNumber = /^[0-9]+(\.[0-9]+)?$/;

    // Replace all symbols with { token: "symbol", value: "$1" }
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      
      if (isSymbol.test(token)) {
        tokens[i] = { token: "symbol", value: token };
      } else if (isNumber.test(token)) {
        tokens[i] = { token: "number", value: token };
      } else {
        tokens[i] = { token, value: token };
      }
    }

    let currentToken = {};
    let newTokens = [];
    let state = 0;
    for (let i = 0; i < tokens.length; i++) {
      let val = tokens[i].value;
      switch (state) {
      case 0: // Not in a string
        if (val === '\'') {
          currentToken = { token: 'string', value: '' };
          state = 1;
        } else {
          newTokens.push(tokens[i]);
        }
        break;
      case 1: // In a string
        if (val === '\\') state = 2;
        else if (val === '\'') {
          newTokens.push(currentToken);
          currentToken = {};
          state = 0;
        } else {
          currentToken.value += val;
        }
        break;
      case 2: // In an escaped string
        currentToken.value += val;
        state = 1;
        break;
      }
    }

    newTokens.push({ token: '$', value: '$' });

    return newTokens;
  }
  
  addTransition(read, pop, push) {
    if (!this.transitions[pop]) {
      this.transitions[pop] = {};
    }
    this.transitions[pop][read] = push;
  }

  getNumTransitions(pop, read) {
    if (!this.transitions[pop]) {
      return 0;
    }
    if (!this.transitions[pop][read]) {
      return 0;
    }
    return this.transitions[pop][read].filter(s => s !== '').length;
  }

  formatType(type) {
    return type.substring(1, type.length - 1).toLowerCase();
  }

  getParseTree(input, startSymbol) {
    if (input === null) return null;
    input = this.processTokens(input);
    let stack = [startSymbol];
    let inputIdx = 0;
    let currentNode = {
      type: this.formatType(startSymbol),
      children: [],
      nchildren: 1
    };
    let root = currentNode;

    while (stack.length > 0 && inputIdx < input.length) {
      let read = input[inputIdx];
      let pop = stack.pop();
      let value = read.value;

      if (this.transitions[pop]) {
        if (this.transitions[pop][read.token] !== undefined) value = read.token;
        if (this.transitions[pop][read.value] !== undefined) value = read.value;
      }

      if (!['symbol','string','number'].includes(value)) {
        value = value.toUpperCase();
      }

      // Backtrack
      while (currentNode.children.length === currentNode.nchildren) {
        let oldNode = currentNode;
        currentNode = currentNode.parent;
        
        // Remove unnecessary fields
        delete oldNode.parent;
        delete oldNode.nchildren;
      }

      if (this.transitions[pop] && this.transitions[pop][value]) {
        // Non-Terminal
        let push = this.transitions[pop][value];
        for (let i = push.length - 1; i >= 0; i--) {
          if (push[i] === '') continue;
          stack.push(push[i]);
        }

        // Create node
        let node = {
          type: this.formatType(pop),
          children: [],
          nchildren: this.getNumTransitions(pop, value),
          parent: currentNode
        };

        // Add and enter new node
        currentNode.children.push(node);
        currentNode = node;
      } else if (this.transitions[pop] && this.transitions[pop]['']) {
        // Epsilon
        let push = this.transitions[pop][''];
        for (let i = push.length - 1; i >= 0; i--) {
          if (push[i] === '') continue;
          stack.push(push[i]);
        }

        // Create node
        let node = {
          type: this.formatType(pop),
          children: [],
          nchildren: this.getNumTransitions(pop, ''),
          parent: currentNode
        };

        // Add and enter new node
        currentNode.children.push(node);
        currentNode = node;
      } else {
        // Terminal
        if (pop !== value && pop !== read.token) {
          print(root);
          throw new Error(`${pop} expected ${Object.keys(this.transitions[pop]).join(' ')} but got ${read.token}, ${read.value}`);
        }
        inputIdx++;
        currentNode.children.push(read.value);
      }
    }

    // Final backtrack
    while (currentNode.children.length === currentNode.nchildren && currentNode.parent) {
      let oldNode = currentNode;
      currentNode = currentNode.parent;
      
      // Remove unnecessary fields
      delete oldNode.parent;
      delete oldNode.nchildren;
    }

    let good = stack.length === 0 && input[inputIdx].value === '$';

    if (!good) return false;

    return currentNode;
  }
}
