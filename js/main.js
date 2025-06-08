function setup() {
  noCanvas();

  formatter = new Formatter();

  // Testing
  // setInputText("select 1 as num, 'test' as test from table t where (t.id = 1 and 1 and t.count = 0) and TRUE and 1 or FALSE and TRUE");
  // setInputText("select count(*) from table1 cross join table2;");
  setInputText(`with
    
    test as (select  
  1 as num, 'test'    as test
from 
table t 
inner   
join table2 t2 on      t1.id=t2.id
where   


 (t.id = 1 
and 1 and t.name in ('test', 'test2', 'test3', 'test4') and

t.count.count(1) =  0

and true and(false or false and 1> 0 or true and (not false)))
and TRUE and 1 or FALSE and



    TRUE
having count(*) > 0), foo as (select * from test)
select * from foo;`);
  // setInputText("select * from table;");
  formatCode();
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