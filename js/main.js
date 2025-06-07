function setup() {
  noCanvas();
  
  let [grammar, productions] = parseGrammarSyntax();

  let parsingTable = ll1toParsingTable(grammar, productions);

  // stackMachine = ll1toStackMachine(grammar, productions);
  // tree = stackMachine.getParseTree(tokenize(input), "[Query]");
  // print(JSON.stringify(tree, null, 2));

  // getParseTree(grammar, productions, "SELECT * FROM table;\nSELECT *, test.x FROM table;--testsing test(1+1)\ntest");
}

function getInputText() {
  const textarea = document.getElementById('input');
  return textarea.value;
}

function formatCode() {
  const inputText = getInputText();
  const tree = parse(inputText);
  const formattedText = format(tree);
  const textarea = document.getElementById('output');
  textarea.value = formattedText;
}