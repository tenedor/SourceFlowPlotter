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
      .text('test.py') // TODO: generalize beyond single file
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

    var codeLineNumber, layout, codeLinesDomain, codeLineHeightUnit,
        codeLineNumbers, sourceCode;

    layout = this.layout;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    codeLineNumbers = this.data.codeLineNumbers;
    sourceCode = this.data.sourceCode;

    codeLineNumber = this.selection.selectAll('tspan.code-line-number')
      .data(codeLineNumbers, function(lineNumber){return lineNumber;});
    codeLineNumber.enter().append('tspan')
      .classed('code-line-number', true)
      .classed('axis-number', true)
      .text(function(lineNumber){return lineNumber || null;})
      .attr('text-anchor', 'end')
      .attr('alignment-baseline', 'middle')
      .attr('data-code-line-number', function(lineNumber){return lineNumber;})
      .attr('x', 0)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
      .style('opacity', 0);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLineNumber.transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
      .style('opacity', 1);
    codeLineNumber.exit().transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
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

    this.flowGroupBars = new views.FlowGroupBars(
        this.selection.select('.flow-group-bars'),
        this.layout.flowGroupBars,
        {eventHub: this.eventHub});

    this.flowPointBars = new views.FlowPointBars(
        this.selection.select('.flow-point-bars'),
        this.layout.flowPointBars,
        {eventHub: this.eventHub});

    this.codeLines = new views.CodeLines(
        this.selection.select('.code-lines'),
        this.layout.codeLines,
        {eventHub: this.eventHub});
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.barSelectorsContainer.update(data);
    this.flowGroupBars.update(data);
    this.flowPointBars.update(data);
    this.codeLines.update(data);
  }

});


var CodeLines = views.CodeLines = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeLine, enteredCodeLine, layout, codeLinesDomain, codeLineHeightUnit,
        codeLineNumbers, sourceCode;

    layout = this.layout;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    codeLineNumbers = this.data.codeLineNumbers;
    sourceCode = this.data.sourceCode;

    codeLine = this.selection.selectAll('tspan.code-line')
      .data(codeLineNumbers, function(lineNumber){return lineNumber;});
    enteredCodeLine = codeLine.enter().append('tspan')
      .classed('code-line', true)
      .attr('data-code-line-number', function(lineNumber){return lineNumber;})
      .attr('x', 0)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
      .style('opacity', 0);
    enteredCodeLine.append('tspan')
      .classed('transparent', true)
      .classed('code-line-indentation', true)
      .text(function(lineNumber){
        // use transparent `#` markers to preserve whitespace
        var codeLine = (sourceCode[lineNumber].codeText || '');
        var whitespaceLength = codeLine.length - codeLine.trimLeft().length;
        return Array(whitespaceLength + 1).join('#');})
      .attr('alignment-baseline', 'middle');
    enteredCodeLine.append('tspan')
      .classed('code-line-text', true)
      .text(function(lineNumber){
        return (sourceCode[lineNumber].codeText || '').trimLeft();})
      .attr('alignment-baseline', 'middle');

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLine.transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
      .style('opacity', 1);
    codeLine.exit().transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;})
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

    var codeBar, layout, codeLinesDomain, codeLineHeightUnit, codeLineNumbers;

    layout = this.layout;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    codeLineNumbers = this.data.codeLineNumbers;

    codeBar = this.selection.selectAll('rect.code-bar-selector')
      .data(codeLineNumbers, function(lineNumber){return lineNumber;});
    codeBar.enter().append('rect')
      .classed('code-bar-selector', true)
      .classed('bar-selector', true)
      .attr('data-code-line-number', function(lineNumber){return lineNumber;})
      .attr('x', 0)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', this.layout.width)
      .attr('height', codeLineHeightUnit);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeBar.transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('height', codeLineHeightUnit);
    codeBar.exit().transition().duration(700)
      .attr('y', function(lineNumber){
        return (lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('height', codeLineHeightUnit)
      .remove();
  }

});


var FlowGroupBars = views.FlowGroupBars = PlotComponent.extend({

  bindList: {
    onMouseEnterFlowGroupBar: 'passFutureContext',
    onMouseLeaveFlowGroupBar: 'passFutureContext'
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var flowGroupBarGroup, flowGroupBar, flowGroupCodeBar, layout, flowGroups,
        codeLinesDomain, codeLineHeightUnit, indexDomain, indexWidthUnit,
        exitingGroups;

    layout = this.layout;
    flowGroups = this.data.flowGroups;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    // enter flow group bar groups
    flowGroupBarGroup = this.selection.selectAll('g.flow-group-bar-group')
      .data(flowGroups, function(flowGroup){return flowGroup.id;});
    flowGroupBarGroup.enter().append('g')
      .classed('flow-group-bar-group', true)
      .classed('flow-node-bar-group', true)
      .attr('data-uid', function(flowGroup){return flowGroup.uid;})
      .attr('data-code-line-range', function(flowGroup){
        var lineRange = flowGroup.internalCodeLineRange;
        return lineRange[0] + ',' + lineRange[1];})
      .on('mouseenter', this.onMouseEnterFlowGroupBar)
      .on('mouseleave', this.onMouseLeaveFlowGroupBar);

    // enter flow group bars
    flowGroupBar = flowGroupBarGroup.selectAll('rect.flow-group-bar')
      .data(function(fg){return [fg];}, function(flowGroup){return flowGroup.id;});
    flowGroupBar.enter().append('rect')
      .classed('flow-group-bar', true)
      .classed('flow-node-bar', true)
      //.classed('has-side-effect', function(flowGroup){
        //return !!flowGroup[SIDE_EFFECTS].length;})
      .attr('data-code-line-range', function(flowGroup){
        var lineRange = flowGroup.internalCodeLineRange;
        return lineRange[0] + ',' + lineRange[1];})
      .attr('x', function(flowGroup){
        return (flowGroup.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowGroup){
        return (flowGroup.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowGroup){
        return flowGroup.d.full.length * indexWidthUnit || 1;})
      .attr('height', function(flowGroup) {
        var lineRange, lines;
        lineRange = flowGroup.internalCodeLineRange;
        numLines = lineRange[1] - lineRange[0] + 1;
        return codeLineHeightUnit * numLines;})
      .style('opacity', 0);

    // enter flow group code bars
    flowGroupCodeBar = flowGroupBarGroup.selectAll('rect.flow-group-code-bar')
      .data(this.codeBarDataForFlowGroup, function(codeBar){
        return codeBar.lineNumber;});
    flowGroupCodeBar.enter().append('rect')
      .classed('flow-group-code-bar', true)
      .classed('bar-selector', true)
      .attr('data-code-line-number', function(codeBar){
        return codeBar.lineNumber;})
      .attr('x', function(codeBar){
        var index = codeBar.flowGroup.d.full.index;
        return (index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(codeBar){
        return (codeBar.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(codeBar){
        return codeBar.flowGroup.d.full.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    exitingGroups = flowGroupBarGroup.exit();

    // transition and exit flow group bars
    flowGroupBar.transition().duration(700)
      .attr('x', function(flowGroup){
        return (flowGroup.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowGroup){
        return (flowGroup.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowGroup){
        return flowGroup.d.full.length * indexWidthUnit || 1;})
      .attr('height', function(flowGroup) {
        var lineRange, lines;
        lineRange = flowGroup.internalCodeLineRange;
        lines = lineRange[1] - lineRange[0] + 1;
        return codeLineHeightUnit * lines;})
      .style('opacity', 0.3);
    flowGroupBar.exit()
        .union(exitingGroups.selectAll('rect.flow-group-bar'))
        .transition().duration(700)
      .attr('x', function(flowGroup){
        return (flowGroup.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowGroup){
        return (flowGroup.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .style('opacity', 0)
      .remove();

    // transition and exit flow group code bars
    flowGroupCodeBar.transition().duration(700)
      .attr('x', function(codeBar){
        var index = codeBar.flowGroup.d.full.index;
        return (index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(codeBar){
        return (codeBar.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(codeBar){
        return codeBar.flowGroup.d.full.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit);
    flowGroupCodeBar.exit()
        .union(exitingGroups.selectAll('rect.flow-group-code-bar'))
        .transition().duration(700)
      .attr('x', function(codeBar){
        var index = codeBar.flowGroup.d.full.index;
        return (index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(codeBar){
        return (codeBar.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(codeBar){
        return codeBar.flowGroup.d.full.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .remove();

    // exit flow group bar group
    flowGroupBarGroup.exit().transition().duration(700)
      .remove();
  },


  codeBarDataForFlowGroup: function(flowGroup) {
    var lineRange, lines, codeBars;
    lineRange = flowGroup.internalCodeLineRange;
    lineNumbers = _.range(lineRange[0], lineRange[1] + 1);
    codeBars = _.map(lineNumbers, function(lineNumber) {
      return {flowGroup: flowGroup, lineNumber: lineNumber};});
    return codeBars;
  },


  onMouseEnterFlowGroupBar: function(target, flowGroup) {
    var sideEffects;

    this.eventHub.trigger('select:flowGroup', flowGroup);

    /* TODO: reinstate side effects
    sideEffects = flowGroup[SIDE_EFFECTS];
    if (sideEffects) {
      this.eventHub.trigger('show:sideEffects', sideEffects);
    };
    */
  },


  onMouseLeaveFlowGroupBar: function(target, flowGroup) {
    this.eventHub.trigger('unselect:flowGroup', flowGroup);
    this.eventHub.trigger('hide:sideEffects', null);
  }

});


var FlowPointBars = views.FlowPointBars = PlotComponent.extend({

  bindList: {
    onMouseEnterFlowPointBar: 'passFutureContext',
    onMouseLeaveFlowPointBar: 'passFutureContext'
  },


  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var flowPointBarGroup, flowPointBar, flowPointTailBar, layout, flowPoints,
        codeLinesDomain, codeLineHeightUnit, indexDomain, indexWidthUnit,
        exitingGroups;

    layout = this.layout;
    flowPoints = this.data.flowPoints;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    // enter flow point bar groups
    flowPointBarGroup = this.selection.selectAll('g.flow-point-bar-group')
      .data(flowPoints, function(flowPoint){return flowPoint.id;});
    flowPointBarGroup.enter().append('g')
      .classed('flow-point-bar-group', true)
      .classed('flow-node-bar-group', true)
      .attr('data-uid', function(flowPoint){return flowPoint.uid;})
      .attr('data-code-line-range', function(flowPoint){
        var lineRange = flowPoint.internalCodeLineRange;
        return lineRange[0] + ',' + lineRange[1];})
      .on('mouseenter', this.onMouseEnterFlowPointBar)
      .on('mouseleave', this.onMouseLeaveFlowPointBar);

    // enter flow point tail bars
    flowPointTailBar = flowPointBarGroup.selectAll('rect.flow-point-tail-bar')
      .data(function(fp){return [fp];}, function(flowPoint){
        return flowPoint.id;});
    flowPointTailBar.enter().append('rect')
      .classed('flow-point-tail-bar', true)
      .classed('flow-node-bar', true)
      //.classed('has-side-effect', function(flowPoint){
        //return !!flowPoint[SIDE_EFFECTS].length;})
      .attr('data-code-line-number', function(flowPoint){
        return flowPoint.lineNumber;})
      .attr('x', function(flowPoint){
        return (flowPoint.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint.d.full.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 0);

    // enter flow point bars
    flowPointBar = flowPointBarGroup.selectAll('rect.flow-point-bar')
      .data(function(fp){return [fp];}, function(flowPoint){
        return flowPoint.id;});
    flowPointBar.enter().append('rect')
      .classed('flow-point-bar', true)
      .classed('flow-node-bar', true)
      //.classed('has-side-effect', function(flowPoint){
        //return !!flowPoint[SIDE_EFFECTS].length;})
      .attr('data-code-line-number', function(flowPoint){
        return flowPoint.lineNumber;})
      .attr('x', function(flowPoint){
        return (flowPoint.d.self.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint.d.self.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 0);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    exitingGroups = flowPointBarGroup.exit();

    // transition and exit flow point tail bars
    flowPointTailBar.transition().duration(700)
      .attr('x', function(flowPoint){
        return (flowPoint.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint.d.full.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 0.3);
    flowPointTailBar.exit()
        .union(exitingGroups.selectAll('rect.flow-point-tail-bar'))
        .transition().duration(700)
      .attr('x', function(flowPoint){
        return (flowPoint.d.full.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .style('opacity', 0)
      .remove();

    // transition and exit flow point bars
    flowPointBar.transition().duration(700)
      .attr('x', function(flowPoint){
        return (flowPoint.d.self.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint){
        return flowPoint.d.self.length * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 1);
    flowPointBar.exit()
        .union(exitingGroups.selectAll('rect.flow-point-bar'))
        .transition().duration(700)
      .attr('x', function(flowPoint){
        return (flowPoint.d.self.index - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint.lineNumber - codeLinesDomain[0]) * codeLineHeightUnit;})
      .style('opacity', 0)
      .remove();

    // exit flow point bar group
    flowPointBarGroup.exit().transition().duration(700)
      .remove();
  },


  onMouseEnterFlowPointBar: function(target, flowPoint) {
    var sideEffects;

    this.eventHub.trigger('select:flowPoint', flowPoint);

    /* TODO: reinstate side effects
    sideEffects = flowPoint[SIDE_EFFECTS];
    if (sideEffects) {
      this.eventHub.trigger('show:sideEffects', sideEffects);
    };
    */
  },


  onMouseLeaveFlowPointBar: function(target, flowPoint) {
    this.eventHub.trigger('unselect:flowPoint', flowPoint);
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
    var codeTextLine, sourceCode, codeLinesDomain, activeCodeLineNumber, min,
        max, codeLineNumbers;

    sourceCode = this.data.sourceCode;
    codeLinesDomain = this.data.codeLinesDomain;
    activeCodeLineNumber = this.activeCodeLineNumber = codeLineNumber;

    // get code lines nearby the given code line number
    min = Math.max(codeLinesDomain[0], activeCodeLineNumber - 2);
    max = Math.min(codeLinesDomain[1], min + 4);
    if (max - min < 5) {
      min = Math.max(codeLinesDomain[0], max - 4);
    };

    codeLineNumbers = _.range(min, max + 1);

    codeTextLine = this.selection.selectAll('tspan.code-text-line')
      .data(codeLineNumbers, function(lineNumber){return lineNumber;});
    codeTextLine.enter().insert('tspan')
      .classed('code-text-line', true)
      .attr('opacity', function(lineNumber){
        return sourceCode[lineNumber].codeText.trim() ? null: 0;})
      .attr('x', 0)
      .attr('dy', '1.2em')
      .text(function(lineNumber){
        return sourceCode[lineNumber].codeText.trim() || '#';})
    codeTextLine
      .classed('selected', function(lineNumber){
        return lineNumber === activeCodeLineNumber;});
    codeTextLine.exit().remove();
  }

});

}).call(this);
