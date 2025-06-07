const syntax = `
# Extended SQL Grammar

# Entry point
Query -> [Expr];

# Main statement types
Expr -> [SelectStmt]
 
# SELECT statements (expanded from your original)
SelectStmt -> SELECT [SelectList] [FromClause] [WhereClause]

SelectList -> [SelectItem] [SelectItems] | * [Alias]
SelectItems -> , [SelectItem] [SelectItems] | e

SelectItem -> [Column] [Alias] | * | [Value] [Alias]
Alias -> AS [Identifier] | e
TableAlias -> [Identifier] | e

# FROM clause (expanded)
FromClause -> FROM [TableRef] [TableRefs] | e

TableRefs -> , [TableRef] [TableRefs] | e
TableRef -> [Table] [TableAlias] | ( [SelectStmt] ) [TableAlias]

# WHERE clause
WhereClause -> WHERE [Condition] | e

# Conditions and expressions
Condition -> [Value] = [Value]

# Basic elements (from your original, with expansions)
Column -> [Identifier] [ColumnRef]
ColumnRef -> . [Identifier] | e
Table -> [Identifier] [TablePath]
TablePath -> . [Identifier] [TablePath] | e
Value -> [Number] | [String] | [Boolean] | NULL | [Column]
Identifier -> symbol
Number -> number
String -> string
Boolean -> TRUE | FALSE
`;

const input = `
select 1 as test
from stuff.table.table2 a
where a.id = 0;

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

function ll1toStackMachine(grammar, productions) {
  let cacheFirst = new Map();
  let cacheFollow = new Map();

  function getFirst(production, set, ruleIdx) {
    let start = ruleIdx ?? 0;
    let end = ruleIdx ?? production.rules.length - 1;
    for (let i = start; i <= end; i++) {
      let rule = production.rules[i];
      let first = rule[0];

      // Check cache
      const key = `${production.name}:${i}`;
      if (cacheFirst.has(key)) {
        first = cacheFirst.get(key);
        continue;
      }

      if (typeof first === 'string') {
        // Terminal
        set.add(first);
      } else if (typeof first === 'number') {
        // Non-terminal
        getFirst(grammar[first], set)
      }
    }
  }

  function getFollow(productionIdx, set) {
    if (cacheFollow.has(productionIdx)) return cacheFollow.get(productionIdx);
    cacheFollow.set(productionIdx, set);

    // For every appearance of a production in a rule, run getFirst on the next rule element
    for (let i = 0; i < grammar.length; i++) {
      let rules = grammar[i].rules;
      for (let j = 0; j < rules.length; j++) {
        let rule = rules[j];
        for (let k = 0; k < rule.length; k++) {
          let element = rule[k];
          if (element === productionIdx) {
            let nextElement = rule[k + 1];
            if (nextElement === undefined) {
              // If there is no next element, get the follow of the current production
              getFollow(i, set);
            } else if (typeof nextElement === 'string') {
              // Terminal
              set.add(nextElement);
            } else if (typeof nextElement === 'number') {
              // Non-terminal
              getFirst(grammar[nextElement], set);
            }
          }
        }
      }
    }
  }

  let firstAndFollow = [];
  for (let i = 0; i < grammar.length; i++) {
    let production = grammar[i];
    let follow = new Set('$');
    getFollow(i, follow);
    for (let j = 0; j < production.rules.length; j++) {
      let rule = production.rules[j];
      let first = new Set();
      getFirst(production, first, j);
      firstAndFollow.push({ production: i, rule, first, follow });
    }
  }

  // print(grammar);
  // print(firstAndFollow);

  let parsingTable = Array(Object.keys(productions).length);
  
  for (let i = 0; i < parsingTable.length; i++) {
    parsingTable[i] = {};
  }
  // print(productions);

  for (let i = 0; i < firstAndFollow.length; i++) {
    let productionIdx = firstAndFollow[i].production;
    let rule = firstAndFollow[i].rule;
    let first = firstAndFollow[i].first;
    let follow = firstAndFollow[i].follow;

    for (let terminal of first) {
      // print(productionIdx, terminal, rule);
      parsingTable[productionIdx][terminal] = rule;
    }
  }

  let stackMachine = new StackMachine();
  for (let i = 0; i < parsingTable.length; i++) {
    let production = grammar[i];
    for (let terminal of Object.keys(parsingTable[i])) {
      let rule = parsingTable[i][terminal];
      stackMachine.addTransition(terminal, `[${production.name}]`, rule.map(s => {
        if (typeof s === 'number') {
          return `[${grammar[s].name}]`;
        } else {
          return s;
        }
      }));
    }
  }

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
          throw new Error(`Expected ${pop} but got ${read.token}, ${read.value}`);
        }
        inputIdx++;
        currentNode.children.push(read.value);
      }
    }

    // Remove unnecessary fields
    delete currentNode.parent;
    delete currentNode.nchildren;

    let good = stack.length === 0 && inputIdx === input.length;

    if (!good) return false;

    return currentNode;
  }
}
