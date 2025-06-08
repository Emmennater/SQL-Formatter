const CHAR_START = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
const NUMBERS = "0123456789";
const KEYWORDS = new RegExp(
  "\\b(select|from|join|cross|where|group|order|by|having|limit|offset|union|intersect|" +
  "except|as|desc|asc|inner|left|right|full|on|and|or|not|is|null|true|outer|"+
  "false|case|when|then|else|end|fetch|first|rows|only|for|exists|any|all|" +
  "between|like|in|values|procedure|count|current_date|current_time|with|" +
  "current_timestamp|localtime|localtimestamp|current_user|session_user|" +
  "user|current_catalog|current_schema|current_role|current_database|distinct|" +
  "current_path|session_catalog|session_schema|session_role|session_database|" +
  "session_path|localtime|localtimestamp|localtime|localtimestamp|now|" +
  "sum|avg|min|max|count|abs|ceiling|floor|round|sqrt|log|ln|log10|exp|" +
  "pi|degrees|radians|sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|" +
  "asinh|acosh|atanh|bit_length|char_length|character_length|octet_length)\\b", "i");

function requiresSpacesLeft(str) {
  return (CHARS + "+-=('><").includes(str);
}

function requiresSpacesRight(str) {
  return (CHARS + "+-=)'><").includes(str);
}

class Formatter {
  constructor(breakComma = true) {
    this.text = "";
    this.out = "";
    this.i = 0;
    this.MAXITER = 10000;
    this.MAXLINELEN = 60;
    this.indent = 0;
    this.between = 0;
    this.breakComma = breakComma;
    this.lastMainKeyword = breakComma ? "" : "arguments";
  }

  reset() {
    this.i = 0;
    this.out = "";
    this.indent = 0;
    this.between = 0;
    this.lastMainKeyword = this.breakComma ? "" : "arguments";
  }

  isEnd() {
    return this.i >= this.text.length;
  }

  getIndent(add = 0) {
    return " ".repeat((this.indent + add) * 2);
  }

  peek(dist = 0) {
    if (this.i + dist > this.text.length) return "";
    return this.text.charAt(this.i + dist);
  }

  consume(n = 1, skip = false) {
    let str = "";
    for (let j = 0; j < n && !this.isEnd(); j++) {
      str += this.text.charAt(this.i++);
    }
    if (!skip) this.out += str;
    return str;
  }

  consumeWhitespace(skip = false) {
    let str = "";
    let iter = 0;
    while (/\s/.test(this.text.charAt(this.i)) && !this.isEnd()) {
      if (iter++ > this.MAXITER) throw "Too many iterations";
      str += this.consume(1, skip);
    }
    return str;
  }

  consumeSpaces(skip = false) {
    let str = "";
    let iter = 0;
    while (/ /.test(this.text.charAt(this.i)) && !this.isEnd()) {
      if (iter++ > this.MAXITER) throw "Too many iterations";
      str += this.consume(1, skip);
    }
    return str;
  }

  consumeUntil(until, skip = false) {
    let str = "";
    let end = this.text.substring(this.i).indexOf(until) + this.i;
    if (end === -1) end = this.text.length;
    for (let j = this.i; j < end; j++) {
      str += this.text.charAt(j);
    }
    this.i = end;
    if (!skip) this.out += str;
    return str;
  }

  consumeText(text, skip = false, dontCapitalize = false) {
    if (this.i + text.length > this.text.length) throw "Not enough text";

    for (let i = this.i; i < this.i + text.length; i++) {
      const c1 = this.text.charAt(i);
      const c2 = text.charAt(i - this.i);
      if (c1 !== c2) throw "Text mismatch";
    }

    const isKeyword = KEYWORDS.test(text);
    if (isKeyword && !dontCapitalize) text = text.toUpperCase();

    this.i += text.length;
    if (!skip) this.out += text;
  }

  consumeParens(skip = false) {
    this.consume(1, skip);
    let count = 1;
    let str = "";

    while (!this.isEnd()) {
      if (this.text.charAt(this.i) === "(") count++;
      if (this.text.charAt(this.i) === ")") count--;
      str += this.consume(1, skip);

      if (count === 0) break;
    }

    if (count !== 0) throw "Unbalanced parentheses";
    return str.substring(0, str.length - 1);
  }

  consumeQuotedString(skip = false) {
    this.consume(1, skip);
    let str = "";
    let esc = false;
    while (!this.isEnd()) {
      if (esc) {
        str += this.consume(1, skip);
        esc = false;
        continue;
      }
      if (this.text.charAt(this.i) === "'") break;
      if (this.text.charAt(this.i) === "\\") esc = true;
      str += this.consume(1, skip);
    }
    this.consume(1, skip);
    return str;
  }

  getWord() {
    let str = "";
    for (let i = this.i; i < this.text.length; i++) {
      if (!CHARS.includes(this.text.charAt(i))) break;
      str += this.text.charAt(i);
    }
    return str;
  }

  getNumber() {
    let str = "";
    let hasDecimal = false;
    for (let i = this.i; i < this.text.length; i++) {
      if (!NUMBERS.includes(this.text.charAt(i))) break;
      if (this.text.charAt(i) === ".") {
        if (hasDecimal) break;
        hasDecimal = true;
      }
      str += this.text.charAt(i);
    }
    return str;
  }

  removeNewlines(text) {
    let str = "";
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) !== "\n") { str += text.charAt(i); continue; }
      if (text.charAt(i - 1) !== " ") str += " ";
      while (i < text.length - 1 && /\s/.test(text.charAt(i + 1))) i++;
    }
    return str;
  }

  getCharsAfterNewline() {
    let str = "";
    for (let i = this.out.length - 1; i >= 0; i--) {
      if (this.out.charAt(i) === "\n") break;
      str = this.out.charAt(i) + str;
    }
    return str;
  }

  getCharsUntilNewline() {
    let str = "";
    let iter = 0;
    for (let i = this.i; i < this.text.length; i++) {
      if (this.text.charAt(i) === "\n") break;
      str += this.text.charAt(i);
    }
    return str;
  }

  isLineTooLong() {
    return this.getCharsAfterNewline().length + this.getCharsUntilNewline().length > this.MAXLINELEN;
  }

  nextLine() {
    if (this.out[this.out.length - 1] === "\n") return;
    this.out = this.out.trimEnd();
    this.consumeWhitespace(true);
    this.out += "\n" + this.getIndent();
    this.consumeWhitespace(true);
  }

  nextSpace() {
    if (this.out[this.out.length - 1] === " ") return;
    this.consumeWhitespace(true);
    this.out += " ";
  }

  processWord(word) {
    const lword = word.toLowerCase();

    if (["select", "create", "delimiter"].includes(lword)) {
      this.indent = 0;

      // Check for CTE
      let trimmedOut = this.out.trimEnd();
      if (trimmedOut.charAt(trimmedOut.length - 1) === ")") this.nextLine();
      
      this.nextLine();
      this.consumeText(word);
      this.nextSpace();
      this.indent += 1;
    } else if (["where", "limit", "drop"].includes(lword)) {
      this.indent = 0;
      this.nextLine();
      this.consumeText(word);
      this.nextSpace();
      this.indent += 1;
    } else if (["from", "having", "using"].includes(lword)) {
      this.indent = 0;
      this.nextLine();
      this.consumeText(word);
    } else if (lword === "union") {
      this.indent = 0;
      this.nextLine();
      this.consumeText(word);
      this.consumeWhitespace(true);
      let nextWord = this.getWord();
      if (nextWord.toLowerCase() === "all") {
        this.nextSpace();
        this.consumeText(this.getWord());
      }
      this.nextLine();
    } else if (["cross", "inner", "left", "right", "group", "order"].includes(lword)) {
      this.indent = 0;
      this.nextLine();
      this.consumeText(word);
      this.nextSpace();
      let nextWord = this.getWord();
      this.consumeText(nextWord);
      this.nextSpace();
      if (nextWord.toLowerCase() === "outer") {
        this.consumeText(this.getWord()); // "join"
        this.nextSpace();
      }
      this.indent++;
    } else if (["join"].includes(lword)) {
      this.nextLine();
      this.consumeText(word);
      this.nextSpace();
      this.indent++;
    } else if (["and", "or", "when", "else"].includes(lword)) {
      if (lword === "and" && this.between > 0) {
        this.between--;
      } else {
        this.nextLine();
      }
      
      this.consumeText(word);
      this.nextSpace();
    } else if (["case"].includes(lword)) {
      // Check for comma separated list
      let trimmedOut = this.out.trimEnd();
      if (trimmedOut.charAt(trimmedOut.length - 1) !== ",") this.nextLine();

      this.consumeText(word);
      this.nextSpace();
      this.indent += 1;
    } else if (["on"].includes(lword)) {
      // this.nextLine();
      this.nextSpace();
      this.consumeText(word);
      this.nextSpace();
      this.indent += 1;
    } else if (["end"].includes(lword)) {
      this.indent -= 1;
      this.nextLine();
      this.consumeText(word);
    } else if (lword === "between") {
      this.consumeText(word);
      this.nextSpace();
      this.between++;
    } else if (lword === "as") {
      this.nextSpace();
      this.consumeText(word);
      this.nextSpace();
    } else if (lword === "values") {
      this.nextLine();
      this.consumeText(word);
      this.indent += 1;
    } else {
      if (requiresSpacesRight(this.out[this.out.length - 1]) && requiresSpacesLeft(word[0])) this.nextSpace();
      this.consumeText(word);
    }

    if (["select", "from", "where", "group", "order", "having", "limit", "with", "union", "values"].includes(lword)) {
      this.lastMainKeyword = lword;
    }
  }

  processNext() {
    let next = this.peek();

    if (next === "-") {
      if (this.peek(1) === "-") {
        let i = -1;
        let lastChar = this.peek(i);
        while (lastChar === " ") lastChar = this.peek(--i);
        if (lastChar === "\n") {
          lastChar = this.peek(--i);
          while (lastChar === " ") lastChar = this.peek(--i);
          if (!["\n", ""].includes(lastChar)) {
            this.nextLine();
          }
        }
        this.out = this.out.trimEnd() + "\n";
        this.consume(2);
        this.nextSpace();
        while (this.peek() !== "\n" && !this.isEnd()) this.consume(1);
        this.nextLine();
        return;
      }
    } else if (next === "/") {
      if (this.peek(1) === "*") {
        this.consume(2);
        this.consumeUntil("*/");
        this.consumeText("*/");
      }
    }

    if (next === ";") {
      this.consume(1);
      this.indent = 0;
      this.out += "\n";
      this.consumeSpaces(true);
    } else if (next === "\n") {
      let skip = false;

      if (this.peek(-1) !== "\n") skip = true;

      this.consume(1, skip);
    } else if (next === " ") {
      this.nextSpace();
    } else if (NUMBERS.includes(next)) {
      if (requiresSpacesLeft(this.out[this.out.length - 1])) this.nextSpace();
      this.consumeText(this.getNumber());
    } else if (CHAR_START.includes(next)) {
      this.processWord(this.getWord());
    } else if (next === "(") {
      let captured = this.consumeParens(true);
      let formatted = (new Formatter()).format(captured).replaceAll("\n", "\n" + this.getIndent(1));
      let formattedNoNewline = this.removeNewlines(formatted);
      let lineTooLong = this.getCharsAfterNewline().length + formattedNoNewline.length > this.MAXLINELEN;
      if (lineTooLong) {
        this.out += `(\n${this.getIndent(1)}${formatted.trim()}\n${this.getIndent()})`;
      } else {
        this.out += `(${formattedNoNewline.trim()})`;
      }
    } else if (next === ",") {
      if (["limit", "order", "values", "arguments"].includes(this.lastMainKeyword)) {
        let lineTooLong = this.getCharsAfterNewline().length > this.MAXLINELEN;
        if (lineTooLong || this.lastMainKeyword === "values") {
          this.nextLine();
          this.consume(1);
          this.consumeWhitespace(true);
        } else {
          this.consume(1);
          this.nextSpace();
        }
      } else {
        this.nextLine();
        this.consume(1);
        this.consumeWhitespace(true);
      }
    } else if (next === "'") {
      if (requiresSpacesLeft(this.out[this.out.length - 1])) this.nextSpace();
      this.consumeQuotedString();
    } else if (next === ".") {
      this.consume(1);
      this.consumeWhitespace(true);
      this.consumeText(this.getWord(), false, true);
    } else {
      let left = this.out[this.out.length - 1];
      let right = next;
      if (requiresSpacesRight(left) && requiresSpacesLeft(right)) {
        if (!(left === "<" && right === ">" ||
          left === "[" && right === "]" ||
          left === "{" && right === "}" ||
          left === "(" && right === ")" ||
          left === "<" && right === "=" ||
          left === ">" && right === "="
        )) {
          this.nextSpace();
        }
      }
      this.consume(1);
    }
  }

  format(text) {
    this.reset();
    this.text = text.replaceAll("\t", "  ");
    this.text = text.split("\n").map(l => l.trim()).join("\n");
    let iter = 0;

    while (!this.isEnd()) {
      if (iter++ > this.MAXITER) throw "Too many iterations";
      this.processNext();
    }

    return this.out.trim();
  }
}
