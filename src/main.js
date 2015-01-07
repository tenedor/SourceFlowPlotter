/*
 * SFP operates on source flow data extracted in a program trace. This data has
 * two parts, the control flow tree and the source code. Upon fetching this data,
 * this file traces the flow tree to collect flow point nodes into one array and
 * flow group nodes into another. These and the fetched data are passed to a
 * plotter. The object passed to the plotter contains:
 *
 *  `flowPoints`: an array of flow point nodes.
 *  `flowGroups`: an array of flow group nodes.
 *  `flowTree`: the root node of the control flow tree.
 *  `sourceCode`: an object with an array of code lines for each source file.
 *  `_data`: the JSON-decoded data object fetched from the server.
 */


(function(){

// for now, data is hardcoded to a demo script called `test.py`
var DATA_URL = 'data/test.py.trace.json';
var FILE_NAME = 'test.py';


// begin: create plotter and fetch flow points data for it
$(document).ready(function() {
  sfp.plotter = new sfp.Plotter();

  // fetch, parse, and set up data, then pass it to the plotter
  $.getJSON(DATA_URL, function(data) {
    setUpData(data, sfp.plotter.update);
  });
});


// parse and set up flow points data
var setUpData = function(data, callback) {
  var flowGroups, flowGroupCount, flowPoints, flowPointCount, childrenTypes,
      queue, node, i, children, j, sourceCode;

  flowGroups = [];
  flowGroupCount = 0;
  flowPoints = [];
  flowPointCount = 0;

  childrenTypes = [
    'internalChildren',
    'externalChildren',
    'recursiveInternalChilden'
  ];

  // crawl tree
  queue = [data.flowTree]
  while (node = queue.pop()) {
    // add data container for sfp-specific, mutable data
    // NOTE: treat everything outside a node's data container as immutable
    node.d = {}

    // add node to appropriate list
    switch (node.type) {
      case 'root':
        break;
      case 'flowGroup':
        flowGroups[node.id] = node;
        flowGroupCount++;
        break;
      case 'flowPoint':
        flowPoints[node.id] = node;
        flowPointCount++;
        break;
      default:
        console.log('Error: invalid node type "' + node.type + '". Node:');
        console.log(node);
    };

    // add node as parent of and enqueue each child
    for (i = 0; i < childrenTypes.length; i++) {
      children = node[childrenTypes[i]];
      if (children) {
        for (j = 0; j < children.length; j++) {
          children[j].parent = node;
          queue.push(children[j]);
        };
      };
    };
  };

  // check that the length of each node type array meets expectations
  if (flowGroups.length !== flowGroupCount)
    console.log('Warning: flow group node ids are not unique and consecutive.');
  if (flowPoints.length !== flowPointCount)
    console.log('Warning: flow point node ids are not unique and consecutive.');

  // set up source code
  // TODO: generalize beyond one single file
  sourceCode = data.sourceCode[FILE_NAME];
  sourceCode.unshift(undefined);

  _.isFunction(callback) && callback({
    flowPoints: flowPoints,
    flowGroups: flowGroups,
    sourceCode: sourceCode,
    flowTree: data.flowTree,
    _data: data
  });
};

}).call(this);
