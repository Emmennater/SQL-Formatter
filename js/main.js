function setup() {
  noCanvas();

  let [grammar, productions] = parseGrammarSyntax();

  stackMachine = ll1toStackMachine(grammar, productions);
  
  // Testing
  // setInputText("select 1 as num, 'test' as test from table t where (t.id = 1 and 1 and t.count = 0) and TRUE and 1 or FALSE and TRUE");
  setInputText("select count(*) from table1 cross join table2");
  formatCode();

  // tree = stackMachine.getParseTree(tokenize(input), "[Query]");
  // print(JSON.stringify(tree, null, 2));
}

function getInputText() {
  const textarea = document.getElementById('input');
  return textarea.value;
}

function setInputText(text) {
  const textarea = document.getElementById('input');
  textarea.value = text;
}

function parse(input) {
  return stackMachine.getParseTree(tokenize(input), "[Query]");
}

function formatCode() {
  const inputText = getInputText();
  const textarea = document.getElementById('output');
  const tree = parse(inputText);
  const formattedText = format(tree);
  textarea.value = formattedText;
}

function copyCode(e) {
  const text = document.getElementById('output').value;
  navigator.clipboard.writeText(text)
    .then(() => {
        Notification.show("Copied to clipboard!");
    })
    .catch(err => {
        console.error('Failed to copy text: ', err);
    });
}