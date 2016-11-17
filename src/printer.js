/* @flow */
import getNodeName from './nodeName.js';
import _ from 'lodash'

const Types = {
  VoidKeyword: 'void',
  StringKeyword: 'string',
  AnyKeyword: 'any',
  NumberKeyword: 'number',
  BooleanKeyword: 'boolean'
}

const printType = (type) => {
  if (Types[type.kind]) {
    return Types[type.kind];
  }

  else if (type.kind == "FunctionTypeAnnotation") {
    return printBasicFunction(type);
  }

  else if (type.kind == "FunctionType") {
    return printBasicFunction(type);
  }

  else if (type.kind == "TypeLiteral") {
    return printBasicInterface(type);
  }

  else if (type.kind === 'StringLiteralType') {
    return type.text;
  }

  else if (type.kind === 'QualifiedName') {
    return printType(type.left) + '.' + printType(type.right) + printGenerics(type.typeArguments)
  }

  else if (type.kind === 'TypeReference') {
    return parseTypeReference(type);
  }

  else if (type.kind === 'PropertySignature') {
    return printParameter(type)
  }

  else if (type.kind === 'PropertyDeclaration') {
    if (type.modifiers && type.modifiers.some(modifier => modifier.kind === 'PrivateKeyword')) {
      return '';
    }

    if (type.parameters) {
      return type.name.text + ': ' + type.parameters.map(printParameter);
    }

    if (type.type) {
      return type.name.text + ': ' + printType(type.type)

    }

    return type.name.text + ': '
  }

  else if (type.kind === 'CallSignature') {
    return `(${type.name}): ${printType(type.type)}`
  }

  else if (type.kind === 'UnionType') {
    return type.types.map(printType).join(' | ');
  }

  else if (type.kind === 'ArrayType') {
    return printType(type.elementType) + '[]';
  }

  else if (type.kind === 'IndexSignature') {
    return `[${type.parameters.map(printParameter).join(', ')}]: ${printType(type.type)}`
  }

  else if (type.kind === 'IntersectionType') {
    return type.types.map(printType).join(' & ')
  }

  else if (type.kind === 'MethodDeclaration') {
    return type.name.text + printBasicFunction(type, true);
  }

  else if (type.kind === 'Constructor') {
    return 'constructor(' + type.parameters.map(printParameter).join(', ') + '): this';
  }

  else if (type.kind === 'BindingElement') {
    return type.name.text;
  }

  else if (type.kind === 'TypeParameter') {
    return type.name.text;
  }

  else if (type.kind === 'Identifier') {
    return type.text;
  }

  else if (type.kind === 'ParenthesizedType') {
    return `(${printType(type.type)})`
  }

  else if (type.kind === 'MethodSignature') {
    return `${type.name.text}${printBasicFunction(type, true)}`
  }

  else if (type.kind === 'TypePredicate') {
    return type.text;
  }

  console.log('NO PRINT IMPLEMENTED', type)
  return 'NO PRINT IMPLEMENTED: ' + type.kind;
}

export const parseTypeReference = (node) => {
  if (node.typeName.left && node.typeName.right) {
    return printType(node.typeName) + printGenerics(node.typeArguments);
  }

  return node.typeName.text + printGenerics(node.typeArguments)
}

const printGenerics = (types) => (
  (types && types.length) ? `<${types.map(printType).join(', ')}>` : ''
)


const printParameter = (param) => {
  let left = param.name.text;

  if (param.name.kind === "ObjectBindingPattern") {
    left = `{${param.name.elements.map(printType).join(', ')}}`
  }

  let right = printType(param.type)

  if (param.questionToken) {
    left += '?';
  }

  if (param.dotDotDotToken) {
    left = '...' + left;
  }

  return `${left}: ${right}`;
}

const printExport = (node) => {
  let str = '';

  if (node.modifiers && node.modifiers.some(modifier => modifier.kind === 'ExportKeyword')) {
    str += 'export '
  }

  if (node.modifiers && node.modifiers.some(modifier => modifier.kind === 'DefaultKeyword')) {
    str += 'default '
  }

  return str;
}

const printBasicFunction = (func, dotAsReturn=false) => {
  const params = func.parameters.map(printParameter).join(',\n\t');
  const generics = printGenerics(func.typeParameters);
  const returns = printType(func.type);

  // If the function has params, break them onto a new
  // line for better formatting
  const paramsWithNewlines = `\n\t${params}\n`;

  const formattedParams = func.parameters.length > 1 && dotAsReturn ? paramsWithNewlines : params;

  return `${generics}(${formattedParams})${dotAsReturn ? ':' : ' =>'} ${returns}`;
}

const printFunction = (func) => {
  let str = `declare function ${func.name.text}${printBasicFunction(func, true)}`;

  return str;
}

const printBasicInterface = (interf, withSemicolons=false) => {
  const members = interf.members.map(printType).filter(Boolean).join(withSemicolons ? ';\n\t' : ',\n\t');

  return `{\n\t${members}\n}`;
}

const printInterface = (node) => {
  let str = `declare ${printExport(node)}interface ${node.name.text}${printGenerics(node.typeParameters)} ${printBasicInterface(node)}`;

  return str;
}

const printTypeAlias = (node) => {
  let str = `declare ${printExport(node)}type ${node.name.text}${printGenerics(node.typeParameters)} = ${printType(node.type)};`;

  return str;
}

const printClass = (node) => {
  return printDeclaration(node, 'class', printBasicInterface.bind(null, node, true))
}

const printDeclaration = (node, keyword, printer) => {
    let str = `declare ${printExport(node)}${keyword} ${node.name.text}${printGenerics(node.typeParameters)} ${printer()}`;

    return str;
}

const printExports = (node) => {
  return `export ${node.isDefault ? 'default ' : ''}${node.name}`;
}

const printImports = (nodes) => {
  return _.map(nodes, (node, module) => { 
    let str = 'import type ';

    if (node.default) {
      str += node.default;

      if (node.explicit.length) {
        str += ', ';
      }
    }

    if (node.explicit.length) {
      str += `{ ${node.explicit.join(', ')} }`;
    }

    str += ` from '${module}'`;

    return str;
  }).join('\n');
}

const finalPrint = ({ imports, modules }) => {
  let str = modules.filter(module => module.name !== 'rodot').map(module => (`
    declare module '${module.name}' {
      ${module.types.length ? module.types.map(printTypeAlias).join('\n\n') : ''}
      ${module.interfaces.length ? module.interfaces.map(printInterface).join('\n\n') : ''}
      ${module.functions.length ? module.functions.map(printFunction).join('\n\n') : ''}
      ${module.classes.length ? module.classes.map(printClass).join('\n\n') : ''}
      ${module.exports.length ? module.exports.map(printExports).join('\n\n') : ''}
    }`
  )).join('\n\n');

  return printImports(imports) + '\n\n' + str;
}

export default finalPrint;
