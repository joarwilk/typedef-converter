/* @flow */
import _ from 'lodash';
import getNodeName from './nodeName';

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

  else {
    switch (type.kind) {
      case "FunctionType":
      case "FunctionTypeAnnotation":
        return printBasicFunction(type);

      case "TypeLiteral":
        return printBasicInterface(type);
      
      case 'Identifier':
      case 'StringLiteralType':
        return type.text;

      case 'TypePredicate':
      case 'BindingElement':
      case 'TypeParameter':
        return type.name.text;

      case 'QualifiedName':
        return printType(type.left) + '.' + printType(type.right) + printGenerics(type.typeArguments);

      case 'TypeReference':
        return parseTypeReference(type);

      case 'LastNodeType':
        return `"${type.literal.text}"`;

      case 'PropertyDeclaration':
        if (type.modifiers && type.modifiers.some(modifier => modifier.kind === 'PrivateKeyword')) {
          return '';
        }

        if (type.parameters) {
          return type.name.text + ': ' + type.parameters.map(printParameter);
        }

        if (type.type) {
          return type.name.text + ': ' + printType(type.type)

        }

        return type.name.text + ': ';

      case 'TupleType':
        return `[${type.elementTypes.map(printType).join(', ')}]`

      
      case 'MethodSignature':
        return `${type.name.text}${printBasicFunction(type, true)}`

      case 'ExpressionWithTypeArguments':
        return printType(type.expression) + printGenerics(type.typeArguments);
        
      case 'PropertyAccessExpression':
        return `${type.expression.text}$${type.name.text}`;

      case 'PropertySignature':
        return printParameter(type)

      case 'CallSignature':
        return `(${type.name ? type.name : ''}): ${printType(type.type)}`

      case 'UnionType':
        return type.types.map(printType).join(' | ');

      case 'ArrayType':
        return printType(type.elementType) + '[]';

      case 'IndexSignature':
        return `[${type.parameters.map(printParameter).join(', ')}]: ${printType(type.type)}`

      case 'IntersectionType':
        return type.types.map(printType).join(' & ')

      case 'MethodDeclaration':
        return type.name.text + printBasicFunction(type, true);
      
      case 'ConstructSignature':
        return 'new ' + printBasicFunction(type, true);

      case 'TypeQuery':
        return 'typeof ' + type.exprName.text;

      case 'Constructor':
        return 'constructor(' + type.parameters.map(printParameter).join(', ') + '): this';

      case 'ParenthesizedType':
        return `(${printType(type.type)})`;
    }
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
  const params = func.parameters.map(printParameter).join(', ');
  const generics = printGenerics(func.typeParameters);
  const returns = printType(func.type);

  const firstPass = `${generics}(${params})${dotAsReturn ? ':' : ' =>'} ${returns}`;

  // Make sure our functions arent too wide
  if (firstPass.length > 80) {
    // break params onto a new line for better formatting
    const paramsWithNewlines = `\n\t\t${params}\n\t`;

    return `${generics}(${paramsWithNewlines})${dotAsReturn ? ':' : ' =>'} ${returns}`;
  }

  return firstPass;
}

const printFunction = (func) => {
  let str = `declare function ${func.name.text}${printBasicFunction(func, true)}`;

  return str;
}

const printBasicInterface = (interf, withSemicolons=false) => {
  const members = interf.members.map(printType).filter(Boolean).join(withSemicolons ? ';\n\t\t' : ',\n\t\t');

  return `{\n\t\t${members}\n\t}`;
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
  const heritage = node.heritageClauses.map(clause => printType(clause.types[0])).join(', ');
  const heritageStr = heritage.length > 0 ? `extends ${heritage}` : '';

  let str = `declare ${printExport(node)}class ${node.name.text}${printGenerics(node.typeParameters)} ${heritageStr} ${printBasicInterface(node, true)}`;

  return str;
}

const printExports = (node) => {
  if (node.isDefault) {
    return `declare module.exports: ${node.name}`
  }

  // I dont think this case will ever happen right now
  console.error('Encountered a non-default export to print');
  return '';
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
  let str = modules.filter(module => module.name !== 'rodpot').map(module => ('' +
    `declare module '${module.name}' {\n`+
      '\t' + (module.types.length ? module.types.map(printTypeAlias).join('\n\n\t') + '\n\n' : '') +
      '\t' + (module.interfaces.length ? module.interfaces.map(printInterface).join('\n\n\t') + '\n\n' : '') +
      '\t' + (module.functions.length ? module.functions.map(printFunction).join('\n\n\t') + '\n\n' : '') +
      '\t' + (module.classes.length ? module.classes.map(printClass).join('\n\n\t') + '\n\n' : '') +
      '\t' + (module.exports.length ? module.exports.map(printExports).join('\n\n\t') + '\n\n' : '') +
    '\n}'
  )).join('\n\n');

  return printImports(imports) + '\n\n' + str;
}

export const printSimpleTree = (tree) => {
  let str = _.map(tree.modules, (module, name) => ('' +
      (module.types.length ? module.types.join('\n') + '\n' : '') +
      (module.interfaces.length ? module.interfaces.join('\n') + '\n' : '') +
      (module.functions.length ? module.functions.join('\n') + '\n' : '') +
      (module.classes.length ? module.classes.join('\n') + '\n' : '') +
      (module.exports.length ? module.exports.join('\n') + '\n' : '')
  )).join('\n');

  return str;
}

export default finalPrint;
