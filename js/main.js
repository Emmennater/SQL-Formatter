function setup() {
  noCanvas();
  formatter = new Formatter();
}

function getInputText() {
  const textarea = document.getElementById('input');
  return textarea.value;
}

function setInputText(text) {
  const textarea = document.getElementById('input');
  textarea.value = text;
}

function formatCode() {
  const inputText = getInputText();
  const textarea = document.getElementById('output');
  const formattedText = formatter.format(inputText);
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