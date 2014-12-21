(function(){

var util = sfp.util;
var views = sfp.views;
var View = views.View;


var PlotComponent = views.PlotComponent = View.extend({

  updateContext: function() {
    var cld, id, indexWidthUnit;

    // height of one code line (code line domain is an inclusive range, so add 1
    // in span calculation account for flow point size)
    cld = this.codeLinesDomain = this.data.codeLinesDomain;
    this.codeLineHeightUnit = this.layout.height / (cld[1] - cld[0] + 1);

    // width of a length-1 index interval (index domain already accounts for
    // flow point widths, so do not add 1 in span calculation)
    id = this.indexDomain = this.data.indexDomain;
    indexWidthUnit = this.layout.width / (id[1] - id[0]);
    this.indexWidthUnit = _.isFinite(indexWidthUnit) ? indexWidthUnit : NaN;
  }

});


var Plot = views.Plot = PlotComponent.extend({

  // TODO: what do we do about the challenge of using the paradigm
  // `_.extend({}, super.prototype.bindList, {...})` here?
  bindList: {
    onMouseEnterCodeLineNumber: 'passFutureContext',
    onMouseLeaveCodeLineNumber: 'passFutureContext',
    onMouseEnterIndexNumber: 'passFutureContext',
    onMouseLeaveIndexNumber: 'passFutureContext',
    selectCodeLineNumber: 'bind',
    unselectCodeLineNumber: 'bind',
    selectIndexNumber: 'bind',
    unselectIndexNumber: 'bind'
  },


  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.eventHub.on('select:codeLineNumber', this.selectCodeLineNumber);
    this.eventHub.on('unselect:codeLineNumber', this.unselectCodeLineNumber);
    this.eventHub.on('select:indexNumber', this.selectIndexNumber);
    this.eventHub.on('unselect:indexNumber', this.unselectIndexNumber);

    this.indexAxis = new views.IndexAxis(
        this.selection.select('.index-axis'),
        this.layout.indexAxis,
        {eventHub: this.eventHub});
    this.codeLineAxis = new views.CodeLineAxis(
        this.selection.select('.code-axis'),
        this.layout.codeLineAxis,
        {eventHub: this.eventHub});
    this.plotBody = new views.PlotBody(
        this.selection.select('.plot-body'),
        this.layout.plotBody,
        {eventHub: this.eventHub});
  },


  render: function() {
    var codeLineSelector, indexSelector;

    codeLineSelector = '[data-code-line-number]';
    indexSelector = '[data-index-number]';

    this.selection
      .delegate('mouseenter', codeLineSelector, this.onMouseEnterCodeLineNumber)
      .delegate('mouseleave', codeLineSelector, this.onMouseLeaveCodeLineNumber);
      //.delegate('mouseenter', indexSelector, this.onMouseEnterIndexNumber)
      //.delegate('mouseleave', indexSelector, this.onMouseLeaveIndexNumber);
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.indexAxis.update(data);
    this.codeLineAxis.update(data);
    this.plotBody.update(data);
  },


  onMouseEnterCodeLineNumber: function(target) {
    var number = parseInt(d3.select(target).attr('data-code-line-number'));
    // TODO: test that number is validly inside the data domain
    if (_.isFinite(number)) {
      this.eventHub.trigger('select:codeLineNumber', number);
    };
  },


  onMouseLeaveCodeLineNumber: function(target) {
    var number = parseInt(d3.select(target).attr('data-code-line-number'));
    if (_.isFinite(number)) {
      this.eventHub.trigger('unselect:codeLineNumber', number);
    };
  },


  onMouseEnterIndexNumber: function(target) {
    var number = parseInt(d3.select(target).attr('data-index-number'));
    if (_.isFinite(number)) {
      this.eventHub.trigger('select:indexNumber', number);
    };
  },


  onMouseLeaveIndexNumber: function(target) {
    var number = parseInt(d3.select(target).attr('data-index-number'));
    if (_.isFinite(number)) {
      this.eventHub.trigger('unselect:indexNumber', number);
    };
  },


  selectCodeLineNumber: function(codeLineNumber) {
    var codeLineSelector = '[data-code-line-number="' + codeLineNumber + '"]';
    this.selection.selectAll(codeLineSelector)
      .classed('selected', true);
  },


  unselectCodeLineNumber: function(codeLineNumber) {
    var codeLineSelector = '[data-code-line-number="' + codeLineNumber + '"]';
    this.selection.selectAll(codeLineSelector)
      .classed('selected', false);
  },


  selectIndexNumber: function(indexNumber) {
    var indexSelector = '[data-index-number="' + indexNumber + '"]';
    this.selection.selectAll(indexSelector)
      .classed('selected', true);
  },


  unselectIndexNumber: function(indexNumber) {
    var indexSelector = '[data-index-number="' + indexNumber + '"]';
    this.selection.selectAll(indexSelector)
      .classed('selected', false);
  }

});


var IndexAxis = views.IndexAxis = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    // index axis
    this.selection.append('rect')
      .classed('axis-bar', true)
      .attr('x', 0)
      .attr('y', 5)
      .attr('width', this.layout.width + 1) // '+1' handles zero-length points
      .attr('height', '5');
    this.selection.append('g')
      .classed('axis-label-container', true);

    // index axis label
    this.labelSelection = this.selection.select('g.axis-label-container');

    this.indexNumbers = new views.IndexNumbers(
        this.selection.select('.index-numbers'),
        this.layout.indexNumbers,
        {eventHub: this.eventHub});
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexAxisLabel, indexAxisLabelText;

    indexAxisLabelText = this.data.index.axisLabel;

    indexAxisLabel = this.labelSelection.selectAll('text')
      .data([indexAxisLabelText], String);
    indexAxisLabel.enter().append('text')
      .classed('axis-label', true)
      .classed('index-axis-label', true)
      .text(String)
      .attr('text-anchor', 'middle')
      .attr('x', this.layout.width / 2)
      .attr('y', 40)
      .style('opacity', 0);
    indexAxisLabel.transition().duration(700)
      .style('opacity', 1);
    indexAxisLabel.exit().transition().duration(700)
      .style('opacity', 0)
      .remove();

    this.indexNumbers.update(data);
  }

});


var IndexNumbers = views.IndexNumbers = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexNumber, layout, indexNumberValues, indexDomain, indexWidthUnit;

    layout = this.layout;
    indexNumberValues = util.axisNumbersForDomain(this.data.indexDomain,
        this.data.index.discrete);
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    // TODO: center index number positions on the flow points they index
    indexNumber = this.selection.selectAll('tspan.index-number')
      .data(indexNumberValues, parseFloat);
    indexNumber.enter().append('tspan')
      .classed('index-number', true)
      .classed('axis-number', true)
      .text(function(indexValue){return indexValue;})
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('data-index-number', function(indexValue){return indexValue;})
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', 0)
      .style('opacity', 0);

    // update axis descriptors to transition to the correct location
    this.updateContext();
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexNumber.transition().duration(700)
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .style('opacity', 1);
    indexNumber.exit().transition().duration(700)
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .style('opacity',0)
      .remove();
  }

});


var CodeLineAxis = views.CodeLineAxis = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.selection.append('rect')
      .classed('axis-bar', true)
      .attr('x', this.layout.width - 10)
      .attr('y', 0)
      .attr('width', 5)
      .attr('height', this.layout.height);
    this.selection.append('g')
      .classed('axis-label-container', true);
    this.selection.select('g').append('text')
      .classed('axis-label', true)
      .classed('code-axis-label', true)
      .text('coins.py')
      .attr('text-anchor', 'middle')
      .attr('x', -this.layout.height / 2)
      .attr('y', 0)
      .attr('transform', 'rotate(270) translate(0, 10)');

    this.codeLineNumbers = new views.CodeLineNumbers(
        this.selection.select('.code-line-numbers'),
        this.layout.codeLineNumbers,
        {eventHub: this.eventHub});
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.codeLineNumbers.update(data);
  }

});


var CodeLineNumbers = views.CodeLineNumbers = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeLineNumber, layout, codeLines, codeLinesDomain, codeLinesHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLineNumber = this.selection.selectAll('tspan.code-line-number')
      .data(codeLines, function(codeLine){
        return codeLine && codeLine.codeLineNumber || 0});
    codeLineNumber.enter().append('tspan')
      .classed('code-line-number', true)
      .classed('axis-number', true)
      .text(function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('text-anchor', 'end')
      .attr('alignment-baseline', 'middle')
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 0);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLineNumber.transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 1);
    codeLineNumber.exit().transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 0)
      .remove();
  }

});


var PlotBody = views.PlotBody = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.barSelectorsContainer = new views.BarSelectorsContainer(
        this.selection.select('.bar-selectors-container'),
        this.layout.barSelectorsContainer,
        {eventHub: this.eventHub});

    this.flowPoints = new views.FlowPoints(
        this.selection.select('.flow-points'),
        this.layout.flowPoints,
        {eventHub: this.eventHub});

    this.codeLines = new views.CodeLines(
        this.selection.select('.code-lines'),
        this.layout.codeLines,
        {eventHub: this.eventHub});
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.barSelectorsContainer.update(data);
    this.flowPoints.update(data);
    this.codeLines.update(data);
  }

});


var CodeLines = views.CodeLines = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeLine, enteredCodeLine, layout, codeLines, codeLinesDomain,
        codeLineHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLine = this.selection.selectAll('tspan.code-line')
      .data(codeLines, function(codeLine){
        return codeLine && codeLine.codeLineNumber || 0});
    enteredCodeLine = codeLine.enter().append('tspan')
      .classed('code-line', true)
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 0);
    enteredCodeLine.append('tspan')
      .classed('transparent', true)
      .classed('code-line-indentation', true)
      .text(function(codeLine){
        // use transparent `#` markers to preserve whitespace
        codeLine = (codeLine && codeLine.codeText || '');
        var whitespaceLength = codeLine.length - codeLine.trimLeft().length;
        return Array(whitespaceLength + 1).join('#');})
      .attr('alignment-baseline', 'middle');
    enteredCodeLine.append('tspan')
      .classed('code-line-text', true)
      .text(function(codeLine){
        return (codeLine && codeLine.codeText || '').trimLeft();})
      .attr('alignment-baseline', 'middle');

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLine.transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 1);
    codeLine.exit().transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * CLHU)
          : null);})
      .style('opacity', 0)
      .remove();
  }

});


var BarSelectorsContainer = views.BarSelectorsContainer = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.indexBarSelectors = new views.IndexBarSelectors(
        this.selection.select('.index-bar-selectors'),
        this.layout.indexBarSelectors,
        {eventHub: this.eventHub});

    this.codeBarSelectors = new views.CodeBarSelectors(
        this.selection.select('.code-bar-selectors'),
        this.layout.codeBarSelectors,
        {eventHub: this.eventHub});
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.indexBarSelectors.update(data);
    this.codeBarSelectors.update(data);
  }

});


// TODO: incorporate index bar selectors into the application
var IndexBarSelectors = views.IndexBarSelectors = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexBar, layout, indexNumberValues, indexDomain, indexWidthUnit;

    layout = this.layout;
    indexNumberValues = util.axisNumbersForDomain(this.data.indexDomain,
        this.data.index.discrete);
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexBar = this.selection.selectAll('rect.index-bar-selector')
      .data(indexNumberValues, parseFloat);
    indexBar.enter().append('rect')
      .classed('index-bar-selector', true)
      .classed('bar-selector', true)
      .attr('data-index-number', function(indexValue){return indexValue;})
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', 0)
      .attr('width', this.layout.width / indexNumberValues.length)
      .attr('height', this.layout.height);

    this.updateContext();
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexBar.exit().transition().duration(700)
      .remove();
  }

});


var CodeBarSelectors = views.CodeBarSelectors = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeBar, layout, codeLines, codeLinesDomain, codeLinesHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeBar = this.selection.selectAll('rect.code-bar-selector')
      .data(codeLines, function(codeLine){
        return codeLine && codeLine.codeLineNumber || 0});
    codeBar.enter().append('rect')
      .classed('code-bar-selector', true)
      .classed('bar-selector', true)
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0]) * CLHU)
          : null);})
      .attr('width', this.layout.width)
      .attr('height', codeLineHeightUnit);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeBar.transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0]) * CLHU)
          : null);})
      .attr('height', codeLineHeightUnit);
    codeBar.exit().transition().duration(700)
      .attr('y', function(codeLine){
        var CLHU = codeLineHeightUnit;
        return ((codeLine && codeLine.codeLineNumber)
          ? ((codeLine.codeLineNumber - codeLinesDomain[0]) * CLHU)
          : null);})
      .attr('height', codeLineHeightUnit)
      .remove();
  }

});


var FlowPoints = views.FlowPoints = PlotComponent.extend({

  bindList: {
    onMouseEnterFlowPoint: 'passFutureContext',
    onMouseLeaveFlowPoint: 'passFutureContext'
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var flowPoint, layout, flowPoints, codeLines, codeLinesDomain,
        codeLineHeightUnit, indexDomain, indexWidthUnit;

    layout = this.layout;
    flowPoints = this.data.flowPoints;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    flowPoint = this.selection.selectAll('rect.flow-point')
      .data(flowPoints, function(d){return d[UID];});
    flowPoint.enter().append('rect')
      .classed('flow-point', true)
      .classed('has-side-effect', function(flowPoint){
        return !!flowPoint[SIDE_EFFECTS].length;})
      .attr('data-code-line-number', function(flowPoint){
        return flowPoint[CODE_LINE_NUMBER];})
      .attr('x', function(flowPoint, i){
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint[LENGTH] * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 0)
      .on('mouseenter', this.onMouseEnterFlowPoint)
      .on('mouseleave', this.onMouseLeaveFlowPoint);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    flowPoint.transition().duration(700)
      .attr('x', function(flowPoint, i){
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint[LENGTH] * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 1);
    flowPoint.exit().transition().duration(700)
      .attr('x', function(flowPoint, i){
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .style('opacity', 0)
      .remove();
  },


  onMouseEnterFlowPoint: function(target, flowPointData) {
    var sideEffects;

    this.eventHub.trigger('select:flowPoint', flowPointData);

    sideEffects = flowPointData[SIDE_EFFECTS];
    if (sideEffects) {
      this.eventHub.trigger('show:sideEffects', sideEffects);
    };
  },


  onMouseLeaveFlowPoint: function(target, flowPointData) {
    this.eventHub.trigger('unselect:flowPoint', flowPointData);
    this.eventHub.trigger('hide:sideEffects', null);
  }

});


var CodeText = views.CodeText = View.extend({

  bindList: {
    selectCodeLineNumber: 'bind'
  },


  initialize: function() {
    View.prototype.initialize.apply(this, arguments);

    this.eventHub.on('select:codeLineNumber', this.selectCodeLineNumber);
  },


  selectCodeLineNumber: function(codeLineNumber) {
    var codeLinesDomain, codeLines, activeCodeLineNumber, min, max,
        nearbyCodeLines, codeTextLine;

    codeLinesDomain = this.data.codeLinesDomain;
    codeLines = this.data.codeLines;
    activeCodeLineNumber = this.activeCodeLineNumber = codeLineNumber;

    // get code lines nearby the given code line number
    min = Math.max(codeLinesDomain[0], activeCodeLineNumber - 2);
    max = Math.min(codeLinesDomain[1], min + 4);
    if (max - min < 5) {
      min = Math.max(codeLinesDomain[0], max - 4);
    };

    nearbyCodeLines = _.filter(codeLines, function(codeLine){
      return min <= codeLine.codeLineNumber && codeLine.codeLineNumber <= max;
    });

    codeTextLine = this.selection.selectAll('tspan.code-text-line')
      .data(nearbyCodeLines, function(codeLine){
        return codeLine.codeLineNumber;});
    codeTextLine.enter().insert('tspan')
      .classed('code-text-line', true)
      .attr('opacity', function(codeLine){
        return codeLine.codeText.trim() ? null : 0;})
      .attr('x', 0)
      .attr('dy', '1.2em')
      .text(function(codeLine){return codeLine.codeText.trim() || '#';});
    codeTextLine
      .classed('selected', function(codeLine){
        return codeLine.codeLineNumber === activeCodeLineNumber;});
    codeTextLine.exit().remove();
  }

});

}).call(this);
