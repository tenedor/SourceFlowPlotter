(function(){

var util = sfp.util;
var views = sfp.views;
var View = views.View;


var ContextView = views.ContextView = View.extend({

  render: function() {
    View.prototype.render.apply(this, arguments);

    this.updateContext();
  },


  update: function(data) {
    View.prototype.update.apply(this, arguments);

    this.immediateUpdate(data);
    this.updateContext();
    this.transitionUpdate();
  },


  updateContext: function() {},

  immediateUpdate: function(data) {},

  transitionUpdate: function() {},

});

}).call(this);
