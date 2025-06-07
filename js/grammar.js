const syntax = `
# Testing
E -> [T] [E0]
E0 -> + [T] [E0] | e
T -> [F] [T0]
T0 -> * [F] [T0]
F -> id | ( [E] )
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

/**
 * 
 * @param {Array} grammar An array of productions where each production is an object with a name and a rules array\
 * e.g. [{ name: 'S', rules: [[1, 'b'], [2, 'd']] }]
 * @param {Object} productions A map of production names to indices\
 * e.g. { S: 0, B: 1, C: 2 }
 */
function ll1toParsingTable(grammar, productions) {
  print(grammar, productions);

  // Caching to prevent infinite recursion and improve performance
  let cacheFirst = Array(grammar.length);
  let cacheFollow = Array(grammar.length);
  for (let i = 0; i < cacheFirst.length; i++) {
    cacheFirst[i] = Array(grammar[i].rules.length);
    for (let j = 0; j < cacheFirst[i].length; j++) {
      cacheFirst[i][j] = new Set();
    }
  }

  function getRuleEnumerater(productionIdx) {
    return Array(grammar[productionIdx].rules.length).fill(0).map((_, i) => [productionIdx, i]);
  }

  function getFirstProduction(productionIdx, callStack = []) {
    for (let [prodI, ruleI] of getRuleEnumerater(productionIdx)) {
      getFirst(prodI, ruleI, callStack);
    }
  }

  function getFirst(productionIdx, ruleIdx, callStack = []) {
    const set = cacheFirst[productionIdx][ruleIdx];
    const production = grammar[productionIdx];
    const rule = production.rules[ruleIdx];
    const first = rule[0];

    // Check call stack for circular dependency, e.g. getFirst(0, 0) -> getFirst(0, 0)
    for (let i = 0; i < callStack.length; i++) {
      if (callStack[i][0] === productionIdx && callStack[i][1] === ruleIdx) {
        return; // Circular dependency so ignore this rule
      }
    }

    // If the first element is a terminal, add it to the set and return
    if (typeof first === 'string') {
      // Add to this rule
      set.add(first);
      
      // Add this first to every rule in the call stack
      for (let [prodI, ruleI] of callStack) {
        cacheFirst[prodI][ruleI].add(first);
      }

      return;
    }

    // If the first element is a non-terminal, find the first of the non-terminal
    if (typeof first === 'number') getFirstProduction(first, [...callStack, [productionIdx, ruleIdx]]);
  }

  function getFollow(productionIdx) {
    // Caching
    if (cacheFollow[productionIdx] !== undefined) return;
    cacheFollow[productionIdx] = new Set();

    // If the production is the start production, add $ to the set
    if (productionIdx === 0) {
      cacheFollow[productionIdx].add('$');
      return;
    }

    // Find all appearances of the production in the grammar
    for (let i = grammar.length - 1; i >= 0; i--) {
      let production = grammar[i];
      let rules = production.rules;
      for (let j = 0; j < rules.length; j++) {
        let rule = rules[j];
        for (let k = 0; k < rule.length; k++) {
          let element = rule[k];
          if (typeof element === 'number' && element === productionIdx) {
            // We found an appearance of the production
            let nextElement = rule[k + 1];
            
            // If there is no next element, get the follow of the current production
            if (nextElement === undefined) {
              getFollow(i);
              for (let follow of cacheFollow[i]) {
                cacheFollow[productionIdx].add(follow);
              }
              continue;
            }

            // If the next element is terminal, add it to the set
            if (typeof nextElement === 'string') {
              cacheFollow[productionIdx].add(nextElement);
              continue;
            }

            // If the next element is non-terminal add the first of the non-terminal to the set
            if (typeof nextElement === 'number') {
              for (let [prodI, ruleI] of getRuleEnumerater(nextElement)) {
                for (let first of cacheFirst[prodI][ruleI]) {
                  // Add the first of the non-terminal to the set
                  if (first !== '') {
                    cacheFollow[productionIdx].add(first);
                    continue;
                  }

                  // Otherwise find the follow of the non-terminal
                  getFollow(prodI);
                  for (let follow of cacheFollow[prodI]) {
                    // But then if this is an epsilon add the follow to the set and so on...
                    cacheFollow[productionIdx].add(follow);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Go in reverse order because terminals are likely to be at the end
  for (let i = grammar.length - 1; i >= 0; i--) {
    getFirstProduction(i);
  }

  print(cacheFirst);
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
