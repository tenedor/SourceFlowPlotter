/*
 * `flowPoints` data is an array of `flowPoint` arrays.
 *
 * Each `flowPoint` array has length 9 and follows the format:
 *   [step/uid, index, length, timeEnter, timeExit, filename, codeLineNumber,
 *      codeLine, [sideEffect, ...]]
 * Or, in terms of types:
 *   [int, int, int, float, float, string, int, string, [string, ...]]
 * More verbosely:
 *   step/uid (int): the ordinal index of this point and its unique ID
 *   index (int): the plot position for this point (depends on the index mode)
 *   length (int): the plot length for this point (depends on the index mode)
 *   timeEnter (float): the elapsed time when this point's evaluation began
 *   timeExit (float): the elapsed time when this point's evaluation ended
 *   filename (string): the name of the file this point belongs to
 *   codeLineNumber (int): the file's line number this point represents
 *   codeLine (string): the text of the line of code this point represents
 *   sideEffects (strings array): a list of side effects occurring at this point
 */


(function(){

var util = sfp.util;
var views = sfp.views;
var View = views.View;
var PlotComponent = views.PlotComponent;

// GLOBALS
this.STEP = 0;
this.UID = STEP;
this.INDEX = 1;
this.LENGTH = 2;
this.TIME_ENTER = 3;
this.TIME_EXIT = 4;
this.FILENAME = 5;
this.CODE_LINE_NUMBER = 6;
this.CODE_LINE = 7;
this.SIDE_EFFECTS = 8;

// for now, data is hardcoded to a demo script called `coins.py`
var DATA_URL = 'data/coins.py.extract.json';


// begin: create plotter and fetch flow points data for it
$(document).ready(function() {
  sfp.plotter = new sfp.Plotter();
  fetchData(DATA_URL, sfp.plotter.setData);
});


// fetch, parse, and set up flow points data
var fetchData = function(url, callback) {
  $.getJSON(url, function(data) {
    var flowPointsData = _.map(data.lines, function(flowPoint, index) {
      flowPoint[0] = parseFloat(flowPoint[0]); // time enter
      flowPoint[1] = parseFloat(flowPoint[1]); // time exit
      flowPoint[3] = parseInt(flowPoint[3]);   // line number
      flowPoint.unshift(0.8);                  // default length (step mode)
      flowPoint.unshift(index);                // default index (step mode)
      flowPoint.unshift(index);                // step index and unique id
      return flowPoint;
    });

    _.isFunction(callback) && callback(flowPointsData);
  });
};


var Plotter = sfp.Plotter = function(options) {
  this.options = options || {};
  this.eventHub = this.options.eventHub || this;
  this._bindMethods(this.bindList);
  this.initialize();
};

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
          flowPoints: {height: 400, width: 500, transform: ''}
        }
      },
      codeText: {height: 100, width: 500, transform: 'translate(50, 460)'}
    }
  },


  bindList: {
    setData: 'bind',
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


  setData: function(flowPointsData) {
    var codeLines, codeLinesMin, codeLinesMax;

    codeLines = this.extractCodeLines(flowPointsData);
    codeLinesMin = codeLines[0].codeLineNumber;
    codeLinesMax = codeLines[codeLines.length - 1].codeLineNumber;

    this.originalData = {
      flowPoints: flowPointsData,
      codeLines: codeLines,
      codeLinesDomain: [codeLinesMin, codeLinesMax]
    };

    this.filterData({silent: true});
    this.indexData({silent: true});

    // set code text data and render the plot
    this.codeText.update(this.originalData);
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
    var originalFlowPoints, flowPoints;

    // TODO: "protect" originalData by limiting access through a cloning getter
    originalFlowPoints = util.nLevelClone(this.originalData.flowPoints, 2);
    flowPoints = this.filterFn(originalFlowPoints);

    this.filteredData = {
      flowPoints: flowPoints
    };

    if (!(options && options.silent)) {
      this.trigger('filteredData:changed');
    };
  },


  indexData: function(options) {
    var filteredFlowPoints, indexFn, flowPoints, codeLines, codeLinesMin,
        codeLinesMax;

    // index flow points
    filteredFlowPoints = util.nLevelClone(this.filteredData.flowPoints, 2);
    indexFn = Plotter.INDICES[this.indexMode].fn;
    flowPoints = indexFn(filteredFlowPoints);

    codeLines = this.extractCodeLines(flowPoints);
    codeLinesMin = codeLines[0].codeLineNumber;
    codeLinesMax = codeLines[codeLines.length - 1].codeLineNumber;

    // calculate index dimensions
    indexMinPoint = _.min(flowPoints, function(flowPoint){
      return flowPoint[INDEX];});
    indexMaxPoint = _.max(flowPoints, function(flowPoint){
      return flowPoint[INDEX] + flowPoint[LENGTH];});
    indexMin = indexMinPoint[INDEX];
    indexMax = indexMaxPoint[INDEX] + indexMaxPoint[LENGTH];

    this.indexedData = {
      flowPoints: flowPoints,
      codeLines: codeLines,
      codeLinesDomain: [codeLinesMin, codeLinesMax],
      indexDomain: [indexMin, indexMax],
      index: Plotter.INDICES[this.indexMode]
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


  extractCodeLines: function(flowPoints) {
    var codeLinesMin, codeLines, i, codeLine, codeLinesMax, _codeLines;

    // extract original code
    codeLinesMin = Infinity;
    codeLines = [];
    for (i = 0; i < flowPoints.length; i++) {
      codeLine = {
        codeLineNumber: flowPoints[i][CODE_LINE_NUMBER],
        codeText: flowPoints[i][CODE_LINE]
      };
      codeLines[flowPoints[i][CODE_LINE_NUMBER]] = codeLine;
      codeLinesMin = Math.min(codeLinesMin, flowPoints[i][CODE_LINE_NUMBER]);
    };
    codeLinesMax = codeLines.length - 1;

    // clean up codeLines
    _codeLines = codeLines;
    codeLines = [];
    for (i = codeLinesMin; i < _codeLines.length; i++) {
      codeLine = _codeLines[i] || {
        codeLineNumber: i,
        codeText: ''
      };
      codeLines.push(codeLine);
    };

    return codeLines;
  },


  // TODO: class method?
  filterFn: function(flowPoints) {
    var filter, max;

    filter = this.filter;
    if (_.isArray(filter.lines) && filter.lines.length) {
      min = filter.lines[0][0];
      max = filter.lines[0][1];
      flowPoints = _.filter(flowPoints, function(flowPoint){
        return (min <= flowPoint[CODE_LINE_NUMBER] &&
            flowPoint[CODE_LINE_NUMBER] <= max);});
    };

    return flowPoints;
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

var stepIndexed = Plotter.stepIndexed = function(dataPoints) {
  return _.map(dataPoints, function(dataPoint) {
    dataPoint[INDEX] = dataPoint[STEP];
    dataPoint[LENGTH] = 0.8;
    return dataPoint;
  });
};


var timeIndexed = Plotter.timeIndexed = function(dataPoints) {
  return _.map(dataPoints, function(dataPoint) {
    dataPoint[INDEX] = dataPoint[TIME_ENTER];
    dataPoint[LENGTH] = dataPoint[TIME_EXIT] - dataPoint[TIME_ENTER];
    return dataPoint;
  });
};


var stackedBarIndexed = Plotter.stackedBarIndexed = function(dataPoints) {
  barHeights = [];
  return _.map(dataPoints, function(dataPoint) {
    var codeLineNumber = dataPoint[CODE_LINE_NUMBER];
    if (! barHeights[codeLineNumber]) {
      barHeights[codeLineNumber] = 0;
    };
    dataPoint[INDEX] = barHeights[codeLineNumber]++;
    dataPoint[LENGTH] = 0.8;
    return dataPoint;
  });
};


var INDICES = Plotter.INDICES = {
  step: {fn: stepIndexed, discrete: true, axisLabel: 'step'},
  time: {fn: timeIndexed, discrete: false, axisLabel: 'elapsed time'},
  histogram: {fn: stackedBarIndexed, discrete: true, axisLabel: 'step count'}
};

}).call(this);
