(function(){

// ** d3.selection.prototype.delegate **
// -------------------------------------
//
// jQuery-style event delegation for listening to DOM events on child elements.
//
// NOTE: listeners bound with delegate are called with selection data from the
// selection they are bound to, NOT the subselection on which delegated events
// are interpreted.
//
// Adapted from jQuery 2.1.3 source.

// error if we are overwriting a pre-defined function
if (d3.selection.prototype.delegate)
  throw new Error('d3.selection.prototype.delegate is already defined');

// d3.selection.prototype.delegate
d3.selection.prototype.delegate = function(type, selector, listener, capture) {
  var delegateSource, special, _listener;

  delegateSource = this.node();

  special = this.delegate.special[type];
  if (special) {
    special.delegateType && (type = special.delegateType + '.+' + type);
    special.wrapListener && (listener = special.wrapListener(listener));
  };

  type += (selector[0] === '.' ? selector : '.' + selector);

  _listener = listener;
  listener = function() {
    var target = d3.event.target;
    while (target !== delegateSource && target.parentNode) {
      if (!d3.select(target).filter(selector).empty()) {
        _listener.apply(target, arguments);
      };
      target = target.parentNode;
    };
  };

  return this.on(type, listener, capture);
};

// special delegation configurations for abnormal DOM events
d3.selection.prototype.delegate.special = {};
_.each({
  mouseenter: "mouseover",
  mouseleave: "mouseout",
  pointerenter: "pointerover",
  pointerleave: "pointerout"
}, function(fix, orig) {
  d3.selection.prototype.delegate.special[orig] = {
    delegateType: fix,

    wrapListener: function(listener) {
      return function() {
        var target, related, eventType, ret;

        target = this;
        related = d3.event.relatedTarget;

        // For mousenter/leave call the handler if related is outside the target.
        // NB: No relatedTarget if the mouse left/entered the browser window
        // TODO: remove jQuery from this file for modularity reasons
        if (!related || !(target === related || $.contains(target, related))) {
          eventType = d3.event.type;
          d3.event.type = orig;
          ret = listener.apply(this, arguments);
          d3.event.type = eventType;
        };
        return ret;
      };
    }
  };
});


// ** d3.selection.prototype.union **
// -------------------------------------
//
// Return a union of the current selection and one or more other selections
//
// Adapted from aogriffiths via https://github.com/mbostock/d3/issues/399.

// error if we are overwriting a pre-defined function
if (d3.selection.prototype.union)
  throw new Error('d3.selection.prototype.union is already defined');

// d3.selection.prototype.union
d3.selection.prototype.union = function() {
  var newSelection, i, oldSelection;

  // ensure the correct prototype and empty the selection
  newSelection = d3.select(null);
  newSelection.splice(0,1);

  // push in each selection without loosing the prototype
  [].push.apply(newSelection, this);
  for (var i = 0; i < arguments.length; i++) {
    oldSelection = arguments[i];
    if (oldSelection instanceof d3.selection)
      [].push.apply(newSelection, oldSelection);
    else
      throw new Error("Can only union with another d3 selection");
  };

  return newSelection;
};

}).call(this);
