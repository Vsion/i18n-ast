const fs = require('fs');
const babel = require("babel-core");
const t = require('@babel/types');

const translateWords = [];
const replaceList = {};
const randomStr = () => Math.random().toString(36).substr(2);

function baseType (v) {
  return Object.prototype.toString.call(v)
}

const transformOptions = {
  sourceType: "module",
  code: false,
  plugins: ["syntax-jsx", "syntax-class-properties", "syntax-object-rest-spread", 'babel-plugin-syntax-decorators', reactPlugin]
}

function translateTo (filePath, option) {
  // const fileContent = fs.readFileSync(filePath, { encoding:"utf-8" })
  return {
    ast: babel.transformFileSync(filePath, option || transformOptions),
    replaceList,
    translateWords,
    randomStr
  }
}

function judgeChinese(text) {
  return /[\u4e00-\u9fa5]/.test(text);
}

function makeReplace({value, random, variableObj}) {
  console.log('t.StringLiteral(value)', t.StringLiteral(value))
  return t.CallExpression(
    t.MemberExpression(
      t.CallExpression(
        t.MemberExpression(
          t.Identifier("intl"),
          t.Identifier("get")
        ),
        setObjectExpression(variableObj) ? [t.StringLiteral(random || randomStr()), setObjectExpression(variableObj)] : [t.StringLiteral(random || randomStr())]
      ),
      t.Identifier("d"),
    ),
    [t.StringLiteral(value)]
  );
}

function setObjectExpression(obj) {
  if(baseType(obj) === '[object Object]') {
    const ObjectPropertyArr = [];
    for(const o in obj) {
      ObjectPropertyArr.push(
        t.ObjectProperty(t.Identifier(o), t.Identifier(obj[o]))
      )
    }
    return t.ObjectExpression(ObjectPropertyArr)
  }
  return null;
}

function reactPlugin ({ types: t }) {
  return {
    visitor: {
      JSXText(path) {
        const { node } = path;
        if (judgeChinese(node.value)) {
          path.replaceWith(
            t.JSXExpressionContainer(makeReplace({
              value: node.value.trim().replace(/\n\s+/g, "\n")
            }))
          );
        }
        path.skip();
      },
      CallExpression(path) {
        // 跳过 intl.get() 格式
        if (path.node.callee.type === "MemberExpression") {
          if(path.node.callee.object.name === "intl") path.skip();
          if(path.node.callee.object.callee && path.node.callee.object.callee.type === 'MemberExpression') {   
            if(path.node.callee.object.name === "intl") path.skip();
          }
        }
      },
      StringLiteral(path) {
        const { node } = path;
        const { value } = node;
        if (judgeChinese(value)) {
          if (path.parent.type === 'JSXAttribute') {
            path.replaceWith(t.JSXExpressionContainer(makeReplace({
              value: value.trim()
            })));
          } else if(path.parent.type === 'ObjectProperty') {
            path.replaceWith(makeReplace({
              value: value.trim()
            }));
          } else if(path.parent.type === 'AssignmentExpression') {
            path.replaceWith(makeReplace({
              value: value.trim()
            }));
          } else {
            path.replaceWith(makeReplace({
              value: value.trim()
            }));
          }
          path.skip();
        }
      },
      TemplateLiteral(path) {
        const tempArr = [].concat(path.node.quasis, path.node.expressions).sort(function(a,b){
          return a.start - b.start;
        })
        let isreplace = true;
        let v = '';
        const variable = {}
        tempArr.forEach(function(t) {
          if(t.type === 'TemplateElement') {
            v += `${t.value.cooked} `;
          } else if(t.type === 'Identifier') {
            variable[t.name] = t.name;
            v += `{${t.name}} `
          } else if(t.type === 'CallExpression') {
            // TODO
            isreplace = false;
          } else {
            // ...TODO
            isreplace = false;
          }
        })
        if(!isreplace) {
          path.skip();
          return
        }
        if(v.trim() === '') {
          path.skip();
          return
        }
        path.replaceWith(makeReplace({
          value: v,
          variableObj: variable,
        }));
        path.skip();
      }
    }
  };
}

module.exports = translateTo;