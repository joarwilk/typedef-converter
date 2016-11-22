/* @flow */
import _ from 'lodash'
const nodes = {};

// A context is essentially a module
const createContext = () => ({
    functions: [],
    classes: [],
    types: [],
    variables: [],
    interfaces: [],
    imports: [],
    exports: []
});

// Store the node in our ref cache and return the ID
const createNodeReference = (node, context, kind) => {
    const id = Math.random() + context + '/' + kind + '/' + (node.name.text ? node.name.text : node.name);

    nodes[id] = node;

    return id;
}

// Get a node from the ref cache
const getFullNodeById = (id: string) => {
    if (!nodes[id]) {
        console.error('Trying to reference invalid node: ' + id);
        return null;
    }

    return nodes[id];
}

// Initialize the tree. This should not be a global variable in the future
const tree = {
    namespaces: [],
    modules: {
        root: createContext()
    },
    imports: []
}

const namespaceNameToModuleName = (namespace: string) => {
    return `npm$namespace$${namespace}`;
}

// Look up what all collected variables are referring to
// TODO: Stop mutating the tree
const resolveVariableReferences = () => {
    // Iterate all the modules in the tree
    _.forEach(tree.modules, (node, context) => {
        node.variables.forEach(id => {
            const variable = getFullNodeById(id);

            // Check the variable is pointing at a namespace we've registered
            // NOTE: This only supports one level of nesting. Does it need more?
            if (tree.namespaces.includes(variable.valueContext)) {
                // Import single item from namespace
                tree.imports.push({
                    type: 'explicit', // Explicit import types are in the style of 
                                      // import { name } from 'module'
                    what: variable.value,
                    from: namespaceNameToModuleName(variable.valueContext)
                });
            } else if (tree.namespaces.includes(variable.value)) {
                // Import default from the namespace
                tree.imports.push({
                    type: 'default',
                    what: variable.name, // the name is the same as the import in this case
                    from: namespaceNameToModuleName(variable.value)
                });
            }
        });
    });
}

const exportRaw = () => {
    return _.clone(tree);
}

const exportFormatted = () => {
    // Start off by solving and linking any variable references
    resolveVariableReferences();

    const modules = _.map(tree.modules, (node, context) => {
        node.exports.forEach(id => {
            // Get the full export object
            const exportDeclr = getFullNodeById(id);

            if (!exportDeclr) {
                return;
            }
            
            let variable;
            try {
                // Obtain the variable the export is pointing to through a shady fetch
                variable = getFullNodeById(context + '/variables/' + exportDeclr.name)
            } catch (e) {
                // Look in the root context for this variable
                variable = getFullNodeById('root/variables/' + exportDeclr.name)
            }

            if (!variable) {
                return;
            }

            // Set the export to the value of the variable its pointing to
            exportDeclr.name = variable.value;
        });

        // Return a basic module representation
        return {
            name: context,
            functions: node.functions.map(getFullNodeById),
            classes: node.classes.map(getFullNodeById),
            types: node.types.map(getFullNodeById),
            interfaces: node.interfaces.map(getFullNodeById),
            exports: node.exports.map(getFullNodeById),
        }
    });


    return {
        imports: normalizeImports(tree.imports),
        modules
    }
}

// Collect all imports and remove duplicates
const normalizeImports = (allImports) => {
    const imports = {};
    allImports.forEach(node => {
        if (!imports[node.from]) {
            imports[node.from] = {
                explicit: [],
                default: false
            };
        }

        if (node.type === 'default') {
            imports[node.from].default = node.what;
        } else if (!imports[node.from].explicit.includes(node.what)){
            imports[node.from].explicit.push(node.what);
        }
    });

    return imports;
}

const pushNamespace = (namespace: string) => {
    tree.namespaces.push(namespace);
}

const insertNodeIntoTree = (node, context, kind) => {
    if (!tree.modules[context]) {
        tree.modules[context] = createContext();
    }

    if (!node) {
        throw new Error('Trying to insert invalid node');
    }

    tree.modules[context][kind].push(createNodeReference(node, context, kind));
}

const pushFunction = (node, context: string) => {
    insertNodeIntoTree(node, context, 'functions');
}

const pushInterface = (node, context: string) => {
    insertNodeIntoTree(node, context, 'interfaces');
}

const pushType = (node, context: string) => {
    insertNodeIntoTree(node, context, 'types');
}

const pushClass = (node, context: string) => {
    insertNodeIntoTree(node, context, 'classes');
}

const pushVariable = (node, context: string) => {
    insertNodeIntoTree(node, context, 'variables');
}

const pushExport = (node, context: string) => {
    insertNodeIntoTree(node, context, 'exports');
}

const pushImport = (node, context: string) => {
    tree.imports.push(node);
}

export default {
    pushClass,
    pushType,
    pushVariable,
    pushInterface,
    pushFunction,
    pushExport,
    pushImport,
    pushNamespace,

    // Where the magic happens
    exportFormatted,
    exportRaw
}