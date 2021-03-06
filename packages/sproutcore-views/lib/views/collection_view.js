// ==========================================================================
// Project:   SproutCore - JavaScript Application Framework
// Copyright: ©2006-2011 Strobe Inc. and contributors.
//            Portions ©2008-2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

require('sproutcore-views/views/view');
var get = SC.get, set = SC.set;

/**
  @class
  @since SproutCore 2.0
  @extends SC.View
*/
SC.CollectionView = SC.View.extend(
/** @scope SC.CollectionView.prototype */ {

  /**
    A list of items to be displayed by the SC.CollectionView.

    @type SC.Array
    @default null
  */
  content: null,

  /**
    An optional view to display if content is set to an empty array.

    @type SC.View
    @default null
  */
  emptyView: null,

  /**
    @type SC.View
    @default SC.View
  */
  itemViewClass: SC.View,

  /**
    @private

    When the view is initialized, set up array observers on the content array.

    @returns {SC.TemplateCollectionView}
  */
  init: function() {
    var collectionView = this._super();
    this._sctcv_contentDidChange();
    return collectionView;
  },

  /**
    @private

    In case a default content was set, trigger the child view creation
    as soon as the empty layer was created
  */
  willInsertElement: function() {
    var content = get(this, 'content');
    if (content) {
      var len = get(content, 'length');
      this.arrayWillChange(content, 0, 0, len);
      this.arrayDidChange(content, 0, 0, len);
    }
  },

  /**
    @private

    When the content property of the collection changes, remove any existing
    child views and observers, then set up an observer on the new content, if
    needed.
  */
  _sctcv_contentDidChange: function() {
    this.$().empty();

    var oldContent = this._sccv_content,
        content = get(this, 'content'),
        oldLen = 0, newLen = 0;

    if (oldContent) {
      oldContent.removeArrayObserver(this);
      oldLen = get(oldContent, 'length');
    }

    if (content) {
      content.addArrayObserver(this);
      newLen = get(content, 'length');
    }

    this.arrayWillChange(oldContent, 0, oldLen, newLen);
    this._sccv_content = content;
    this.arrayDidChange(content, 0, oldLen, newLen);
  }.observes('content'),

  destroy: function() {
    set(this, 'content', null);
    return this._super();
  },

  arrayWillChange: function(content, start, removedCount, addedCount) {
    if (!get(this, 'element')) { return; }

    // If the contents were empty before and this template collection has an 
    // empty view remove it now.
    var emptyView = get(this, 'emptyView');
    if (emptyView && !SC.Object.detect(emptyView)) {
      emptyView.removeFromParent();
    }

    // Loop through child views that correspond with the removed items.
    // Note that we loop from the end of the array to the beginning because
    // we are mutating it as we go.
    var childViews = get(this, 'childViews'), childView, idx, len;

    len = get(childViews, 'length');
    for (idx = start + removedCount - 1; idx >= start; idx--) {
      childViews[idx].destroy();
    }
  },

  /**
    Called when a mutation to the underlying content array occurs.

    This method will replay that mutation against the views that compose the
    SC.CollectionView, ensuring that the view reflects the model.

    This array observer is added in contentDidChange.

    @param {Array} addedObjects 
      the objects that were added to the content

    @param {Array} removedObjects 
      the objects that were removed from the content
    
    @param {Number} changeIndex 
      the index at which the changes occurred
  */
  arrayDidChange: function(content, start, removed, added) {
    if (!get(this, 'element')) { return; }

    SC.run.schedule('render', this, function() {
      this._updateElements(content, start, removed, added)
    });
  },

  _updateElements: function(content, start, removed, added) {
    var itemViewClass = get(this, 'itemViewClass'),
        childViews = get(this, 'childViews'),
        addedViews = [],
        renderFunc, view, childView, itemOptions, elem,
        insertAtElement, item, fragment, idx, len;

    elem = this.$();

    if (content) {
      var addedObjects = content.slice(start, start+added);

      childView = childViews.objectAt(start - 1);
      insertAtElement = childView ? childView.$() : null;

      len = get(addedObjects, 'length');

      var buffer = "";

      for (idx = 0; idx < len; idx++) {
        item = addedObjects.objectAt(idx);
        view = this.createChildView(itemViewClass, {
          content: item
        });

        buffer = buffer + view.renderToBuffer().string();

        addedViews.push(view);
      }

      fragment = SC.$(buffer);

      if (!insertAtElement) {
        elem.append(fragment);
      } else {
        fragment.insertAfter(insertAtElement);
      }

      childViews.replace(start, 0, addedViews);
    }

    var emptyView = get(this, 'emptyView');
    if (get(childViews, 'length') === 0 && emptyView) {
      if (SC.Object.detect(emptyView)) {
        emptyView = this.createChildView(emptyView);
      }

      set(this, 'emptyView', emptyView);
      emptyView.createElement().$().appendTo(elem);
      set(this, 'childViews', [emptyView]);
    }
  }
});
