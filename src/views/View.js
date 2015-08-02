(function(){

var util = sfp.util;
var views = sfp.views = {};


var View = views.View = function(selection, layout, options) {
  this.selection = selection;
  this.layout = layout;
  this.options = options || {};
  this.eventHub = this.options.eventHub || this;
  this._bindMethods(this.bindList);
  this.initialize.apply(this, arguments);
};

View.extend = Backbone.View.extend;

_.extend(View.prototype, Backbone.Events, {

  bindList: {},


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
    this._dataHistory = [];

    if (this.layout.transform) {
      this.selection.attr('transform', this.layout.transform);
    };
  },


  render: function() {},


  update: function(data) {
    if (data) {
      this.data = data;
      this._dataHistory.unshift(this.data);
    };

    if (!this.rendered) {
      this.rendered = true;
      this.render();
    };
  },

});

}).call(this);
