/*

 ** Overview **
 ==============

 A plotter operates on source flow data extracted in a program trace. After
 being initialized, a plotter instance should be updated with a source flow data
 object containing the following properties:

  `flowPoints`: an array of flow point nodes.
  `flowGroups`: an array of group nodes.
  `flowTree`: the root node of the control flow tree.
  `sourceCode`: an object with an array of code lines for each source file.
  `_data`: the JSON-decoded data object fetched from the server.

 In its update call, the plotter stores this object in its `originalData`
 property. The original data is successively transformed through filter and
 index operations. These operations are run each time the filter or the index
 mode changes, and the most recent output of each operation is stored as
 `filteredData` or `indexedData`. Each time `indexedData` is recomputed it is
 passed to the plot views through their update methods.


 ** Control flow tree node formats **
 ====================================

 NOTE: treat everything outside a node's data container as immutable.

 rootNode = {
   // -- READ ONLY! -- //
   type: 'root',
   id: 'root',
   name: 'root',
   parent: null,
   depth: -1,
   externalChildren: [flowGroup, ...],
   externalCodeLineRanges: {<fileID>: [[first, last], ...], ...},
   stepRange: [0, last],
   timeRange: [0, exit]

   // -- data container -- //
   d: {...}
 }

 flowGroupNode = {
   // -- READ ONLY! -- //
   type: 'flowGroup',
   id: flowGroupUID,
   uid: 'flowGroup:' + flowGroupUID,
   fileName: fileName,
   lineNumber: lineNumber,
   name: functionName,
   parent: parent,
   depth: depth,
   internalChildren: [child, ...],
   internalCodeLineRange: [first, last],
   externalChildren: [flowGroup, ...],
   externalCodeLineRanges: {<fileID>: [[first, last], ...], ...},
   recursiveInternalChilden: [flowGroup, ...],
   recursiveInternalCodeLineRanges: [[first, last], ...],
   stepRange: [first, last],
   timeRange: [enter, exit],

   // -- data container -- //
   d: {...}
 }

 flowPointNode = {
   // -- READ ONLY! -- //
   type: 'flowPoint',
   id: flowPointUID,
   uid: 'flowPoint:' + flowPointUID,
   fileName: fileName,
   lineNumber: lineNumber,
   code: codeLines[fileName][lineNumber],
   parent: parent,
   depth: depth,
   internalChildren: [child, ...],
   internalCodeLineRange: [first, last],
   externalChildren: [flowGroup, ...],
   externalCodeLineRanges: {<fileID>: [[first, last], ...], ...},
   recursiveInternalChilden: [child, ...],
   recursiveInternalCodeLineRanges: [[first, last], ...],
   stepRange: [first, last],
   timeRange: [enter, exit],
   individualStepIndex: step,
   individualTimeRange: [enter, exit],

   // -- data container -- //
   d: {...}
 }

 */


(function(){

var util = sfp.util;
var views = sfp.views;


// Plotter Class
// -------------

var Plotter = sfp.Plotter = function(options) {
  this.options = options || {};
  this.eventHub = this.options.eventHub || this;
  this._bindMethods(this.bindList);
  this.initialize();
};


// Instance Methods
// ----------------

_.extend(Plotter.prototype, Backbone.Events, {

  // layout configs
  LAYOUT: {
    svg: {
      height: 560, width: 560, transform: '',
      plot: {
        height: 450, width: 550, transform: 'translate(50, 10)',
        indexAxis: {
          height: 50, width: 500, transform: 'translate(0, 400)',
          indexNumbers: {height: 15, width: 500, transform: 'translate(0, 20)'}
        },
        codeLineAxis: {
          height: 400, width: 50, transform: 'translate(-50, 0)',
          codeLineNumbers: {
            height: 400, width: 15, transform: 'translate(35, 0)'
          }
        },
        plotBody: {
          height: 400, width: 500, transform: '',
          codeLines: {height: 400, width: 400, transform: ''},
          barSelectorsContainer: {
            height: 400, width: 500, transform: '',
            indexBarSelectors: {height: 400, width: 500, transform: ''},
            codeBarSelectors: {height: 400, width: 500, transform: ''}
          },
          flowGroupBars: {height: 400, width: 500, transform: ''},
          flowPointBars: {height: 400, width: 500, transform: ''}
        }
      },
      codeText: {height: 100, width: 500, transform: 'translate(50, 460)'}
    }
  },


  bindList: {
    update: 'bind',
    updateFilter: 'bind',
    updateIndexMode: 'bind',
    filterData: 'bind',
    indexData: 'bind',
    updatePlot: 'bind',
    showSideEffectText: 'bind',
    hideSideEffectText: 'bind',
    parseFilterString: 'bind'
  },


  _bindMethods: function(methodNames) {
    var methodName, bindType, bind;

    for (methodName in methodNames) {
      bindType = methodNames[methodName];
      if (bindType) {
        bind = (bindType === 'passFutureContext') ?
            util.bindButPassFutureContext : _.bind;
        this[methodName] = bind(this[methodName], this);
      };
    };
  },


  initialize: function() {
    this.filter = {};
    this.indexMode = 'step';

    this.initializePlot();
    this.initializeListeners();
    this.initializeAuxiliaryLayout();
  },


  initializePlot: function() {
    var layout, svg;

    // svg
    layout = this.LAYOUT.svg;
    svg = d3.select('.svg-container > svg')
      .attr('width', layout.width)
      .attr('height', layout.height);
      //.attr('viewbox', '0, 0, 100, 100');

    this.plot = new views.Plot(
        svg.select('g.plot'),
        layout.plot,
        {eventHub: this.eventHub});
    this.codeText = new views.CodeText(
        svg.select('text.code-text'),
        layout.codeText,
        {eventHub: this.eventHub});
  },


  initializeListeners: function() {
    // TODO: handle possibility that these functions are triggered before data
    this.on('filter:changed', this.filterData);
    this.on('filteredData:changed', this.indexData);
    this.on('indexMode:changed', this.indexData);
    this.on('indexedData:changed', this.updatePlot);

    this.on('show:sideEffects', this.showSideEffectText);
    this.on('hide:sideEffects', this.hideSideEffectText);
  },


  initializeAuxiliaryLayout: function() {
    var that = this;

    this.indexModeButtons = d3.selectAll('.index-mode-buttons > button');
    this.filterInputField = d3.select('input.filter');
    this.sideEffectsTextField = d3.select('.side-effect');

    // listen for index mode changes
    this.indexModeButtons.on('click', function(){
      that.updateIndexMode(d3.select(this).attr('data-index-mode'));});
    this.updateIndexMode(this.indexMode, {silent: true});

    // listen for flow point group display changes
    this.groupsToggleButton = d3.select('button.groups-toggle');
    this.groupsToggleButton.on('click', function(){
      d3.select('.plot-body').classed('hide-groups',
        !d3.select('.plot-body').classed('hide-groups'));});

    // listen for flow point tail display changes
    this.tailsToggleButton = d3.select('button.tails-toggle');
    this.tailsToggleButton.on('click', function(){
      d3.select('.plot-body').classed('hide-tails',
        !d3.select('.plot-body').classed('hide-tails'));});

    // listen for filter updates
    this.filterInputField.on('keyup', function() {
      var filter;
      if (d3.event.keyCode === util.keys.ENTER) {
        filter = that.parseFilterString(that.filterInputField.node().value);
        if (filter.valid) {
          that.updateFilter(filter);
        } else {
          that.filterInputField.classed('error', true);
          setTimeout(function(){
            that.filterInputField.classed('error', false)}, 0);
        };
      };
    });
  },


  update: function(data) {
    this.originalData = {
      flowPoints: data.flowPoints,
      flowGroups: data.flowGroups,
      sourceCode: data.sourceCode,
      flowTree: data.flowTree,
      _data: data._data
    };

    this.filterData({silent: true});
    this.indexData({silent: true});

    // set code text data and render the plot
    this.codeText.update({
      sourceCode: this.originalData.sourceCode,
      codeLinesDomain: this.codeLinesDomain(this.originalData.sourceCode)
    });
    this.updatePlot();
  },


  updateFilter: function(filter, options) {
    if (this.filter !== filter) {
      this.filter = filter;

      if (!(options && options.silent)) {
        this.trigger('filter:changed');
      };
    };
  },


  updateIndexMode: function(indexMode, options) {
    this.indexModeButtons
      .classed('selected', function(){
        return d3.select(this).attr('data-index-mode') === indexMode;});

    if (this.indexMode !== indexMode) {
      this.indexMode = indexMode;

      if (!(options && options.silent)) {
        this.trigger('indexMode:changed');
      };
    };
  },


  filterData: function(options) {
    var originalFlowPoints, sourceCode, codeLinesDomain;

    // TODO: protect originalData by limiting access through a cloning getter
    // TODO: this clone doesn't work. do we even want this given `.d` property?
    originalFlowPoints = util.nLevelClone(this.originalData.flowPoints, 2);
    sourceCode = this.originalData.sourceCode;
    codeLinesDomain = this.codeLinesDomain(sourceCode, this.filter);
    codeLineNumbers = _.range(codeLinesDomain[0], codeLinesDomain[1] + 1);

    this.filteredData = {
      flowPoints: this.filterFn(originalFlowPoints),
      flowGroups: this.originalData.flowGroups, // TODO - filter
      sourceCode: sourceCode,
      codeLinesDomain: codeLinesDomain,
      codeLineNumbers: codeLineNumbers
    };

    if (!(options && options.silent)) {
      this.trigger('filteredData:changed');
    };
  },


  indexData: function(options) {
    var flowPoints, flowGroups, flowNodes, index, indexSummary, indexMin,
        indexMax;

    // index flow nodes
    // TODO: this clone doesn't work. do we even want this given `.d` property?
    flowPoints = util.nLevelClone(this.filteredData.flowPoints, 2);
    flowGroups = util.nLevelClone(this.filteredData.flowGroups, 2);
    flowNodes = flowPoints.concat(flowGroups);
    index = Plotter.INDICES[this.indexMode];
    indexSummary = index.fn(flowNodes);
    indexMin = indexSummary.indexMin;
    indexMax = indexSummary.indexMax;

    this.indexedData = {
      flowPoints: flowPoints,
      flowGroups: flowGroups,
      sourceCode: this.filteredData.sourceCode,
      codeLinesDomain: this.filteredData.codeLinesDomain,
      codeLineNumbers: this.filteredData.codeLineNumbers,
      indexDomain: [indexMin, indexMax],
      index: index
    };

    if (!(options && options.silent)) {
      this.trigger('indexedData:changed');
    };
  },


  updatePlot: function() {
    // TODO: handle case where the filter has selected no flow points
    this.plot.update(this.indexedData);
  },


  showSideEffectText: function(sideEffects) {
    this.sideEffectsTextField.text((sideEffects && sideEffects[0]) || '');
  },


  hideSideEffectText: function() {
    this.sideEffectsTextField.text('');
  },


  // TODO: class method?
  filterFn: function(flowPoints) {
    var filter, min, max;

    filter = this.filter;
    if (_.isArray(filter.lines) && filter.lines.length) {
      min = filter.lines[0][0];
      max = filter.lines[0][1];
      flowPoints = _.filter(flowPoints, function(flowPoint){
        return (min <= flowPoint.lineNumber && flowPoint.lineNumber <= max);});
    };

    return flowPoints;
  },


  codeLinesDomain: function(sourceCode, filter) {
    var lowest, highest, domain;

    // unfiltered domain
    // TODO: generalize beyond single file and single domain range
    lowest = _.find(sourceCode); // find first non-empty code line
    highest = sourceCode[sourceCode.length - 1];
    domain = [lowest.codeLineNumber, highest.codeLineNumber];

    // if filter is given, restrict domain based on filter
    if (filter && _.isArray(filter.lines) && filter.lines.length) {
      domain[0] = Math.max(domain[0], filter.lines[0][0]);
      domain[1] = Math.min(domain[1], filter.lines[0][1]);
    };

    return domain;
  },


  // TODO: class method?
  parseFilterString: function(filterString) {
    var filter, filterStrings, linesRE, i, matchedFilter, j, linesFilter, start,
        end;
    filter = {lines: [], valid: true};
    filterStrings = filterString.split(';');
    linesRE = /^ *lines:? ([0-9][0-9\-, ]*)$/;
    for (i = 0; i < filterStrings.length; i++) {
      if (!filterStrings[i].trim()) {
        continue;
      };
      matchedFilter = filterStrings[i].match(linesRE);
      if (matchedFilter) {
        matchedFilter = matchedFilter[1].split(',');
        for (j = 0; j < matchedFilter.length; j++) {
          linesFilter = matchedFilter[j].match(/([0-9]+)-?([0-9]+)?/);
          if (linesFilter) {
            start = linesFilter[1];
            end = linesFilter[2] || linesFilter[1];
            filter.lines.push([start, end]);
          } else {
            filter.valid = false;
          };
        };
      } else {
        filter.valid = false;
      };
    };
    return filter;
  }

});


// Class Methods
// -------------

/*

flowGroupNode = {
  type: 'flowGroup',
  id: flowGroupUID,
  uid: 'flowGroup:' + flowGroupUID,
  stepRange: [first, last],
  timeRange: [enter, exit],
}

flowPointNode = {
  type: 'flowPoint',
  id: flowPointUID,
  uid: 'flowPoint:' + flowPointUID,
  stepRange: [first, last],
  timeRange: [enter, exit],
  individualStepIndex: step,
  individualTimeRange: [enter, exit],

 */

var stepIndexed = Plotter.stepIndexed = function(flowNodes) {
  var stats = {
    indexMin: Infinity,
    indexMax: -Infinity
  };

  _.each(flowNodes, function(flowNode) {
    var d = flowNode.d;
    d.self || (d.self = {});
    d.full || (d.full = {});

    if (flowNode.type == 'flowPoint') {
      d.self.index = flowNode.individualStepIndex;
      d.self.length = 0.8;
    } else {
      delete d.self.index;
      delete d.self.length;
    };

    d.full.index = flowNode.stepRange[0];
    d.full.length = 0.8 + flowNode.stepRange[1] - flowNode.stepRange[0];

    // update stats
    if (d.full.index < stats.indexMin)
      stats.indexMin = d.full.index;
    if (stats.indexMax < d.full.index + d.full.length)
      stats.indexMax = d.full.index + d.full.length;
  });

  return stats;
};


var timeIndexed = Plotter.timeIndexed = function(flowNodes) {
  var stats = {
    indexMin: Infinity,
    indexMax: -Infinity
  };

  _.each(flowNodes, function(flowNode) {
    var d, timeRange;
    d = flowNode.d;
    d.self || (d.self = {});
    d.full || (d.full = {});

    timeRange = flowNode.individualTimeRange;
    if (flowNode.type == 'flowPoint') {
      d.self.index = timeRange[0];
      d.self.length = timeRange[1] - timeRange[0];
    } else {
      delete d.self.index;
      delete d.self.length;
    };

    d.full.index = flowNode.timeRange[0];
    d.full.length = flowNode.timeRange[1] - flowNode.timeRange[0];

    // update stats
    if (d.full.index < stats.indexMin)
      stats.indexMin = d.full.index;
    if (stats.indexMax < d.full.index + d.full.length)
      stats.indexMax = d.full.index + d.full.length;
  });

  return stats;
};


var stackedBarIndexed = Plotter.stackedBarIndexed = function(flowNodes) {
  var stats, barLengths;
  stats = {
    indexMin: Infinity,
    indexMax: -Infinity
  };

  barLengths = {};
  _.each(flowNodes, function(flowNode) {
    var d, id;
    d = flowNode.d;
    d.self || (d.self = {});
    d.full || (d.full = {});

    id = flowNode.type + flowNode.lineNumber;
    barLengths[id] || (barLengths[id] = 0);

    if (flowNode.type == 'flowPoint') {
      d.self.index = barLengths[id];
      d.self.length = 0.8;
    } else {
      delete d.self.index;
      delete d.self.length;
    };

    d.full.index = barLengths[id];
    d.full.length = 0.8;

    barLengths[id]++;

    // update stats
    if (d.full.index < stats.indexMin)
      stats.indexMin = d.full.index;
    if (stats.indexMax < d.full.index + d.full.length)
      stats.indexMax = d.full.index + d.full.length;
  });

  return stats;
};


var INDICES = Plotter.INDICES = {
  step: {fn: stepIndexed, discrete: true, axisLabel: 'step'},
  time: {fn: timeIndexed, discrete: false, axisLabel: 'elapsed time'},
  histogram: {fn: stackedBarIndexed, discrete: true, axisLabel: 'step count'}
};

}).call(this);
