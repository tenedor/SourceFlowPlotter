(function(){

var util = sfp.util = {};

_.extend(sfp.util, {

  // given a function `fn`, generate a function that when passed an array will
  // map `fn` to the array and otherwise is the identity function
  nestedMap: function(fn) {
    return function(array) {
      return _.isArray(array) ? _.map(array, fn) : array;
    };
  },


  // return an n-levels-deep clone of an array; leaves non-array objects at any
  // depth untouched
  nLevelClone: function(array, n) {
    if (!(_.isFinite(n) && n > 0)) {return array;};

    var clone = function(array){return _.clone(array);};
    for (var i = 1; i < n; i++) {
      clone = util.nestedMap(clone);
    };
    return clone(array);
  },


  // bind a function to the given context, but pass as the function's first
  // argument the context it is called in
  bindButPassFutureContext: function(fn, context) {
    return function() {
      var args = Array.prototype.slice.apply(arguments);
      args.unshift(this);
      fn.apply(context, args);
    };
  },


  // generate good-looking axis numbers
  axisNumbersForDomain: function(axisDomain, discrete, ticks) {
    var axisNumbers;

    _.isFinite(ticks) && ticks > 0 || (ticks = 8);
    axisNumbers = d3.scale.linear().domain(axisDomain).ticks(ticks);

    // discretize index numbers if appropriate
    if (discrete) {
      axisNumbers = _.unique(_.map(axisNumbers, Math.round));
    };

    return axisNumbers;
  }

});

}).call(this);
