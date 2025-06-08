const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function requiresSpacesLeft(str) {
  return (CHARS + "+-=('").includes(str);
}

function requiresSpacesRight(str) {
  return (CHARS + "+-=)',").includes(str);
}

function getNextSymbol(tree, start) {
  for (let i = start; i < tree.children.length; i++) {
    if (typeof tree.children[i] === "string") return tree.children[i];
    if (tree.children[i].children.length > 0) {
      let nextSymbol = getNextSymbol(tree.children[i], 0);
      if (nextSymbol !== undefined) return nextSymbol;
    }
  }

  return undefined;
}

function removeEmptyChildren(tree) {
  for (let i = tree.children.length - 1; i >= 0; i--) {
    const child = tree.children[i];
    if (typeof child === 'string') continue;
    
    if (tree.children[i].children.length === 0) {
      tree.children.splice(i, 1);
    } else {
      removeEmptyChildren(tree.children[i]);
    }
  }
}

function applyFormatting(tree) {
  const { type } = tree;

  if (type === 'string') {
    tree.children = ["'" + tree.children[0] + "'"];
  } else if (['fromclause', 'whereclause', 'groupbyclause', 'havingclause', 'orderbyclause', 'limitclause'].includes(type)) {
    tree.before = '\n';
  }

  if (type === 'whereclause' &&
    tree.children[1].type === 'boolexpr'
  ) {
    const boolexpr = tree.children[1];
    boolexpr.indent = 1;
    if (boolexpr.children[1]) {
      boolexpr.children[1].before = '\n';
    }
    if (boolexpr.children[0]) {
      if (boolexpr.children[0].children[1]) {
        boolexpr.children[0].children[1].before = '\n';
      }
    }
  }

  let doprint = false;
  for (let child of tree.children) {
    if (typeof child === 'string') {
      doprint = true;
      break;
    }
  }

  if (doprint) print(tree);
}

function formatFlatten(tree, indent = 0) {
  
  if (typeof tree === "string") {
    return [`${tree}`];
  }
  
  removeEmptyChildren(tree);
  applyFormatting(tree);
  
  let out = [];
  let nextIndent = indent + (tree.indent ?? 0);
  let before = tree.before ?? '';
  let after = tree.after ?? '';
  let tabs = "  ".repeat(nextIndent);

  if (before) out.push(`${before}${tabs}`);

  for (let child of tree.children) {
    out.push(...formatFlatten(child, nextIndent));
  }

  if (after) out.push(`${after}`);

  return out;
}

function format(tree) {
  if (!tree) return "";

  if (typeof tree === "string") return tree;

  let tokens = formatFlatten(tree);
  let out = "";

  for (let i = 0; i < tokens.length; i++) {
    out += tokens[i];

    if (i === tokens.length - 1) continue;
  
    let curr = tokens[i];
    let next = tokens[i + 1];

    if (requiresSpacesRight(curr[curr.length - 1]) && requiresSpacesLeft(next[0])) out += " ";
  }

  return out;
}
